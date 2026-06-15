/**
 * Tasks Routes
 * GET    /api/tasks              - Get today's tasks
 * GET    /api/tasks/all          - All tasks with filters
 * POST   /api/tasks              - Create task for a goal
 * PATCH  /api/tasks/:id/status   - Quick status toggle (awards XP)
 * PATCH  /api/tasks/:id/progress - Update partial progress (e.g. 10/20 mins)
 * PUT    /api/tasks/:id          - Full task update
 * DELETE /api/tasks/:id          - Delete task
 * PUT    /api/tasks/reorder/batch - Drag and drop reorder
 */
const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { updateGoalCompletion } = require('./goals');

router.use(authenticate);

// ── Helpers ──────────────────────────────────────────────────────────────────

const awardXP = async (userId, xpAmount) => {
  const result = await pool.query(
    `UPDATE users 
     SET xp_points = xp_points + $1,
         level = CASE 
           WHEN xp_points + $1 >= 5000 THEN 'Legend'
           WHEN xp_points + $1 >= 2000 THEN 'Pro'
           WHEN xp_points + $1 >= 500  THEN 'Advanced'
           ELSE 'Beginner'
         END,
         updated_at = NOW()
     WHERE id = $2
     RETURNING xp_points, level`,
    [xpAmount, userId]
  );
  return result.rows[0];
};

const logDailyActivity = async (userId, tasksCompleted = 0, xpEarned = 0) => {
  const today = new Date().toISOString().split('T')[0];
  await pool.query(
    `INSERT INTO daily_tracker (user_id, date, tasks_completed, xp_earned)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, date)
     DO UPDATE SET 
       tasks_completed = daily_tracker.tasks_completed + $3,
       xp_earned = daily_tracker.xp_earned + $4`,
    [userId, today, tasksCompleted, xpEarned]
  );
};

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/tasks - Today's tasks
router.get('/', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const result = await pool.query(
      `SELECT t.*, g.title as goal_title, g.priority as goal_priority
       FROM tasks t
       JOIN goals g ON g.id = t.goal_id
       WHERE t.user_id = $1
         AND (t.due_date = $2 OR t.due_date IS NULL)
         AND t.status != 'completed'
       ORDER BY 
         CASE g.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
         t.due_date ASC NULLS LAST`,
      [req.user.id, today]
    );
    res.json({ tasks: result.rows });
  } catch (err) {
    console.error('Get tasks error:', err.message);
    res.status(500).json({ error: 'Failed to fetch tasks.' });
  }
});

// GET /api/tasks/all
router.get('/all', async (req, res) => {
  try {
    const { goal_id, status } = req.query;
    let query = `
      SELECT t.*, g.title as goal_title 
      FROM tasks t
      JOIN goals g ON g.id = t.goal_id
      WHERE t.user_id = $1
    `;
    const values = [req.user.id];
    let idx = 2;
    if (goal_id) { query += ` AND t.goal_id = $${idx++}`; values.push(goal_id); }
    if (status)  { query += ` AND t.status = $${idx++}`;  values.push(status); }
    query += ' ORDER BY t.position ASC, t.created_at ASC';
    const result = await pool.query(query, values);
    res.json({ tasks: result.rows });
  } catch (err) {
    console.error('Get all tasks error:', err.message);
    res.status(500).json({ error: 'Failed to fetch tasks.' });
  }
});

