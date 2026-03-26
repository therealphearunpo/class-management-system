import React, { useEffect, useMemo, useState } from 'react';

import {
  HiOutlineAcademicCap,
  HiOutlineArrowRight,
  HiOutlineChartBar,
  HiOutlineClipboardCheck,
  HiOutlineClock,
  HiOutlineDocumentText,
  HiOutlineSparkles,
  HiOutlineTrendingUp,
  HiOutlineUsers,
} from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';

import { ACCOUNT_ROLES, normalizeRole } from '../../constants/roles';
import { useAuth } from '../../context/AuthContext';
import { classOptions } from '../../data/students';
import { studentsAPI } from '../../services/api';

const ATTENDANCE_STORAGE_KEY = 'attendance_records_v1';
const LOCAL_STUDENTS_KEY = 'students_local_v2';

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

function getAttendanceSummary() {
  try {
    const raw = localStorage.getItem(ATTENDANCE_STORAGE_KEY);
    const records = raw ? JSON.parse(raw) : {};
    const dates = Object.keys(records || {}).sort();
    if (dates.length === 0) return { rate: 0, marked: 0, latestDate: null };

    const latestDate = dates[dates.length - 1];
    const latest = records[latestDate] || {};
    const statuses = Object.values(latest).filter(Boolean);
    const marked = statuses.length;
    if (marked === 0) return { rate: 0, marked: 0, latestDate };
    const present = statuses.filter((status) => status === 'present').length;
    return {
      rate: Math.round((present / marked) * 1000) / 10,
      marked,
      latestDate,
    };
  } catch {
    return { rate: 0, marked: 0, latestDate: null };
  }
}

function formatDisplayDate(dateValue) {
  if (!dateValue) return 'No attendance date recorded';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'No attendance date recorded';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(date);
}

