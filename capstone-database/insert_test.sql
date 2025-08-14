-- สร้าง role ตัวอย่าง
INSERT INTO roles (role_name, description) VALUES
('buyer', 'Default role for all users who can purchase products'),
('seller', 'Role for users who can sell products'),
('admin', 'System administrator with full permissions')
ON CONFLICT (role_name) DO NOTHING;

-- เพิ่ม user ตัวอย่าง
INSERT INTO users (ms_id, email, display_name, profile_url, last_login)
VALUES
('ms_001', 'student1@kmutt.ac.th', 'Student One', 'https://example.com/profile1.jpg', now()),
('ms_002', 'student2@kmutt.ac.th', 'Student Two', 'https://example.com/profile2.jpg', now()),
('ms_003', 'student3@kmutt.ac.th', 'Student Three', NULL, now())
ON CONFLICT (ms_id) DO NOTHING;

-- ผูก role ให้ user
-- ตัวอย่าง: student1 = buyer, seller / student2 = buyer / student3 = buyer, admin
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.role_name = 'buyer'
WHERE u.ms_id IN ('ms_001', 'ms_002', 'ms_003')
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.role_name = 'seller'
WHERE u.ms_id = 'ms_001'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.role_name = 'admin'
WHERE u.ms_id = 'ms_003'
ON CONFLICT DO NOTHING;

-- ตรวจสอบข้อมูล
SELECT * FROM users;
SELECT * FROM roles;
SELECT * FROM user_roles;
