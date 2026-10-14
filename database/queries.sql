-- Smart Inventory Management System - Test and Analytical Queries
USE smart_inventory;

-- ==========================================
-- Section 1: Basic Verification Queries
-- ==========================================

-- List all tables
SHOW TABLES;

-- Count of records in each table
SELECT 'category' AS table_name, COUNT(*) AS record_count FROM category
UNION ALL
SELECT 'product', COUNT(*) FROM product
UNION ALL
SELECT 'supplier', COUNT(*) FROM supplier
UNION ALL
SELECT 'location', COUNT(*) FROM location
UNION ALL
SELECT 'user', COUNT(*) FROM `user`
UNION ALL
SELECT 'customer', COUNT(*) FROM customer
UNION ALL
SELECT 'batch', COUNT(*) FROM batch
UNION ALL
SELECT 'purchase', COUNT(*) FROM purchase
UNION ALL
SELECT 'purchase_details', COUNT(*) FROM purchase_details
UNION ALL
SELECT 'inventory', COUNT(*) FROM inventory
UNION ALL
SELECT 'stock_movement', COUNT(*) FROM stock_movement
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
SELECT 'order_details', COUNT(*) FROM order_details
UNION ALL
SELECT 'audit_log', COUNT(*) FROM audit_log;


-- ==========================================
-- Section 2: Product Queries
-- ==========================================

-- All products with their category names (JOIN)
SELECT 
    p.product_id, 
    p.product_name, 
    p.sku, 
    c.category_name, 
    p.unit_price, 
    p.is_active 
FROM 
    product p
JOIN 
    category c ON p.category_id = c.category_id;

-- Products below reorder level (compare inventory sum vs reorder_level)
SELECT 
    p.product_id, 
    p.product_name, 
    p.reorder_level, 
    COALESCE(SUM(i.quantity), 0) AS total_inventory
FROM 
    product p
LEFT JOIN 
    inventory i ON p.product_id = i.product_id
GROUP BY 
    p.product_id, p.product_name, p.reorder_level
HAVING 
    total_inventory < p.reorder_level;

-- Inactive/discontinued products
SELECT 
    product_id, 
    product_name, 
    sku 
FROM 
    product 
WHERE 
    is_active = FALSE;

-- Products by category with count
SELECT 
    c.category_name, 
    COUNT(p.product_id) AS product_count 
FROM 
    category c
LEFT JOIN 
    product p ON c.category_id = p.category_id
GROUP BY 
    c.category_id, c.category_name;


-- ==========================================
-- Section 3: Inventory Queries
-- ==========================================

-- Current stock levels per product across all locations
SELECT 
    p.product_id, 
    p.product_name, 
    SUM(i.quantity) AS total_quantity 
FROM 
    inventory i
JOIN 
    product p ON i.product_id = p.product_id
GROUP BY 
    p.product_id, p.product_name;

-- Stock at each location
SELECT 
    l.location_name, 
    p.product_name, 
    i.quantity 
FROM 
    inventory i
JOIN 
    location l ON i.location_id = l.location_id
JOIN 
    product p ON i.product_id = p.product_id
ORDER BY 
    l.location_name, p.product_name;

-- Products with zero or critically low inventory
SELECT 
    p.product_name, 
    COALESCE(SUM(i.quantity), 0) AS total_quantity 
FROM 
    product p
LEFT JOIN 
    inventory i ON p.product_id = i.product_id
GROUP BY 
    p.product_id, p.product_name
HAVING 
    total_quantity <= 5;

-- Inventory value (quantity * unit_price) per location
SELECT 
    l.location_name, 
    SUM(i.quantity * p.unit_price) AS total_inventory_value
FROM 
    inventory i
JOIN 
    location l ON i.location_id = l.location_id
JOIN 
    product p ON i.product_id = p.product_id
GROUP BY 
    l.location_id, l.location_name;


-- ==========================================
-- Section 4: Batch & Expiry Queries
-- ==========================================

-- Expired batches (expiry_date < CURDATE())
SELECT 
    b.batch_id, 
    p.product_name, 
    b.batch_code, 
    b.expiry_date 
FROM 
    batch b
JOIN 
    product p ON b.product_id = p.product_id
WHERE 
    b.expiry_date < CURDATE();

-- Batches expiring within 7 days
SELECT 
    b.batch_id, 
    p.product_name, 
    b.batch_code, 
    b.expiry_date 
FROM 
    batch b
JOIN 
    product p ON b.product_id = p.product_id
WHERE 
    b.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY);

-- Batches expiring within 30 days
SELECT 
    b.batch_id, 
    p.product_name, 
    b.batch_code, 
    b.expiry_date 
FROM 
    batch b
