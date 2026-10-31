const pool = require('../config/db.config');
const { parseId } = require('../utils/validate.util');

const getAll = async (req, res) => {
  try {
    const sql = `
      SELECT l.*, 
        s.store_name,
        s.store_code,
        (SELECT COUNT(DISTINCT product_id) FROM inventory i WHERE i.location_id = l.location_id AND i.quantity > 0) AS products_stored,
        (SELECT COALESCE(SUM(quantity), 0) FROM inventory i WHERE i.location_id = l.location_id AND i.quantity > 0) AS total_units_stored
      FROM location l 
      LEFT JOIN store s ON l.store_id = s.store_id
      WHERE l.is_active = TRUE 
      ORDER BY l.rack_number ASC, l.shelf ASC, l.bin ASC, l.created_at DESC
    `;
    const [rows] = await pool.query(sql);

    const formattedRows = rows.map(r => {
      const rack = (r.rack_number || '').trim();
      const shelf = (r.shelf || '').trim();
      const bin = (r.bin || '').trim();
      let complete_code = null;
      if (rack && shelf && bin) {
        complete_code = `${rack}-${shelf}-${bin}`;
      } else if (rack && shelf) {
        complete_code = `${rack}-${shelf}`;
      } else {
        complete_code = r.location_name;
      }

      const unitsStored = Number(r.total_units_stored || 0);
      const maxCap = (r.max_capacity !== null && r.max_capacity !== undefined) ? Number(r.max_capacity) : null;
      const availableCapacity = maxCap !== null ? Math.max(0, maxCap - unitsStored) : null;
      const isOccupied = unitsStored > 0 || Number(r.products_stored || 0) > 0;

      return {
        ...r,
        store_name: r.store_name || 'Main Warehouse',
        complete_location_code: complete_code,
        total_units_stored: unitsStored,
        available_capacity: availableCapacity,
        is_occupied: isOccupied
      };
    });

    res.json({ success: true, data: formattedRows });
  } catch (error) {
    console.error('Error fetching locations:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const cleanString = (val, max = 50) => {
  if (val === undefined) return undefined;
  if (val === null) return null;
  const s = String(val).trim();
  return s.length > 0 ? s.slice(0, max) : null;
};

const cleanNumber = (val) => {
  if (val === undefined || val === null || val === '') return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
};

const create = async (req, res) => {
  try {
    const { location_name, rack_number, aisle, shelf, bin, zone, description, store_id, max_capacity } = req.body;
    if (!location_name || typeof location_name !== 'string' || !location_name.trim()) {
      return res.status(400).json({ success: false, message: 'location_name is required' });
    }

    const trimmedName = location_name.trim().slice(0, 100);
    const trimmedRack = cleanString(rack_number, 50) ?? null;
    const trimmedAisle = cleanString(aisle, 50) ?? null;
    const trimmedShelf = cleanString(shelf, 50) ?? null;
    const trimmedBin = cleanString(bin, 50) ?? null;
    const trimmedZone = cleanString(zone, 50) ?? null;
    const trimmedDesc = cleanString(description, 500) ?? null;
    const parsedStoreId = cleanNumber(store_id);
    const parsedCapacity = cleanNumber(max_capacity);

    const [result] = await pool.query(
      `INSERT INTO location (location_name, rack_number, aisle, shelf, bin, zone, description, store_id, max_capacity) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
      [trimmedName, trimmedRack, trimmedAisle, trimmedShelf, trimmedBin, trimmedZone, trimmedDesc, parsedStoreId, parsedCapacity]
    );
    res.status(201).json({ 
      success: true, 
      data: { insertId: result.insertId }, 
      message: 'Location created successfully' 
    });
  } catch (error) {
    console.error('Error creating location:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const update = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid ID' });
    
    const { location_name, rack_number, aisle, shelf, bin, zone, description, is_active, store_id, max_capacity } = req.body;
    
    if (location_name !== undefined && (typeof location_name !== 'string' || !location_name.trim())) {
      return res.status(400).json({ success: false, message: 'location_name cannot be empty' });
    }

    const trimmedName = location_name !== undefined ? location_name.trim().slice(0, 100) : undefined;
    const trimmedRack = cleanString(rack_number, 50);
    const trimmedAisle = cleanString(aisle, 50);
    const trimmedShelf = cleanString(shelf, 50);
    const trimmedBin = cleanString(bin, 50);
    const trimmedZone = cleanString(zone, 50);
    const trimmedDesc = cleanString(description, 500);
    const parsedStoreId = store_id !== undefined ? cleanNumber(store_id) : undefined;
    const parsedCapacity = max_capacity !== undefined ? cleanNumber(max_capacity) : undefined;

    const [result] = await pool.query(
      `UPDATE location 
       SET location_name = COALESCE(?, location_name), 
           rack_number = CASE WHEN ? = 1 THEN ? ELSE rack_number END, 
           aisle = CASE WHEN ? = 1 THEN ? ELSE aisle END,
           shelf = CASE WHEN ? = 1 THEN ? ELSE shelf END,
           bin = CASE WHEN ? = 1 THEN ? ELSE bin END,
           zone = CASE WHEN ? = 1 THEN ? ELSE zone END,
           description = CASE WHEN ? = 1 THEN ? ELSE description END, 
           store_id = CASE WHEN ? = 1 THEN ? ELSE store_id END,
           max_capacity = CASE WHEN ? = 1 THEN ? ELSE max_capacity END,
           is_active = COALESCE(?, is_active) 
       WHERE location_id = ?`, 
      [
        trimmedName !== undefined ? trimmedName : null,
        trimmedRack !== undefined ? 1 : 0, trimmedRack !== undefined ? trimmedRack : null,
        trimmedAisle !== undefined ? 1 : 0, trimmedAisle !== undefined ? trimmedAisle : null,
        trimmedShelf !== undefined ? 1 : 0, trimmedShelf !== undefined ? trimmedShelf : null,
        trimmedBin !== undefined ? 1 : 0, trimmedBin !== undefined ? trimmedBin : null,
        trimmedZone !== undefined ? 1 : 0, trimmedZone !== undefined ? trimmedZone : null,
        trimmedDesc !== undefined ? 1 : 0, trimmedDesc !== undefined ? trimmedDesc : null,
        parsedStoreId !== undefined ? 1 : 0, parsedStoreId !== undefined ? parsedStoreId : null,
        parsedCapacity !== undefined ? 1 : 0, parsedCapacity !== undefined ? parsedCapacity : null,
        is_active !== undefined ? is_active : null,
        id
      ]
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
