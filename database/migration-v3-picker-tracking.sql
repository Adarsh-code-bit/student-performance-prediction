-- ==============================================================================
-- Migration: Picker Location Guidance & Manager Activity Tracking (v3)
-- Project: Smart Inventory Management System for Quick Commerce
-- ==============================================================================
--
-- SAFETY & DATA INTEGRITY GUARANTEES:
--   1. Non-destructive: Adds new nullable columns and new tracking tables.
--   2. Preserves existing data: Does not modify or drop existing tables or columns.
--   3. Referential integrity: Foreign keys enforce parent relationships with
--      appropriate CASCADE / SET NULL rules.
--   4. Idempotent: Checks information_schema before adding columns.
-- ROLLBACK & RECOVERY PROCEDURES:
--   Option A: Non-destructive Operational Recovery (Production Recommended)
--     If operational picking data already exists, preserve history by archiving:
--       RENAME TABLE order_item_allocations TO order_item_allocations_archived;
--       RENAME TABLE picking_event_log TO picking_event_log_archived;
--     Note: Added nullable columns (aisle, shelf, bin, picking_assigned_at, picking_started_at)
--     can safely remain in place without impacting legacy applications.
--
--   Option B: Disposable Testing Tear-down (STAGING/TEST ONLY - PERMANENTLY DESTROYS DATA):
--     DROP TABLE IF EXISTS picking_event_log;
--     DROP TABLE IF EXISTS order_item_allocations;
--     ALTER TABLE orders DROP COLUMN picking_started_at;
--     ALTER TABLE orders DROP COLUMN picking_assigned_at;
--     ALTER TABLE location DROP COLUMN bin;
--     ALTER TABLE location DROP COLUMN shelf;
--     ALTER TABLE location DROP COLUMN aisle;
-- ==============================================================================

-- USE smart_inventory; -- Uncomment if running standalone or specify target db in client connection

-- 1. EXTEND LOCATION TABLE: Add aisle, shelf, bin if missing
SET @col_aisle = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'location' AND COLUMN_NAME = 'aisle');
SET @sql_aisle = IF(@col_aisle = 0, 'ALTER TABLE location ADD COLUMN aisle VARCHAR(50) NULL AFTER rack_number', 'SELECT 1');
PREPARE stmt_aisle FROM @sql_aisle; EXECUTE stmt_aisle; DEALLOCATE PREPARE stmt_aisle;

SET @col_shelf = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'location' AND COLUMN_NAME = 'shelf');
SET @sql_shelf = IF(@col_shelf = 0, 'ALTER TABLE location ADD COLUMN shelf VARCHAR(50) NULL AFTER aisle', 'SELECT 1');
PREPARE stmt_shelf FROM @sql_shelf; EXECUTE stmt_shelf; DEALLOCATE PREPARE stmt_shelf;

SET @col_bin = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'location' AND COLUMN_NAME = 'bin');
SET @sql_bin = IF(@col_bin = 0, 'ALTER TABLE location ADD COLUMN bin VARCHAR(50) NULL AFTER shelf', 'SELECT 1');
PREPARE stmt_bin FROM @sql_bin; EXECUTE stmt_bin; DEALLOCATE PREPARE stmt_bin;

-- 2. EXTEND ORDERS TABLE: Add picking timestamps
SET @col_p_assign = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'picking_assigned_at');
SET @sql_p_assign = IF(@col_p_assign = 0, 'ALTER TABLE orders ADD COLUMN picking_assigned_at DATETIME NULL AFTER assigned_picker_id', 'SELECT 1');
PREPARE stmt_p_assign FROM @sql_p_assign; EXECUTE stmt_p_assign; DEALLOCATE PREPARE stmt_p_assign;