// POST /api/tasks - Create task
// Supports target_value + unit for measurable tasks (e.g. 20 mins reading)
router.post('/', [
  body('goal_id').notEmpty().withMessage('Goal ID is required'),
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('status').optional().isIn(['pending', 'in-progress', 'completed']),
  body('due_date').optional().isDate(),
  body('target_value').optional().isNumeric(),
  body('current_value').optional().isNumeric(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const {
    goal_id, title, description,
    status = 'pending', due_date,
    target_value, current_value = 0, unit
  } = req.body;

  try {
    const goalCheck = await pool.query(
      'SELECT id FROM goals WHERE id = $1 AND user_id = $2',
      [goal_id, req.user.id]
    );
    if (goalCheck.rows.length === 0) return res.status(404).json({ error: 'Goal not found.' });

    const posResult = await pool.query(
      'SELECT COALESCE(MAX(position), 0) + 1 as next_pos FROM tasks WHERE goal_id = $1',
      [goal_id]
    );
    const position = posResult.rows[0].next_pos;

    const result = await pool.query(
      `INSERT INTO tasks 
         (goal_id, user_id, title, description, status, due_date, position, target_value, current_value, unit)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [goal_id, req.user.id, title, description, status, due_date || null,
       position, target_value || null, current_value, unit || null]
    );

    await updateGoalCompletion(goal_id);
    res.status(201).json({ task: result.rows[0] });
  } catch (err) {
    console.error('Create task error:', err.message);
    res.status(500).json({ error: 'Failed to create task.' });
  }
});

// PATCH /api/tasks/:id/status - Quick complete/uncomplete toggle
router.patch('/:id/status', [
  body('status').isIn(['pending', 'in-progress', 'completed']).withMessage('Invalid status'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { status } = req.body;

  try {
    const current = await pool.query(
      'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (current.rows.length === 0) return res.status(404).json({ error: 'Task not found.' });

    const task = current.rows[0];
    const wasCompleted = task.status === 'completed';
    const isNowCompleted = status === 'completed';

    // If marking complete and has target_value, set current_value = target_value
    const newCurrentValue = isNowCompleted && task.target_value
      ? task.target_value
      : task.current_value;

    const result = await pool.query(
      'UPDATE tasks SET status = $1, current_value = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [status, newCurrentValue, req.params.id]
    );

    let xpUpdate = null;
    if (!wasCompleted && isNowCompleted) {
      const xpReward = task.xp_reward || 10;
      xpUpdate = await awardXP(req.user.id, xpReward);
      await logDailyActivity(req.user.id, 1, xpReward);
    }

    const completion = await updateGoalCompletion(task.goal_id);

    res.json({
      task: result.rows[0],
      goal_completion: completion,
      xp_update: xpUpdate,
    });
  } catch (err) {
    console.error('Update task status error:', err.message);
    res.status(500).json({ error: 'Failed to update task status.' });
  }
});

// PATCH /api/tasks/:id/progress - Update partial progress
// e.g. { current_value: 10 } when target is 20 mins → 50% done
router.patch('/:id/progress', [
  body('current_value').isNumeric().withMessage('current_value must be a number'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { current_value } = req.body;

  try {
    const taskResult = await pool.query(
      'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (taskResult.rows.length === 0) return res.status(404).json({ error: 'Task not found.' });

    const task = taskResult.rows[0];
    const target = parseFloat(task.target_value);
    const current = parseFloat(current_value);

    // Auto-determine status based on progress
    let newStatus = task.status;
    if (target && current >= target) {
      newStatus = 'completed';
    } else if (current > 0) {
      newStatus = 'in-progress';
    }

    // Calculate remaining
    const remaining = target ? Math.max(target - current, 0) : null;
    const progressPct = target ? Math.min(Math.round((current / target) * 100), 100) : null;

    const wasCompleted = task.status === 'completed';
    const isNowCompleted = newStatus === 'completed';

    const result = await pool.query(
      `UPDATE tasks 
       SET current_value = $1, status = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [current, newStatus, req.params.id]
    );

    // Award XP if newly completed via progress update
    let xpUpdate = null;
    if (!wasCompleted && isNowCompleted) {
      const xpReward = task.xp_reward || 10;
      xpUpdate = await awardXP(req.user.id, xpReward);
      await logDailyActivity(req.user.id, 1, xpReward);
    }

    const goalCompletion = await updateGoalCompletion(task.goal_id);

    res.json({
      task: result.rows[0],
      progress_percentage: progressPct,
      remaining,
      remaining_label: remaining !== null
        ? `${remaining} ${task.unit || 'units'} remaining (${100 - (progressPct || 0)}% left)`
        : null,
      goal_completion: goalCompletion,
      xp_update: xpUpdate,
    });
  } catch (err) {
    console.error('Update progress error:', err.message);
    res.status(500).json({ error: 'Failed to update progress.' });
  }
});

// PUT /api/tasks/:id - Full task update
router.put('/:id', [
  body('title').optional().trim().notEmpty(),
  body('status').optional().isIn(['pending', 'in-progress', 'completed']),
  body('due_date').optional().isDate(),
  body('target_value').optional().isNumeric(),
  body('current_value').optional().isNumeric(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { title, description, status, due_date, position, target_value, current_value, unit } = req.body;

  try {
    const updates = [];
    const values = [];
    let idx = 1;

    if (title !== undefined)         { updates.push(`title = $${idx++}`);         values.push(title); }
    if (description !== undefined)   { updates.push(`description = $${idx++}`);   values.push(description); }
    if (status !== undefined)        { updates.push(`status = $${idx++}`);        values.push(status); }
    if (due_date !== undefined)      { updates.push(`due_date = $${idx++}`);      values.push(due_date); }
    if (position !== undefined)      { updates.push(`position = $${idx++}`);      values.push(position); }
    if (target_value !== undefined)  { updates.push(`target_value = $${idx++}`);  values.push(target_value); }
    if (current_value !== undefined) { updates.push(`current_value = $${idx++}`); values.push(current_value); }
    if (unit !== undefined)          { updates.push(`unit = $${idx++}`);          values.push(unit); }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update.' });

    updates.push(`updated_at = NOW()`);
    values.push(req.params.id, req.user.id);

    const result = await pool.query(
      `UPDATE tasks SET ${updates.join(', ')} 
       WHERE id = $${idx++} AND user_id = $${idx}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found.' });

    await updateGoalCompletion(result.rows[0].goal_id);
    res.json({ task: result.rows[0] });
  } catch (err) {
    console.error('Update task error:', err.message);
    res.status(500).json({ error: 'Failed to update task.' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  try {
    const task = await pool.query(
      'DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );
    if (task.rows.length === 0) return res.status(404).json({ error: 'Task not found.' });
    await updateGoalCompletion(task.rows[0].goal_id);
    res.json({ message: 'Task deleted successfully.' });
  } catch (err) {
    console.error('Delete task error:', err.message);
    res.status(500).json({ error: 'Failed to delete task.' });
  }
});

// PUT /api/tasks/reorder/batch - Drag and drop
router.put('/reorder/batch', async (req, res) => {
  const { tasks } = req.body;
  if (!Array.isArray(tasks)) return res.status(400).json({ error: 'tasks array required.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const { id, position } of tasks) {
      await client.query(
        'UPDATE tasks SET position = $1 WHERE id = $2 AND user_id = $3',
        [position, id, req.user.id]
      );
    }
    await client.query('COMMIT');
    res.json({ message: 'Tasks reordered successfully.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Reorder error:', err.message);
    res.status(500).json({ error: 'Failed to reorder tasks.' });
  } finally {
    client.release();
  }
});

module.exports = router;