function getRoleDashboardCopy(role, userName, totalStudents) {
  if (role === ACCOUNT_ROLES.ADMIN) {
    return {
      eyebrow: 'Administrative Command Overview',
      title: `School operations overview for ${userName}`,
      summary:
        'Track enrolment, attendance activity, and reporting readiness from a single institutional dashboard.',
      insight: `${totalStudents} student records are currently available for administration and reporting.`,
    };
  }

  if (role === ACCOUNT_ROLES.TEACHER) {
    return {
      eyebrow: 'Teaching Operations Overview',
      title: `Classroom and attendance overview for ${userName}`,
      summary:
        'Monitor class activity, review attendance movement, and move quickly into teaching workflows.',
      insight: `${totalStudents} student records are currently in scope across the school environment.`,
    };
  }

  return {
    eyebrow: 'Student Learning Overview',
    title: `Welcome back, ${userName}`,
    summary:
      'Use the dashboard to stay aligned with assignments, exams, marksheets, and key school updates.',
    insight: 'Your school portal is ready with academic information and student-facing tools.',
  };
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  const isAdmin = role === ACCOUNT_ROLES.ADMIN;
  const isTeacher = role === ACCOUNT_ROLES.TEACHER;
  const [studentRecords, setStudentRecords] = useState(() => readLocalStudents());

  useEffect(() => {
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
  }, []);

  const dashboard = useMemo(() => {
    const totalStudents = studentRecords.length;
    const activeClasses = studentRecords.map((student) => student.class).filter(Boolean);
    const classCount = new Set(activeClasses).size;
    const shiftCount = new Set(studentRecords.map((student) => student.shift).filter(Boolean)).size;
    const attendance = getAttendanceSummary();
    const configuredClassCodes = classOptions.filter((option) => option.value).map((option) => option.value);
    const firstClass = configuredClassCodes[0] || '-';
    const lastClass = configuredClassCodes[configuredClassCodes.length - 1] || '-';
    const busiestClass = activeClasses.sort().reduce((acc, classCode) => {
      acc[classCode] = (acc[classCode] || 0) + 1;
      return acc;
    }, {});
    const leadClass = Object.entries(busiestClass).sort((a, b) => b[1] - a[1])[0];

    return {
      totalStudents,
      classCount,
      shiftCount,
      attendanceRate: attendance.rate,
      markedCount: attendance.marked,
      attendanceDateLabel: formatDisplayDate(attendance.latestDate),
      classRangeLabel: `${firstClass} to ${lastClass}`,
      leadClassLabel: leadClass ? `${leadClass[0]} (${leadClass[1]} students)` : 'No class data yet',
    };
  }, [studentRecords]);

  const profileName = user?.name || user?.fullName || user?.email?.split('@')[0] || 'School User';
  const heroCopy = getRoleDashboardCopy(role, profileName, dashboard.totalStudents);

  const stats = [
    {
      label: 'Student Records',
      value: dashboard.totalStudents,
      icon: HiOutlineUsers,
      tone: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200',
      hint: `${dashboard.classCount} classes in active scope`,
    },
    {
      label: 'Class Coverage',
      value: dashboard.classCount,
      icon: HiOutlineAcademicCap,
      tone: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200',
      hint: dashboard.classRangeLabel,
    },
    {
      label: 'Attendance Rate',
      value: `${dashboard.attendanceRate}%`,
      icon: HiOutlineClipboardCheck,
      tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200',
      hint: `${dashboard.markedCount} records marked on latest day`,
    },
    {
      label: 'Shift Structure',
      value: dashboard.shiftCount,
      icon: HiOutlineClock,
      tone: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
      hint: 'Institutional schedule structure',
    },
  ];

  const quickActions = isAdmin
    ? [
        { label: 'Manage Students', subtitle: 'Create and maintain school records', to: '/students' },
        { label: 'Student Lookup', subtitle: 'Search and verify student information', to: '/student-lookup' },
        { label: 'Reports Center', subtitle: 'Review analytics and export reports', to: '/reports' },
        { label: 'SMS / Mail', subtitle: 'Coordinate notices and announcements', to: '/messages' },
      ]
    : isTeacher
      ? [
          { label: 'Take Attendance', subtitle: 'Open the daily attendance workflow', to: '/attendance' },
          { label: 'Assignments', subtitle: 'Create and manage class assignments', to: '/assignments' },
          { label: 'Exam Schedule', subtitle: 'Review assessment planning', to: '/exams' },
          { label: 'Calendar', subtitle: 'Track school activities and deadlines', to: '/calendar' },
        ]
      : [
          { label: 'Assignments', subtitle: 'Review tasks and due dates', to: '/assignments' },
          { label: 'Exam Schedule', subtitle: 'Check upcoming examinations', to: '/exams' },
          { label: 'Marksheets', subtitle: 'Review your marks and results', to: '/marksheets' },
          { label: 'Profile', subtitle: 'Update personal school information', to: '/profile' },
        ];

  const operationalItems = isAdmin
    ? [
        { title: 'Attendance reference', value: dashboard.attendanceDateLabel, note: 'Latest attendance record date' },
        { title: 'Most populated class', value: dashboard.leadClassLabel, note: 'Useful for planning and monitoring' },
        { title: 'Reports readiness', value: dashboard.totalStudents > 0 ? 'Ready' : 'Waiting for records', note: 'Student data availability for exports' },
      ]
    : isTeacher
      ? [
          { title: 'School attendance update', value: dashboard.attendanceDateLabel, note: 'Latest attendance date in storage' },
          { title: 'Class structure', value: dashboard.classRangeLabel, note: 'Configured school class range' },
          { title: 'Student environment', value: `${dashboard.totalStudents} records`, note: 'Available student scope across the portal' },
        ]
      : [
          { title: 'Learning portal', value: 'Ready', note: 'Assignments, exams, and marksheets available' },
          { title: 'Calendar support', value: 'Enabled', note: 'Track school activities and due dates' },
          { title: 'Profile access', value: 'Available', note: 'Keep your information up to date' },
        ];

  const activityFeed = (isTeacher || isAdmin)
    ? [
        `${dashboard.totalStudents} student records currently active in the system.`,
        `${dashboard.classCount} classes available across the school structure.`,
        `Latest attendance summary shows ${dashboard.attendanceRate}% present across marked records.`,
        isAdmin ? 'Administrative reporting and communication modules are available from this workspace.' : 'Teaching workflows are ready for attendance, assignments, and scheduling.',
      ]
    : [
        'Assignments, exams, and marksheet sections are available from your student workspace.',
        'Calendar tools can be used to track school events and deadlines.',
        'Profile details should stay updated for communication and account access.',
        'Review academic pages regularly for school announcements and learning progress.',
      ];

  return (
    <div className="space-y-6">
      <section className="institution-card overflow-hidden rounded-[28px] px-6 py-6 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--moeys-gold)]">
              {heroCopy.eyebrow}
            </p>
            <h1 className="mt-3 text-3xl font-bold text-gray-800 dark:text-gray-100 sm:text-4xl">
              {heroCopy.title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600 dark:text-gray-300">
              {heroCopy.summary}
            </p>
          </div>

          <div className="rounded-[24px] border border-[rgba(15,47,99,0.08)] bg-[linear-gradient(135deg,rgba(15,47,99,0.05),rgba(200,155,60,0.08))] px-5 py-5 dark:border-slate-700 dark:bg-[linear-gradient(135deg,rgba(30,64,175,0.14),rgba(200,155,60,0.1))]">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-[var(--moeys-navy)]/10 p-3 text-[var(--moeys-navy)] dark:bg-white/10 dark:text-white">
                <HiOutlineSparkles className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Institutional insight</p>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">{heroCopy.insight}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <article key={stat.label} className="institution-card rounded-[24px] px-5 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.label}</p>
                <p className="mt-2 text-3xl font-bold text-gray-800 dark:text-gray-100">{stat.value}</p>
              </div>
              <div className={`rounded-2xl p-3 ${stat.tone}`}>
                <stat.icon className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <HiOutlineTrendingUp className="h-4 w-4 text-green-500" />
              <span>{stat.hint}</span>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
        <div className="institution-card rounded-[28px]">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5 dark:border-slate-800">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--moeys-gold)]">
                Activity Briefing
              </p>
              <h2 className="mt-2 text-xl font-semibold text-gray-800 dark:text-gray-100">
                Current school operations snapshot
              </h2>
            </div>
            <div className="rounded-2xl bg-slate-100 p-3 text-slate-600 dark:bg-slate-800 dark:text-slate-200">
              <HiOutlineChartBar className="h-5 w-5" />
            </div>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {activityFeed.map((item, index) => (
              <div key={item} className="flex items-start gap-4 px-6 py-5">
                <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700 dark:bg-primary-950/40 dark:text-primary-200">
                  {index + 1}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{item}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                    Institutional update
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="institution-card rounded-[28px] px-6 py-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--moeys-gold)]">
              Quick Access
            </p>
            <h2 className="mt-2 text-xl font-semibold text-gray-800 dark:text-gray-100">
              Role-based actions
            </h2>
            <div className="mt-5 space-y-3">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => navigate(action.to)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white/70 px-4 py-4 text-left transition-all hover:border-primary-200 hover:bg-primary-50/60 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:border-primary-900/40 dark:hover:bg-primary-950/20"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{action.label}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{action.subtitle}</p>
                  </div>
                  <HiOutlineArrowRight className="h-5 w-5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                </button>
              ))}
            </div>
          </div>

          <div className="institution-card rounded-[28px] px-6 py-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--moeys-gold)]">
              Operational Notes
            </p>
            <h2 className="mt-2 text-xl font-semibold text-gray-800 dark:text-gray-100">
              Dashboard reference points
            </h2>
            <div className="mt-5 space-y-4">
              {operationalItems.map((item) => (
                <div key={item.title} className="rounded-2xl bg-gray-50 px-4 py-4 dark:bg-slate-950/50">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{item.title}</p>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{item.value}</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{item.note}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-2 rounded-2xl bg-[var(--moeys-navy)]/6 px-4 py-3 text-sm text-gray-600 dark:bg-white/5 dark:text-gray-300">
              <HiOutlineDocumentText className="h-4 w-4 text-[var(--moeys-navy)] dark:text-[var(--moeys-gold)]" />
              Latest attendance records counted: {dashboard.markedCount}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
