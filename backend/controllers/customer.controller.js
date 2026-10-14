const pool = require('../config/db.config');
const { parseId } = require('../utils/validate.util');

const isValidEmail = (email) => {
    return String(email).toLowerCase().match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
};

const getAll = async (req, res) => {
  try {
    const sql = `
      SELECT c.*, 
        (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.customer_id) AS total_orders,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders o WHERE o.customer_id = c.customer_id) AS total_spent
      FROM customer c 
      ORDER BY c.created_at DESC
    `;
    const [rows] = await pool.query(sql);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching customers:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getById = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid ID' });
    const [rows] = await pool.query('SELECT * FROM customer WHERE customer_id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const create = async (req, res) => {
  try {
    const { customer_name, email, phone, address, city } = req.body;
    if (!customer_name || !phone) {
      return res.status(400).json({ success: false, message: 'customer_name and phone are required' });
    }
    if (email && !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }
    const [result] = await pool.query(
        'INSERT INTO customer (customer_name, email, phone, address, city) VALUES (?, ?, ?, ?, ?)', 
        [customer_name, email || null, phone, address || null, city || null]
    );
    res.status(201).json({ success: true, data: { insertId: result.insertId }, message: 'Customer created successfully' });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const update = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid ID' });
    
    const { customer_name, email, phone, address, city } = req.body;
    if (email && !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }
    
    const [result] = await pool.query(
        'UPDATE customer SET customer_name = COALESCE(?, customer_name), email = COALESCE(?, email), phone = COALESCE(?, phone), address = COALESCE(?, address), city = COALESCE(?, city) WHERE customer_id = ?', 
        [customer_name, email, phone, address, city, id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Customer updated successfully' });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const remove = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid ID' });
    const [result] = await pool.query('DELETE FROM customer WHERE customer_id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { getAll, getById, create, update, remove };
