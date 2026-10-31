const test = require('node:test');
const { before, after } = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../config/db.config');
const orderController = require('../controllers/order.controller');

before(async () => {
  // Ensure product 1 has adequate stock for test lifecycle execution
  const [rows] = await pool.query('SELECT inventory_id, quantity FROM inventory WHERE product_id = 1');
  if (rows.length > 0 && rows[0].quantity < 50) {
    await pool.query('UPDATE inventory SET quantity = 100 WHERE product_id = 1');
  }
});

after(async () => {
  await pool.end();
});

test('Integration: Full Order Creation, FEFO Allocation, Picking, and Shortage Reconciliation Lifecycle', async () => {
  let createdOrderId = null;
  let allocationId = null;

  // 1. Create an Order
  const createReq = {
    user: { user_id: 1, role: 'ADMIN', store_id: 1, user_name: 'Admin Test' },
    body: {
      customer_id: 1,
      store_id: 1,
      shipping_address: '123 Test Street, Koramangala',
      items: [{ product_id: 1, quantity: 2 }]
    }
  };

  let createStatusCode = 200;
  let createResponse = null;
  const createRes = {
    status(code) { createStatusCode = code; return this; },
    json(data) { createResponse = data; return this; }
  };

  await orderController.create(createReq, createRes);
  assert.equal(createStatusCode, 201);
  assert.equal(createResponse?.success, true);
  createdOrderId = createResponse.data.order_id;
  assert.ok(createdOrderId > 0, 'Order ID should be a positive number');

  // Verify allocations table has exact batch and location allocation
  const [allocRows] = await pool.query(
    'SELECT * FROM order_item_allocations WHERE order_id = ?',
    [createdOrderId]
  );
  assert.equal(allocRows.length, 1);
  const alloc = allocRows[0];
  allocationId = alloc.allocation_id;
  assert.equal(alloc.product_id, 1);
  assert.equal(alloc.allocated_quantity, 2);
  assert.equal(alloc.picked_quantity, 0);
  assert.equal(alloc.status, 'PENDING');
  assert.equal(alloc.location_id, 1);
  assert.equal(alloc.batch_id, 1);

  // 2. Query Order Details (getById) to verify Rack-Level Guidance display
  let getStatusCode = 200;
  let getResponse = null;
  const getRes = {
    status(code) { getStatusCode = code; return this; },
    json(data) { getResponse = data; return this; }
  };

  await orderController.getById({ params: { id: createdOrderId }, user: { role: 'ADMIN', store_id: 1 } }, getRes);
  assert.equal(getStatusCode, 200);
  assert.equal(getResponse?.success, true);
  const orderDetails = getResponse.data;
  assert.equal(orderDetails.items.length, 1);
  const itemGuidance = orderDetails.items[0];
  assert.equal(itemGuidance.is_location_assigned, true);
  assert.ok(itemGuidance.location_display.includes('Aisle: AISLE-01'));
  assert.ok(itemGuidance.location_display.includes('Rack: RACK-A1'));
  assert.ok(itemGuidance.location_display.includes('Shelf: SHELF-A'));
  assert.ok(itemGuidance.location_display.includes('Bin: BIN-01'));

  // 3. Claim Picking (Picker claims order)
  const pickerUser = { user_id: 2, role: 'STAFF', staff_subrole: 'PICKER', user_name: 'FastPicker' };
  let claimStatusCode = 200;
  let claimResponse = null;
  const claimRes = {
    status(code) { claimStatusCode = code; return this; },
    json(data) { claimResponse = data; return this; }
  };

  await orderController.claimPicking({ params: { id: createdOrderId }, user: pickerUser }, claimRes);
  assert.equal(claimStatusCode, 200);
  assert.equal(claimResponse?.success, true);

  // Verify order status and timestamps
  const [claimedOrderRows] = await pool.query('SELECT status, assigned_picker_id, picking_assigned_at FROM orders WHERE order_id = ?', [createdOrderId]);
  assert.equal(claimedOrderRows[0].status, 'picking_in_progress');
  assert.equal(claimedOrderRows[0].assigned_picker_id, 2);
  assert.ok(claimedOrderRows[0].picking_assigned_at != null);

  // Verify picking_event_log recorded ASSIGNED
  const [eventRows] = await pool.query('SELECT * FROM picking_event_log WHERE order_id = ? AND event_type = ?', [createdOrderId, 'ASSIGNED']);
  assert.equal(eventRows.length, 1);

  // 4. Start Item
  let startItemStatusCode = 200;
  let startItemResponse = null;
  const startItemRes = {
    status(code) { startItemStatusCode = code; return this; },
    json(data) { startItemResponse = data; return this; }
  };

  await orderController.startItem({ params: { id: createdOrderId, allocationId }, user: pickerUser }, startItemRes);
  assert.equal(startItemStatusCode, 200);
  assert.equal(startItemResponse?.success, true);

  // Verify allocation status is IN_PROGRESS
  const [inProgressRows] = await pool.query('SELECT status, started_at FROM order_item_allocations WHERE allocation_id = ?', [allocationId]);
  assert.equal(inProgressRows[0].status, 'IN_PROGRESS');
  assert.ok(inProgressRows[0].started_at != null);

  // 5. Confirm Item with Shortage (Found 1 of 2 units)
  // Check inventory quantity before confirm
  const [invBefore] = await pool.query('SELECT quantity FROM inventory WHERE inventory_id = ?', [alloc.inventory_id]);
  const qtyBefore = invBefore[0].quantity;

  let confirmStatusCode = 200;
  let confirmResponse = null;
  const confirmRes = {
    status(code) { confirmStatusCode = code; return this; },
    json(data) { confirmResponse = data; return this; }
  };

  await orderController.confirmItem({
    params: { id: createdOrderId, allocationId },
    body: { picked_quantity: 1, shortage_reason: 'DAMAGED_ITEM', notes: '1 unit damaged on rack' },
    user: pickerUser
  }, confirmRes);

  assert.equal(confirmStatusCode, 200);
  assert.equal(confirmResponse?.success, true);
  assert.equal(confirmResponse.data.shortage_quantity, 1);
  assert.equal(confirmResponse.data.picked_quantity, 1);

  // Verify the 1 missing unit was safely restored to inventory
  const [invAfter] = await pool.query('SELECT quantity FROM inventory WHERE inventory_id = ?', [alloc.inventory_id]);
  assert.equal(invAfter[0].quantity, qtyBefore + 1, 'Shortage quantity of 1 should be restored to inventory');

  // Verify allocation is marked SHORTAGE and is_restored = 0 (since 1 picked unit is still in order)
  const [resolvedAllocRows] = await pool.query('SELECT is_restored, status FROM order_item_allocations WHERE allocation_id = ?', [allocationId]);
  assert.equal(resolvedAllocRows[0].is_restored, 0);
  assert.equal(resolvedAllocRows[0].status, 'SHORTAGE');

  // Verify order transitioned to 'picked' since all items resolved
  const [finalOrderRows] = await pool.query('SELECT status, picked_at FROM orders WHERE order_id = ?', [createdOrderId]);
  assert.equal(finalOrderRows[0].status, 'picked');
  assert.ok(finalOrderRows[0].picked_at != null);

  // 6. Prevent Duplicate Confirmation
  confirmStatusCode = 200;
  confirmResponse = null;
  await orderController.confirmItem({
    params: { id: createdOrderId, allocationId },
    body: { picked_quantity: 1 },
    user: pickerUser
  }, confirmRes);

  assert.equal(confirmStatusCode, 400);
  assert.equal(confirmResponse?.success, false);
  assert.match(confirmResponse?.message, /Duplicate confirmation rejected/i);

  // 7. Verify Manager Dashboard API returns this completed order with metrics
  let managerStatusCode = 200;
  let managerResponse = null;
  const managerRes = {
    status(code) { managerStatusCode = code; return this; },
    json(data) { managerResponse = data; return this; }
  };

  await orderController.getManagerPickingActivity({
    user: { role: 'STORE_MANAGER', store_id: 1, user_id: 10 }
  }, managerRes);

  assert.equal(managerStatusCode, 200);
  assert.equal(managerResponse?.success, true);
  const foundOrder = managerResponse.data.find(o => o.order_id === createdOrderId);
  assert.ok(foundOrder != null, 'Manager dashboard should include the order');
  assert.equal(foundOrder.picker_id, 2);
  assert.ok(foundOrder.picker_name, 'Picker name should be populated from user table');
  assert.equal(foundOrder.picked_items, 1);
  assert.equal(foundOrder.total_items, 1);
  assert.equal(foundOrder.remaining_items, 0);

  // 8. Verify Picking History endpoint
  let historyStatusCode = 200;
  let historyResponse = null;
  const historyRes = {
    status(code) { historyStatusCode = code; return this; },
    json(data) { historyResponse = data; return this; }
  };

  await orderController.getPickingHistory({ params: { id: createdOrderId } }, historyRes);
  assert.equal(historyStatusCode, 200);
  assert.equal(historyResponse?.success, true);
  assert.equal(historyResponse.data.allocations.length, 1);
  assert.ok(historyResponse.data.events.length >= 3, 'Should have ASSIGNED, ITEM_STARTED, ITEM_SHORTAGE, ORDER_COMPLETED events');
});

