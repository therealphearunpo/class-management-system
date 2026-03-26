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

function mapMessageRow(row) {
  return {
    id: row.id,
    audience: row.audience,
    channel: row.channel,
    subject: row.subject,
    body: row.body,
    status: row.status,
    attachmentName: row.attachmentName,
    attachmentUrl: row.attachmentUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdByName: row.createdByName,
  };
}

async function fetchMessageById(messageId) {
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
      WHERE m.id = ?
      LIMIT 1
    `,
    [messageId]
  );

  return rows[0] ? mapMessageRow(rows[0]) : null;
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

    return res.status(200).json(rows.map(mapMessageRow));
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

    const savedMessage = await fetchMessageById(result.insertId);
    return res.status(201).json({
      message: 'Message saved',
      item: savedMessage,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to create message',
      error: error?.message || 'Unknown error',
    });
  }
}

async function updateMessage(req, res) {
  try {
    const messageId = Number(req.params?.id);
    if (!Number.isFinite(messageId) || messageId <= 0) {
      return res.status(400).json({ message: 'Invalid message id' });
    }

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
        UPDATE messages
        SET audience = ?, channel = ?, subject = ?, body = ?, status = ?, attachment_name = ?, attachment_url = ?
        WHERE id = ?
      `,
      [audience, channel, subject, body, status, attachmentName, attachmentUrl, messageId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const savedMessage = await fetchMessageById(messageId);
    return res.status(200).json({
      message: 'Message updated',
      item: savedMessage,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to update message',
      error: error?.message || 'Unknown error',
    });
  }
}

async function deleteMessage(req, res) {
  try {
    const messageId = Number(req.params?.id);
    if (!Number.isFinite(messageId) || messageId <= 0) {
      return res.status(400).json({ message: 'Invalid message id' });
    }

    const [result] = await pool.query('DELETE FROM messages WHERE id = ? LIMIT 1', [messageId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Message not found' });
    }

    return res.status(200).json({ message: 'Message deleted' });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to delete message',
      error: error?.message || 'Unknown error',
    });
  }
}

module.exports = {
  createMessage,
  deleteMessage,
  getAllMessages,
  updateMessage,
};
