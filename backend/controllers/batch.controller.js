const pool = require('../config/db.config');
const { parseId } = require('../utils/validate.util');

const calculateBatchStatus = (expiryDate) => {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'EXPIRED';
  if (diffDays <= 30) return 'NEAR EXPIRY';
  return 'HEALTHY';
};

exports.getAll = async (req, res) => {
  try {
    let sql = `
      SELECT b.*, p.product_name 
      FROM batch b 
      JOIN product p ON b.product_id = p.product_id 
      WHERE 1=1
    `;
    const params = [];

    if (req.query.product_id) {
      sql += ' AND b.product_id = ?';
      params.push(req.query.product_id);
    }
    if (req.query.expired === 'true') {
      sql += ' AND b.expiry_date < CURDATE()';
    }
    if (req.query.expiring_soon === 'true') {
      sql += ' AND b.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)';
    }

    sql += ' ORDER BY b.created_at DESC';

    const [rows] = await pool.query(sql, params);
    
    // Dynamically calculate status
    const data = rows.map(row => ({
      ...row,
      status: calculateBatchStatus(row.expiry_date)
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching batches:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getOne = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid ID' });

    const sql = `
      SELECT b.*, p.product_name 
      FROM batch b 
      JOIN product p ON b.product_id = p.product_id 
      WHERE b.batch_id = ?
    `;
    const [rows] = await pool.query(sql, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    const batch = rows[0];
    batch.status = calculateBatchStatus(batch.expiry_date);

    res.json({ success: true, data: batch });
  } catch (error) {
    console.error('Error fetching batch:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


exports.create = async (req, res) => {
  try {
    const { product_id, batch_code, manufacturing_date, expiry_date, quantity, cost_price } = req.body;

    if (!product_id || !batch_code || !manufacturing_date || !expiry_date || !quantity || !cost_price) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (new Date(expiry_date) <= new Date(manufacturing_date)) {
      return res.status(400).json({ success: false, message: 'Expiry date must be after manufacturing date' });
    }

    const sql = `
      INSERT INTO batch (product_id, batch_code, manufacturing_date, expiry_date, quantity, cost_price) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const [result] = await pool.query(sql, [
      product_id, 
      batch_code, 
      manufacturing_date, 
      expiry_date, 
      quantity, 
      cost_price
    ]);

    res.status(201).json({ 
      success: true, 
      data: { insertId: result.insertId }, 
      message: 'Batch created successfully' 
    });
  } catch (error) {
    console.error('Error creating batch:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.update = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid ID' });

    const { product_id, batch_code, manufacturing_date, expiry_date, quantity, cost_price } = req.body;

    if (expiry_date && manufacturing_date && new Date(expiry_date) <= new Date(manufacturing_date)) {
      return res.status(400).json({ success: false, message: 'Expiry date must be after manufacturing date' });
    }

    const sql = `
      UPDATE batch 
      SET product_id = COALESCE(?, product_id),
          batch_code = COALESCE(?, batch_code),
          manufacturing_date = COALESCE(?, manufacturing_date),
          expiry_date = COALESCE(?, expiry_date),
          quantity = COALESCE(?, quantity),
          cost_price = COALESCE(?, cost_price)
      WHERE batch_id = ?
    `;
    const [result] = await pool.query(sql, [
      product_id, 
      batch_code, 
      manufacturing_date, 
      expiry_date, 
      quantity, 
      cost_price, 
      id
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    res.json({ success: true, message: 'Batch updated successfully' });
  } catch (error) {
    console.error('Error updating batch:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