test('Integration: Order Cancellation Restores Stock Safely Without Double Restoration', async () => {
  // 1. Create a 3-unit order
  const createReq = {
    user: { user_id: 1, role: 'ADMIN', store_id: 1, user_name: 'Admin' },
    body: {
      customer_id: 1,
      store_id: 1,
      shipping_address: '456 Cancel Road',
      items: [{ product_id: 1, quantity: 3 }]
    }
  };

  let createStatusCode = 200;
  let createResponse = null;
  const createRes = {
    status(code) { createStatusCode = code; return this; },
    json(data) { createResponse = data; return this; }
  };

  await orderController.create(createReq, createRes);
  assert.equal(createStatusCode, 201);
  const orderId = createResponse.data.order_id;

  const [allocs] = await pool.query('SELECT inventory_id, allocated_quantity FROM order_item_allocations WHERE order_id = ?', [orderId]);
  const invId = allocs[0].inventory_id;

  const [invBeforeCancel] = await pool.query('SELECT quantity FROM inventory WHERE inventory_id = ?', [invId]);
  const qtyBeforeCancel = invBeforeCancel[0].quantity;

  // 2. Cancel the order via updateStatus
  let updateStatusCode = 200;
  let updateResponse = null;
  const updateRes = {
    status(code) { updateStatusCode = code; return this; },
    json(data) { updateResponse = data; return this; }
  };

  await orderController.updateStatus({
    params: { id: orderId },
    body: { status: 'cancelled' },
    user: { user_id: 1, role: 'ADMIN', store_id: 1 }
  }, updateRes);

  assert.equal(updateStatusCode, 200);
  assert.equal(updateResponse?.success, true);

  // 3. Verify that the 3 units were returned to inventory
  const [invAfterCancel] = await pool.query('SELECT quantity FROM inventory WHERE inventory_id = ?', [invId]);
  assert.equal(invAfterCancel[0].quantity, qtyBeforeCancel + 3, 'Inventory should be restored by allocated 3 units');

  // 4. Verify is_restored is true on allocations
  const [allocAfter] = await pool.query('SELECT is_restored FROM order_item_allocations WHERE order_id = ?', [orderId]);
  assert.equal(allocAfter[0].is_restored, 1);

  // 5. Cancelling again or calling updateStatus should NOT double-restore
  await orderController.updateStatus({
    params: { id: orderId },
    body: { status: 'cancelled' },
    user: { user_id: 1, role: 'ADMIN', store_id: 1 }
  }, updateRes);

  const [invAfterDuplicate] = await pool.query('SELECT quantity FROM inventory WHERE inventory_id = ?', [invId]);
  assert.equal(invAfterDuplicate[0].quantity, qtyBeforeCancel + 3, 'Inventory must not be double-restored');
});

