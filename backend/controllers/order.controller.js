const pool = require('../config/db.config');
const { parseId } = require('../utils/validate.util');
const { planBatchDeductions } = require('../utils/stock.util');
const { formatLocationDisplay, calculatePickingDurations, formatDuration } = require('../utils/picking.util');
const socketService = require('../services/socket.service');

// Valid status pipeline transitions
const ALLOWED_TRANSITIONS = {
  'pending': ['confirmed', 'picking_queue', 'cancelled', 'processing'],
  'processing': ['confirmed', 'picking_queue', 'picked', 'shipped', 'cancelled'],
  'confirmed': ['picking_queue', 'picking_in_progress', 'cancelled'],
  'picking_queue': ['picking_in_progress', 'cancelled'],
  'picking_in_progress': ['picked', 'picking_queue', 'cancelled'],
  'picked': ['packing_in_progress', 'packed', 'cancelled'],
  'packing_in_progress': ['packed', 'picked', 'cancelled'],
  'packed': ['ready_for_dispatch', 'dispatched', 'shipped', 'cancelled'],
  'ready_for_dispatch': ['dispatched', 'shipped', 'cancelled'],
  'dispatched': ['delivered', 'cancelled'],
  'shipped': ['delivered', 'cancelled'],
  'delivered': [],
  'cancelled': []
};

