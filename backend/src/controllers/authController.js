const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { env } = require('../config/env');
const pool = require('../config/db');

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

function toUserPayload(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.full_name,
    gender: user.gender || 'male',
  };
}

async function login(req, res) {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const [rows] = await pool.query(
      'SELECT id, email, password_hash, role, full_name, gender FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = rows[0];
    const passwordOk = await bcrypt.compare(password, user.password_hash);
    if (!passwordOk) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = signToken(user);

    return res.status(200).json({
      token,
      user: toUserPayload(user),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Login failed',
      error: error?.message || 'Unknown error',
    });
  }
}

async function me(req, res) {
  try {
    const [rows] = await pool.query(
      'SELECT id, email, role, full_name, gender FROM users WHERE id = ? LIMIT 1',
      [req.user?.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({ user: toUserPayload(rows[0]) });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to load profile',
      error: error?.message || 'Unknown error',
    });
  }
}

function logout(_req, res) {
  return res.status(200).json({ message: 'Logged out' });
}

module.exports = {
  login,
  logout,
  me,
};