test('Integration: Concurrent Picking Requests: prevents race conditions during simultaneous claim and confirm', async () => {
  // 1. Create a test order
  const createReq = {
    user: { user_id: 1, role: 'ADMIN', store_id: 1, user_name: 'Admin' },
    body: {
      customer_id: 1,
      store_id: 1,
      shipping_address: '789 Concurrency Way',
      items: [{ product_id: 1, quantity: 1 }]
    }
  };

  let createStatusCode = 200;
  let createResponse = null;
  const createRes = {
    status(code) { createStatusCode = code; return this; },
    json(data) { createResponse = data; return this; }
  };

  await orderController.create(createReq, createRes);
  assert.equal(createStatusCode, 201);
  const orderId = createResponse.data.order_id;

  const [allocs] = await pool.query('SELECT allocation_id FROM order_item_allocations WHERE order_id = ?', [orderId]);
  const allocationId = allocs[0].allocation_id;

  // 2. Simulate two pickers attempting to claim the exact same order simultaneously
  const picker1 = { user_id: 2, role: 'STAFF', staff_subrole: 'PICKER', user_name: 'PickerOne' };
  const picker2 = { user_id: 3, role: 'STAFF', staff_subrole: 'PICKER', user_name: 'PickerTwo' };

  const makeClaimCall = (picker) => {
    return new Promise(async (resolve) => {
      let code = 200;
      let body = null;
      const res = {
        status(c) { code = c; return this; },
        json(b) { body = b; return this; }
      };
      await orderController.claimPicking({ params: { id: orderId }, user: picker }, res);
      resolve({ code, body });
    });
  };

  const [claimResult1, claimResult2] = await Promise.all([
    makeClaimCall(picker1),
    makeClaimCall(picker2)
  ]);

  const claimCodes = [claimResult1.code, claimResult2.code].sort();
  assert.deepEqual(claimCodes, [200, 409], 'Exactly one picker must succeed (200) and the concurrent competitor must be rejected (409)');

  // 3. Simulate two concurrent confirmItem requests on the same allocation
  const makeConfirmCall = () => {
    return new Promise(async (resolve) => {
      let code = 200;
      let body = null;
      const res = {
        status(c) { code = c; return this; },
        json(b) { body = b; return this; }
      };
      await orderController.confirmItem({
        params: { id: orderId, allocationId },
        body: { picked_quantity: 1 },
        user: picker1
      }, res);
      resolve({ code, body });
    });
  };

  const [confirmResult1, confirmResult2] = await Promise.all([
    makeConfirmCall(),
    makeConfirmCall()
  ]);

  const confirmCodes = [confirmResult1.code, confirmResult2.code].sort();
  assert.deepEqual(confirmCodes, [200, 400], 'Exactly one confirm must succeed (200) and the concurrent competitor must be rejected as duplicate (400)');
});

