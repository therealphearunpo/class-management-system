import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  HiOutlineBell,
  HiOutlineCog,
  HiOutlineLogout,
  HiOutlineMail,
  HiOutlineMoon,
  HiOutlineSearch,
  HiOutlineSun,
  HiOutlineX,
} from 'react-icons/hi';
import { useLocation, useNavigate } from 'react-router-dom';

import { ACCOUNT_ROLES, getRoleLabel, normalizeRole } from '../../constants/roles';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { classOptions } from '../../data/students';
import { studentsAPI } from '../../services/api';
import Avatar from '../common/Avatar';

const LOCAL_STUDENTS_KEY = 'students_local_v2';

const projectNavItems = [
  { label: 'Dashboard', to: '/dashboard', roles: [ACCOUNT_ROLES.STUDENT, ACCOUNT_ROLES.TEACHER, ACCOUNT_ROLES.ADMIN] },
  { label: 'Attendance', to: '/attendance', roles: [ACCOUNT_ROLES.TEACHER, ACCOUNT_ROLES.ADMIN] },
  { label: 'Students', to: '/students', roles: [ACCOUNT_ROLES.ADMIN] },
  { label: 'Student Lookup', to: '/student-lookup', roles: [ACCOUNT_ROLES.ADMIN] },
  { label: 'Assignments', to: '/assignments', roles: [ACCOUNT_ROLES.STUDENT, ACCOUNT_ROLES.TEACHER] },
  { label: 'Exam Schedule', to: '/exams', roles: [ACCOUNT_ROLES.STUDENT, ACCOUNT_ROLES.TEACHER, ACCOUNT_ROLES.ADMIN] },
  { label: 'Reports', to: '/reports', roles: [ACCOUNT_ROLES.ADMIN] },
  { label: 'Calendar', to: '/calendar', roles: [ACCOUNT_ROLES.STUDENT, ACCOUNT_ROLES.TEACHER, ACCOUNT_ROLES.ADMIN] },
];

const pageEntries = [
  { id: 'dashboard', title: 'Dashboard', subtitle: 'Overview', path: '/dashboard', roles: [ACCOUNT_ROLES.STUDENT, ACCOUNT_ROLES.TEACHER, ACCOUNT_ROLES.ADMIN] },
  { id: 'attendance', title: 'Attendance', subtitle: 'Daily attendance', path: '/attendance', roles: [ACCOUNT_ROLES.TEACHER, ACCOUNT_ROLES.ADMIN] },
  { id: 'students', title: 'Students', subtitle: 'Student records', path: '/students', roles: [ACCOUNT_ROLES.ADMIN] },
  { id: 'student-lookup', title: 'Student Lookup', subtitle: 'Find by ID or email', path: '/student-lookup', roles: [ACCOUNT_ROLES.ADMIN] },
  { id: 'assignments', title: 'Assignments', subtitle: 'Homework and tasks', path: '/assignments', roles: [ACCOUNT_ROLES.STUDENT, ACCOUNT_ROLES.TEACHER] },
  { id: 'exams', title: 'Exam Schedule', subtitle: 'Published exam timetable', path: '/exams', roles: [ACCOUNT_ROLES.STUDENT, ACCOUNT_ROLES.TEACHER, ACCOUNT_ROLES.ADMIN] },
  { id: 'reports', title: 'Reports', subtitle: 'Analytics and reports', path: '/reports', roles: [ACCOUNT_ROLES.ADMIN] },
  { id: 'messages', title: 'SMS/Mail', subtitle: 'Messages and announcements', path: '/messages', roles: [ACCOUNT_ROLES.ADMIN] },
  { id: 'developer-tools', title: 'Developer Tools', subtitle: 'Internal admin center utilities', path: '/developer-tools', roles: [ACCOUNT_ROLES.ADMIN], adminCenterOnly: true },
  { id: 'profile', title: 'My Profile', subtitle: 'Account settings', path: '/profile', roles: [ACCOUNT_ROLES.STUDENT, ACCOUNT_ROLES.TEACHER, ACCOUNT_ROLES.ADMIN] },
];

const quickHighlights = [
  'Cambodia National Curriculum Workspace',
  'Administrative Coordination Portal',
  'Official School Operations Interface',
];

function readLocalStudents() {
  try {
    const raw = localStorage.getItem(LOCAL_STUDENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mergeUniqueStudents(items) {
  const map = new Map();
  items.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const key =
      (item.id != null && `id:${String(item.id)}`) ||
      (item.studentId && `studentId:${String(item.studentId)}`) ||
      (item.email && `email:${String(item.email).toLowerCase()}`) ||
      `fallback:${String(item.name || '').toLowerCase()}-${String(item.class || '')}-${index}`;
    map.set(key, item);
  });
  return Array.from(map.values());
}

function formatRole(user) {
  return getRoleLabel(user?.role || user?.designation || user?.title);
}

function MenuToggleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-700" aria-hidden="true">
      <rect x="3" y="6" width="18" height="2.2" rx="1.1" fill="currentColor" />
      <rect x="3" y="11" width="18" height="2.2" rx="1.1" fill="currentColor" />
      <rect x="3" y="16" width="18" height="2.2" rx="1.1" fill="currentColor" />
    </svg>
  );
}