JOIN 
    product p ON b.product_id = p.product_id
WHERE 
    b.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY);

-- Inventory with expired batches (JOIN inventory + batch)
SELECT 
    i.inventory_id, 
    l.location_name, 
    p.product_name, 
    b.batch_code, 
    i.quantity, 
    b.expiry_date
FROM 
    inventory i
JOIN 
    batch b ON i.batch_id = b.batch_id
JOIN 
    product p ON i.product_id = p.product_id
JOIN 
    location l ON i.location_id = l.location_id
WHERE 
    b.expiry_date < CURDATE() AND i.quantity > 0;


-- ==========================================
-- Section 5: Order & Sales Queries
-- ==========================================

-- Total sales per product (from order_details where order is delivered/shipped)
SELECT 
    p.product_name, 
    SUM(od.quantity) AS total_quantity_sold, 
    SUM(od.total_price) AS total_sales_amount
FROM 
    order_details od
JOIN 
    orders o ON od.order_id = o.order_id
JOIN 
    product p ON od.product_id = p.product_id
WHERE 
    o.status IN ('shipped', 'delivered')
GROUP BY 
    p.product_id, p.product_name;

-- Top 10 best-selling products
SELECT 
    p.product_name, 
    SUM(od.quantity) AS total_sold
FROM 
    order_details od
JOIN 
    orders o ON od.order_id = o.order_id
JOIN 
    product p ON od.product_id = p.product_id
WHERE 
    o.status IN ('shipped', 'delivered')
GROUP BY 
    p.product_id, p.product_name
ORDER BY 
    total_sold DESC
LIMIT 10;

-- Non-selling products (products with no order_details)
SELECT 
    p.product_name, 
    p.sku 
FROM 
    product p
LEFT JOIN 
    order_details od ON p.product_id = od.product_id
WHERE 
    od.order_detail_id IS NULL;

-- Daily sales trend
SELECT 
    DATE(o.order_date) AS sales_date, 
    COUNT(o.order_id) AS total_orders, 
    SUM(o.total_amount) AS daily_revenue
FROM 
    orders o
WHERE 
    o.status != 'cancelled'
GROUP BY 
    DATE(o.order_date)
ORDER BY 
    sales_date ASC;

-- Top 5 customers by order value
SELECT 
    c.customer_name, 
    SUM(o.total_amount) AS total_spent
FROM 
    orders o
JOIN 
    customer c ON o.customer_id = c.customer_id
WHERE 
    o.status != 'cancelled'
GROUP BY 
    c.customer_id, c.customer_name
ORDER BY 
    total_spent DESC
LIMIT 5;

-- Orders by status count
SELECT 
    status, 
    COUNT(*) AS order_count 
FROM 
    orders 
GROUP BY 
    status;


-- ==========================================
-- Section 6: Purchase Queries
-- ==========================================

-- Purchase history with supplier names
SELECT 
    p.purchase_id, 
    s.supplier_name, 
    p.purchase_date, 
    p.total_amount, 
    p.status 
FROM 
    purchase p
JOIN 
    supplier s ON p.supplier_id = s.supplier_id
ORDER BY 
    p.purchase_date DESC;

-- Total purchase amount per supplier
SELECT 
    s.supplier_name, 
    SUM(p.total_amount) AS total_purchased
FROM 
    purchase p
JOIN 
    supplier s ON p.supplier_id = s.supplier_id
WHERE 
    p.status = 'received'
GROUP BY 
    s.supplier_id, s.supplier_name;

-- Pending purchases
SELECT 
    p.purchase_id, 
    s.supplier_name, 
    p.purchase_date, 
    p.total_amount 
FROM 
    purchase p
JOIN 
    supplier s ON p.supplier_id = s.supplier_id
WHERE 
    p.status = 'pending';


-- ==========================================
-- Section 7: Stock Movement Queries
-- ==========================================

-- All movements with location names (JOIN location twice for from/to)
SELECT 
    sm.movement_id, 
    p.product_name, 
    lf.location_name AS from_location, 
    lt.location_name AS to_location, 
    sm.quantity, 
    sm.movement_type, 
    sm.movement_date
FROM 
    stock_movement sm
JOIN 
    product p ON sm.product_id = p.product_id
LEFT JOIN 
    location lf ON sm.from_location_id = lf.location_id
LEFT JOIN 
    location lt ON sm.to_location_id = lt.location_id
ORDER BY 
    sm.movement_date DESC;

-- Movements by type
SELECT 
    movement_type, 
    COUNT(*) AS movement_count 
FROM 
    stock_movement 
GROUP BY 
    movement_type;