exports.getAll = async (req, res) => {
  try {
    const { status, store_id } = req.query;
    let query = `
      SELECT o.*, c.customer_name, c.city,
             picker.user_name AS picker_name,
             packer.user_name AS packer_name,
             s.store_name,
             (SELECT COUNT(*) FROM order_details od WHERE od.order_id = o.order_id) AS items_count
      FROM orders o 
      JOIN customer c ON o.customer_id = c.customer_id
      LEFT JOIN \`user\` picker ON o.assigned_picker_id = picker.user_id
      LEFT JOIN \`user\` packer ON o.assigned_packer_id = packer.user_id
      LEFT JOIN store s ON o.store_id = s.store_id
    `;
    const params = [];
    const conditions = [];

    if (status) {
      conditions.push('o.status = ?');
      params.push(status);
    }

    // Store scoping: Store Manager and Staff see their assigned store; Admin can view all
    const userStoreId = req.user.role === 'ADMIN' ? store_id : req.user.store_id;
    if (userStoreId) {
      conditions.push('(o.store_id = ? OR o.store_id IS NULL)');
      params.push(userStoreId);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }

    query += ` ORDER BY o.order_date DESC`;

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const orderId = parseId(req.params.id);
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    const [orderRows] = await pool.query(`
      SELECT o.*, c.customer_name, c.phone AS customer_phone,
             picker.user_name AS picker_name,
             packer.user_name AS packer_name,
             s.store_name
      FROM orders o 
      JOIN customer c ON o.customer_id = c.customer_id
      LEFT JOIN \`user\` picker ON o.assigned_picker_id = picker.user_id
      LEFT JOIN \`user\` packer ON o.assigned_packer_id = packer.user_id
      LEFT JOIN store s ON o.store_id = s.store_id
      WHERE o.order_id = ?
    `, [orderId]);

    if (orderRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const order = orderRows[0];
    if (req.user?.role !== 'ADMIN' && order.store_id && req.user?.store_id && Number(order.store_id) !== Number(req.user.store_id)) {
      return res.status(403).json({ success: false, message: 'Access denied. Order belongs to another store.' });
    }

    // 1. Fetch exact allocations with rack, aisle, shelf, bin locations if table exists
    let allocRows = [];
    try {
      const [rows] = await pool.query(`
        SELECT oia.*, p.product_name, p.sku, p.unit, p.barcode, p.image_url,
               l.location_name, l.rack_number, l.aisle, l.shelf, l.bin, l.zone,
               b.batch_code, b.expiry_date
        FROM order_item_allocations oia
        JOIN product p ON oia.product_id = p.product_id
        LEFT JOIN location l ON oia.location_id = l.location_id
        LEFT JOIN batch b ON oia.batch_id = b.batch_id
        WHERE oia.order_id = ?
        ORDER BY l.zone ASC, l.aisle ASC, l.rack_number ASC, l.shelf ASC, l.bin ASC, oia.allocation_id ASC
      `, [orderId]);
      allocRows = rows;
    } catch (e) {
      // order_item_allocations or extended location columns may not exist yet before migration v3
      allocRows = [];
    }

    if (allocRows.length > 0) {
      order.is_historical_allocation = true;
      order.allocation_source = 'HISTORICAL_ALLOCATION';
      order.allocations = allocRows.map(row => {
        const loc = formatLocationDisplay(row);
        let locationCode = null;
        const rack = (row.rack_number || '').trim();
        const shelf = (row.shelf || '').trim();
        const bin = (row.bin || '').trim();
        if (rack && shelf && bin) {
          locationCode = `${rack}-${shelf}-${bin}`;
        } else if (rack && shelf) {
          locationCode = `${rack}-${shelf}`;
        } else if (rack) {
          locationCode = rack;
        }
        return {
          ...row,
          location_code: locationCode,
          location_display: loc.text,
          is_location_assigned: loc.isAssigned,
          location_parts: loc.parts,
          is_historical: true,
          is_suggested: false,
          source: 'HISTORICAL_ALLOCATION'
        };
      });
      // Backwards-compatibility for existing items consumers
      order.items = order.allocations.map(a => ({
        ...a,
        quantity: a.allocated_quantity
      }));
    } else {
      // Orders created before migration or when allocations table is not used
      // Uses a deterministic window function with FEFO ordering:
      // 1. Available stock: (inv.quantity > 0) DESC
      // 2. Earliest expiry date: CASE WHEN b.expiry_date IS NOT NULL THEN 0 ELSE 1 END ASC, b.expiry_date ASC
      // 3. Largest available stock: inv.quantity DESC
      // 4. Deterministic tie breaker: inv.inventory_id ASC
      const [detailsRows] = await pool.query(`
        SELECT 
          od.order_detail_id,
          od.order_id,
          od.product_id,
          od.quantity,
          od.unit_price,
          od.total_price,
          p.product_name,
          p.sku,
          p.unit,
          p.barcode,
          p.image_url,
          loc.location_name,
          loc.rack_number,
          loc.zone,
          loc.batch_code,
          loc.expiry_date,
          loc.available_quantity,
          loc.location_id,
          loc.batch_id
        FROM order_details od 
        JOIN product p ON od.product_id = p.product_id
        LEFT JOIN (
          SELECT 
            inv.product_id,
            inv.location_id,
            inv.batch_id,
            inv.quantity AS available_quantity,
            l.location_name,
            l.rack_number,
            l.zone,
            b.batch_code,
            b.expiry_date,
            ROW_NUMBER() OVER (
              PARTITION BY inv.product_id 
              ORDER BY 
                (inv.quantity > 0) DESC,
                CASE WHEN b.expiry_date IS NOT NULL THEN 0 ELSE 1 END ASC,
                b.expiry_date ASC,
                inv.quantity DESC,
                inv.inventory_id ASC
            ) AS rn
          FROM inventory inv
          JOIN location l ON inv.location_id = l.location_id
          LEFT JOIN batch b ON inv.batch_id = b.batch_id
        ) loc ON loc.product_id = p.product_id AND loc.rn = 1
        WHERE od.order_id = ?
        ORDER BY od.order_detail_id ASC
      `, [orderId]);

      // Multi-rack & multi-batch inventory lookup for transparency
      const productIds = [...new Set(detailsRows.map(r => r.product_id))];
      let multiLocationMap = {};
      if (productIds.length > 0) {
        try {
          const [invRows] = await pool.query(`
            SELECT 
              inv.product_id,
              inv.location_id,
              inv.batch_id,
              inv.quantity AS available_quantity,
              l.location_name,
              l.rack_number,
              l.zone,
              b.batch_code,
              b.expiry_date
            FROM inventory inv
            JOIN location l ON inv.location_id = l.location_id
            LEFT JOIN batch b ON inv.batch_id = b.batch_id
            WHERE inv.product_id IN (?) AND inv.quantity > 0
            ORDER BY 
              inv.product_id,
              CASE WHEN b.expiry_date IS NOT NULL THEN 0 ELSE 1 END ASC,
              b.expiry_date ASC,
              inv.quantity DESC
          `, [productIds]);

          for (const row of invRows) {
            if (!multiLocationMap[row.product_id]) {
              multiLocationMap[row.product_id] = [];
            }
            multiLocationMap[row.product_id].push(row);
          }
        } catch (err) {
          multiLocationMap = {};
        }
      }

      order.is_historical_allocation = false;
      order.allocation_source = 'DYNAMIC_FEFO_ESTIMATE';
      order.allocation_disclaimer = 'Locations dynamically estimated using live FEFO inventory balances. Historical allocations table not active for this order.';

      order.items = detailsRows.map(row => {
        const loc = formatLocationDisplay(row);
        let locationCode = null;
        const rack = (row.rack_number || '').trim();
        const shelf = (row.shelf || '').trim();
        const bin = (row.bin || '').trim();
        if (rack && shelf && bin) {
          locationCode = `${rack}-${shelf}-${bin}`;
        } else if (rack && shelf) {
          locationCode = `${rack}-${shelf}`;
        } else if (rack) {
          locationCode = rack;
        }

        const allProductLocations = multiLocationMap[row.product_id] || [];
        const isMultiRack = allProductLocations.length > 1;
        const totalAvailableStock = allProductLocations.reduce((sum, l) => sum + Number(l.available_quantity || 0), 0);
        const hasStockShortage = totalAvailableStock < row.quantity;
        const primaryLocationQuantity = Number(row.available_quantity || 0);
        const requiresSplitPick = primaryLocationQuantity > 0 && primaryLocationQuantity < row.quantity && totalAvailableStock >= row.quantity;

        return {
          ...row,
          location_code: locationCode,
          location_display: loc.text,
          is_location_assigned: loc.isAssigned,
          location_parts: loc.parts,
          // FEFO & Allocation Transparency
          is_historical_allocation: false,
          is_dynamically_estimated: true,
          allocation_source: 'DYNAMIC_FEFO_ESTIMATE',
          available_stock: primaryLocationQuantity,
          total_product_stock: totalAvailableStock,
          is_multi_rack: isMultiRack,
          requires_split_pick: requiresSplitPick,
          has_stock_shortage: hasStockShortage,
          available_locations: allProductLocations.map(al => ({
            location_id: al.location_id,
            location_name: al.location_name,
            rack_number: al.rack_number,
            zone: al.zone,
            batch_code: al.batch_code,
            expiry_date: al.expiry_date,
            available_quantity: al.available_quantity
          }))
        };
      });

      order.allocations = order.items.map(it => ({
        allocation_id: it.order_detail_id,
        order_id: it.order_id,
        order_detail_id: it.order_detail_id,
        product_id: it.product_id,
        product_name: it.product_name,
        sku: it.sku,
        unit: it.unit,
        barcode: it.barcode,
        allocated_quantity: it.quantity,
        picked_quantity: order.status === 'picked' ? it.quantity : 0,
        shortage_quantity: it.has_stock_shortage ? Math.max(0, it.quantity - it.total_product_stock) : 0,
        status: order.status === 'picked' ? 'PICKED' : (order.status === 'picking_in_progress' ? 'IN_PROGRESS' : 'PENDING'),
        location_display: it.location_display,
        is_location_assigned: it.is_location_assigned,
        location_parts: it.location_parts,
        is_historical: false,
        is_suggested: true,
        source: 'DYNAMIC_FEFO_ESTIMATE',
        requires_split_pick: it.requires_split_pick,
        available_locations: it.available_locations
      }));
    }

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/orders/queue/picking
 * Picking queue for Pickers and active temporary Pickers.
 */
exports.getPickingQueue = async (req, res) => {
  try {
    const storeId = req.user.role === 'ADMIN' ? (req.query.store_id || 1) : (req.user.store_id || 1);

    const [rows] = await pool.query(`
      SELECT o.*, c.customer_name, c.city,
             picker.user_name AS picker_name,
             (SELECT COUNT(*) FROM order_details od WHERE od.order_id = o.order_id) AS items_count
      FROM orders o
      JOIN customer c ON o.customer_id = c.customer_id
      LEFT JOIN \`user\` picker ON o.assigned_picker_id = picker.user_id
      WHERE (o.store_id = ? OR o.store_id IS NULL)
        AND o.status IN ('pending', 'confirmed', 'picking_queue', 'picking_in_progress')
      ORDER BY FIELD(o.status, 'picking_in_progress', 'picking_queue', 'confirmed', 'pending'), o.order_date ASC
    `, [storeId]);

    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/orders/queue/packing
 * Packing queue for Packers.
 */
exports.getPackingQueue = async (req, res) => {
  try {
    const storeId = req.user.role === 'ADMIN' ? (req.query.store_id || 1) : (req.user.store_id || 1);

    const [rows] = await pool.query(`
      SELECT o.*, c.customer_name, c.city,
             picker.user_name AS picker_name,
             packer.user_name AS packer_name,
             (SELECT COUNT(*) FROM order_details od WHERE od.order_id = o.order_id) AS items_count
      FROM orders o
      JOIN customer c ON o.customer_id = c.customer_id
      LEFT JOIN \`user\` picker ON o.assigned_picker_id = picker.user_id
      LEFT JOIN \`user\` packer ON o.assigned_packer_id = packer.user_id
      WHERE (o.store_id = ? OR o.store_id IS NULL)
        AND o.status IN ('picked', 'packing_in_progress')
      ORDER BY FIELD(o.status, 'packing_in_progress', 'picked'), o.order_date ASC
    `, [storeId]);

    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/orders/:id/claim-picking
 * Picker claims an order from the queue and assigns themselves.
 */
exports.claimPicking = async (req, res) => {
  try {
    const orderId = parseId(req.params.id);
    if (!orderId) return res.status(400).json({ success: false, message: 'Invalid order ID' });

    const [rows] = await pool.query('SELECT order_id, status, assigned_picker_id, store_id FROM orders WHERE order_id = ?', [orderId]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Order not found' });

    const order = rows[0];
    if (req.user?.role !== 'ADMIN' && order.store_id && req.user?.store_id && Number(order.store_id) !== Number(req.user.store_id)) {
      return res.status(403).json({ success: false, message: 'Access denied. Order belongs to another store.' });
    }

    if (order.status === 'picking_in_progress' || order.assigned_picker_id) {
      return res.status(409).json({ 
        success: false, 
        message: `Order #${orderId} was already claimed by another picker.` 
      });
    }

    if (!['pending', 'confirmed', 'picking_queue'].includes(order.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Order cannot be claimed for picking (Current status: ${order.status})` 
      });
    }

    const [updateResult] = await pool.query(
      `UPDATE orders 
       SET status = 'picking_in_progress', 
           assigned_picker_id = ?, 
           picking_assigned_at = COALESCE(picking_assigned_at, NOW()),
           picking_started_at = COALESCE(picking_started_at, NOW())
       WHERE order_id = ? AND status IN ('pending', 'confirmed', 'picking_queue')`,
      [req.user.user_id, orderId]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(409).json({ 
        success: false, 
        message: `Order #${orderId} was already claimed by another picker or is no longer in claimable state.` 
      });
    }

    await pool.query(
      `INSERT INTO picking_event_log (order_id, picker_id, event_type, details)
       VALUES (?, ?, 'ASSIGNED', ?)`,
      [orderId, req.user.user_id, `Picker ${req.user.user_name} claimed Order #${orderId}`]
    );

    await pool.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, details)
       VALUES (?, 'UPDATE', 'orders', ?, ?)`,
      [req.user.user_id, orderId, `Picker ${req.user.user_name} claimed Order #${orderId} for picking.`]
    );

    // Notify connected pickers to automatically dismiss this claimed order from their alert dialogs
    socketService.notifyOrderClaimed(orderId, req.user.user_id, order.store_id);

    res.json({ 
      success: true, 
      message: `Order #${orderId} claimed. Picking in progress.`,
      data: { order_id: orderId, status: 'picking_in_progress', assigned_picker_id: req.user.user_id }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/orders/:id/start-picking
 * Explicitly records picking start and measures waiting time.
 */
exports.startPicking = async (req, res) => {
  try {
    const orderId = parseId(req.params.id);
    if (!orderId) return res.status(400).json({ success: false, message: 'Invalid order ID' });

    const [rows] = await pool.query('SELECT order_id, status, assigned_picker_id, store_id, picking_assigned_at FROM orders WHERE order_id = ?', [orderId]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Order not found' });

    const order = rows[0];
    if (req.user?.role !== 'ADMIN' && order.store_id && req.user?.store_id && Number(order.store_id) !== Number(req.user.store_id)) {
      return res.status(403).json({ success: false, message: 'Access denied. Order belongs to another store.' });
    }

    if (order.assigned_picker_id && order.assigned_picker_id !== req.user.user_id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'This order is assigned to another picker' });
    }

    await pool.query(
      `UPDATE orders 
       SET status = 'picking_in_progress', 
           picking_assigned_at = COALESCE(picking_assigned_at, NOW()),
           picking_started_at = COALESCE(picking_started_at, NOW())
       WHERE order_id = ?`,
      [orderId]
    );

    await pool.query(
      `INSERT INTO picking_event_log (order_id, picker_id, event_type, details)
       VALUES (?, ?, 'PICK_STARTED', ?)`,
      [orderId, req.user.user_id, `Picker ${req.user.user_name} started picking Order #${orderId}`]
    );

    res.json({
      success: true,
      message: `Picking started for Order #${orderId}`,
      data: { order_id: orderId, status: 'picking_in_progress' }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/orders/:id/items/:allocationId/start
 * Starts picking a specific item allocation and records server timestamp.
 */
exports.startItem = async (req, res) => {
  try {
    const orderId = parseId(req.params.id);
    const allocationId = parseId(req.params.allocationId);
    if (!orderId || !allocationId) return res.status(400).json({ success: false, message: 'Valid order and allocation IDs required' });

    const [rows] = await pool.query(
      `SELECT oia.*, o.store_id 
       FROM order_item_allocations oia 
       JOIN orders o ON oia.order_id = o.order_id 
       WHERE oia.allocation_id = ? AND oia.order_id = ?`,
      [allocationId, orderId]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Allocation item not found' });

    const item = rows[0];
    if (req.user?.role !== 'ADMIN' && item.store_id && req.user?.store_id && Number(item.store_id) !== Number(req.user.store_id)) {
      return res.status(403).json({ success: false, message: 'Access denied. Order belongs to another store.' });
    }

    if (['PICKED', 'SHORTAGE'].includes(item.status)) {
      return res.status(400).json({ success: false, message: 'Item already completed' });
    }

    // Ensure order is in picking_in_progress
    await pool.query(
      `UPDATE orders SET status = 'picking_in_progress', picking_started_at = COALESCE(picking_started_at, NOW()) WHERE order_id = ?`,
      [orderId]
    );

    await pool.query(
      `UPDATE order_item_allocations 
       SET status = 'IN_PROGRESS', started_at = COALESCE(started_at, NOW())
       WHERE allocation_id = ?`,
      [allocationId]
    );

    await pool.query(
      `INSERT INTO picking_event_log (order_id, allocation_id, picker_id, event_type, details)
       VALUES (?, ?, ?, 'ITEM_STARTED', ?)`,
      [orderId, allocationId, req.user.user_id, `Started item ${item.product_id}`]
    );

    res.json({ success: true, message: 'Item picking started', data: { allocation_id: allocationId, status: 'IN_PROGRESS' } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/orders/:id/items/:allocationId/confirm
 * Confirms picked quantity with server timestamp, prevents over-picking,
 * handles partial shortages, and reconciles inventory safely.
 */
exports.confirmItem = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const orderId = parseId(req.params.id);
    const allocationId = parseId(req.params.allocationId);
    const { picked_quantity, shortage_reason, notes } = req.body;

    if (!orderId || !allocationId) {
      return res.status(400).json({ success: false, message: 'Valid order and allocation IDs required' });
    }

    const pickedQty = Number(picked_quantity);
    if (!Number.isInteger(pickedQty) || pickedQty < 0) {
      return res.status(400).json({ success: false, message: 'Picked quantity must be a non-negative integer' });
    }

    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT oia.*, o.store_id 
       FROM order_item_allocations oia 
       JOIN orders o ON oia.order_id = o.order_id 
       WHERE oia.allocation_id = ? AND oia.order_id = ? FOR UPDATE`,
      [allocationId, orderId]
    );
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Allocation item not found' });
    }

    const item = rows[0];
    if (req.user?.role !== 'ADMIN' && item.store_id && req.user?.store_id && Number(item.store_id) !== Number(req.user.store_id)) {
      await connection.rollback();
      return res.status(403).json({ success: false, message: 'Access denied. Order belongs to another store.' });
    }

    if (item.status === 'PICKED' || item.status === 'SHORTAGE') {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Item already confirmed. Duplicate confirmation rejected.' });
    }

    if (pickedQty > item.allocated_quantity) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: `Cannot confirm more than allocated quantity (${item.allocated_quantity})` 
      });
    }

    const isShortage = pickedQty < item.allocated_quantity;
    const shortageQty = item.allocated_quantity - pickedQty;
    const newStatus = isShortage ? 'SHORTAGE' : 'PICKED';

    // If partial pick / shortage, restore unpicked quantity to inventory
    if (isShortage && item.inventory_id && !item.is_restored) {
      await connection.query(
        'UPDATE inventory SET quantity = quantity + ? WHERE inventory_id = ?',
        [shortageQty, item.inventory_id]
      );
    }

    await connection.query(
      `UPDATE order_item_allocations 
       SET picked_quantity = ?, 
           shortage_quantity = ?, 
           status = ?, 
           is_restored = ?,
           picked_at = NOW(),
           started_at = COALESCE(started_at, NOW()),
           shortage_reason = ?,
           notes = ?
       WHERE allocation_id = ?`,
      [
        pickedQty, 
        shortageQty, 
        newStatus, 
        isShortage ? (pickedQty === 0) : item.is_restored,
        shortage_reason || null,
        notes || null,
        allocationId
      ]
    );

    await connection.query(
      `INSERT INTO picking_event_log (order_id, allocation_id, picker_id, event_type, details)
       VALUES (?, ?, ?, ?, ?)`,
      [
        orderId, 
        allocationId, 
        req.user.user_id, 
        isShortage ? 'ITEM_SHORTAGE' : 'ITEM_CONFIRMED', 
        JSON.stringify({ picked: pickedQty, allocated: item.allocated_quantity, shortage: shortageQty, reason: shortage_reason })
      ]
    );

    if (isShortage) {
      await connection.query(
        `INSERT INTO audit_log (user_id, action, table_name, record_id, details)
         VALUES (?, 'UPDATE', 'inventory', ?, ?)`,
        [
          req.user.user_id, 
          item.inventory_id || orderId, 
          `Shortage of ${shortageQty} units reported for Order #${orderId} (Item: ${item.product_id}). Restored to inventory.`
        ]
      );
    }

    // Check if all items in this order are now resolved
    const [remainingItems] = await connection.query(
      `SELECT COUNT(*) AS unresolved 
       FROM order_item_allocations 
       WHERE order_id = ? AND status IN ('PENDING', 'IN_PROGRESS', 'PAUSED')`,
      [orderId]
    );

    let orderCompleted = false;
    if (remainingItems[0].unresolved === 0) {
      await connection.query(
        `UPDATE orders SET status = 'picked', picked_at = NOW() WHERE order_id = ?`,
        [orderId]
      );
      await connection.query(
        `INSERT INTO picking_event_log (order_id, picker_id, event_type, details)
         VALUES (?, ?, 'ORDER_COMPLETED', ?)`,
        [orderId, req.user.user_id, `All items resolved for Order #${orderId}`]
      );
      orderCompleted = true;
    }

    await connection.commit();

    res.json({
      success: true,
      message: isShortage 
        ? `Shortage of ${shortageQty} units recorded. ${pickedQty} units confirmed.` 
        : `Item picked successfully (${pickedQty}/${item.allocated_quantity}).`,
      data: {
        allocation_id: allocationId,
        picked_quantity: pickedQty,
        shortage_quantity: shortageQty,
        status: newStatus,
        order_completed: orderCompleted
      }
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

/**
 * POST /api/orders/:id/items/:allocationId/pause
 * Pauses picking for an item with server timestamp.
 */
exports.pauseItem = async (req, res) => {
  try {
    const orderId = parseId(req.params.id);
    const allocationId = parseId(req.params.allocationId);
    const { reason } = req.body;

    await pool.query(
      `UPDATE order_item_allocations 
       SET status = 'PAUSED', paused_at = NOW()
       WHERE allocation_id = ? AND order_id = ? AND status = 'IN_PROGRESS'`,
      [allocationId, orderId]
    );

    await pool.query(
      `INSERT INTO picking_event_log (order_id, allocation_id, picker_id, event_type, details)
       VALUES (?, ?, ?, 'ITEM_PAUSED', ?)`,
      [orderId, allocationId, req.user.user_id, reason || 'Picking paused by picker']
    );

    res.json({ success: true, message: 'Item picking paused', data: { allocation_id: allocationId, status: 'PAUSED' } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/orders/:id/items/:allocationId/resume
 * Resumes item picking and accumulates paused duration.
 */
exports.resumeItem = async (req, res) => {
  try {
    const orderId = parseId(req.params.id);
    const allocationId = parseId(req.params.allocationId);

    const [rows] = await pool.query(
      'SELECT paused_at, total_paused_seconds FROM order_item_allocations WHERE allocation_id = ? AND order_id = ?',
      [allocationId, orderId]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Allocation item not found' });

    const item = rows[0];
    let pausedSeconds = 0;
    if (item.paused_at) {
      pausedSeconds = Math.max(0, Math.floor((new Date() - new Date(item.paused_at)) / 1000));
    }

    await pool.query(
      `UPDATE order_item_allocations 
       SET status = 'IN_PROGRESS', 
           paused_at = NULL, 
           total_paused_seconds = total_paused_seconds + ?
       WHERE allocation_id = ? AND order_id = ?`,
      [pausedSeconds, allocationId, orderId]
    );

    await pool.query(
      `INSERT INTO picking_event_log (order_id, allocation_id, picker_id, event_type, duration_seconds, details)
       VALUES (?, ?, ?, 'ITEM_RESUMED', ?, 'Picking resumed')`,
      [orderId, allocationId, req.user.user_id, pausedSeconds]
    );

    res.json({ success: true, message: 'Item picking resumed', data: { allocation_id: allocationId, status: 'IN_PROGRESS' } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/orders/:id/complete-picking
 * Completes picking for an entire order. Resolves any remaining pending items.
 */
exports.completePicking = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const orderId = parseId(req.params.id);
    if (!orderId) return res.status(400).json({ success: false, message: 'Invalid order ID' });

    await connection.beginTransaction();

    const [rows] = await connection.query('SELECT order_id, status, store_id FROM orders WHERE order_id = ? FOR UPDATE', [orderId]);
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const order = rows[0];
    if (req.user?.role !== 'ADMIN' && order.store_id && req.user?.store_id && Number(order.store_id) !== Number(req.user.store_id)) {
      await connection.rollback();
      return res.status(403).json({ success: false, message: 'Access denied. Order belongs to another store.' });
    }

    if (order.status !== 'picking_in_progress') {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: `Cannot complete picking. Order must be in 'picking_in_progress' (Current status: ${order.status})` 
      });
    }

    // Mark any unconfirmed allocations as picked
    await connection.query(
      `UPDATE order_item_allocations 
       SET status = 'PICKED', 
           picked_quantity = allocated_quantity,
           picked_at = COALESCE(picked_at, NOW()),
           started_at = COALESCE(started_at, NOW())
       WHERE order_id = ? AND status IN ('PENDING', 'IN_PROGRESS', 'PAUSED')`,
      [orderId]
    );

    await connection.query(
      `UPDATE orders 
       SET status = 'picked', picked_at = NOW() 
       WHERE order_id = ?`,
      [orderId]
    );

    await connection.query(
      `INSERT INTO picking_event_log (order_id, picker_id, event_type, details)
       VALUES (?, ?, 'ORDER_COMPLETED', ?)`,
      [orderId, req.user.user_id, `Order #${orderId} marked picked by ${req.user.user_name}`]
    );

    await connection.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, details)
       VALUES (?, 'UPDATE', 'orders', ?, ?)`,
      [req.user.user_id, orderId, `Picker ${req.user.user_name} completed picking for Order #${orderId}. Ready for packing.`]
    );

    await connection.commit();

    res.json({ 
      success: true, 
      message: `Order #${orderId} picked successfully. Ready for packing queue.`,
      data: { order_id: orderId, status: 'picked' }
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

/**
 * POST /api/orders/:id/claim-packing
 */
exports.claimPacking = async (req, res) => {
  try {
    const orderId = parseId(req.params.id);
    if (!orderId) return res.status(400).json({ success: false, message: 'Invalid order ID' });

    const [rows] = await pool.query('SELECT order_id, status, store_id FROM orders WHERE order_id = ?', [orderId]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Order not found' });

    const order = rows[0];
    if (req.user?.role !== 'ADMIN' && order.store_id && req.user?.store_id && Number(order.store_id) !== Number(req.user.store_id)) {
      return res.status(403).json({ success: false, message: 'Access denied. Order belongs to another store.' });
    }

    if (order.status !== 'picked') {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot pack order. Picking must be complete first (Current status: ${order.status})` 
      });
    }

    const [updateResult] = await pool.query(
      `UPDATE orders 
       SET status = 'packing_in_progress', assigned_packer_id = ? 
       WHERE order_id = ? AND status = 'picked'`,
      [req.user.user_id, orderId]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(409).json({ 
        success: false, 
        message: `Order #${orderId} was already claimed for packing or is not in picked state.` 
      });
    }

    await pool.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, details)
       VALUES (?, 'UPDATE', 'orders', ?, ?)`,
      [req.user.user_id, orderId, `Packer ${req.user.user_name} claimed Order #${orderId} for packing.`]
    );

    res.json({ 
      success: true, 
      message: `Order #${orderId} claimed. Packing in progress.`,
      data: { order_id: orderId, status: 'packing_in_progress' }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/orders/:id/complete-packing
 */
exports.completePacking = async (req, res) => {
  try {
    const orderId = parseId(req.params.id);
    if (!orderId) return res.status(400).json({ success: false, message: 'Invalid order ID' });

    const [rows] = await pool.query('SELECT order_id, status, store_id FROM orders WHERE order_id = ?', [orderId]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Order not found' });

    const order = rows[0];
    if (req.user?.role !== 'ADMIN' && order.store_id && req.user?.store_id && Number(order.store_id) !== Number(req.user.store_id)) {
      return res.status(403).json({ success: false, message: 'Access denied. Order belongs to another store.' });
    }

    if (order.status !== 'packing_in_progress') {
      return res.status(400).json({ 
        success: false, 
        message: `Order must be in 'packing_in_progress' to complete packing (Current status: ${order.status})` 
      });
    }

    await pool.query(
      `UPDATE orders 
       SET status = 'packed', packed_at = NOW() 
       WHERE order_id = ?`,
      [orderId]
    );

    await pool.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, details)
       VALUES (?, 'UPDATE', 'orders', ?, ?)`,
      [req.user.user_id, orderId, `Packer ${req.user.user_name} completed packing for Order #${orderId}. Sealed for dispatch.`]
    );

    res.json({ 
      success: true, 
      message: `Order #${orderId} packed and ready for dispatch.`,
      data: { order_id: orderId, status: 'packed' }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/orders/:id/status
 * Updates status with transition validation.
 * Reconciles inventory safely on cancellation.
 */
exports.updateStatus = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const orderId = parseId(req.params.id);
    const { status } = req.body;
    if (!orderId || typeof status !== 'string' || !Object.hasOwn(ALLOWED_TRANSITIONS, status)) {
      return res.status(400).json({ success: false, message: 'Valid order ID and status are required' });
    }
    const isAdmin = String(req.user.role).toUpperCase() === 'ADMIN';
    const where = isAdmin ? 'order_id = ?' : 'order_id = ? AND store_id = ?';
    const params = isAdmin ? [orderId] : [orderId, req.user.store_id];

    await connection.beginTransaction();

    const [rows] = await connection.query(`SELECT order_id, status FROM orders WHERE ${where} FOR UPDATE`, params);
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    const currentStatus = rows[0].status;
    if (!(ALLOWED_TRANSITIONS[currentStatus] || []).includes(status)) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: `Invalid status transition from '${currentStatus}' to '${status}'.` });
    }

    // Safe cancellation: restore previously deducted stock that hasn't already been restored
    if (status === 'cancelled') {
      const [allocations] = await connection.query(
        `SELECT * FROM order_item_allocations 
         WHERE order_id = ? AND is_restored = FALSE FOR UPDATE`,
        [orderId]
      );

      for (const alloc of allocations) {
        // Distinguish unpicked stock vs physically picked stock
        const pickedQty = Number(alloc.picked_quantity) || 0;
        const shortageQty = Number(alloc.shortage_quantity) || 0;
        const unpickedQty = Math.max(0, alloc.allocated_quantity - pickedQty - shortageQty);

        // Unpicked stock never left the shelf, so it can be restored immediately
        if (unpickedQty > 0 && alloc.inventory_id) {
          await connection.query(
            'UPDATE inventory SET quantity = quantity + ? WHERE inventory_id = ?',
            [unpickedQty, alloc.inventory_id]
          );
        }

        if (pickedQty > 0) {
          // Physically picked stock is currently in tote/cart. It must not become sellable until returned & verified.
          await connection.query(
            "UPDATE order_item_allocations SET status = 'RETURN_PENDING', is_restored = FALSE WHERE allocation_id = ?",
            [alloc.allocation_id]
          );
        } else {
          // No physically picked units remain
          await connection.query(
            'UPDATE order_item_allocations SET is_restored = TRUE WHERE allocation_id = ?',
            [alloc.allocation_id]
          );
        }
      }

      await connection.query(
        `INSERT INTO audit_log (user_id, action, table_name, record_id, details)
         VALUES (?, 'UPDATE', 'orders', ?, ?)`,
        [req.user.user_id, orderId, `Order #${orderId} cancelled by ${req.user.user_name}. Unpicked stock restored; picked items set to RETURN_PENDING.`]
      );
    }

    await connection.query(`UPDATE orders SET status = ? WHERE ${where}`, [status, ...params]);
    await connection.commit();

    return res.json({ success: true, message: `Order #${orderId} status updated to '${status}'.` });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ success: false, message: 'Unable to update order status' });
  } finally {
    connection.release();
  }
};

/**
 * POST /api/orders/:id/items/:allocationId/confirm-return
 * Confirms physical return of a picked item on a cancelled order.
 * Restores shelf inventory and transitions status to RETURNED.
 */
exports.confirmItemReturn = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const orderId = parseId(req.params.id);
    const allocationId = parseId(req.params.allocationId);
    if (!orderId || !allocationId) {
      return res.status(400).json({ success: false, message: 'Valid order and allocation IDs required' });
    }

    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT oia.*, o.store_id, o.status AS order_status
       FROM order_item_allocations oia
       JOIN orders o ON oia.order_id = o.order_id
       WHERE oia.allocation_id = ? AND oia.order_id = ? FOR UPDATE`,
      [allocationId, orderId]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Allocation item not found' });
    }

    const alloc = rows[0];
    if (req.user?.role !== 'ADMIN' && alloc.store_id && req.user?.store_id && Number(alloc.store_id) !== Number(req.user.store_id)) {
      await connection.rollback();
      return res.status(403).json({ success: false, message: 'Access denied. Order belongs to another store.' });
    }

    if (alloc.status !== 'RETURN_PENDING' || alloc.is_restored) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'Item is not awaiting return or has already been restored' 
      });
    }

    const restoreQty = Number(alloc.picked_quantity);
    if (restoreQty > 0 && alloc.inventory_id) {
      await connection.query(
        'UPDATE inventory SET quantity = quantity + ? WHERE inventory_id = ?',
        [restoreQty, alloc.inventory_id]
      );
    }

    await connection.query(
      "UPDATE order_item_allocations SET status = 'RETURNED', is_restored = TRUE WHERE allocation_id = ?",
      [allocationId]
    );

    await connection.query(
      `INSERT INTO picking_event_log (order_id, allocation_id, picker_id, event_type, details)
       VALUES (?, ?, ?, 'ITEM_RETURNED', ?)`,
      [orderId, allocationId, req.user.user_id, `Physical return confirmed for ${restoreQty} units`]
    );

    await connection.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, details)
       VALUES (?, 'UPDATE', 'inventory', ?, ?)`,
      [req.user.user_id, alloc.inventory_id || orderId, `Physical return of ${restoreQty} units confirmed for Order #${orderId}. Restored to inventory.`]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: `Physical return confirmed. ${restoreQty} units restored to inventory.`,
      data: { allocation_id: allocationId, status: 'RETURNED', restored_quantity: restoreQty }
    });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

/**
 * POST /api/orders
 * Creates an order, deducts stock via FEFO, and records exact item allocations.
 */
exports.create = async (req, res) => {
  const { customer_id, shipping_address, items, store_id } = req.body;

  if (!customer_id || !shipping_address || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  for (const item of items) {
    if (!Number.isInteger(Number(item.product_id)) || Number(item.product_id) <= 0 || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0) {
      return res.status(400).json({ success: false, message: 'Each item requires a valid product_id and positive integer quantity' });
    }
  }
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    let totalAmount = 0;
    
    // Process items, fetch prices
    for (const item of items) {
      const [productRows] = await connection.query(
        `SELECT unit_price, product_name FROM product WHERE product_id = ?`,
        [item.product_id]
      );
      if (productRows.length === 0) {
        throw new Error(`Product not found for ID: ${item.product_id}`);
      }
      
      item.unit_price = productRows[0].unit_price;
      totalAmount += (item.quantity * item.unit_price);
    }

    // Insert Order with initial status 'confirmed'
    const orderStoreId = store_id || req.user?.store_id || 1;
    const [orderResult] = await connection.query(
      `INSERT INTO orders (customer_id, store_id, order_date, total_amount, status, shipping_address) 
       VALUES (?, ?, NOW(), ?, 'confirmed', ?)`,
      [customer_id, orderStoreId, totalAmount, shipping_address]
    );
    const orderId = orderResult.insertId;

    // Process order details and reduce inventory with explicit allocation records
    for (const item of items) {
      const totalPrice = item.quantity * item.unit_price;
      
      const [detailResult] = await connection.query(
        `INSERT INTO order_details (order_id, product_id, quantity, unit_price, total_price) 
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.product_id, item.quantity, item.unit_price, totalPrice]
      );
      const orderDetailId = detailResult.insertId;

      // Lock eligible batches and allocate by earliest expiry (FEFO)
      const [invRows] = await connection.query(
        `SELECT i.inventory_id, i.batch_id, i.location_id, i.quantity, b.expiry_date
         FROM inventory i
         JOIN batch b ON b.batch_id = i.batch_id
         WHERE i.product_id = ? AND i.quantity > 0 AND b.expiry_date >= CURDATE()
         ORDER BY b.expiry_date ASC, i.inventory_id ASC
         FOR UPDATE`,
        [item.product_id]
      );

      const deductions = planBatchDeductions(invRows, Number(item.quantity));
      for (const deduction of deductions) {
        await connection.query(
          'UPDATE inventory SET quantity = quantity - ? WHERE inventory_id = ?', 
          [deduction.quantity, deduction.inventory_id]
        );

        // Store exact allocated inventory, batch, and location for the picker
        await connection.query(
          `INSERT INTO order_item_allocations 
           (order_id, order_detail_id, product_id, inventory_id, batch_id, location_id, allocated_quantity, picked_quantity, shortage_quantity, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 'PENDING')`,
          [orderId, orderDetailId, item.product_id, deduction.inventory_id, deduction.batch_id || null, deduction.location_id || null, deduction.quantity]
        );
      }
    }

    await connection.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, details) 
       VALUES (?, 'INSERT', 'orders', ?, ?)`,
      [req.user?.user_id || 1, orderId, `Created order #${orderId} with ${items.length} items for ₹${totalAmount}`]
    );

    await connection.commit();

    // Trigger real-time order alert to authorized pickers strictly AFTER transaction commit
    socketService.notifyPickersNewOrder(orderId, orderStoreId).catch(err => {
      console.error('Failed to emit new order alert:', err.message);
    });

    res.status(201).json({ 
      success: true, 
      message: 'Order created successfully',
      data: { insertId: orderId, order_id: orderId }
    });
  } catch (error) {
    await connection.rollback();
    res.status(400).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

/**
 * GET /api/orders/manager/picking-activity
 * Real-time picking activity and duration tracking for managers.
 * Enforces store scoping and manager/admin authorization.
 */
exports.getManagerPickingActivity = async (req, res) => {
  try {
    const userRole = String(req.user.role).toUpperCase();
    if (userRole !== 'ADMIN' && userRole !== 'STORE_MANAGER') {
      return res.status(403).json({ success: false, message: 'Access denied. Manager privileges required.' });
    }

    const storeId = userRole === 'ADMIN' ? (req.query.store_id || null) : req.user.store_id;

    let query = `
      SELECT o.order_id, o.store_id, o.order_date, o.status,
             o.picking_assigned_at, o.picking_started_at, o.picked_at,
             picker.user_id AS picker_id, picker.user_name AS picker_name,
             s.store_name,
             c.customer_name
      FROM orders o
      JOIN \`user\` picker ON o.assigned_picker_id = picker.user_id
      LEFT JOIN store s ON o.store_id = s.store_id
      LEFT JOIN customer c ON o.customer_id = c.customer_id
      WHERE o.status IN ('picking_queue', 'picking_in_progress', 'picked')
    `;
    const params = [];
    if (storeId) {
      query += ` AND (o.store_id = ? OR o.store_id IS NULL)`;
      params.push(storeId);
    }
    query += ` ORDER BY FIELD(o.status, 'picking_in_progress', 'picking_queue', 'picked'), o.picking_started_at DESC, o.order_date ASC LIMIT 50`;

    const [orders] = await pool.query(query, params);

    const enriched = await Promise.all(orders.map(async (ord) => {
      const [allocations] = await pool.query(`
        SELECT oia.*, p.product_name, p.sku,
               l.location_name, l.rack_number, l.aisle, l.shelf, l.bin, l.zone
        FROM order_item_allocations oia
        JOIN product p ON oia.product_id = p.product_id
        LEFT JOIN location l ON oia.location_id = l.location_id
        WHERE oia.order_id = ?
        ORDER BY oia.allocation_id ASC
      `, [ord.order_id]);

      const totalItems = allocations.length;
      const pickedItems = allocations.filter(a => a.status === 'PICKED' || a.status === 'SHORTAGE').length;
      const remainingItems = totalItems - pickedItems;

      // Identify currently active or next pending item
      const currentItem = allocations.find(a => a.status === 'IN_PROGRESS' || a.status === 'PAUSED') 
        || allocations.find(a => a.status === 'PENDING') 
        || null;

      const currentItemLocation = currentItem ? formatLocationDisplay(currentItem) : null;

      // Durations: Server-calculated from timestamps
      const durations = calculatePickingDurations(ord);

      // Active item duration
      let currentItemDuration = 0;
      if (currentItem && currentItem.started_at) {
        const end = currentItem.picked_at ? new Date(currentItem.picked_at) : new Date();
        currentItemDuration = Math.max(0, Math.floor((end - new Date(currentItem.started_at)) / 1000) - (currentItem.total_paused_seconds || 0));
      }

      // Total active picking duration: sum of active item durations
      const totalActiveSeconds = allocations.reduce((sum, a) => {
        if (!a.started_at) return sum;
        const end = a.picked_at ? new Date(a.picked_at) : (a.status === 'IN_PROGRESS' ? new Date() : (a.paused_at ? new Date(a.paused_at) : new Date()));
        const itemSecs = Math.max(0, Math.floor((end - new Date(a.started_at)) / 1000) - (a.total_paused_seconds || 0));
        return sum + itemSecs;
      }, 0);

      // Delayed order detection: picking active > 10 min (600s) or queue waiting > 5 min (300s)
      const isDelayed = (ord.status === 'picking_in_progress' && durations.totalElapsedSeconds > 600) ||
                        (ord.status === 'picking_queue' && durations.waitingSeconds > 300);

      return {
        order_id: ord.order_id,
        picker_id: ord.picker_id,
        picker_name: ord.picker_name,
        order_date: ord.order_date,
        status: ord.status,
        store_name: ord.store_name,
        customer_name: ord.customer_name,
        picking_assigned_at: ord.picking_assigned_at,
        picking_started_at: ord.picking_started_at,
        picked_at: ord.picked_at,
        waiting_time_seconds: durations.waitingSeconds,
        total_elapsed_seconds: durations.totalElapsedSeconds,
        total_active_seconds: totalActiveSeconds,
        current_item_duration_seconds: currentItemDuration,
        total_items: totalItems,
        picked_items: pickedItems,
        remaining_items: remainingItems,
        current_item: currentItem ? {
          allocation_id: currentItem.allocation_id,
          product_name: currentItem.product_name,
          sku: currentItem.sku,
          status: currentItem.status,
          allocated_quantity: currentItem.allocated_quantity,
          location_display: currentItemLocation?.text || 'Location not assigned',
          is_assigned: currentItemLocation?.isAssigned || false
        } : null,
        is_delayed: isDelayed
      };
    }));

    res.json({
      success: true,
      data: enriched,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/orders/:id/picking-history
 * Detailed event log and item history for manager inspection.
 */
exports.getPickingHistory = async (req, res) => {
  try {
    const orderId = parseId(req.params.id);
    if (!orderId) return res.status(400).json({ success: false, message: 'Invalid order ID' });

    const [orders] = await pool.query('SELECT order_id, store_id FROM orders WHERE order_id = ?', [orderId]);
    if (orders.length === 0) return res.status(404).json({ success: false, message: 'Order not found' });
    const order = orders[0];
    if (req.user?.role !== 'ADMIN' && order.store_id && req.user?.store_id && Number(order.store_id) !== Number(req.user.store_id)) {
      return res.status(403).json({ success: false, message: 'Access denied. Order belongs to another store.' });
    }

    const [allocations] = await pool.query(`
      SELECT oia.*, p.product_name, p.sku,
             l.location_name, l.rack_number, l.aisle, l.shelf, l.bin, l.zone,
             b.batch_code, b.expiry_date
      FROM order_item_allocations oia
      JOIN product p ON oia.product_id = p.product_id
      LEFT JOIN location l ON oia.location_id = l.location_id
      LEFT JOIN batch b ON oia.batch_id = b.batch_id
      WHERE oia.order_id = ?
      ORDER BY oia.allocation_id ASC
    `, [orderId]);

    const [events] = await pool.query(`
      SELECT pel.*, u.user_name AS picker_name
      FROM picking_event_log pel
      JOIN \`user\` u ON pel.picker_id = u.user_id
      WHERE pel.order_id = ?
      ORDER BY pel.event_time ASC
    `, [orderId]);

    const enrichedAllocations = allocations.map(a => ({
      ...a,
      location_display: formatLocationDisplay(a).text,
      is_location_assigned: formatLocationDisplay(a).isAssigned
    }));

    res.json({
      success: true,
      data: {
        order_id: orderId,
        items: enrichedAllocations,
        allocations: enrichedAllocations,
        events
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
