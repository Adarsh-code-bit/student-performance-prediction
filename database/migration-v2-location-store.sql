-- ==============================================================================
-- Migration: Add Store-Location Relationship (v2)
-- Project: Smart Inventory Management System for Quick Commerce
-- ==============================================================================
--
-- DESCRIPTION:
--   Establishes an explicit relationship between dark stores and storage locations
--   by adding a nullable `store_id` foreign key column to the `location` table.
--   This enables store-scoped inventory partitioning, auditing, and access control.
--
-- SAFETY & DATA INTEGRITY GUARANTEES:
--   1. Non-destructive: Does NOT drop, rename, or modify any existing columns.
--   2. Preserves existing data: All existing location records remain intact with
--      `store_id = NULL`.
--   3. NO automatic backfilling: Does NOT guess store mapping from location names.
--      Store ID backfill will only occur upon explicit business approval.
--   4. Referential integrity: Uses ON DELETE SET NULL and ON UPDATE CASCADE to
--      prevent orphaned location records if a store is deleted or modified.
--   5. Idempotent: Checks if column and constraint exist before applying.
--
-- ROLLBACK PROCEDURE:
--   In the event of a rollback, execute the following SQL:
--     ALTER TABLE location DROP FOREIGN KEY fk_location_store;
--     ALTER TABLE location DROP INDEX idx_location_store_id;
--     ALTER TABLE location DROP COLUMN store_id;
--
-- ==============================================================================

-- 1. Prerequisites Check (store table must exist)
-- Verify store table exists
SET @store_table_exists = (
  SELECT COUNT(*) FROM information_schema.TABLES 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store'
);

-- 2. Check if store_id column already exists on location
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'location' 
    AND COLUMN_NAME = 'store_id'
);

-- 3. Apply ALTER TABLE to add store_id if missing
SET @ddl_add_col = IF(
  @store_table_exists > 0 AND @col_exists = 0,
  'ALTER TABLE location ADD COLUMN store_id INT NULL AFTER location_type',
  'SELECT "Column store_id already exists or prerequisite missing"'
);
PREPARE stmt_col FROM @ddl_add_col;
EXECUTE stmt_col;
DEALLOCATE PREPARE stmt_col;

-- 4. Check and add index idx_location_store_id
SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'location' 
    AND INDEX_NAME = 'idx_location_store_id'
);

SET @ddl_add_idx = IF(
  @idx_exists = 0,
  'ALTER TABLE location ADD INDEX idx_location_store_id (store_id)',
  'SELECT "Index idx_location_store_id already exists"'
);
PREPARE stmt_idx FROM @ddl_add_idx;
EXECUTE stmt_idx;
DEALLOCATE PREPARE stmt_idx;

-- 5. Check and add foreign key constraint fk_location_store
SET @fk_exists = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'location' 
    AND CONSTRAINT_NAME = 'fk_location_store'
);

SET @ddl_add_fk = IF(
  @fk_exists = 0,
  'ALTER TABLE location ADD CONSTRAINT fk_location_store FOREIGN KEY (store_id) REFERENCES store(store_id) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT "Constraint fk_location_store already exists"'
);
PREPARE stmt_fk FROM @ddl_add_fk;
EXECUTE stmt_fk;
DEALLOCATE PREPARE stmt_fk;

-- ==============================================================================
-- POST-MIGRATION VERIFICATION QUERIES
-- ==============================================================================
-- 1. Verify column definition:
--    SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY 
--    FROM information_schema.COLUMNS 
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'location' AND COLUMN_NAME = 'store_id';
--
-- 2. Verify foreign key:
--    SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
--    FROM information_schema.KEY_COLUMN_USAGE
--    WHERE TABLE_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_location_store';
--
-- 3. Verify existing data preserved (all rows retain NULL for store_id):
--    SELECT location_id, location_name, location_type, store_id FROM location;
-- ==============================================================================
