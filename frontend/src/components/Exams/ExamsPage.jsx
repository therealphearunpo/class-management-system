import React, { useEffect, useState } from 'react';

import { motion } from 'framer-motion';
import {
  HiOutlineCalendar,
  HiOutlineClipboardList,
  HiOutlineDocumentDownload,
  HiOutlinePencil,
  HiOutlinePlus,
  HiOutlineSpeakerphone,
  HiOutlineTrash,
  HiOutlineUsers,
} from 'react-icons/hi';

import { ACCOUNT_ROLES, normalizeRole } from '../../constants/roles';
import { useAuth } from '../../context/AuthContext';
import { classOptions, subjectOptions } from '../../data/students';
import { examsAPI } from '../../services/api';
import Badge from '../common/Badge';
import Button from '../common/Button';
import DataTable from '../common/DataTable';
import Modal from '../common/Modal';

const examStatusColors = {
  scheduled: 'bg-blue-100 text-blue-700',
  ongoing: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const LOCAL_EXAM_ANNOUNCEMENTS_KEY = 'exam_announcements_local_v1';

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Unable to read file.'));
    reader.readAsDataURL(file);
  });
}

function normalizeAnnouncement(item) {
  return {
    id: item?.id || `exam-announcement-${Date.now()}`,
    title: String(item?.title || 'Exam Announcement').trim(),
    examDate: String(item?.examDate || '').trim(),
    examTime: String(item?.examTime || '').trim(),
    classCode: String(item?.classCode || 'ALL').trim() || 'ALL',
    message: String(item?.message || '').trim(),
    attachmentName: String(item?.attachmentName || '').trim(),
    attachmentType: String(item?.attachmentType || '').trim(),
    attachmentDataUrl: String(item?.attachmentDataUrl || '').trim(),
    postedAt: item?.postedAt || new Date().toISOString(),
    postedBy: String(item?.postedBy || 'Admin Center').trim(),
  };
}

