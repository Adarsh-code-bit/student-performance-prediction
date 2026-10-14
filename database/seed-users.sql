-- =============================================================
-- Phase 9: Demo Users
-- =============================================================
USE smart_inventory;

-- Passwords are all set to 'password123'
-- Hashed using bcrypt (10 rounds)

INSERT INTO `user` (user_name, email, password_hash, role) VALUES 
('Admin User', 'admin@example.com', '$2b$10$/ndoEu2g8cQYWx63JIuxIO9RidM07FDeQCXqKscKRUdhF82SEAgJa', 'admin'),
('Manager User', 'manager@example.com', '$2b$10$/ndoEu2g8cQYWx63JIuxIO9RidM07FDeQCXqKscKRUdhF82SEAgJa', 'manager'),
('Staff User', 'staff@example.com', '$2b$10$/ndoEu2g8cQYWx63JIuxIO9RidM07FDeQCXqKscKRUdhF82SEAgJa', 'staff');
