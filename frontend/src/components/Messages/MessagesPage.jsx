import React, { useEffect, useMemo, useState } from 'react';

import {
  HiOutlineMail,
  HiOutlinePencil,
  HiOutlinePaperAirplane,
  HiOutlineSearch,
  HiOutlineTrash,
} from 'react-icons/hi';

import { useAuth } from '../../context/AuthContext';
import { classOptions } from '../../data/students';
import { messagesAPI, studentsAPI, teachersAPI } from '../../services/api';
import Badge from '../common/Badge';
import Button from '../common/Button';
import Modal from '../common/Modal';

const LOCAL_MESSAGES_KEY = 'messages_local_v1';
const DEFAULT_AUDIENCE = 'All Users';
const DEFAULT_CHANNEL = 'Announcement';
const DEFAULT_STATUS = 'sent';

const EMPTY_FORM = {
  audience: DEFAULT_AUDIENCE,
  channel: DEFAULT_CHANNEL,
  subject: '',
  body: '',
  attachmentName: '',
  attachmentUrl: '',
  status: DEFAULT_STATUS,
};

function normalizeMessage(item, index = 0) {
  const rawId = item?.id ?? `local-${Date.now()}-${index}`;
  return {
    id: String(rawId),
    audience: String(item?.audience || DEFAULT_AUDIENCE).trim() || DEFAULT_AUDIENCE,
    channel: ['SMS', 'Email', 'Announcement'].includes(item?.channel) ? item.channel : DEFAULT_CHANNEL,
    subject: String(item?.subject || '').trim(),
    body: String(item?.body || '').trim(),
    attachmentName: String(item?.attachmentName || '').trim(),
    attachmentUrl: String(item?.attachmentUrl || '').trim(),
    status: item?.status === 'draft' ? 'draft' : 'sent',
    createdAt: item?.createdAt || item?.sentAt || new Date().toISOString(),
    updatedAt: item?.updatedAt || item?.createdAt || item?.sentAt || new Date().toISOString(),
    createdByName: String(item?.createdByName || '').trim(),
    isLocalOnly: Boolean(item?.isLocalOnly) || String(rawId).startsWith('local-'),
  };
}

