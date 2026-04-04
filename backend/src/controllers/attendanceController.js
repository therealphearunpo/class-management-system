const pool = require('../config/db');

const ALLOWED_STATUSES = new Set(['present', 'absent', 'late']);

function normalizeType(value) {
  const key = String(value || '').trim().toLowerCase();
  return key === 'teacher' ? 'teacher' : 'student';
}

function normalizeDate(value) {
  const raw = String(value || '').trim();
  const date = raw || new Date().toISOString().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
}

function normalizeStatus(value) {
  const key = String(value || '').trim().toLowerCase();
  return ALLOWED_STATUSES.has(key) ? key : null;
}

function normalizeOptionalText(value, maxLen = 100) {
  const text = String(value || '').trim();
  if (!text) return null;
  return text.slice(0, maxLen);
}

function assertRoleAccess(role, type) {
  if (role === 'teacher' && type === 'teacher') {
    return 'Teacher cannot access teacher attendance.';
  }
  return null;
}

async function getToday(req, res) {
  try {
    const date = normalizeDate(req.query?.date);
    const recordType = normalizeType(req.query?.recordType);
    const className = normalizeOptionalText(req.query?.className, 40);
    const shiftName = normalizeOptionalText(req.query?.shiftName, 40);
    const subjectKey = normalizeOptionalText(req.query?.subjectKey, 60);

    const accessError = assertRoleAccess(req.user?.role, recordType);
    if (accessError) return res.status(403).json({ message: accessError });

    const params = [date, recordType];
    let where = 'attendance_date = ? AND record_type = ?';
    if (className) {
      where += ' AND class_name = ?';
      params.push(className);
    }
    if (shiftName) {
      where += ' AND shift_name = ?';
      params.push(shiftName);
    }
    if (subjectKey) {
      where += ' AND subject_key = ?';
      params.push(subjectKey);
    }

    const [rows] = await pool.query(
      `SELECT target_id, status FROM attendance_records WHERE ${where} ORDER BY target_id`,
      params
    );

    const records = rows.reduce((acc, row) => {
      acc[String(row.target_id)] = row.status;
      return acc;
    }, {});

    return res.status(200).json({
      date,
      recordType,
      records,
      count: rows.length,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to load attendance records',
      error: error?.message || 'Unknown error',
    });
  }
}

async function mark(req, res) {
  try {
    const date = normalizeDate(req.body?.date);
    const recordType = normalizeType(req.body?.recordType);
    const targetId = String(req.body?.targetId || '').trim();
    const status = normalizeStatus(req.body?.status);
    const className = normalizeOptionalText(req.body?.className, 40);
    const shiftName = normalizeOptionalText(req.body?.shiftName, 40);
    const subjectKey = normalizeOptionalText(req.body?.subjectKey, 60);

    const accessError = assertRoleAccess(req.user?.role, recordType);
    if (accessError) return res.status(403).json({ message: accessError });

    if (!targetId || !status) {
      return res.status(400).json({ message: 'targetId and valid status are required' });
    }

    await pool.query(
      `
        INSERT INTO attendance_records
          (attendance_date, record_type, target_id, class_name, shift_name, subject_key, status, marked_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          status = VALUES(status),
          marked_by = VALUES(marked_by),
          updated_at = CURRENT_TIMESTAMP
      `,
      [date, recordType, targetId, className, shiftName, subjectKey, status, req.user?.id || null]
    );

    return res.status(200).json({ message: 'Attendance updated' });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to update attendance',
      error: error?.message || 'Unknown error',
    });
  }
}

