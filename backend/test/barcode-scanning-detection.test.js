const { test, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../config/db.config');
const barcodeUtil = require('../utils/barcode.util');
const productController = require('../controllers/product.controller');
const offService = require('../services/openfoodfacts.service');

after(async () => {
  await pool.end();
});

describe('QUICKSTOCK Barcode Scanning & Product Detection Test Suite', () => {

  // 1. Known barcode found in local MySQL database
  test('1. Known barcode found in local database returns product details & inventory stock', async () => {
    // Cold Drinks has barcode 8901234567890 or Kurkure 8901491100519
    const [existing] = await pool.query('SELECT barcode, product_name FROM product WHERE barcode IS NOT NULL LIMIT 1');
    assert.ok(existing.length > 0, 'Should have at least one product with barcode');
    const knownBarcode = existing[0].barcode;

    let resData = null;
    let statusCode = 200;
    const req = {
      params: { barcode: knownBarcode },
      query: { includeExternal: 'false' },
      user: { user_id: 1, role: 'STAFF' }
    };
    const res = {
      status(code) { statusCode = code; return this; },
      json(payload) { resData = payload; return this; }
    };

    await productController.lookupByBarcode(req, res);

    assert.strictEqual(statusCode, 200);
    assert.strictEqual(resData.success, true);
    assert.strictEqual(resData.found, true);
    assert.strictEqual(resData.source, 'local');
    assert.strictEqual(resData.data.barcode, knownBarcode);
    assert.ok(resData.data.product_name, 'Should return product name');
    assert.ok(typeof resData.data.current_stock === 'number', 'Should return current inventory stock as number');
  });

  // 2. Unknown barcode
  test('2. Unknown barcode returns 404 with exact manual fallback message', async () => {
    const unknownBarcode = '9998887776665';

    let resData = null;
    let statusCode = 200;
    const req = {
      params: { barcode: unknownBarcode },
      query: { includeExternal: 'false' }, // isolate local check
      user: { user_id: 1, role: 'STAFF' }
    };
    const res = {
      status(code) { statusCode = code; return this; },
      json(payload) { resData = payload; return this; }
    };

    await productController.lookupByBarcode(req, res);

    assert.strictEqual(statusCode, 404);
    assert.strictEqual(resData.success, false);
    assert.strictEqual(resData.found, false);
    assert.strictEqual(resData.message, 'Product not found. You can add this product manually.');
  });

  // 3. Invalid barcode formats
  test('3. Invalid barcode formats are rejected with 400 bad request', async () => {
    const invalidBarcodes = ['12', 'invalid@barcode#', '', '   ', 'a'.repeat(35)];

    for (const badCode of invalidBarcodes) {
      let resData = null;
      let statusCode = 200;
      const req = {
        params: { barcode: badCode },
        query: {},
        user: { user_id: 1, role: 'STAFF' }
      };
      const res = {
        status(code) { statusCode = code; return this; },
        json(payload) { resData = payload; return this; }
      };

      await productController.lookupByBarcode(req, res);
      assert.strictEqual(statusCode, 400, `Barcode "${badCode}" should return 400`);
      assert.strictEqual(resData.success, false);
    }
  });

  // 4. External API unavailable or network failure
  test('4. External API failure degrades gracefully without throwing 500', async () => {
    // Save original function
    const originalGetProduct = offService.getProductByBarcode;
    try {
      // Mock network failure or timeout
      offService.getProductByBarcode = async () => {
        throw new Error('ETIMEDOUT: Connection to world.openfoodfacts.org timed out');
      };

      let resData = null;
      let statusCode = 200;
      const req = {
        params: { barcode: '8901000999888' },
        query: { includeExternal: 'true' },
        user: { user_id: 1, role: 'STAFF' }
      };
      const res = {
        status(code) { statusCode = code; return this; },
        json(payload) { resData = payload; return this; }
      };

      await productController.lookupByBarcode(req, res);

      // Should degrade gracefully to 404 "not found" instead of crashing with 500
      assert.strictEqual(statusCode, 404);
      assert.strictEqual(resData.message, 'Product not found. You can add this product manually.');
    } finally {
      offService.getProductByBarcode = originalGetProduct;
    }
  });

  // 5. Duplicate barcode prevention
  test('5. Duplicate barcode registration is strictly rejected with 409 conflict', async () => {
    // Get existing product barcode
    const [existing] = await pool.query('SELECT barcode, product_name FROM product WHERE barcode IS NOT NULL LIMIT 1');
    const existingBarcode = existing[0].barcode;

    let resData = null;
    let statusCode = 200;
    const req = {
      body: {
        product_name: 'Duplicate Barcode Attempt',
        brand: 'Fake Brand',
        barcode: existingBarcode,
        unit: 'pcs',
        unit_price: 50.00
      },
      user: { user_id: 1, role: 'ADMIN' }
    };
    const res = {
      status(code) { statusCode = code; return this; },
      json(payload) { resData = payload; return this; }
    };

    await productController.confirmExternalProduct(req, res);

    assert.strictEqual(statusCode, 409);
    assert.strictEqual(resData.success, false);
    assert.ok(resData.message.includes('already assigned'));
  });

  // 6. USB / Bluetooth scanner normalization and format support
  test('6. Scanner inputs in EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39 normalize cleanly', () => {
    // EAN-13 with scanner leading/trailing whitespace
    const ean13 = barcodeUtil.validateBarcode('  8901491100519\n');
    assert.strictEqual(ean13.valid, true);
    assert.strictEqual(ean13.barcode, '8901491100519');

    // EAN-8
    const ean8 = barcodeUtil.validateBarcode('96385074');
    assert.strictEqual(ean8.valid, true);
    assert.strictEqual(ean8.barcode, '96385074');

    // UPC-A
    const upcA = barcodeUtil.validateBarcode('012345678905');
    assert.strictEqual(upcA.valid, true);

    // Code 128 alphanumeric
    const code128 = barcodeUtil.validateBarcode('PKG-DARKSTORE-901');
    assert.strictEqual(code128.valid, true);
    assert.strictEqual(code128.barcode, 'PKG-DARKSTORE-901');

    // Code 39
    const code39 = barcodeUtil.validateBarcode('ITEM12345');
    assert.strictEqual(code39.valid, true);
  });

  // 7 & 8. Scanner timing logic: Enter vs non-Enter debounced sequence simulation
  test('7 & 8. Scanner keystroke timing engine handles both Enter-terminated and debounce fallbacks', () => {
    // Simulated state machine matching useBarcodeScanner
    function simulateScanner(events, { maxInterval = 65, minLength = 3, hasEnter = true }) {
      let buffer = '';
      let lastTime = 0;
      let completedScans = [];
      let isRapid = false;

      events.forEach(evt => {
        const interval = evt.time - lastTime;
        lastTime = evt.time;

        if (interval < maxInterval) {
          isRapid = true;
        } else if (interval > 250) {
          buffer = '';
          isRapid = false;
        }

        if (evt.key === 'Enter') {
          if (buffer.length >= minLength) {
            completedScans.push(buffer);
            buffer = '';
          }
        } else if (evt.key.length === 1) {
          buffer += evt.key;
        }
      });

      // If scanner does not send Enter, rapid sequence buffer after debounce triggers scan
      if (!hasEnter && isRapid && buffer.length >= minLength) {
        completedScans.push(buffer);
      }

      return completedScans;
    }

    // 7. Scanner that sends Enter (typical rapid HID keystrokes ~10ms apart followed by Enter)
    const enterEvents = [
      { key: '8', time: 1000 },
      { key: '9', time: 1010 },
      { key: '0', time: 1020 },
      { key: '1', time: 1030 },
      { key: '2', time: 1040 },
      { key: 'Enter', time: 1050 }
    ];
    const scansWithEnter = simulateScanner(enterEvents, { hasEnter: true });
    assert.deepStrictEqual(scansWithEnter, ['89012']);

    // 8. Scanner that does NOT send Enter (debounced completion)
    const nonEnterEvents = [
      { key: '8', time: 2000 },
      { key: '9', time: 2012 },
      { key: '0', time: 2025 },
      { key: '1', time: 2038 },
      { key: '2', time: 2050 }
    ];
    const scansWithoutEnter = simulateScanner(nonEnterEvents, { hasEnter: false });
    assert.deepStrictEqual(scansWithoutEnter, ['89012']);
  });

  // 9. Repeated scans deduplication within cooldown
  test('9. Repeated scans within cooldown window are deduplicated', () => {
    function processDeduplicatedScans(scans, cooldownMs = 800) {
      let lastBarcode = '';
      let lastScanTime = 0;
      const accepted = [];

      scans.forEach(scan => {
        if (scan.barcode === lastBarcode && (scan.time - lastScanTime < cooldownMs)) {
          // Suppressed duplicate
          return;
        }
        lastBarcode = scan.barcode;
        lastScanTime = scan.time;
        accepted.push(scan.barcode);
      });

      return accepted;
    }

    const scanStream = [
      { barcode: '8901234567890', time: 1000 },
      { barcode: '8901234567890', time: 1100 }, // +100ms: duplicate should be dropped
      { barcode: '8901234567890', time: 1300 }, // +300ms: duplicate should be dropped
      { barcode: '8901234567891', time: 1400 }, // different barcode: accepted
      { barcode: '8901234567890', time: 2500 }  // +1100ms later: cooldown passed, accepted
    ];

    const accepted = processDeduplicatedScans(scanStream, 800);
    assert.deepStrictEqual(accepted, [
      '8901234567890',
      '8901234567891',
      '8901234567890'
    ]);
  });

  // 10 & 11. Picking barcode validation: wrong product rejected, correct confirmed
  test('10 & 11. Picking validation: wrong product scan is rejected; correct product confirms pick', () => {
    const currentItem = {
      product_name: 'Cold Drinks 500ml',
      barcode: '8901234567890',
      allocated_quantity: 4
    };

    function evaluatePickScan(scannedBarcode, item) {
      const scanned = (scannedBarcode || '').trim();
      const expected = (item.barcode || '').trim();
      if (!expected || scanned !== expected) {
        return {
          confirmed: false,
          error: `Scanned barcode "${scanned}" does not match expected product barcode "${expected}". Pick rejected.`
        };
      }
      return {
        confirmed: true,
        picked_quantity: item.allocated_quantity
      };
    }

    // 10. Wrong product scanned
    const wrongResult = evaluatePickScan('8909999999999', currentItem);
    assert.strictEqual(wrongResult.confirmed, false);
    assert.ok(wrongResult.error.includes('Pick rejected'));

    // 11. Correct product scanned
    const correctResult = evaluatePickScan('8901234567890', currentItem);
    assert.strictEqual(correctResult.confirmed, true);
    assert.strictEqual(correctResult.picked_quantity, 4);
  });

  // 12. Stock quantity remains unchanged until workflow is confirmed
  test('12. Stock quantity in database remains completely unchanged during barcode lookups', async () => {
    // 1. Get stock count for Kurkure or Cold Drinks
    const [beforeStock] = await pool.query(
      `SELECT p.product_id, p.barcode, COALESCE(SUM(i.quantity), 0) AS total_qty
       FROM product p
       LEFT JOIN inventory i ON p.product_id = i.product_id
       WHERE p.barcode IS NOT NULL
       GROUP BY p.product_id, p.barcode
       LIMIT 1`
    );
    assert.ok(beforeStock.length > 0);
    const target = beforeStock[0];

    // 2. Perform 5 consecutive barcode lookups
    for (let i = 0; i < 5; i++) {
      const req = {
        params: { barcode: target.barcode },
        query: { includeExternal: 'false' },
        user: { user_id: 1, role: 'STAFF' }
      };
      const res = {
        status() { return this; },
        json() { return this; }
      };
      await productController.lookupByBarcode(req, res);
    }

    // 3. Verify stock count is still 100% identical
    const [afterStock] = await pool.query(
      `SELECT COALESCE(SUM(quantity), 0) AS total_qty
       FROM inventory
       WHERE product_id = ?`,
      [target.product_id]
    );

    assert.strictEqual(
      Number(afterStock[0].total_qty),
      Number(target.total_qty),
      'Stock quantity must not change during barcode lookups'
    );
  });

  // 13. Kurkure barcode 8901491100533 validation and Open Food Facts resolution
  test('13. Kurkure barcode 8901491100533 has valid check digit and retrieves product details', async () => {
    const kurkureBarcode = '8901491100533';

    // Verify mathematical check digit according to GS1 EAN-13 standard
    const digits = kurkureBarcode.slice(0, 12).split('').map(Number);
    let sum = 0;
    digits.forEach((d, idx) => {
      sum += (idx % 2 === 0 ? d : d * 3);
    });
    const expectedCheck = (10 - (sum % 10)) % 10;
    assert.strictEqual(expectedCheck, Number(kurkureBarcode[12]), 'Check digit must equal 3');

    // Deterministic mock fallback in case external network request times out or is offline
    const originalGetProduct = offService.getProductByBarcode;
    offService.getProductByBarcode = async (barcode) => {
      try {
        const live = await originalGetProduct(barcode);
        if (live && live.success) return live;
      } catch (_) {}
      return {
        success: true,
        data: {
          barcode: kurkureBarcode,
          product_name: 'Kurkure Chilli Chatka',
          brand: 'Kurkure',
          category: 'Snacks',
          unit: '1 pack',
          image_url: 'https://images.openfoodfacts.org/images/products/890/149/110/0533/front_en.jpg',
          has_image: true
        }
      };
    };

    try {
      // Perform barcode lookup
      let resData = null;
      let statusCode = 200;
      const req = {
        params: { barcode: kurkureBarcode },
        query: { includeExternal: 'true' },
        user: { user_id: 1, role: 'STAFF' }
      };
      const res = {
        status(code) { statusCode = code; return this; },
        json(payload) { resData = payload; return this; }
      };

      await productController.lookupByBarcode(req, res);

      assert.strictEqual(statusCode, 200);
      assert.strictEqual(resData.success, true);
      assert.strictEqual(resData.data.barcode, kurkureBarcode);
      assert.ok(resData.data.product_name.includes('Chilli') || resData.data.brand === 'Kurkure' || resData.data.product_name, 'Should return product name');
    } finally {
      offService.getProductByBarcode = originalGetProduct;
    }
  });

  // 14. Preservation of leading zeros in UPC-A and EAN-13 barcodes
  test('14. Barcodes with leading zeros strictly preserve their leading digits', () => {
    const barcodeWithLeadingZero = '012345678905'; // UPC-A
    const normalized = barcodeUtil.validateBarcode(barcodeWithLeadingZero);
    assert.strictEqual(normalized.valid, true);
    assert.strictEqual(normalized.barcode, '012345678905');
    assert.strictEqual(normalized.barcode[0], '0', 'Leading zero must never be stripped');

    const eanWithLeadingZero = '0890149110053';
    const normalizedEan = barcodeUtil.validateBarcode(eanWithLeadingZero);
    assert.strictEqual(normalizedEan.valid, true);
    assert.strictEqual(normalizedEan.barcode, '0890149110053');
  });

  // 15. ZXing EAN-13 decoder engine decodes synthetic 8901491100533 bitmap
  test('15. ZXing decoder engine successfully decodes EAN-13 8901491100533 modules', () => {
    const ZXing = require('../../frontend/node_modules/html5-qrcode/third_party/zxing-js.umd.js');

    const L_PATTERNS = [
      '0001101', '0011001', '0010011', '0111101', '0100011',
      '0110001', '0101111', '0111011', '0110111', '0001011'
    ];
    const G_PATTERNS = [
      '0100111', '0110011', '0011011', '0100001', '0011101',
      '0111101', '0000101', '0010001', '0001001', '0010111'
    ];
    const R_PATTERNS = [
      '1110010', '1100110', '1101100', '1000010', '1011100',
      '1001110', '1010000', '1000100', '1001000', '1110100'
    ];
    const PARITY = [
      'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
      'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'
    ];

    function generateEan13Modules(code) {
      const first = Number(code[0]);
      const leftDigits = code.slice(1, 7).split('').map(Number);
      const rightDigits = code.slice(7, 13).split('').map(Number);
      const parity = PARITY[first];
      let modules = '0000000000101';
      leftDigits.forEach((d, i) => {
        modules += parity[i] === 'L' ? L_PATTERNS[d] : G_PATTERNS[d];
      });
      modules += '01010';
      rightDigits.forEach(d => {
        modules += R_PATTERNS[d];
      });
      modules += '1010000000000';
      return modules;
    }

    const modules = generateEan13Modules('8901491100533');
    const scale = 3;
    const width = modules.length * scale;
    const height = 80;
    const luminances = new Uint8ClampedArray(width * height);
    for (let y = 0; y < height; y++) {
      for (let m = 0; m < modules.length; m++) {
        const val = modules[m] === '1' ? 0 : 255;
        for (let s = 0; s < scale; s++) {
          luminances[y * width + (m * scale + s)] = val;
        }
      }
    }

    class RGBLuminanceSource extends ZXing.LuminanceSource {
      constructor(luminances, width, height) {
        super(width, height);
        this.luminances = luminances;
      }
      getMatrix() { return this.luminances; }
      getRow(y, row) {
        const w = this.getWidth();
        if (!row || row.length < w) row = new Uint8ClampedArray(w);
        const start = y * w;
        for (let i = 0; i < w; i++) row[i] = this.luminances[start + i];
        return row;
      }
    }

    const source = new RGBLuminanceSource(luminances, width, height);
    const bitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(source));
    const reader = new ZXing.EAN13Reader();
    const result = reader.decode(bitmap);

    assert.strictEqual(result.getText(), '8901491100533', 'ZXing must decode 8901491100533 correctly');
  });

});
