const pool = require('../config/db');
const {
  generateTemporaryPassword,
  hashPassword,
} = require('../utils/passwords');

function toBool(value) {
  return Boolean(Number(value) || value === true);
}

function makeStudentEmail(studentCode) {
  const normalized = String(studentCode || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

  return `${normalized || `student${Date.now()}`}@student.school.local`;
}

function toAccountSummary(account) {
  const userId = Number(account.userId);
  return {
    accountType: account.accountType,
    accountId: Number(account.accountId),
    userId: Number.isFinite(userId) && userId > 0 ? userId : null,
    fullName: String(account.fullName || '').trim(),
    email: account.email,
    role: account.role,
    sourceLabel: account.sourceLabel,
    hasAccount: account.hasAccount !== false,
    mustChangePassword: toBool(account.mustChangePassword),
  };
}

async function getAdminAccounts() {
  const [rows] = await pool.query(`
    SELECT
      'admin' AS accountType,
      u.id AS accountId,
      u.id AS userId,
      u.full_name AS fullName,
      u.email,
      u.role,
      'School Admin' AS sourceLabel,
      1 AS hasAccount,
      u.must_change_password AS mustChangePassword
    FROM users u
    WHERE u.role = 'admin'
    ORDER BY u.full_name ASC
  `);

  return rows.map(toAccountSummary);
}

async function getTeacherAccounts() {
  const [rows] = await pool.query(`
    SELECT
      'teacher' AS accountType,
      t.id AS accountId,
      u.id AS userId,
      t.full_name AS fullName,
      u.email,
      u.role,
      CONCAT('Teacher - ', t.department) AS sourceLabel,
      1 AS hasAccount,
      u.must_change_password AS mustChangePassword
    FROM teachers t
    JOIN users u ON u.id = t.user_id
    ORDER BY t.full_name ASC
  `);

  return rows.map(toAccountSummary);
}

async function getStudentAccounts() {
  const [rows] = await pool.query(`
    SELECT
      'student' AS accountType,
      s.id AS accountId,
      u.id AS userId,
      s.full_name AS fullName,
      COALESCE(s.email, u.email) AS email,
      COALESCE(u.role, 'student') AS role,
      CONCAT('Student - ', s.class_name) AS sourceLabel,
      CASE WHEN s.user_id IS NULL THEN 0 ELSE 1 END AS hasAccount,
      COALESCE(u.must_change_password, 0) AS mustChangePassword
    FROM students s
    LEFT JOIN users u ON u.id = s.user_id
    ORDER BY s.full_name ASC
  `);

  return rows.map(toAccountSummary);
}

async function listAccounts(req, res) {
  try {
    const requestedRole = String(req.query?.role || 'all').trim().toLowerCase();
    const roleSet = new Set(
      requestedRole === 'all' || !requestedRole
        ? ['admin', 'teacher', 'student']
        : [requestedRole]
    );

    const sections = [];
    if (roleSet.has('admin')) sections.push(...(await getAdminAccounts()));
    if (roleSet.has('teacher')) sections.push(...(await getTeacherAccounts()));
    if (roleSet.has('student')) sections.push(...(await getStudentAccounts()));

    sections.sort((left, right) =>
      String(left.fullName || '').localeCompare(String(right.fullName || ''))
    );
    return res.status(200).json(sections);
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to load accounts',
      error: error?.message || 'Unknown error',
    });
  }
}

