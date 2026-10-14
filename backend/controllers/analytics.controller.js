const pool = require('../config/db.config');

exports.getDashboard = async (req, res) => {
  try {
    const [[{ lowStockCount }]] = await pool.query(`
      SELECT COUNT(*) as lowStockCount 
      FROM product p 
      JOIN (SELECT product_id, SUM(quantity) as total_qty FROM inventory GROUP BY product_id) i ON p.product_id = i.product_id 
      WHERE i.total_qty <= p.reorder_level
    `);
    const [[{ nearExpiryCount }]] = await pool.query(`
      SELECT COUNT(*) as nearExpiryCount 
      FROM batch 
      WHERE expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
    `);
    const [[{ expiredCount }]] = await pool.query(`
      SELECT COUNT(*) as expiredCount 
      FROM batch 
      WHERE expiry_date < CURDATE()
    `);
    const [[{ topSelling }]] = await pool.query(`
      SELECT p.product_name 
      FROM order_details od 
      JOIN product p ON od.product_id = p.product_id 
      GROUP BY od.product_id 
      ORDER BY SUM(od.quantity) DESC LIMIT 1
    `);
    const [[{ todayOrders }]] = await pool.query(`
      SELECT COUNT(*) as todayOrders 
      FROM orders 
      WHERE DATE(order_date) = CURDATE()
    `);

    res.json({
      success: true,
      data: {
        lowStockCount: lowStockCount || 0,
        nearExpiryCount: nearExpiryCount || 0,
        expiredCount: expiredCount || 0,
        topSellingProduct: topSelling ? topSelling.product_name : 'N/A',
        todayOrders: todayOrders || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getLowStock = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.product_name, COALESCE(SUM(i.quantity), 0) as current_stock, p.reorder_level, 'Low Stock' as status
      FROM product p 
      LEFT JOIN inventory i ON p.product_id = i.product_id 
      GROUP BY p.product_id 
      HAVING current_stock <= p.reorder_level
      ORDER BY current_stock ASC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getReorder = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.product_name, COALESCE(SUM(i.quantity), 0) as current_stock, p.reorder_level, 
             GREATEST((p.reorder_level * 2) - COALESCE(SUM(i.quantity), 0), 0) as suggested_quantity
      FROM product p 
      LEFT JOIN inventory i ON p.product_id = i.product_id 
      GROUP BY p.product_id 
      HAVING suggested_quantity > 0
      ORDER BY suggested_quantity DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getExpired = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.product_name, b.batch_code, b.expiry_date, b.quantity, DATEDIFF(CURDATE(), b.expiry_date) as days_expired
      FROM batch b 
      JOIN product p ON b.product_id = p.product_id 
      WHERE b.expiry_date < CURDATE() AND b.quantity > 0
      ORDER BY days_expired DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getNearExpiry = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.product_name, b.batch_code, b.expiry_date, b.quantity, DATEDIFF(b.expiry_date, CURDATE()) as remaining_days
      FROM batch b 
      JOIN product p ON b.product_id = p.product_id 
      WHERE b.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) AND b.quantity > 0
      ORDER BY remaining_days ASC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getFastMoving = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const [rows] = await pool.query(`
      SELECT p.product_name, SUM(od.quantity) as units_sold, COUNT(DISTINCT o.order_id) as number_of_orders, SUM(od.total_price) as sales_amount
      FROM order_details od 
      JOIN orders o ON od.order_id = o.order_id 
      JOIN product p ON od.product_id = p.product_id 
      WHERE o.order_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY p.product_id 
      ORDER BY units_sold DESC
    `, [days]);
    
    // Add Rank
    const data = rows.map((row, index) => ({ rank: index + 1, ...row }));
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSlowMoving = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const [rows] = await pool.query(`
      SELECT p.product_name, 
             MAX(o.order_date) as last_sale_date, 
             COALESCE(SUM(od.quantity), 0) as units_sold,
             COALESCE(DATEDIFF(CURDATE(), MAX(o.order_date)), ?) as days_since_last_sale,
             'Slow/Non-selling' as status
      FROM product p
      LEFT JOIN order_details od ON p.product_id = od.product_id
      LEFT JOIN orders o ON od.order_id = o.order_id AND o.order_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY p.product_id
      HAVING units_sold = 0
      ORDER BY days_since_last_sale DESC
    `, [days, days]);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
