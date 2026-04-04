import { subjectOptions } from './students';
import { generateAvatarByGender, normalizeGender } from '../utils/avatar';

export const LOCAL_TEACHERS_KEY = 'teachers_local_v1';

const streams = ['Science', 'Social'];

const LEGACY_STREAM_MAP = {
  'Academic Affairs': 'Social',
  'Science Department': 'Science',
  'Social Studies Department': 'Social',
  'Language Department': 'Social',
  'ICT Department': 'Science',
  'Physical Education Department': 'Social',
  Science: 'Science',
  Social: 'Social',
};

export const DEPARTMENT_SUBJECTS = {
  Science: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Earth & Environmental Science', 'Digital Literacy / ICT'],
  Social: ['History', 'Geography', 'Social Studies', 'Civics and Morality', 'Khmer Language & Literature', 'English', 'French', 'Life Skills and Career Orientation', 'Physical Education & Sports'],
};
const fallbackSubjects = subjectOptions
  .filter((item) => item.value)
  .map((item) => item.label);

const avatarFor = (seed, gender) => generateAvatarByGender(`teacher-${seed}`, gender);
export const teachersData = [];

function toSlug(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getDepartmentSubjectOptions(department) {
  const scoped = DEPARTMENT_SUBJECTS[normalizeTeacherStream(department)] || fallbackSubjects;
  return scoped.map((subject) => ({ value: subject, label: subject }));
}

export function normalizeTeacherStream(value) {
  return LEGACY_STREAM_MAP[String(value || '').trim()] || streams[0];
}

export function normalizeTeacherItem(item, index = 0) {
  const name = String(item?.name || item?.fullName || '').trim() || `Staff ${index + 1}`;
  const stream = normalizeTeacherStream(item?.stream || item?.department || item?.class);
  const subjectPool = DEPARTMENT_SUBJECTS[stream] || fallbackSubjects;
  const requestedSubject = item?.subject || item?.subjectName;
  const subject = subjectPool.includes(requestedSubject) ? requestedSubject : subjectPool[0];
  const baseId = item?.id || `teacher-${toSlug(name) || index + 1}`;
  const employeeId = String(item?.employeeId || item?.employeeCode || `T${String(index + 1).padStart(4, '0')}`);
  const gender = normalizeGender(item?.gender || item?.profileGender, index % 2 === 0 ? 'male' : 'female');
  return {
    id: baseId,
    employeeId,
    name,
    gender,
    class: stream,
    stream,
    subject,
    shift: 'Staff',
    email: item?.email || '',
    isActive: item?.isActive !== false,
    avatar: item?.avatar || avatarFor(baseId, gender),
  };
}

export function loadTeachers() {
  try {
    const raw = localStorage.getItem(LOCAL_TEACHERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [];
    const looksLikeLegacyDemoOnly =
      parsed.length > 0 &&
      parsed.every((item, index) =>
        String(item?.id || '') === `teacher-${index + 1}` &&
        String(item?.employeeId || '') === `T${String(index + 1).padStart(4, '0')}`
      );
    if (looksLikeLegacyDemoOnly) return [];
    return parsed.map((item, index) => normalizeTeacherItem(item, index));
  } catch {
    return [];
  }
}

export function saveTeachers(items) {
  const normalized = (Array.isArray(items) ? items : [])
    .map((item, index) => normalizeTeacherItem(item, index));
  localStorage.setItem(LOCAL_TEACHERS_KEY, JSON.stringify(normalized));
  return normalized;
}

export const teacherDepartmentOptions = [
  { value: '', label: 'All Streams' },
  ...streams.map((stream) => ({
    value: stream,
    label: stream,
  })),
];

export const teacherSubjectOptions = [
  { value: '', label: 'All Subjects' },
  ...Array.from(new Set(Object.values(DEPARTMENT_SUBJECTS).flat())).map((subject) => ({
    value: subject,
    label: subject,
  })),
];
