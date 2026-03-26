import React, { useEffect, useMemo, useState } from 'react';

import {
  addDays,
  addMonths,
  compareAsc,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import {
  HiOutlineCalendar,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineClipboardList,
  HiOutlinePencil,
  HiOutlineSpeakerphone,
  HiOutlineTrash,
} from 'react-icons/hi';

import { ACCOUNT_ROLES, normalizeRole } from '../../constants/roles';
import { useAuth } from '../../context/AuthContext';
import { assignmentsAPI, examsAPI } from '../../services/api';
import Badge from '../common/Badge';
import Button from '../common/Button';
import Modal from '../common/Modal';

const LOCAL_ASSIGNMENTS_KEY = 'assignments_local_v2';
const LOCAL_EXAM_ANNOUNCEMENTS_KEY = 'exam_announcements_local_v1';
const LOCAL_CALENDAR_EVENTS_KEY = 'calendar_events_local_v1';

const eventTheme = {
  exam: {
    badge: 'bg-red-100 text-red-700 border-red-200',
    dot: '#ef4444',
    icon: HiOutlineClipboardList,
    label: 'Exam',
  },
  assignment: {
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    dot: '#2563eb',
    icon: HiOutlineClipboardList,
    label: 'Assignment',
  },
  announcement: {
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    dot: '#d97706',
    icon: HiOutlineSpeakerphone,
    label: 'Announcement',
  },
  custom: {
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    dot: '#059669',
    icon: HiOutlineCalendar,
    label: 'Event',
  },
};

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function mergeById(items) {
  const map = new Map();
  items.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const key = item.id != null ? String(item.id) : `fallback-${index}`;
    map.set(key, item);
  });
  return Array.from(map.values());
}

function parseEventDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const parsed = parseISO(String(value));
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function normalizeExamEvent(exam) {
  const date = parseEventDate(exam?.date);
  if (!date) return null;

  return {
    id: `exam-${exam.id}`,
    sourceId: exam.id,
    type: 'exam',
    title: exam.name || 'Exam',
    subtitle: exam.subject || '',
    date,
    classCode: String(exam.class || 'ALL').trim() || 'ALL',
    description: exam.subject || '',
    status: exam.status || 'scheduled',
    editable: false,
  };
}

function normalizeAssignmentEvent(assignment) {
  const date = parseEventDate(assignment?.dueDate);
  if (!date) return null;
  if (String(assignment?.status || '').toLowerCase() === 'draft') return null;

  return {
    id: `assignment-${assignment.id}`,
    sourceId: assignment.id,
    type: 'assignment',
    title: assignment.title || 'Assignment',
    subtitle: assignment.subject || '',
    date,
    classCode: String(assignment.classCode || assignment.class || 'ALL').trim() || 'ALL',
    description: assignment.description || '',
    status: assignment.status || 'active',
    editable: false,
  };
}

function normalizeAnnouncementEvent(item) {
  const date = parseEventDate(item?.examDate);
  if (!date) return null;

  return {
    id: `announcement-${item.id}`,
    sourceId: item.id,
    type: 'announcement',
    title: item.title || 'Exam Announcement',
    subtitle: item.postedBy || 'Admin Center',
    date,
    timeLabel: item.examTime || '',
    classCode: String(item.classCode || 'ALL').trim() || 'ALL',
    description: item.message || '',
    attachmentName: item.attachmentName || '',
    attachmentDataUrl: item.attachmentDataUrl || '',
    editable: false,
  };
}

function normalizeCustomEvent(item) {
  const date = parseEventDate(item?.date);
  if (!date) return null;

  return {
    id: String(item.id || `custom-${Date.now()}`),
    sourceId: item.id,
    type: 'custom',
    title: String(item.title || 'School Event').trim(),
    subtitle: String(item.location || '').trim(),
    date,
    timeLabel: String(item.timeLabel || '').trim(),
    classCode: String(item.classCode || 'ALL').trim() || 'ALL',
    description: String(item.description || '').trim(),
    editable: true,
  };
}

function readCustomEvents() {
  return readJson(LOCAL_CALENDAR_EVENTS_KEY, [])
    .map(normalizeCustomEvent)
    .filter(Boolean);
}

function writeCustomEvents(items) {
  const normalized = (Array.isArray(items) ? items : [])
    .map((item) => ({
      ...item,
      date: item.date instanceof Date ? format(item.date, 'yyyy-MM-dd') : item.date,
    }))
    .map(normalizeCustomEvent)
    .filter(Boolean);

  localStorage.setItem(LOCAL_CALENDAR_EVENTS_KEY, JSON.stringify(normalized));
  return normalized;
}