export default function Header({ onMenuToggle, isMenuEnabled, onMenuVisibilityToggle }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const role = normalizeRole(user?.role);

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [focusIndex, setFocusIndex] = useState(-1);
  const [studentRecords, setStudentRecords] = useState([]);
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (role !== ACCOUNT_ROLES.ADMIN) return undefined;

    let isActive = true;

    const loadStudents = async () => {
      const localStudents = readLocalStudents();
      try {
        const response = await studentsAPI.getAll();
        const apiStudents = Array.isArray(response?.data) ? response.data : [];
        if (isActive) {
          setStudentRecords(mergeUniqueStudents([...localStudents, ...apiStudents]));
        }
      } catch {
        if (isActive) {
          setStudentRecords(mergeUniqueStudents(localStudents));
        }
      }
    };

    loadStudents();
    return () => {
      isActive = false;
    };
  }, [role]);

  const searchEntries = useMemo(() => {
    const canSearchStudentRecords = role === ACCOUNT_ROLES.ADMIN;
    const seen = new Set();

    const studentEntries = (canSearchStudentRecords ? studentRecords : [])
      .filter((student) => {
        const key = `${student.name}-${student.class}-${student.rollNo}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 900)
      .map((student, idx) => ({
        id: `student-${idx}-${student.name}`,
        title: student.name,
        subtitle: `Class ${student.class} | Roll ${student.rollNo || '-'}`,
        path: '/students',
      }));

    const classEntries = (canSearchStudentRecords ? classOptions : [])
      .filter((option) => option.value)
      .map((option) => ({
        id: `class-${option.value}`,
        title: `Class ${option.value}`,
        subtitle: 'Student list',
        path: '/students',
      }));

    const visiblePages = pageEntries.filter(
      (entry) => entry.roles.includes(role) && (!entry.adminCenterOnly || user?.isAdminCenterMember)
    );
    return [...visiblePages, ...classEntries, ...studentEntries];
  }, [role, studentRecords, user?.isAdminCenterMember]);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return searchEntries
      .filter((entry) => `${entry.title} ${entry.subtitle}`.toLowerCase().includes(term))
      .slice(0, 8);
  }, [query, searchEntries]);

  useEffect(() => {
    const onClickOutside = (event) => {
      if (!searchRef.current?.contains(event.target)) {
        setSearchOpen(false);
        setFocusIndex(-1);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  const executeSearchResult = (entry) => {
    setSearchOpen(false);
    setFocusIndex(-1);
    if (!entry) return;
    navigate(entry.path);
  };

  const onSearchKeyDown = (event) => {
    if (!results.length) {
      if (event.key === 'Enter') {
        event.preventDefault();
        navigate(role === ACCOUNT_ROLES.ADMIN ? '/students' : '/dashboard');
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setFocusIndex((prev) => (prev + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setFocusIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const target = focusIndex >= 0 ? results[focusIndex] : results[0];
      executeSearchResult(target);
    } else if (event.key === 'Escape') {
      setSearchOpen(false);
      setFocusIndex(-1);
    }
  };

  const profileName = user?.name || user?.email?.split('@')[0] || 'User';
  const profileRole = formatRole(user);
  const visibleNavItems = projectNavItems.filter((item) => item.roles.includes(role));
  const currentHighlight = quickHighlights[
    role === ACCOUNT_ROLES.ADMIN ? 1 : role === ACCOUNT_ROLES.TEACHER ? 2 : 0
  ];

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 shadow-sm">
      <div className="header-surface px-3 py-3 sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <div className="moeys-seal flex h-14 w-14 items-center justify-center rounded-full sm:h-16 sm:w-16">
              <span className="text-sm font-extrabold tracking-wide sm:text-base">MOEYS</span>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-slate-500 sm:text-[11px]">
                Kingdom of Cambodia
              </p>
              <h1 className="moeys-heading truncate text-xl font-extrabold tracking-wide text-[var(--moeys-navy)] sm:text-3xl">
                High School Administration Portal
              </h1>
              <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--moeys-gold)] sm:text-xs">
                Ministry Style Education Management Portal
              </p>
            </div>
          </div>

          <div className="header-status-panel hidden min-w-[280px] rounded-2xl px-4 py-3 lg:block">
            <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-500">
              Institutional Focus
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--moeys-navy)]">
              {currentHighlight}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Structured for official administration, student oversight, and school-wide reporting.
            </p>
          </div>
        </div>
      </div>

      <div className="moeys-banner border-b border-[rgba(255,255,255,0.12)] px-3 py-2 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <nav className="hidden flex-wrap items-center gap-1.5 text-xs font-semibold text-blue-50 xl:flex">
            {visibleNavItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => navigate(item.to)}
                className={`px-3.5 py-2 text-[13px] transition-all duration-200 ${
                  location.pathname === item.to
                    ? 'bg-white/12 text-white shadow-[inset_0_-1px_0_rgba(255,255,255,0.18)]'
                    : 'text-blue-50/88 hover:bg-white/7 hover:text-white'
                }`}
                aria-current={location.pathname === item.to ? 'page' : undefined}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center justify-between gap-3 bg-white/[0.04] px-4 py-2 lg:min-w-[370px] lg:justify-end">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/76">
              National Education Dashboard
            </div>
            <div className="hidden h-px w-10 bg-white/14 lg:block" />
            <div className="hidden text-[11px] uppercase tracking-[0.18em] text-white/66 md:block">
              {role === ACCOUNT_ROLES.ADMIN ? 'Admin Center' : profileRole}
            </div>
          </div>
        </div>
      </div>

      <div className="toolbar-surface px-3 py-3 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {!isMenuEnabled && (
              <button
                type="button"
                onClick={onMenuVisibilityToggle}
                className="shell-action rounded-xl p-2"
                aria-label="Turn on menu"
              >
                <MenuToggleIcon />
              </button>
            )}

            {isMenuEnabled && (
              <button
                type="button"
                onClick={onMenuToggle}
                className="shell-action rounded-xl p-2 lg:hidden"
                aria-label="Toggle menu"
              >
                <MenuToggleIcon />
              </button>
            )}

            <div ref={searchRef} className="relative max-w-xl flex-1">
              <button
                type="button"
                onClick={() => setSearchOpen((prev) => !prev)}
                className="p-2 transition-colors hover:bg-gray-100 md:hidden"
                aria-label="Open search"
              >
                <HiOutlineSearch className="h-5 w-5 text-gray-500" />
              </button>

              <div className={`${searchOpen ? 'flex' : 'hidden'} search-shell md:flex items-center gap-2 rounded-xl px-3 py-2`}>
                <HiOutlineSearch className="h-4 w-4 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search students, classes, pages..."
                  className="w-full border-none bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setSearchOpen(true);
                    setFocusIndex(-1);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onKeyDown={onSearchKeyDown}
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setFocusIndex(-1);
                    }}
                    className="rounded-full p-1 hover:bg-gray-200"
                    aria-label="Clear search"
                  >
                    <HiOutlineX className="h-4 w-4 text-gray-500" />
                  </button>
                ) : null}
              </div>

              {searchOpen && query.trim() && (
                <div className="search-dropdown absolute left-0 right-0 z-40 mt-2 overflow-hidden rounded-2xl">
                  {results.length ? (
                    <ul className="max-h-80 overflow-y-auto">
                      {results.map((result, index) => (
                        <li key={result.id}>
                          <button
                            type="button"
                            onClick={() => executeSearchResult(result)}
                            className={`w-full px-3 py-2.5 text-left hover:bg-gray-50 ${
                              index === focusIndex ? 'bg-primary-50' : ''
                            }`}
                          >
                            <p className="text-sm font-medium text-gray-800">{result.title}</p>
                            <p className="mt-0.5 text-xs text-gray-500">{result.subtitle}</p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="px-3 py-3 text-sm text-gray-500">No result found.</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="shell-action rounded-xl p-2"
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              title={isDark ? 'Light Theme' : 'Dark Theme'}
            >
              {isDark ? (
                <HiOutlineSun className="h-5 w-5 text-[var(--moeys-gold)]" />
              ) : (
                <HiOutlineMoon className="h-5 w-5 text-gray-500" />
              )}
            </button>

            {role === ACCOUNT_ROLES.ADMIN && (
              <button
                type="button"
                onClick={() => navigate('/messages')}
                className="shell-action relative rounded-xl p-2"
                aria-label="Open messages"
              >
                <HiOutlineMail className="h-5 w-5 text-gray-500" />
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
              </button>
            )}

            <button
              type="button"
              className="shell-action relative rounded-xl p-2"
              aria-label="Notifications"
            >
              <HiOutlineBell className="h-5 w-5 text-gray-500" />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary-500" />
            </button>

            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="shell-action hidden rounded-xl p-2 sm:block"
              aria-label="Open settings"
            >
              <HiOutlineCog className="h-5 w-5 text-gray-500" />
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl p-2 transition-colors hover:bg-red-50"
              aria-label="Logout"
              title="Logout"
            >
              <HiOutlineLogout className="h-5 w-5 text-red-600" />
            </button>

            <div className="mx-1 hidden h-8 w-px bg-gray-200 sm:block" />

            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="profile-trigger flex min-w-0 items-center gap-2 rounded-xl border border-transparent px-2 py-1.5 transition-colors sm:gap-3"
            >
              <div className="hidden text-right md:block">
                <p className="max-w-[140px] truncate text-sm font-semibold text-gray-700">{profileName}</p>
                <p className="max-w-[140px] truncate text-xs text-gray-400">{profileRole}</p>
              </div>
              <Avatar name={profileName} size="sm" src={user?.avatar} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
