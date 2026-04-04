import { useEffect, useMemo, useState } from 'react';

import { format } from 'date-fns';

import { ACCOUNT_ROLES, normalizeRole } from '../constants/roles';
import { useAttendanceContext } from '../context/AttendanceContext';
import { useAuth } from '../context/AuthContext';
import { loadTeachers, normalizeTeacherItem } from '../data/teachers';
import { studentsAPI, teachersAPI } from '../services/api';

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
    const idKey = item.id != null ? `id:${String(item.id)}` : '';
    const studentIdKey = item.studentId ? `studentId:${String(item.studentId)}` : '';
    const emailKey = item.email ? `email:${String(item.email).toLowerCase()}` : '';
    const fallbackKey = `fallback:${String(item.name || '').toLowerCase()}-${String(item.class || '')}-${index}`;
    map.set(idKey || studentIdKey || emailKey || fallbackKey, item);
  });
  return Array.from(map.values());
}

function mergeUniqueTeachers(items) {
  const map = new Map();
  items.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const normalized = normalizeTeacherItem(item, index);
    const employeeKey = normalized.employeeId ? `employee:${normalized.employeeId}` : '';
    const emailKey = normalized.email ? `email:${String(normalized.email).toLowerCase()}` : '';
    const idKey = normalized.id ? `id:${String(normalized.id)}` : '';
    const fallbackKey = `fallback:${String(normalized.name || '').toLowerCase()}-${index}`;
    map.set(employeeKey || emailKey || idKey || fallbackKey, normalized);
  });
  return Array.from(map.values());
}

export function useFilteredStudents() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  const isAdmin = role === ACCOUNT_ROLES.ADMIN;
  const { selectedClass, selectedShift, selectedSubject, attendanceScope } = useAttendanceContext();
  const isAdminTrackingStudents = isAdmin && attendanceScope === 'students';
  const useTeacherDataset = isAdmin && !isAdminTrackingStudents;
  const [teachers, setTeachers] = useState(() => (isAdmin ? loadTeachers() : []));
  const [students, setStudents] = useState(() => (useTeacherDataset ? [] : readLocalStudents()));

  useEffect(() => {
    if (!isAdmin) return undefined;

    let isActive = true;

    const refreshTeachers = async () => {
      const localTeachers = loadTeachers();
      try {
        const response = await teachersAPI.getAll();
        const apiTeachers = Array.isArray(response?.data) ? response.data : [];
        if (isActive) {
          setTeachers(mergeUniqueTeachers([...apiTeachers, ...localTeachers]));
        }
      } catch {
        if (isActive) {
          setTeachers(mergeUniqueTeachers(localTeachers));
        }
      }
    };

    refreshTeachers();
    window.addEventListener('teachers-updated', refreshTeachers);
    window.addEventListener('storage', refreshTeachers);
    return () => {
      isActive = false;
      window.removeEventListener('teachers-updated', refreshTeachers);
      window.removeEventListener('storage', refreshTeachers);
    };
  }, [isAdmin]);

  useEffect(() => {
    if (useTeacherDataset) return undefined;

    let isActive = true;

    const loadStudents = async () => {
      const localStudents = readLocalStudents();
      try {
        const response = await studentsAPI.getAll();
        const apiStudents = Array.isArray(response?.data) ? response.data : [];
        if (isActive) {
          setStudents(mergeUniqueStudents([...localStudents, ...apiStudents]));
        }
      } catch {
        if (isActive) {
          setStudents(mergeUniqueStudents(localStudents));
        }
      }
    };

    loadStudents();
    window.addEventListener('storage', loadStudents);
    return () => {
      isActive = false;
      window.removeEventListener('storage', loadStudents);
    };
  }, [useTeacherDataset]);

  const filteredStudents = useMemo(() => {
    let scopedStudents = useTeacherDataset ? [...teachers] : [...students];

    if (selectedClass) {
      scopedStudents = scopedStudents.filter(s => s.class === selectedClass);
    }
    if (!useTeacherDataset && selectedShift) {
      scopedStudents = scopedStudents.filter(s => s.shift === selectedShift);
    }
    if (useTeacherDataset && selectedSubject) {
      scopedStudents = scopedStudents.filter((teacher) => teacher.subject === selectedSubject);
    }

    return scopedStudents;
  }, [useTeacherDataset, selectedClass, selectedShift, selectedSubject, teachers, students]);

  const groupedStudents = useMemo(() => {
    const groups = {};
    
    filteredStudents.forEach(student => {
      const firstLetter = student.name.charAt(0).toUpperCase();
      if (!groups[firstLetter]) {
        groups[firstLetter] = [];
      }
      groups[firstLetter].push(student);
    });

    // Sort groups alphabetically
    const sortedGroups = {};
    Object.keys(groups)
      .sort()
      .forEach(key => {
        sortedGroups[key] = groups[key].sort((a, b) => 
          a.name.localeCompare(b.name)
        );
      });

    return sortedGroups;
  }, [filteredStudents]);

  return { filteredStudents, groupedStudents };
}

export function useAttendanceStats() {
  const { records, currentDate } = useAttendanceContext();
  const { filteredStudents } = useFilteredStudents();

  return useMemo(() => {
    const dateKey = format(currentDate, 'yyyy-MM-dd');
    const dayRecords = records[dateKey] || {};
    
    let present = 0;
    let absent = 0;
    let late = 0;
    let unmarked = 0;

    filteredStudents.forEach(student => {
      const status = dayRecords[student.id];
      if (status === 'present') present++;
      else if (status === 'absent') absent++;
      else if (status === 'late') late++;
      else unmarked++;
    });

    return {
      total: filteredStudents.length,
      present,
      absent,
      late,
      unmarked,
    };
  }, [records, currentDate, filteredStudents]);
}
