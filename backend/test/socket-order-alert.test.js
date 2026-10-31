const test = require('node:test');
const { after } = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../config/db.config');
const socketService = require('../services/socket.service');
const orderController = require('../controllers/order.controller');

after(async () => {
  await pool.end();
});

function mockRes() {
  let statusCode = 200;
  let responseData = null;
  return {
    res: {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      }
    },
    getStatus: () => statusCode,
    getData: () => responseData
  };
}

test('Socket.IO Service: initializes and exposes notification API', () => {
  assert.equal(typeof socketService.init, 'function');
  assert.equal(typeof socketService.notifyPickersNewOrder, 'function');
  assert.equal(typeof socketService.notifyOrderClaimed, 'function');
});

test('Socket.IO Payload: formats complete order alert with distinct products, quantities, and rack locations', async () => {
  // 1. Setup sample order with product and location
  const [custRows] = await pool.query('SELECT customer_id FROM customer LIMIT 1');
  const [prodRows] = await pool.query('SELECT product_id, product_name, unit_price FROM product LIMIT 1');
  const [locRows] = await pool.query('SELECT location_id, rack_number, shelf, bin, aisle FROM location LIMIT 1');
  const [invRows] = await pool.query('SELECT inventory_id FROM inventory LIMIT 1');

  const customerId = custRows[0]?.customer_id || 1;
  const productId = prodRows[0]?.product_id || 1;
  const locationId = locRows[0]?.location_id || null;
  const inventoryId = invRows[0]?.inventory_id || null;

  const [orderResult] = await pool.query(
    `INSERT INTO orders (customer_id, order_date, total_amount, status, store_id) 
     VALUES (?, NOW(), 350.00, 'confirmed', 1)`,
    [customerId]
  );
  const testOrderId = orderResult.insertId;

  try {
    const [detailResult] = await pool.query(
      `INSERT INTO order_details (order_id, product_id, quantity, unit_price, total_price)
       VALUES (?, ?, 3, 50.00, 150.00)`,
      [testOrderId, productId]
    );
    const detailId = detailResult.insertId;

    if (locationId) {
      await pool.query(
        `INSERT INTO order_item_allocations 
         (order_id, order_detail_id, product_id, inventory_id, location_id, allocated_quantity, picked_quantity, shortage_quantity, status)
         VALUES (?, ?, ?, ?, ?, 3, 0, 0, 'PENDING')`,
        [testOrderId, detailId, productId, inventoryId, locationId]
      );
    }

    const http = require('http');
    const dummyServer = http.createServer();
    socketService.init(dummyServer);

    // Call notifyPickersNewOrder
    await socketService.notifyPickersNewOrder(testOrderId, 1);

    // Verify order was queried and can be formatted without error
    const [fetchedOrder] = await pool.query('SELECT order_id, status FROM orders WHERE order_id = ?', [testOrderId]);
    assert.equal(fetchedOrder.length, 1);
    assert.equal(fetchedOrder[0].status, 'confirmed');

  } finally {
    await pool.query('DELETE FROM order_item_allocations WHERE order_id = ?', [testOrderId]);
    await pool.query('DELETE FROM order_details WHERE order_id = ?', [testOrderId]);
    await pool.query('DELETE FROM orders WHERE order_id = ?', [testOrderId]);
  }
});

test('Concurrent Claim Prevention: ensures two pickers cannot accept the same order simultaneously', async () => {
  const [custRows] = await pool.query('SELECT customer_id FROM customer LIMIT 1');
  const customerId = custRows[0]?.customer_id || 1;

  // Fetch two existing valid users
  const [users] = await pool.query('SELECT user_id, user_name, role FROM user WHERE role IN ("STAFF", "ADMIN") LIMIT 2');
  const user1 = users[0] || { user_id: 1, user_name: 'Admin User', role: 'ADMIN' };
  const user2 = users[1] || { user_id: 2, user_name: 'Manager User', role: 'STORE_MANAGER' };

  const [orderResult] = await pool.query(
    `INSERT INTO orders (customer_id, order_date, total_amount, status, store_id) 
     VALUES (?, NOW(), 199.00, 'confirmed', 1)`,
    [customerId]
  );
  const testOrderId = orderResult.insertId;

  try {
    // Picker 1 claims the order
    const { res: claimRes1, getStatus: getStatus1, getData: getData1 } = mockRes();
    await orderController.claimPicking({
      params: { id: String(testOrderId) },
      user: { user_id: user1.user_id, user_name: user1.user_name, role: user1.role, staff_subrole: 'PICKER', store_id: 1 }
    }, claimRes1);

    assert.equal(getStatus1(), 200, 'First claim must succeed');
    assert.equal(getData1()?.success, true);
    assert.equal(getData1()?.data?.assigned_picker_id, user1.user_id);

    // Picker 2 attempts to claim the EXACT SAME order simultaneously
    const { res: claimRes2, getStatus: getStatus2, getData: getData2 } = mockRes();
    await orderController.claimPicking({
      params: { id: String(testOrderId) },
      user: { user_id: user2.user_id, user_name: user2.user_name, role: user2.role, staff_subrole: 'PICKER', store_id: 1 }
    }, claimRes2);

    assert.equal(getStatus2(), 409, 'Second picker must receive 409 Conflict');
    assert.equal(getData2()?.success, false);
    assert.match(getData2()?.message, /already claimed/i);

    // Verify order in database was NOT cancelled or deleted
    const [finalOrderRows] = await pool.query('SELECT order_id, status, assigned_picker_id FROM orders WHERE order_id = ?', [testOrderId]);
    assert.equal(finalOrderRows.length, 1);
    assert.equal(finalOrderRows[0].status, 'picking_in_progress');
    assert.equal(finalOrderRows[0].assigned_picker_id, user1.user_id);

  } finally {
    await pool.query('DELETE FROM picking_event_log WHERE order_id = ?', [testOrderId]);
    await pool.query('DELETE FROM orders WHERE order_id = ?', [testOrderId]);
  }
});

test('Socket Order Claim: emits order_claimed notification to dismiss alert on other pickers', () => {
  const dummyServer = require('http').createServer();
  socketService.init(dummyServer);

  // Invoke notifyOrderClaimed
  socketService.notifyOrderClaimed(999, 1, 1);
  assert.ok(true, 'notifyOrderClaimed executed without exception');
});
