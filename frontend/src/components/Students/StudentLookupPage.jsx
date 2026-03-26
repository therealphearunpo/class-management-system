import React, { useEffect, useMemo, useRef, useState } from 'react';

import { HiChevronDown, HiOutlineDownload, HiOutlineMail, HiOutlineSearch } from 'react-icons/hi';

import { classOptions as studentClassOptions } from '../../data/students';
import { studentsAPI } from '../../services/api';
import { buildStudentPassword, normalizeStudentAccount } from '../../utils/studentAuth';
import Avatar from '../common/Avatar';
import Button from '../common/Button';

const LOCAL_STUDENTS_KEY = 'students_local_v2';

const readLocalStudents = () => {
  try {
    const raw = localStorage.getItem(LOCAL_STUDENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const mergeUniqueById = (items) => {
  const map = new Map();
  items.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const idKey = item.id !== undefined && item.id !== null ? `id:${item.id}` : null;
    const emailKey = item.email ? `email:${String(item.email).toLowerCase()}` : null;
    const fallbackKey = `f:${String(item.name || '').toLowerCase()}-${String(item.class || '')}-${String(index)}`;
    map.set(idKey || emailKey || fallbackKey, item);
  });
  return Array.from(map.values());
};

const compareClassCodes = (left, right) => {
  const leftValue = String(left || '').trim().toUpperCase();
  const rightValue = String(right || '').trim().toUpperCase();
  const leftMatch = leftValue.match(/^(\d+)([A-Z]*)$/);
  const rightMatch = rightValue.match(/^(\d+)([A-Z]*)$/);

  if (leftMatch && rightMatch) {
    const gradeDiff = Number(leftMatch[1]) - Number(rightMatch[1]);
    if (gradeDiff !== 0) return gradeDiff;
    return leftMatch[2].localeCompare(rightMatch[2]);
  }

  return leftValue.localeCompare(rightValue);
};

const formatDobLabel = (dateOfBirth) => {
  const parts = String(dateOfBirth || '').split('-');
  if (parts.length !== 3) return '-';
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

export default function StudentLookupPage() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [nameQuery, setNameQuery] = useState('');
  const [emailQuery, setEmailQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [classFilter, setClassFilter] = useState('ALL');
  const [classSortOrder, setClassSortOrder] = useState('asc');
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const classDropdownRef = useRef(null);

  useEffect(() => {
    const loadStudents = async () => {
      setLoading(true);
      const localStudents = readLocalStudents().map((student, index) =>
        normalizeStudentAccount(student, student.id ?? index + 1)
      );

      let mergedStudents = [];
      try {
        const response = await studentsAPI.getAll();
        const apiStudents = Array.isArray(response?.data) ? response.data : [];
        mergedStudents = mergeUniqueById([
          ...localStudents,
          ...apiStudents.map((student, index) => normalizeStudentAccount(student, student.id ?? index + 1)),
        ]);
      } catch {
        mergedStudents = mergeUniqueById(localStudents);
      }

      const normalized = mergedStudents.map((student, index) =>
        normalizeStudentAccount(student, student.id ?? index + 1)
      );
      setStudents(normalized);
      setLoading(false);
    };

    loadStudents();
  }, []);

  const searchResults = useMemo(() => {
    const nameTerm = nameQuery.trim().toLowerCase();
    const emailTerm = emailQuery.trim().toLowerCase();

    if (!nameTerm && !emailTerm) return [];

    return students.filter((student) => {
      const name = String(student.name || '').toLowerCase();
      const email = String(student.email || '').toLowerCase();
      const matchName = nameTerm ? name.includes(nameTerm) : true;
      const matchEmail = emailTerm ? email.includes(emailTerm) : true;
      return matchName && matchEmail;
    });
  }, [students, nameQuery, emailQuery]);

  const classOptions = useMemo(() => {
    const classesFromData = studentClassOptions
      .map((option) => String(option.value || '').trim())
      .filter(Boolean);
    const classesFromStudents = students
      .map((student) => String(student.class || '').trim())
      .filter(Boolean);

    return Array.from(new Set([...classesFromData, ...classesFromStudents]))
      .sort(compareClassCodes);
  }, [students]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!classDropdownRef.current?.contains(event.target)) {
        setIsClassDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allStudentsSorted = useMemo(() => {
    const filtered = classFilter === 'ALL'
      ? [...students]
      : students.filter((student) => String(student.class) === classFilter);

    const direction = classSortOrder === 'desc' ? -1 : 1;
    return filtered.sort((left, right) => {
      const classCompare = compareClassCodes(left.class, right.class) * direction;
      if (classCompare !== 0) return classCompare;
      return String(left.name || '').localeCompare(String(right.name || ''));
    });
  }, [students, classFilter, classSortOrder]);

  const downloadFile = (filename, blob, mimeType) => {
    const finalBlob = blob instanceof Blob ? blob : new Blob([blob], { type: mimeType });
    const url = window.URL.createObjectURL(finalBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const header = ['Name', 'Class', 'Shift', 'Date of Birth', 'Login Password', 'Email'];
    const rows = allStudentsSorted.map((student) => ([
      student.name,
      student.class,
      student.shift,
      student.dateOfBirth || '',
      buildStudentPassword(student),
      student.email,
    ]));
    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
    downloadFile('student-emails.csv', new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'text/csv;charset=utf-8;');
  };

  const exportExcel = () => {
    const escapeHtml = (value) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    const rows = allStudentsSorted.map((student) => `
      <tr>
        <td>${escapeHtml(student.name)}</td>
        <td>${escapeHtml(student.class)}</td>
        <td>${escapeHtml(student.shift)}</td>
        <td>${escapeHtml(student.dateOfBirth || '')}</td>
        <td>${escapeHtml(buildStudentPassword(student))}</td>
        <td>${escapeHtml(student.email)}</td>
      </tr>
    `).join('');

    const html = `
      <html>
        <head><meta charset="utf-8" /></head>
        <body>
          <table border="1">
            <thead>
              <tr>
                <th>Name</th>
                <th>Class</th>
                <th>Shift</th>
                <th>Date of Birth</th>
                <th>Login Password</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `;

    downloadFile('student-emails.xls', new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' }), 'application/vnd.ms-excel;charset=utf-8;');
  };

  const resolvedSelectedStudentId = useMemo(() => {
    if (!searchResults.length) return null;
    if (selectedStudentId && searchResults.some((student) => String(student.id) === String(selectedStudentId))) {
      return selectedStudentId;
    }
    return searchResults[0].id;
  }, [searchResults, selectedStudentId]);

  const selectedStudent = useMemo(
    () => searchResults.find((student) => String(student.id) === String(resolvedSelectedStudentId)) || null,
    [searchResults, resolvedSelectedStudentId]
  );

  const submitSearch = (e) => {
    e.preventDefault();
    setHasSearched(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Student Lookup</h1>
        <p className="text-sm text-gray-500 mt-1">
          Teacher access only. Search students by name or email to view full profile details.
        </p>
      </div>

      <form onSubmit={submitSearch} className="bg-white rounded-xl shadow-card p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="lookup-name" className="block text-sm font-medium text-gray-700 mb-1">
              Student Name
            </label>
            <input
              id="lookup-name"
              type="text"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              placeholder="Example: Sok Davin"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label htmlFor="lookup-email" className="block text-sm font-medium text-gray-700 mb-1">
              Student Email
            </label>
            <input
              id="lookup-email"
              type="email"
              value={emailQuery}
              onChange={(e) => setEmailQuery(e.target.value)}
              placeholder="Example: student@school.edu"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            Enter at least one field. You can combine name and email to narrow results.
          </p>
          <Button type="submit" icon={HiOutlineSearch}>
            Search
          </Button>
        </div>
      </form>

      {loading ? (
        <div className="bg-white rounded-xl shadow-card p-8 text-sm text-gray-500">
          Loading students...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-card p-4 lg:col-span-1">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">
              Results ({searchResults.length})
            </h2>

            {!hasSearched && (
              <p className="text-sm text-gray-500">
                Run a search by ID or email to find students.
              </p>
            )}

            {hasSearched && !searchResults.length && (
              <p className="text-sm text-red-600">
                No student found for this search.
              </p>
            )}

            <div className="space-y-2 max-h-[480px] overflow-y-auto">
              {searchResults.map((student) => (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => setSelectedStudentId(student.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    String(resolvedSelectedStudentId) === String(student.id)
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-primary-300'
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-800">{student.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {student.class} {student.email ? `- ${student.email}` : ''}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-card p-5 lg:col-span-2">
            {selectedStudent ? (
              <div className="space-y-5">
                <div className="flex items-center gap-4">
                  <Avatar src={selectedStudent.avatar} name={selectedStudent.name} size="xl" />
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">{selectedStudent.name}</h2>
                    <p className="text-sm text-gray-500">Student Profile</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-sm font-semibold text-gray-800 mt-1 break-all">{selectedStudent.email}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-xs text-gray-500">Class</p>
                    <p className="text-sm font-semibold text-gray-800 mt-1">{selectedStudent.class}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-xs text-gray-500">Shift</p>
                    <p className="text-sm font-semibold text-gray-800 mt-1">{selectedStudent.shift}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-xs text-gray-500">Date of Birth</p>
                    <p className="text-sm font-semibold text-gray-800 mt-1">{formatDobLabel(selectedStudent.dateOfBirth)}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-xs text-gray-500">Login Password</p>
                    <p className="text-sm font-semibold text-gray-800 mt-1 break-all">{buildStudentPassword(selectedStudent)}</p>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    variant="secondary"
                    icon={HiOutlineMail}
                    onClick={() => {
                      window.location.href = `mailto:${selectedStudent.email}`;
                    }}
                  >
                    Send Email
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                Select a student from the results to view profile details.
              </p>
            )}
          </div>
        </div>
      )}

      {!loading && (
        <div className="bg-white rounded-xl shadow-card p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-gray-800">All Student Emails</h2>
          <p className="text-sm text-gray-500 mt-1">
            Total: {allStudentsSorted.length} students
          </p>

          <div className="mt-4 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="w-full sm:w-[440px]">
                <label htmlFor="email-class-filter-button" className="block text-xs font-medium text-gray-600 mb-1">
                  Filter by class
                </label>
                <div className="relative w-full" ref={classDropdownRef}>
                  <button
                    id="email-class-filter-button"
                    type="button"
                    onClick={() => setIsClassDropdownOpen((prev) => !prev)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-left focus:outline-none focus:ring-2 focus:ring-primary-500 flex items-center justify-between"
                  >
                    <span>{classFilter === 'ALL' ? 'All Classes' : classFilter}</span>
                    <HiChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isClassDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isClassDropdownOpen && (
                    <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setClassFilter('ALL');
                          setIsClassDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-primary-50 ${
                          classFilter === 'ALL' ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
                        }`}
                      >
                        All Classes
                      </button>
                      {classOptions.map((classCode) => (
                        <button
                          key={classCode}
                          type="button"
                          onClick={() => {
                            setClassFilter(classCode);
                            setIsClassDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-primary-50 ${
                            classFilter === classCode ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
                          }`}
                        >
                          {classCode}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="w-full sm:w-[440px]">
                <label htmlFor="email-class-sort" className="block text-xs font-medium text-gray-600 mb-1">
                  Sort by class
                </label>
                <select
                  id="email-class-sort"
                  value={classSortOrder}
                  onChange={(e) => setClassSortOrder(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </div>
            </div>

            <div className="flex items-end gap-2">
              <Button type="button" variant="secondary" icon={HiOutlineDownload} onClick={exportCsv}>
                CSV
              </Button>
              <Button type="button" variant="secondary" icon={HiOutlineDownload} onClick={exportExcel}>
                Excel
              </Button>
            </div>
          </div>

          <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-gray-600 font-medium">Name</th>
                    <th className="text-left px-3 py-2 text-gray-600 font-medium">Class</th>
                    <th className="text-left px-3 py-2 text-gray-600 font-medium">Date of Birth</th>
                    <th className="text-left px-3 py-2 text-gray-600 font-medium">Login Password</th>
                    <th className="text-left px-3 py-2 text-gray-600 font-medium">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {allStudentsSorted.map((student) => (
                    <tr key={student.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 text-gray-800">{student.name}</td>
                      <td className="px-3 py-2 text-gray-700">{student.class}</td>
                      <td className="px-3 py-2 text-gray-700">{formatDobLabel(student.dateOfBirth)}</td>
                      <td className="px-3 py-2 text-gray-700">{buildStudentPassword(student)}</td>
                      <td className="px-3 py-2">
                        <a
                          href={`mailto:${student.email}`}
                          className="text-primary-600 hover:text-primary-700 underline break-all"
                        >
                          {student.email}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
