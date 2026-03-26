import { generateAvatarByGender, normalizeGender } from './avatar';

const STUDENT_ID_PREFIX = 'CMS';
const STUDENT_ID_BASE = 100000;

export const parseStudentIdNumber = (studentId) => {
  if (typeof studentId !== 'string') return null;
  const match = studentId.match(/^CMS(\d+)$/);
  return match ? Number(match[1]) : null;
};

export const formatStudentId = (num) => `${STUDENT_ID_PREFIX}${String(num)}`;

export const makeStudentEmail = (name, classCode) => {
  const slug = String(name || 'student')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/(^\.|\.$)/g, '');
  const classSuffix = String(classCode || 'class').toLowerCase();
  return slug && classSuffix ? `${slug}.${classSuffix}@school.edu` : '';
};

export const normalizeDateOfBirth = (value, _seedValue = 1) => {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const valid = year >= 1990 && year <= 2020 && month >= 1 && month <= 12 && day >= 1 && day <= 31;
  return valid ? `${match[1]}-${match[2]}-${match[3]}` : '';
};

export const getLastName = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'student';
  return parts[parts.length - 1].toLowerCase();
};

export const dateOfBirthToCompact = (dateOfBirth) => {
  const normalized = normalizeDateOfBirth(dateOfBirth);
  if (!normalized) return '';
  const parts = normalized.split('-');
  return `${parts[2]}${parts[1]}${parts[0]}`; // DDMMYYYY
};

export const buildStudentPassword = (student) => {
  const lastName = getLastName(student?.name);
  const dobCompact = dateOfBirthToCompact(student?.dateOfBirth);
  if (!dobCompact) return '';
  return `${lastName}${dobCompact}`;
};

export const normalizeStudentIds = (items) => {
  const existingNumbers = items
    .map((student) => parseStudentIdNumber(student.studentId))
    .filter((n) => Number.isFinite(n));

  let nextNumber = Math.max(STUDENT_ID_BASE + 1, ...existingNumbers, 0);

  return items.map((student) => {
    const currentNumber = parseStudentIdNumber(student.studentId);
    if (currentNumber) return student;
    const withId = { ...student, studentId: formatStudentId(nextNumber) };
    nextNumber += 1;
    return withId;
  });
};

export const normalizeStudentAccount = (student, seedValue = 1) => {
  const dateOfBirth = normalizeDateOfBirth(student?.dateOfBirth, seedValue);
  const gender = normalizeGender(student?.gender, seedValue % 2 === 0 ? 'male' : 'female');
  const avatarSeed = student?.email || student?.name || student?.studentId || `student-${seedValue}`;
  return {
    ...student,
    shift: student?.shift || '',
    gender,
    dateOfBirth,
    email: student?.email || '',
    avatar: student?.avatar || generateAvatarByGender(avatarSeed, gender),
  };
};
