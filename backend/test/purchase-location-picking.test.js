const test = require('node:test');
const { after } = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../config/db.config');
const purchaseController = require('../controllers/purchase.controller');
const locationController = require('../controllers/location.controller');
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

test('Requirement 1 & 2: Create purchase order with per-item location assignment (Cold Drinks -> A01-02-0B)', async () => {
  // 1. Fetch Cold Drinks product and Location A01-02-0B
  const [prods] = await pool.query("SELECT * FROM product WHERE product_name = 'Cold Drinks'");
  assert.ok(prods.length > 0, 'Cold Drinks product must exist in database');
  const coldDrinks = prods[0];

  const [locs] = await pool.query("SELECT * FROM location WHERE rack_number = 'A01' AND shelf = '02' AND bin = '0B'");
  assert.ok(locs.length > 0, 'Location A01-02-0B must exist in database');
  const locA01 = locs[0];

  const [suppliers] = await pool.query('SELECT * FROM supplier LIMIT 1');
  assert.ok(suppliers.length > 0, 'Supplier must exist');
  const supplierId = suppliers[0].supplier_id;

  const testBatchCode = `BCH-CD-${Date.now()}`;
  const req = {
    body: {
      supplier_id: supplierId,
      purchase_date: '2026-10-28',
      notes: 'Test PO for Cold Drinks storage position assignment',
      items: [
        {
          product_id: coldDrinks.product_id,
          batch_code: testBatchCode,
          quantity: 50,
          unit_price: 20.00,
          cost_price: 15.00,
          manufacturing_date: '2026-10-28',
          expiry_date: '2027-10-28',
          location_id: locA01.location_id
        }
      ]
    },
    user: { user_id: 1, role: 'ADMIN' }
  };

  const { res, getStatus, getData } = mockRes();
  await purchaseController.create(req, res);

  assert.equal(getStatus(), 201);
  assert.equal(getData()?.success, true);
  const purchaseId = getData()?.data?.insertId;
  assert.ok(purchaseId, 'Purchase ID must be returned');

  // Requirement 4: Verify purchase_details, batch, inventory, and stock_movement
  // A. purchase_details must store location_id
  const [pdRows] = await pool.query(
    'SELECT * FROM purchase_details WHERE purchase_id = ? AND product_id = ?',
    [purchaseId, coldDrinks.product_id]
  );
  assert.equal(pdRows.length, 1);
  assert.equal(pdRows[0].location_id, locA01.location_id, 'purchase_details must record assigned location_id');
  assert.equal(pdRows[0].quantity, 50);

  // B. batch record
  const [bRows] = await pool.query('SELECT * FROM batch WHERE batch_code = ?', [testBatchCode]);
  assert.equal(bRows.length, 1);
  const batchId = bRows[0].batch_id;

  // C. inventory record must reference correct location
  const [invRows] = await pool.query(
    'SELECT * FROM inventory WHERE product_id = ? AND batch_id = ? AND location_id = ?',
    [coldDrinks.product_id, batchId, locA01.location_id]
  );
  assert.equal(invRows.length, 1, 'Inventory record must exist with exact location_id');
  assert.equal(invRows[0].location_id, locA01.location_id);
  assert.equal(invRows[0].quantity, 50);

  // D. stock_movement history
  const [smRows] = await pool.query(
    'SELECT * FROM stock_movement WHERE product_id = ? AND to_location_id = ? ORDER BY movement_id DESC LIMIT 1',
    [coldDrinks.product_id, locA01.location_id]
  );
  assert.equal(smRows.length, 1, 'Stock movement must be recorded');
  assert.equal(smRows[0].movement_type, 'restock');
  assert.equal(smRows[0].to_location_id, locA01.location_id);
  assert.equal(smRows[0].quantity, 50);

  // Requirement 5: Connect to Order Creation, FEFO Allocation, and Picking
  // Create an order for Cold Drinks and verify picking allocation selects the actual location
  const [custRows] = await pool.query('SELECT customer_id FROM customer LIMIT 1');
  const customerId = custRows[0].customer_id;

  const orderReq = {
    body: {
      customer_id: customerId,
      store_id: 1,
      shipping_address: '123 Test Lane, Koramangala',
      items: [
        {
          product_id: coldDrinks.product_id,
          quantity: 2,
          unit_price: 20.00
        }
      ]
    },
    user: { user_id: 1, role: 'ADMIN' }
  };

  const { res: orderRes, getStatus: getOrderStatus, getData: getOrderData } = mockRes();
  await orderController.create(orderReq, orderRes);

  assert.equal(getOrderStatus(), 201);
  assert.equal(getOrderData()?.success, true);
  const orderId = getOrderData()?.data?.order_id || getOrderData()?.data?.insertId;
  assert.ok(orderId, 'Order ID must be returned');

  // Verify allocated order retrieval
  const getOrderReq = {
    params: { id: orderId },
    user: { user_id: 1, role: 'ADMIN', store_id: 1 }
  };
  const { res: getRes, getStatus: getGetStatus, getData: getGetData } = mockRes();
  await orderController.getById(getOrderReq, getRes);

  assert.equal(getGetStatus(), 200);
  const orderData = getGetData()?.data;
  assert.ok(orderData?.items?.length > 0, 'Order must contain items');

  const pickedItem = orderData.items[0];
  assert.equal(pickedItem.product_id, coldDrinks.product_id);
  assert.equal(pickedItem.location_id, locA01.location_id, 'Picking allocation must retain exact assigned location_id');
  assert.equal(pickedItem.location_code, 'A01-02-0B', 'Must format location code as A01-02-0B');
  assert.ok(pickedItem.location_display.includes('A01'), 'Location display must include Rack A01');
  assert.ok(pickedItem.location_display.includes('02'), 'Location display must include Shelf 02');
  assert.ok(pickedItem.location_display.includes('0B'), 'Location display must include Bin 0B');
});

