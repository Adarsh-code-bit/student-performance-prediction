-- =============================================================
-- Migration: Role-Based Access Control + Dynamic Staff Allocation
-- Quick Commerce Smart Inventory Management System
-- =============================================================

USE smart_inventory;

-- 1. FIX LOCATION TABLE: Add location_type column if missing
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = 'smart_inventory' AND TABLE_NAME = 'location' AND COLUMN_NAME = 'location_type');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE location ADD COLUMN location_type VARCHAR(50) NOT NULL DEFAULT "dark_store" AFTER location_name', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. CREATE STORE TABLE
CREATE TABLE IF NOT EXISTS store (
    store_id   INT AUTO_INCREMENT PRIMARY KEY,
    store_name VARCHAR(100) NOT NULL,
    store_code VARCHAR(20)  NOT NULL UNIQUE,
    city       VARCHAR(50)  NOT NULL,
    address    TEXT,
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Seed default dark stores
INSERT IGNORE INTO store (store_id, store_name, store_code, city, address) VALUES
(1, 'Koramangala Dark Store', 'DS-BLR-01', 'Bengaluru', '4th Block, 100ft Road, Koramangala, Bengaluru'),
(2, 'Indiranagar Dark Store',  'DS-BLR-02', 'Bengaluru', '12th Main Road, HAL 2nd Stage, Indiranagar, Bengaluru');

-- 3. UPDATE USER TABLE: Expand role enum, add staff_subrole & store_id
ALTER TABLE `user` 
  MODIFY COLUMN role ENUM('ADMIN', 'STORE_MANAGER', 'STAFF', 'admin', 'manager', 'staff') NOT NULL DEFAULT 'STAFF';

-- Add staff_subrole if missing
SET @subrole_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = 'smart_inventory' AND TABLE_NAME = 'user' AND COLUMN_NAME = 'staff_subrole');
SET @sql_subrole = IF(@subrole_exists = 0, 
  "ALTER TABLE `user` ADD COLUMN staff_subrole ENUM('AUDITOR', 'PICKER', 'PACKER', 'INVENTORY_CLERK') NULL AFTER role", 
  'SELECT 1');
PREPARE stmt FROM @sql_subrole; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add store_id if missing
SET @store_col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = 'smart_inventory' AND TABLE_NAME = 'user' AND COLUMN_NAME = 'store_id');
SET @sql_store = IF(@store_col_exists = 0, 
  "ALTER TABLE `user` ADD COLUMN store_id INT NULL AFTER staff_subrole, ADD CONSTRAINT fk_user_store FOREIGN KEY (store_id) REFERENCES store(store_id) ON DELETE SET NULL", 
  'SELECT 1');
PREPARE stmt FROM @sql_store; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Normalize existing users to uppercase roles
UPDATE `user` SET role = 'ADMIN' WHERE role = 'admin';
UPDATE `user` SET role = 'STORE_MANAGER', store_id = 1 WHERE role = 'manager';
UPDATE `user` SET role = 'STAFF', staff_subrole = 'PICKER', store_id = 1 WHERE role = 'staff';

-- Seed test accounts for each subrole (password: 'password123')
INSERT IGNORE INTO `user` (user_id, user_name, email, password_hash, role, staff_subrole, store_id, is_active) VALUES
(4, 'Ananya Auditor',  'auditor@example.com', '$2b$10$/ndoEu2g8cQYWx63JIuxIO9RidM07FDeQCXqKscKRUdhF82SEAgJa', 'STAFF', 'AUDITOR',         1, TRUE),
(5, 'Prakash Picker',  'picker@example.com',  '$2b$10$/ndoEu2g8cQYWx63JIuxIO9RidM07FDeQCXqKscKRUdhF82SEAgJa', 'STAFF', 'PICKER',          1, TRUE),
(6, 'Pooja Packer',    'packer@example.com',  '$2b$10$/ndoEu2g8cQYWx63JIuxIO9RidM07FDeQCXqKscKRUdhF82SEAgJa', 'STAFF', 'PACKER',          1, TRUE),
(7, 'Karan Clerk',     'clerk@example.com',   '$2b$10$/ndoEu2g8cQYWx63JIuxIO9RidM07FDeQCXqKscKRUdhF82SEAgJa', 'STAFF', 'INVENTORY_CLERK', 1, TRUE);

