import React, { useEffect, useMemo, useState } from 'react';

import { format } from 'date-fns';
import {
  HiOutlineDocumentText,
  HiOutlinePencil,
  HiOutlinePlus,
  HiOutlineSearch,
  HiOutlineCheckCircle,
  HiOutlineTrash,
} from 'react-icons/hi';

import { ACCOUNT_ROLES, normalizeRole } from '../../constants/roles';
import { useAuth } from '../../context/AuthContext';
import {
  classOptions,
  DEFAULT_CLASS_CODE,
  DEFAULT_SHIFT,
  DEFAULT_SUBJECT_LABEL,
  normalizeShift,
  subjectOptions,
} from '../../data/students';
import { assignmentsAPI, studentsAPI } from '../../services/api';
import Badge from '../common/Badge';
import Button from '../common/Button';
import Modal from '../common/Modal';

const LOCAL_ASSIGNMENTS_KEY = 'assignments_local_v2';
const LOCAL_STUDENTS_KEY = 'students_local_v2';
const LOCAL_ASSIGNMENT_SUBMISSIONS_KEY = 'assignment_submissions_local_v1';
const LOCAL_ASSIGNMENT_ANNOUNCEMENTS_KEY = 'assignment_announcements_local_v1';
const LOCAL_ASSIGNMENT_SEEN_KEY = 'assignment_seen_by_student_v1';
const LOCAL_ASSIGNMENT_SUBMISSION_SEEN_BY_TEACHER_KEY = 'assignment_submission_seen_by_teacher_v1';

const readLocalData = (key) => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const readLocalObject = (key) => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Unable to read file.'));
    reader.readAsDataURL(file);
  });

const getAssignmentIdFromSubmission = (submissionKey, submissionValue) => {
  if (submissionValue?.assignmentId != null) return String(submissionValue.assignmentId);
  const key = String(submissionKey || '');
  const idx = key.lastIndexOf(':');
  return idx >= 0 ? key.slice(idx + 1) : '';
};

const getStudentKeyFromSubmission = (submissionKey, submissionValue) => {
  if (submissionValue?.student) return String(submissionValue.student);
  const key = String(submissionKey || '');
  const idx = key.lastIndexOf(':');
  return idx >= 0 ? key.slice(0, idx) : key;
};

const getSubmissionFileUrl = (submission) =>
  String(
    submission?.fileDataUrl ||
      submission?.fileUrl ||
      submission?.url ||
      submission?.attachmentUrl ||
      ''
  ).trim();

const isDataUrl = (value) => /^data:/i.test(String(value || ''));

