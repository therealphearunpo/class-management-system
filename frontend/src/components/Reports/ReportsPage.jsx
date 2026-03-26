import React, { useEffect, useMemo, useState } from 'react';

import { format, getISOWeek, getQuarter, parseISO, startOfWeek } from 'date-fns';
import {
  HiOutlineChartBar,
  HiOutlineClipboardCheck,
  HiOutlineClock,
  HiOutlineDownload,
  HiOutlineDocumentReport,
  HiOutlinePresentationChartLine,
  HiOutlineUsers,
} from 'react-icons/hi';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { classOptions, subjectOptions } from '../../data/students';
import { assignmentsAPI, studentsAPI } from '../../services/api';
import Button from '../common/Button';
import Select from '../common/Select';

const ATTENDANCE_STORAGE_KEY = 'attendance_records_v1';
const LOCAL_STUDENTS_KEY = 'students_local_v2';
const LOCAL_ASSIGNMENTS_KEY = 'assignments_local_v2';
const REPORT_HISTORY_KEY = 'report_history_v1';

const COLORS = ['#1d4ed8', '#0f766e', '#c2410c', '#7c3aed', '#dc2626', '#0284c7'];

function safeReadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota or permission errors.
  }
}

function getMergedStudents() {
  const localStudents = safeReadJson(LOCAL_STUDENTS_KEY, []);
  const seen = new Set();
  return localStudents.filter((student, index) => {
    const key =
      (student?.id != null && `id:${String(student.id)}`) ||
      (student?.studentId && `studentId:${String(student.studentId)}`) ||
      (student?.email && `email:${String(student.email).toLowerCase()}`) ||
      `fallback:${String(student?.name || '').toLowerCase()}-${String(student?.class || '')}-${index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getBucketKey(date, period) {
  if (period === 'weekly') {
    return `${format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')}-W${String(getISOWeek(date)).padStart(2, '0')}`;
  }
  if (period === 'quarterly') {
    return `Q${getQuarter(date)} ${format(date, 'yyyy')}`;
  }
  if (period === 'yearly') {
    return format(date, 'yyyy');
  }
  return format(date, 'MMM yyyy');
}

function round(num) {
  return Math.round(num * 10) / 10;
}

function createCsv(rows) {
  return rows
    .map((row) =>
      row
        .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n');
}

function getReportMeta(reportType) {
  if (reportType === 'performance') {
    return {
      eyebrow: 'Academic Performance Analytics',
      title: 'Subject submission performance overview',
      description: 'Compare submission strength across subjects and identify variation in performance indicators.',
      icon: HiOutlinePresentationChartLine,
    };
  }

  if (reportType === 'demographics') {
    return {
      eyebrow: 'Student Distribution Analytics',
      title: 'Student population and shift distribution',
      description: 'Review the structure of student records by scope and scheduling arrangement.',
      icon: HiOutlineUsers,
    };
  }

  return {
    eyebrow: 'Attendance Analytics Center',
    title: 'Attendance trend and monitoring overview',
    description: 'Track attendance movement over time and review present, absent, and late percentages.',
    icon: HiOutlineClipboardCheck,
  };
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState('attendance');
  const [period, setPeriod] = useState('monthly');
  const [selectedClass, setSelectedClass] = useState('all');
  const [recentReports, setRecentReports] = useState(() => safeReadJson(REPORT_HISTORY_KEY, []).slice(0, 8));
  const [students, setStudents] = useState(() => getMergedStudents());
  const [assignments, setAssignments] = useState(() => safeReadJson(LOCAL_ASSIGNMENTS_KEY, []));
  const attendanceRecords = useMemo(() => safeReadJson(ATTENDANCE_STORAGE_KEY, {}), []);
  const validSubjects = useMemo(
    () => new Set(subjectOptions.filter((item) => item.value).map((item) => item.label)),
    []
  );

  useEffect(() => {
    let isActive = true;

    const loadStudents = async () => {
      const localStudents = safeReadJson(LOCAL_STUDENTS_KEY, []);
      try {
        const response = await studentsAPI.getAll();
        const apiStudents = Array.isArray(response?.data) ? response.data : [];
        const seen = new Set();
        const merged = [...localStudents, ...apiStudents].filter((student, index) => {
          const key =
            (student?.id != null && `id:${String(student.id)}`) ||
            (student?.studentId && `studentId:${String(student.studentId)}`) ||
            (student?.email && `email:${String(student.email).toLowerCase()}`) ||
            `fallback:${String(student?.name || '').toLowerCase()}-${String(student?.class || '')}-${index}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        if (isActive) {
          setStudents(merged);
        }
      } catch {
        if (isActive) {
          setStudents(getMergedStudents());
        }
      }
    };

    const loadAssignments = async () => {
      const localAssignments = safeReadJson(LOCAL_ASSIGNMENTS_KEY, []);
      try {
        const response = await assignmentsAPI.getAll();
        const apiAssignments = Array.isArray(response?.data) ? response.data : [];
        if (isActive) {
          setAssignments([
            ...apiAssignments,
            ...localAssignments.filter(
              (localItem) => !apiAssignments.some((apiItem) => String(apiItem.id) === String(localItem.id))
            ),
          ]);
        }
      } catch {
        if (isActive) {
          setAssignments(localAssignments);
        }
      }
    };

    loadStudents();
    loadAssignments();
    return () => {
      isActive = false;
    };
  }, []);

  const filteredStudents = useMemo(() => {
    if (selectedClass === 'all') return students;
    return students.filter((student) => student.class === selectedClass);
  }, [selectedClass, students]);

  const attendanceTrend = useMemo(() => {
    const studentKeys = new Set(
      filteredStudents.map((student) => String(student.id || student.studentId || student.email || student.name))
    );
    const buckets = {};

    Object.entries(attendanceRecords || {}).forEach(([dateKey, dayRecord]) => {
      let date;
      try {
        date = parseISO(dateKey);
      } catch {
        return;
      }
      if (Number.isNaN(date.getTime())) return;

      const bucketKey = getBucketKey(date, period);
      if (!buckets[bucketKey]) {
        buckets[bucketKey] = { present: 0, absent: 0, late: 0, marked: 0 };
      }

      Object.entries(dayRecord || {}).forEach(([studentId, status]) => {
        if (!studentKeys.has(String(studentId))) return;
        if (!status) return;
        if (status === 'present') buckets[bucketKey].present += 1;
        if (status === 'absent') buckets[bucketKey].absent += 1;
        if (status === 'late') buckets[bucketKey].late += 1;
        buckets[bucketKey].marked += 1;
      });
    });

    const sorted = Object.entries(buckets)
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .map(([bucketKey, value]) => {
        const marked = value.marked || 1;
        return {
          period: bucketKey,
          present: round((value.present / marked) * 100),
          absent: round((value.absent / marked) * 100),
          late: round((value.late / marked) * 100),
          marked: value.marked,
        };
      });

    return sorted.length > 0 ? sorted : [{ period: 'No Data', present: 0, absent: 0, late: 0, marked: 0 }];
  }, [attendanceRecords, filteredStudents, period]);

  const performanceData = useMemo(() => {
    const scoped = assignments.filter((assignment) =>
      selectedClass === 'all' ? true : (assignment.classCode || assignment.class) === selectedClass
    );

    const subjectMap = {};
    scoped.forEach((assignment) => {
      const subject = validSubjects.has(assignment.subject) ? assignment.subject : assignment.subject || 'Unknown';
      const total = Math.max(1, Number(assignment.total) || 1);
      const rate = Math.min(100, Math.max(0, (Number(assignment.submissions) / total) * 100));

      if (!subjectMap[subject]) {
        subjectMap[subject] = { subject, rates: [] };
      }
      subjectMap[subject].rates.push(rate);
    });

    const result = Object.values(subjectMap).map((entry) => {
      const rates = entry.rates;
      const sum = rates.reduce((acc, value) => acc + value, 0);
      return {
        subject: entry.subject,
        average: round(sum / rates.length),
        highest: round(Math.max(...rates)),
        lowest: round(Math.min(...rates)),
      };
    });

    return result.length > 0 ? result : [{ subject: 'No Data', average: 0, highest: 0, lowest: 0 }];
  }, [assignments, selectedClass, validSubjects]);

  const demographicsData = useMemo(() => {
    const shiftCount = filteredStudents.reduce((acc, student) => {
      const key = student.shift || 'Unassigned';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const result = Object.entries(shiftCount).map(([name, value]) => ({ name, value }));
    return result.length > 0 ? result : [{ name: 'No Data', value: 1 }];
  }, [filteredStudents]);

  const summaryStats = useMemo(() => {
    const attendanceMarked = attendanceTrend.reduce((sum, row) => sum + (row.marked || 0), 0);
    const avgPresent =
      attendanceTrend.length > 0
        ? round(attendanceTrend.reduce((sum, row) => sum + row.present, 0) / attendanceTrend.length)
        : 0;
    const avgAbsent =
      attendanceTrend.length > 0
        ? round(attendanceTrend.reduce((sum, row) => sum + row.absent, 0) / attendanceTrend.length)
        : 0;
    const avgPerformance =
      performanceData.length > 0
        ? round(performanceData.reduce((sum, row) => sum + row.average, 0) / performanceData.length)
        : 0;

    return {
      students: filteredStudents.length,
      attendanceMarked,
      avgPresent,
      avgAbsent,
      avgPerformance,
      subjects: performanceData.filter((row) => row.subject !== 'No Data').length,
    };
  }, [attendanceTrend, filteredStudents.length, performanceData]);

  const reportMeta = getReportMeta(reportType);
  const ReportIcon = reportMeta.icon;

  const statCards = [
    {
      label: 'Students in Scope',
      value: summaryStats.students,
      hint: selectedClass === 'all' ? 'All classes included' : `Filtered to ${selectedClass}`,
      tone: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200',
      icon: HiOutlineUsers,
    },
    {
      label: 'Attendance Marked',
      value: summaryStats.attendanceMarked,
      hint: `${summaryStats.avgPresent}% average present`,
      tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200',
      icon: HiOutlineClipboardCheck,
    },
    {
      label: 'Performance Average',
      value: `${summaryStats.avgPerformance}%`,
      hint: `${summaryStats.subjects} subjects analysed`,
      tone: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200',
      icon: HiOutlineChartBar,
    },
    {
      label: 'Current Period',
      value: period.charAt(0).toUpperCase() + period.slice(1),
      hint: 'Reporting interval currently selected',
      tone: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
      icon: HiOutlineClock,
    },
  ];

  const exportReport = () => {
    const classLabel = selectedClass === 'all' ? 'All Classes' : selectedClass;
    const stamp = format(new Date(), 'yyyy-MM-dd_HH-mm');
    let rows = [];
    let filename = '';

    if (reportType === 'attendance') {
      rows = [
        ['Report', 'Attendance Trends'],
        ['Class', classLabel],
        ['Period', period],
        [],
        ['Bucket', 'Present %', 'Absent %', 'Late %', 'Marked Records'],
        ...attendanceTrend.map((row) => [row.period, row.present, row.absent, row.late, row.marked]),
      ];
      filename = `attendance-report-${stamp}.csv`;
    } else if (reportType === 'performance') {
      rows = [
        ['Report', 'Performance Analytics'],
        ['Class', classLabel],
        [],
        ['Subject', 'Average %', 'Highest %', 'Lowest %'],
        ...performanceData.map((row) => [row.subject, row.average, row.highest, row.lowest]),
      ];
      filename = `performance-report-${stamp}.csv`;
    } else {
      rows = [
        ['Report', 'Student Demographics by Shift'],
        ['Class', classLabel],
        [],
        ['Shift', 'Students'],
        ...demographicsData.map((row) => [row.name, row.value]),
      ];
      filename = `demographics-report-${stamp}.csv`;
    }

    const csv = createCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    const history = safeReadJson(REPORT_HISTORY_KEY, []);
    const nextHistory = [
      {
        id: Date.now(),
        type: reportType,
        period,
        classLabel,
        createdAt: new Date().toISOString(),
      },
      ...history,
    ].slice(0, 20);
    saveJson(REPORT_HISTORY_KEY, nextHistory);
    setRecentReports(nextHistory.slice(0, 8));
  };

  const classesWithAll = useMemo(
    () => [{ value: 'all', label: 'All Classes' }, ...classOptions.filter((option) => option.value)],
    []
  );

  return (
    <div className="space-y-6">
      <section className="institution-card overflow-hidden rounded-[28px] px-6 py-6 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--moeys-gold)]">
              {reportMeta.eyebrow}
            </p>
            <h1 className="mt-3 text-3xl font-bold text-gray-800 dark:text-gray-100 sm:text-4xl">
              {reportMeta.title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600 dark:text-gray-300">
              {reportMeta.description}
            </p>
          </div>

          <div className="rounded-[24px] border border-[rgba(15,47,99,0.08)] bg-[linear-gradient(135deg,rgba(15,47,99,0.05),rgba(200,155,60,0.08))] px-5 py-5 dark:border-slate-700 dark:bg-[linear-gradient(135deg,rgba(30,64,175,0.14),rgba(200,155,60,0.1))]">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-[var(--moeys-navy)]/10 p-3 text-[var(--moeys-navy)] dark:bg-white/10 dark:text-white">
                <ReportIcon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Export-ready analytics</p>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                  The reporting center stays tied to current class scope, stored attendance, and assignment activity.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => (
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
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">{stat.hint}</p>
          </article>
        ))}
      </section>

      <section className="institution-card rounded-[28px] px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--moeys-gold)]">
              Report Controls
            </p>
            <h2 className="mt-2 text-xl font-semibold text-gray-800 dark:text-gray-100">
              Filter and export institutional reports
            </h2>
          </div>
          <Button icon={HiOutlineDownload} variant="secondary" onClick={exportReport}>
            Export Report
          </Button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Select
            options={[
              { value: 'attendance', label: 'Attendance Report' },
              { value: 'performance', label: 'Performance Report' },
              { value: 'demographics', label: 'Demographics Report' },
            ]}
            value={reportType}
            onChange={setReportType}
            className="min-w-[200px]"
          />
          <Select
            options={[
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' },
              { value: 'quarterly', label: 'Quarterly' },
              { value: 'yearly', label: 'Yearly' },
            ]}
            value={period}
            onChange={setPeriod}
            className="min-w-[160px]"
          />
          <Select
            options={classesWithAll}
            value={selectedClass}
            onChange={setSelectedClass}
            className="min-w-[160px]"
          />
          <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:bg-slate-950/50 dark:text-gray-300">
            {selectedClass === 'all'
              ? 'Viewing report output across all configured classes.'
              : `Viewing report output for ${selectedClass}.`}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_360px]">
        <div className="institution-card rounded-[28px] px-5 py-5 sm:px-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--moeys-gold)]">
                Visual Analysis
              </p>
              <h2 className="mt-2 text-xl font-semibold text-gray-800 dark:text-gray-100">
                {reportType === 'attendance'
                  ? 'Attendance trend by period'
                  : reportType === 'performance'
                    ? 'Subject submission performance'
                    : 'Student shift distribution'}
              </h2>
            </div>
            <div className="rounded-2xl bg-slate-100 p-3 text-slate-600 dark:bg-slate-800 dark:text-slate-200">
              <HiOutlineDocumentReport className="h-5 w-5" />
            </div>
          </div>

          <div className="h-[380px]">
            <ResponsiveContainer width="100%" height="100%">
              {reportType === 'attendance' ? (
                <LineChart data={attendanceTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="period" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="present" stroke="#16a34a" strokeWidth={2.5} />
                  <Line type="monotone" dataKey="absent" stroke="#dc2626" strokeWidth={2.5} />
                  <Line type="monotone" dataKey="late" stroke="#ea580c" strokeWidth={2.5} />
                </LineChart>
              ) : reportType === 'performance' ? (
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="subject" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="average" fill="#1d4ed8" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="highest" fill="#16a34a" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="lowest" fill="#ea580c" radius={[6, 6, 0, 0]} />
                </BarChart>
              ) : (
                <PieChart>
                  <Pie
                    data={demographicsData}
                    cx="50%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={112}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {demographicsData.map((entry, index) => (
                      <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          <div className="institution-card rounded-[28px] px-6 py-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--moeys-gold)]">
              Key Statistics
            </p>
            <h2 className="mt-2 text-xl font-semibold text-gray-800 dark:text-gray-100">
              Summary indicators
            </h2>
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-gray-50 px-4 py-4 dark:bg-slate-950/50">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Students in Scope</span>
                  <span className="text-lg font-bold text-gray-800 dark:text-gray-100">{summaryStats.students}</span>
                </div>
              </div>
              <div className="rounded-2xl bg-gray-50 px-4 py-4 dark:bg-slate-950/50">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Average Present</span>
                  <span className="text-lg font-bold text-green-600">{summaryStats.avgPresent}%</span>
                </div>
              </div>
              <div className="rounded-2xl bg-gray-50 px-4 py-4 dark:bg-slate-950/50">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Average Absent</span>
                  <span className="text-lg font-bold text-red-600">{summaryStats.avgAbsent}%</span>
                </div>
              </div>
              <div className="rounded-2xl bg-gray-50 px-4 py-4 dark:bg-slate-950/50">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Performance Average</span>
                  <span className="text-lg font-bold text-blue-600">{summaryStats.avgPerformance}%</span>
                </div>
              </div>
              <div className="rounded-2xl bg-gray-50 px-4 py-4 dark:bg-slate-950/50">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Subjects Reported</span>
                  <span className="text-lg font-bold text-gray-800 dark:text-gray-100">{summaryStats.subjects}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="institution-card rounded-[28px] px-6 py-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--moeys-gold)]">
              Recent Exports
            </p>
            <h2 className="mt-2 text-xl font-semibold text-gray-800 dark:text-gray-100">
              Report history
            </h2>
            <div className="mt-5 space-y-3">
              {recentReports.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500 dark:border-slate-700 dark:text-gray-400">
                  No report exports yet. Generate an export to create history.
                </div>
              ) : (
                recentReports.map((item) => (
                  <div key={item.id} className="rounded-2xl bg-gray-50 px-4 py-4 dark:bg-slate-950/50">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                      {item.type.charAt(0).toUpperCase() + item.type.slice(1)} | {item.classLabel}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                      {item.period} | {format(new Date(item.createdAt), 'dd MMM yyyy HH:mm')}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
