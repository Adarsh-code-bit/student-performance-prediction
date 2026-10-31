-- ==============================================================================
-- Migration: Purchase Line Item Storage Location & Capacity Support (v6)
-- Project: Smart Inventory Management System for Quick Commerce
-- ==============================================================================
--
-- SAFETY & DATA INTEGRITY GUARANTEES:
--   1. Non-destructive: Verifies and conditionally adds columns without dropping.
--   2. Preserves all existing records, constraints, and relationships.
--   3. Idempotent: Can be safely executed multiple times without error.
--
-- ==============================================================================
-- USE smart_inventory; -- Connect directly to target database (e.g. defaultdb) or specify in client connection

-- 1. Ensure max_capacity column exists on location table
SET @col_cap = (
  SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'location' AND COLUMN_NAME = 'max_capacity'
);
SET @sql_cap = IF(
  @col_cap = 0, 
  'ALTER TABLE location ADD COLUMN max_capacity INT NULL DEFAULT NULL AFTER bin', 
  'SELECT "Column max_capacity already exists on location"'
);
PREPARE stmt_cap FROM @sql_cap; EXECUTE stmt_cap; DEALLOCATE PREPARE stmt_cap;

-- 2. Ensure location_id column exists on purchase_details table
SET @col_loc = (
  SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_details' AND COLUMN_NAME = 'location_id'
);
SET @sql_loc = IF(
  @col_loc = 0, 
  'ALTER TABLE purchase_details ADD COLUMN location_id INT NULL AFTER product_id', 
  'SELECT "Column location_id already exists on purchase_details"'
);
PREPARE stmt_loc FROM @sql_loc; EXECUTE stmt_loc; DEALLOCATE PREPARE stmt_loc;

-- 3. Ensure foreign key fk_purchase_details_location exists on purchase_details
SET @fk_loc = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'purchase_details' 
    AND CONSTRAINT_NAME = 'fk_purchase_details_location'
);
SET @sql_fk = IF(
  @fk_loc = 0,
  'ALTER TABLE purchase_details ADD CONSTRAINT fk_purchase_details_location FOREIGN KEY (location_id) REFERENCES location(location_id) ON DELETE SET NULL',
  'SELECT "Constraint fk_purchase_details_location already exists"'
);
PREPARE stmt_fk FROM @sql_fk; EXECUTE stmt_fk; DEALLOCATE PREPARE stmt_fk;

-- 4. Seed standard warehouse rack positions if not already present
-- Rack A01 Position 02-0B (A01-02-0B)
INSERT INTO location (location_name, location_type, store_id, rack_number, aisle, shelf, bin, zone, description, is_active, max_capacity)
SELECT 'Rack A01 Position 02-0B', 'dark_store', 1, 'A01', '01', '02', '0B', 'Cold Storage', 'Cold drinks primary rack position', 1, 500
WHERE NOT EXISTS (
  SELECT 1 FROM location WHERE rack_number = 'A01' AND shelf = '02' AND bin = '0B'
);

-- Rack A02 Position 01-0A (A02-01-0A)
INSERT INTO location (location_name, location_type, store_id, rack_number, aisle, shelf, bin, zone, description, is_active, max_capacity)
SELECT 'Rack A02 Position 01-0A', 'dark_store', 1, 'A02', '01', '01', '0A', 'Ambient', 'Biscuits & confectionery primary rack position', 1, 500
WHERE NOT EXISTS (
  SELECT 1 FROM location WHERE rack_number = 'A02' AND shelf = '01' AND bin = '0A'
);

-- Rack A03 Position 04-0C (A03-04-0C)
INSERT INTO location (location_name, location_type, store_id, rack_number, aisle, shelf, bin, zone, description, is_active, max_capacity)
SELECT 'Rack A03 Position 04-0C', 'dark_store', 1, 'A03', '02', '04', '0C', 'Ambient', 'Chips & savory snacks rack position', 1, 500
WHERE NOT EXISTS (
  SELECT 1 FROM location WHERE rack_number = 'A03' AND shelf = '04' AND bin = '0C'
);

-- Test low capacity location for capacity testing (Rack A04 Position 01-0A, max_capacity = 10)
INSERT INTO location (location_name, location_type, store_id, rack_number, aisle, shelf, bin, zone, description, is_active, max_capacity)
SELECT 'Rack A04 Position 01-0A (Limited)', 'dark_store', 1, 'A04', '02', '01', '0A', 'Ambient', 'Limited capacity test location', 1, 10
WHERE NOT EXISTS (
  SELECT 1 FROM location WHERE rack_number = 'A04' AND shelf = '01' AND bin = '0A'
);

-- Test inactive location for validation testing (Rack A99 Position 99-9Z, is_active = 0)
INSERT INTO location (location_name, location_type, store_id, rack_number, aisle, shelf, bin, zone, description, is_active, max_capacity)
SELECT 'Rack A99 Position 99-9Z (Decommissioned)', 'dark_store', 1, 'A99', '99', '99', '9Z', 'Archive', 'Inactive decommissioned rack position', 0, 100
WHERE NOT EXISTS (
  SELECT 1 FROM location WHERE rack_number = 'A99' AND shelf = '99' AND bin = '9Z'
);

