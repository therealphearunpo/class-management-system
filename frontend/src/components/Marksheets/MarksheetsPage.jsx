import React, { useMemo, useState } from 'react';

import EditMarksheetModal from './EditMarksheetModal';
import createMarksheetColumns from './marksheetColumns';
import MarksheetFilters from './MarksheetFilters';
import MarksheetStats from './MarksheetStats';
import {
  clampScore,
  getGradeFromAverage,
  LOCAL_MARKSHEETS_KEY,
  saveJson,
  SUBJECTS,
} from './marksheetUtils';
import useMarksheetsData from './useMarksheetsData';
import { ACCOUNT_ROLES, normalizeRole } from '../../constants/roles';
import { useAuth } from '../../context/AuthContext';
import { marksheetsAPI } from '../../services/api';
import DataTable from '../common/DataTable';

export default function MarksheetsPage() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  const isStudent = role === ACCOUNT_ROLES.STUDENT;
  const canEditMarks = role === ACCOUNT_ROLES.ADMIN;
  const studentClassCode = String(user?.class || '').trim();

  const { students, marksByStudent, setMarksByStudent, loading } = useMarksheetsData();

  const [notification, setNotification] = useState(null);
  const [selectedClass, setSelectedClass] = useState(studentClassCode || 'ALL');
  const [editing, setEditing] = useState(null);
  const [formScores, setFormScores] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const filteredStudents = useMemo(() => {
    const lockedClass = isStudent && studentClassCode ? studentClassCode : null;

    return students.filter((student) => {
      return lockedClass
        ? student.class === lockedClass
        : (selectedClass === 'ALL' || student.class === selectedClass);
    });
  }, [isStudent, selectedClass, studentClassCode, students]);

  const rows = useMemo(() => {
    const baseRows = filteredStudents.map((student) => {
      const studentId = String(student.id);
      const scores = marksByStudent[studentId] || null;
      const hasScores = Boolean(scores);
      const total = hasScores
        ? SUBJECTS.reduce((sum, subject) => sum + clampScore(scores[subject]), 0)
        : null;
      const avg = hasScores
        ? Number((total / SUBJECTS.length).toFixed(1))
        : null;
      const grade = hasScores ? getGradeFromAverage(avg) : '';

      const normalizedScores = SUBJECTS.reduce((acc, subject) => {
        acc[subject] = hasScores ? clampScore(scores[subject]) : '';
        return acc;
      }, {});

      return {
        id: student.id,
        studentId,
        name: student.name,
        class: student.class,
        rollNo: student.rollNo,
        ...normalizedScores,
        hasScores,
        total,
        avg,
        grade,
      };
    });

    const ranked = [...baseRows]
      .filter((row) => row.hasScores)
      .sort((a, b) => {
      if (b.avg !== a.avg) return b.avg - a.avg;
      if (b.total !== a.total) return b.total - a.total;
      return String(a.name).localeCompare(String(b.name));
    });

    const rankByStudentId = {};
    let prevKey = null;
    let currentRank = 0;
    ranked.forEach((row, index) => {
      const key = `${row.avg}-${row.total}`;
      if (key !== prevKey) {
        currentRank = index + 1;
        prevKey = key;
      }
      rankByStudentId[row.studentId] = currentRank;
    });

    return baseRows.map((row) => ({
      ...row,
      rank: row.hasScores ? rankByStudentId[row.studentId] : '',
    }));
  }, [filteredStudents, marksByStudent]);

  const stats = useMemo(() => {
    const gradedRows = rows.filter((row) => row.hasScores);
    if (gradedRows.length === 0) return { students: 0, avg: 0, passRate: 0 };
    const avg = gradedRows.reduce((sum, row) => sum + row.avg, 0) / gradedRows.length;
    const passCount = gradedRows.filter((row) => row.avg >= 50).length;
    return {
      students: gradedRows.length,
      avg: avg.toFixed(1),
      passRate: ((passCount / gradedRows.length) * 100).toFixed(1),
    };
  }, [rows]);

  const openEditModal = (row) => {
    setEditing(row);
    setFormScores(
      SUBJECTS.reduce((acc, subject) => {
        acc[subject] = clampScore(row[subject]);
        return acc;
      }, {})
    );
  };

  const closeEditModal = () => {
    if (isSaving) return;
    setEditing(null);
    setFormScores({});
  };

  const handleSaveScores = async (event) => {
    event.preventDefault();
    if (!editing) return;

    const nextScores = SUBJECTS.reduce((acc, subject) => {
      acc[subject] = clampScore(formScores[subject]);
      return acc;
    }, {});

    const nextMap = {
      ...marksByStudent,
      [String(editing.studentId)]: nextScores,
    };

    setIsSaving(true);
    try {
      await marksheetsAPI.update(editing.studentId, {
        studentId: editing.studentId,
        studentName: editing.name,
        ...nextScores,
      });
      setNotification({ type: 'success', message: 'Marksheet updated successfully.' });
    } catch {
      setNotification({ type: 'success', message: 'Marksheet updated locally (API unavailable).' });
    } finally {
      setMarksByStudent(nextMap);
      saveJson(LOCAL_MARKSHEETS_KEY, nextMap);
      setIsSaving(false);
      closeEditModal();
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const columns = useMemo(
    () => createMarksheetColumns({ canEditMarks, subjects: SUBJECTS, openEditModal }),
    [canEditMarks]
  );

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
          <h1 className="text-2xl font-bold text-gray-800">Marksheets</h1>
          <p className="text-sm text-gray-500 mt-1">Only real saved marks are shown. Students without marks stay blank until entered.</p>
        </div>
      </div>

      <MarksheetStats stats={stats} />

      <MarksheetFilters
        selectedClass={selectedClass}
        setSelectedClass={setSelectedClass}
        isStudent={isStudent}
      />

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        searchable={true}
        exportable={true}
        itemsPerPage={30}
      />

      <EditMarksheetModal
        canEditMarks={canEditMarks}
        editing={editing}
        closeEditModal={closeEditModal}
        handleSaveScores={handleSaveScores}
        formScores={formScores}
        setFormScores={setFormScores}
        isSaving={isSaving}
      />
    </div>
  );
}