test('Requirement 2: Multi-product purchase order with distinct rack locations (Cold Drinks, Biscuits, Chips)', async () => {
  const [cd] = await pool.query("SELECT * FROM product WHERE product_name = 'Cold Drinks'");
  const [bisc] = await pool.query("SELECT * FROM product WHERE product_name = 'Biscuits'");
  const [chip] = await pool.query("SELECT * FROM product WHERE product_name = 'Chips'");

  const [locA01] = await pool.query("SELECT * FROM location WHERE rack_number = 'A01' AND shelf = '02' AND bin = '0B'");
  const [locA02] = await pool.query("SELECT * FROM location WHERE rack_number = 'A02' AND shelf = '01' AND bin = '0A'");
  const [locA03] = await pool.query("SELECT * FROM location WHERE rack_number = 'A03' AND shelf = '04' AND bin = '0C'");

  const [suppliers] = await pool.query('SELECT * FROM supplier LIMIT 1');
  const supplierId = suppliers[0].supplier_id;

  const testTime = Date.now();
  const req = {
    body: {
      supplier_id: supplierId,
      purchase_date: '2026-10-28',
      notes: 'Multi-product location test',
      items: [
        {
          product_id: cd[0].product_id,
          batch_code: `BCH-CD-${testTime}`,
          quantity: 25,
          unit_price: 20.00,
          cost_price: 15.00,
          manufacturing_date: '2026-10-28',
          expiry_date: '2027-10-28',
          location_id: locA01[0].location_id
        },
        {
          product_id: bisc[0].product_id,
          batch_code: `BCH-BS-${testTime}`,
          quantity: 100,
          unit_price: 30.00,
          cost_price: 22.00,
          manufacturing_date: '2026-10-28',
          expiry_date: '2027-08-15',
          location_id: locA02[0].location_id
        },
        {
          product_id: chip[0].product_id,
          batch_code: `BCH-CH-${testTime}`,
          quantity: 75,
          unit_price: 20.00,
          cost_price: 14.00,
          manufacturing_date: '2026-10-28',
          expiry_date: '2027-04-10',
          location_id: locA03[0].location_id
        }
      ]
    },
    user: { user_id: 1, role: 'ADMIN' }
  };

  const { res, getStatus, getData } = mockRes();
  await purchaseController.create(req, res);

  assert.equal(getStatus(), 201);
  const purchaseId = getData()?.data?.insertId;

  // Verify getById returns distinct location codes for each item
  const getReq = { params: { id: purchaseId } };
  const { res: getRes, getStatus: getStatus2, getData: getData2 } = mockRes();
  await purchaseController.getById(getReq, getRes);

  assert.equal(getStatus2(), 200);
  const purchase = getData2()?.data;
  assert.equal(purchase.items.length, 3);

  const cdItem = purchase.items.find(i => i.product_id === cd[0].product_id);
  const biscItem = purchase.items.find(i => i.product_id === bisc[0].product_id);
  const chipItem = purchase.items.find(i => i.product_id === chip[0].product_id);

  assert.equal(cdItem.complete_location_code, 'A01-02-0B');
  assert.equal(biscItem.complete_location_code, 'A02-01-0A');
  assert.equal(chipItem.complete_location_code, 'A03-04-0C');
});

