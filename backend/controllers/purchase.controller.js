const pool = require('../config/db.config');
const { parseId } = require('../utils/validate.util');

exports.getAll = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, s.supplier_name 
       FROM purchase p 
       JOIN supplier s ON p.supplier_id = s.supplier_id 
       ORDER BY p.purchase_date DESC`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const purchaseId = parseId(req.params.id);
    if (!purchaseId) {
      return res.status(400).json({ success: false, message: 'Invalid purchase ID' });
    }

    const [purchaseRows] = await pool.query(
      `SELECT p.*, s.supplier_name 
       FROM purchase p 
       JOIN supplier s ON p.supplier_id = s.supplier_id 
       WHERE p.purchase_id = ?`,
      [purchaseId]
    );

    if (purchaseRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Purchase not found' });
    }

    const [detailsRows] = await pool.query(
      `SELECT pd.*, pr.product_name 
       FROM purchase_details pd
       JOIN product pr ON pd.product_id = pr.product_id
       WHERE pd.purchase_id = ?`,
      [purchaseId]
    );

    const purchase = purchaseRows[0];
    purchase.items = detailsRows;

    res.json({ success: true, data: purchase });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.create = async (req, res) => {
  const { supplier_id, purchase_date, notes, location_id, items } = req.body;

  if (!supplier_id || !purchase_date || !location_id || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    let totalAmount = 0;
    for (const item of items) {
      totalAmount += (item.quantity * item.unit_price);
    }

    const [purchaseResult] = await connection.query(
      `INSERT INTO purchase (supplier_id, purchase_date, total_amount, status, notes) 
       VALUES (?, ?, ?, 'received', ?)`,
      [supplier_id, purchase_date, totalAmount, notes || null]
    );

    const purchaseId = purchaseResult.insertId;

    for (const item of items) {
      const totalPrice = item.quantity * item.unit_price;
      
      // Insert into purchase_details
      await connection.query(
        `INSERT INTO purchase_details (purchase_id, product_id, quantity, unit_price, total_price) 
         VALUES (?, ?, ?, ?, ?)`,
        [purchaseId, item.product_id, item.quantity, item.unit_price, totalPrice]
      );

      // Insert into batch
      const [batchResult] = await connection.query(
        `INSERT INTO batch (product_id, batch_code, manufacturing_date, expiry_date, quantity, cost_price) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [item.product_id, item.batch_code, item.manufacturing_date, item.expiry_date, item.quantity, item.cost_price]
      );

      const batchId = batchResult.insertId;

      // Insert or Update Inventory
      await connection.query(
        `INSERT INTO inventory (product_id, batch_id, location_id, quantity) 
         VALUES (?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
        [item.product_id, batchId, location_id, item.quantity]
      );
    }

    await connection.commit();
    res.status(201).json({ 
      success: true, 
      message: 'Purchase recorded successfully',
      data: { insertId: purchaseId }
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