async function resolveAccountTarget(connection, accountType, accountId) {
  if (accountType === 'admin') {
    const [rows] = await connection.query(
      `
        SELECT
          u.id AS userId,
          u.id AS accountId,
          u.email,
          u.full_name AS fullName,
          u.gender,
          u.role,
          u.must_change_password AS mustChangePassword
        FROM users u
        WHERE u.id = ? AND u.role = 'admin'
        LIMIT 1
      `,
      [accountId]
    );

    if (rows.length === 0) return null;
    return {
      accountType: 'admin',
      accountId,
      sourceLabel: 'School Admin',
      hasAccount: true,
      ...rows[0],
    };
  }

  if (accountType === 'teacher') {
    const [rows] = await connection.query(
      `
        SELECT
          t.id AS accountId,
          u.id AS userId,
          u.email,
          t.full_name AS fullName,
          t.gender,
          u.role,
          t.department,
          u.must_change_password AS mustChangePassword
        FROM teachers t
        JOIN users u ON u.id = t.user_id
        WHERE t.id = ?
        LIMIT 1
      `,
      [accountId]
    );

    if (rows.length === 0) return null;
    return {
      accountType: 'teacher',
      sourceLabel: `Teacher - ${rows[0].department}`,
      hasAccount: true,
      ...rows[0],
    };
  }

  if (accountType === 'student') {
    const [rows] = await connection.query(
      `
        SELECT
          s.id AS accountId,
          s.user_id AS userId,
          s.student_code AS studentCode,
          s.full_name AS fullName,
          s.gender,
          s.class_name AS className,
          COALESCE(s.email, u.email) AS email,
          COALESCE(u.role, 'student') AS role,
          COALESCE(u.must_change_password, 0) AS mustChangePassword
        FROM students s
        LEFT JOIN users u ON u.id = s.user_id
        WHERE s.id = ?
        LIMIT 1
      `,
      [accountId]
    );

    if (rows.length === 0) return null;
    return {
      accountType: 'student',
      sourceLabel: `Student - ${rows[0].className}`,
      hasAccount: Boolean(rows[0].userId),
      ...rows[0],
    };
  }

  return null;
}

async function resetPassword(req, res) {
  const connection = await pool.getConnection();
  try {
    const accountType = String(req.body?.accountType || '').trim().toLowerCase();
    const accountId = Number(req.body?.accountId);

    if (!['admin', 'teacher', 'student'].includes(accountType) || !Number.isFinite(accountId) || accountId <= 0) {
      return res.status(400).json({ message: 'Valid accountType and accountId are required' });
    }

    await connection.beginTransaction();
    const target = await resolveAccountTarget(connection, accountType, accountId);
    if (!target) {
      await connection.rollback();
      return res.status(404).json({ message: 'Account not found' });
    }

    if (target.accountType === 'admin' && Number(target.userId) === Number(req.user?.id)) {
      await connection.rollback();
      return res.status(400).json({ message: 'Use Change Password for your own account' });
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    let targetUserId = Number(target.userId);
    let email = String(target.email || '').trim().toLowerCase();

    if (accountType === 'student' && !targetUserId) {
      email = email || makeStudentEmail(target.studentCode);
      const [userResult] = await connection.query(
        `
          INSERT INTO users (email, password_hash, role, full_name, gender, must_change_password)
          VALUES (?, ?, 'student', ?, ?, 1)
        `,
        [email, passwordHash, target.fullName, target.gender || 'male']
      );

      targetUserId = Number(userResult.insertId);
      await connection.query(
        'UPDATE students SET user_id = ?, email = ? WHERE id = ?',
        [targetUserId, email, accountId]
      );
    } else {
      await connection.query(
        'UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?',
        [passwordHash, targetUserId]
      );

      if (accountType === 'student' && email) {
        await connection.query('UPDATE students SET email = ? WHERE id = ?', [email, accountId]);
      }
    }

    await connection.query(
      `
        INSERT INTO password_reset_audit (actor_user_id, target_user_id, target_role, target_reference_id, action)
        VALUES (?, ?, ?, ?, 'admin_reset')
      `,
      [req.user.id, targetUserId, accountType, accountId]
    );

    await connection.commit();
    return res.status(200).json({
      message: 'Temporary password issued',
      temporaryPassword,
      account: toAccountSummary({
        ...target,
        userId: targetUserId,
        email,
        hasAccount: true,
        mustChangePassword: true,
      }),
    });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({
      message: 'Failed to reset password',
      error: error?.message || 'Unknown error',
    });
  } finally {
    connection.release();
  }
}

module.exports = {
  listAccounts,
  resetPassword,
};
