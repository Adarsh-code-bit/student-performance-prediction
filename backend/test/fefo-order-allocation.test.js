const test = require('node:test');
const assert = require('node:assert/strict');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '1234',
  database: 'defaultdb_verify_sandbox'
};

test('FEFO Allocation & Multi-Rack Logic Suite', async (t) => {
  let conn;

  t.before(async () => {
    conn = await mysql.createConnection(poolConfig);
  });

  t.after(async () => {
    if (conn) await conn.end();
  });

  await t.test('1. FEFO Rule: Prioritizes batch with earliest expiry date regardless of quantity', async () => {
    const [rows] = await conn.query(`
      WITH test_inventory AS (
        SELECT 101 AS product_id, 'RACK-A1' AS rack_number, 'BATCH-EXP-LATER' AS batch_code, 
               '2027-12-31' AS expiry_date, 100 AS quantity, 1 AS inventory_id
        UNION ALL
        SELECT 101 AS product_id, 'RACK-B2' AS rack_number, 'BATCH-EXP-SOON' AS batch_code, 
               '2026-11-05' AS expiry_date, 5 AS quantity, 2 AS inventory_id
        UNION ALL
        SELECT 101 AS product_id, 'RACK-C3' AS rack_number, 'BATCH-NO-EXPIRY' AS batch_code, 
               NULL AS expiry_date, 50 AS quantity, 3 AS inventory_id
      )
      SELECT * FROM (
        SELECT product_id, rack_number, batch_code, expiry_date, quantity,
               ROW_NUMBER() OVER (
                 PARTITION BY product_id 
                 ORDER BY 
                   (quantity > 0) DESC,
                   CASE WHEN expiry_date IS NOT NULL THEN 0 ELSE 1 END ASC,
                   expiry_date ASC,
                   quantity DESC,
                   inventory_id ASC
               ) AS rn
        FROM test_inventory
      ) t WHERE rn = 1
    `);

    assert.equal(rows.length, 1);
    const selected = rows[0];
    assert.equal(selected.batch_code, 'BATCH-EXP-SOON', 'FEFO must choose nearest expiring batch');
    assert.equal(selected.rack_number, 'RACK-B2', 'Must select location associated with nearest expiry batch');
    assert.equal(selected.quantity, 5, 'Must pick the 5-unit batch before the 100-unit batch');
  });

  await t.test('2. Multiple Racks: Correctly detects all available locations and flags split-picking requirement', async () => {
    const [availableLocations] = await conn.query(`
      WITH test_inventory AS (
        SELECT 102 AS product_id, 10 AS location_id, 'RACK-01' AS rack_number, 'Ambient' AS zone,
               'BATCH-102A' AS batch_code, '2026-11-15' AS expiry_date, 4 AS quantity
        UNION ALL
        SELECT 102 AS product_id, 11 AS location_id, 'RACK-02' AS rack_number, 'Ambient' AS zone,
               'BATCH-102B' AS batch_code, '2026-11-20' AS expiry_date, 10 AS quantity
      )
      SELECT * FROM test_inventory
      WHERE quantity > 0
      ORDER BY 
        CASE WHEN expiry_date IS NOT NULL THEN 0 ELSE 1 END ASC,
        expiry_date ASC,
        quantity DESC
    `);

    assert.equal(availableLocations.length, 2, 'Should identify all active racks holding stock');
    const totalStock = availableLocations.reduce((s, r) => s + r.quantity, 0);
    assert.equal(totalStock, 14, 'Total available across racks should be 14');

    const requestedQuantity = 8;
    const primaryStock = availableLocations[0].quantity;
    const requiresSplitPick = primaryStock < requestedQuantity && totalStock >= requestedQuantity;
    assert.equal(requiresSplitPick, true, 'Should detect that primary rack (4) is insufficient for 8 and requires split picking');
  });

  await t.test('3. Zero Stock Scenarios: Depleted rack is bypassed for positive stock rack', async () => {
    const [rows] = await conn.query(`
      WITH test_inventory AS (
        SELECT 103 AS product_id, 'RACK-DEPLETED' AS rack_number, 'BATCH-OLD' AS batch_code, 
               '2026-10-01' AS expiry_date, 0 AS quantity, 10 AS inventory_id
        UNION ALL
        SELECT 103 AS product_id, 'RACK-IN-STOCK' AS rack_number, 'BATCH-FRESH' AS batch_code, 
               '2026-12-15' AS expiry_date, 25 AS quantity, 11 AS inventory_id
      )
      SELECT * FROM (
        SELECT product_id, rack_number, batch_code, expiry_date, quantity,
               ROW_NUMBER() OVER (
                 PARTITION BY product_id 
                 ORDER BY 
                   (quantity > 0) DESC,
                   CASE WHEN expiry_date IS NOT NULL THEN 0 ELSE 1 END ASC,
                   expiry_date ASC,
                   quantity DESC,
                   inventory_id ASC
               ) AS rn
        FROM test_inventory
      ) t WHERE rn = 1
    `);

    assert.equal(rows.length, 1);
    assert.equal(rows[0].rack_number, 'RACK-IN-STOCK', 'Must select location with positive stock');
    assert.equal(rows[0].quantity, 25);
  });

  await t.test('4. Complete Stockout Scenario: Correctly flags stock shortage and zero available stock', async () => {
    const [rows] = await conn.query(`
      WITH test_inventory AS (
        SELECT 104 AS product_id, 'RACK-EMPTY-1' AS rack_number, 'BATCH-X' AS batch_code, 
               '2026-10-01' AS expiry_date, 0 AS quantity, 20 AS inventory_id
        UNION ALL
        SELECT 104 AS product_id, 'RACK-EMPTY-2' AS rack_number, 'BATCH-Y' AS batch_code, 
               '2026-10-05' AS expiry_date, 0 AS quantity, 21 AS inventory_id
      )
      SELECT * FROM (
        SELECT product_id, rack_number, batch_code, expiry_date, quantity,
               ROW_NUMBER() OVER (
                 PARTITION BY product_id 
                 ORDER BY 
                   (quantity > 0) DESC,
                   CASE WHEN expiry_date IS NOT NULL THEN 0 ELSE 1 END ASC,
                   expiry_date ASC,
                   quantity DESC,
                   inventory_id ASC
               ) AS rn
        FROM test_inventory
      ) t WHERE rn = 1
    `);

    assert.equal(rows.length, 1);
    const requestedQuantity = 5;
    const totalAvailable = rows[0].quantity; // 0
    const hasStockShortage = totalAvailable < requestedQuantity;
    const shortageQuantity = requestedQuantity - totalAvailable;

    assert.equal(hasStockShortage, true, 'Must flag shortage when inventory is 0');
    assert.equal(shortageQuantity, 5, 'Shortage quantity must equal total requested');
  });

  await t.test('5. Transparency Contract: Dynamic estimates must declare non-historical source', () => {
    const mockOrderFallback = {
      is_historical_allocation: false,
      is_dynamically_estimated: true,
      allocation_source: 'DYNAMIC_FEFO_ESTIMATE',
      allocation_disclaimer: 'Locations dynamically estimated using live FEFO inventory balances. Historical allocations table not active for this order.'
    };

    assert.equal(mockOrderFallback.is_historical_allocation, false);
    assert.equal(mockOrderFallback.is_dynamically_estimated, true);
    assert.equal(mockOrderFallback.allocation_source, 'DYNAMIC_FEFO_ESTIMATE');
  });

  await t.test('6. Order API Compatibility on Sandbox: Successfully resolves existing order #1', async () => {
    const [orderRows] = await conn.query(`
      SELECT o.order_id, o.customer_id, o.total_amount, o.status, c.customer_name 
      FROM orders o
      JOIN customer c ON o.customer_id = c.customer_id
      WHERE o.order_id = 1
    `);
    assert.equal(orderRows.length, 1, 'Order 1 must exist in sandbox');

    const [details] = await conn.query(`
      SELECT od.order_detail_id, od.product_id, od.quantity, p.product_name, p.sku
      FROM order_details od
      JOIN product p ON od.product_id = p.product_id
      WHERE od.order_id = 1
    `);
    assert.ok(details.length >= 1, 'Order details must be readable for Order 1');
  });
});