const saveLocalAssignments = (items) => {
  try {
    localStorage.setItem(LOCAL_ASSIGNMENTS_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage errors for offline mode.
  }
};

const normalizeStudent = (student) => ({
  ...student,
  shift: normalizeShift(student.shift),
});

const mergeUniqueById = (items) => {
  const map = new Map();
  items.forEach((item) => map.set(String(item.id), item));
  return Array.from(map.values());
};

const normalizeAssignment = (assignment) => {
  const total = Math.max(1, Number(assignment.total) || 1);
  const rawStatus = String(assignment.status || 'active').toLowerCase();
  const status = rawStatus === 'draft' ? 'draft' : 'active';
  const submissions = status === 'draft' ? 0 : Math.min(total, Math.max(0, Number(assignment.submissions) || 0));

  return {
    id: assignment.id ?? `local-${Date.now()}`,
    title: assignment.title || 'Untitled Assignment',
    subject: assignment.subject || DEFAULT_SUBJECT_LABEL,
    dueDate: assignment.dueDate || '',
    status,
    submissions,
    total,
    classCode: assignment.classCode || assignment.class || DEFAULT_CLASS_CODE,
    shift: normalizeShift(assignment.shift),
    description: assignment.description || '',
  };
};

const getDerivedStatus = (assignment) => {
  if (assignment.status === 'draft') return 'draft';
  if (assignment.submissions >= assignment.total) return 'completed';
  if (assignment.dueDate) {
    const due = new Date(assignment.dueDate);
    const today = new Date();
    due.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    if (!Number.isNaN(due.getTime()) && due < today) return 'overdue';
  }
  return 'active';
};

export default function AssignmentsPage() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  const canManageAssignments = role === ACCOUNT_ROLES.TEACHER || role === ACCOUNT_ROLES.ADMIN;
  const currentStudentKey = String(user?.email || user?.id || user?.name || 'student');
  const studentClass = String(user?.class || '').trim();

  const [assignments, setAssignments] = useState([]);
  const [students, setStudents] = useState([]);
  const [studentSubmissions, setStudentSubmissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [classFilter, setClassFilter] = useState(studentClass || 'all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [isSubmissionListModalOpen, setIsSubmissionListModalOpen] = useState(false);
  const [selectedTeacherAssignment, setSelectedTeacherAssignment] = useState(null);
  const [submitFile, setSubmitFile] = useState(null);
  const [submitPreviewUrl, setSubmitPreviewUrl] = useState('');
  const [submitNote, setSubmitNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    subject: DEFAULT_SUBJECT_LABEL,
    dueDate: '',
    submissions: 0,
    status: 'active',
    classCode: DEFAULT_CLASS_CODE,
    shift: DEFAULT_SHIFT,
    description: '',
  });

  const loadAssignmentsFromLocal = () => readLocalData(LOCAL_ASSIGNMENTS_KEY).map(normalizeAssignment);

  const getStudentCountForGroup = (classCode) => {
    const count = students.filter(
      (student) => student.class === classCode
    ).length;
    return count || 0;
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const submissionMap = readLocalObject(LOCAL_ASSIGNMENT_SUBMISSIONS_KEY);
      setStudentSubmissions(submissionMap);

      const localStudents = readLocalData(LOCAL_STUDENTS_KEY).map(normalizeStudent);
      let mergedStudents;
      try {
        const response = await studentsAPI.getAll();
        const apiStudents = Array.isArray(response?.data) ? response.data : [];
        mergedStudents = mergeUniqueById([...localStudents, ...apiStudents]);
      } catch {
        mergedStudents = mergeUniqueById(localStudents);
      }
      setStudents(mergedStudents.map(normalizeStudent));

      const localAssignments = loadAssignmentsFromLocal();
      try {
        const response = await assignmentsAPI.getAll();
        const apiAssignments = (Array.isArray(response?.data) ? response.data : []).map(normalizeAssignment);
        const merged = mergeUniqueById([...apiAssignments, ...localAssignments]);
        setAssignments(merged);
      } catch {
        setAssignments(localAssignments);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    if (canManageAssignments) return;

    const seenByStudent = readLocalObject(LOCAL_ASSIGNMENT_SEEN_KEY);
    const seenForCurrent = Array.isArray(seenByStudent[currentStudentKey]) ? seenByStudent[currentStudentKey] : [];
    const announcements = readLocalData(LOCAL_ASSIGNMENT_ANNOUNCEMENTS_KEY);
    const unseen = announcements.filter((item) => !seenForCurrent.includes(String(item.id)));

    if (unseen.length > 0) {
      const latest = unseen[0];
      setNotification({
        type: 'success',
        message: unseen.length === 1
          ? `New assignment: ${latest.title}`
          : `${unseen.length} new assignments have been posted.`,
      });
      setTimeout(() => setNotification(null), 3500);

      const nextSeen = {
        ...seenByStudent,
        [currentStudentKey]: [...new Set([...seenForCurrent, ...unseen.map((item) => String(item.id))])],
      };
      try {
        localStorage.setItem(LOCAL_ASSIGNMENT_SEEN_KEY, JSON.stringify(nextSeen));
      } catch {
        // Ignore storage errors.
      }
    }

    const onStorage = (event) => {
      if (event.key === LOCAL_ASSIGNMENTS_KEY) {
        setAssignments(loadAssignmentsFromLocal());
      }

      if (event.key === LOCAL_ASSIGNMENT_ANNOUNCEMENTS_KEY) {
        const latestAnnouncements = readLocalData(LOCAL_ASSIGNMENT_ANNOUNCEMENTS_KEY);
        const latestSeen = readLocalObject(LOCAL_ASSIGNMENT_SEEN_KEY);
        const currentSeen = Array.isArray(latestSeen[currentStudentKey]) ? latestSeen[currentStudentKey] : [];
        const latestUnseen = latestAnnouncements.filter((item) => !currentSeen.includes(String(item.id)));
        if (latestUnseen.length > 0) {
          setNotification({ type: 'success', message: `New assignment: ${latestUnseen[0].title}` });
          setTimeout(() => setNotification(null), 3500);
          const updatedSeen = {
            ...latestSeen,
            [currentStudentKey]: [...new Set([...currentSeen, ...latestUnseen.map((item) => String(item.id))])],
          };
          try {
            localStorage.setItem(LOCAL_ASSIGNMENT_SEEN_KEY, JSON.stringify(updatedSeen));
          } catch {
            // Ignore storage errors.
          }
        }
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [currentStudentKey, canManageAssignments]);

  const submissionsByAssignment = useMemo(() => {
    const byAssignment = {};
    const studentByEmail = new Map(
      students
        .filter((item) => item?.email)
        .map((item) => [String(item.email).toLowerCase(), item])
    );

    Object.entries(studentSubmissions).forEach(([submissionKey, value]) => {
      if (!value || typeof value !== 'object') return;
      const assignmentId = getAssignmentIdFromSubmission(submissionKey, value);
      if (!assignmentId) return;
      const studentKey = getStudentKeyFromSubmission(submissionKey, value);
      const fallbackStudent = studentByEmail.get(String(studentKey).toLowerCase());
      const submittedAt = value.submittedAt || '';
      const submissionId = value.id || `${submissionKey}:${submittedAt || 'unknown'}`;

      const entry = {
        ...value,
        id: submissionId,
        assignmentId,
        student: studentKey,
        studentName: value.studentName || fallbackStudent?.name || studentKey,
      };

      if (!byAssignment[assignmentId]) byAssignment[assignmentId] = [];
      byAssignment[assignmentId].push(entry);
    });

    Object.keys(byAssignment).forEach((assignmentId) => {
      byAssignment[assignmentId] = byAssignment[assignmentId].sort((a, b) =>
        String(b.submittedAt || '').localeCompare(String(a.submittedAt || ''))
      );
    });

    return byAssignment;
  }, [studentSubmissions, students]);

  useEffect(() => {
    if (!canManageAssignments) return;

    const teacherKey = String(user?.email || user?.id || user?.name || 'teacher');
    const seenByTeacher = readLocalObject(LOCAL_ASSIGNMENT_SUBMISSION_SEEN_BY_TEACHER_KEY);
    const seenForCurrent = Array.isArray(seenByTeacher[teacherKey]) ? seenByTeacher[teacherKey] : [];
    const allSubmissionIds = Object.values(submissionsByAssignment)
      .flat()
      .map((item) => String(item.id));
    const unseenSubmissionIds = allSubmissionIds.filter((id) => !seenForCurrent.includes(id));

    if (unseenSubmissionIds.length > 0) {
      setNotification({
        type: 'success',
        message:
          unseenSubmissionIds.length === 1
            ? '1 new assignment submission received.'
            : `${unseenSubmissionIds.length} new assignment submissions received.`,
      });
      setTimeout(() => setNotification(null), 4000);

      const nextSeen = {
        ...seenByTeacher,
        [teacherKey]: [...new Set([...seenForCurrent, ...unseenSubmissionIds])],
      };
      try {
        localStorage.setItem(LOCAL_ASSIGNMENT_SUBMISSION_SEEN_BY_TEACHER_KEY, JSON.stringify(nextSeen));
      } catch {
        // Ignore storage errors.
      }
    }

    const onStorage = (event) => {
      if (event.key !== LOCAL_ASSIGNMENT_SUBMISSIONS_KEY) return;
      const latest = readLocalObject(LOCAL_ASSIGNMENT_SUBMISSIONS_KEY);
      setStudentSubmissions(latest);
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [canManageAssignments, submissionsByAssignment, user]);

  const persistSubmissions = (nextSubmissions) => {
    setStudentSubmissions(nextSubmissions);
    try {
      localStorage.setItem(LOCAL_ASSIGNMENT_SUBMISSIONS_KEY, JSON.stringify(nextSubmissions));
    } catch {
      // Ignore storage errors for offline mode.
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      subject: DEFAULT_SUBJECT_LABEL,
      dueDate: '',
      submissions: 0,
      status: 'active',
      classCode: DEFAULT_CLASS_CODE,
      shift: DEFAULT_SHIFT,
      description: '',
    });
  };

  const openCreateModal = () => {
    setEditingAssignmentId(null);
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (assignment) => {
    setEditingAssignmentId(assignment.id);
    setFormData({
      title: assignment.title,
      subject: assignment.subject,
      dueDate: assignment.dueDate,
      submissions: assignment.submissions,
      status: assignment.status,
      classCode: assignment.classCode,
      shift: assignment.shift,
      description: assignment.description || '',
    });
    setIsModalOpen(true);
  };

  const filteredAssignments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assignments
      .filter((assignment) => {
        if (!canManageAssignments) {
          const classMatch = !studentClass || assignment.classCode === studentClass;
          if (!classMatch) return false;
          if (assignment.status === 'draft') return false;
        }

        const derivedStatus = getDerivedStatus(assignment);
        const matchesSearch =
          q.length === 0 ||
          assignment.title.toLowerCase().includes(q) ||
          assignment.subject.toLowerCase().includes(q) ||
          assignment.classCode.toLowerCase().includes(q);
        const matchesStatus = statusFilter === 'all' || derivedStatus === statusFilter;
        const matchesClass = classFilter === 'all' || assignment.classCode === classFilter;
        return matchesSearch && matchesStatus && matchesClass;
      })
      .sort((a, b) => {
        const da = a.dueDate || '9999-12-31';
        const db = b.dueDate || '9999-12-31';
        if (da !== db) return da.localeCompare(db);
        return String(a.title).localeCompare(String(b.title));
      });
  }, [assignments, classFilter, canManageAssignments, search, statusFilter, studentClass]);

  const stats = useMemo(() => {
    const base = assignments.filter((assignment) => {
      if (!canManageAssignments) {
        const classMatch = !studentClass || assignment.classCode === studentClass;
        if (!classMatch) return false;
        if (assignment.status === 'draft') return false;
      }
      const matchesClass = classFilter === 'all' || assignment.classCode === classFilter;
      return matchesClass;
    });
    const active = base.filter((item) => getDerivedStatus(item) === 'active').length;
    const overdue = base.filter((item) => getDerivedStatus(item) === 'overdue').length;
    const completed = base.filter((item) => getDerivedStatus(item) === 'completed').length;
    const draft = base.filter((item) => getDerivedStatus(item) === 'draft').length;
    return { total: base.length, active, overdue, completed, draft };
  }, [assignments, classFilter, canManageAssignments, studentClass]);

  const persistAssignments = (nextAssignments) => {
    setAssignments(nextAssignments);
    saveLocalAssignments(nextAssignments);
  };

  const pushAssignmentAnnouncement = (assignment) => {
    const current = readLocalData(LOCAL_ASSIGNMENT_ANNOUNCEMENTS_KEY);
    const next = [
      {
        id: assignment.id,
        title: assignment.title,
        classCode: assignment.classCode,
        shift: assignment.shift,
        createdAt: new Date().toISOString(),
      },
      ...current.filter((item) => String(item.id) !== String(assignment.id)),
    ].slice(0, 200);

    try {
      localStorage.setItem(LOCAL_ASSIGNMENT_ANNOUNCEMENTS_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors.
    }
  };

  const handleCreateOrUpdate = async (event) => {
    event.preventDefault();
    if (!formData.title.trim() || !formData.dueDate) return;

    const total = getStudentCountForGroup(formData.classCode);
    if (total <= 0) {
      setNotification({
        type: 'error',
        message: 'No students found for the selected class and shift.',
      });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    setIsSaving(true);

    const isDraft = formData.status === 'draft';
    const submissions = isDraft ? 0 : Math.min(total, Math.max(0, Number(formData.submissions) || 0));
    const payload = normalizeAssignment({
      id: editingAssignmentId || `local-${Date.now()}`,
      title: formData.title.trim(),
      subject: formData.subject,
      dueDate: formData.dueDate,
      status: isDraft ? 'draft' : 'active',
      submissions,
      total,
      classCode: formData.classCode,
      shift: formData.shift,
      description: formData.description.trim(),
    });

    try {
      if (editingAssignmentId) {
        const response = await assignmentsAPI.update(editingAssignmentId, payload);
        const updated = normalizeAssignment(response?.data && typeof response.data === 'object' ? response.data : payload);
        persistAssignments(assignments.map((item) => (String(item.id) === String(editingAssignmentId) ? updated : item)));
        setNotification({ type: 'success', message: 'Assignment updated successfully.' });
      } else {
        const response = await assignmentsAPI.create(payload);
        const created = normalizeAssignment(response?.data && typeof response.data === 'object' ? response.data : payload);
        persistAssignments([created, ...assignments]);
        pushAssignmentAnnouncement(created);
        setNotification({ type: 'success', message: 'Assignment created successfully.' });
      }
    } catch {
      if (editingAssignmentId) {
        persistAssignments(assignments.map((item) => (String(item.id) === String(editingAssignmentId) ? payload : item)));
        setNotification({ type: 'success', message: 'Assignment updated locally (API unavailable).' });
      } else {
        persistAssignments([payload, ...assignments]);
        pushAssignmentAnnouncement(payload);
        setNotification({ type: 'success', message: 'Assignment created locally (API unavailable).' });
      }
    } finally {
      setIsSaving(false);
      setIsModalOpen(false);
      setEditingAssignmentId(null);
      resetForm();
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleDelete = async (assignmentId) => {
    if (!window.confirm('Delete this assignment?')) return;
    const nextAssignments = assignments.filter((item) => String(item.id) !== String(assignmentId));

    try {
      await assignmentsAPI.delete(assignmentId);
    } catch {
      // Keep local deletion if API unavailable.
    }

    persistAssignments(nextAssignments);
    setNotification({ type: 'success', message: 'Assignment deleted.' });
    setTimeout(() => setNotification(null), 3000);
  };

  const handlePublish = async (assignment) => {
    if (assignment.status !== 'draft') return;

    const published = {
      ...assignment,
      status: 'active',
      submissions: 0,
    };

    try {
      await assignmentsAPI.update(assignment.id, published);
    } catch {
      // Keep local publish even when API is unavailable.
    }

    persistAssignments(
      assignments.map((item) => (String(item.id) === String(assignment.id) ? normalizeAssignment(published) : item))
    );
    pushAssignmentAnnouncement(published);
    setNotification({ type: 'success', message: 'Assignment published. Students can now see it.' });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleStudentSubmit = async (assignment) => {
    if (!submitFile) {
      setNotification({ type: 'error', message: 'Please select a file to submit.' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    const submissionKey = `${currentStudentKey}:${assignment.id}`;
    if (studentSubmissions[submissionKey]) return;

    const submittedAt = new Date().toISOString();
    const formDataPayload = new FormData();
    formDataPayload.append('student', currentStudentKey);
    formDataPayload.append('submittedAt', submittedAt);
    formDataPayload.append('note', submitNote.trim());
    formDataPayload.append('file', submitFile);

    let fileDataUrl = '';
    try {
      fileDataUrl = await fileToDataUrl(submitFile);
    } catch {
      fileDataUrl = '';
    }

    if (!fileDataUrl) {
      setNotification({
        type: 'error',
        message: 'Could not prepare file for preview/open. Please try another file.',
      });
      setTimeout(() => setNotification(null), 3500);
      return;
    }

    const submissionPayload = {
      id: `${assignment.id}:${currentStudentKey}:${submittedAt}`,
      assignmentId: assignment.id,
      student: currentStudentKey,
      studentName: String(user?.name || '').trim() || currentStudentKey,
      studentEmail: String(user?.email || '').trim(),
      submittedAt,
      note: submitNote.trim(),
      fileName: submitFile.name,
      fileSize: submitFile.size,
      fileType: submitFile.type || 'application/octet-stream',
      fileDataUrl,
    };

    setIsSubmitting(true);
    try {
      await assignmentsAPI.submit(assignment.id, formDataPayload);
    } catch {
      // Keep local submission even when API is unavailable.
    }

    const nextSubmissions = {
      ...studentSubmissions,
      [submissionKey]: submissionPayload,
    };
    persistSubmissions(nextSubmissions);

    const nextAssignments = assignments.map((item) => {
      if (String(item.id) !== String(assignment.id)) return item;
      if (item.status === 'draft') return item;
      return {
        ...item,
        submissions: Math.min(item.total, (Number(item.submissions) || 0) + 1),
      };
    });
    persistAssignments(nextAssignments);

    setNotification({ type: 'success', message: 'Assignment submitted successfully.' });
    setTimeout(() => setNotification(null), 3000);
    setIsSubmitting(false);
    setIsSubmitModalOpen(false);
    setSelectedAssignment(null);
    setSubmitFile(null);
    if (submitPreviewUrl) {
      URL.revokeObjectURL(submitPreviewUrl);
      setSubmitPreviewUrl('');
    }
    setSubmitNote('');
  };

  const handleStudentCancelSubmission = async (assignment) => {
    const submissionKey = `${currentStudentKey}:${assignment.id}`;
    if (!studentSubmissions[submissionKey]) return;

    if (!window.confirm('Cancel your hand-in for this assignment?')) return;

    const nextSubmissions = { ...studentSubmissions };
    delete nextSubmissions[submissionKey];
    persistSubmissions(nextSubmissions);

    const nextAssignments = assignments.map((item) => {
      if (String(item.id) !== String(assignment.id)) return item;
      if (item.status === 'draft') return item;
      return {
        ...item,
        submissions: Math.max(0, (Number(item.submissions) || 0) - 1),
      };
    });
    persistAssignments(nextAssignments);

    setNotification({ type: 'success', message: 'Hand-in cancelled.' });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSubmitFileChange = (file) => {
    if (submitPreviewUrl) {
      URL.revokeObjectURL(submitPreviewUrl);
    }

    setSubmitFile(file);
    if (!file) {
      setSubmitPreviewUrl('');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setSubmitPreviewUrl(previewUrl);
  };

  const openSubmissionFile = async (submission) => {
    const rawUrl = getSubmissionFileUrl(submission);
    if (!rawUrl) {
      setNotification({ type: 'error', message: 'No file URL found for this submission.' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    let temporaryObjectUrl = '';
    try {
      let openUrl = rawUrl;
      if (isDataUrl(rawUrl)) {
        const blob = await fetch(rawUrl).then((response) => response.blob());
        temporaryObjectUrl = URL.createObjectURL(blob);
        openUrl = temporaryObjectUrl;
      }

      const popup = window.open(openUrl, '_blank', 'noopener,noreferrer');
      if (!popup) {
        throw new Error('Popup blocked');
      }
    } catch {
      setNotification({ type: 'error', message: 'Could not open this file. Try uploading and submitting again.' });
      setTimeout(() => setNotification(null), 3500);
    } finally {
      if (temporaryObjectUrl) {
        setTimeout(() => URL.revokeObjectURL(temporaryObjectUrl), 60000);
      }
    }
  };

  const openSelectedFilePreview = () => {
    if (!submitFile) {
      setNotification({ type: 'error', message: 'Please select a file first.' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    const objectUrl = URL.createObjectURL(submitFile);
    const popup = window.open(objectUrl, '_blank', 'noopener,noreferrer');
    if (!popup) {
      setNotification({ type: 'error', message: 'Popup blocked. Please allow popups for this site.' });
      setTimeout(() => setNotification(null), 3500);
    }
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  };

  const selectedGroupTotal = getStudentCountForGroup(formData.classCode);
  const showSubmissionField = formData.status !== 'draft';

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
          <h1 className="text-2xl font-bold text-gray-800">Assignments</h1>
          <p className="text-sm text-gray-500 mt-1">
            {canManageAssignments
              ? 'Real assignment workflow by class.'
              : 'View and submit your assignments.'}
          </p>
        </div>
        {canManageAssignments && (
          <Button icon={HiOutlinePlus} onClick={openCreateModal}>
            New Assignment
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-card text-center">
          <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
          <p className="text-xs text-gray-500 mt-1">Total</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-card text-center border-b-4 border-blue-500">
          <p className="text-2xl font-bold text-blue-600">{stats.active}</p>
          <p className="text-xs text-gray-500 mt-1">Active</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-card text-center border-b-4 border-orange-500">
          <p className="text-2xl font-bold text-orange-600">{stats.overdue}</p>
          <p className="text-xs text-gray-500 mt-1">Overdue</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-card text-center border-b-4 border-green-500">
          <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          <p className="text-xs text-gray-500 mt-1">Completed</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-card text-center border-b-4 border-gray-400">
          <p className="text-2xl font-bold text-gray-600">{stats.draft}</p>
          <p className="text-xs text-gray-500 mt-1">Draft</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-card flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assignments..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {canManageAssignments ? (
          <div className="grid grid-cols-1 gap-2 w-full sm:w-auto">
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Classes</option>
              {classOptions.filter((option) => option.value).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="text-xs px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700">
            Showing assignments for Class {studentClass || '-'}
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {['all', 'active', 'overdue', 'completed', 'draft'].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                statusFilter === status
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl p-8 shadow-card text-center text-sm text-gray-500">
          Loading assignments...
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="bg-white rounded-xl p-8 shadow-card text-center text-sm text-gray-500">
          {canManageAssignments
            ? 'No assignments found.'
            : `No published assignments found for your class (${studentClass || '-'}) yet.`}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssignments.map((assignment) => {
            const status = getDerivedStatus(assignment);
            const statusVariant =
              status === 'completed'
                ? 'info'
                : status === 'overdue'
                ? 'warning'
                : status === 'active'
                ? 'success'
                : 'neutral';
            const progress = assignment.total > 0 ? Math.min(100, (assignment.submissions / assignment.total) * 100) : 0;

            return (
              <div
                key={assignment.id}
                className="bg-white rounded-xl p-5 shadow-card hover:shadow-lg transition-all border border-transparent hover:border-primary-100"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 bg-primary-50 rounded-lg">
                    <HiOutlineDocumentText className="w-5 h-5 text-primary-600" />
                  </div>
                  <Badge variant={statusVariant}>{status}</Badge>
                </div>

                <h3 className="font-semibold text-gray-800 mb-1">{assignment.title}</h3>
                <p className="text-xs text-gray-400 mb-3">{assignment.subject}</p>
                <p className="text-xs text-gray-500 mb-3">
                  Class {assignment.classCode}
                </p>
                {assignment.description ? (
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">{assignment.description}</p>
                ) : null}

                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">Submissions</span>
                    <span className="font-medium text-gray-700">
                      {assignment.submissions}/{assignment.total}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="bg-primary-500 rounded-full h-1.5 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs mb-3">
                  <span className="text-gray-400">
                    Due: {assignment.dueDate ? format(new Date(assignment.dueDate), 'dd MMM yyyy') : '-'}
                  </span>
                  <span className="text-gray-500 font-medium">{assignment.submissions} submitted</span>
                </div>

                {canManageAssignments ? (
                  <div className="flex items-center justify-end gap-1">
                    {assignment.status === 'draft' && (
                      <button
                        type="button"
                        className="px-2 py-1 text-xs rounded border border-green-200 hover:border-green-300 text-green-700"
                        onClick={() => handlePublish(assignment)}
                      >
                        Publish
                      </button>
                    )}
                    <button
                      type="button"
                      className="px-2 py-1 text-xs rounded border border-gray-200 hover:border-primary-300 text-gray-600"
                      onClick={() => openEditModal(assignment)}
                    >
                      <HiOutlinePencil className="w-3.5 h-3.5 inline mr-1" />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 text-xs rounded border border-blue-200 hover:border-blue-300 text-blue-700"
                      onClick={() => {
                        setSelectedTeacherAssignment(assignment);
                        setIsSubmissionListModalOpen(true);
                      }}
                    >
                      Submissions ({(submissionsByAssignment[String(assignment.id)] || []).length})
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 text-xs rounded border border-red-200 hover:border-red-300 text-red-600"
                      onClick={() => handleDelete(assignment.id)}
                    >
                      <HiOutlineTrash className="w-3.5 h-3.5 inline mr-1" />
                      Delete
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-1">
                    {(() => {
                      const submissionKey = `${currentStudentKey}:${assignment.id}`;
                      const submission = studentSubmissions[submissionKey];
                      const submitted = Boolean(submission);
                      const isDraft = assignment.status === 'draft';
                      return submitted ? (
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-green-200 text-green-700 bg-green-50">
                            <HiOutlineCheckCircle className="w-3.5 h-3.5" />
                            Submitted
                          </span>
                          {submission?.fileName ? (
                            <p className="text-[11px] text-gray-500 mt-1">
                              File: {submission.fileName}
                            </p>
                          ) : null}
                          {getSubmissionFileUrl(submission) ? (
                            <button
                              type="button"
                              className="inline-block mt-1 text-[11px] text-primary-700 hover:underline"
                              onClick={() => openSubmissionFile(submission)}
                            >
                              Open submission
                            </button>
                          ) : null}
                          <div>
                            <button
                              type="button"
                              className="inline-block mt-1 text-[11px] text-red-600 hover:underline"
                              onClick={() => handleStudentCancelSubmission(assignment)}
                            >
                              Cancel hand-in
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={isDraft}
                          className={`px-2 py-1 text-xs rounded border ${
                            isDraft
                              ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                              : 'border-primary-300 text-primary-700 hover:border-primary-500'
                          }`}
                          onClick={() => {
                            if (!isDraft) {
                              setSelectedAssignment(assignment);
                              handleSubmitFileChange(null);
                              setSubmitNote('');
                              setIsSubmitModalOpen(true);
                            }
                          }}
                        >
                          Submit
                        </button>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canManageAssignments && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            if (isSaving) return;
            setIsModalOpen(false);
            setEditingAssignmentId(null);
            resetForm();
          }}
          title={editingAssignmentId ? 'Edit Assignment' : 'Create Assignment'}
        >
          <form onSubmit={handleCreateOrUpdate} className="space-y-4">
          <div>
            <label htmlFor="assignment-title" className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              id="assignment-title"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div>
            <label htmlFor="assignment-subject" className="block text-sm font-medium text-gray-700 mb-1">
              Subject
            </label>
            <select
              id="assignment-subject"
              value={formData.subject}
              onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {subjectOptions
                .filter((option) => option.value)
                .map((option) => (
                  <option key={option.value} value={option.label}>
                    {option.label}
                  </option>
                ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="assignment-class" className="block text-sm font-medium text-gray-700 mb-1">
                Class
              </label>
              <select
                id="assignment-class"
                value={formData.classCode}
                onChange={(e) => setFormData((prev) => ({ ...prev, classCode: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {classOptions.filter((option) => option.value).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.value}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="assignment-due-date" className="block text-sm font-medium text-gray-700 mb-1">
                Due Date
              </label>
              <input
                id="assignment-due-date"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, dueDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
            <div>
              <label htmlFor="assignment-total" className="block text-sm font-medium text-gray-700 mb-1">
                Total Students (Auto)
              </label>
              <input
                id="assignment-total"
                type="number"
                value={selectedGroupTotal}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700"
                readOnly
              />
            </div>
          </div>

          {showSubmissionField && (
            <div>
              <label htmlFor="assignment-submissions" className="block text-sm font-medium text-gray-700 mb-1">
                Submitted Count
              </label>
              <input
                id="assignment-submissions"
                type="number"
                min="0"
                max={Math.max(0, selectedGroupTotal)}
                value={formData.submissions}
                onChange={(e) => setFormData((prev) => ({ ...prev, submissions: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}

          <div>
            <label htmlFor="assignment-description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="assignment-description"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Instructions for students..."
            />
          </div>

          <div>
            <label htmlFor="assignment-status" className="block text-sm font-medium text-gray-700 mb-1">
              Publishing State
            </label>
            <select
              id="assignment-status"
              value={formData.status}
              onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="active">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsModalOpen(false);
                setEditingAssignmentId(null);
                resetForm();
              }}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isSaving}>
              {editingAssignmentId ? 'Save Changes' : 'Create'}
            </Button>
          </div>
          </form>
        </Modal>
      )}

      {canManageAssignments && (
        <Modal
          isOpen={isSubmissionListModalOpen}
          onClose={() => {
            setIsSubmissionListModalOpen(false);
            setSelectedTeacherAssignment(null);
          }}
          title={`Submissions - ${selectedTeacherAssignment?.title || 'Assignment'}`}
        >
          <div className="space-y-3">
            {(() => {
              const list = submissionsByAssignment[String(selectedTeacherAssignment?.id || '')] || [];
              if (list.length === 0) {
                return <p className="text-sm text-gray-500">No submissions yet.</p>;
              }

              return (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 text-gray-600 font-medium">Student</th>
                          <th className="text-left px-3 py-2 text-gray-600 font-medium">Date</th>
                          <th className="text-left px-3 py-2 text-gray-600 font-medium">Time</th>
                          <th className="text-left px-3 py-2 text-gray-600 font-medium">File</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((item) => {
                          const stamp = item.submittedAt ? new Date(item.submittedAt) : null;
                          const dateLabel =
                            stamp && !Number.isNaN(stamp.getTime()) ? format(stamp, 'dd MMM yyyy') : '-';
                          const timeLabel =
                            stamp && !Number.isNaN(stamp.getTime()) ? format(stamp, 'hh:mm a') : '-';

                          return (
                            <tr key={item.id} className="border-t border-gray-100">
                              <td className="px-3 py-2 text-gray-800">{item.studentName}</td>
                              <td className="px-3 py-2 text-gray-700">{dateLabel}</td>
                              <td className="px-3 py-2 text-gray-700">{timeLabel}</td>
                              <td className="px-3 py-2 text-gray-700">
                                {getSubmissionFileUrl(item) ? (
                                  <button
                                    type="button"
                                    className="text-primary-700 hover:underline"
                                    onClick={() => openSubmissionFile(item)}
                                  >
                                    {item.fileName || 'Open'}
                                  </button>
                                ) : (
                                  item.fileName || '-'
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        </Modal>
      )}

      {!canManageAssignments && (
        <Modal
          isOpen={isSubmitModalOpen}
          onClose={() => {
            if (isSubmitting) return;
            setIsSubmitModalOpen(false);
            setSelectedAssignment(null);
            handleSubmitFileChange(null);
            setSubmitNote('');
          }}
          title="Submit Assignment"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!selectedAssignment) return;
              handleStudentSubmit(selectedAssignment);
            }}
            className="space-y-4"
          >
            <div>
              <p className="text-sm font-medium text-gray-800">
                {selectedAssignment?.title || 'Assignment'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Upload your hand-in file (PDF, DOCX, image, or ZIP).
              </p>
            </div>

            <div>
              <label htmlFor="assignment-submit-file" className="block text-sm font-medium text-gray-700 mb-1">
                Submission File
              </label>
                <input
                  id="assignment-submit-file"
                  type="file"
                  required
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.zip,.rar,image/*"
                  onChange={(e) => handleSubmitFileChange(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 file:mr-3 file:px-3 file:py-1.5 file:border-0 file:rounded-md file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                />
              {submitFile && (
                <p className="text-xs text-gray-500 mt-1">
                  Selected: {submitFile.name} ({Math.max(1, Math.round(submitFile.size / 1024))} KB)
                </p>
              )}
              {submitPreviewUrl && submitFile && (
                <button
                  type="button"
                  onClick={openSelectedFilePreview}
                  className="inline-block text-xs text-primary-700 hover:underline mt-1"
                >
                  Open selected file to verify
                </button>
              )}
            </div>

            <div>
              <label htmlFor="assignment-submit-note" className="block text-sm font-medium text-gray-700 mb-1">
                Note (Optional)
              </label>
              <textarea
                id="assignment-submit-note"
                rows={3}
                value={submitNote}
                onChange={(e) => setSubmitNote(e.target.value)}
                placeholder="Add note for teacher..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                  onClick={() => {
                    setIsSubmitModalOpen(false);
                    setSelectedAssignment(null);
                    handleSubmitFileChange(null);
                    setSubmitNote('');
                  }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting}>
                Submit File
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

