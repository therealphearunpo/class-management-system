export const gradeLevels = [7, 8, 9, 10, 11, 12];
const classSections = ['A', 'B', 'C', 'D', 'E', 'F'];
const SHIFT_BOTH = 'Both';
const studyShifts = [SHIFT_BOTH];

const classCodes = gradeLevels.flatMap((grade) =>
  classSections.map((section) => `${grade}${section}`)
);

export const DEFAULT_CLASS_CODE = classCodes[0];
export const DEFAULT_SECTION = 'A';
export const DEFAULT_SHIFT = SHIFT_BOTH;

export const normalizeShift = () => SHIFT_BOTH;
export const studentsData = [];

export const classOptions = [
  { value: '', label: 'Select Class' },
  ...classCodes.map((code) => ({ value: code, label: code })),
];

export const subjectOptions = [
  { value: '', label: 'Select Subject' },
  { value: 'khmer', label: 'Khmer Language & Literature' },
  { value: 'mathematics', label: 'Mathematics' },
  { value: 'physics', label: 'Physics' },
  { value: 'chemistry', label: 'Chemistry' },
  { value: 'biology', label: 'Biology' },
  { value: 'earth-science', label: 'Earth & Environmental Science' },
  { value: 'english', label: 'English' },
  { value: 'french', label: 'French' },
  { value: 'history', label: 'History' },
  { value: 'geography', label: 'Geography' },
  { value: 'moral-civics', label: 'Civics and Morality' },
  { value: 'social-studies', label: 'Social Studies' },
  { value: 'foreign-language', label: 'Foreign Language' },
  { value: 'computer', label: 'Digital Literacy / ICT' },
  { value: 'physical-education', label: 'Physical Education & Sports' },
  { value: 'life-skills-ict', label: 'Life Skills and Career Orientation' },
];

export const DEFAULT_SUBJECT_VALUE = 'mathematics';
export const DEFAULT_SUBJECT_LABEL =
  subjectOptions.find((item) => item.value === DEFAULT_SUBJECT_VALUE)?.label || 'Mathematics';

export const shiftOptions = [
  { value: '', label: 'Select Shift' },
  ...studyShifts.map((shift) => ({ value: shift, label: 'Both Shifts (Morning + Afternoon)' })),
];

export const sectionOptions = [
  { value: '', label: 'Select Section' },
  { value: 'A', label: 'Section A' },
  { value: 'B', label: 'Section B' },
  { value: 'C', label: 'Section C' },
  { value: 'D', label: 'Section D' },
  { value: 'E', label: 'Section E' },
  { value: 'F', label: 'Section F' },
];
