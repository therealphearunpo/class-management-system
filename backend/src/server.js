require('dotenv').config();

const cors = require('cors');
const express = require('express');

const attendanceRoutes = require('./routes/attendanceRoutes');
const authRoutes = require('./routes/authRoutes');
const messagesRoutes = require('./routes/messagesRoutes');
const studentsRoutes = require('./routes/studentsRoutes');
const teachersRoutes = require('./routes/teachersRoutes');
const telegramRoutes = require('./routes/telegramRoutes');

const app = express();
const port = Number(process.env.PORT || 3001);

const corsOptions = {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'class-management-backend' });
});

app.use('/api/auth', authRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/teachers', teachersRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/telegram', telegramRoutes);

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
