import React, { useEffect, useMemo, useState } from 'react';

import { HiOutlinePlus } from 'react-icons/hi';

import {
  classOptions,
  DEFAULT_CLASS_CODE,
  DEFAULT_SHIFT,
  normalizeShift,
  studentsData,
} from '../../data/students';
import { studentsAPI } from '../../services/api';
import { generateAvatarByGender, normalizeGender } from '../../utils/avatar';
import Badge from '../common/Badge';
import Button from '../common/Button';
import DataTable from '../common/DataTable';
import Modal from '../common/Modal';

const LOCAL_STUDENTS_KEY = 'students_local_v2';
const STUDENT_ID_PREFIX = 'CMS';
const STUDENT_ID_BASE = 100000;
const FINAL_GRADE = 12;

const parseStudentIdNumber = (studentId) => {
  if (typeof studentId !== 'string') return null;
  const match = studentId.match(/^CMS(\d+)$/);
  return match ? Number(match[1]) : null;
};

const formatStudentId = (num) => `${STUDENT_ID_PREFIX}${String(num)}`;

const normalizeStudentIds = (items) => {
  const existingNumbers = items
    .map((student) => parseStudentIdNumber(student.studentId))
    .filter((n) => Number.isFinite(n));

  let nextNumber = Math.max(STUDENT_ID_BASE + 1, ...existingNumbers, 0);

  return items.map((student) => {
    const currentNumber = parseStudentIdNumber(student.studentId);
    if (currentNumber) return student;
    const withId = { ...student, studentId: formatStudentId(nextNumber) };
    nextNumber += 1;
    return withId;
  });
};