test('Integration: Partial Shortage Followed by Order Cancellation Restores Full Stock Quantity Exactly Once', async () => {
  // 1. Create a 4-unit order
  const createReq = {
    user: { user_id: 1, role: 'ADMIN', store_id: 1, user_name: 'Admin' },
    body: {
      customer_id: 1,
      store_id: 1,
      shipping_address: '101 Partial Shortage Lane',
      items: [{ product_id: 1, quantity: 4 }]
    }
  };

  let createStatusCode = 200;
  let createResponse = null;
  const createRes = {
    status(code) { createStatusCode = code; return this; },
    json(data) { createResponse = data; return this; }
  };

  await orderController.create(createReq, createRes);
  assert.equal(createStatusCode, 201);
  const orderId = createResponse.data.order_id;

  const [allocs] = await pool.query('SELECT allocation_id, inventory_id FROM order_item_allocations WHERE order_id = ?', [orderId]);
  const allocationId = allocs[0].allocation_id;
  const invId = allocs[0].inventory_id;

  const [invInitial] = await pool.query('SELECT quantity FROM inventory WHERE inventory_id = ?', [invId]);
  const qtyInitial = invInitial[0].quantity; // after 4 units were deducted

  // 2. Picker claims and reports partial pick: picks 1 unit, 3 units shortage
  const picker = { user_id: 2, role: 'STAFF', staff_subrole: 'PICKER', user_name: 'PickerTwo' };
  const dummyRes = {
    status() { return this; },
    json() { return this; }
  };
  await orderController.claimPicking({ params: { id: orderId }, user: picker }, dummyRes);

  let confirmCode = 200;
  let confirmBody = null;
  const confirmRes = {
    status(c) { confirmCode = c; return this; },
    json(b) { confirmBody = b; return this; }
  };

  await orderController.confirmItem({
    params: { id: orderId, allocationId },
    body: { picked_quantity: 1, shortage_reason: 'DAMAGED_ITEM' },
    user: picker
  }, confirmRes);

  assert.equal(confirmCode, 200);
  assert.equal(confirmBody.data.shortage_quantity, 3);
  assert.equal(confirmBody.data.picked_quantity, 1);

  // Shortage (3 units) should be returned immediately to inventory
  const [invAfterShortage] = await pool.query('SELECT quantity FROM inventory WHERE inventory_id = ?', [invId]);
  assert.equal(invAfterShortage[0].quantity, qtyInitial + 3, 'Shortage of 3 units should be immediately refunded to inventory');

  // Verify allocation is NOT yet marked is_restored=true because 1 picked unit remains in the order
  const [allocState] = await pool.query('SELECT is_restored, status FROM order_item_allocations WHERE allocation_id = ?', [allocationId]);
  assert.equal(allocState[0].is_restored, 0);

  // 3. Order is subsequently cancelled before packing
  let cancelCode = 200;
  const cancelRes = {
    status(c) { cancelCode = c; return this; },
    json() { return this; }
  };

  await orderController.updateStatus({
    params: { id: orderId },
    body: { status: 'cancelled' },
    user: { user_id: 1, role: 'ADMIN', store_id: 1 }
  }, cancelRes);

  assert.equal(cancelCode, 200);

  // Requirement 8 & 9: Cancellation distinguishes unpicked stock from physically picked stock.
  // The 1 physically picked unit must NOT be restored immediately; it must be marked RETURN_PENDING.
  const [invAfterCancel] = await pool.query('SELECT quantity FROM inventory WHERE inventory_id = ?', [invId]);
  assert.equal(invAfterCancel[0].quantity, qtyInitial + 3, 'Physically picked unit must NOT become sellable until returned');

  const [pendingAlloc] = await pool.query('SELECT is_restored, status FROM order_item_allocations WHERE allocation_id = ?', [allocationId]);
  assert.equal(pendingAlloc[0].is_restored, 0, 'Physically picked item must remain is_restored=0 while pending return');
  assert.equal(pendingAlloc[0].status, 'RETURN_PENDING', 'Allocation status must transition to RETURN_PENDING');

  // 4. Duplicate cancellation must NOT change inventory or duplicate restoration
  await orderController.updateStatus({
    params: { id: orderId },
    body: { status: 'cancelled' },
    user: { user_id: 1, role: 'ADMIN', store_id: 1 }
  }, cancelRes);

  const [invAfterDupCancel] = await pool.query('SELECT quantity FROM inventory WHERE inventory_id = ?', [invId]);
  assert.equal(invAfterDupCancel[0].quantity, qtyInitial + 3, 'Duplicate cancellation must not alter stock');

  // 5. Manager confirms physical return of the picked unit
  let returnCode = 200;
  let returnBody = null;
  const returnRes = {
    status(c) { returnCode = c; return this; },
    json(b) { returnBody = b; return this; }
  };

  await orderController.confirmItemReturn({
    params: { id: orderId, allocationId },
    user: { user_id: 1, role: 'ADMIN', store_id: 1 }
  }, returnRes);

  assert.equal(returnCode, 200);
  assert.equal(returnBody.success, true);
  assert.equal(returnBody.data.restored_quantity, 1);

  // The 1 picked unit is now restored to inventory, bringing total restored to 4 (exact match to allocated)
  const [invAfterReturn] = await pool.query('SELECT quantity FROM inventory WHERE inventory_id = ?', [invId]);
  assert.equal(invAfterReturn[0].quantity, qtyInitial + 4, 'Stock is restored only after physical return confirmation');

  const [finalAlloc] = await pool.query('SELECT is_restored, status FROM order_item_allocations WHERE allocation_id = ?', [allocationId]);
  assert.equal(finalAlloc[0].is_restored, 1);
  assert.equal(finalAlloc[0].status, 'RETURNED');

  // 6. Duplicate return confirmation must be rejected
  let dupReturnCode = 200;
  await orderController.confirmItemReturn({
    params: { id: orderId, allocationId },
    user: { user_id: 1, role: 'ADMIN', store_id: 1 }
  }, {
    status(c) { dupReturnCode = c; return this; },
    json() { return this; }
  });
  assert.equal(dupReturnCode, 400, 'Duplicate return confirmation must be rejected with 400');
});