SET @col_p_start = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'picking_started_at');
SET @sql_p_start = IF(@col_p_start = 0, 'ALTER TABLE orders ADD COLUMN picking_started_at DATETIME NULL AFTER picking_assigned_at', 'SELECT 1');
PREPARE stmt_p_start FROM @sql_p_start; EXECUTE stmt_p_start; DEALLOCATE PREPARE stmt_p_start;

-- 3. CREATE ORDER_ITEM_ALLOCATIONS TABLE
CREATE TABLE IF NOT EXISTS order_item_allocations (
    allocation_id        INT AUTO_INCREMENT PRIMARY KEY,
    order_id             INT NOT NULL,
    order_detail_id      INT NOT NULL,
    product_id           INT NOT NULL,
    inventory_id         INT NULL,
    batch_id             INT NULL,
    location_id          INT NULL,
    allocated_quantity   INT NOT NULL,
    picked_quantity      INT NOT NULL DEFAULT 0,
    shortage_quantity    INT NOT NULL DEFAULT 0,
    status               ENUM('PENDING', 'IN_PROGRESS', 'PAUSED', 'PICKED', 'SHORTAGE', 'RETURN_PENDING', 'RETURNED') NOT NULL DEFAULT 'PENDING',
    started_at           DATETIME NULL,
    picked_at            DATETIME NULL,
    paused_at            DATETIME NULL,
    total_paused_seconds INT NOT NULL DEFAULT 0,
    is_restored          BOOLEAN NOT NULL DEFAULT FALSE,
    shortage_reason      VARCHAR(255) NULL,
    notes                TEXT NULL,
    created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_oia_order
        FOREIGN KEY (order_id) REFERENCES orders(order_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_oia_order_detail
        FOREIGN KEY (order_detail_id) REFERENCES order_details(order_detail_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_oia_product
        FOREIGN KEY (product_id) REFERENCES product(product_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_oia_inventory
        FOREIGN KEY (inventory_id) REFERENCES inventory(inventory_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_oia_batch
        FOREIGN KEY (batch_id) REFERENCES batch(batch_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_oia_location
        FOREIGN KEY (location_id) REFERENCES location(location_id)
        ON UPDATE CASCADE ON DELETE SET NULL,

    INDEX idx_oia_order    (order_id),
    INDEX idx_oia_product  (product_id),
    INDEX idx_oia_location (location_id),
    INDEX idx_oia_status   (status)
) ENGINE=InnoDB;

-- 4. CREATE PICKING_EVENT_LOG TABLE
CREATE TABLE IF NOT EXISTS picking_event_log (
    event_id         INT AUTO_INCREMENT PRIMARY KEY,
    order_id         INT NOT NULL,
    allocation_id    INT NULL,
    picker_id        INT NOT NULL,
    event_type       ENUM('ASSIGNED', 'PICK_STARTED', 'ITEM_STARTED', 'ITEM_PAUSED', 'ITEM_RESUMED', 'ITEM_CONFIRMED', 'ITEM_SHORTAGE', 'ORDER_COMPLETED', 'ITEM_RETURNED') NOT NULL,
    event_time       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    duration_seconds INT NULL,
    details          TEXT NULL,

    CONSTRAINT fk_pel_order
        FOREIGN KEY (order_id) REFERENCES orders(order_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_pel_picker
        FOREIGN KEY (picker_id) REFERENCES `user`(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    INDEX idx_pel_order  (order_id),
    INDEX idx_pel_picker (picker_id),
    INDEX idx_pel_type   (event_type),
    INDEX idx_pel_time   (event_time)
) ENGINE=InnoDB;

-- 5. Seed sample aisle, shelf, bin for existing default locations
UPDATE location 
SET aisle = 'AISLE-01', shelf = 'SHELF-A', bin = 'BIN-01' 
WHERE location_id = 1 AND aisle IS NULL;

UPDATE location 
SET aisle = 'AISLE-CHILL', shelf = 'SHELF-C', bin = 'BIN-C1' 
WHERE location_id = 2 AND aisle IS NULL;
