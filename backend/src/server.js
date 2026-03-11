require('dotenv').config();

const cors = require('cors');
const express = require('express');

const { env, validateEnv } = require('./config/env');
const { syncDemoUsers } = require('./bootstrap/syncDemoUsers');
const pool = require('./config/db');
const attendanceRoutes = require('./routes/attendanceRoutes');
const authRoutes = require('./routes/authRoutes');
const messagesRoutes = require('./routes/messagesRoutes');
const studentsRoutes = require('./routes/studentsRoutes');
const teachersRoutes = require('./routes/teachersRoutes');
const telegramRoutes = require('./routes/telegramRoutes');

const app = express();

validateEnv();

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (env.corsOrigins.length === 0) return true;
  return env.corsOrigins.includes(origin);
}

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));
app.disable('x-powered-by');

app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'class-management-backend', env: env.nodeEnv });
});

app.use('/api/auth', authRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/teachers', teachersRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/telegram', telegramRoutes);

app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use((error, _req, res, _next) => {
  if (String(error?.message || '').includes('CORS')) {
    return res.status(403).json({ message: 'Request blocked by CORS policy' });
  }

  return res.status(500).json({
    message: 'Internal server error',
    error: env.nodeEnv === 'production' ? undefined : error?.message || 'Unknown error',
  });
});

async function start() {
  try {
    await pool.query('SELECT 1');
    await syncDemoUsers();
    app.listen(env.port, () => {
      console.log(`Backend listening on http://localhost:${env.port}`);
    });
  } catch (error) {
    console.error('Backend startup failed:', error?.message || error);
    process.exit(1);
  }
}

start();
