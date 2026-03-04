const pool = require('../config/db');

function cleanText(value, maxLen = 255) {
  return String(value || '').trim().slice(0, maxLen);
}

function normalizeChannel(value) {
  const key = String(value || '').trim().toLowerCase();
  if (key === 'email') return 'Email';
  if (key === 'sms') return 'SMS';
  return 'Announcement';
}

function normalizeAudience(value) {
  const text = cleanText(value, 120);
  return text || 'All Users';
}

function normalizeStatus(value) {
  const key = String(value || '').trim().toLowerCase();
  return key === 'draft' ? 'draft' : 'sent';
}

async function getAllMessages(req, res) {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    const status = cleanText(req.query?.status, 20).toLowerCase();
    const channel = normalizeChannel(req.query?.channel);

    const params = [];
    const whereParts = [];

    if (status === 'draft' || status === 'sent') {
      whereParts.push('m.status = ?');
      params.push(status);
    }

    if (req.query?.channel) {
      whereParts.push('m.channel = ?');
      params.push(channel);
    }

    if (role !== 'admin') {
      whereParts.push("(m.channel = 'Announcement' AND m.status = 'sent')");
    }

    const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `
        SELECT
          m.id,
          m.audience,
          m.channel,
          m.subject,
          m.body,
          m.status,
          m.attachment_name AS attachmentName,
          m.attachment_url AS attachmentUrl,
          m.created_at AS createdAt,
          m.updated_at AS updatedAt,
          u.full_name AS createdByName
        FROM messages m
        LEFT JOIN users u ON u.id = m.created_by
        ${whereSql}
        ORDER BY m.created_at DESC
        LIMIT 300
      `,
      params
    );

    return res.status(200).json(rows);
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to load messages',
      error: error?.message || 'Unknown error',
    });
  }
}

async function createMessage(req, res) {
  try {
    const audience = normalizeAudience(req.body?.audience);
    const channel = normalizeChannel(req.body?.channel);
    const subject = cleanText(req.body?.subject, 180);
    const body = cleanText(req.body?.body, 4000);
    const status = normalizeStatus(req.body?.status);
    const attachmentName = cleanText(req.body?.attachmentName, 180) || null;
    const attachmentUrl = cleanText(req.body?.attachmentUrl, 800) || null;

    if (!subject || !body) {
      return res.status(400).json({ message: 'subject and body are required' });
    }

    const [result] = await pool.query(
      `
        INSERT INTO messages
          (audience, channel, subject, body, status, attachment_name, attachment_url, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [audience, channel, subject, body, status, attachmentName, attachmentUrl, req.user?.id || null]
    );

    return res.status(201).json({ message: 'Message saved', id: result.insertId });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to create message',
      error: error?.message || 'Unknown error',
    });
  }
}

module.exports = {
  createMessage,
  getAllMessages,
};
