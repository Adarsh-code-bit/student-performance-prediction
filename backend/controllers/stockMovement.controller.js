const pool = require('../config/db.config');
const { parseId } = require('../utils/validate.util');

exports.getAll = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT sm.*, p.product_name, p.sku,
             fl.location_name AS from_location_name, fl.location_type AS from_location_type,
             tl.location_name AS to_location_name, tl.location_type AS to_location_type,
             u.user_name AS changed_by_name
      FROM stock_movement sm
      JOIN product p ON sm.product_id = p.product_id
      JOIN location fl ON sm.from_location_id = fl.location_id
      JOIN location tl ON sm.to_location_id = tl.location_id
      JOIN \`user\` u ON sm.changed_by = u.user_id
      ORDER BY sm.movement_date DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.create = async (req, res) => {
  const { product_id, from_location_id, to_location_id, quantity, movement_type, reason, changed_by } = req.body;

  if (!product_id || !from_location_id || !to_location_id || !quantity || !movement_type || !changed_by) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  if (from_location_id === to_location_id) {
    return res.status(400).json({ success: false, message: 'Source and destination locations cannot be the same' });
  }

  const validMovementTypes = ['transfer', 'restock', 'return', 'disposal'];
  if (!validMovementTypes.includes(movement_type)) {
    return res.status(400).json({ success: false, message: 'Invalid movement type' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Check inventory at from_location
    const [invCheckRows] = await connection.query(
      `SELECT SUM(quantity) as totalStock 
       FROM inventory 
       WHERE product_id = ? AND location_id = ?`,
      [product_id, from_location_id]
    );

    const totalStock = invCheckRows[0].totalStock || 0;
    if (totalStock < quantity) {
      throw new Error('Insufficient stock at source location');
    }

    // Reduce inventory at from_location FIFO
    let remaining = quantity;
    const [invRows] = await connection.query(
      `SELECT inventory_id, quantity 
       FROM inventory 
       WHERE product_id = ? AND location_id = ? AND quantity > 0 
       ORDER BY inventory_id ASC`,
      [product_id, from_location_id]
    );

    for (const inv of invRows) {
      if (remaining <= 0) break;
      const deduct = Math.min(remaining, inv.quantity);
      await connection.query(
        `UPDATE inventory SET quantity = quantity - ? WHERE inventory_id = ?`,
        [deduct, inv.inventory_id]
      );
      remaining -= deduct;
    }

    // Get a valid batch_id for the product
    const [batchRows] = await connection.query(
      `SELECT batch_id FROM batch WHERE product_id = ? LIMIT 1`,
      [product_id]
    );
    const batchId = batchRows.length > 0 ? batchRows[0].batch_id : null;

    // Increase inventory at to_location
    await connection.query(
      `INSERT INTO inventory (product_id, batch_id, location_id, quantity) 
       VALUES (?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
      [product_id, batchId, to_location_id, quantity]
    );

    // Record Stock Movement
    const [movementResult] = await connection.query(
      `INSERT INTO stock_movement (product_id, from_location_id, to_location_id, quantity, movement_type, reason, changed_by, movement_date) 
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [product_id, from_location_id, to_location_id, quantity, movement_type, reason || null, changed_by]
    );

    // Create Audit Log
    await connection.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, details) 
       VALUES (?, 'INSERT', 'stock_movement', ?, ?)`,
      [changed_by, movementResult.insertId, `Moved ${quantity} units of product ${product_id}`]
    );

    await connection.commit();
    res.status(201).json({ 
      success: true, 
      message: 'Stock movement recorded successfully',
      data: { insertId: movementResult.insertId }
    });
  } catch (error) {
    await connection.rollback();
    res.status(400).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

