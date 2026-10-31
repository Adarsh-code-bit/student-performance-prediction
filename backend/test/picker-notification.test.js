const test = require('node:test');
const { after } = require('node:test');
const assert = require('node:assert/strict');
const orderController = require('../controllers/order.controller');
const pool = require('../config/db.config');

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

/**
 * Helper simulation of the frontend notification state manager
 */
function createNotificationDetector() {
  const alertedOrderIds = new Set();
  let sirenTriggerCount = 0;
  let isSirenActive = false;

  const processQueueUpdate = (queue) => {
    // Actionable orders are unclaimed in pending, confirmed, or picking_queue status
    const actionableOrders = queue.filter(o => 
      ['pending', 'confirmed', 'picking_queue'].includes(o.status) && !o.assigned_picker_id
    );

    if (actionableOrders.length === 0) {
      isSirenActive = false;
      return { actionableOrders, newlyAlerted: [], isSirenActive };
    }

    const newlyAlerted = [];
    for (const order of actionableOrders) {
      if (!alertedOrderIds.has(order.order_id)) {
        alertedOrderIds.add(order.order_id);
        newlyAlerted.push(order);
      }
    }

    if (newlyAlerted.length > 0) {
      sirenTriggerCount++;
      isSirenActive = true;
    }

    return { actionableOrders, newlyAlerted, isSirenActive, sirenTriggerCount };
  };

  const handleOrderClaimed = (orderId) => {
    isSirenActive = false;
  };

  return {
    processQueueUpdate,
    handleOrderClaimed,
    getAlertedIds: () => Array.from(alertedOrderIds),
    getSirenCount: () => sirenTriggerCount,
    isSirenActive: () => isSirenActive
  };
}

test('Picker Notifications: correctly identifies actionable orders and triggers siren once per order', () => {
  const detector = createNotificationDetector();

  const tick1 = [
    { order_id: 201, status: 'confirmed', assigned_picker_id: null, items_count: 3 },
    { order_id: 202, status: 'picking_in_progress', assigned_picker_id: 2, items_count: 5 } // Not actionable
  ];

  const res1 = detector.processQueueUpdate(tick1);
  assert.equal(res1.actionableOrders.length, 1);
  assert.equal(res1.newlyAlerted.length, 1);
  assert.equal(res1.newlyAlerted[0].order_id, 201);
  assert.equal(res1.isSirenActive, true);
  assert.equal(detector.getSirenCount(), 1);

  // Tick 2: Same queue received again on 5s poll — duplicate order must NOT re-trigger siren
  const res2 = detector.processQueueUpdate(tick1);
  assert.equal(res2.actionableOrders.length, 1);
  assert.equal(res2.newlyAlerted.length, 0, 'Should not report already alerted order as new');
  assert.equal(detector.getSirenCount(), 1, 'Siren trigger count should not increase for duplicate poll');

  // Tick 3: New order 203 arrives in queue
  const tick3 = [
    ...tick1,
    { order_id: 203, status: 'pending', assigned_picker_id: null, items_count: 2 }
  ];
  const res3 = detector.processQueueUpdate(tick3);
  assert.equal(res3.actionableOrders.length, 2);
  assert.equal(res3.newlyAlerted.length, 1);
  assert.equal(res3.newlyAlerted[0].order_id, 203);
  assert.equal(detector.getSirenCount(), 2);
});

