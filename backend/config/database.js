/**
 * Database configuration for NeonDB (PostgreSQL)
 * Uses connection pooling for optimal performance
 */
const { Pool } = require('pg');
require('dotenv').config();

// Strip sslmode/channel_binding from the URL so the ssl object below takes
// full control and avoids the pg-connection-string sslmode conflict.
const dbUrl = new URL(process.env.DATABASE_URL);
dbUrl.searchParams.delete('sslmode');
dbUrl.searchParams.delete('channel_binding');

const pool = new Pool({
  connectionString: dbUrl.toString(),
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  // NeonDB serverless instances can take several seconds to wake from suspension
  connectionTimeoutMillis: 10000,
});

pool.on('connect', () => console.log('✅ Connected to NeonDB'));
pool.on('error', (err) => console.error('❌ Database error:', err.message));

const initDB = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        xp_points INTEGER DEFAULT 0,
        level VARCHAR(20) DEFAULT 'Beginner',
        streak_count INTEGER DEFAULT 0,
        last_active_date DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Goals table
    await client.query(`
      CREATE TABLE IF NOT EXISTS goals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        deadline DATE,
        priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
        completion_percentage INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Tasks table — with target_value, current_value, unit for progress tracking
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed')),
        due_date DATE,
        position INTEGER DEFAULT 0,
        xp_reward INTEGER DEFAULT 10,
        target_value NUMERIC DEFAULT NULL,
        current_value NUMERIC DEFAULT 0,
        unit VARCHAR(50) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Add new columns to existing tasks table if upgrading
    await client.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS target_value NUMERIC DEFAULT NULL`);
    await client.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS current_value NUMERIC DEFAULT 0`);
    await client.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS unit VARCHAR(50) DEFAULT NULL`);

    // Daily tracker table (for heatmap + streaks)
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_tracker (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        tasks_completed INTEGER DEFAULT 0,
        goals_worked_on INTEGER DEFAULT 0,
        xp_earned INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, date)
      )
    `);

    // Notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        related_goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_goal_id ON tasks(goal_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_daily_tracker_user_date ON daily_tracker(user_id, date)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`);

    await client.query('COMMIT');
    console.log('✅ Database schema initialized');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Schema initialization failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { pool, initDB };
