const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../config/db.config');
const service = require('../services/openfoodfacts.service');
const productController = require('../controllers/product.controller');

after(async () => {
  await pool.end();
});

test('Open Food Facts: barcode validation rejects invalid formats', () => {
  const emptyRes = service.validateAndNormalizeBarcode('');
  assert.strictEqual(emptyRes.valid, false);

  const alphaRes = service.validateAndNormalizeBarcode('ABC12345');
  assert.strictEqual(alphaRes.valid, false);

  const shortRes = service.validateAndNormalizeBarcode('123');
  assert.strictEqual(shortRes.valid, false);

  const validRes = service.validateAndNormalizeBarcode('5449000000996');
  assert.strictEqual(validRes.valid, true);
  assert.strictEqual(validRes.barcode, '5449000000996');
});

test('Open Food Facts: SSRF protection rejects dangerous or internal URLs', () => {
  assert.strictEqual(service.isValidImageUrl('http://localhost:5000/api/evil'), false);
  assert.strictEqual(service.isValidImageUrl('http://127.0.0.1/admin'), false);
  assert.strictEqual(service.isValidImageUrl('http://169.254.169.254/latest/meta-data'), false);
  assert.strictEqual(service.isValidImageUrl('javascript:alert(1)'), false);
  assert.strictEqual(service.isValidImageUrl('data:image/png;base64,...'), false);
  assert.strictEqual(service.isValidImageUrl('https://images.openfoodfacts.org/images/products/test.jpg'), true);
  assert.strictEqual(service.isValidImageUrl('https://cdn.example.com/product.png'), true);
});

test('Open Food Facts: in-memory caching stores and returns cached results', async () => {
  service.clearCache();
  const res1 = await service.getProductByBarcode('5449000000996');
  if (res1.success) {
    const res2 = await service.getProductByBarcode('5449000000996');
    assert.strictEqual(res2.from_cache, true);
    assert.strictEqual(res2.data.barcode, '5449000000996');
  }
});

test('Open Food Facts: non-existent barcode returns 404 status gracefully', async () => {
  const notFoundRes = await service.getProductByBarcode('00000000000000');
  assert.strictEqual(notFoundRes.success, false);
  assert.strictEqual(notFoundRes.status, 404);
  assert.ok(notFoundRes.message.includes('not found'));
});

test('Database Persistence: Product create with image_url and brand persists to database and survives reload', async () => {
  const uniqueCode = Date.now().toString().slice(-6);
  const testSku = `TEST-OFF-${uniqueCode}`;
  const testBarcode = `8901030${uniqueCode}`;
  const testImageUrl = `https://images.openfoodfacts.org/images/products/test-${uniqueCode}.jpg`;

  let statusCode = 200;
  let responseData = null;
  const req = {
    user: { user_id: 1, role: 'ADMIN' },
    body: {
      category_id: 1,
      product_name: `Test OFF Product ${uniqueCode}`,
      brand: 'Test Brand',
      sku: testSku,
      barcode: testBarcode,
      unit: 'pcs',
      unit_price: 99.50,
      reorder_level: 10,
      description: 'Auto-retrieved test product',
      image_url: testImageUrl
    }
  };
  const res = {
    status(code) { statusCode = code; return this; },
    json(data) { responseData = data; return this; }
  };

  await productController.create(req, res);
  assert.strictEqual(statusCode, 201);
  assert.strictEqual(responseData?.success, true);
  const createdId = responseData.data.product_id;
  assert.ok(createdId > 0);

  // Direct database query verification
  const [rows] = await pool.query('SELECT product_id, product_name, brand, barcode, image_url FROM product WHERE product_id = ?', [createdId]);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].product_name, `Test OFF Product ${uniqueCode}`);
  assert.strictEqual(rows[0].brand, 'Test Brand');
  assert.strictEqual(rows[0].barcode, testBarcode);
  assert.strictEqual(rows[0].image_url, testImageUrl);

  // Verify getOne controller returns image_url
  let getStatus = 200;
  let getResp = null;
  await productController.getOne({ params: { id: createdId } }, {
    status(c) { getStatus = c; return this; },
    json(d) { getResp = d; return this; }
  });
  assert.strictEqual(getStatus, 200);
  assert.strictEqual(getResp.data.image_url, testImageUrl);
  assert.strictEqual(getResp.data.brand, 'Test Brand');

  // Verify update preserves or changes image_url
  const updatedImageUrl = `https://images.openfoodfacts.org/images/products/updated-${uniqueCode}.jpg`;
  let updateStatus = 200;
  let updateResp = null;
  await productController.update({
    params: { id: createdId },
    user: { user_id: 1, role: 'ADMIN' },
    body: {
      image_url: updatedImageUrl
    }
  }, {
    status(c) { updateStatus = c; return this; },
    json(d) { updateResp = d; return this; }
  });
  assert.strictEqual(updateStatus, 200);
  assert.strictEqual(updateResp.success, true);

  const [updatedRows] = await pool.query('SELECT image_url FROM product WHERE product_id = ?', [createdId]);
  assert.strictEqual(updatedRows[0].image_url, updatedImageUrl);

  // Clean up test product
  await pool.query('DELETE FROM product WHERE product_id = ?', [createdId]);
});

test('Database Persistence: rejects creation when image_url targets SSRF / internal loopback IP', async () => {
  let statusCode = 200;
  let responseData = null;
  const req = {
    user: { user_id: 1, role: 'ADMIN' },
    body: {
      category_id: 1,
      product_name: 'Malicious URL Product',
      sku: `SSRF-ATTEMPT-${Date.now()}`,
      unit: 'pcs',
      unit_price: 50,
      image_url: 'http://169.254.169.254/latest/meta-data'
    }
  };
  const res = {
    status(code) { statusCode = code; return this; },
    json(data) { responseData = data; return this; }
  };

  await productController.create(req, res);
  assert.strictEqual(statusCode, 400);
  assert.strictEqual(responseData?.success, false);
  assert.ok(responseData?.message.includes('Invalid image URL format'));
});
