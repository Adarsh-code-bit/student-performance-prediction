const pool = require('../config/db.config');
const { parseId } = require('../utils/validate.util');

/**
 * GET /api/stock-audits
 * Lists physical stock counts and discrepancy reports.
 */
exports.getAll = async (req, res) => {
  try {
    const storeId = req.user.role === 'ADMIN' ? req.query.store_id : req.user.store_id;

    let query = `
      SELECT sa.*, 
             p.product_name, p.sku, p.unit,
             l.location_name, l.rack_number,
             u.user_name AS auditor_name,
             reviewer.user_name AS reviewer_name,
             s.store_name
      FROM stock_audit sa
      JOIN product p ON sa.product_id = p.product_id
      JOIN location l ON sa.location_id = l.location_id
      JOIN \`user\` u ON sa.auditor_id = u.user_id
      LEFT JOIN \`user\` reviewer ON sa.reviewed_by = reviewer.user_id
      LEFT JOIN store s ON sa.store_id = s.store_id
    `;
    const params = [];

    if (storeId) {
      query += ` WHERE sa.store_id = ?`;
      params.push(storeId);
    }

    query += ` ORDER BY sa.created_at DESC`;

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/stock-audits
 * Auditor records physical stock count and reports discrepancy.
 * Auditor CANNOT directly adjust inventory; submits for Store Manager review.
 */
exports.create = async (req, res) => {
  try {
    const { product_id, location_id, physical_quantity, discrepancy_type = 'NONE', notes } = req.body;

    const prodId = parseId(product_id);
    let locId = parseId(location_id);
    const physQty = parseInt(physical_quantity, 10);

    if (!prodId || isNaN(physQty)) {
      return res.status(400).json({ success: false, message: 'Valid product_id and physical_quantity are required' });
    }

    if (!locId) {
      const [locRows] = await pool.query('SELECT location_id FROM location LIMIT 1');
      locId = locRows.length > 0 ? locRows[0].location_id : 1;
    }

    // 1. Fetch current system inventory quantity
    const [invRows] = await pool.query(
      `SELECT COALESCE(SUM(quantity), 0) AS system_qty 
       FROM inventory 
       WHERE product_id = ? AND location_id = ?`,
      [prodId, locId]
    );

    const systemQty = parseInt(invRows[0].system_qty, 10);
    const discrepancy = physQty - systemQty;
    const storeId = req.user.store_id || 1;

    // 2. Insert into stock_audit (Pending Store Manager review)
    const [result] = await pool.query(
      `INSERT INTO stock_audit 
       (store_id, product_id, location_id, auditor_id, system_quantity, physical_quantity, discrepancy, discrepancy_type, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_REVIEW')`,
      [
        storeId,
        prodId,
        locId,
        req.user.user_id,
        systemQty,
        physQty,
        discrepancy,
        discrepancy_type,
        notes || null
      ]
    );

    // 3. Log audit event
    await pool.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, details)
       VALUES (?, 'INSERT', 'stock_audit', ?, ?)`,
      [
        req.user.user_id,
        result.insertId,
        `Auditor ${req.user.user_name} recorded stock count: Physical=${physQty}, System=${systemQty}, Discrepancy=${discrepancy} (${discrepancy_type}). Submitted for Store Manager review.`
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Physical audit count recorded. Submitted to Store Manager for adjustment approval.',
      data: {
        audit_task_id: result.insertId,
        audit_id: result.insertId,
        system_quantity: systemQty,
        physical_quantity: physQty,
        discrepancy,
        status: 'PENDING_REVIEW'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/stock-audits/:id/review
 * Store Manager reviews and approves or rejects inventory discrepancy adjustment.
 */
exports.review = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const auditId = parseId(req.params.id);
    const { action, review_notes } = req.body; // action: 'APPROVE' or 'REJECT'

    if (!auditId || !['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Valid audit ID and action (APPROVE or REJECT) are required' });
    }

    const [auditRows] = await connection.query(
      'SELECT * FROM stock_audit WHERE audit_task_id = ?',
      [auditId]
    );

    if (auditRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Stock audit record not found' });
    }

    const audit = auditRows[0];
    if (audit.status !== 'PENDING_REVIEW') {
      return res.status(400).json({ success: false, message: `Audit task already reviewed (${audit.status})` });
    }

    await connection.beginTransaction();

    const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    if (action === 'APPROVE' && audit.discrepancy !== 0) {
      // Adjust inventory to match verified physical quantity
      // If inventory record exists at location, update it
      const [invRows] = await connection.query(
        'SELECT inventory_id, quantity FROM inventory WHERE product_id = ? AND location_id = ? LIMIT 1',
        [audit.product_id, audit.location_id]
      );

      if (invRows.length > 0) {
        await connection.query(
          'UPDATE inventory SET quantity = ? WHERE inventory_id = ?',
          [audit.physical_quantity, invRows[0].inventory_id]
        );
      } else {
        // Find latest batch for product or create audit batch
        const [batchRows] = await connection.query(
          'SELECT batch_id FROM batch WHERE product_id = ? ORDER BY batch_id DESC LIMIT 1',
          [audit.product_id]
        );
        let batchId;
        if (batchRows.length > 0) {
          batchId = batchRows[0].batch_id;
        } else {
          const [batchInsert] = await connection.query(
            `INSERT INTO batch (product_id, batch_code, manufacturing_date, expiry_date, quantity, cost_price)
             VALUES (?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 90 DAY), ?, 50.00)`,
            [audit.product_id, `BCH-AUDIT-${Date.now()}`, audit.physical_quantity]
          );
          batchId = batchInsert.insertId;
        }
        await connection.query(
          'INSERT INTO inventory (product_id, batch_id, location_id, quantity) VALUES (?, ?, ?, ?)',
          [audit.product_id, batchId, audit.location_id, audit.physical_quantity]
        );
      }
    }

    // Update audit record
    await connection.query(
      `UPDATE stock_audit 
       SET status = ?, reviewed_by = ?, review_notes = ?, reviewed_at = NOW() 
       WHERE audit_task_id = ?`,
      [newStatus, req.user.user_id, review_notes || null, auditId]
    );

    // Audit log
    await connection.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, details)
       VALUES (?, 'UPDATE', 'stock_audit', ?, ?)`,
      [
        req.user.user_id,
        auditId,
        `Store Manager ${req.user.user_name} ${action}D discrepancy of ${audit.discrepancy} units for product #${audit.product_id}.`
      ]
    );

    await connection.commit();

    res.json({
      success: true,
      message: `Audit discrepancy ${newStatus.toLowerCase()} successfully.${action === 'APPROVE' ? ' Inventory updated.' : ''}`,
      data: {
        audit_task_id: auditId,
        audit_id: auditId,
        status: newStatus
      }
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};
