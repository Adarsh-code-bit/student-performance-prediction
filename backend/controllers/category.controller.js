const pool = require('../config/db.config');
const { parseId } = require('../utils/validate.util');

const getAll = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM product p WHERE p.category_id = c.category_id) AS product_count
      FROM category c 
      ORDER BY c.created_at DESC
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
    const [rows] = await pool.query('SELECT * FROM category WHERE category_id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const create = async (req, res) => {
  try {
    const { category_name, description } = req.body;
    if (!category_name) {
      return res.status(400).json({ success: false, message: 'category_name is required' });
    }
    const [result] = await pool.query('INSERT INTO category (category_name, description) VALUES (?, ?)', [category_name, description || null]);
    res.status(201).json({ success: true, data: { insertId: result.insertId }, message: 'Category created successfully' });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const update = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid ID' });
    const { category_name, description, is_active } = req.body;
    const [result] = await pool.query('UPDATE category SET category_name = COALESCE(?, category_name), description = COALESCE(?, description), is_active = COALESCE(?, is_active) WHERE category_id = ?', [category_name, description, is_active, id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Category updated successfully' });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const remove = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid ID' });
    const [result] = await pool.query('UPDATE category SET is_active = FALSE WHERE category_id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { getAll, getById, create, update, remove };