test('Integration: Cross-Store Isolation: prevents unauthorized cross-store operations', async () => {
  // 1. Create order in Store 1
  const createReq = {
    user: { user_id: 1, role: 'ADMIN', store_id: 1, user_name: 'Admin' },
    body: {
      customer_id: 1,
      store_id: 1,
      shipping_address: '101 Store Isolation Ave',
      items: [{ product_id: 1, quantity: 1 }]
    }
  };

  let createStatusCode = 200;
  let createResponse = null;
  const createRes = {
    status(code) { createStatusCode = code; return this; },
    json(data) { createResponse = data; return this; }
  };

  await orderController.create(createReq, createRes);
  assert.equal(createStatusCode, 201);
  const orderId = createResponse.data.order_id;

  // 2. User from Store 2 attempts to view Store 1 order details
  const store2User = { user_id: 99, role: 'STAFF', staff_subrole: 'PICKER', store_id: 2, user_name: 'Store2Picker' };
  let getCode = 200;
  let getBody = null;
  await orderController.getById({
    params: { id: orderId },
    user: store2User
  }, {
    status(c) { getCode = c; return this; },
    json(b) { getBody = b; return this; }
  });
  assert.equal(getCode, 403, 'Cross-store order access must return 403 Forbidden');

  // 3. User from Store 2 attempts to claim picking on Store 1 order
  let claimCode = 200;
  await orderController.claimPicking({
    params: { id: orderId },
    user: store2User
  }, {
    status(c) { claimCode = c; return this; },
    json() { return this; }
  });
  assert.equal(claimCode, 403, 'Cross-store claim picking must return 403 Forbidden');

  // 4. Manager from Store 2 attempts to view Store 1 picking history
  const store2Manager = { user_id: 98, role: 'MANAGER', store_id: 2, user_name: 'Store2Manager' };
  let historyCode = 200;
  await orderController.getPickingHistory({
    params: { id: orderId },
    user: store2Manager
  }, {
    status(c) { historyCode = c; return this; },
    json() { return this; }
  });
  assert.equal(historyCode, 403, 'Cross-store picking history must return 403 Forbidden');
});
