import React, { useEffect, useMemo, useState } from 'react';

import { HiOutlinePaperAirplane } from 'react-icons/hi';

import { messagesAPI } from '../../services/api';
import Badge from '../common/Badge';
import Button from '../common/Button';

const LOCAL_MESSAGES_KEY = 'messages_local_v1';

function readLocalMessages() {
  try {
    const raw = localStorage.getItem(LOCAL_MESSAGES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalMessages(messages) {
  try {
    localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(messages));
  } catch {
    // ignore localStorage failures
  }
}

export default function MessagesPage() {
  const [messages, setMessages] = useState([]);
  const [form, setForm] = useState({
    audience: 'All Users',
    channel: 'Announcement',
    subject: '',
    body: '',
    attachmentName: '',
    attachmentUrl: '',
    status: 'sent',
  });
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadMessages = async () => {
      setLoading(true);
      try {
        const response = await messagesAPI.getAll();
        const items = Array.isArray(response?.data) ? response.data : [];
        setMessages(items);
        saveLocalMessages(items);
      } catch {
        setMessages(readLocalMessages());
      } finally {
        setLoading(false);
      }
    };
    loadMessages();
  }, []);

  const stats = useMemo(() => ({
    total: messages.length,
    sms: messages.filter((m) => m.channel === 'SMS').length,
    email: messages.filter((m) => m.channel === 'Email').length,
    announcements: messages.filter((m) => m.channel === 'Announcement').length,
  }), [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.body.trim()) return;

    setSubmitting(true);
    const payload = {
      audience: form.audience,
      channel: form.channel,
      subject: form.subject.trim(),
      body: form.body.trim(),
      attachmentName: String(form.attachmentName || '').trim() || null,
      attachmentUrl: String(form.attachmentUrl || '').trim() || null,
      status: form.status,
    };

    try {
      await messagesAPI.create(payload);
      const now = new Date();
      const newItem = {
        id: Date.now(),
        ...payload,
        createdAt: now.toISOString(),
      };
      setMessages((prev) => {
        const next = [newItem, ...prev];
        saveLocalMessages(next);
        return next;
      });
      setForm({
        audience: 'All Users',
        channel: 'Announcement',
        subject: '',
        body: '',
        attachmentName: '',
        attachmentUrl: '',
        status: 'sent',
      });
      setNotification('Message posted successfully.');
    } catch {
      const now = new Date();
      const draftItem = {
        id: Date.now(),
        ...payload,
        status: 'draft',
        createdAt: now.toISOString(),
      };
      setMessages((prev) => {
        const next = [draftItem, ...prev];
        saveLocalMessages(next);
        return next;
      });
      setNotification('API unavailable. Saved as draft locally.');
    } finally {
      setSubmitting(false);
      setTimeout(() => setNotification(null), 2500);
    }
  };

  return (
    <div className="space-y-6">
      {notification && (
        <div className="rounded-lg px-4 py-3 text-sm bg-green-50 text-green-700 border border-green-200">
          {notification}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-800">SMS/Mail</h1>
        <p className="text-sm text-gray-500 mt-1">
          Admin Center message hub for announcements, SMS, and email records.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-card text-center">
          <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
          <p className="text-xs text-gray-500 mt-1">Total Sent</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-card text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.sms}</p>
          <p className="text-xs text-gray-500 mt-1">SMS</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-card text-center">
          <p className="text-2xl font-bold text-purple-600">{stats.email}</p>
          <p className="text-xs text-gray-500 mt-1">Email</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-card text-center">
          <p className="text-2xl font-bold text-green-600">{stats.announcements}</p>
          <p className="text-xs text-gray-500 mt-1">Announcements</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-card p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Compose Message</h2>
        <form onSubmit={sendMessage} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={form.audience}
              onChange={(e) => setForm((prev) => ({ ...prev, audience: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option>All Users</option>
              <option>All Students</option>
              <option>All Teachers</option>
              <option>Grade 9 Students</option>
              <option>Grade 10 Students</option>
              <option>Grade 11 Students</option>
              <option>Grade 12 Students</option>
            </select>
            <select
              value={form.channel}
              onChange={(e) => setForm((prev) => ({ ...prev, channel: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option>Announcement</option>
              <option>SMS</option>
              <option>Email</option>
            </select>
          </div>

          <input
            value={form.subject}
            onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
            placeholder="Subject"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            required
          />
          <textarea
            value={form.body}
            onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
            placeholder="Write your message..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={form.attachmentName}
              onChange={(e) => setForm((prev) => ({ ...prev, attachmentName: e.target.value }))}
              placeholder="Attachment name (optional)"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <input
              value={form.attachmentUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, attachmentUrl: e.target.value }))}
              placeholder="Attachment link (optional)"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <select
            value={form.status}
            onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="sent">Send Now</option>
            <option value="draft">Save Draft</option>
          </select>

          <div className="flex justify-end">
            <Button type="submit" icon={HiOutlinePaperAirplane} loading={submitting}>
              {submitting ? 'Saving...' : (form.status === 'draft' ? 'Save Draft' : 'Send')}
            </Button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-card p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Recent Messages</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading messages...</p>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className="p-3 rounded-lg border border-gray-100 bg-gray-50">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-gray-800">{msg.subject}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant={msg.channel === 'SMS' ? 'info' : msg.channel === 'Email' ? 'success' : 'primary'}>
                      {msg.channel}
                    </Badge>
                    <Badge variant={msg.status === 'draft' ? 'warning' : 'success'}>
                      {msg.status || 'sent'}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">To: {msg.audience}</p>
                <p className="text-sm text-gray-600 mt-2">{msg.body}</p>
                {msg.attachmentUrl && (
                  <a
                    href={msg.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary-600 mt-2 inline-block underline"
                  >
                    {msg.attachmentName || 'Open attachment'}
                  </a>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  Sent: {String(msg.createdAt || msg.sentAt || '').replace('T', ' ').slice(0, 16)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
