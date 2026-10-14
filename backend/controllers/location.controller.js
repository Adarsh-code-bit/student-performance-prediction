const pool = require('../config/db.config');
const { parseId } = require('../utils/validate.util');

const getAll = async (req, res) => {
  try {
    const sql = `
      SELECT l.*, 
        (SELECT COUNT(DISTINCT product_id) FROM inventory i WHERE i.location_id = l.location_id AND i.quantity > 0) AS products_stored
      FROM location l 
      WHERE l.is_active = TRUE 
      ORDER BY l.created_at DESC
    `;
    const [rows] = await pool.query(sql);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching locations:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const create = async (req, res) => {
  try {
    const { location_name, rack_number, zone, description } = req.body;
    if (!location_name) {
      return res.status(400).json({ success: false, message: 'location_name is required' });
    }
    const [result] = await pool.query(
        'INSERT INTO location (location_name, rack_number, zone, description) VALUES (?, ?, ?, ?)', 
        [location_name, rack_number || null, zone || null, description || null]
    );
    res.status(201).json({ success: true, data: { insertId: result.insertId }, message: 'Location created successfully' });
  } catch (error) {
    console.error('Error creating location:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const update = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid ID' });
    
    const { location_name, rack_number, zone, description, is_active } = req.body;
    
    const [result] = await pool.query(
        'UPDATE location SET location_name = COALESCE(?, location_name), rack_number = COALESCE(?, rack_number), zone = COALESCE(?, zone), description = COALESCE(?, description), is_active = COALESCE(?, is_active) WHERE location_id = ?', 
        [location_name, rack_number, zone, description, is_active, id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Location updated successfully' });
  } catch (error) {
    console.error('Error updating location:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const remove = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid ID' });
    const [result] = await pool.query('UPDATE location SET is_active = FALSE WHERE location_id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Location deleted successfully' });
  } catch (error) {
    console.error('Error deleting location:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { getAll, create, update, remove };
