/**
 * Goals Routes
 * GET    /api/goals          - List all user goals
 * POST   /api/goals          - Create new goal
 * GET    /api/goals/:id      - Get single goal with tasks
 * PUT    /api/goals/:id      - Update goal
 * DELETE /api/goals/:id      - Delete goal
 * GET    /api/goals/insights - Smart insights for user
 */
const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// Apply auth to all goal routes
router.use(authenticate);

// Helper: recalculate goal completion percentage
const updateGoalCompletion = async (goalId, client) => {
  const db = client || pool;
  const result = await db.query(
    `SELECT 
       COUNT(*) as total,
       COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
     FROM tasks WHERE goal_id = $1`,
    [goalId]
  );

  const { total, completed } = result.rows[0];
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const goalStatus = percentage === 100 ? 'completed' : 'active';

  await db.query(
    `UPDATE goals SET completion_percentage = $1, status = $2, updated_at = NOW() 
     WHERE id = $3`,
    [percentage, goalStatus, goalId]
  );

  return percentage;
};

// GET /api/goals
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT g.*, 
              COUNT(t.id) as total_tasks,
              COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks
       FROM goals g
       LEFT JOIN tasks t ON t.goal_id = g.id
       WHERE g.user_id = $1
       GROUP BY g.id
       ORDER BY 
         CASE g.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
         g.deadline ASC NULLS LAST`,
      [req.user.id]
    );

    res.json({ goals: result.rows });
  } catch (err) {
    console.error('Get goals error:', err.message);
    res.status(500).json({ error: 'Failed to fetch goals.' });
  }
});

// POST /api/goals
router.post('/', [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  body('deadline').optional().isDate(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { title, description, deadline, priority = 'medium' } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO goals (user_id, title, description, deadline, priority)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.id, title, description, deadline || null, priority]
    );

    res.status(201).json({ goal: result.rows[0] });
  } catch (err) {
    console.error('Create goal error:', err.message);
    res.status(500).json({ error: 'Failed to create goal.' });
  }
});

// GET /api/goals/:id
router.get('/:id', async (req, res) => {
  try {
    const goalResult = await pool.query(
      'SELECT * FROM goals WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (goalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found.' });
    }

    const tasksResult = await pool.query(
      'SELECT * FROM tasks WHERE goal_id = $1 ORDER BY position ASC, created_at ASC',
      [req.params.id]
    );

    res.json({
      goal: goalResult.rows[0],
      tasks: tasksResult.rows,
    });
  } catch (err) {
    console.error('Get goal error:', err.message);
    res.status(500).json({ error: 'Failed to fetch goal.' });
  }
});

// PUT /api/goals/:id
router.put('/:id', [
  body('title').optional().trim().notEmpty(),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  body('deadline').optional().isDate(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { title, description, deadline, priority } = req.body;

  try {
    // Build dynamic update query
    const updates = [];
    const values = [];
    let idx = 1;

    if (title !== undefined)       { updates.push(`title = $${idx++}`);       values.push(title); }
    if (description !== undefined) { updates.push(`description = $${idx++}`); values.push(description); }
    if (deadline !== undefined)    { updates.push(`deadline = $${idx++}`);    values.push(deadline); }
    if (priority !== undefined)    { updates.push(`priority = $${idx++}`);    values.push(priority); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.params.id, req.user.id);

    const result = await pool.query(
      `UPDATE goals SET ${updates.join(', ')} 
       WHERE id = $${idx++} AND user_id = $${idx}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found.' });
    }

    res.json({ goal: result.rows[0] });
  } catch (err) {
    console.error('Update goal error:', err.message);
    res.status(500).json({ error: 'Failed to update goal.' });
  }
});

// DELETE /api/goals/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM goals WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found.' });
    }

    res.json({ message: 'Goal deleted successfully.' });
  } catch (err) {
    console.error('Delete goal error:', err.message);
    res.status(500).json({ error: 'Failed to delete goal.' });
  }
});

// GET /api/goals/insights/smart
router.get('/insights/smart', async (req, res) => {
  try {
    const userId = req.user.id;
    const insights = [];

    // Goals behind schedule (deadline within 7 days, < 50% complete)
    const behindGoals = await pool.query(
      `SELECT title, completion_percentage, deadline 
       FROM goals 
       WHERE user_id = $1 
         AND status = 'active' 
         AND deadline BETWEEN NOW() AND NOW() + INTERVAL '7 days'
         AND completion_percentage < 50`,
      [userId]
    );

    behindGoals.rows.forEach(g => {
      insights.push({
        type: 'warning',
        message: `⚠️ You're falling behind on "${g.title}" — only ${g.completion_percentage}% complete with the deadline approaching.`,
      });
    });

    // Weekly completion rate
    const weeklyStats = await pool.query(
      `SELECT 
         COUNT(*) as total,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
       FROM tasks 
       WHERE user_id = $1 
         AND updated_at >= NOW() - INTERVAL '7 days'`,
      [userId]
    );

    const { total, completed } = weeklyStats.rows[0];
    if (total > 0) {
      const rate = Math.round((completed / total) * 100);
      insights.push({
        type: rate >= 70 ? 'success' : 'info',
        message: `📊 You completed ${rate}% of tasks this week (${completed}/${total}).`,
      });
    }

    // Goals with no tasks
    const emptyGoals = await pool.query(
      `SELECT g.title FROM goals g
       LEFT JOIN tasks t ON t.goal_id = g.id
       WHERE g.user_id = $1 AND g.status = 'active' AND t.id IS NULL
       LIMIT 3`,
      [userId]
    );

    emptyGoals.rows.forEach(g => {
      insights.push({
        type: 'info',
        message: `💡 "${g.title}" has no tasks yet. Break it down into actionable steps!`,
      });
    });

    // Streak insight
    const userResult = await pool.query(
      'SELECT streak_count FROM users WHERE id = $1',
      [userId]
    );

    const streak = userResult.rows[0]?.streak_count || 0;
    if (streak >= 7) {
      insights.push({
        type: 'success',
        message: `🔥 Amazing! You're on a ${streak}-day streak. Keep it going!`,
      });
    } else if (streak > 0) {
      insights.push({
        type: 'info',
        message: `🔥 You're on a ${streak}-day streak. Come back tomorrow to keep it going!`,
      });
    }

    res.json({ insights });
  } catch (err) {
    console.error('Insights error:', err.message);
    res.status(500).json({ error: 'Failed to generate insights.' });
  }
});

module.exports = { router, updateGoalCompletion };
