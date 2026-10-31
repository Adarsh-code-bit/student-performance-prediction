const test = require('node:test');
const { after } = require('node:test');
const assert = require('node:assert/strict');
const productController = require('../controllers/product.controller');
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

test('Product Creation: creating a product creates catalog entry with 0 physical stock', async () => {
  const { res, getStatus, getData } = mockRes();
  const testSku = `TEST-SKU-${Date.now()}`;
  const testBarcode = `BC-${Date.now()}`;
  const req = {
    user: { user_id: 1, role: 'admin' },
    body: {
      category_id: 1,
      product_name: 'Zero Stock Catalog Product',
      sku: testSku,
      barcode: testBarcode,
      unit: 'pcs',
      unit_price: 49.99,
      reorder_level: 15
    }
  };

  await productController.create(req, res);
  assert.equal(getStatus(), 201);
  assert.equal(getData()?.success, true);
  const productId = getData()?.data?.product_id;
  assert.ok(productId, 'Should return product_id');

  try {
    // 1. Verify product row in database
    const [pRows] = await pool.query('SELECT * FROM product WHERE product_id = ?', [productId]);
    assert.equal(pRows.length, 1);
    assert.equal(pRows[0].barcode, testBarcode);

    // 2. Verify physical inventory is strictly ZERO (no auto-generated inventory row)
    const [invRows] = await pool.query('SELECT * FROM inventory WHERE product_id = ?', [productId]);
    assert.equal(invRows.length, 0, 'No stock or inventory row should exist upon product creation');

    // 3. Verify total quantity in inventory query is 0
    const [qtyRows] = await pool.query('SELECT COALESCE(SUM(quantity), 0) AS total_stock FROM inventory WHERE product_id = ?', [productId]);
    assert.equal(Number(qtyRows[0].total_stock), 0);
  } finally {
    await pool.query('DELETE FROM product WHERE product_id = ?', [productId]);
  }
});

test('Product Creation & Barcode: duplicate barcode returns HTTP 409 conflict', async () => {
  const { res: res1, getStatus: getStatus1, getData: getData1 } = mockRes();
  const duplicateBarcode = `DUP-${Date.now()}`;
  const req1 = {
    user: { user_id: 1 },
    body: {
      category_id: 1,
      product_name: 'Original Barcode Item',
      sku: `ORIG-${Date.now()}`,
      barcode: duplicateBarcode,
      unit: 'pcs',
      unit_price: 25.00
    }
  };

  await productController.create(req1, res1);
  assert.equal(getStatus1(), 201);
  const prod1Id = getData1()?.data?.product_id;

  try {
    // Attempt second product with same barcode
    const { res: res2, getStatus: getStatus2, getData: getData2 } = mockRes();
    const req2 = {
      user: { user_id: 1 },
      body: {
        category_id: 1,
        product_name: 'Duplicate Barcode Item',
        sku: `DIFF-${Date.now()}`,
        barcode: duplicateBarcode,
        unit: 'pcs',
        unit_price: 30.00
      }
    };

    await productController.create(req2, res2);
    assert.equal(getStatus2(), 409, 'Should return HTTP 409 Conflict for duplicate barcode');
    assert.equal(getData2()?.success, false);
    assert.match(getData2()?.message, /already assigned|exists/i);
  } finally {
    await pool.query('DELETE FROM product WHERE product_id = ?', [prod1Id]);
  }
});

test('Product Stock Receiving: receives batch and updates inventory atomically with validation', async () => {
  // 1. Create a base product
  const { res: createRes, getData: getCreateData } = mockRes();
  const testSku = `RCV-SKU-${Date.now()}`;
  await productController.create({
    user: { user_id: 1 },
    body: {
      category_id: 1,
      product_name: 'Receiving Test Item',
      sku: testSku,
      unit: 'pcs',
      unit_price: 99.00
    }
  }, createRes);

  const productId = getCreateData()?.data?.product_id;
  assert.ok(productId);

  const testBatchCode = `BCH-RCV-${Date.now()}`;

  try {
    // 2. Validate invalid stock receiving (quantity <= 0)
    const { res: errRes1, getStatus: getErrStatus1 } = mockRes();
    await productController.receiveInitialStock({
      params: { id: String(productId) },
      user: { user_id: 1 },
      body: {
        quantity: 0,
        location_id: 1,
        batch_code: testBatchCode,
        manufacturing_date: '2026-10-01',
        expiry_date: '2027-10-01'
      }
    }, errRes1);
    assert.equal(getErrStatus1(), 400);

    // 3. Validate invalid dates (expiry <= manufacturing)
    const { res: errRes2, getStatus: getErrStatus2 } = mockRes();
    await productController.receiveInitialStock({
      params: { id: String(productId) },
      user: { user_id: 1 },
      body: {
        quantity: 25,
        location_id: 1,
        batch_code: testBatchCode,
        manufacturing_date: '2026-10-01',
        expiry_date: '2026-09-01'
      }
    }, errRes2);
    assert.equal(getErrStatus2(), 400);

    // 4. Perform valid stock receiving
    const { res: rcvRes, getStatus: getRcvStatus, getData: getRcvData } = mockRes();
    await productController.receiveInitialStock({
      params: { id: String(productId) },
      user: { user_id: 1 },
      body: {
        quantity: 75,
        location_id: 1,
        batch_code: testBatchCode,
        manufacturing_date: '2026-10-01',
        expiry_date: '2027-10-01',
        cost_price: 60.00
      }
    }, rcvRes);

    assert.equal(getRcvStatus(), 201);
    assert.equal(getRcvData()?.success, true);
    assert.equal(getRcvData()?.data?.quantity, 75);
    assert.equal(getRcvData()?.data?.batch_code, testBatchCode);

    // 5. Verify batch record created
    const [batchRows] = await pool.query('SELECT * FROM batch WHERE batch_code = ?', [testBatchCode]);
    assert.equal(batchRows.length, 1);
    assert.equal(batchRows[0].quantity, 75);
    assert.equal(Number(batchRows[0].cost_price), 60.00);

    // 6. Verify inventory record created and visible
    const [invRows] = await pool.query('SELECT * FROM inventory WHERE product_id = ? AND location_id = 1', [productId]);
    assert.equal(invRows.length, 1);
    assert.equal(invRows[0].quantity, 75);

    // 7. Verify duplicate batch receiving is rejected (409)
    const { res: dupBatchRes, getStatus: getDupBatchStatus } = mockRes();
    await productController.receiveInitialStock({
      params: { id: String(productId) },
      user: { user_id: 1 },
      body: {
        quantity: 10,
        location_id: 1,
        batch_code: testBatchCode, // same batch code
        manufacturing_date: '2026-10-01',
        expiry_date: '2027-10-01'
      }
    }, dupBatchRes);
    assert.equal(getDupBatchStatus(), 409);

  } finally {
    // Clean up
    await pool.query('DELETE FROM inventory WHERE product_id = ?', [productId]);
    await pool.query('DELETE FROM batch WHERE batch_code = ?', [testBatchCode]);
    await pool.query('DELETE FROM purchase_details WHERE product_id = ?', [productId]);
    await pool.query('DELETE FROM product WHERE product_id = ?', [productId]);
  }
});
