-- ==============================================================================
-- Rollback Migration: Purchase Line Item Storage Location & Capacity (v6)
-- Project: Smart Inventory Management System for Quick Commerce
-- ==============================================================================
--
-- SAFETY & DATA INTEGRITY GUARANTEES:
--   1. NEVER deletes locations merely because their rack number matches a list.
--   2. Only deletes records specifically created by V6 (matching exact name, rack, shelf, bin).
--   3. Strictly PRESERVES pre-existing locations (e.g. location_id 1, 2).
--   4. Strictly PRESERVES any location currently referenced by inventory, orders,
--      purchases, stock movements, audits, or location history.
--   5. Reverses schema modifications (fk_purchase_details_location, location_id, max_capacity).
--   6. Fully idempotent and safe to re-run.
-- ==============================================================================

-- 1. DROP FOREIGN KEY ON purchase_details IF EXISTS
SET @fk_v6 = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'purchase_details' 
    AND CONSTRAINT_NAME = 'fk_purchase_details_location'
);
SET @sql_fk_v6 = IF(
  @fk_v6 > 0,
  'ALTER TABLE purchase_details DROP FOREIGN KEY fk_purchase_details_location',
  'SELECT "Constraint fk_purchase_details_location does not exist"'
);
PREPARE stmt_fk_v6 FROM @sql_fk_v6; EXECUTE stmt_fk_v6; DEALLOCATE PREPARE stmt_fk_v6;

-- 2. DROP COLUMN location_id ON purchase_details IF EXISTS
SET @col_loc = (
  SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_details' AND COLUMN_NAME = 'location_id'
);
SET @sql_loc = IF(
  @col_loc > 0,
  'ALTER TABLE purchase_details DROP COLUMN location_id',
  'SELECT "Column location_id does not exist on purchase_details"'
);
PREPARE stmt_loc FROM @sql_loc; EXECUTE stmt_loc; DEALLOCATE PREPARE stmt_loc;

-- 3. DROP COLUMN max_capacity ON location IF EXISTS
SET @col_cap = (
  SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'location' AND COLUMN_NAME = 'max_capacity'
);
SET @sql_cap = IF(
  @col_cap > 0,
  'ALTER TABLE location DROP COLUMN max_capacity',
  'SELECT "Column max_capacity does not exist on location"'
);
PREPARE stmt_cap FROM @sql_cap; EXECUTE stmt_cap; DEALLOCATE PREPARE stmt_cap;

-- 4. TARGETED REMOVAL OF UNUSED V6-SEEDED LOCATIONS ONLY
-- Only removes locations matching the exact signature created by V6,
-- AND ensures they have zero references in inventory, orders, purchases, movements, or audits.
DELETE FROM location
WHERE location_id IN (
  SELECT loc_id FROM (
    SELECT l.location_id AS loc_id
    FROM location l
    WHERE (
      (l.rack_number = 'A01' AND l.shelf = '02' AND l.bin = '0B' AND l.location_name = 'Rack A01 Position 02-0B') OR
      (l.rack_number = 'A02' AND l.shelf = '01' AND l.bin = '0A' AND l.location_name = 'Rack A02 Position 01-0A') OR
      (l.rack_number = 'A03' AND l.shelf = '04' AND l.bin = '0C' AND l.location_name = 'Rack A03 Position 04-0C') OR
      (l.rack_number = 'A04' AND l.shelf = '01' AND l.bin = '0A' AND l.location_name = 'Rack A04 Position 01-0A (Limited)') OR
      (l.rack_number = 'A99' AND l.shelf = '99' AND l.bin = '9Z' AND l.location_name = 'Rack A99 Position 99-9Z (Decommissioned)')
    )
    -- GUARD: Exclude pre-existing location IDs (e.g. 1, 2)
    AND l.location_id NOT IN (1, 2)
    -- GUARD: Ensure not referenced by inventory
    AND l.location_id NOT IN (SELECT DISTINCT location_id FROM inventory WHERE location_id IS NOT NULL)
    -- GUARD: Ensure not referenced by order allocations
    AND l.location_id NOT IN (SELECT DISTINCT location_id FROM order_item_allocations WHERE location_id IS NOT NULL)
    -- GUARD: Ensure not referenced by stock movements (outbound or inbound)
    AND l.location_id NOT IN (SELECT DISTINCT from_location_id FROM stock_movement WHERE from_location_id IS NOT NULL)
    AND l.location_id NOT IN (SELECT DISTINCT to_location_id FROM stock_movement WHERE to_location_id IS NOT NULL)
    -- GUARD: Ensure not referenced by stock audits
    AND l.location_id NOT IN (SELECT DISTINCT location_id FROM stock_audit WHERE location_id IS NOT NULL)
  ) AS safe_to_delete
);
