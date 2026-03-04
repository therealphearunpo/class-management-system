const bcrypt = require('bcryptjs');

const pool = require('../config/db');

function cleanText(value, maxLen = 120) {
  return String(value || '').trim().slice(0, maxLen);
}

async function getAllTeachers(_req, res) {
  try {
    const [rows] = await pool.query(
      `
        SELECT
          t.id,
          t.user_id AS userId,
          u.email,
          u.role,
          u.gender,
          t.employee_code AS employeeCode,
          t.full_name AS fullName,
          t.gender AS profileGender,
          t.department,
          t.subject_name AS subjectName,
          t.phone,
          t.is_active AS isActive
        FROM teachers t
        JOIN users u ON u.id = t.user_id
        ORDER BY t.full_name ASC
      `
    );
    return res.status(200).json(rows);
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to load teachers',
      error: error?.message || 'Unknown error',
    });
  }
}

async function createTeacher(req, res) {
  const connection = await pool.getConnection();
  try {
    const email = cleanText(req.body?.email, 150).toLowerCase();
    const password = String(req.body?.password || '');
    const employeeCode = cleanText(req.body?.employeeCode, 50);
    const fullName = cleanText(req.body?.fullName, 120);
    const gender = String(req.body?.gender || '').trim().toLowerCase();
    const department = cleanText(req.body?.department, 80);
    const subjectName = cleanText(req.body?.subjectName, 80);
    const phone = cleanText(req.body?.phone, 40) || null;

    if (
      !email || !password || !employeeCode || !fullName || !department || !subjectName ||
      !['male', 'female'].includes(gender)
    ) {
      return res.status(400).json({
        message: 'email, password, employeeCode, fullName, gender, department, subjectName are required',
      });
    }

    const hashed = await bcrypt.hash(password, 10);

    await connection.beginTransaction();

    const [userResult] = await connection.query(
      'INSERT INTO users (email, password_hash, role, full_name, gender) VALUES (?, ?, ?, ?, ?)',
      [email, hashed, 'teacher', fullName, gender]
    );

    const userId = userResult.insertId;
    await connection.query(
      `
        INSERT INTO teachers (user_id, employee_code, full_name, gender, department, subject_name, phone, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `,
      [userId, employeeCode, fullName, gender, department, subjectName, phone]
    );

    await connection.commit();
    return res.status(201).json({ message: 'Teacher account created' });
  } catch (error) {
    await connection.rollback();
    const message = String(error?.message || '').includes('Duplicate entry')
      ? 'Teacher email or employee code already exists'
      : 'Failed to create teacher account';
    return res.status(500).json({ message, error: error?.message || 'Unknown error' });
  } finally {
    connection.release();
  }
}

async function updateTeacher(req, res) {
  const connection = await pool.getConnection();
  try {
    const teacherId = Number(req.params?.id);
    if (!Number.isFinite(teacherId) || teacherId <= 0) {
      return res.status(400).json({ message: 'Invalid teacher id' });
    }

    const fullName = cleanText(req.body?.fullName, 120);
    const gender = String(req.body?.gender || '').trim().toLowerCase();
    const department = cleanText(req.body?.department, 80);
    const subjectName = cleanText(req.body?.subjectName, 80);
    const phone = cleanText(req.body?.phone, 40) || null;
    const isActive = req.body?.isActive === false ? 0 : 1;
    const newPassword = String(req.body?.password || '').trim();

    if (!fullName || !department || !subjectName || !['male', 'female'].includes(gender)) {
      return res.status(400).json({ message: 'fullName, gender, department, subjectName are required' });
    }

    await connection.beginTransaction();

    const [teacherRows] = await connection.query(
      'SELECT user_id AS userId FROM teachers WHERE id = ? LIMIT 1',
      [teacherId]
    );
    if (teacherRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Teacher not found' });
    }

    const userId = teacherRows[0].userId;
    await connection.query(
      `
        UPDATE teachers
        SET full_name = ?, gender = ?, department = ?, subject_name = ?, phone = ?, is_active = ?
        WHERE id = ?
      `,
      [fullName, gender, department, subjectName, phone, isActive, teacherId]
    );

    await connection.query('UPDATE users SET full_name = ?, gender = ? WHERE id = ?', [fullName, gender, userId]);

    if (newPassword) {
      const hashed = await bcrypt.hash(newPassword, 10);
      await connection.query('UPDATE users SET password_hash = ? WHERE id = ?', [hashed, userId]);
    }

    await connection.commit();
    return res.status(200).json({ message: 'Teacher account updated' });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({
      message: 'Failed to update teacher account',
      error: error?.message || 'Unknown error',
    });
  } finally {
    connection.release();
  }
}

module.exports = {
  createTeacher,
  getAllTeachers,
  updateTeacher,
};