-- 4. CREATE STAFF_ALLOCATION TABLE
CREATE TABLE IF NOT EXISTS staff_allocation (
    allocation_id    INT AUTO_INCREMENT PRIMARY KEY,
    user_id          INT          NOT NULL,
    original_subrole ENUM('AUDITOR', 'PICKER', 'PACKER', 'INVENTORY_CLERK') NOT NULL,
    assigned_role    ENUM('PICKER', 'PACKER', 'AUDITOR', 'INVENTORY_CLERK') NOT NULL DEFAULT 'PICKER',
    store_id         INT          NULL,
    assigned_by      INT          NOT NULL,
    start_time       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_time         TIMESTAMP    NULL,
    status           ENUM('ACTIVE', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    reason           VARCHAR(255) NULL,
    notes            TEXT         NULL,
    created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_alloc_user
        FOREIGN KEY (user_id) REFERENCES `user`(user_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_alloc_assigned_by
        FOREIGN KEY (assigned_by) REFERENCES `user`(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_alloc_store
        FOREIGN KEY (store_id) REFERENCES store(store_id)
        ON UPDATE CASCADE ON DELETE SET NULL,

    INDEX idx_alloc_user_status (user_id, status),
    INDEX idx_alloc_store       (store_id)
) ENGINE=InnoDB;

-- 5. CREATE STOCK_AUDIT TABLE
CREATE TABLE IF NOT EXISTS stock_audit (
    audit_task_id     INT AUTO_INCREMENT PRIMARY KEY,
    store_id          INT          NULL,
    product_id        INT          NOT NULL,
    location_id       INT          NOT NULL,
    auditor_id        INT          NOT NULL,
    system_quantity   INT          NOT NULL,
    physical_quantity INT          NOT NULL,
    discrepancy       INT          NOT NULL,
    discrepancy_type  ENUM('NONE', 'DAMAGED', 'EXPIRED', 'MISSING', 'EXCESS') NOT NULL DEFAULT 'NONE',
    notes             TEXT         NULL,
    status            ENUM('PENDING_REVIEW', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING_REVIEW',
    reviewed_by       INT          NULL,
    review_notes      TEXT         NULL,
    created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at       TIMESTAMP    NULL,

    CONSTRAINT fk_audit_product
        FOREIGN KEY (product_id) REFERENCES product(product_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_audit_location
        FOREIGN KEY (location_id) REFERENCES location(location_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_audit_auditor
        FOREIGN KEY (auditor_id) REFERENCES `user`(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_audit_reviewer
        FOREIGN KEY (reviewed_by) REFERENCES `user`(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_audit_store
        FOREIGN KEY (store_id) REFERENCES store(store_id)
        ON UPDATE CASCADE ON DELETE SET NULL,

    INDEX idx_audit_status (status),
    INDEX idx_audit_store  (store_id)
) ENGINE=InnoDB;

-- 6. UPDATE ORDERS TABLE: Quick-Commerce status lifecycle and picker/packer assignments
ALTER TABLE orders 
  MODIFY COLUMN status ENUM(
    'pending', 'confirmed', 'picking_queue', 'picking_in_progress', 'picked', 
    'packing_in_progress', 'packed', 'ready_for_dispatch', 'dispatched', 
    'delivered', 'cancelled', 'processing', 'shipped'
  ) NOT NULL DEFAULT 'pending';

-- Add store_id to orders if missing
SET @ord_store_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = 'smart_inventory' AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'store_id');
SET @sql_ord_store = IF(@ord_store_exists = 0, 
  "ALTER TABLE orders ADD COLUMN store_id INT NULL AFTER customer_id, ADD CONSTRAINT fk_order_store FOREIGN KEY (store_id) REFERENCES store(store_id) ON DELETE SET NULL", 
  'SELECT 1');
PREPARE stmt FROM @sql_ord_store; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add assigned_picker_id to orders if missing
SET @ord_picker_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = 'smart_inventory' AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'assigned_picker_id');
SET @sql_ord_picker = IF(@ord_picker_exists = 0, 
  "ALTER TABLE orders ADD COLUMN assigned_picker_id INT NULL AFTER shipping_address, ADD CONSTRAINT fk_order_picker FOREIGN KEY (assigned_picker_id) REFERENCES `user`(user_id) ON DELETE SET NULL", 
  'SELECT 1');
PREPARE stmt FROM @sql_ord_picker; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add assigned_packer_id to orders if missing
SET @ord_packer_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = 'smart_inventory' AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'assigned_packer_id');
SET @sql_ord_packer = IF(@ord_packer_exists = 0, 
  "ALTER TABLE orders ADD COLUMN assigned_packer_id INT NULL AFTER assigned_picker_id, ADD CONSTRAINT fk_order_packer FOREIGN KEY (assigned_packer_id) REFERENCES `user`(user_id) ON DELETE SET NULL", 
  'SELECT 1');
PREPARE stmt FROM @sql_ord_packer; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add timestamps for picking and packing
SET @ord_picked_at = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = 'smart_inventory' AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'picked_at');
SET @sql_ord_picked = IF(@ord_picked_at = 0, 
  "ALTER TABLE orders ADD COLUMN picked_at DATETIME NULL AFTER assigned_packer_id, ADD COLUMN packed_at DATETIME NULL AFTER picked_at", 
  'SELECT 1');
PREPARE stmt FROM @sql_ord_picked; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Ensure default sample location and inventory exist so Inventory page has live data
INSERT IGNORE INTO location (location_id, location_name, location_type, rack_number, zone, description) VALUES
(1, 'Dark Store 1 - Rack A', 'dark_store', 'RACK-A1', 'ZONE-AMBIENT', 'Koramangala Dark Store - Ambient Storage Rack 1'),
(2, 'Dark Store 1 - Chiller', 'cold_storage', 'CHILL-C1', 'ZONE-COLD', 'Koramangala Dark Store - Dairy & Beverages Chiller');

-- Update orders default store_id
UPDATE orders SET store_id = 1 WHERE store_id IS NULL;
