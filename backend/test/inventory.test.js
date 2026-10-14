const test = require('node:test');
const { after } = require('node:test');
const assert = require('node:assert/strict');
const inventoryController = require('../controllers/inventory.controller');
const pool = require('../config/db.config');

after(async () => {
  await pool.end();
});

test('inventory controller: getAll executes successfully against the database', async () => {
  const req = { query: {} };
  let responseData = null;
  let statusCode = 200;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    }
  };

  await inventoryController.getAll(req, res);

  assert.equal(statusCode, 200);
  assert.equal(responseData?.success, true);
  assert.ok(Array.isArray(responseData?.data), 'Data should be an array');
  assert.ok(responseData.data.length > 0, 'Data should contain inventory rows');

  // Verify fields on returned inventory items
  const item = responseData.data[0];
  assert.ok(item.inventory_id !== undefined, 'Should have inventory_id');
  assert.ok(item.product_name !== undefined, 'Should have product_name');
  assert.ok(item.updated_at !== undefined, 'Should have updated_at');
  assert.ok(['HEALTHY', 'NEAR EXPIRY', 'EXPIRED'].includes(item.status), `Status should be valid, got ${item.status}`);
});

test('inventory controller: getAll with location and product filters', async () => {
  const req = { query: { location_id: '1', product_id: '1' } };
  let responseData = null;
  let statusCode = 200;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    }
  };

  await inventoryController.getAll(req, res);

  assert.equal(statusCode, 200);
  assert.equal(responseData?.success, true);
  assert.ok(Array.isArray(responseData?.data));
  if (responseData.data.length > 0) {
    assert.equal(responseData.data[0].location_id, 1);
    assert.equal(responseData.data[0].product_id, 1);
  }
});

test('inventory controller: getOne returns a specific inventory item', async () => {
  const req = { params: { id: '2' } };
  let responseData = null;
  let statusCode = 200;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    }
  };

  await inventoryController.getOne(req, res);

  assert.equal(statusCode, 200);
  assert.equal(responseData?.success, true);
  assert.equal(responseData.data.inventory_id, 2);
  assert.ok(responseData.data.product_name);
  assert.ok(['HEALTHY', 'NEAR EXPIRY', 'EXPIRED'].includes(responseData.data.status));
});

test('inventory controller: getOne returns 404 for non-existent item', async () => {
  const req = { params: { id: '999999' } };
  let responseData = null;
  let statusCode = 200;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    }
  };

  await inventoryController.getOne(req, res);

  assert.equal(statusCode, 404);
  assert.equal(responseData?.success, false);
});
