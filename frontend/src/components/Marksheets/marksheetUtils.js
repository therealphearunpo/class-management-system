export const LOCAL_MARKSHEETS_KEY = 'marksheets_local_v2';
export const LOCAL_STUDENTS_KEY = 'students_local_v2';
export const SUBJECTS = ['math', 'science', 'english', 'history', 'computer'];

export function safeReadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage errors.
  }
}

export function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function normalizeStudent(student) {
  return {
    ...student,
  };
}

export function uniqueStudents(students) {
  const seen = new Set();

  return (Array.isArray(students) ? students : []).filter((student) => {
    const normalized = normalizeStudent(student);
    const key = normalized.id != null
      ? `id:${String(normalized.id)}`
      : [
        normalized.name,
        normalized.class,
        normalized.rollNo,
      ].map((value) => String(value ?? '').trim()).join('|');

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeScoreMap(payload) {
  if (!payload) return {};

  if (Array.isArray(payload)) {
    return payload.reduce((acc, item) => {
      const studentId = item?.studentId ?? item?.id;
      if (studentId == null) return acc;
      acc[String(studentId)] = SUBJECTS.reduce((scores, subject) => {
        if (item?.scores && typeof item.scores === 'object') {
          scores[subject] = clampScore(item.scores[subject]);
        } else {
          scores[subject] = clampScore(item?.[subject]);
        }
        return scores;
      }, {});
      return acc;
    }, {});
  }

  if (typeof payload === 'object') {
    return Object.entries(payload).reduce((acc, [studentId, value]) => {
      acc[String(studentId)] = SUBJECTS.reduce((scores, subject) => {
        if (value && typeof value === 'object' && value.scores && typeof value.scores === 'object') {
          scores[subject] = clampScore(value.scores[subject]);
        } else {
          scores[subject] = clampScore(value?.[subject]);
        }
        return scores;
      }, {});
      return acc;
    }, {});
  }

  return {};
}

export function getGradeFromAverage(avg) {
  if (avg >= 90) return 'A';
  if (avg >= 80) return 'B';
  if (avg >= 70) return 'C';
  if (avg >= 60) return 'D';
  return 'F';
}