async function bulkMark(req, res) {
  try {
    const date = normalizeDate(req.body?.date);
    const recordType = normalizeType(req.body?.recordType);
    const className = normalizeOptionalText(req.body?.className, 40);
    const shiftName = normalizeOptionalText(req.body?.shiftName, 40);
    const subjectKey = normalizeOptionalText(req.body?.subjectKey, 60);
    const records = Array.isArray(req.body?.records) ? req.body.records : [];

    const accessError = assertRoleAccess(req.user?.role, recordType);
    if (accessError) return res.status(403).json({ message: accessError });

    if (records.length === 0) {
      return res.status(400).json({ message: 'records array is required' });
    }

    const validRows = records
      .map((item) => ({
        targetId: String(item?.targetId || '').trim(),
        status: normalizeStatus(item?.status),
      }))
      .filter((item) => item.targetId && item.status);

    if (validRows.length === 0) {
      return res.status(400).json({ message: 'No valid attendance records provided' });
    }

    const placeholders = validRows.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const params = [];
    validRows.forEach((row) => {
      params.push(
        date,
        recordType,
        row.targetId,
        className,
        shiftName,
        subjectKey,
        row.status,
        req.user?.id || null
      );
    });

    await pool.query(
      `
        INSERT INTO attendance_records
          (attendance_date, record_type, target_id, class_name, shift_name, subject_key, status, marked_by)
        VALUES ${placeholders}
        ON DUPLICATE KEY UPDATE
          status = VALUES(status),
          marked_by = VALUES(marked_by),
          updated_at = CURRENT_TIMESTAMP
      `,
      params
    );

    return res.status(200).json({ message: 'Attendance submitted', count: validRows.length });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to submit attendance',
      error: error?.message || 'Unknown error',
    });
  }
}

async function getHistory(req, res) {
  try {
    const recordType = normalizeType(req.query?.recordType);
    const accessError = assertRoleAccess(req.user?.role, recordType);
    if (accessError) return res.status(403).json({ message: accessError });

    const dateFrom = normalizeDate(req.query?.dateFrom);
    const dateTo = normalizeDate(req.query?.dateTo || req.query?.dateFrom);
    const limit = Math.min(500, Math.max(1, Number(req.query?.limit || 100)));

    const [rows] = await pool.query(
      `
        SELECT attendance_date, target_id, status, class_name, shift_name, subject_key, updated_at
        FROM attendance_records
        WHERE record_type = ? AND attendance_date BETWEEN ? AND ?
        ORDER BY attendance_date DESC, target_id ASC
        LIMIT ?
      `,
      [recordType, dateFrom, dateTo, limit]
    );

    return res.status(200).json({ items: rows, count: rows.length });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to load attendance history',
      error: error?.message || 'Unknown error',
    });
  }
}

async function getStats(req, res) {
  try {
    const date = normalizeDate(req.query?.date);
    const recordType = normalizeType(req.query?.recordType);
    const accessError = assertRoleAccess(req.user?.role, recordType);
    if (accessError) return res.status(403).json({ message: accessError });

    const [rows] = await pool.query(
      `
        SELECT status, COUNT(*) AS count
        FROM attendance_records
        WHERE attendance_date = ? AND record_type = ?
        GROUP BY status
      `,
      [date, recordType]
    );

    const stats = { present: 0, absent: 0, late: 0 };
    rows.forEach((row) => {
      const key = String(row.status || '').toLowerCase();
      if (Object.prototype.hasOwnProperty.call(stats, key)) {
        stats[key] = Number(row.count || 0);
      }
    });

    return res.status(200).json({ date, recordType, ...stats, total: stats.present + stats.absent + stats.late });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to load attendance stats',
      error: error?.message || 'Unknown error',
    });
  }
}

async function exportAttendance(req, res) {
  try {
    const date = normalizeDate(req.query?.date);
    const recordType = normalizeType(req.query?.recordType);
    const accessError = assertRoleAccess(req.user?.role, recordType);
    if (accessError) return res.status(403).json({ message: accessError });

    const [rows] = await pool.query(
      `
        SELECT attendance_date, target_id, class_name, shift_name, subject_key, status
        FROM attendance_records
        WHERE attendance_date = ? AND record_type = ?
        ORDER BY target_id ASC
      `,
      [date, recordType]
    );

    const escapeCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [
      ['Date', date],
      ['Record Type', recordType],
      [],
      ['Target ID', 'Class', 'Shift', 'Subject', 'Status'],
      ...rows.map((row) => [row.target_id, row.class_name, row.shift_name, row.subject_key, row.status]),
    ]
      .map((line) => line.map(escapeCell).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-${recordType}-${date}.csv"`);
    return res.status(200).send(csv);
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to export attendance',
      error: error?.message || 'Unknown error',
    });
  }
}

module.exports = {
  getToday,
  mark,
  bulkMark,
  getHistory,
  getStats,
  exportAttendance,
};
