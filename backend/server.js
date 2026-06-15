/**
 * GoalFlow API Server
 * Main entry point for the Express application
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { initDB } = require('./config/database');

const authRoutes      = require('./routes/auth');
const { router: goalRoutes } = require('./routes/goals');
const taskRoutes      = require('./routes/tasks');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ──────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:3000',
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logger (dev only)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/goals',     goalRoutes);
app.use('/api/tasks',     taskRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Root & health check
app.get('/', (req, res) => {
  res.json({ name: 'GoalFlow API', version: '1.0.0', status: 'running' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({ error: 'An unexpected error occurred.' });
});

// ── Start Server ─────────────────────────────────────────────────────────────
const start = async () => {
  try {
    await initDB();
    app.listen(PORT, () => {
      console.log(`🚀 GoalFlow API running on http://localhost:${PORT}`);
      console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
};

start();
