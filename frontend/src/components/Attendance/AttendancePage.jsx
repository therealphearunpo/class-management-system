import React, { useEffect, useMemo, useState } from 'react';

import { format } from 'date-fns';
import { HiOutlineCheckCircle } from 'react-icons/hi';

import FilterBar from './FilterBar';
import StudentCard from './StudentCard';
import StudentListItem from './StudentListItem';
import { ACCOUNT_ROLES, normalizeRole } from '../../constants/roles';
import { useAttendanceContext } from '../../context/AttendanceContext';
import { useAuth } from '../../context/AuthContext';
import {
  getDepartmentSubjectOptions,
  loadTeachers,
  saveTeachers,
  teacherDepartmentOptions,
} from '../../data/teachers';
import { useFilteredStudents, useAttendanceStats } from '../../hooks/useAttendance';
import Button from '../common/Button';
import Modal from '../common/Modal';

const EMPTY_STAFF_FORM = {
  id: '',
  employeeId: '',
  name: '',
  class: 'Science',
  subject: 'Mathematics',
};

export default function AttendancePage() {
  const { user } = useAuth();
  const isAdmin = normalizeRole(user?.role) === ACCOUNT_ROLES.ADMIN;

  const {
    attendanceScope,
    currentDate,
    selectedClass,
    selectedSubject,
    selectedShift,
    viewMode,
    markAllPresent,
    notification,
    getStudentStatus,
  } = useAttendanceContext();
  const isAdminTrackingStudents = isAdmin && attendanceScope === 'students';
  const recordLabel = isAdminTrackingStudents ? 'Student' : (isAdmin ? 'Teacher' : 'Student');

  const { filteredStudents, groupedStudents } = useFilteredStudents();
  const stats = useAttendanceStats();

  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [staffMembers, setStaffMembers] = useState(() => (isAdmin ? loadTeachers() : []));
  const [staffForm, setStaffForm] = useState(EMPTY_STAFF_FORM);

  const editableDepartmentOptions = useMemo(
    () => teacherDepartmentOptions.filter((item) => item.value),
    []
  );
  const editableSubjectOptions = useMemo(
    () => getDepartmentSubjectOptions(staffForm.class),
    [staffForm.class]
  );

  useEffect(() => {
    if (!isAdmin) return undefined;
    const sync = () => setStaffMembers(loadTeachers());
    sync();
    window.addEventListener('teachers-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('teachers-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, [isAdmin]);

  const resetStaffForm = () => {
    const defaultDepartment = editableDepartmentOptions[0]?.value || 'Science';
    const defaultSubject = getDepartmentSubjectOptions(defaultDepartment)[0]?.value || '';
    setStaffForm({
      id: '',
      employeeId: '',
      name: '',
      class: defaultDepartment,
      subject: defaultSubject,
    });
  };

  const handleEditStaff = (staff) => {
    const safeDepartment = staff.class || editableDepartmentOptions[0]?.value || 'Science';
    const safeSubjects = getDepartmentSubjectOptions(safeDepartment);
    const safeSubject = safeSubjects.some((item) => item.value === staff.subject)
      ? staff.subject
      : (safeSubjects[0]?.value || '');
    setStaffForm({
      id: staff.id,
      employeeId: staff.employeeId || '',
      name: staff.name || '',
      class: safeDepartment,
      subject: safeSubject,
    });
    setIsStaffModalOpen(true);
  };

  const handleSaveStaff = (event) => {
    event.preventDefault();
    const name = String(staffForm.name || '').trim();
    if (!name || !staffForm.class || !staffForm.subject) return;

    const nextList = [...staffMembers];
    if (staffForm.id) {
      const index = nextList.findIndex((item) => item.id === staffForm.id);
      if (index >= 0) {
        nextList[index] = {
          ...nextList[index],
          name,
          class: staffForm.class,
          subject: staffForm.subject,
          employeeId: String(staffForm.employeeId || nextList[index].employeeId || '').trim(),
        };
      }
    } else {
      nextList.push({
        id: `teacher-${Date.now()}`,
        employeeId: String(staffForm.employeeId || `T${String(nextList.length + 1).padStart(4, '0')}`),
        name,
        class: staffForm.class,
        subject: staffForm.subject,
        shift: 'Staff',
      });
    }

    const saved = saveTeachers(nextList);
    setStaffMembers(saved);
    window.dispatchEvent(new Event('teachers-updated'));
    resetStaffForm();
  };

  const handleRemoveStaff = (staffId) => {
    const target = staffMembers.find((item) => item.id === staffId);
    if (!target) return;
    if (!window.confirm(`Remove ${target.name} from staff management?`)) return;

    const saved = saveTeachers(staffMembers.filter((item) => item.id !== staffId));
    setStaffMembers(saved);
    window.dispatchEvent(new Event('teachers-updated'));

    if (staffForm.id === staffId) {
      resetStaffForm();
    }
  };

  const exportAttendanceCsv = () => {
    if (filteredStudents.length === 0) return;

    const escapeCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = filteredStudents.map((student) => [
      student.employeeId || student.rollNo || '-',
      student.name,
      student.class,
      student.shift || (isAdmin ? 'Staff' : 'Morning'),
      getStudentStatus(student.id) || 'unmarked',
    ]);

    const csvContent = [
      ['Date', format(currentDate, 'yyyy-MM-dd')],
      ['Class', selectedClass || 'All'],
      ['Shift', selectedShift || 'All'],
      ['Subject', selectedSubject || 'All'],
      [],
      [isAdmin ? 'Teacher ID' : 'Roll No', `${recordLabel} Name`, isAdmin ? 'Stream' : 'Class', 'Shift', 'Status'],
      ...rows,
    ]
      .map((line) => line.map(escapeCell).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance-${format(currentDate, 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportAttendanceExcel = () => {
    if (filteredStudents.length === 0) return;

    const escapeHtml = (value) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const rows = filteredStudents
      .map(
        (student) => `
          <tr>
            <td>${escapeHtml(student.employeeId || student.rollNo || '-')}</td>
            <td>${escapeHtml(student.name)}</td>
            <td>${escapeHtml(student.class)}</td>
            <td>${escapeHtml(student.shift || (isAdmin ? 'Staff' : 'Morning'))}</td>
            <td>${escapeHtml(getStudentStatus(student.id) || 'unmarked')}</td>
          </tr>
        `
      )
      .join('');

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="UTF-8" />
      </head>
      <body>
        <table border="1">
          <tr><th>Date</th><td>${escapeHtml(format(currentDate, 'yyyy-MM-dd'))}</td></tr>
          <tr><th>Class</th><td>${escapeHtml(selectedClass || 'All')}</td></tr>
          <tr><th>Shift</th><td>${escapeHtml(selectedShift || 'All')}</td></tr>
          <tr><th>Subject</th><td>${escapeHtml(selectedSubject || 'All')}</td></tr>
        </table>
        <br />
        <table border="1">
          <tr>
            <th>${escapeHtml(isAdmin ? 'Teacher ID' : 'Roll No')}</th>
            <th>${escapeHtml(`${recordLabel} Name`)}</th>
            <th>${escapeHtml(isAdmin ? 'Stream' : 'Class')}</th>
            <th>Shift</th>
            <th>Status</th>
          </tr>
          ${rows}
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance-${format(currentDate, 'yyyy-MM-dd')}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-5 py-3 rounded-xl shadow-lg text-sm font-medium animate-bounce ${notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}
        >
          <HiOutlineCheckCircle className="w-5 h-5" />
          {notification.message}
        </div>
      )}

      <FilterBar />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-card text-center">
          <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
          <p className="text-xs text-gray-500 mt-1">Total {recordLabel}s</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-card text-center border-b-4 border-attendance-present">
          <p className="text-2xl font-bold text-attendance-present">{stats.present}</p>
          <p className="text-xs text-gray-500 mt-1">Present</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-card text-center border-b-4 border-attendance-absent">
          <p className="text-2xl font-bold text-attendance-absent">{stats.absent}</p>
          <p className="text-xs text-gray-500 mt-1">Absent</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-card text-center border-b-4 border-attendance-late">
          <p className="text-2xl font-bold text-attendance-late">{stats.late}</p>
          <p className="text-xs text-gray-500 mt-1">Late</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-card text-center col-span-2 md:col-span-1">
          <p className="text-2xl font-bold text-gray-400">{stats.unmarked}</p>
          <p className="text-xs text-gray-500 mt-1">Unmarked</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="success"
          size="sm"
          onClick={() => markAllPresent(filteredStudents.map((s) => s.id))}
        >
          Mark All Present
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={exportAttendanceCsv}
          disabled={filteredStudents.length === 0}
        >
          Export CSV
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={exportAttendanceExcel}
          disabled={filteredStudents.length === 0}
        >
          Export Excel
        </Button>
        {isAdmin && !isAdminTrackingStudents && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              resetStaffForm();
              setIsStaffModalOpen(true);
            }}
          >
            Manage Staff
          </Button>
        )}
        <span className="text-sm text-gray-400">
          {filteredStudents.length} {recordLabel.toLowerCase()}s found.
        </span>
      </div>

      {Object.keys(groupedStudents).length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-card text-center">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-gray-700">No {recordLabel}s Found</h3>
          <p className="text-sm text-gray-400 mt-2">
            Try adjusting the filters to find {recordLabel.toLowerCase()}s.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedStudents).map(([letter, students]) => (
            <section key={letter}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-primary-100 text-primary-700 rounded-lg flex items-center justify-center font-bold text-sm">
                  {letter}
                </div>
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">
                  {students.length} {recordLabel.toLowerCase()}s
                </span>
              </div>

              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {students.map((student) => (
                    <StudentCard key={student.id} student={student} />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {students.map((student) => (
                    <StudentListItem key={student.id} student={student} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {isAdmin && !isAdminTrackingStudents && (
        <Modal
          isOpen={isStaffModalOpen}
          onClose={() => setIsStaffModalOpen(false)}
          title="Staff Management"
        >
          <form onSubmit={handleSaveStaff} className="space-y-3">
            <div>
              <label htmlFor="staff-name" className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input
                id="staff-name"
                type="text"
                value={staffForm.name}
                onChange={(e) => setStaffForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="staff-employee-id" className="block text-xs font-medium text-gray-600 mb-1">Employee ID</label>
              <input
                id="staff-employee-id"
                type="text"
                value={staffForm.employeeId}
                onChange={(e) => setStaffForm((prev) => ({ ...prev, employeeId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                placeholder="Auto generated if empty"
              />
            </div>
            <div>
              <label htmlFor="staff-department" className="block text-xs font-medium text-gray-600 mb-1">Stream</label>
              <select
                id="staff-department"
                value={staffForm.class}
                onChange={(e) => {
                  const department = e.target.value;
                  const firstSubject = getDepartmentSubjectOptions(department)[0]?.value || '';
                  setStaffForm((prev) => ({ ...prev, class: department, subject: firstSubject }));
                }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                {editableDepartmentOptions.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="staff-subject" className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
              <select
                id="staff-subject"
                value={staffForm.subject}
                onChange={(e) => setStaffForm((prev) => ({ ...prev, subject: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                {editableSubjectOptions.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={resetStaffForm}>New</Button>
              <Button type="submit">{staffForm.id ? 'Update Staff' : 'Add Staff'}</Button>
            </div>
          </form>

          <div className="mt-4 border-t border-gray-100 pt-3 max-h-56 overflow-y-auto">
            <p className="text-xs font-medium text-gray-600 mb-2">Existing Staff</p>
            <div className="space-y-1.5">
              {staffMembers.map((staff) => (
                <div
                  key={staff.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-transparent px-2 py-1.5 hover:border-gray-200 hover:bg-gray-50"
                >
                  <button
                    type="button"
                    onClick={() => handleEditStaff(staff)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-sm text-gray-800">{staff.name}</p>
                    <p className="text-xs text-gray-500">{staff.class} | {staff.subject}</p>
                  </button>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={() => handleRemoveStaff(staff.id)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