test('Picker Notifications: stops siren when order is confirmed claimed by backend', async () => {
  const detector = createNotificationDetector();

  // Create an actual actionable order in DB
  const [custRows] = await pool.query('SELECT customer_id FROM customer LIMIT 1');
  const customerId = custRows[0]?.customer_id || 1;

  const [orderResult] = await pool.query(
    `INSERT INTO orders (customer_id, order_date, total_amount, status, store_id) 
     VALUES (?, NOW(), 120.00, 'confirmed', 1)`,
    [customerId]
  );
  const testOrderId = orderResult.insertId;

  try {
    // 1. Fetch queue via getPickingQueue
    const { res: qRes, getData: getQData } = mockRes();
    await orderController.getPickingQueue({
      user: { user_id: 1, role: 'STAFF', staff_subrole: 'PICKER', store_id: 1 },
      query: {}
    }, qRes);

    const queue = getQData()?.data || [];
    const createdOrderInQueue = queue.find(o => o.order_id === testOrderId);
    assert.ok(createdOrderInQueue, 'New order should appear in picker queue');

    // Detector processes queue: siren becomes active
    const detectState = detector.processQueueUpdate([createdOrderInQueue]);
    assert.equal(detectState.isSirenActive, true);
    assert.equal(detectState.actionableOrders.some(o => o.order_id === testOrderId), true);

    // 2. Claim order via claimPicking API
    const { res: claimRes, getStatus: getClaimStatus, getData: getClaimData } = mockRes();
    await orderController.claimPicking({
      params: { id: String(testOrderId) },
      user: { user_id: 1, role: 'STAFF', staff_subrole: 'PICKER', store_id: 1 }
    }, claimRes);

    assert.equal(getClaimStatus(), 200);
    assert.equal(getClaimData()?.success, true);

    // Frontend stops siren on confirmed backend claim
    detector.handleOrderClaimed(testOrderId);
    assert.equal(detector.isSirenActive(), false);

    // 3. Re-query picking queue: order is now assigned, no longer actionable for alerts
    const { res: qRes2, getData: getQData2 } = mockRes();
    await orderController.getPickingQueue({
      user: { user_id: 1, role: 'STAFF', staff_subrole: 'PICKER', store_id: 1 },
      query: {}
    }, qRes2);

    const updatedQueue = getQData2()?.data || [];
    const claimedOrder = updatedQueue.find(o => o.order_id === testOrderId);
    assert.ok(claimedOrder);
    assert.equal(claimedOrder.status, 'picking_in_progress');
    assert.equal(claimedOrder.assigned_picker_id, 1);

    // Notification detector should see 0 unclaimed actionable orders for this order
    const recheck = detector.processQueueUpdate([claimedOrder]);
    assert.equal(recheck.actionableOrders.length, 0);
    assert.equal(recheck.isSirenActive, false);

  } finally {
    await pool.query('DELETE FROM orders WHERE order_id = ?', [testOrderId]);
  }
});

test('Picker Notifications: store-level isolation enforces cross-store security on picking queue', async () => {
  // Create order in store 2
  const [custRows] = await pool.query('SELECT customer_id FROM customer LIMIT 1');
  const customerId = custRows[0]?.customer_id || 1;

  const [orderResult] = await pool.query(
    `INSERT INTO orders (customer_id, order_date, total_amount, status, store_id) 
     VALUES (?, NOW(), 250.00, 'confirmed', 2)`,
    [customerId]
  );
  const store2OrderId = orderResult.insertId;

  try {
    // Staff picker in store 1 attempts to query queue
    const { res: qRes, getData: getQData } = mockRes();
    await orderController.getPickingQueue({
      user: { user_id: 1, role: 'STAFF', staff_subrole: 'PICKER', store_id: 1 },
      query: {}
    }, qRes);

    const store1Queue = getQData()?.data || [];
    const leakedOrder = store1Queue.find(o => o.order_id === store2OrderId);
    assert.equal(leakedOrder, undefined, 'Store 1 picker must NOT see Store 2 order');

    // Staff picker in store 1 attempts to claim Store 2 order directly
    const { res: claimRes, getStatus: getClaimStatus } = mockRes();
    await orderController.claimPicking({
      params: { id: String(store2OrderId) },
      user: { user_id: 1, role: 'STAFF', staff_subrole: 'PICKER', store_id: 1 }
    }, claimRes);

    assert.equal(getClaimStatus(), 403, 'Should reject cross-store order claim with 403 Forbidden');

  } finally {
    await pool.query('DELETE FROM orders WHERE order_id = ?', [store2OrderId]);
  }
});
