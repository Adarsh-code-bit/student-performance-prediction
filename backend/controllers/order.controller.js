const pool = require('../config/db.config');
const { parseId } = require('../utils/validate.util');
const { planBatchDeductions } = require('../utils/stock.util');

// Valid status pipeline transitions
const ALLOWED_TRANSITIONS = {
  'pending': ['confirmed', 'picking_queue', 'cancelled', 'processing'],
  'processing': ['confirmed', 'picking_queue', 'picked', 'shipped', 'cancelled'],
  'confirmed': ['picking_queue', 'picking_in_progress', 'cancelled'],
  'picking_queue': ['picking_in_progress', 'cancelled'],
  'picking_in_progress': ['picked', 'picking_queue', 'cancelled'],
  'picked': ['packing_in_progress', 'packed', 'cancelled'],
  'packing_in_progress': ['packed', 'picked', 'cancelled'],
  'packed': ['ready_for_dispatch', 'dispatched', 'shipped', 'cancelled'],
  'ready_for_dispatch': ['dispatched', 'shipped', 'cancelled'],
  'dispatched': ['delivered', 'cancelled'],
  'shipped': ['delivered', 'cancelled'],
  'delivered': [],
  'cancelled': []
};

exports.getAll = async (req, res) => {
  try {
    const { status, store_id } = req.query;
    let query = `
      SELECT o.*, c.customer_name,
             picker.user_name AS picker_name,
             packer.user_name AS packer_name,
             s.store_name,
             (SELECT COUNT(*) FROM order_details od WHERE od.order_id = o.order_id) AS items_count
      FROM orders o 
      JOIN customer c ON o.customer_id = c.customer_id
      LEFT JOIN \`user\` picker ON o.assigned_picker_id = picker.user_id
      LEFT JOIN \`user\` packer ON o.assigned_packer_id = packer.user_id
      LEFT JOIN store s ON o.store_id = s.store_id
    `;
    const params = [];
    const conditions = [];

    if (status) {
      conditions.push('o.status = ?');
      params.push(status);
    }

    // Store scoping: Store Manager and Staff see their assigned store; Admin can view all
    const userStoreId = req.user.role === 'ADMIN' ? store_id : req.user.store_id;
    if (userStoreId) {
      conditions.push('(o.store_id = ? OR o.store_id IS NULL)');
      params.push(userStoreId);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }

    query += ` ORDER BY o.order_date DESC`;

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const orderId = parseId(req.params.id);
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    const [orderRows] = await pool.query(`
      SELECT o.*, c.customer_name, c.phone AS customer_phone,
             picker.user_name AS picker_name,
             packer.user_name AS packer_name,
             s.store_name
      FROM orders o 
      JOIN customer c ON o.customer_id = c.customer_id
      LEFT JOIN \`user\` picker ON o.assigned_picker_id = picker.user_id
      LEFT JOIN \`user\` packer ON o.assigned_packer_id = packer.user_id
      LEFT JOIN store s ON o.store_id = s.store_id
      WHERE o.order_id = ?
    `, [orderId]);

    if (orderRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Get item details with location / rack info for quick-commerce picking
    const [detailsRows] = await pool.query(`
      SELECT od.*, p.product_name, p.sku, p.unit, p.image_url,
             l.rack_number, l.zone, l.location_name
      FROM order_details od 
      JOIN product p ON od.product_id = p.product_id
      LEFT JOIN inventory inv ON p.product_id = inv.product_id AND inv.quantity > 0
      LEFT JOIN location l ON inv.location_id = l.location_id
      WHERE od.order_id = ?
      GROUP BY od.order_detail_id
    `, [orderId]);

    const order = orderRows[0];
    order.items = detailsRows;

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/orders/queue/picking
 * Picking queue for Pickers and active temporary Pickers.
 */
exports.getPickingQueue = async (req, res) => {
  try {
    const storeId = req.user.role === 'ADMIN' ? (req.query.store_id || 1) : (req.user.store_id || 1);

    const [rows] = await pool.query(`
      SELECT o.*, c.customer_name,
             picker.user_name AS picker_name,
             (SELECT COUNT(*) FROM order_details od WHERE od.order_id = o.order_id) AS items_count
      FROM orders o
      JOIN customer c ON o.customer_id = c.customer_id
      LEFT JOIN \`user\` picker ON o.assigned_picker_id = picker.user_id
      WHERE (o.store_id = ? OR o.store_id IS NULL)
        AND o.status IN ('pending', 'confirmed', 'picking_queue', 'picking_in_progress')
      ORDER BY FIELD(o.status, 'picking_in_progress', 'picking_queue', 'confirmed', 'pending'), o.order_date ASC
    `, [storeId]);

    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/orders/queue/packing
 * Packing queue for Packers.
 */
exports.getPackingQueue = async (req, res) => {
  try {
    const storeId = req.user.role === 'ADMIN' ? (req.query.store_id || 1) : (req.user.store_id || 1);

    const [rows] = await pool.query(`
      SELECT o.*, c.customer_name,
             picker.user_name AS picker_name,
             packer.user_name AS packer_name,
             (SELECT COUNT(*) FROM order_details od WHERE od.order_id = o.order_id) AS items_count
      FROM orders o
      JOIN customer c ON o.customer_id = c.customer_id
      LEFT JOIN \`user\` picker ON o.assigned_picker_id = picker.user_id
      LEFT JOIN \`user\` packer ON o.assigned_packer_id = packer.user_id
      WHERE (o.store_id = ? OR o.store_id IS NULL)
        AND o.status IN ('picked', 'packing_in_progress')
      ORDER BY FIELD(o.status, 'packing_in_progress', 'picked'), o.order_date ASC
    `, [storeId]);

    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/orders/:id/claim-picking
 * Picker claims an order from the queue and begins picking.
 */
exports.claimPicking = async (req, res) => {
  try {
    const orderId = parseId(req.params.id);
    if (!orderId) return res.status(400).json({ success: false, message: 'Invalid order ID' });

    const [rows] = await pool.query('SELECT order_id, status, assigned_picker_id FROM orders WHERE order_id = ?', [orderId]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Order not found' });

    const order = rows[0];
    if (!['pending', 'confirmed', 'picking_queue'].includes(order.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Order cannot be claimed for picking (Current status: ${order.status})` 
      });
    }

    await pool.query(
      `UPDATE orders 
       SET status = 'picking_in_progress', assigned_picker_id = ? 
       WHERE order_id = ?`,
      [req.user.user_id, orderId]
    );

    await pool.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, details)
       VALUES (?, 'UPDATE', 'orders', ?, ?)`,
      [req.user.user_id, orderId, `Picker ${req.user.user_name} claimed Order #${orderId} for picking.`]
    );

    res.json({ 
      success: true, 
      message: `Order #${orderId} claimed. Picking in progress.`,
      data: { order_id: orderId, status: 'picking_in_progress' }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/orders/:id/complete-picking
 * Picker verifies all items and marks picking complete.
 */
exports.completePicking = async (req, res) => {
  try {
    const orderId = parseId(req.params.id);
    if (!orderId) return res.status(400).json({ success: false, message: 'Invalid order ID' });

    const [rows] = await pool.query('SELECT order_id, status FROM orders WHERE order_id = ?', [orderId]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Order not found' });

    const order = rows[0];
    if (order.status !== 'picking_in_progress') {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot complete picking. Order must be in 'picking_in_progress' (Current status: ${order.status})` 
      });
    }

    await pool.query(
      `UPDATE orders 
       SET status = 'picked', picked_at = NOW() 
       WHERE order_id = ?`,
      [orderId]
    );

    await pool.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, details)
       VALUES (?, 'UPDATE', 'orders', ?, ?)`,
      [req.user.user_id, orderId, `Picker ${req.user.user_name} completed picking for Order #${orderId}. Ready for packing.`]
    );

    res.json({ 
      success: true, 
      message: `Order #${orderId} picked successfully. Ready for packing queue.`,
      data: { order_id: orderId, status: 'picked' }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/orders/:id/claim-packing
 * Packer claims a picked order and begins packing verification.
 */
exports.claimPacking = async (req, res) => {
  try {
    const orderId = parseId(req.params.id);
    if (!orderId) return res.status(400).json({ success: false, message: 'Invalid order ID' });

    const [rows] = await pool.query('SELECT order_id, status FROM orders WHERE order_id = ?', [orderId]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Order not found' });

    const order = rows[0];
    if (order.status !== 'picked') {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot pack order. Picking must be complete first (Current status: ${order.status})` 
      });
    }

    await pool.query(
      `UPDATE orders 
       SET status = 'packing_in_progress', assigned_packer_id = ? 
       WHERE order_id = ?`,
      [req.user.user_id, orderId]
    );

    await pool.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, details)
       VALUES (?, 'UPDATE', 'orders', ?, ?)`,
      [req.user.user_id, orderId, `Packer ${req.user.user_name} claimed Order #${orderId} for packing.`]
    );

    res.json({ 
      success: true, 
      message: `Order #${orderId} claimed. Packing in progress.`,
      data: { order_id: orderId, status: 'packing_in_progress' }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/orders/:id/complete-packing
 * Packer finishes packing and seals order for dispatch.
 */
exports.completePacking = async (req, res) => {
  try {
    const orderId = parseId(req.params.id);
    if (!orderId) return res.status(400).json({ success: false, message: 'Invalid order ID' });

    const [rows] = await pool.query('SELECT order_id, status FROM orders WHERE order_id = ?', [orderId]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Order not found' });

    const order = rows[0];
    if (order.status !== 'packing_in_progress') {
      return res.status(400).json({ 
        success: false, 
        message: `Order must be in 'packing_in_progress' to complete packing (Current status: ${order.status})` 
      });
    }

    await pool.query(
      `UPDATE orders 
       SET status = 'packed', packed_at = NOW() 
       WHERE order_id = ?`,
      [orderId]
    );

    await pool.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, details)
       VALUES (?, 'UPDATE', 'orders', ?, ?)`,
      [req.user.user_id, orderId, `Packer ${req.user.user_name} completed packing for Order #${orderId}. Sealed for dispatch.`]
    );

    res.json({ 
      success: true, 
      message: `Order #${orderId} packed and ready for dispatch.`,
      data: { order_id: orderId, status: 'packed' }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/orders/:id/status
 * Updates status with transition validation.
 */
exports.updateStatus = async (req, res) => {
  try {
    const orderId = parseId(req.params.id);
    const { status } = req.body;
    if (!orderId || typeof status !== 'string' || !Object.hasOwn(ALLOWED_TRANSITIONS, status)) {
      return res.status(400).json({ success: false, message: 'Valid order ID and status are required' });
    }
    const isAdmin = String(req.user.role).toUpperCase() === 'ADMIN';
    const where = isAdmin ? 'order_id = ?' : 'order_id = ? AND store_id = ?';
    const params = isAdmin ? [orderId] : [orderId, req.user.store_id];
    const [rows] = await pool.query(`SELECT order_id, status FROM orders WHERE ${where}`, params);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Order not found' });
    const currentStatus = rows[0].status;
    if (!(ALLOWED_TRANSITIONS[currentStatus] || []).includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status transition from '${currentStatus}' to '${status}'.` });
    }
    await pool.query(`UPDATE orders SET status = ? WHERE ${where}`, [status, ...params]);
    return res.json({ success: true, message: `Order #${orderId} status updated to '${status}'.` });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to update order status' });
  }
};
exports.create = async (req, res) => {
  const { customer_id, shipping_address, items, store_id } = req.body;

  if (!customer_id || !shipping_address || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  for (const item of items) {
    if (!Number.isInteger(Number(item.product_id)) || Number(item.product_id) <= 0 || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0) {
      return res.status(400).json({ success: false, message: 'Each item requires a valid product_id and positive integer quantity' });
    }
  }
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    let totalAmount = 0;
    
    // Process items, fetch prices and check inventory
    for (const item of items) {
      const [productRows] = await connection.query(
        `SELECT unit_price, product_name FROM product WHERE product_id = ?`,
        [item.product_id]
      );
      if (productRows.length === 0) {
        throw new Error(`Product not found for ID: ${item.product_id}`);
      }
      
      item.unit_price = productRows[0].unit_price;
      totalAmount += (item.quantity * item.unit_price);
    }

    // Insert Order with initial status 'confirmed' (or 'pending')
    const orderStoreId = store_id || req.user?.store_id || 1;
    const [orderResult] = await connection.query(
      `INSERT INTO orders (customer_id, store_id, order_date, total_amount, status, shipping_address) 
       VALUES (?, ?, NOW(), ?, 'confirmed', ?)`,
      [customer_id, orderStoreId, totalAmount, shipping_address]
    );
    const orderId = orderResult.insertId;

    // Process order details and reduce inventory
    for (const item of items) {
      const totalPrice = item.quantity * item.unit_price;
      
      await connection.query(
        `INSERT INTO order_details (order_id, product_id, quantity, unit_price, total_price) 
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.product_id, item.quantity, item.unit_price, totalPrice]
      );

      // Lock eligible batches and allocate by earliest expiry (FEFO).
      const [invRows] = await connection.query(
        `SELECT i.inventory_id, i.quantity, b.expiry_date
         FROM inventory i
         JOIN batch b ON b.batch_id = i.batch_id
         WHERE i.product_id = ? AND i.quantity > 0 AND b.expiry_date >= CURDATE()
         ORDER BY b.expiry_date ASC, i.inventory_id ASC
         FOR UPDATE`,
        [item.product_id]
      );
      const deductions = planBatchDeductions(invRows, Number(item.quantity));
      for (const deduction of deductions) {
        await connection.query('UPDATE inventory SET quantity = quantity - ? WHERE inventory_id = ?', [deduction.quantity, deduction.inventory_id]);
      }
    }

    await connection.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, details) 
       VALUES (?, 'INSERT', 'orders', ?, ?)`,
      [req.user?.user_id || 1, orderId, `Created order #${orderId} with ${items.length} items for ₹${totalAmount}`]
    );

    await connection.commit();
    res.status(201).json({ 
      success: true, 
      message: 'Order created successfully',
      data: { insertId: orderId, order_id: orderId }
    });
  } catch (error) {
    await connection.rollback();
    res.status(400).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};