function readAnnouncements() {
  try {
    const raw = localStorage.getItem(LOCAL_EXAM_ANNOUNCEMENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(normalizeAnnouncement) : [];
  } catch {
    return [];
  }
}

function writeAnnouncements(items) {
  const next = (Array.isArray(items) ? items : []).map(normalizeAnnouncement);
  localStorage.setItem(LOCAL_EXAM_ANNOUNCEMENTS_KEY, JSON.stringify(next));
  return next;
}

export default function ExamsPage() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  const isAdmin = role === ACCOUNT_ROLES.ADMIN;
  const isStudent = role === ACCOUNT_ROLES.STUDENT;
  const studentClassCode = String(user?.class || '').trim();
  const [exams, setExams] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);

  useEffect(() => {
    loadExams();
    setAnnouncements(readAnnouncements());

    const onStorage = (event) => {
      if (event.key === LOCAL_EXAM_ANNOUNCEMENTS_KEY) {
        setAnnouncements(readAnnouncements());
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const loadExams = async () => {
    setLoading(true);
    try {
      const response = await examsAPI.getAll();
      setExams(Array.isArray(response?.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load exams:', error);
      setExams([]);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      header: 'Exam Name',
      accessor: 'name',
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100 rounded-lg">
            <HiOutlineClipboardList className="w-4 h-4 text-primary-600" />
          </div>
          <div>
            <p className="font-medium text-gray-800">{value}</p>
            <p className="text-xs text-gray-400">{row.subject}</p>
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
      header: 'Date',
      accessor: 'date',
      sortable: true,
      render: (value) => (
        <div className="flex items-center gap-2">
          <HiOutlineCalendar className="w-4 h-4 text-gray-400" />
          <span>{new Date(value).toLocaleDateString()}</span>
        </div>
      ),
    },
    {
      header: 'Duration',
      accessor: 'duration',
      render: (value) => `${value} mins`,
    },
    {
      header: 'Total Marks',
      accessor: 'totalMarks',
      sortable: true,
    },
    {
      header: 'Students',
      accessor: 'studentCount',
      render: (value) => (
        <div className="flex items-center gap-2">
          <HiOutlineUsers className="w-4 h-4 text-gray-400" />
          <span>{value}</span>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (value) => (
        <Badge variant={examStatusColors[value]}>
          {String(value || '').charAt(0).toUpperCase() + String(value || '').slice(1)}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      accessor: 'id',
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedExam(row);
            }}
          >
            View
          </Button>
          {row.status === 'completed' && (
            <Button
              variant="ghost"
              size="sm"
              icon={HiOutlineDocumentDownload}
              onClick={(e) => e.stopPropagation()}
            >
              Results
            </Button>
          )}
        </div>
      ),
    },
  ];

  const visibleExams = isStudent && studentClassCode
    ? exams.filter((exam) => String(exam?.class || '').trim() === studentClassCode)
    : exams;
  const visibleAnnouncements = isStudent && studentClassCode
    ? announcements.filter((item) => item.classCode === 'ALL' || item.classCode === studentClassCode)
    : announcements;

  const stats = [
    { label: 'Total Exams', value: visibleExams.length, icon: HiOutlineClipboardList, color: 'bg-blue-500' },
    { label: 'Upcoming', value: visibleExams.filter((e) => e.status === 'scheduled').length, icon: HiOutlineCalendar, color: 'bg-yellow-500' },
    { label: 'Ongoing', value: visibleExams.filter((e) => e.status === 'ongoing').length, icon: HiOutlineClipboardList, color: 'bg-green-500' },
    { label: 'Completed', value: visibleExams.filter((e) => e.status === 'completed').length, icon: HiOutlineUsers, color: 'bg-purple-500' },
  ];

  const handleCreateAnnouncement = (payload) => {
    const normalized = normalizeAnnouncement(payload);
    const next = editingAnnouncement
      ? writeAnnouncements(
          announcements.map((item) => (String(item.id) === String(editingAnnouncement.id) ? normalized : item))
        )
      : writeAnnouncements([normalized, ...announcements]);
    setAnnouncements(next);
    setShowAnnouncementModal(false);
    setEditingAnnouncement(null);
  };

  const handleEditAnnouncement = (item) => {
    setEditingAnnouncement(item);
    setShowAnnouncementModal(true);
  };

  const handleDeleteAnnouncement = (announcementId) => {
    const next = writeAnnouncements(
      announcements.filter((item) => String(item.id) !== String(announcementId))
    );
    setAnnouncements(next);
    if (editingAnnouncement && String(editingAnnouncement.id) === String(announcementId)) {
      setEditingAnnouncement(null);
    }
  };

  const openAttachment = (item) => {
    const href = String(item?.attachmentDataUrl || '').trim();
    if (!href) return;

    const a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    if (!href.startsWith('data:image/')) {
      a.download = item.attachmentName || 'exam-announcement-file';
    }
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Exam Schedule</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isAdmin
              ? 'Upload and manage the exam schedule as School Management.'
              : 'View the official exam schedule uploaded by School Management.'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="lg"
              icon={HiOutlineSpeakerphone}
              onClick={() => setShowAnnouncementModal(true)}
            >
              Post Announcement
            </Button>
            <Button
              variant="primary"
              size="lg"
              icon={HiOutlinePlus}
              onClick={() => setShowCreateModal(true)}
            >
              Upload Exam Schedule
            </Button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-card p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Exam Announcements</h2>
        {visibleAnnouncements.length === 0 ? (
          <p className="text-sm text-gray-500">No announcement posted yet.</p>
        ) : (
          <div className="space-y-3">
            {visibleAnnouncements.slice(0, 10).map((item) => (
              <div key={item.id} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Class: {item.classCode === 'ALL' ? 'All Classes' : item.classCode} | Date: {item.examDate || '-'} | Time: {item.examTime || '-'} | Posted by {item.postedBy}
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <p className="text-[11px] text-gray-400">{new Date(item.postedAt).toLocaleString()}</p>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:border-primary-300 hover:text-primary-700"
                          onClick={() => handleEditAnnouncement(item)}
                        >
                          <HiOutlinePencil className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:border-red-300"
                          onClick={() => handleDeleteAnnouncement(item.id)}
                        >
                          <HiOutlineTrash className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {item.message && (
                  <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{item.message}</p>
                )}
                {item.attachmentDataUrl && (
                  <div className="mt-2">
                    {item.attachmentType.startsWith('image/') ? (
                      <img
                        src={item.attachmentDataUrl}
                        alt={item.attachmentName || 'announcement attachment'}
                        className="max-h-48 rounded border border-gray-200"
                      />
                    ) : null}
                    <button
                      type="button"
                      className="text-sm text-primary-700 hover:underline mt-2"
                      onClick={() => openAttachment(item)}
                    >
                      Open Attachment{item.attachmentName ? ` (${item.attachmentName})` : ''}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-xl p-5 shadow-card"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{stat.value}</p>
              </div>
              <div className={`${stat.color} p-3 rounded-xl`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={visibleExams}
        loading={loading}
        onRowClick={(row) => setSelectedExam(row)}
      />

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Upload Exam Schedule"
      >
        <CreateExamForm
          onSuccess={() => {
            setShowCreateModal(false);
            loadExams();
          }}
        />
      </Modal>

      <Modal
        isOpen={showAnnouncementModal}
        onClose={() => {
          setShowAnnouncementModal(false);
          setEditingAnnouncement(null);
        }}
        title={editingAnnouncement ? 'Edit Exam Announcement' : 'Post Exam Announcement'}
      >
        <ExamAnnouncementForm
          onSubmit={handleCreateAnnouncement}
          postedBy="Admin Center"
          initialData={editingAnnouncement}
        />
      </Modal>

      <Modal
        isOpen={selectedExam}
        onClose={() => setSelectedExam(null)}
        title={selectedExam?.name}
      >
        {selectedExam && <ExamDetails exam={selectedExam} isAdmin={isAdmin} />}
      </Modal>
    </div>
  );
}

function CreateExamForm({ onSuccess }) {
  const examSubjectOptions = subjectOptions.filter((item) => item.value);

  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    class: '',
    date: '',
    duration: 60,
    totalMarks: 100,
    passingMarks: 40,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await examsAPI.create({ ...formData, uploadedBy: 'School Management' });
      onSuccess();
    } catch (error) {
      console.error('Failed to create exam:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="exam-name" className="block text-sm font-medium text-gray-700 mb-1">
          Exam Name
        </label>
        <input
          id="exam-name"
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="exam-subject" className="block text-sm font-medium text-gray-700 mb-1">
            Subject
          </label>
          <select
            id="exam-subject"
            required
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Select subject</option>
            {examSubjectOptions.map((item) => (
              <option key={item.value} value={item.label}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="exam-class" className="block text-sm font-medium text-gray-700 mb-1">
            Class
          </label>
          <select
            id="exam-class"
            required
            value={formData.class}
            onChange={(e) => setFormData({ ...formData, class: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {classOptions.map((opt) => (
              <option key={opt.value || 'empty'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
        Publisher: School Management
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="exam-date" className="block text-sm font-medium text-gray-700 mb-1">
            Date
          </label>
          <input
            id="exam-date"
            type="date"
            required
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label htmlFor="exam-duration" className="block text-sm font-medium text-gray-700 mb-1">
            Duration (minutes)
          </label>
          <input
            id="exam-duration"
            type="number"
            required
            min="15"
            step="15"
            value={formData.duration}
            onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value, 10) || 0 })}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="exam-total-marks" className="block text-sm font-medium text-gray-700 mb-1">
            Total Marks
          </label>
          <input
            id="exam-total-marks"
            type="number"
            required
            min="1"
            value={formData.totalMarks}
            onChange={(e) => setFormData({ ...formData, totalMarks: parseInt(e.target.value, 10) || 0 })}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label htmlFor="exam-passing-marks" className="block text-sm font-medium text-gray-700 mb-1">
            Passing Marks
          </label>
          <input
            id="exam-passing-marks"
            type="number"
            required
            min="1"
            value={formData.passingMarks}
            onChange={(e) => setFormData({ ...formData, passingMarks: parseInt(e.target.value, 10) || 0 })}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button type="button" variant="secondary" onClick={() => onSuccess()}>
          Cancel
        </Button>
        <Button type="submit" variant="primary">
          Schedule Exam
        </Button>
      </div>
    </form>
  );
}

function ExamAnnouncementForm({ onSubmit, postedBy, initialData }) {
  const [formData, setFormData] = useState({
    title: '',
    examDate: '',
    examTime: '',
    classCode: 'ALL',
    message: '',
  });
  const [attachment, setAttachment] = useState(null);
  const [existingAttachment, setExistingAttachment] = useState({
    attachmentName: '',
    attachmentType: '',
    attachmentDataUrl: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFormData({
      title: initialData?.title || '',
      examDate: initialData?.examDate || '',
      examTime: initialData?.examTime || '',
      classCode: initialData?.classCode || 'ALL',
      message: initialData?.message || '',
    });
    setExistingAttachment({
      attachmentName: initialData?.attachmentName || '',
      attachmentType: initialData?.attachmentType || '',
      attachmentDataUrl: initialData?.attachmentDataUrl || '',
    });
    setAttachment(null);
  }, [initialData]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      let attachmentDataUrl = '';
      let attachmentName = '';
      let attachmentType = '';
      if (attachment) {
        attachmentDataUrl = await fileToDataUrl(attachment);
        attachmentName = attachment.name;
        attachmentType = attachment.type || '';
      } else if (existingAttachment.attachmentDataUrl) {
        attachmentDataUrl = existingAttachment.attachmentDataUrl;
        attachmentName = existingAttachment.attachmentName;
        attachmentType = existingAttachment.attachmentType;
      }

      onSubmit({
        id: initialData?.id,
        ...formData,
        attachmentDataUrl,
        attachmentName,
        attachmentType,
        postedAt: initialData?.postedAt || new Date().toISOString(),
        postedBy,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="announcement-title" className="block text-sm font-medium text-gray-700 mb-1">
          Announcement Title
        </label>
        <input
          id="announcement-title"
          type="text"
          required
          value={formData.title}
          onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="announcement-date" className="block text-sm font-medium text-gray-700 mb-1">
            Exam Date
          </label>
          <input
            id="announcement-date"
            type="date"
            value={formData.examDate}
            onChange={(e) => setFormData((prev) => ({ ...prev, examDate: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
        <div>
          <label htmlFor="announcement-time" className="block text-sm font-medium text-gray-700 mb-1">
            Exam Time
          </label>
          <input
            id="announcement-time"
            type="time"
            value={formData.examTime}
            onChange={(e) => setFormData((prev) => ({ ...prev, examTime: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
      </div>

      <div>
        <label htmlFor="announcement-class" className="block text-sm font-medium text-gray-700 mb-1">
          Target Class
        </label>
        <select
          id="announcement-class"
          value={formData.classCode}
          onChange={(e) => setFormData((prev) => ({ ...prev, classCode: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
        >
          <option value="ALL">All Classes</option>
          {classOptions.filter((opt) => opt.value).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.value}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="announcement-message" className="block text-sm font-medium text-gray-700 mb-1">
          Message
        </label>
        <textarea
          id="announcement-message"
          rows={3}
          value={formData.message}
          onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
          placeholder="Announcement details for all users..."
        />
      </div>

      <div>
        <label htmlFor="announcement-file" className="block text-sm font-medium text-gray-700 mb-1">
          Attachment (Image or File)
        </label>
        <input
          id="announcement-file"
          type="file"
          accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,.rar"
          onChange={(e) => setAttachment(e.target.files?.[0] || null)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 file:mr-3 file:px-3 file:py-1.5 file:border-0 file:rounded-md file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
        />
        {(attachment || existingAttachment.attachmentName) && (
          <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <span>{attachment ? attachment.name : existingAttachment.attachmentName}</span>
            {initialData?.attachmentDataUrl && !attachment && (
              <button
                type="button"
                className="text-red-600 hover:underline"
                onClick={() => setExistingAttachment({
                  attachmentName: '',
                  attachmentType: '',
                  attachmentDataUrl: '',
                })}
              >
                Remove attachment
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={saving}>
          {initialData ? 'Save Announcement' : 'Post Announcement'}
        </Button>
      </div>
    </form>
  );
}

function ExamDetails({ exam, isAdmin }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">Subject</p>
          <p className="text-sm font-medium text-gray-800 mt-1">{exam.subject}</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">Class</p>
          <p className="text-sm font-medium text-gray-800 mt-1">{exam.class}</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">Date & Time</p>
          <p className="text-sm font-medium text-gray-800 mt-1">{new Date(exam.date).toLocaleString()}</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">Duration</p>
          <p className="text-sm font-medium text-gray-800 mt-1">{exam.duration} minutes</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">Total Marks</p>
          <p className="text-sm font-medium text-gray-800 mt-1">{exam.totalMarks}</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">Passing Marks</p>
          <p className="text-sm font-medium text-gray-800 mt-1">{exam.passingMarks}</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">Uploaded By</p>
          <p className="text-sm font-medium text-gray-800 mt-1">{exam.uploadedBy || 'School Management'}</p>
        </div>
      </div>

      {exam.status === 'completed' && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Results Summary</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Average Score</span>
              <span className="text-lg font-bold text-gray-800">78.5%</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Highest Score</span>
              <span className="text-lg font-bold text-green-600">98%</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Pass Rate</span>
              <span className="text-lg font-bold text-green-600">85%</span>
            </div>
          </div>
        </div>
      )}

      {isAdmin ? (
        <div className="flex justify-end gap-3">
          <Button variant="secondary">Edit</Button>
          {exam.status === 'completed' && (
            <Button variant="primary" icon={HiOutlineDocumentDownload}>
              Download Results
            </Button>
          )}
          {exam.status === 'scheduled' && <Button variant="success">Start Exam</Button>}
        </div>
      ) : null}
    </div>
  );
}
