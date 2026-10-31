-- =============================================================
-- Rollback Migration: Employee Signup & Approval Workflow (v4)
-- Quick Commerce Smart Inventory Management System
-- =============================================================
-- Completely reverses migration-v4-employee-signup.sql
-- =============================================================
-- USE smart_inventory; -- Connect directly to target database (e.g. defaultdb) or specify in client connection

-- 1. Drop foreign key constraint on approved_by if exists
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND CONSTRAINT_NAME = 'fk_user_approved_by');
SET @sql_fk = IF(@fk_exists > 0, 'ALTER TABLE `user` DROP FOREIGN KEY fk_user_approved_by', 'SELECT 1');
PREPARE stmt FROM @sql_fk; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Drop unique index on employee_id if exists
SET @idx_empid = (SELECT COUNT(*) FROM information_schema.STATISTICS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND INDEX_NAME = 'uq_user_employee_id');
SET @sql_idx = IF(@idx_empid > 0, 'ALTER TABLE `user` DROP INDEX uq_user_employee_id', 'SELECT 1');
PREPARE stmt FROM @sql_idx; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Drop index on phone if exists
SET @idx_phone = (SELECT COUNT(*) FROM information_schema.STATISTICS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND INDEX_NAME = 'idx_user_phone');
SET @sql_idx_phone = IF(@idx_phone > 0, 'ALTER TABLE `user` DROP INDEX idx_user_phone', 'SELECT 1');
PREPARE stmt FROM @sql_idx_phone; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4. Drop index on approval_status if exists
SET @idx_appr = (SELECT COUNT(*) FROM information_schema.STATISTICS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND INDEX_NAME = 'idx_user_approval_status');
SET @sql_idx_appr = IF(@idx_appr > 0, 'ALTER TABLE `user` DROP INDEX idx_user_approval_status', 'SELECT 1');
PREPARE stmt FROM @sql_idx_appr; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 5. Drop added columns from `user` table
SET @col_phone = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'phone');
SET @sql_drop_phone = IF(@col_phone > 0, 'ALTER TABLE `user` DROP COLUMN phone', 'SELECT 1');
PREPARE stmt FROM @sql_drop_phone; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_emp = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'employee_id');
SET @sql_drop_emp = IF(@col_emp > 0, 'ALTER TABLE `user` DROP COLUMN employee_id', 'SELECT 1');
PREPARE stmt FROM @sql_drop_emp; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_emptype = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'employment_type');
SET @sql_drop_emptype = IF(@col_emptype > 0, 'ALTER TABLE `user` DROP COLUMN employment_type', 'SELECT 1');
PREPARE stmt FROM @sql_drop_emptype; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_dept = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'department');
SET @sql_drop_dept = IF(@col_dept > 0, 'ALTER TABLE `user` DROP COLUMN department', 'SELECT 1');
PREPARE stmt FROM @sql_drop_dept; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_appr = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'approval_status');
SET @sql_drop_appr = IF(@col_appr > 0, 'ALTER TABLE `user` DROP COLUMN approval_status', 'SELECT 1');
PREPARE stmt FROM @sql_drop_appr; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_apprby = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'approved_by');
SET @sql_drop_apprby = IF(@col_apprby > 0, 'ALTER TABLE `user` DROP COLUMN approved_by', 'SELECT 1');
PREPARE stmt FROM @sql_drop_apprby; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_apprat = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'approved_at');
SET @sql_drop_apprat = IF(@col_apprat > 0, 'ALTER TABLE `user` DROP COLUMN approved_at', 'SELECT 1');
PREPARE stmt FROM @sql_drop_apprat; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_rej = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'rejection_reason');
SET @sql_drop_rej = IF(@col_rej > 0, 'ALTER TABLE `user` DROP COLUMN rejection_reason', 'SELECT 1');
PREPARE stmt FROM @sql_drop_rej; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_mob = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'is_mobile_verified');
SET @sql_drop_mob = IF(@col_mob > 0, 'ALTER TABLE `user` DROP COLUMN is_mobile_verified', 'SELECT 1');
PREPARE stmt FROM @sql_drop_mob; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_mobat = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'mobile_verified_at');
SET @sql_drop_mobat = IF(@col_mobat > 0, 'ALTER TABLE `user` DROP COLUMN mobile_verified_at', 'SELECT 1');
PREPARE stmt FROM @sql_drop_mobat; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6. Drop user_otp table
DROP TABLE IF EXISTS user_otp;