-- Recent movements (last 7 days)
SELECT 
    sm.movement_id, 
    p.product_name, 
    sm.quantity, 
    sm.movement_type, 
    sm.movement_date 
FROM 
    stock_movement sm
JOIN 
    product p ON sm.product_id = p.product_id
WHERE 
    sm.movement_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY);


-- ==========================================
-- Section 8: Analytical / Aggregate Queries
-- ==========================================

-- Category-wise inventory summary
SELECT 
    c.category_name, 
    SUM(i.quantity) AS total_items_in_stock
FROM 
    inventory i
JOIN 
    product p ON i.product_id = p.product_id
JOIN 
    category c ON p.category_id = c.category_id
GROUP BY 
    c.category_id, c.category_name;

-- Location utilization (total stock vs capacity)
SELECT 
    l.location_name, 
    l.capacity, 
    COALESCE(SUM(i.quantity), 0) AS current_stock,
    (COALESCE(SUM(i.quantity), 0) / l.capacity) * 100 AS utilization_percentage
FROM 
    location l
LEFT JOIN 
    inventory i ON l.location_id = i.location_id
GROUP BY 
    l.location_id, l.location_name, l.capacity;

-- Fast-moving products (ordered > 10 times)
SELECT 
    p.product_name, 
    COUNT(od.order_id) AS order_count
FROM 
    product p
JOIN 
    order_details od ON p.product_id = od.product_id
GROUP BY 
    p.product_id, p.product_name
HAVING 
    order_count > 10;

-- Slow-moving products (ordered < 3 times or never)
SELECT 
    p.product_name, 
    COUNT(od.order_id) AS order_count
FROM 
    product p
LEFT JOIN 
    order_details od ON p.product_id = od.product_id
GROUP BY 
    p.product_id, p.product_name
HAVING 
    order_count < 3;

-- Monthly revenue trend
SELECT 
    DATE_FORMAT(o.order_date, '%Y-%m') AS month, 
    SUM(o.total_amount) AS revenue
FROM 
    orders o
WHERE 
    o.status IN ('shipped', 'delivered', 'processing', 'pending')
GROUP BY 
    month
ORDER BY 
    month;

-- Average order value
SELECT 
    AVG(total_amount) AS average_order_value 
FROM 
    orders 
WHERE 
    status != 'cancelled';


-- ==========================================
-- Section 9: Complex Queries
-- ==========================================

-- Products that are both low-stock AND fast-selling (critical reorder)
WITH ProductSales AS (
    SELECT 
        product_id, 
        COUNT(order_id) AS times_ordered
    FROM 
        order_details
    GROUP BY 
        product_id
), ProductInventory AS (
    SELECT 
        product_id, 
        COALESCE(SUM(quantity), 0) AS total_stock
    FROM 
        inventory
    GROUP BY 
        product_id
)
SELECT 
    p.product_name, 
    pi.total_stock, 
    p.reorder_level, 
    ps.times_ordered
FROM 
    product p
JOIN 
    ProductInventory pi ON p.product_id = pi.product_id
JOIN 
    ProductSales ps ON p.product_id = ps.product_id
WHERE 
    pi.total_stock <= p.reorder_level 
    AND ps.times_ordered > 5;

-- Supplier performance (delivery rate: received vs total purchases)
SELECT 
    s.supplier_name,
    COUNT(p.purchase_id) AS total_orders,
    SUM(CASE WHEN p.status = 'received' THEN 1 ELSE 0 END) AS received_orders,
    (SUM(CASE WHEN p.status = 'received' THEN 1 ELSE 0 END) / COUNT(p.purchase_id)) * 100 AS delivery_rate_percentage
FROM 
    supplier s
LEFT JOIN 
    purchase p ON s.supplier_id = p.supplier_id
GROUP BY 
    s.supplier_id, s.supplier_name;

-- Stock valuation per location (inventory quantity * product unit_price)
SELECT 
    l.location_name, 
    SUM(i.quantity * p.unit_price) AS location_stock_value
FROM 
    inventory i
JOIN 
    location l ON i.location_id = l.location_id
JOIN 
    product p ON i.product_id = p.product_id
GROUP BY 
    l.location_id, l.location_name;

-- Products available at multiple locations with quantities
SELECT 
    p.product_name,
    COUNT(DISTINCT i.location_id) AS locations_count,
    GROUP_CONCAT(CONCAT(l.location_name, ': ', i.quantity) SEPARATOR ', ') AS location_quantities
FROM 
    product p
JOIN 
    inventory i ON p.product_id = i.product_id
JOIN 
    location l ON i.location_id = l.location_id
WHERE 
    i.quantity > 0
GROUP BY 
    p.product_id, p.product_name
HAVING 
    locations_count > 1;
