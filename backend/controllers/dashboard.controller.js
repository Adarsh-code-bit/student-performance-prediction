const pool = require('../config/db.config');

/**
 * GET /api/dashboard/stats
 * Aggregated stats for the dashboard cards.
 */
exports.getStats = async (req, res) => {
  try {
    const [[products]] = await pool.query('SELECT COUNT(*) AS count FROM product WHERE is_active = TRUE');
    const [[inventoryTotal]] = await pool.query('SELECT COALESCE(SUM(quantity), 0) AS total FROM inventory');
    const [[lowStock]] = await pool.query(`
      SELECT COUNT(DISTINCT p.product_id) AS count 
      FROM product p 
      LEFT JOIN inventory i ON p.product_id = i.product_id 
      WHERE p.is_active = TRUE 
      GROUP BY p.product_id 
      HAVING COALESCE(SUM(i.quantity), 0) <= MAX(p.reorder_level)
    `);
    const [[nearExpiry]] = await pool.query(`
      SELECT COUNT(*) AS count FROM batch 
      WHERE expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
    `);
    const [[expired]] = await pool.query('SELECT COUNT(*) AS count FROM batch WHERE expiry_date < CURDATE()');
    const [[todayOrders]] = await pool.query(`
      SELECT COUNT(*) AS count FROM orders WHERE DATE(order_date) = CURDATE()
    `);
    const [[customers]] = await pool.query('SELECT COUNT(*) AS count FROM customer');
    const [[suppliers]] = await pool.query('SELECT COUNT(*) AS count FROM supplier WHERE is_active = TRUE');

    // Use a subquery approach for lowStock count to handle potential null
    const [[lowStockCount]] = await pool.query(`
      SELECT COUNT(*) AS count FROM (
        SELECT p.product_id
        FROM product p 
        LEFT JOIN inventory i ON p.product_id = i.product_id 
        WHERE p.is_active = TRUE 
        GROUP BY p.product_id 
        HAVING COALESCE(SUM(i.quantity), 0) <= MAX(p.reorder_level)
      ) AS low_stock_products
    `);

    res.json({
      success: true,
      data: {
        totalProducts: products?.count || 0,
        totalInventory: inventoryTotal?.total || 0,
        lowStock: lowStockCount?.count || 0,
        nearExpiry: nearExpiry?.count || 0,
        expired: expired?.count || 0,
        todayOrders: todayOrders?.count || 0,
        totalCustomers: customers?.count || 0,
        totalSuppliers: suppliers?.count || 0,
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats' });
  }
};

/**
 * GET /api/dashboard/sales-chart?days=7|30|90
 * Daily sales data for chart.
 */
exports.getSalesChart = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const [rows] = await pool.query(`
      SELECT DATE(order_date) AS date, 
             COUNT(*) AS orders, 
             COALESCE(SUM(total_amount), 0) AS revenue
      FROM orders 
      WHERE order_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        AND status != 'cancelled'
      GROUP BY DATE(order_date)
      ORDER BY date ASC
    `, [days]);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Sales chart error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch sales data' });
  }
};

/**
 * GET /api/dashboard/inventory-status
 * Breakdown of inventory health.
 */
exports.getInventoryStatus = async (req, res) => {
  try {
    const [[healthy]] = await pool.query(`
      SELECT COUNT(*) AS count FROM (
        SELECT p.product_id FROM product p
        JOIN inventory i ON p.product_id = i.product_id
        JOIN batch b ON i.batch_id = b.batch_id
        WHERE p.is_active = TRUE AND i.quantity > p.reorder_level AND b.expiry_date > DATE_ADD(CURDATE(), INTERVAL 30 DAY)
        GROUP BY p.product_id
      ) t
    `);
    const [[lowStock]] = await pool.query(`
      SELECT COUNT(*) AS count FROM (
        SELECT p.product_id FROM product p
        LEFT JOIN inventory i ON p.product_id = i.product_id
        WHERE p.is_active = TRUE
        GROUP BY p.product_id
        HAVING COALESCE(SUM(i.quantity), 0) <= MAX(p.reorder_level) AND COALESCE(SUM(i.quantity), 0) > 0
      ) t
    `);
    const [[nearExpiry]] = await pool.query(`
      SELECT COUNT(DISTINCT i.product_id) AS count FROM inventory i
      JOIN batch b ON i.batch_id = b.batch_id
      WHERE i.quantity > 0 AND b.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
    `);
    const [[expired]] = await pool.query(`
      SELECT COUNT(DISTINCT i.product_id) AS count FROM inventory i
      JOIN batch b ON i.batch_id = b.batch_id
      WHERE i.quantity > 0 AND b.expiry_date < CURDATE()
    `);
    const [[outOfStock]] = await pool.query(`
      SELECT COUNT(*) AS count FROM (
        SELECT p.product_id FROM product p
        LEFT JOIN inventory i ON p.product_id = i.product_id
        WHERE p.is_active = TRUE
        GROUP BY p.product_id
        HAVING COALESCE(SUM(i.quantity), 0) = 0
      ) t
    `);

    res.json({
      success: true,
      data: [
        { name: 'Healthy', value: healthy?.count || 0, color: '#10B981' },
        { name: 'Low Stock', value: lowStock?.count || 0, color: '#F59E0B' },
        { name: 'Near Expiry', value: nearExpiry?.count || 0, color: '#F97316' },
        { name: 'Expired', value: expired?.count || 0, color: '#EF4444' },
        { name: 'Out of Stock', value: outOfStock?.count || 0, color: '#6B7280' },
      ]
    });
  } catch (error) {
    console.error('Inventory status error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch inventory status' });
  }
};

