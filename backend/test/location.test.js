const test = require('node:test');
const { after } = require('node:test');
const assert = require('node:assert/strict');
const locationController = require('../controllers/location.controller');
const pool = require('../config/db.config');
const { formatLocationDisplay } = require('../utils/picking.util');

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

test('Location Management: requires location_name on create', async () => {
  const { res, getStatus, getData } = mockRes();
  const req = {
    body: {
      zone: 'Ambient',
      aisle: 'A-01'
    }
  };

  await locationController.create(req, res);
  assert.equal(getStatus(), 400);
  assert.equal(getData()?.success, false);
  assert.match(getData()?.message, /location_name is required/i);
});

test('Location Management: rejects empty or whitespace-only location_name', async () => {
  const { res, getStatus, getData } = mockRes();
  const req = {
    body: {
      location_name: '   ',
      zone: 'Cold'
    }
  };

  await locationController.create(req, res);
  assert.equal(getStatus(), 400);
  assert.equal(getData()?.success, false);
});

test('Location Management: successfully creates and retrieves full location with Zone, Aisle, Rack, Shelf, Bin, and Description', async () => {
  const { res: createRes, getStatus: getCreateStatus, getData: getCreateData } = mockRes();
  const testLocationName = `Test Bay ${Date.now()}`;
  const req = {
    body: {
      location_name: testLocationName,
      zone: 'Ambient Zone 1',
      aisle: 'AISLE-09',
      rack_number: 'RACK-44',
      shelf: 'SHELF-B',
      bin: 'BIN-12',
      description: 'Automated test location with complete rack hierarchy'
    }
  };

  await locationController.create(req, createRes);
  assert.equal(getCreateStatus(), 201);
  assert.equal(getCreateData()?.success, true);
  const insertId = getCreateData()?.data?.insertId;
  assert.ok(insertId, 'Should return insertId');

  try {
    // Verify direct from database to ensure exact schema persistence
    const [rows] = await pool.query('SELECT * FROM location WHERE location_id = ?', [insertId]);
    assert.equal(rows.length, 1);
    const saved = rows[0];
    assert.equal(saved.location_name, testLocationName);
    assert.equal(saved.zone, 'Ambient Zone 1');
    assert.equal(saved.aisle, 'AISLE-09');
    assert.equal(saved.rack_number, 'RACK-44');
    assert.equal(saved.shelf, 'SHELF-B');
    assert.equal(saved.bin, 'BIN-12');
    assert.equal(saved.description, 'Automated test location with complete rack hierarchy');
    assert.equal(Boolean(saved.is_active), true);

    // Verify picker location guidance correctly uses the exact database values
    const guidance = formatLocationDisplay(saved);
    assert.equal(guidance.isAssigned, true);
    assert.equal(guidance.parts.aisle, 'AISLE-09');
    assert.equal(guidance.parts.rack, 'RACK-44');
    assert.equal(guidance.parts.shelf, 'SHELF-B');
    assert.equal(guidance.parts.bin, 'BIN-12');
    assert.equal(guidance.parts.zone, 'Ambient Zone 1');
    assert.equal(guidance.text, 'Aisle: AISLE-09 | Rack: RACK-44 | Shelf: SHELF-B | Bin: BIN-12 | Zone: Ambient Zone 1');

    // Test updating location attributes
    const { res: updateRes, getStatus: getUpdateStatus, getData: getUpdateData } = mockRes();
    const updateReq = {
      params: { id: String(insertId) },
      body: {
        aisle: 'AISLE-10',
        shelf: 'SHELF-C',
        bin: 'BIN-99',
        description: 'Updated shelf and bin'
      }
    };

    await locationController.update(updateReq, updateRes);
    assert.equal(getUpdateStatus(), 200);
    assert.equal(getUpdateData()?.success, true);

    const [updatedRows] = await pool.query('SELECT * FROM location WHERE location_id = ?', [insertId]);
    assert.equal(updatedRows[0].aisle, 'AISLE-10');
    assert.equal(updatedRows[0].shelf, 'SHELF-C');
    assert.equal(updatedRows[0].bin, 'BIN-99');
    assert.equal(updatedRows[0].rack_number, 'RACK-44'); // Rack preserved
    assert.equal(updatedRows[0].zone, 'Ambient Zone 1'); // Zone preserved

  } finally {
    // Clean up test record to preserve existing database state
    await pool.query('DELETE FROM location WHERE location_id = ?', [insertId]);
  }
});

test('Location Guidance: handles missing location fields without inventing identifiers', () => {
  const sparseLocation = {
    location_name: 'Bulk Pallet Floor 1',
    rack_number: null,
    aisle: null,
    shelf: null,
    bin: null,
    zone: 'Bulk'
  };

  const guidance = formatLocationDisplay(sparseLocation);
  assert.equal(guidance.isAssigned, true);
  assert.equal(guidance.parts.zone, 'Bulk');
  assert.equal(guidance.parts.aisle, null);
  assert.equal(guidance.parts.rack, null);
  assert.equal(guidance.parts.shelf, null);
  assert.equal(guidance.parts.bin, null);
  // Guidance displays only known segments without inventing dummy racks/bins
  assert.equal(guidance.text, 'Zone: Bulk');
});
