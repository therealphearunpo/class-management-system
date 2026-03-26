import React, { useEffect, useMemo, useState } from 'react';

import {
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineCog,
  HiOutlineDatabase,
  HiOutlineDownload,
  HiOutlineExclamationCircle,
  HiOutlineRefresh,
  HiOutlineShieldCheck,
  HiOutlineTrash,
} from 'react-icons/hi';
import { Navigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { authAPI, messagesAPI, studentsAPI } from '../../services/api';
import Button from '../common/Button';
import Modal from '../common/Modal';

const STORAGE_GROUPS = [
  {
    key: 'messages_local_v1',
    title: 'Local message drafts',
    description: 'Remove device-only drafts and cached message records.',
  },
  {
    key: 'report_history_v1',
    title: 'Export history',
    description: 'Clear local report export history for this device.',
  },
  {
    key: 'calendar_custom_events_v1',
    title: 'Calendar custom events',
    description: 'Remove locally stored admin calendar events.',
  },
  {
    key: 'assignments_local_v2',
    title: 'Assignment cache',
    description: 'Clear locally cached assignment records.',
  },
];

const FULL_RESET_KEYS = [
  'messages_local_v1',
  'report_history_v1',
  'calendar_custom_events_v1',
  'assignments_local_v2',
  'students_local_v2',
  'marksheets_local_v2',
  'teachers_local_v1',
  'exam_announcements_local_v1',
  'assignment_announcements_local_v1',
];

function formatBytes(value) {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function getStorageEntrySummary(key) {
  try {
    const raw = localStorage.getItem(key);
    const length = raw ? raw.length : 0;
    const parsed = raw ? JSON.parse(raw) : null;
    const items = Array.isArray(parsed) ? parsed.length : raw ? 1 : 0;
    return {
      key,
      exists: Boolean(raw),
      items,
      size: length * 2,
    };
  } catch {
    const raw = localStorage.getItem(key) || '';
    return {
      key,
      exists: Boolean(raw),
      items: raw ? 1 : 0,
      size: raw.length * 2,
    };
  }
}

export default function DeveloperToolsPage() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [notification, setNotification] = useState(null);
  const [storageEntries, setStorageEntries] = useState([]);
  const [diagnostics, setDiagnostics] = useState([]);
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [runningAction, setRunningAction] = useState(false);

  const isAdminCenterMember = Boolean(user?.isAdminCenterMember);

  useEffect(() => {
    if (!notification) return undefined;
    const timeoutId = window.setTimeout(() => setNotification(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [notification]);

  const refreshStorageSummary = () => {
    setStorageEntries(STORAGE_GROUPS.map((entry) => ({
      ...entry,
      ...getStorageEntrySummary(entry.key),
    })));
  };

  useEffect(() => {
    refreshStorageSummary();
  }, []);

  const storageTotals = useMemo(() => {
    const activeEntries = storageEntries.filter((entry) => entry.exists);
    return {
      groups: activeEntries.length,
      items: activeEntries.reduce((sum, entry) => sum + entry.items, 0),
      size: activeEntries.reduce((sum, entry) => sum + entry.size, 0),
    };
  }, [storageEntries]);

  const runDiagnostics = async () => {
    setRunningDiagnostics(true);
    const checks = [
      {
        id: 'auth-session',
        label: 'Auth session',
        run: () => authAPI.me(),
      },
      {
        id: 'students-api',
        label: 'Students API',
        run: () => studentsAPI.getAll(),
      },
      {
        id: 'messages-api',
        label: 'Messages API',
        run: () => messagesAPI.getAll(),
      },
    ];

    const results = [];
    for (const check of checks) {
      const startedAt = Date.now();
      try {
        await check.run();
        results.push({
          id: check.id,
          label: check.label,
          status: 'ok',
          detail: 'Reachable',
          durationMs: Date.now() - startedAt,
        });
      } catch (error) {
        results.push({
          id: check.id,
          label: check.label,
          status: 'error',
          detail: error?.response?.data?.message || error?.message || 'Request failed',
          durationMs: Date.now() - startedAt,
        });
      }
    }

    setDiagnostics(results);
    setRunningDiagnostics(false);
  };

  const exportDiagnostics = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      user: {
        email: user?.email || '',
        role: user?.role || '',
        isAdminCenterMember: Boolean(user?.isAdminCenterMember),
      },
      theme: isDark ? 'dark' : 'light',
      storageEntries,
      diagnostics,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `developer-tools-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setNotification({ type: 'success', text: 'Diagnostics exported successfully.' });
  };

  const executeAction = async () => {
    if (!pendingAction) return;
    setRunningAction(true);

    try {
      if (pendingAction.type === 'clear-storage') {
        localStorage.removeItem(pendingAction.key);
        refreshStorageSummary();
        setNotification({ type: 'success', text: `${pendingAction.title} cleared.` });
      }

      if (pendingAction.type === 'reset-all') {
        FULL_RESET_KEYS.forEach((key) => localStorage.removeItem(key));
        refreshStorageSummary();
        setNotification({ type: 'success', text: 'Local developer caches cleared for this device.' });
      }

      setPendingAction(null);
    } catch (error) {
      setNotification({
        type: 'error',
        text: error?.message || 'Could not complete the selected developer action.',
      });
    } finally {
      setRunningAction(false);
    }
  };

  if (!isAdminCenterMember) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6">
      {notification && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            notification.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-green-200 bg-green-50 text-green-700'
          }`}
        >
          {notification.text}
        </div>
      )}

      <section className="institution-card overflow-hidden rounded-[28px] px-6 py-6 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--moeys-gold)]">
              Internal Admin Center Utility
            </p>
            <h1 className="mt-3 text-3xl font-bold text-gray-800 dark:text-gray-100 sm:text-4xl">
              Developer Tools
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600 dark:text-gray-300">
              Use this page for safe diagnostics, local maintenance, and internal admin-center troubleshooting.
              These controls are intended for internal operations only.
            </p>
          </div>

          <div className="rounded-[24px] border border-[rgba(15,47,99,0.08)] bg-[linear-gradient(135deg,rgba(15,47,99,0.05),rgba(200,155,60,0.08))] px-5 py-5 dark:border-slate-700 dark:bg-[linear-gradient(135deg,rgba(30,64,175,0.14),rgba(200,155,60,0.1))]">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-[var(--moeys-navy)]/10 p-3 text-[var(--moeys-navy)] dark:bg-white/10 dark:text-white">
                <HiOutlineShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Protected access</p>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                  Visible only to Admin Center accounts. Use confirmation before storage resets and internal cleanup.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="institution-card rounded-[24px] px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Theme Mode</p>
              <p className="mt-2 text-3xl font-bold text-gray-800 dark:text-gray-100">{isDark ? 'Dark' : 'Light'}</p>
            </div>
            <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">
              <HiOutlineCog className="h-6 w-6" />
            </div>
          </div>
        </article>

        <article className="institution-card rounded-[24px] px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Storage Groups</p>
              <p className="mt-2 text-3xl font-bold text-gray-800 dark:text-gray-100">{storageTotals.groups}</p>
            </div>
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
              <HiOutlineDatabase className="h-6 w-6" />
            </div>
          </div>
        </article>

        <article className="institution-card rounded-[24px] px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Cached Items</p>
              <p className="mt-2 text-3xl font-bold text-gray-800 dark:text-gray-100">{storageTotals.items}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
              <HiOutlineCheckCircle className="h-6 w-6" />
            </div>
          </div>
        </article>

        <article className="institution-card rounded-[24px] px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Storage Size</p>
              <p className="mt-2 text-3xl font-bold text-gray-800 dark:text-gray-100">{formatBytes(storageTotals.size)}</p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-3 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
              <HiOutlineClock className="h-6 w-6" />
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_380px]">
        <div className="institution-card rounded-[28px] px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--moeys-gold)]">
                Storage Maintenance
              </p>
              <h2 className="mt-2 text-xl font-semibold text-gray-800 dark:text-gray-100">
                Device-level cleanup tools
              </h2>
            </div>
            <Button
              variant="danger"
              icon={HiOutlineTrash}
              onClick={() =>
                setPendingAction({
                  type: 'reset-all',
                  title: 'Reset all local caches',
                  description: 'This clears local developer caches and browser-side records for this device.',
                })
              }
            >
              Reset Local Caches
            </Button>
          </div>

          <div className="mt-5 space-y-4">
            {storageEntries.map((entry) => (
              <div
                key={entry.key}
                className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/50 lg:flex-row lg:items-center lg:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{entry.title}</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{entry.description}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
                    {entry.exists ? `${entry.items} item(s) • ${formatBytes(entry.size)}` : 'No local data stored'}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  disabled={!entry.exists}
                  onClick={() =>
                    setPendingAction({
                      type: 'clear-storage',
                      key: entry.key,
                      title: entry.title,
                      description: entry.description,
                    })
                  }
                >
                  Clear
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="institution-card rounded-[28px] px-6 py-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--moeys-gold)]">
                  Diagnostics
                </p>
                <h2 className="mt-2 text-xl font-semibold text-gray-800 dark:text-gray-100">
                  API and session checks
                </h2>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" icon={HiOutlineDownload} onClick={exportDiagnostics}>
                  Export
                </Button>
                <Button icon={HiOutlineRefresh} loading={runningDiagnostics} onClick={runDiagnostics}>
                  Run Checks
                </Button>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {diagnostics.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500 dark:border-slate-700 dark:text-gray-400">
                  No diagnostics run yet. Use &quot;Run Checks&quot; to test current internal connections.
                </div>
              ) : (
                diagnostics.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl bg-gray-50 px-4 py-4 dark:bg-slate-950/50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{item.label}</p>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                          item.status === 'ok'
                            ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-200'
                            : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-200'
                        }`}
                      >
                        {item.status === 'ok' ? <HiOutlineCheckCircle className="h-4 w-4" /> : <HiOutlineExclamationCircle className="h-4 w-4" />}
                        {item.status === 'ok' ? 'OK' : 'Error'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{item.detail}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
                      {item.durationMs} ms
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <Modal
        isOpen={Boolean(pendingAction)}
        onClose={() => !runningAction && setPendingAction(null)}
        title={pendingAction?.title || 'Confirm Action'}
        preventClose={runningAction}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {pendingAction?.description}
          </p>
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
            Use with caution. This affects only the current device unless otherwise stated.
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" disabled={runningAction} onClick={() => setPendingAction(null)}>
              Cancel
            </Button>
            <Button variant="danger" icon={HiOutlineTrash} loading={runningAction} onClick={executeAction}>
              Confirm
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
