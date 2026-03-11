USE class_management;

INSERT INTO users (email, password_hash, role, full_name, gender) VALUES
('admin.center@school.local', '$2a$10$v04ngmx4sz6PZ.F/hKr3gudZnQaspzu4qE4mbQZWrvH3plrMqgGJC', 'admin', 'Admin Center', 'male'),
('nim.cheyseth.2824@rupp.edu.kh', '$2a$10$v04ngmx4sz6PZ.F/hKr3gudZnQaspzu4qE4mbQZWrvH3plrMqgGJC', 'admin', 'Admin Center 1', 'male'),
('thet.englang.2824@rupp.edu.kh', '$2a$10$v04ngmx4sz6PZ.F/hKr3gudZnQaspzu4qE4mbQZWrvH3plrMqgGJC', 'admin', 'Admin Center 2', 'female'),
('po.phearun.2824@rupp.edu.kh', '$2a$10$v04ngmx4sz6PZ.F/hKr3gudZnQaspzu4qE4mbQZWrvH3plrMqgGJC', 'admin', 'Admin Center 3', 'male')
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  role = VALUES(role),
  full_name = VALUES(full_name),
  gender = VALUES(gender);
