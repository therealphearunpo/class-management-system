import React, { useEffect, useMemo } from 'react';

import { format, addDays, subDays } from 'date-fns';
import {
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineCalendar,
  HiOutlineViewGrid,
  HiOutlineViewList,
} from 'react-icons/hi';

import { ACCOUNT_ROLES, normalizeRole } from '../../constants/roles';
import { useAttendanceContext } from '../../context/AttendanceContext';
import { useAuth } from '../../context/AuthContext';
import { classOptions, subjectOptions } from '../../data/students';
import {
  getDepartmentSubjectOptions,
  loadTeachers,
  teacherDepartmentOptions,
} from '../../data/teachers';
import { useFilteredStudents } from '../../hooks/useAttendance';
import Button from '../common/Button';
import Select from '../common/Select';

export default function FilterBar() {
  const { user } = useAuth();
  const isAdmin = normalizeRole(user?.role) === ACCOUNT_ROLES.ADMIN;
  const {
    currentDate,
    selectedClass,
    selectedSubject,
    attendanceScope,
    viewMode,
    isSubmitting,
    setDate,
    setFilter,
    setViewMode,
    submitAttendance,
  } = useAttendanceContext();
  const { filteredStudents } = useFilteredStudents();
  const isAdminTrackingStudents = isAdmin && attendanceScope === 'students';
  const trackingLabel = isAdminTrackingStudents ? 'Student' : (isAdmin ? 'Teacher' : 'Student');
  const classFilterOptions = isAdminTrackingStudents ? classOptions : (isAdmin ? teacherDepartmentOptions : classOptions);
  const subjectFilterOptions = useMemo(() => {
    if (!isAdminTrackingStudents && !isAdmin) return subjectOptions;
    if (isAdminTrackingStudents) return subjectOptions;
    const teacherList = loadTeachers();
    const subjects = selectedClass
      ? getDepartmentSubjectOptions(selectedClass).map((item) => item.value)
      : Array.from(new Set(teacherList.map((teacher) => teacher.subject))).sort();
    return [
      { value: '', label: 'All Subjects' },
      ...subjects.map((subject) => ({ value: subject, label: subject })),
    ];
  }, [isAdmin, isAdminTrackingStudents, selectedClass]);

  useEffect(() => {
    if (!isAdmin) return;
    const allowed = new Set(subjectFilterOptions.map((item) => item.value));
    if (selectedSubject && !allowed.has(selectedSubject)) {
      setFilter('selectedSubject', '');
    }
  }, [isAdmin, selectedSubject, setFilter, subjectFilterOptions]);

  return (
    <div className="space-y-4">
      {/* Top row: Title + Date + View toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-bold text-gray-800">
            {trackingLabel} Attendance Tracking
          </h1>
          {isAdmin && (
            <div className="inline-flex w-fit rounded-lg border border-gray-200 bg-white p-1">
              <button
                type="button"
                onClick={() => {
                  setFilter('attendanceScope', 'staff');
                  setFilter('selectedClass', '');
                  setFilter('selectedSubject', '');
                  setFilter('selectedShift', '');
                }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  attendanceScope === 'staff' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Staff
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilter('attendanceScope', 'students');
                  setFilter('selectedClass', '');
                  setFilter('selectedSubject', '');
                }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  attendanceScope === 'students' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Students
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Date navigation */}
          <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2">
            <button
              onClick={() => setDate(subDays(currentDate, 1))}
              className="p-0.5 hover:bg-gray-100 rounded transition-colors"
            >
              <HiOutlineChevronLeft className="w-4 h-4 text-gray-500" />
            </button>

            <div className="flex items-center gap-2 px-2">
              <HiOutlineCalendar className="w-4 h-4 text-primary-500" />
              <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                Today {format(currentDate, 'dd MMM yyyy')}
              </span>
            </div>

            <button
              onClick={() => setDate(addDays(currentDate, 1))}
              className="p-0.5 hover:bg-gray-100 rounded transition-colors"
            >
              <HiOutlineChevronRight className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-white rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2.5 transition-colors ${
                viewMode === 'list'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <HiOutlineViewList className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2.5 transition-colors ${
                viewMode === 'grid'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <HiOutlineViewGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom row: Filters + Take Attendance */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white rounded-xl p-4 shadow-card">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Select
            options={classFilterOptions}
            value={selectedClass}
            onChange={(val) => setFilter('selectedClass', val)}
          />
          <Select
            options={subjectFilterOptions}
            value={selectedSubject}
            onChange={(val) => setFilter('selectedSubject', val)}
          />
        </div>

        <Button
          variant="primary"
          size="lg"
          loading={isSubmitting}
          onClick={() => submitAttendance(filteredStudents.map((s) => s.id), filteredStudents)}
        >
          {isSubmitting ? 'Submitting...' : (isAdminTrackingStudents ? 'Track Student Attendance' : (isAdmin ? 'Track Teacher Attendance by Stream' : 'Take Attendance'))}
        </Button>
      </div>
    </div>
  );
}
