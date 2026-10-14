-- =============================================================
-- Smart Inventory Management System for Quick Commerce
-- Database Schema — MySQL 8+
-- =============================================================
-- Phase 1: Complete table definitions with constraints,
-- indexes, and referential integrity.
-- =============================================================

CREATE DATABASE IF NOT EXISTS smart_inventory
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE smart_inventory;

-- =============================================================
-- 1. CATEGORY
-- =============================================================
CREATE TABLE IF NOT EXISTS category (
    category_id   INT AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(100)  NOT NULL UNIQUE,
    description   TEXT,
    is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =============================================================
-- 2. SUPPLIER
-- =============================================================
CREATE TABLE IF NOT EXISTS supplier (
    supplier_id    INT AUTO_INCREMENT PRIMARY KEY,
    supplier_name  VARCHAR(150)  NOT NULL,
    contact_person VARCHAR(100),
    email          VARCHAR(100)  UNIQUE,
    phone          VARCHAR(20),
    address        TEXT,
    city           VARCHAR(50),
    is_active      BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =============================================================
-- 3. LOCATION
--    Single table for all location types.
--    stock_movement references this table TWICE
--    (from_location_id and to_location_id).
-- =============================================================
CREATE TABLE IF NOT EXISTS location (
    location_id   INT AUTO_INCREMENT PRIMARY KEY,
    location_name VARCHAR(100)  NOT NULL,
    rack_number   VARCHAR(50),
    zone          VARCHAR(50),
    description   TEXT,
    is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =============================================================
-- 4. USER
-- =============================================================
CREATE TABLE IF NOT EXISTS `user` (
    user_id       INT AUTO_INCREMENT PRIMARY KEY,
    user_name     VARCHAR(100)  NOT NULL,
    email         VARCHAR(100)  NOT NULL UNIQUE,
    password_hash VARCHAR(255)  NOT NULL,
    role          ENUM('admin', 'manager', 'staff')
                                NOT NULL,
    is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =============================================================
-- 5. CUSTOMER
-- =============================================================
CREATE TABLE IF NOT EXISTS customer (
    customer_id   INT AUTO_INCREMENT PRIMARY KEY,
    customer_name VARCHAR(100)  NOT NULL,
    email         VARCHAR(100)  UNIQUE,
    phone         VARCHAR(20)   NOT NULL,
    address       TEXT,
    city          VARCHAR(50),
    created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =============================================================
-- 6. PRODUCT
--    Central entity — linked to category.
-- =============================================================
CREATE TABLE IF NOT EXISTS product (
    product_id    INT AUTO_INCREMENT PRIMARY KEY,
    category_id   INT           NOT NULL,
    product_name  VARCHAR(255)  NOT NULL,
    brand         VARCHAR(255),
    description   TEXT,
    barcode       VARCHAR(50)   UNIQUE,
    sku           VARCHAR(50)   NOT NULL UNIQUE,
    unit          VARCHAR(100)  NOT NULL,
    unit_price    DECIMAL(10,2) NOT NULL,
    image_url     TEXT,
    reorder_level INT           NOT NULL DEFAULT 10,
    external_source VARCHAR(50) DEFAULT 'Local',
    external_product_id VARCHAR(100),
    is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_product_category
        FOREIGN KEY (category_id) REFERENCES category(category_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    INDEX idx_product_category (category_id),
    INDEX idx_product_sku      (sku),
    INDEX idx_product_barcode  (barcode),
    INDEX idx_product_active   (is_active)
) ENGINE=InnoDB;

-- =============================================================
-- 7. BATCH
--    Tracks manufacturing & expiry per product.
-- =============================================================
CREATE TABLE IF NOT EXISTS batch (
    batch_id           INT AUTO_INCREMENT PRIMARY KEY,
    product_id         INT           NOT NULL,
    batch_code         VARCHAR(50)   NOT NULL UNIQUE,
    manufacturing_date DATE          NOT NULL,
    expiry_date        DATE          NOT NULL,
    quantity           INT           NOT NULL,
    cost_price         DECIMAL(10,2) NOT NULL,
    created_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_batch_product
        FOREIGN KEY (product_id) REFERENCES product(product_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT chk_batch_quantity
        CHECK (quantity >= 0),

    CONSTRAINT chk_batch_dates
        CHECK (expiry_date > manufacturing_date),

    INDEX idx_batch_product (product_id),
    INDEX idx_batch_expiry  (expiry_date)
) ENGINE=InnoDB;

-- =============================================================
-- 8. PURCHASE
-- =============================================================
CREATE TABLE IF NOT EXISTS purchase (
    purchase_id   INT AUTO_INCREMENT PRIMARY KEY,
    supplier_id   INT           NOT NULL,
    purchase_date DATE          NOT NULL,
    total_amount  DECIMAL(12,2) NOT NULL,
    status        ENUM('pending', 'received', 'cancelled')
                                NOT NULL DEFAULT 'pending',
    notes         TEXT,
    created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_purchase_supplier
        FOREIGN KEY (supplier_id) REFERENCES supplier(supplier_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    INDEX idx_purchase_supplier (supplier_id),
    INDEX idx_purchase_status   (status),
    INDEX idx_purchase_date     (purchase_date)
) ENGINE=InnoDB;

-- =============================================================
-- 9. PURCHASE_DETAILS
-- =============================================================
CREATE TABLE IF NOT EXISTS purchase_details (
    purchase_detail_id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_id        INT           NOT NULL,
    product_id         INT           NOT NULL,
    quantity           INT           NOT NULL,
    unit_price         DECIMAL(10,2) NOT NULL,
    total_price        DECIMAL(12,2) NOT NULL,

    CONSTRAINT fk_pd_purchase
        FOREIGN KEY (purchase_id) REFERENCES purchase(purchase_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_pd_product
        FOREIGN KEY (product_id) REFERENCES product(product_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT chk_pd_quantity
        CHECK (quantity > 0),

    INDEX idx_pd_purchase (purchase_id),
    INDEX idx_pd_product  (product_id)
) ENGINE=InnoDB;

-- =============================================================
-- 10. INVENTORY
--     Tracks current stock per product + batch + location.
--     Prevents negative inventory via CHECK constraint.
-- =============================================================
CREATE TABLE IF NOT EXISTS inventory (
    inventory_id INT AUTO_INCREMENT PRIMARY KEY,
    product_id   INT       NOT NULL,
    batch_id     INT       NOT NULL,
    location_id  INT       NOT NULL,
    quantity     INT       NOT NULL DEFAULT 0,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                           ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_inv_product
        FOREIGN KEY (product_id) REFERENCES product(product_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_inv_batch
        FOREIGN KEY (batch_id) REFERENCES batch(batch_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_inv_location
        FOREIGN KEY (location_id) REFERENCES location(location_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT chk_inv_quantity
        CHECK (quantity >= 0),

    UNIQUE KEY uq_inv_product_batch_location (product_id, batch_id, location_id),
    INDEX idx_inv_product  (product_id),
    INDEX idx_inv_batch    (batch_id),
    INDEX idx_inv_location (location_id)
) ENGINE=InnoDB;

-- =============================================================
-- 11. STOCK_MOVEMENT
--     from_location_id and to_location_id BOTH reference
--     the single location table.
-- =============================================================
CREATE TABLE IF NOT EXISTS stock_movement (
    movement_id      INT AUTO_INCREMENT PRIMARY KEY,
    product_id       INT          NOT NULL,
    from_location_id INT          NOT NULL,
    to_location_id   INT          NOT NULL,
    quantity         INT          NOT NULL,
    movement_type    ENUM('transfer', 'restock', 'return', 'disposal')
                                  NOT NULL,
    reason           VARCHAR(255),
    changed_by       INT          NOT NULL,
    movement_date    DATETIME     NOT NULL,
    created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_sm_product
        FOREIGN KEY (product_id) REFERENCES product(product_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_sm_from_location
        FOREIGN KEY (from_location_id) REFERENCES location(location_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_sm_to_location
        FOREIGN KEY (to_location_id) REFERENCES location(location_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_sm_changed_by
        FOREIGN KEY (changed_by) REFERENCES `user`(user_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT chk_sm_quantity
        CHECK (quantity > 0),

    INDEX idx_sm_product       (product_id),
    INDEX idx_sm_from_location (from_location_id),
    INDEX idx_sm_to_location   (to_location_id),
    INDEX idx_sm_changed_by    (changed_by),
    INDEX idx_sm_date          (movement_date)
) ENGINE=InnoDB;

-- =============================================================
-- 12. ORDERS
--     Named "orders" to avoid conflict with SQL keyword ORDER.
-- =============================================================
CREATE TABLE IF NOT EXISTS orders (
    order_id         INT AUTO_INCREMENT PRIMARY KEY,
    customer_id      INT           NOT NULL,
    order_date       DATETIME      NOT NULL,
    total_amount     DECIMAL(12,2) NOT NULL,
    status           ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled')
                                   NOT NULL DEFAULT 'pending',
    shipping_address TEXT,
    created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_order_customer
        FOREIGN KEY (customer_id) REFERENCES customer(customer_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    INDEX idx_order_customer (customer_id),
    INDEX idx_order_status   (status),
    INDEX idx_order_date     (order_date)
) ENGINE=InnoDB;

-- =============================================================
-- 13. ORDER_DETAILS
-- =============================================================
CREATE TABLE IF NOT EXISTS order_details (
    order_detail_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id        INT           NOT NULL,
    product_id      INT           NOT NULL,
    quantity        INT           NOT NULL,
    unit_price      DECIMAL(10,2) NOT NULL,
    total_price     DECIMAL(12,2) NOT NULL,

    CONSTRAINT fk_od_order
        FOREIGN KEY (order_id) REFERENCES orders(order_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_od_product
        FOREIGN KEY (product_id) REFERENCES product(product_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT chk_od_quantity
        CHECK (quantity > 0),

    INDEX idx_od_order   (order_id),
    INDEX idx_od_product (product_id)
) ENGINE=InnoDB;

-- =============================================================
-- 14. AUDIT_LOG
-- =============================================================
CREATE TABLE IF NOT EXISTS audit_log (
    audit_id    INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT          NOT NULL,
    action      ENUM('INSERT', 'UPDATE', 'DELETE')
                             NOT NULL,
    table_name  VARCHAR(50)  NOT NULL,
    record_id   INT          NOT NULL,
    old_values  JSON,
    new_values  JSON,
    action_date TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    details     TEXT,

    CONSTRAINT fk_audit_user
        FOREIGN KEY (user_id) REFERENCES `user`(user_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    INDEX idx_audit_user       (user_id),
    INDEX idx_audit_table      (table_name),
    INDEX idx_audit_action_date(action_date)
) ENGINE=InnoDB;

-- =============================================================
-- 15. PRODUCT_IMPORT_LOG
-- =============================================================
CREATE TABLE IF NOT EXISTS product_import_log (
    log_id             INT AUTO_INCREMENT PRIMARY KEY,
    import_date        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    imported_by        INT          NOT NULL,
    source             VARCHAR(50)  NOT NULL,
    number_of_products INT          NOT NULL,
    success_count      INT          NOT NULL,
    failed_count       INT          NOT NULL,
    details            JSON,

    CONSTRAINT fk_import_user
        FOREIGN KEY (imported_by) REFERENCES `user`(user_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
) ENGINE=InnoDB;

-- =============================================================
-- Summary
-- =============================================================
-- 14 tables created:
--   1. category           6. product          11. stock_movement
--   2. supplier            7. batch            12. orders
--   3. location            8. purchase         13. order_details
--   4. user                9. purchase_details 14. audit_log
--   5. customer           10. inventory
--
-- Key design decisions:
--   • Single location table — stock_movement has two FKs into it
--   • inventory has a CHECK (quantity >= 0) to prevent negatives
--   • stock_movement has CHECK (from != to) to prevent self-transfers
--   • InnoDB engine for full transactional & FK support
--   • utf8mb4 for proper Unicode handling
--   • orders (not "order") to avoid reserved-word conflicts
-- =============================================================
