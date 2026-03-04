const pool = require('../config/db');

async function getAllStudents(_req, res) {
  try {
    const [rows] = await pool.query(
      'SELECT id, student_code, full_name, class_name, section, gender, dob FROM students ORDER BY full_name ASC'
    );
    return res.status(200).json(rows);
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch students',
      error: error?.message || 'Unknown error',
    });
  }
}

async function getStudentById(req, res) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      'SELECT id, student_code, full_name, class_name, section, gender, dob FROM students WHERE id = ? LIMIT 1',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }
    return res.status(200).json(rows[0]);
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch student',
      error: error?.message || 'Unknown error',
    });
  }
}

async function createStudent(req, res) {
  try {
    const { student_code, full_name, class_name, section, gender, dob } = req.body;
    const normalizedGender = String(gender || '').trim().toLowerCase();
    if (!student_code || !full_name || !class_name || !section || !['male', 'female'].includes(normalizedGender)) {
      return res
        .status(400)
        .json({ message: 'student_code, full_name, class_name, section, gender are required' });
    }

    await pool.query(
      'INSERT INTO students (student_code, full_name, class_name, section, gender, dob) VALUES (?, ?, ?, ?, ?, ?)',
      [student_code, full_name, class_name, section, normalizedGender, dob || null]
    );

    return res.status(201).json({ message: 'Student created' });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to create student',
      error: error?.message || 'Unknown error',
    });
  }
}

module.exports = {
  getAllStudents,
  getStudentById,
  createStudent,
};
