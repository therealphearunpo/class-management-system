import { subjectOptions } from './students';
import { generateAvatarByGender, normalizeGender } from '../utils/avatar';

export const LOCAL_TEACHERS_KEY = 'teachers_local_v1';

const departments = [
  'Academic Affairs',
  'Science Department',
  'Social Studies Department',
  'Language Department',
  'ICT Department',
  'Physical Education Department',
];

export const DEPARTMENT_SUBJECTS = {
  'Academic Affairs': ['Life Skills and Career Orientation', 'Digital Literacy / ICT'],
  'Science Department': ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Earth & Environmental Science'],
  'Social Studies Department': ['History', 'Geography', 'Social Studies', 'Civics and Morality'],
  'Language Department': ['Khmer Language & Literature', 'English', 'French'],
  'ICT Department': ['Digital Literacy / ICT', 'Life Skills and Career Orientation'],
  'Physical Education Department': ['Physical Education & Sports'],
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
  const scoped = DEPARTMENT_SUBJECTS[department] || fallbackSubjects;
  return scoped.map((subject) => ({ value: subject, label: subject }));
}

export function normalizeTeacherItem(item, index = 0) {
  const name = String(item?.name || '').trim() || `Staff ${index + 1}`;
  const department = departments.includes(item?.class) ? item.class : departments[0];
  const subjectPool = DEPARTMENT_SUBJECTS[department] || fallbackSubjects;
  const subject = subjectPool.includes(item?.subject) ? item.subject : subjectPool[0];
  const baseId = item?.id || `teacher-${toSlug(name) || index + 1}`;
  const employeeId = String(item?.employeeId || `T${String(index + 1).padStart(4, '0')}`);
  const gender = normalizeGender(item?.gender, index % 2 === 0 ? 'male' : 'female');
  return {
    id: baseId,
    employeeId,
    name,
    gender,
    class: department,
    subject,
    shift: 'Staff',
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
  { value: '', label: 'All Departments' },
  ...departments.map((department) => ({
    value: department,
    label: department,
  })),
];

export const teacherSubjectOptions = [
  { value: '', label: 'All Subjects' },
  ...Array.from(new Set(Object.values(DEPARTMENT_SUBJECTS).flat())).map((subject) => ({
    value: subject,
    label: subject,
  })),
];