function EventCard({ event, isAdmin, onEdit, onDelete }) {
  const theme = eventTheme[event.type] || eventTheme.custom;
  const Icon = theme.icon;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant={theme.badge}>{theme.label}</Badge>
            {event.timeLabel ? <span className="text-xs text-gray-500">{event.timeLabel}</span> : null}
          </div>
          <h4 className="mt-2 text-sm font-semibold text-gray-800">{event.title}</h4>
          <p className="mt-1 text-xs text-gray-500">
            {event.classCode === 'ALL' ? 'All Classes' : `Class ${event.classCode}`}
            {event.subtitle ? ` | ${event.subtitle}` : ''}
          </p>
        </div>

        {isAdmin && event.editable ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:border-primary-300 hover:text-primary-700"
              onClick={() => onEdit(event)}
              aria-label={`Edit ${event.title}`}
            >
              <HiOutlinePencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-lg border border-red-200 p-2 text-red-600 hover:border-red-300"
              onClick={() => onDelete(event.id)}
              aria-label={`Delete ${event.title}`}
            >
              <HiOutlineTrash className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="rounded-lg bg-gray-50 p-2">
            <Icon className="h-4 w-4 text-gray-500" />
          </div>
        )}
      </div>

      {event.description ? (
        <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{event.description}</p>
      ) : null}

      {event.attachmentDataUrl ? (
        <a
          href={event.attachmentDataUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex text-sm text-primary-700 hover:underline"
        >
          Open attachment{event.attachmentName ? ` (${event.attachmentName})` : ''}
        </a>
      ) : null}
    </div>
  );
}