/**
 * GET /api/dashboard/top-selling
 * Top 10 best-selling products by quantity.
 */
exports.getTopSelling = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.product_id, p.product_name, p.sku, c.category_name,
             SUM(od.quantity) AS total_sold, SUM(od.total_price) AS total_revenue
      FROM order_details od
      JOIN product p ON od.product_id = p.product_id
      JOIN category c ON p.category_id = c.category_id
      JOIN orders o ON od.order_id = o.order_id
      WHERE o.status IN ('delivered', 'shipped', 'processing', 'pending')
      GROUP BY p.product_id, p.product_name, p.sku, c.category_name
      ORDER BY total_sold DESC
      LIMIT 10
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Top selling error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch top selling products' });
  }
};

/**
 * GET /api/dashboard/low-stock
 * Products that are at or below reorder level.
 */
exports.getLowStock = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.product_id, p.product_name, p.sku, p.unit, p.reorder_level,
             c.category_name, COALESCE(SUM(i.quantity), 0) AS current_stock
      FROM product p
      JOIN category c ON p.category_id = c.category_id
      LEFT JOIN inventory i ON p.product_id = i.product_id
      WHERE p.is_active = TRUE
      GROUP BY p.product_id, p.product_name, p.sku, p.unit, p.reorder_level, c.category_name
      HAVING current_stock <= p.reorder_level
      ORDER BY current_stock ASC
      LIMIT 10
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Low stock error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch low stock products' });
  }
};

/**
 * GET /api/dashboard/recent-orders
 * Last 10 orders with customer info.
 */
exports.getRecentOrders = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT o.order_id, o.order_date, o.total_amount, o.status,
             c.customer_name, c.city,
             (SELECT COUNT(*) FROM order_details od WHERE od.order_id = o.order_id) AS item_count
      FROM orders o
      JOIN customer c ON o.customer_id = c.customer_id
      ORDER BY o.order_date DESC
      LIMIT 10
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Recent orders error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch recent orders' });
  }
};

/**
 * GET /api/dashboard/recent-movements
 * Last 10 stock movements.
 */
exports.getRecentMovements = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT sm.movement_id, sm.quantity, sm.movement_type, sm.reason, sm.movement_date,
             p.product_name, p.sku,
             fl.location_name AS from_location,
             tl.location_name AS to_location,
             u.user_name AS moved_by
      FROM stock_movement sm
      JOIN product p ON sm.product_id = p.product_id
      JOIN location fl ON sm.from_location_id = fl.location_id
      JOIN location tl ON sm.to_location_id = tl.location_id
      JOIN \`user\` u ON sm.changed_by = u.user_id
      ORDER BY sm.movement_date DESC
      LIMIT 10
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Recent movements error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch recent movements' });
  }
};
