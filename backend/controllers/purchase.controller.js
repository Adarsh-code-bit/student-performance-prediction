const pool = require('../config/db.config');
const { parseId } = require('../utils/validate.util');

exports.getAll = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, s.supplier_name,
              (SELECT COUNT(*) FROM purchase_details pd WHERE pd.purchase_id = p.purchase_id) AS items_count
       FROM purchase p 
       JOIN supplier s ON p.supplier_id = s.supplier_id 
       ORDER BY p.purchase_date DESC, p.purchase_id DESC`
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
      `SELECT pd.*, pr.product_name, pr.sku, pr.unit,
              l.location_name, l.rack_number, l.shelf, l.bin, l.aisle, l.zone,
              s.store_name
       FROM purchase_details pd
       JOIN product pr ON pd.product_id = pr.product_id
       LEFT JOIN location l ON pd.location_id = l.location_id
       LEFT JOIN store s ON l.store_id = s.store_id
       WHERE pd.purchase_id = ?`,
      [purchaseId]
    );

    const purchase = purchaseRows[0];
    purchase.items = detailsRows.map(row => {
      const rack = (row.rack_number || '').trim();
      const shelf = (row.shelf || '').trim();
      const bin = (row.bin || '').trim();
      let code = null;
      if (rack && shelf && bin) {
        code = `${rack}-${shelf}-${bin}`;
      } else if (rack && shelf) {
        code = `${rack}-${shelf}`;
      } else {
        code = row.location_name || 'Unassigned';
      }
      return {
        ...row,
        complete_location_code: code
      };
    });

    res.json({ success: true, data: purchase });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.create = async (req, res) => {
  const { supplier_id, purchase_date, notes, location_id, items } = req.body;

  if (!supplier_id || !purchase_date || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Validate each item has a valid, active storage location
    // Respect item.location_id with fallback to order-level location_id
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemLocId = parseId(item.location_id) || parseId(location_id);
      if (!itemLocId) {
        await connection.rollback();
        return res.status(400).json({ 
          success: false, 
          message: `Item #${i + 1}: Storage location is required` 
        });
      }

      // Verify location exists and is active
      const [locRows] = await connection.query(
        `SELECT location_id, location_name, rack_number, shelf, bin, max_capacity, is_active 
         FROM location WHERE location_id = ?`,
        [itemLocId]
      );
      if (locRows.length === 0 || !locRows[0].is_active) {
        await connection.rollback();
        return res.status(400).json({ 
          success: false, 
          message: `Storage location #${itemLocId} for Item #${i + 1} is invalid or inactive` 
        });
      }

      const loc = locRows[0];
      // Capacity check if max_capacity is tracked on the location
      if (loc.max_capacity !== null && loc.max_capacity !== undefined) {
        const [invCount] = await connection.query(
          'SELECT COALESCE(SUM(quantity), 0) AS total_stored FROM inventory WHERE location_id = ?',
          [itemLocId]
        );
        const currentStored = Number(invCount[0].total_stored || 0);
        const incomingQty = Number(item.quantity || 0);
        const maxCap = Number(loc.max_capacity);

        if (currentStored + incomingQty > maxCap) {
          await connection.rollback();
          const locCode = (loc.rack_number && loc.shelf && loc.bin) 
            ? `${loc.rack_number}-${loc.shelf}-${loc.bin}` 
            : loc.location_name;
          return res.status(400).json({ 
            success: false, 
            message: `Storage location ${locCode} capacity exceeded. Max capacity: ${maxCap}, currently stored: ${currentStored}, incoming: ${incomingQty}` 
          });
        }
      }

      item._effective_location_id = itemLocId;
    }

    let totalAmount = 0;
    for (const item of items) {
      totalAmount += (Number(item.quantity) * Number(item.unit_price));
    }

    const [purchaseResult] = await connection.query(
      `INSERT INTO purchase (supplier_id, purchase_date, total_amount, status, notes) 
       VALUES (?, ?, ?, 'received', ?)`,
      [supplier_id, purchase_date, totalAmount, notes || null]
    );

    const purchaseId = purchaseResult.insertId;

    for (const item of items) {
      const totalPrice = Number(item.quantity) * Number(item.unit_price);
      const itemLocId = item._effective_location_id;
      
      // Insert into purchase_details with assigned location_id
      await connection.query(
        `INSERT INTO purchase_details (purchase_id, product_id, location_id, quantity, unit_price, total_price) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [purchaseId, item.product_id, itemLocId, item.quantity, item.unit_price, totalPrice]
      );

      // Insert into batch
      const [batchResult] = await connection.query(
        `INSERT INTO batch (product_id, batch_code, manufacturing_date, expiry_date, quantity, cost_price) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [item.product_id, item.batch_code, item.manufacturing_date, item.expiry_date, item.quantity, item.cost_price ?? item.unit_price ?? 0]
      );

      const batchId = batchResult.insertId;

      // Insert or Update Inventory with specific assigned storage location
      await connection.query(
        `INSERT INTO inventory (product_id, batch_id, location_id, quantity) 
         VALUES (?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
        [item.product_id, batchId, itemLocId, item.quantity]
      );

      // Record stock movement (restock / purchase received)
      await connection.query(
        `INSERT INTO stock_movement (product_id, from_location_id, to_location_id, quantity, movement_type, reason, changed_by, movement_date) 
         VALUES (?, NULL, ?, ?, 'restock', ?, ?, NOW())`,
        [item.product_id, itemLocId, item.quantity, `Purchase #${purchaseId} received`, req.user?.user_id || 1]
      );
    }

    await connection.commit();
    res.status(201).json({ 
      success: true, 
      message: 'Purchase recorded successfully',
      data: { insertId: purchaseId }
    });
  } catch (error) {
    console.error('Purchase create error:', error.message);
    await connection.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};