function readLocalMessages() {
  try {
    const raw = localStorage.getItem(LOCAL_MESSAGES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map((item, index) => normalizeMessage(item, index)) : [];
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

function mergeMessages(remoteMessages, localMessages) {
  const remote = remoteMessages.map((item, index) => normalizeMessage(item, index));
  const remoteIds = new Set(remote.map((item) => item.id));
  const localOnly = localMessages
    .map((item, index) => normalizeMessage(item, index))
    .filter((item) => item.isLocalOnly || !remoteIds.has(item.id));
  return [...remote, ...localOnly].sort(
    (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
  );
}

function isValidAttachmentUrl(value) {
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function formatDateTime(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getChannelBadgeVariant(channel) {
  if (channel === 'SMS') return 'info';
  if (channel === 'Email') return 'success';
  return 'neutral';
}

function getStatusBadgeVariant(status) {
  return status === 'draft' ? 'warning' : 'success';
}

export default function MessagesPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [channelFilter, setChannelFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [pendingDeleteMessage, setPendingDeleteMessage] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    const loadPageData = async () => {
      setLoading(true);
      const localMessages = readLocalMessages();

      try {
        const [messagesResponse, studentsResponse, teachersResponse] = await Promise.all([
          messagesAPI.getAll(),
          studentsAPI.getAll().catch(() => ({ data: [] })),
          teachersAPI.getAll().catch(() => ({ data: [] })),
        ]);

        const remoteMessages = Array.isArray(messagesResponse?.data) ? messagesResponse.data : [];
        const studentItems = Array.isArray(studentsResponse?.data) ? studentsResponse.data : [];
        const teacherItems = Array.isArray(teachersResponse?.data) ? teachersResponse.data : [];
        const mergedMessages = mergeMessages(remoteMessages, localMessages);

        setMessages(mergedMessages);
        setStudents(studentItems);
        setTeachers(teacherItems);
        saveLocalMessages(mergedMessages);
      } catch {
        setMessages(localMessages);
      } finally {
        setLoading(false);
      }
    };

    loadPageData();
  }, []);

  useEffect(() => {
    if (!notification) return undefined;
    const timeoutId = window.setTimeout(() => setNotification(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [notification]);

  const audienceOptions = useMemo(() => {
    const classSet = new Set(
      students
        .map((student) => String(student?.class || student?.class_name || '').trim().toUpperCase())
        .filter(Boolean)
    );
    const knownClasses = classOptions
      .map((option) => option.value)
      .filter(Boolean)
      .filter((value) => classSet.has(String(value).trim().toUpperCase()));
    const fallbackClasses = knownClasses.length > 0
      ? knownClasses
      : classOptions.map((option) => option.value).filter(Boolean);

    const departments = Array.from(
      new Set(
        teachers
          .map((teacher) => String(teacher?.department || '').trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    return [
      DEFAULT_AUDIENCE,
      'All Students',
      'All Teachers',
      'Admin Center',
      ...fallbackClasses.map((value) => `Class ${value}`),
      ...departments.map((department) => `Department: ${department}`),
    ];
  }, [students, teachers]);

  const stats = useMemo(() => {
    const sent = messages.filter((item) => item.status === 'sent').length;
    const drafts = messages.filter((item) => item.status === 'draft').length;
    const announcements = messages.filter((item) => item.channel === 'Announcement').length;
    const localOnly = messages.filter((item) => item.isLocalOnly).length;
    return { sent, drafts, announcements, localOnly };
  }, [messages]);

  const filteredMessages = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return messages.filter((item) => {
      if (channelFilter !== 'All' && item.channel !== channelFilter) return false;
      if (statusFilter !== 'All' && item.status !== statusFilter) return false;
      if (!search) return true;
      const haystack = [
        item.subject,
        item.body,
        item.audience,
        item.createdByName,
        item.channel,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    });
  }, [messages, searchTerm, channelFilter, statusFilter]);

  const bodyLength = form.body.trim().length;
  const smsLengthWarning = form.channel === 'SMS' && bodyLength > 160;

  const resetComposer = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const upsertLocalMessage = (item) => {
    const normalized = normalizeMessage(item);
    setMessages((prev) => {
      const exists = prev.some((message) => message.id === normalized.id);
      const next = exists
        ? prev.map((message) => (message.id === normalized.id ? normalized : message))
        : [normalized, ...prev];
      const sorted = next.sort(
        (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
      );
      saveLocalMessages(sorted);
      return sorted;
    });
  };

  const removeLocalMessage = (messageId) => {
    setMessages((prev) => {
      const next = prev.filter((message) => message.id !== messageId);
      saveLocalMessages(next);
      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const payload = {
      audience: String(form.audience || '').trim() || DEFAULT_AUDIENCE,
      channel: form.channel,
      subject: String(form.subject || '').trim(),
      body: String(form.body || '').trim(),
      attachmentName: String(form.attachmentName || '').trim(),
      attachmentUrl: String(form.attachmentUrl || '').trim(),
      status: form.status,
    };

    if (!payload.subject || !payload.body) {
      setNotification({ type: 'error', text: 'Subject and message body are required.' });
      return;
    }

    if (!isValidAttachmentUrl(payload.attachmentUrl)) {
      setNotification({ type: 'error', text: 'Attachment link must start with http:// or https://.' });
      return;
    }

    setSubmitting(true);
    try {
      const response = editingId
        ? await messagesAPI.update(editingId, payload)
        : await messagesAPI.create(payload);
      const savedItem = normalizeMessage(response?.data?.item || {
        ...payload,
        id: editingId || Date.now(),
        createdByName: user?.name || user?.fullName || user?.roleLabel || 'Admin Center',
      });

      upsertLocalMessage({ ...savedItem, isLocalOnly: false });
      setNotification({
        type: 'success',
        text: editingId ? 'Message updated successfully.' : 'Message saved successfully.',
      });
      resetComposer();
    } catch (error) {
      const isEditingLocal = Boolean(editingId && String(editingId).startsWith('local-'));
      if (!editingId || isEditingLocal) {
        const localId = editingId || `local-${Date.now()}`;
        upsertLocalMessage({
          ...payload,
          id: localId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdByName: user?.name || user?.fullName || 'Admin Center',
          isLocalOnly: true,
          status: payload.status === 'sent' ? 'draft' : payload.status,
        });
        setNotification({
          type: 'warning',
          text: editingId
            ? 'Server unavailable. Local draft updated on this device.'
            : 'Server unavailable. Saved as a local draft on this device.',
        });
        resetComposer();
      } else {
        setNotification({
          type: 'error',
          text: error?.response?.data?.message || 'Could not save this message right now.',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (message) => {
    setEditingId(message.id);
    setForm({
      audience: message.audience || DEFAULT_AUDIENCE,
      channel: message.channel || DEFAULT_CHANNEL,
      subject: message.subject || '',
      body: message.body || '',
      attachmentName: message.attachmentName || '',
      attachmentUrl: message.attachmentUrl || '',
      status: message.status || DEFAULT_STATUS,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (message) => {
    setDeleteSubmitting(true);
    setDeleteError('');
    try {
      if (message.isLocalOnly) {
        removeLocalMessage(message.id);
      } else {
        await messagesAPI.delete(message.id);
        removeLocalMessage(message.id);
      }

      if (editingId === message.id) {
        resetComposer();
      }

      setPendingDeleteMessage(null);
      setNotification({ type: 'success', text: 'Message removed successfully.' });
    } catch (error) {
      const status = Number(error?.response?.status || 0);
      const errorText =
        status === 404 || status === 405
          ? 'Delete endpoint is unavailable. Restart the backend server and try again.'
          : error?.response?.data?.message || 'Could not remove this message right now.';
      setDeleteError(errorText);
      setNotification({
        type: 'error',
        text: errorText,
      });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const openDeleteModal = (message) => {
    setDeleteError('');
    setPendingDeleteMessage(message);
  };

  const closeDeleteModal = () => {
    if (deleteSubmitting) return;
    setDeleteError('');
    setPendingDeleteMessage(null);
  };

  return (
    <div className="space-y-6">
      {notification && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            notification.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : notification.type === 'warning'
                ? 'border-yellow-200 bg-yellow-50 text-yellow-700'
                : 'border-green-200 bg-green-50 text-green-700'
          }`}
        >
          {notification.text}
        </div>
      )}

      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">SMS/Mail</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage school announcements, SMS notices, and email records with a cleaner admin workflow.
          </p>
        </div>
        <div className="rounded-xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-700 dark:border-primary-900/40 dark:bg-primary-950/30 dark:text-primary-200">
          {editingId ? 'Editing selected message' : 'Compose and publish from one control panel'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl bg-white p-4 text-center shadow-card dark:bg-slate-900">
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{stats.sent}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Sent</p>
        </div>
        <div className="rounded-xl bg-white p-4 text-center shadow-card dark:bg-slate-900">
          <p className="text-2xl font-bold text-yellow-600">{stats.drafts}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Drafts</p>
        </div>
        <div className="rounded-xl bg-white p-4 text-center shadow-card dark:bg-slate-900">
          <p className="text-2xl font-bold text-blue-600">{stats.announcements}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Announcements</p>
        </div>
        <div className="rounded-xl bg-white p-4 text-center shadow-card dark:bg-slate-900">
          <p className="text-2xl font-bold text-purple-600">{stats.localOnly}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Local Only</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl bg-white p-6 shadow-card dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-800 dark:text-gray-100">
                {editingId ? 'Edit Message' : 'Compose Message'}
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Use real school audiences and keep the message record tidy after posting.
              </p>
            </div>
            {editingId && (
              <Button variant="secondary" onClick={resetComposer}>
                Cancel Edit
              </Button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">Audience</span>
                <select
                  value={form.audience}
                  onChange={(event) => setField('audience', event.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-950 dark:text-gray-100"
                >
                  {audienceOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">Channel</span>
                <select
                  value={form.channel}
                  onChange={(event) => setField('channel', event.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-950 dark:text-gray-100"
                >
                  <option value="Announcement">Announcement</option>
                  <option value="SMS">SMS</option>
                  <option value="Email">Email</option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">Subject</span>
              <input
                value={form.subject}
                onChange={(event) => setField('subject', event.target.value)}
                placeholder="Enter a clear subject"
                maxLength={180}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-950 dark:text-gray-100"
                required
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">Message</span>
              <textarea
                value={form.body}
                onChange={(event) => setField('body', event.target.value)}
                placeholder="Write the full message"
                rows={5}
                maxLength={4000}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-950 dark:text-gray-100"
                required
              />
            </label>

            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>{bodyLength} / 4000 characters</span>
              {smsLengthWarning && <span>SMS messages over 160 characters may be split on delivery.</span>}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Attachment Label
                </span>
                <input
                  value={form.attachmentName}
                  onChange={(event) => setField('attachmentName', event.target.value)}
                  placeholder="Optional file label"
                  maxLength={180}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-950 dark:text-gray-100"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Attachment Link
                </span>
                <input
                  value={form.attachmentUrl}
                  onChange={(event) => setField('attachmentUrl', event.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-950 dark:text-gray-100"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">Delivery</span>
                <select
                  value={form.status}
                  onChange={(event) => setField('status', event.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-950 dark:text-gray-100"
                >
                  <option value="sent">Send Now</option>
                  <option value="draft">Save Draft</option>
                </select>
              </label>

              <div className="flex justify-end gap-2">
                <Button type="submit" icon={HiOutlinePaperAirplane} loading={submitting}>
                  {submitting ? 'Saving...' : editingId ? 'Update Message' : form.status === 'draft' ? 'Save Draft' : 'Send'}
                </Button>
              </div>
            </div>
          </form>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-card dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-full bg-primary-100 p-3 text-primary-700 dark:bg-primary-950/40 dark:text-primary-200">
              <HiOutlineMail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800 dark:text-gray-100">Composer Preview</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Quick check before you publish to the school audience.
              </p>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={getChannelBadgeVariant(form.channel)}>{form.channel}</Badge>
              <Badge variant={getStatusBadgeVariant(form.status)}>{form.status}</Badge>
              <Badge variant="neutral">{form.audience || DEFAULT_AUDIENCE}</Badge>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                {form.subject.trim() || 'No subject yet'}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">
                {form.body.trim() || 'Your message preview will appear here.'}
              </p>
            </div>
            {form.attachmentUrl && (
              <div className="rounded-lg border border-dashed border-primary-200 px-3 py-2 text-sm text-primary-700 dark:border-primary-900/40 dark:text-primary-200">
                Attachment: {form.attachmentName || form.attachmentUrl}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-card dark:bg-slate-900">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold text-gray-800 dark:text-gray-100">Message Records</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Search, review, edit, or remove sent and draft records.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="relative block">
              <HiOutlineSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search messages"
                className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-950 dark:text-gray-100"
              />
            </label>

            <select
              value={channelFilter}
              onChange={(event) => setChannelFilter(event.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-950 dark:text-gray-100"
            >
              <option value="All">All Channels</option>
              <option value="Announcement">Announcement</option>
              <option value="SMS">SMS</option>
              <option value="Email">Email</option>
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-950 dark:text-gray-100"
            >
              <option value="All">All Statuses</option>
              <option value="sent">Sent</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading messages...</p>
        ) : filteredMessages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-slate-700 dark:text-gray-400">
            No messages match the current filters.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMessages.map((message) => (
              <div
                key={message.id}
                className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-950/60"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{message.subject}</p>
                      <Badge variant={getChannelBadgeVariant(message.channel)}>{message.channel}</Badge>
                      <Badge variant={getStatusBadgeVariant(message.status)}>{message.status}</Badge>
                      {message.isLocalOnly && <Badge variant="warning">Local only</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">To: {message.audience}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">{message.body}</p>
                    {message.attachmentUrl && (
                      <a
                        href={message.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-xs text-primary-600 underline dark:text-primary-300"
                      >
                        {message.attachmentName || 'Open attachment'}
                      </a>
                    )}
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 dark:text-gray-500">
                      <span>Created: {formatDateTime(message.createdAt)}</span>
                      <span>Updated: {formatDateTime(message.updatedAt)}</span>
                      <span>By: {message.createdByName || 'Admin Center'}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button variant="secondary" size="sm" icon={HiOutlinePencil} onClick={() => handleEdit(message)}>
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      icon={HiOutlineTrash}
                      onClick={() => openDeleteModal(message)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={Boolean(pendingDeleteMessage)}
        onClose={closeDeleteModal}
        title="Remove Message"
        preventClose={deleteSubmitting}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Delete{' '}
            <span className="font-semibold text-gray-800">
              &quot;{pendingDeleteMessage?.subject || 'this message'}&quot;
            </span>
            ?
            This action cannot be undone.
          </p>
          {deleteError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {deleteError}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={closeDeleteModal} disabled={deleteSubmitting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={HiOutlineTrash}
              loading={deleteSubmitting}
              disabled={deleteSubmitting}
              onClick={() => pendingDeleteMessage && handleDelete(pendingDeleteMessage)}
            >
              Remove
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
