USE class_management;

INSERT INTO users (email, password_hash, role, full_name, gender) VALUES
('admin.center@school.local', '$2a$10$PFvgzfsoljZfN1OY7Gny1.R6TIGEDn1Xq9xgTsTMKvSdiBNgA9Ile', 'admin', 'Admin Center', 'male'),
('nim.cheyseth.2824@rupp.edu.kh', '$2a$10$PFvgzfsoljZfN1OY7Gny1.R6TIGEDn1Xq9xgTsTMKvSdiBNgA9Ile', 'admin', 'Admin Center 1', 'male'),
('thet.englang.2824@rupp.edu.kh', '$2a$10$PFvgzfsoljZfN1OY7Gny1.R6TIGEDn1Xq9xgTsTMKvSdiBNgA9Ile', 'admin', 'Admin Center 2', 'female'),
('po.phearun.2824@rupp.edu.kh', '$2a$10$PFvgzfsoljZfN1OY7Gny1.R6TIGEDn1Xq9xgTsTMKvSdiBNgA9Ile', 'admin', 'Admin Center 3', 'male'),
('teacher.math@school.local', '$2a$10$PFvgzfsoljZfN1OY7Gny1.R6TIGEDn1Xq9xgTsTMKvSdiBNgA9Ile', 'teacher', 'Math Teacher', 'male'),
('teacher.english@school.local', '$2a$10$PFvgzfsoljZfN1OY7Gny1.R6TIGEDn1Xq9xgTsTMKvSdiBNgA9Ile', 'teacher', 'English Teacher', 'female'),
('teacher.physics@school.local', '$2a$10$PFvgzfsoljZfN1OY7Gny1.R6TIGEDn1Xq9xgTsTMKvSdiBNgA9Ile', 'teacher', 'Physics Teacher', 'male'),
('admin.teacher@school.local', '$2a$10$PFvgzfsoljZfN1OY7Gny1.R6TIGEDn1Xq9xgTsTMKvSdiBNgA9Ile', 'teacher', 'Admin Teacher Account', 'male'),
('student.12a@school.local', '$2a$10$PFvgzfsoljZfN1OY7Gny1.R6TIGEDn1Xq9xgTsTMKvSdiBNgA9Ile', 'student', 'Student 12A', 'female')
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  role = VALUES(role),
  full_name = VALUES(full_name),
  gender = VALUES(gender);

INSERT INTO teachers (user_id, employee_code, full_name, gender, department, subject_name, phone, is_active)
SELECT u.id, 'T0001', 'Math Teacher', 'male', 'Science Department', 'Mathematics', NULL, 1
FROM users u WHERE u.email = 'teacher.math@school.local'
ON DUPLICATE KEY UPDATE
  full_name = VALUES(full_name),
  gender = VALUES(gender),
  department = VALUES(department),
  subject_name = VALUES(subject_name),
  is_active = VALUES(is_active);

INSERT INTO teachers (user_id, employee_code, full_name, gender, department, subject_name, phone, is_active)
SELECT u.id, 'T0002', 'English Teacher', 'female', 'Language Department', 'English', NULL, 1
FROM users u WHERE u.email = 'teacher.english@school.local'
ON DUPLICATE KEY UPDATE
  full_name = VALUES(full_name),
  gender = VALUES(gender),
  department = VALUES(department),
  subject_name = VALUES(subject_name),
  is_active = VALUES(is_active);

INSERT INTO teachers (user_id, employee_code, full_name, gender, department, subject_name, phone, is_active)
SELECT u.id, 'T0003', 'Physics Teacher', 'male', 'Science Department', 'Physics', NULL, 1
FROM users u WHERE u.email = 'teacher.physics@school.local'
ON DUPLICATE KEY UPDATE
  full_name = VALUES(full_name),
  gender = VALUES(gender),
  department = VALUES(department),
  subject_name = VALUES(subject_name),
  is_active = VALUES(is_active);

INSERT INTO teachers (user_id, employee_code, full_name, gender, department, subject_name, phone, is_active)
SELECT u.id, 'T0099', 'Admin Teacher Account', 'male', 'Academic Affairs', 'Life Skills and Career Orientation', NULL, 1
FROM users u WHERE u.email = 'admin.teacher@school.local'
ON DUPLICATE KEY UPDATE
  full_name = VALUES(full_name),
  gender = VALUES(gender),
  department = VALUES(department),
  subject_name = VALUES(subject_name),
  is_active = VALUES(is_active);
