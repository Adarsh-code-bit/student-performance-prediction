const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const pool = require('../config/db.config');
const { getJwtSecret } = require('../config/security.config');
const { formatLocationDisplay } = require('../utils/picking.util');

let io = null;

/**
 * Initializes Socket.IO with HTTP server and secure JWT authentication.
 */
function init(server, allowedOrigins = []) {
  io = new Server(server, {
    cors: {
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        try {
          const originUrl = new URL(origin);
          const isLoopback = originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1' || originUrl.hostname === '::1';
          if (isLoopback && (process.env.NODE_ENV !== 'production' || allowedOrigins.includes(origin))) {
            return callback(null, true);
          }
          const hasMatchingPort = allowedOrigins.some(ao => {
            try {
              const aoUrl = new URL(ao);
              return aoUrl.port === originUrl.port && (aoUrl.hostname === 'localhost' || aoUrl.hostname === '127.0.0.1' || aoUrl.hostname === '::1');
            } catch (e) {
              return false;
            }
          });
          if (isLoopback && hasMatchingPort) return callback(null, true);
        } catch (e) {}
        const error = new Error('Origin is not allowed by CORS.');
        error.status = 403;
        return callback(error);
      },
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 30000,
    pingInterval: 15000
  });

  // Socket.IO Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const rawToken = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
      if (!rawToken) {
        return next(new Error('Authentication required. No token provided.'));
      }

      const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken;
      const decoded = jwt.verify(token, getJwtSecret());
      socket.user = decoded;

      // Determine effective operational role (incorporating temporary staff reassignments)
      if (decoded.role === 'STAFF') {
        const [allocRows] = await pool.query(
          "SELECT assigned_role FROM staff_allocation WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1",
          [decoded.user_id]
        );
        socket.user.effective_role = (allocRows[0]?.assigned_role || decoded.staff_subrole || 'STAFF').toUpperCase();
      } else {
        socket.user.effective_role = (decoded.role || '').toUpperCase();
      }

      next();
    } catch (err) {
      return next(new Error('Unauthorized: Invalid or expired token.'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    const storeId = user.store_id || 1;
    const isPicker = user.effective_role === 'PICKER' || user.role === 'ADMIN' || user.role === 'STORE_MANAGER';

    // Join user-specific private room
    socket.join(`user_${user.user_id}`);

    // Join store-specific picker alert room strictly for authorized pickers
    if (isPicker) {
      socket.join(`store_${storeId}_pickers`);
      if (user.role === 'ADMIN') {
        socket.join('admin_pickers');
      }
    }

    socket.on('disconnect', () => {
      // Clean connection teardown
    });
  });

  return io;
}

/**
 * Returns current io instance.
 */
function getIO() {
  return io;
}

/**
 * Emits real-time order alert strictly to authorized pickers in the order's store.
 * Emitted strictly AFTER database transaction commits.
 */
async function notifyPickersNewOrder(orderId, storeId) {
  if (!io) return;

  try {
    // 1. Fetch order header details
    const [orderRows] = await pool.query(`
      SELECT o.order_id, o.store_id, o.order_date, o.status,
             (SELECT COUNT(DISTINCT product_id) FROM order_details WHERE order_id = o.order_id) AS distinct_products_count,
             (SELECT COALESCE(SUM(quantity), 0) FROM order_details WHERE order_id = o.order_id) AS total_item_quantity
      FROM orders o
      WHERE o.order_id = ?
    `, [orderId]);

    if (orderRows.length === 0) return;
    const order = orderRows[0];

    // 2. Fetch distinct item allocations with location guidance
    const [itemRows] = await pool.query(`
      SELECT od.product_id, p.product_name, od.quantity,
             l.zone, l.aisle, l.rack_number, l.shelf, l.bin, l.location_name
      FROM order_details od
      JOIN product p ON od.product_id = p.product_id
      LEFT JOIN order_item_allocations oia ON od.order_detail_id = oia.order_detail_id
      LEFT JOIN location l ON oia.location_id = l.location_id
      WHERE od.order_id = ?
      ORDER BY od.order_detail_id ASC
    `, [orderId]);

    // Format products and rack/shelf locations for the picker display
    const items = itemRows.map(row => {
      const guidance = formatLocationDisplay(row);
      // Compact location string for mobile (e.g. "Rack A1" or "Aisle: A-01 | Rack: R-04")
      let locationShort = 'Location not assigned';
      if (guidance.isAssigned) {
        const segs = [];
        if (row.aisle) segs.push(`Aisle ${row.aisle}`);
        if (row.rack_number) segs.push(`Rack ${row.rack_number}`);
        if (row.shelf) segs.push(`Shelf ${row.shelf}`);
        if (row.bin) segs.push(`Bin ${row.bin}`);
        locationShort = segs.length > 0 ? segs.join(' ') : (row.location_name || 'Location not assigned');
      }

      return {
        product_id: row.product_id,
        product_name: row.product_name,
        quantity: row.quantity,
        location: locationShort
      };
    });

    const orderDate = new Date(order.order_date);
    const createdTime = orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const alertPayload = {
      order_id: order.order_id,
      store_id: order.store_id,
      order_date: order.order_date,
      created_time: createdTime,
      distinct_products_count: Number(order.distinct_products_count) || items.length,
      total_item_quantity: Number(order.total_item_quantity) || items.reduce((sum, it) => sum + it.quantity, 0),
      status: order.status,
      items
    };

    // Broadcast strictly to authorized pickers for this dark store and system admins
    const targetRoom = `store_${storeId || order.store_id || 1}_pickers`;
    io.to(targetRoom).to('admin_pickers').emit('new_order_alert', alertPayload);
  } catch (err) {
    console.error('Error emitting new order alert via Socket.IO:', err.message);
  }
}

/**
 * Emits order claimed event so other pickers' mobile screens automatically dismiss the alert.
 */
function notifyOrderClaimed(orderId, pickerId, storeId) {
  if (!io) return;
  const targetRoom = `store_${storeId || 1}_pickers`;
  io.to(targetRoom).to('admin_pickers').emit('order_claimed', {
    order_id: Number(orderId),
    picker_id: Number(pickerId)
  });
}

module.exports = {
  init,
  getIO,
  notifyPickersNewOrder,
  notifyOrderClaimed
};
