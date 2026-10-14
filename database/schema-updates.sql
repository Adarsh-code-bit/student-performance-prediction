-- UNSAFE / MANUAL REVIEW REQUIRED: this historical script drops location columns. Do not execute as a migration. See docs/database-safety.md.
-- =============================================================
-- Smart Inventory Management System - Phase 5, 6, 7 Updates
-- Schema Migration Script
-- =============================================================

USE smart_inventory;

-- 1. Update Location Table
-- Dropping old columns not needed and adding new ones for Phase 5.
ALTER TABLE location
DROP COLUMN IF EXISTS location_type,
DROP COLUMN IF EXISTS address,
DROP COLUMN IF EXISTS city,
DROP COLUMN IF EXISTS capacity;

ALTER TABLE location
ADD COLUMN rack_number VARCHAR(50) AFTER location_name,
ADD COLUMN zone VARCHAR(50) AFTER rack_number,
ADD COLUMN description TEXT AFTER zone;

-- 2. Customer Table (from Phase 1) already has customer_name, email, phone, address, city.
-- It's fully sufficient for Phase 7.

-- 3. Stock Movement Table (from Phase 1) already has product_id, from_location_id, to_location_id, quantity, movement_type, reason, changed_by, movement_date.
-- Fully sufficient for Phase 6.

-- 4. Orders and Order Details (from Phase 1) already exist.
-- Fully sufficient for Phase 7.

-- Run this script in your MySQL environment to ensure the schema matches the updated APIs!