test('Requirement 3 & 9: Reject purchase item assigned to inactive or invalid location', async () => {
  const [cd] = await pool.query("SELECT * FROM product WHERE product_name = 'Cold Drinks'");
  const [inactiveLoc] = await pool.query("SELECT * FROM location WHERE is_active = 0 LIMIT 1");
  assert.ok(inactiveLoc.length > 0, 'Inactive test location must exist');

  const [suppliers] = await pool.query('SELECT * FROM supplier LIMIT 1');
  const supplierId = suppliers[0].supplier_id;

  const req = {
    body: {
      supplier_id: supplierId,
      purchase_date: '2026-10-28',
      items: [
        {
          product_id: cd[0].product_id,
          batch_code: `BCH-INACT-${Date.now()}`,
          quantity: 10,
          unit_price: 20.00,
          cost_price: 15.00,
          manufacturing_date: '2026-10-28',
          expiry_date: '2027-10-28',
          location_id: inactiveLoc[0].location_id
        }
      ]
    },
    user: { user_id: 1, role: 'ADMIN' }
  };

  const { res, getStatus, getData } = mockRes();
  await purchaseController.create(req, res);

  assert.equal(getStatus(), 400);
  assert.equal(getData()?.success, false);
  assert.match(getData()?.message, /invalid or inactive/i);
});

test('Requirement 3 & 10: Reject purchase item exceeding storage location capacity', async () => {
  const [cd] = await pool.query("SELECT * FROM product WHERE product_name = 'Cold Drinks'");
  const [limitedLoc] = await pool.query("SELECT * FROM location WHERE rack_number = 'A04' AND shelf = '01' AND bin = '0A'");
  assert.ok(limitedLoc.length > 0, 'Limited capacity test location must exist');
  assert.equal(limitedLoc[0].max_capacity, 10, 'Location A04-01-0A has max_capacity of 10');

  const [suppliers] = await pool.query('SELECT * FROM supplier LIMIT 1');
  const supplierId = suppliers[0].supplier_id;

  // Request 50 units into a location that holds at most 10 units
  const req = {
    body: {
      supplier_id: supplierId,
      purchase_date: '2026-10-28',
      items: [
        {
          product_id: cd[0].product_id,
          batch_code: `BCH-CAP-${Date.now()}`,
          quantity: 50,
          unit_price: 20.00,
          cost_price: 15.00,
          manufacturing_date: '2026-10-28',
          expiry_date: '2027-10-28',
          location_id: limitedLoc[0].location_id
        }
      ]
    },
    user: { user_id: 1, role: 'ADMIN' }
  };

  const { res, getStatus, getData } = mockRes();
  await purchaseController.create(req, res);

  assert.equal(getStatus(), 400);
  assert.equal(getData()?.success, false);
  assert.match(getData()?.message, /capacity exceeded/i);
});

test('Requirement 6: Location controller getAll returns valid active storage locations with complete codes', async () => {
  const req = {};
  const { res, getStatus, getData } = mockRes();
  await locationController.getAll(req, res);

  assert.equal(getStatus(), 200);
  assert.equal(getData()?.success, true);
  const locList = getData()?.data;
  assert.ok(Array.isArray(locList) && locList.length > 0);

  // All returned locations must be active
  assert.ok(locList.every(l => Boolean(l.is_active) === true));

  // Must include complete_location_code, store_name, and occupancy data
  const a01 = locList.find(l => l.rack_number === 'A01' && l.shelf === '02' && l.bin === '0B');
  assert.ok(a01, 'A01-02-0B must be returned in location list');
  assert.equal(a01.complete_location_code, 'A01-02-0B');
  assert.equal(typeof a01.is_occupied, 'boolean');
  assert.equal(typeof a01.total_units_stored, 'number');
});
