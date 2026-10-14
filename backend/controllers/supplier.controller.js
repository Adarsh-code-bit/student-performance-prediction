const pool = require('../config/db.config');
const { parseId } = require('../utils/validate.util');

const isValidEmail = (email) => {
    return String(email).toLowerCase().match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
};

const getAll = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT s.*,
        (SELECT COUNT(*) FROM purchase p WHERE p.supplier_id = s.supplier_id) AS purchase_count
      FROM supplier s
      WHERE s.is_active = TRUE
      ORDER BY s.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getById = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid ID' });
    const [rows] = await pool.query('SELECT * FROM supplier WHERE supplier_id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const create = async (req, res) => {
  try {
    const { supplier_name, contact_person, email, phone, address, city } = req.body;
    if (!supplier_name) {
      return res.status(400).json({ success: false, message: 'supplier_name is required' });
    }
    if (email && !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }
    const [result] = await pool.query(
        'INSERT INTO supplier (supplier_name, contact_person, email, phone, address, city) VALUES (?, ?, ?, ?, ?, ?)', 
        [supplier_name, contact_person || null, email || null, phone || null, address || null, city || null]
    );
    res.status(201).json({ success: true, data: { insertId: result.insertId }, message: 'Supplier created successfully' });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const update = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid ID' });
    
    const { supplier_name, contact_person, email, phone, address, city, is_active } = req.body;
    if (email && !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }
    
    const [result] = await pool.query(
        'UPDATE supplier SET supplier_name = COALESCE(?, supplier_name), contact_person = COALESCE(?, contact_person), email = COALESCE(?, email), phone = COALESCE(?, phone), address = COALESCE(?, address), city = COALESCE(?, city), is_active = COALESCE(?, is_active) WHERE supplier_id = ?', 
        [supplier_name, contact_person, email, phone, address, city, is_active, id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Supplier updated successfully' });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const remove = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid ID' });
    const [result] = await pool.query('UPDATE supplier SET is_active = FALSE WHERE supplier_id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { getAll, getById, create, update, remove };
