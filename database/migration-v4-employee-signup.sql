-- =============================================================
-- Migration: Employee Signup & Approval Workflow (v4)
-- Quick Commerce Smart Inventory Management System
-- =============================================================
-- NON-DESTRUCTIVE:
--   - Adds employee metadata columns to `user` table with safe defaults
--   - Preserves all existing user records and credentials
--   - Backfills existing users with employee IDs and APPROVED status
--   - Creates `user_otp` table for secure, rate-limited mobile verification
-- =============================================================
-- USE smart_inventory; -- Connect directly to target database (e.g. defaultdb) or specify in client connection

-- 1. ADD PHONE NUMBER IF MISSING
SET @col_phone = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'phone');
SET @sql_phone = IF(@col_phone = 0, 
  'ALTER TABLE `user` ADD COLUMN phone VARCHAR(20) NULL AFTER email, ADD INDEX idx_user_phone (phone)', 
  'SELECT 1');
PREPARE stmt FROM @sql_phone; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. ADD EMPLOYMENT TYPE IF MISSING
SET @col_emptype = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'employment_type');
SET @sql_emptype = IF(@col_emptype = 0, 
  'ALTER TABLE `user` ADD COLUMN employment_type ENUM(\'FULL_TIME\', \'PART_TIME\') NOT NULL DEFAULT \'FULL_TIME\' AFTER phone', 
  'SELECT 1');
PREPARE stmt FROM @sql_emptype; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. ADD DEPARTMENT IF MISSING
SET @col_dept = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'department');
SET @sql_dept = IF(@col_dept = 0, 
  'ALTER TABLE `user` ADD COLUMN department VARCHAR(100) NULL DEFAULT \'Warehouse Operations\' AFTER employment_type', 
  'SELECT 1');
PREPARE stmt FROM @sql_dept; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4. ADD EMPLOYEE ID IF MISSING
SET @col_empid = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'employee_id');
SET @sql_empid = IF(@col_empid = 0, 
  'ALTER TABLE `user` ADD COLUMN employee_id VARCHAR(30) NULL AFTER user_name, ADD UNIQUE INDEX uq_user_employee_id (employee_id)', 
  'SELECT 1');
PREPARE stmt FROM @sql_empid; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 5. ADD APPROVAL STATUS LIFECYCLE IF MISSING
SET @col_appr = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'approval_status');
SET @sql_appr = IF(@col_appr = 0, 
  'ALTER TABLE `user` ADD COLUMN approval_status ENUM(\'PENDING_APPROVAL\', \'APPROVED\', \'REJECTED\') NOT NULL DEFAULT \'APPROVED\' AFTER is_active, ADD INDEX idx_user_approval_status (approval_status)', 
  'SELECT 1');
PREPARE stmt FROM @sql_appr; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6. ADD APPROVED_BY AUDIT REFERENCE IF MISSING
SET @col_apprby = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'approved_by');
SET @sql_apprby = IF(@col_apprby = 0, 
  'ALTER TABLE `user` ADD COLUMN approved_by INT NULL AFTER approval_status, ADD CONSTRAINT fk_user_approved_by FOREIGN KEY (approved_by) REFERENCES `user`(user_id) ON DELETE SET NULL', 
  'SELECT 1');
PREPARE stmt FROM @sql_apprby; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 7. ADD APPROVED_AT TIMESTAMP IF MISSING
SET @col_apprat = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'approved_at');
SET @sql_apprat = IF(@col_apprat = 0, 
  'ALTER TABLE `user` ADD COLUMN approved_at TIMESTAMP NULL AFTER approved_by', 
  'SELECT 1');
PREPARE stmt FROM @sql_apprat; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 8. ADD REJECTION REASON IF MISSING
SET @col_rej = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'rejection_reason');
SET @sql_rej = IF(@col_rej = 0, 
  'ALTER TABLE `user` ADD COLUMN rejection_reason TEXT NULL AFTER approved_at', 
  'SELECT 1');
PREPARE stmt FROM @sql_rej; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 9. ADD MOBILE VERIFICATION STATUS IF MISSING
SET @col_mobver = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'is_mobile_verified');
SET @sql_mobver = IF(@col_mobver = 0, 
  'ALTER TABLE `user` ADD COLUMN is_mobile_verified BOOLEAN NOT NULL DEFAULT FALSE AFTER rejection_reason', 
  'SELECT 1');
PREPARE stmt FROM @sql_mobver; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 10. ADD MOBILE VERIFIED TIMESTAMP IF MISSING
SET @col_mobverat = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'mobile_verified_at');
SET @sql_mobverat = IF(@col_mobverat = 0, 
  'ALTER TABLE `user` ADD COLUMN mobile_verified_at TIMESTAMP NULL AFTER is_mobile_verified', 
  'SELECT 1');
PREPARE stmt FROM @sql_mobverat; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 11. CREATE USER_OTP TABLE FOR MOBILE VERIFICATION
CREATE TABLE IF NOT EXISTS user_otp (
    otp_id       INT AUTO_INCREMENT PRIMARY KEY,
    phone        VARCHAR(20)   NOT NULL,
    otp_hash     VARCHAR(255)  NOT NULL,
    purpose      ENUM('REGISTRATION', 'LOGIN', 'PASSWORD_RESET') NOT NULL DEFAULT 'REGISTRATION',
    attempts     INT           NOT NULL DEFAULT 0,
    max_attempts INT           NOT NULL DEFAULT 5,
    expires_at   TIMESTAMP     NOT NULL,
    is_used      BOOLEAN       NOT NULL DEFAULT FALSE,
    consumed_at  TIMESTAMP     NULL DEFAULT NULL,
    created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_otp_phone_purpose (phone, purpose),
    INDEX idx_otp_expires (expires_at)
) ENGINE=InnoDB;

-- 12. BACKFILL EXISTING LEGACY USERS (PRESERVE ACCESS & SAFE UNVERIFIED DEFAULT)
-- Explicitly preserves existing passwords, roles, and active account status (approval_status = 'APPROVED').
-- Does NOT falsely assert mobile verification without OTP evidence: is_mobile_verified = FALSE, mobile_verified_at = NULL.
UPDATE `user` SET 
  employee_id = CONCAT('EMP-', LPAD(user_id, 4, '0')),
  phone = NULL,
  is_mobile_verified = FALSE,
  mobile_verified_at = NULL,
  approval_status = 'APPROVED'
WHERE employee_id IS NULL;