function readLocalStudents() {
  try {
    const raw = localStorage.getItem(LOCAL_STUDENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function saveLocalStudents(students) {
  try {
    localStorage.setItem(LOCAL_STUDENTS_KEY, JSON.stringify(students));
  } catch (_error) {
    // Ignore storage errors.
  }
}

function parseClassCode(classCode) {
  const value = String(classCode || '').trim().toUpperCase();
  const match = value.match(/^(\d+)([A-Z]+)$/);
  if (!match) return null;
  return { grade: Number(match[1]), suffix: match[2] };
}

function toNextClassCode(classCode) {
  const parsed = parseClassCode(classCode);
  if (!parsed) return classCode;
  return `${parsed.grade + 1}${parsed.suffix}`;
}

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPromoteOpen, setIsPromoteOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [retainStudentIds, setRetainStudentIds] = useState([]);
  const [selectedClass, setSelectedClass] = useState(DEFAULT_CLASS_CODE);
  const [formData, setFormData] = useState({
    name: '',
    class: DEFAULT_CLASS_CODE,
    shift: DEFAULT_SHIFT,
    gender: 'male',
  });

  useEffect(() => {
    const loadStudents = async () => {
      setLoading(true);
      const localStudents = readLocalStudents();
      try {
        const response = await studentsAPI.getAll();
        const apiStudents = Array.isArray(response?.data) ? response.data : [];
        const base = apiStudents.length > 0 ? apiStudents : studentsData;
        const merged = [...localStudents, ...base.filter((s) => !localStudents.some((l) => l.id === s.id))];
        const normalized = normalizeStudentIds(
          merged.map((student) => ({
            ...student,
            gender: normalizeGender(student.gender, 'male'),
            avatar: student.avatar || generateAvatarByGender(student.name || student.email, student.gender),
            shift: normalizeShift(student.shift),
          }))
        );
        saveLocalStudents(normalized);
        setStudents(normalized);
      } catch (_error) {
        const merged = [...localStudents, ...studentsData.filter((s) => !localStudents.some((l) => l.id === s.id))];
        const normalized = normalizeStudentIds(
          merged.map((student) => ({
            ...student,
            gender: normalizeGender(student.gender, 'male'),
            avatar: student.avatar || generateAvatarByGender(student.name || student.email, student.gender),
            shift: normalizeShift(student.shift),
          }))
        );
        saveLocalStudents(normalized);
        setStudents(normalized);
      } finally {
        setLoading(false);
      }
    };

    loadStudents();
  }, []);

  const stats = useMemo(() => {
    const activeStudents = students.filter((student) => student.status !== 'alumni');
    const classSet = new Set(activeStudents.map((s) => s.class));
    const shiftSet = new Set(activeStudents.map((s) => s.shift || DEFAULT_SHIFT));
    const alumni = students.length - activeStudents.length;
    return {
      total: activeStudents.length,
      classes: classSet.size,
      shifts: shiftSet.size,
      alumni,
    };
  }, [students]);

  const classFilterOptions = useMemo(() => {
    const values = classOptions.filter((opt) => opt.value).map((opt) => opt.value);
    return [...values, 'ALUMNI'];
  }, []);

  const filteredStudents = useMemo(() => {
    if (!selectedClass || selectedClass === 'ALL') {
      return students.filter((student) => student.status !== 'alumni');
    }
    if (selectedClass === 'ALUMNI') {
      return students.filter((student) => student.status === 'alumni');
    }
    return students.filter(
      (student) => student.status !== 'alumni' && student.class === selectedClass
    );
  }, [selectedClass, students]);

  const promotionCandidates = useMemo(
    () => students.filter((student) => student.status !== 'alumni'),
    [students]
  );

  const promotionPreview = useMemo(() => {
    return promotionCandidates.map((student) => {
      const parsed = parseClassCode(student.class);
      if (!parsed) {
        return { ...student, action: 'retain', targetClass: student.class, reason: 'Invalid class code' };
      }
      if (parsed.grade >= FINAL_GRADE) {
        return { ...student, action: 'graduate', targetClass: null, reason: 'Final grade completed' };
      }
      return {
        ...student,
        action: 'promote',
        targetClass: toNextClassCode(student.class),
        reason: 'Eligible for next grade',
      };
    });
  }, [promotionCandidates]);

  const promotionStats = useMemo(() => {
    let promote = 0;
    let graduate = 0;
    let retain = 0;
    promotionPreview.forEach((item) => {
      if (retainStudentIds.includes(String(item.id))) {
        retain += 1;
        return;
      }
      if (item.action === 'graduate') graduate += 1;
      else if (item.action === 'promote') promote += 1;
      else retain += 1;
    });
    return { promote, graduate, retain };
  }, [promotionPreview, retainStudentIds]);

  const toggleRetain = (studentId) => {
    const id = String(studentId);
    setRetainStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const columns = [
    {
      header: 'Student',
      accessor: 'name',
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <img
            src={row.avatar || generateAvatarByGender(value, row.gender)}
            alt={value}
            className="w-9 h-9 rounded-full object-cover border border-gray-200"
          />
          <div>
            <p className="font-medium text-gray-800">{value}</p>
            <p className="text-xs text-gray-400">ID: {row.studentId}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Class',
      accessor: 'class',
      sortable: true,
    },
    {
      header: 'Shift',
      accessor: 'shift',
      sortable: true,
      render: (value) => <Badge variant="success">{value || DEFAULT_SHIFT}</Badge>,
    },
  ];

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    const name = formData.name.trim();
    if (!name) return;

    const currentNumbers = students
      .map((s) => parseStudentIdNumber(s.studentId))
      .filter((n) => Number.isFinite(n));
    const nextStudentIdNumber = Math.max(STUDENT_ID_BASE, ...currentNumbers, 0) + 1;
    const studentId = formatStudentId(nextStudentIdNumber);

    const payload = {
      name,
      class: formData.class,
      shift: formData.shift,
      gender: normalizeGender(formData.gender, 'male'),
      avatar: generateAvatarByGender(name, formData.gender),
      studentId,
    };

    setIsSaving(true);
    try {
      const response = await studentsAPI.create(payload);
      const created = response?.data && typeof response.data === 'object'
        ? { ...payload, ...response.data, studentId: response.data.studentId || studentId }
        : { ...payload, id: `local-${Date.now()}` };
      setStudents((prev) => [created, ...prev]);
      const localStudents = [created, ...readLocalStudents().filter((s) => String(s.id) !== String(created.id))];
      saveLocalStudents(localStudents);
      setNotification({ type: 'success', message: 'Student added successfully.' });
    } catch (_error) {
      const created = { ...payload, id: `local-${Date.now()}` };
      setStudents((prev) => [created, ...prev]);
      const localStudents = [created, ...readLocalStudents().filter((s) => String(s.id) !== String(created.id))];
      saveLocalStudents(localStudents);
      setNotification({ type: 'success', message: 'Student added locally (API unavailable).' });
    } finally {
      setIsSaving(false);
      setIsCreateOpen(false);
      setFormData({
        name: '',
        class: DEFAULT_CLASS_CODE,
        shift: DEFAULT_SHIFT,
        gender: 'male',
      });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const applyYearEndPromotion = async () => {
    setIsPromoting(true);
    const retainSet = new Set(retainStudentIds.map(String));
    let promoted = 0;
    let graduated = 0;
    let retained = 0;

    const nextStudents = students.map((student) => {
      if (student.status === 'alumni') return student;
      const idKey = String(student.id);
      if (retainSet.has(idKey)) {
        retained += 1;
        return student;
      }

      const parsed = parseClassCode(student.class);
      if (!parsed) {
        retained += 1;
        return student;
      }

      if (parsed.grade >= FINAL_GRADE) {
        graduated += 1;
        return {
          ...student,
          status: 'alumni',
          graduatedAt: new Date().toISOString(),
        };
      }

      promoted += 1;
      return {
        ...student,
        class: toNextClassCode(student.class),
      };
    });

    setStudents(nextStudents);
    saveLocalStudents(nextStudents);
    setIsPromoting(false);
    setIsPromoteOpen(false);
    setRetainStudentIds([]);
    setSelectedClass('ALL');
    setNotification({
      type: 'success',
      message: `Promotion complete: ${promoted} promoted, ${graduated} graduated, ${retained} retained.`,
    });
    setTimeout(() => setNotification(null), 5000);
  };

  return (
    <div className="space-y-6">
      {notification && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            notification.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {notification.message}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Students</h1>
          <p className="text-sm text-gray-500 mt-1">View all current students and add new records.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setIsPromoteOpen(true)}>
            Year-End Promotion
          </Button>
          <Button icon={HiOutlinePlus} onClick={() => setIsCreateOpen(true)}>
            New Student
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-card text-center">
          <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
          <p className="text-xs text-gray-500 mt-1">Active Students</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-card text-center">
          <p className="text-2xl font-bold text-primary-600">{stats.classes}</p>
          <p className="text-xs text-gray-500 mt-1">Classes</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-card text-center">
          <p className="text-2xl font-bold text-green-600">{stats.shifts}</p>
          <p className="text-xs text-gray-500 mt-1">Shifts</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-card text-center">
          <p className="text-2xl font-bold text-amber-600">{stats.alumni}</p>
          <p className="text-xs text-gray-500 mt-1">Alumni</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-700">Class View</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Showing {filteredStudents.length} students
            {selectedClass === 'ALL'
              ? ' in all active classes.'
              : selectedClass === 'ALUMNI'
                ? ' in alumni list.'
                : ` in class ${selectedClass}.`}
          </p>
        </div>
        <div className="w-full sm:w-52">
          <label htmlFor="students-class-filter" className="sr-only">
            Filter by class
          </label>
          <select
            id="students-class-filter"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="ALL">All Classes</option>
            {classFilterOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredStudents}
        loading={loading}
        searchable={true}
        exportable={true}
        itemsPerPage={30}
      />

      <Modal
        isOpen={isCreateOpen}
        onClose={() => !isSaving && setIsCreateOpen(false)}
        title="Add New Student"
      >
        <form onSubmit={handleCreateStudent} className="space-y-4">
          <div>
            <label htmlFor="student-name" className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              id="student-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label htmlFor="student-class" className="block text-sm font-medium text-gray-700 mb-1">
                Class
              </label>
              <select
                id="student-class"
                value={formData.class}
                onChange={(e) => setFormData((prev) => ({ ...prev, class: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {classOptions.filter((opt) => opt.value).map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.value}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="student-gender" className="block text-sm font-medium text-gray-700 mb-1">
                Gender
              </label>
              <select
                id="student-gender"
                value={formData.gender}
                onChange={(e) => setFormData((prev) => ({ ...prev, gender: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreateOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isSaving}>
              Save Student
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isPromoteOpen}
        onClose={() => {
          if (isPromoting) return;
          setIsPromoteOpen(false);
          setRetainStudentIds([]);
        }}
        title="Year-End Promotion"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Auto-promote all active students to the next class. Grade 12 students will be graduated to alumni.
            Check students you want to retain in current class.
          </p>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-green-50 border border-green-200 p-2">
              <p className="text-lg font-bold text-green-700">{promotionStats.promote}</p>
              <p className="text-xs text-green-700">Promote</p>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-2">
              <p className="text-lg font-bold text-amber-700">{promotionStats.graduate}</p>
              <p className="text-xs text-amber-700">Graduate</p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
              <p className="text-lg font-bold text-slate-700">{promotionStats.retain}</p>
              <p className="text-xs text-slate-700">Retain</p>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
            {promotionPreview.length === 0 ? (
              <p className="text-sm text-gray-500 p-3">No active students found.</p>
            ) : (
              promotionPreview.map((student) => {
                const retainChecked = retainStudentIds.includes(String(student.id));
                const actionLabel = retainChecked
                  ? 'Retain'
                  : student.action === 'graduate'
                    ? 'Graduate'
                    : student.action === 'promote'
                      ? `Promote to ${student.targetClass}`
                      : 'Retain';
                return (
                  <div key={student.id} className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{student.name}</p>
                      <p className="text-xs text-gray-500">
                        {student.class} | {student.shift || 'Morning'} | {student.reason}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600">{actionLabel}</span>
                      <input
                        type="checkbox"
                        checked={retainChecked}
                        onChange={() => toggleRetain(student.id)}
                        aria-label={`Retain ${student.name} in current class`}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsPromoteOpen(false);
                setRetainStudentIds([]);
              }}
              disabled={isPromoting}
            >
              Cancel
            </Button>
            <Button type="button" onClick={applyYearEndPromotion} loading={isPromoting}>
              Confirm Promotion
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
