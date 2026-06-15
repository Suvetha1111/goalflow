/**
 * Dashboard Routes
 * GET /api/dashboard/stats       - Overall stats for dashboard
 * GET /api/dashboard/daily-chart - Last 14 days progress data
 * GET /api/dashboard/streak      - User streak info
 * GET /api/dashboard/notifications - User notifications
 */
const router = require('express').Router();
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;

    // Goal stats
    const goalStats = await pool.query(
      `SELECT 
         COUNT(*) as total_goals,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_goals,
         COUNT(CASE WHEN status = 'active' THEN 1 END) as active_goals,
         ROUND(AVG(completion_percentage)) as avg_completion
       FROM goals WHERE user_id = $1`,
      [userId]
    );

    // Today's tasks
    const today = new Date().toISOString().split('T')[0];
    const todayTasks = await pool.query(
      `SELECT 
         COUNT(*) as total,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
       FROM tasks 
       WHERE user_id = $1 AND due_date = $2`,
      [userId, today]
    );

    // Overall task completion
    const taskStats = await pool.query(
      `SELECT 
         COUNT(*) as total,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
         COUNT(CASE WHEN status = 'in-progress' THEN 1 END) as in_progress,
         COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
       FROM tasks WHERE user_id = $1`,
      [userId]
    );

    // User XP and level
    const userStats = await pool.query(
      'SELECT xp_points, level, streak_count FROM users WHERE id = $1',
      [userId]
    );

    const gs = goalStats.rows[0];
    const ts = taskStats.rows[0];
    const tt = todayTasks.rows[0];
    const us = userStats.rows[0];

    const productivity = ts.total > 0
      ? Math.round((ts.completed / ts.total) * 100)
      : 0;

    res.json({
      goals: {
        total: parseInt(gs.total_goals),
        completed: parseInt(gs.completed_goals),
        active: parseInt(gs.active_goals),
        avg_completion: parseInt(gs.avg_completion) || 0,
      },
      tasks: {
        total: parseInt(ts.total),
        completed: parseInt(ts.completed),
        in_progress: parseInt(ts.in_progress),
        pending: parseInt(ts.pending),
      },
      today: {
        total: parseInt(tt.total),
        completed: parseInt(tt.completed),
      },
      user: {
        xp_points: us?.xp_points || 0,
        level: us?.level || 'Beginner',
        streak_count: us?.streak_count || 0,
      },
      productivity_percentage: productivity,
    });
  } catch (err) {
    console.error('Dashboard stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch dashboard stats.' });
  }
});

// GET /api/dashboard/daily-chart - Last 14 days
router.get('/daily-chart', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         date::text,
         tasks_completed,
         xp_earned
       FROM daily_tracker
       WHERE user_id = $1
         AND date >= NOW() - INTERVAL '14 days'
       ORDER BY date ASC`,
      [req.user.id]
    );

    // Fill in missing days with zeros
    const data = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const found = result.rows.find(r => r.date === dateStr);
      data.push({
        date: dateStr,
        label: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        tasks_completed: found ? parseInt(found.tasks_completed) : 0,
        xp_earned: found ? parseInt(found.xp_earned) : 0,
      });
    }

    res.json({ chart_data: data });
  } catch (err) {
    console.error('Daily chart error:', err.message);
    res.status(500).json({ error: 'Failed to fetch chart data.' });
  }
});

// GET /api/dashboard/notifications
router.get('/notifications', async (req, res) => {
  try {
    const userId = req.user.id;

    // Auto-generate deadline reminders (goals due in 3 days)
    const deadlineGoals = await pool.query(
      `SELECT id, title, deadline, completion_percentage
       FROM goals
       WHERE user_id = $1
         AND status = 'active'
         AND deadline BETWEEN NOW() AND NOW() + INTERVAL '3 days'`,
      [userId]
    );

    // Upsert notifications for deadline reminders
    for (const goal of deadlineGoals.rows) {
      const daysLeft = Math.ceil(
        (new Date(goal.deadline) - new Date()) / (1000 * 60 * 60 * 24)
      );
      await pool.query(
        `INSERT INTO notifications (user_id, type, message, related_goal_id)
         VALUES ($1, 'deadline', $2, $3)
         ON CONFLICT DO NOTHING`,
        [
          userId,
          `⏰ "${goal.title}" is due in ${daysLeft} day(s). You're ${goal.completion_percentage}% done.`,
          goal.id,
        ]
      );
    }

    const result = await pool.query(
      `SELECT * FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    );

    res.json({ notifications: result.rows });
  } catch (err) {
    console.error('Notifications error:', err.message);
    res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

// PATCH /api/dashboard/notifications/:id/read
router.patch('/notifications/:id/read', async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Notification marked as read.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notification.' });
  }
});

module.exports = router;

// GET /api/dashboard/heatmap - Full year heatmap data
router.get('/heatmap', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         date::text,
         tasks_completed,
         xp_earned
       FROM daily_tracker
       WHERE user_id = $1
         AND date >= NOW() - INTERVAL '365 days'
       ORDER BY date ASC`,
      [req.user.id]
    );

    // Build a map of date -> data
    const dataMap = {};
    result.rows.forEach(r => {
      dataMap[r.date] = {
        tasks_completed: parseInt(r.tasks_completed),
        xp_earned: parseInt(r.xp_earned),
      };
    });

    // Fill all 365 days
    const heatmap = [];
    for (let i = 364; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      heatmap.push({
        date: dateStr,
        tasks_completed: dataMap[dateStr]?.tasks_completed || 0,
        xp_earned: dataMap[dateStr]?.xp_earned || 0,
        level: dataMap[dateStr]
          ? dataMap[dateStr].tasks_completed >= 8 ? 4
            : dataMap[dateStr].tasks_completed >= 5 ? 3
            : dataMap[dateStr].tasks_completed >= 2 ? 2
            : dataMap[dateStr].tasks_completed >= 1 ? 1 : 0
          : 0,
      });
    }

    res.json({ heatmap });
  } catch (err) {
    console.error('Heatmap error:', err.message);
    res.status(500).json({ error: 'Failed to fetch heatmap data.' });
  }
});
