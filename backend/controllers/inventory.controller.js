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
      SELECT i.*, 
        p.product_name, p.sku, p.barcode, p.reorder_level, p.category_id, p.image_url,
        c.category_name,
        b.batch_code, b.expiry_date, 
        l.location_name, l.location_type, l.rack_number, l.shelf, l.bin,
        (SELECT COALESCE(SUM(quantity), 0) FROM order_details od WHERE od.product_id = i.product_id) AS sales
      FROM inventory i
      JOIN product p ON i.product_id = p.product_id
      JOIN category c ON p.category_id = c.category_id
      JOIN batch b ON i.batch_id = b.batch_id
      JOIN location l ON i.location_id = l.location_id
      WHERE 1=1
    `;
    const params = [];

    if (req.query.product_id) {
      sql += ' AND i.product_id = ?';
      params.push(req.query.product_id);
    }
    if (req.query.location_id) {
      sql += ' AND i.location_id = ?';
      params.push(req.query.location_id);
    }
    const storeId = req.user?.role === 'ADMIN' ? req.query.store_id : req.user?.store_id;
    if (storeId) {
      sql += ' AND (l.store_id = ? OR l.store_id IS NULL)';
      params.push(storeId);
    }
    if (req.query.low_stock === 'true') {
      sql += ' AND i.quantity <= p.reorder_level';
    }

    sql += ' ORDER BY i.updated_at DESC';

    const [rows] = await pool.query(sql, params);
    
    const data = rows.map(row => ({
      ...row,
      complete_location_code: (row.rack_number && row.shelf && row.bin) ? `${row.rack_number}-${row.shelf}-${row.bin}` : (row.location_name || 'N/A'),
      status: calculateBatchStatus(row.expiry_date)
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getOne = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid ID' });

    let sql = `
      SELECT i.*, 
        p.product_name, p.sku, p.barcode, p.reorder_level, p.category_id, p.image_url,
        c.category_name,
        b.batch_code, b.expiry_date, 
        l.location_name, l.location_type, l.rack_number, l.shelf, l.bin,
        (SELECT COALESCE(SUM(quantity), 0) FROM order_details od WHERE od.product_id = i.product_id) AS sales
      FROM inventory i
      JOIN product p ON i.product_id = p.product_id
      JOIN category c ON p.category_id = c.category_id
      JOIN batch b ON i.batch_id = b.batch_id
      JOIN location l ON i.location_id = l.location_id
      WHERE i.inventory_id = ?
    `;
    const params = [id];

    if (req.user && req.user.role === 'STORE_MANAGER' && req.user.store_id) {
      sql += ' AND (l.store_id = ? OR l.store_id IS NULL)';
      params.push(req.user.store_id);
    }

    const [rows] = await pool.query(sql, params);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    const inventory = rows[0];
    inventory.complete_location_code = (inventory.rack_number && inventory.shelf && inventory.bin) ? `${inventory.rack_number}-${inventory.shelf}-${inventory.bin}` : (inventory.location_name || 'N/A');
    inventory.status = calculateBatchStatus(inventory.expiry_date);

    res.json({ success: true, data: inventory });
  } catch (error) {
    console.error('Error fetching inventory item:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


