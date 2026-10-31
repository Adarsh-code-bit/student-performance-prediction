-- ==============================================================================
-- Migration: Product Image and Brand Attributes Verification (v5)
-- Project: Smart Inventory Management System for Quick Commerce
-- ==============================================================================
--
-- SAFETY & DATA INTEGRITY GUARANTEES:
--   1. Non-destructive: Verifies and conditionally adds image_url, brand,
--      external_source, and external_product_id if not already present.
--   2. Preserves all existing records, constraints, and relationships.
--   3. Idempotent: Can be safely executed multiple times without error.
--
-- ==============================================================================

USE smart_inventory;

-- 1. Ensure image_url column exists on product
SET @col_img = (
  SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product' AND COLUMN_NAME = 'image_url'
);
SET @sql_img = IF(
  @col_img = 0, 
  'ALTER TABLE product ADD COLUMN image_url TEXT NULL AFTER unit_price', 
  'SELECT "Column image_url already exists"'
);
PREPARE stmt_img FROM @sql_img; EXECUTE stmt_img; DEALLOCATE PREPARE stmt_img;

-- 2. Ensure brand column exists on product
SET @col_brand = (
  SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product' AND COLUMN_NAME = 'brand'
);
SET @sql_brand = IF(
  @col_brand = 0, 
  'ALTER TABLE product ADD COLUMN brand VARCHAR(255) NULL AFTER product_name', 
  'SELECT "Column brand already exists"'
);
PREPARE stmt_brand FROM @sql_brand; EXECUTE stmt_brand; DEALLOCATE PREPARE stmt_brand;

-- 3. Ensure external_source column exists on product
SET @col_src = (
  SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product' AND COLUMN_NAME = 'external_source'
);
SET @sql_src = IF(
  @col_src = 0, 
  'ALTER TABLE product ADD COLUMN external_source VARCHAR(50) DEFAULT "Local" AFTER reorder_level', 
  'SELECT "Column external_source already exists"'
);
PREPARE stmt_src FROM @sql_src; EXECUTE stmt_src; DEALLOCATE PREPARE stmt_src;

-- 4. Ensure external_product_id column exists on product
SET @col_ext_id = (
  SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product' AND COLUMN_NAME = 'external_product_id'
);
SET @sql_ext_id = IF(
  @col_ext_id = 0, 
  'ALTER TABLE product ADD COLUMN external_product_id VARCHAR(100) NULL AFTER external_source', 
  'SELECT "Column external_product_id already exists"'
);
PREPARE stmt_ext_id FROM @sql_ext_id; EXECUTE stmt_ext_id; DEALLOCATE PREPARE stmt_ext_id;