function CalendarEventForm({ selectedDate, initialEvent, onSubmit }) {
  const [formData, setFormData] = useState({
    title: initialEvent?.title || '',
    date: initialEvent?.date ? format(initialEvent.date, 'yyyy-MM-dd') : format(selectedDate, 'yyyy-MM-dd'),
    timeLabel: initialEvent?.timeLabel || '',
    classCode: initialEvent?.classCode || 'ALL',
    location: initialEvent?.subtitle || '',
    description: initialEvent?.description || '',
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({
      id: initialEvent?.id || `custom-${Date.now()}`,
      ...formData,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="calendar-title" className="mb-1 block text-sm font-medium text-gray-700">
          Event Title
        </label>
        <input
          id="calendar-title"
          type="text"
          required
          value={formData.title}
          onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="calendar-date" className="mb-1 block text-sm font-medium text-gray-700">
            Date
          </label>
          <input
            id="calendar-date"
            type="date"
            required
            value={formData.date}
            onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label htmlFor="calendar-time" className="mb-1 block text-sm font-medium text-gray-700">
            Time
          </label>
          <input
            id="calendar-time"
            type="time"
            value={formData.timeLabel}
            onChange={(e) => setFormData((prev) => ({ ...prev, timeLabel: e.target.value }))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="calendar-class" className="mb-1 block text-sm font-medium text-gray-700">
            Target Class
          </label>
          <input
            id="calendar-class"
            type="text"
            value={formData.classCode}
            onChange={(e) => setFormData((prev) => ({ ...prev, classCode: e.target.value.toUpperCase() || 'ALL' }))}
            placeholder="ALL or 12A"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label htmlFor="calendar-location" className="mb-1 block text-sm font-medium text-gray-700">
            Location
          </label>
          <input
            id="calendar-location"
            type="text"
            value={formData.location}
            onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div>
        <label htmlFor="calendar-description" className="mb-1 block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="calendar-description"
          rows={4}
          value={formData.description}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit">{initialEvent ? 'Save Event' : 'Add Event'}</Button>
      </div>
    </form>
  );
}

export default function CalendarPage() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  const isAdmin = role === ACCOUNT_ROLES.ADMIN;
  const isStudent = role === ACCOUNT_ROLES.STUDENT;
  const studentClassCode = String(user?.class || '').trim();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [exams, setExams] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [customEvents, setCustomEvents] = useState(() => readCustomEvents());
  const [loading, setLoading] = useState(true);
  const [activeTypes, setActiveTypes] = useState(['exam', 'assignment', 'announcement', 'custom']);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  useEffect(() => {
    let isActive = true;

    const loadData = async () => {
      setLoading(true);

      const localAssignments = readJson(LOCAL_ASSIGNMENTS_KEY, []);
      const localAnnouncements = readJson(LOCAL_EXAM_ANNOUNCEMENTS_KEY, []);

      try {
        const [examResponse, assignmentResponse] = await Promise.allSettled([
          examsAPI.getAll(),
          assignmentsAPI.getAll(),
        ]);

        if (!isActive) return;

        const apiExams = examResponse.status === 'fulfilled' && Array.isArray(examResponse.value?.data)
          ? examResponse.value.data
          : [];

        const apiAssignments = assignmentResponse.status === 'fulfilled' && Array.isArray(assignmentResponse.value?.data)
          ? assignmentResponse.value.data
          : [];

        setExams(apiExams);
        setAssignments(mergeById([...apiAssignments, ...localAssignments]));
        setAnnouncements(localAnnouncements);
      } catch {
        if (!isActive) return;
        setExams([]);
        setAssignments(localAssignments);
        setAnnouncements(localAnnouncements);
      } finally {
        if (isActive) {
          setCustomEvents(readCustomEvents());
          setLoading(false);
        }
      }
    };

    loadData();

    const onStorage = (event) => {
      if (event.key === LOCAL_EXAM_ANNOUNCEMENTS_KEY) {
        setAnnouncements(readJson(LOCAL_EXAM_ANNOUNCEMENTS_KEY, []));
      }
      if (event.key === LOCAL_ASSIGNMENTS_KEY) {
        setAssignments(readJson(LOCAL_ASSIGNMENTS_KEY, []));
      }
      if (event.key === LOCAL_CALENDAR_EVENTS_KEY) {
        setCustomEvents(readCustomEvents());
      }
    };

    window.addEventListener('storage', onStorage);
    return () => {
      isActive = false;
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const allEvents = useMemo(() => {
    const examEvents = exams.map(normalizeExamEvent).filter(Boolean);
    const assignmentEvents = assignments.map(normalizeAssignmentEvent).filter(Boolean);
    const announcementEvents = announcements.map(normalizeAnnouncementEvent).filter(Boolean);

    const combined = [
      ...examEvents,
      ...assignmentEvents,
      ...announcementEvents,
      ...customEvents,
    ];

    const visibleByRole = isStudent && studentClassCode
      ? combined.filter((event) => event.classCode === 'ALL' || event.classCode === studentClassCode)
      : combined;

    return visibleByRole
      .filter((event) => activeTypes.includes(event.type))
      .sort((left, right) => compareAsc(left.date, right.date));
  }, [activeTypes, announcements, assignments, customEvents, exams, isStudent, studentClassCode]);

  const monthStart = startOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const selectedDateEvents = useMemo(
    () => allEvents.filter((event) => isSameDay(event.date, selectedDate)),
    [allEvents, selectedDate]
  );

  const upcomingEvents = useMemo(() => {
    const today = new Date();
    return allEvents
      .filter((event) => compareAsc(event.date, addDays(today, -1)) >= 0)
      .slice(0, 5);
  }, [allEvents]);

  const monthStats = useMemo(() => ({
    total: allEvents.length,
    month: allEvents.filter((event) => isSameMonth(event.date, currentDate)).length,
    today: allEvents.filter((event) => isSameDay(event.date, new Date())).length,
    upcoming: upcomingEvents.length,
  }), [allEvents, currentDate, upcomingEvents.length]);

  const toggleType = (type) => {
    setActiveTypes((prev) =>
      prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]
    );
  };

  const openCreateModal = () => {
    setEditingEvent(null);
    setShowEventModal(true);
  };

  const handleSaveEvent = (payload) => {
    const next = editingEvent
      ? writeCustomEvents(customEvents.map((item) => (item.id === editingEvent.id ? payload : item)))
      : writeCustomEvents([payload, ...customEvents]);

    setCustomEvents(next);
    setShowEventModal(false);
    setEditingEvent(null);
  };

  const handleDeleteEvent = (eventId) => {
    const next = writeCustomEvents(customEvents.filter((item) => String(item.id) !== String(eventId)));
    setCustomEvents(next);
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Calendar</h1>
          <p className="mt-1 text-sm text-gray-500">
            Unified school timeline for exams, assignments, announcements, and key events.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin ? (
            <Button variant="primary" onClick={openCreateModal}>
              Add Event
            </Button>
          ) : null}
          <Button variant="secondary" onClick={handleToday}>Today</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl bg-white p-4 shadow-card">
          <p className="text-sm text-gray-500">All Events</p>
          <p className="mt-1 text-2xl font-bold text-gray-800">{monthStats.total}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-card">
          <p className="text-sm text-gray-500">This Month</p>
          <p className="mt-1 text-2xl font-bold text-primary-600">{monthStats.month}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-card">
          <p className="text-sm text-gray-500">Today</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{monthStats.today}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-card">
          <p className="text-sm text-gray-500">Upcoming</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{monthStats.upcoming}</p>
        </div>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          {Object.keys(eventTheme).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => toggleType(type)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTypes.includes(type)
                  ? 'border-primary-300 bg-primary-50 text-primary-700'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
              }`}
            >
              {eventTheme[type].label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div className="rounded-xl bg-white p-6 shadow-card">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HiOutlineCalendar className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-800">
                {format(currentDate, 'MMMM yyyy')}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                className="rounded-lg p-2 transition-colors hover:bg-gray-100"
                aria-label="Previous month"
              >
                <HiOutlineChevronLeft className="h-4 w-4 text-gray-600" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                className="rounded-lg p-2 transition-colors hover:bg-gray-100"
                aria-label="Next month"
              >
                <HiOutlineChevronRight className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="py-2 text-center text-sm font-medium text-gray-500">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((day) => {
              const dayEvents = allEvents.filter((event) => isSameDay(event.date, day));
              const selected = isSameDay(day, selectedDate);
              const inCurrentMonth = isSameMonth(day, currentDate);
              const today = isToday(day);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setSelectedDate(day)}
                  className={`min-h-[90px] rounded-xl border p-3 text-left transition-all ${
                    selected
                      ? 'border-primary-500 ring-2 ring-primary-100'
                      : 'border-gray-100 hover:border-gray-200'
                  } ${inCurrentMonth ? 'bg-white' : 'bg-gray-50'} ${today ? 'shadow-sm' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${
                      selected
                        ? 'text-primary-700'
                        : today
                          ? 'text-emerald-700'
                          : inCurrentMonth
                            ? 'text-gray-700'
                            : 'text-gray-400'
                    }`}>
                      {format(day, 'd')}
                    </span>
                    {today ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        Today
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 space-y-1">
                    {dayEvents.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        className="truncate rounded-md px-2 py-1 text-[11px] font-medium text-white"
                        style={{ backgroundColor: eventTheme[event.type]?.dot || eventTheme.custom.dot }}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 ? (
                      <p className="text-[11px] text-gray-500">+{dayEvents.length - 2} more</p>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl bg-white p-6 shadow-card">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-gray-800">
                  {format(selectedDate, 'MMMM d, yyyy')}
                </h3>
                <p className="text-xs text-gray-500">
                  {selectedDateEvents.length} event{selectedDateEvents.length === 1 ? '' : 's'} scheduled
                </p>
              </div>

              {isAdmin ? (
                <Button size="sm" onClick={openCreateModal}>Add</Button>
              ) : null}
            </div>

            {loading ? (
              <p className="text-sm text-gray-500">Loading calendar...</p>
            ) : selectedDateEvents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
                <p className="text-sm text-gray-500">No events scheduled for this date.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDateEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    isAdmin={isAdmin}
                    onEdit={(item) => {
                      setEditingEvent(item);
                      setShowEventModal(true);
                    }}
                    onDelete={handleDeleteEvent}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl bg-white p-6 shadow-card">
            <h3 className="mb-4 font-semibold text-gray-800">Upcoming</h3>

            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-gray-500">No upcoming events available.</p>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((event) => {
                  const theme = eventTheme[event.type] || eventTheme.custom;
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => {
                        setSelectedDate(event.date);
                        setCurrentDate(event.date);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl border border-gray-100 p-3 text-left transition-colors hover:border-gray-200 hover:bg-gray-50"
                    >
                      <div
                        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-white"
                        style={{ backgroundColor: theme.dot }}
                      >
                        <span className="text-xs font-bold">{format(event.date, 'dd')}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-800">{event.title}</p>
                        <p className="text-xs text-gray-500">
                          {format(event.date, 'EEE, MMM d')}
                          {event.classCode ? ` | ${event.classCode === 'ALL' ? 'All Classes' : event.classCode}` : ''}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={showEventModal}
        onClose={() => {
          setShowEventModal(false);
          setEditingEvent(null);
        }}
        title={editingEvent ? 'Edit Calendar Event' : 'Add Calendar Event'}
      >
        <CalendarEventForm
          key={editingEvent?.id || format(selectedDate, 'yyyy-MM-dd')}
          selectedDate={selectedDate}
          initialEvent={editingEvent}
          onSubmit={handleSaveEvent}
        />
      </Modal>
    </div>
  );
}
