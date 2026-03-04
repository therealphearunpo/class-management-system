CREATE DATABASE IF NOT EXISTS class_management;
USE class_management;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'teacher', 'student') NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  gender ENUM('male', 'female') NOT NULL DEFAULT 'male',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_code VARCHAR(50) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  class_name VARCHAR(20) NOT NULL,
  section VARCHAR(5) NOT NULL,
  gender ENUM('male', 'female') NOT NULL DEFAULT 'male',
  dob DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teachers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  employee_code VARCHAR(50) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  gender ENUM('male', 'female') NOT NULL DEFAULT 'male',
  department VARCHAR(80) NOT NULL,
  subject_name VARCHAR(80) NOT NULL,
  phone VARCHAR(40) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_teachers_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  audience VARCHAR(120) NOT NULL,
  channel ENUM('SMS', 'Email', 'Announcement') NOT NULL DEFAULT 'Announcement',
  subject VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  status ENUM('draft', 'sent') NOT NULL DEFAULT 'sent',
  attachment_name VARCHAR(180) NULL,
  attachment_url VARCHAR(800) NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_messages_created_at (created_at),
  CONSTRAINT fk_messages_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  attendance_date DATE NOT NULL,
  record_type ENUM('student', 'teacher') NOT NULL,
  target_id VARCHAR(64) NOT NULL,
  class_name VARCHAR(40) NULL,
  shift_name VARCHAR(40) NULL,
  subject_key VARCHAR(60) NULL,
  status ENUM('present', 'absent', 'late') NOT NULL,
  marked_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_attendance_scope (
    attendance_date,
    record_type,
    target_id,
    class_name,
    shift_name,
    subject_key
  ),
  INDEX idx_attendance_lookup (record_type, attendance_date),
  CONSTRAINT fk_attendance_marked_by
    FOREIGN KEY (marked_by) REFERENCES users(id)
    ON DELETE SET NULL
);
