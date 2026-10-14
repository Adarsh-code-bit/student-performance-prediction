-- =============================================================
-- Smart Inventory Management System for Quick Commerce
-- Database Views — MySQL 8+
-- =============================================================

USE smart_inventory;

-- =============================================================
-- VIEW 1: vw_product_catalog
-- Full product catalog with category info
-- =============================================================
CREATE OR REPLACE VIEW vw_product_catalog AS
SELECT
    p.product_id,
    p.sku,
    p.product_name,
    c.category_name,
    p.description,
    p.unit,
    p.unit_price,
    p.reorder_level,
    p.is_active,
    p.created_at
FROM product p
JOIN category c ON p.category_id = c.category_id;

-- =============================================================
-- VIEW 2: vw_current_stock
-- Aggregated stock per product across all locations
-- =============================================================
CREATE OR REPLACE VIEW vw_current_stock AS
SELECT
    p.product_id,
    p.sku,
    p.product_name,
    p.unit,
    p.reorder_level,
    COALESCE(SUM(i.quantity), 0) AS total_stock,
    CASE
        WHEN COALESCE(SUM(i.quantity), 0) = 0 THEN 'OUT_OF_STOCK'
        WHEN COALESCE(SUM(i.quantity), 0) <= p.reorder_level THEN 'LOW_STOCK'
        ELSE 'IN_STOCK'
    END AS stock_status
FROM product p
LEFT JOIN inventory i ON p.product_id = i.product_id
WHERE p.is_active = TRUE
GROUP BY p.product_id, p.sku, p.product_name, p.unit, p.reorder_level;

-- =============================================================
-- VIEW 3: vw_stock_by_location
-- Stock breakdown per product per location
-- =============================================================
CREATE OR REPLACE VIEW vw_stock_by_location AS
SELECT
    l.location_id,
    l.location_name,
    l.location_type,
    p.product_id,
    p.product_name,
    p.sku,
    SUM(i.quantity) AS quantity,
    SUM(i.quantity * p.unit_price) AS stock_value
FROM inventory i
JOIN product p  ON i.product_id  = p.product_id
JOIN location l ON i.location_id = l.location_id
GROUP BY l.location_id, l.location_name, l.location_type,
         p.product_id, p.product_name, p.sku;

-- =============================================================
-- VIEW 4: vw_expiring_batches
-- Batches expiring within the next 30 days
-- =============================================================
CREATE OR REPLACE VIEW vw_expiring_batches AS
SELECT
    b.batch_id,
    b.batch_code,
    p.product_id,
    p.product_name,
    p.sku,
    b.manufacturing_date,
    b.expiry_date,
    DATEDIFF(b.expiry_date, CURDATE()) AS days_until_expiry,
    b.quantity AS batch_quantity,
    COALESCE(SUM(i.quantity), 0) AS inventory_quantity,
    CASE
        WHEN b.expiry_date < CURDATE() THEN 'EXPIRED'
        WHEN DATEDIFF(b.expiry_date, CURDATE()) <= 7 THEN 'CRITICAL'
        WHEN DATEDIFF(b.expiry_date, CURDATE()) <= 30 THEN 'WARNING'
        ELSE 'OK'
    END AS expiry_status
FROM batch b
JOIN product p ON b.product_id = p.product_id
LEFT JOIN inventory i ON b.batch_id = i.batch_id
WHERE b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
GROUP BY b.batch_id, b.batch_code, p.product_id, p.product_name,
         p.sku, b.manufacturing_date, b.expiry_date, b.quantity;

-- =============================================================
-- VIEW 5: vw_order_summary
-- Orders with customer info and item count
-- =============================================================
CREATE OR REPLACE VIEW vw_order_summary AS
SELECT
    o.order_id,
    c.customer_id,
    c.customer_name,
    c.city AS customer_city,
    o.order_date,
    o.total_amount,
    o.status,
    COUNT(od.order_detail_id) AS item_count,
    SUM(od.quantity) AS total_units
FROM orders o
JOIN customer c       ON o.customer_id = c.customer_id
JOIN order_details od ON o.order_id    = od.order_id
GROUP BY o.order_id, c.customer_id, c.customer_name, c.city,
         o.order_date, o.total_amount, o.status;

-- =============================================================
-- VIEW 6: vw_sales_by_product
-- Aggregated sales metrics per product
-- =============================================================
CREATE OR REPLACE VIEW vw_sales_by_product AS
SELECT
    p.product_id,
    p.product_name,
    p.sku,
    c.category_name,
    COUNT(DISTINCT o.order_id) AS order_count,
    SUM(od.quantity) AS total_units_sold,
    SUM(od.total_price) AS total_revenue,
    ROUND(AVG(od.unit_price), 2) AS avg_selling_price
FROM product p
JOIN category c        ON p.category_id  = c.category_id
JOIN order_details od  ON p.product_id   = od.product_id
JOIN orders o          ON od.order_id    = o.order_id
WHERE o.status IN ('delivered', 'shipped', 'processing')
GROUP BY p.product_id, p.product_name, p.sku, c.category_name;

-- =============================================================
-- VIEW 7: vw_purchase_overview
-- Purchase orders with supplier details
-- =============================================================
CREATE OR REPLACE VIEW vw_purchase_overview AS
SELECT
    pu.purchase_id,
    s.supplier_id,
    s.supplier_name,
    s.city AS supplier_city,
    pu.purchase_date,
    pu.total_amount,
    pu.status,
    COUNT(pd.purchase_detail_id) AS item_count,
    SUM(pd.quantity) AS total_units
FROM purchase pu
JOIN supplier s           ON pu.supplier_id = s.supplier_id
JOIN purchase_details pd  ON pu.purchase_id = pd.purchase_id
GROUP BY pu.purchase_id, s.supplier_id, s.supplier_name, s.city,
         pu.purchase_date, pu.total_amount, pu.status;

-- =============================================================
-- VIEW 8: vw_movement_log
-- Stock movements with from/to location names and user info
-- =============================================================
CREATE OR REPLACE VIEW vw_movement_log AS
SELECT
    sm.movement_id,
    p.product_name,
    p.sku,
    fl.location_name AS from_location,
    fl.location_type AS from_type,
    tl.location_name AS to_location,
    tl.location_type AS to_type,
    sm.quantity,
    sm.movement_type,
    sm.reason,
    u.user_name      AS moved_by,
    sm.movement_date
FROM stock_movement sm
JOIN product p   ON sm.product_id       = p.product_id
JOIN location fl ON sm.from_location_id = fl.location_id
JOIN location tl ON sm.to_location_id   = tl.location_id
JOIN `user` u    ON sm.changed_by       = u.user_id;
