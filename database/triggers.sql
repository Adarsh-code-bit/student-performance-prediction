-- =============================================================
-- Smart Inventory Management System for Quick Commerce
-- Database Triggers — MySQL 8+
-- =============================================================

USE smart_inventory;

-- =============================================================
-- TRIGGER 1: trg_audit_product_insert
-- Logs INSERT operations on the product table
-- =============================================================
DELIMITER //
CREATE TRIGGER trg_audit_product_insert
AFTER INSERT ON product
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (user_id, action, table_name, record_id, new_values, details)
    VALUES (
        1, -- Default system user; will be updated when auth is integrated
        'INSERT',
        'product',
        NEW.product_id,
        JSON_OBJECT(
            'product_name', NEW.product_name,
            'sku', NEW.sku,
            'unit_price', NEW.unit_price,
            'category_id', NEW.category_id
        ),
        CONCAT('New product created: ', NEW.product_name)
    );
END //
DELIMITER ;

-- =============================================================
-- TRIGGER 2: trg_audit_product_update
-- Logs UPDATE operations on the product table
-- =============================================================
DELIMITER //
CREATE TRIGGER trg_audit_product_update
AFTER UPDATE ON product
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (user_id, action, table_name, record_id, old_values, new_values, details)
    VALUES (
        1,
        'UPDATE',
        'product',
        NEW.product_id,
        JSON_OBJECT(
            'product_name', OLD.product_name,
            'unit_price', OLD.unit_price,
            'is_active', OLD.is_active,
            'reorder_level', OLD.reorder_level
        ),
        JSON_OBJECT(
            'product_name', NEW.product_name,
            'unit_price', NEW.unit_price,
            'is_active', NEW.is_active,
            'reorder_level', NEW.reorder_level
        ),
        CONCAT('Product updated: ', NEW.product_name)
    );
END //
DELIMITER ;

-- =============================================================
-- TRIGGER 3: trg_audit_product_delete
-- Logs DELETE operations on the product table
-- =============================================================
DELIMITER //
CREATE TRIGGER trg_audit_product_delete
AFTER DELETE ON product
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (user_id, action, table_name, record_id, old_values, details)
    VALUES (
        1,
        'DELETE',
        'product',
        OLD.product_id,
        JSON_OBJECT(
            'product_name', OLD.product_name,
            'sku', OLD.sku,
            'unit_price', OLD.unit_price
        ),
        CONCAT('Product deleted: ', OLD.product_name)
    );
END //
DELIMITER ;

-- =============================================================
-- TRIGGER 4: trg_audit_inventory_update
-- Logs changes to inventory quantities
-- =============================================================
DELIMITER //
CREATE TRIGGER trg_audit_inventory_update
AFTER UPDATE ON inventory
FOR EACH ROW
BEGIN
    IF OLD.quantity <> NEW.quantity THEN
        INSERT INTO audit_log (user_id, action, table_name, record_id, old_values, new_values, details)
        VALUES (
            1,
            'UPDATE',
            'inventory',
            NEW.inventory_id,
            JSON_OBJECT('quantity', OLD.quantity, 'product_id', OLD.product_id, 'location_id', OLD.location_id),
            JSON_OBJECT('quantity', NEW.quantity, 'product_id', NEW.product_id, 'location_id', NEW.location_id),
            CONCAT('Inventory quantity changed from ', OLD.quantity, ' to ', NEW.quantity,
                   ' for product_id=', NEW.product_id, ' at location_id=', NEW.location_id)
        );
    END IF;
END //
DELIMITER ;

-- =============================================================
-- TRIGGER 5: trg_audit_order_status_change
-- Logs order status changes
-- =============================================================
DELIMITER //
CREATE TRIGGER trg_audit_order_status_change
AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
    IF OLD.status <> NEW.status THEN
        INSERT INTO audit_log (user_id, action, table_name, record_id, old_values, new_values, details)
        VALUES (
            1,
            'UPDATE',
            'orders',
            NEW.order_id,
            JSON_OBJECT('status', OLD.status, 'total_amount', OLD.total_amount),
            JSON_OBJECT('status', NEW.status, 'total_amount', NEW.total_amount),
            CONCAT('Order #', NEW.order_id, ' status changed: ', OLD.status, ' → ', NEW.status)
        );
    END IF;
END //
DELIMITER ;

-- =============================================================
-- TRIGGER 6: trg_prevent_negative_inventory
-- Prevents inventory from going below zero on UPDATE
-- (Defense-in-depth alongside the CHECK constraint)
-- =============================================================
DELIMITER //
CREATE TRIGGER trg_prevent_negative_inventory
BEFORE UPDATE ON inventory
FOR EACH ROW
BEGIN
    IF NEW.quantity < 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Inventory quantity cannot be negative.';
    END IF;
END //
DELIMITER ;

-- =============================================================
-- TRIGGER 7: trg_log_stock_movement
-- Creates an audit log entry whenever a stock movement is recorded
-- =============================================================
DELIMITER //
CREATE TRIGGER trg_log_stock_movement
AFTER INSERT ON stock_movement
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (user_id, action, table_name, record_id, new_values, details)
    VALUES (
        NEW.changed_by,
        'INSERT',
        'stock_movement',
        NEW.movement_id,
        JSON_OBJECT(
            'product_id', NEW.product_id,
            'from_location_id', NEW.from_location_id,
            'to_location_id', NEW.to_location_id,
            'quantity', NEW.quantity,
            'movement_type', NEW.movement_type
        ),
        CONCAT('Stock movement: ', NEW.movement_type,
               ' of ', NEW.quantity, ' units',
               ' from location ', NEW.from_location_id,
               ' to location ', NEW.to_location_id)
    );
END //
DELIMITER ;
