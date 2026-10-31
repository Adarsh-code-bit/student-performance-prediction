-- =============================================================
-- Migration: Add OTP Consumption Tracking (v4.1)
-- Quick Commerce Smart Inventory Management System
-- =============================================================
-- NON-DESTRUCTIVE:
--   - Adds `consumed_at` timestamp column to `user_otp` table
--   - Allows distinguishing between OTP verification and challenge consumption
--   - Prevents OTP verification reuse / replay across multiple accounts
-- =============================================================
-- USE smart_inventory; -- Connect directly to target database (e.g. defaultdb) or specify in client connection

SET @col_consumed = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_otp' AND COLUMN_NAME = 'consumed_at');
SET @sql_consumed = IF(@col_consumed = 0, 
  'ALTER TABLE user_otp ADD COLUMN consumed_at TIMESTAMP NULL DEFAULT NULL AFTER is_used', 
  'SELECT 1');
PREPARE stmt FROM @sql_consumed; EXECUTE stmt; DEALLOCATE PREPARE stmt;

