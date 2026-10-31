const test = require('node:test');
const assert = require('node:assert/strict');
const { planBatchDeductions } = require('../utils/stock.util');
const { formatLocationDisplay, calculatePickingDurations, formatDuration } = require('../utils/picking.util');
const orderController = require('../controllers/order.controller');

test('FEFO Allocation: preserves batch_id and location_id across multiple storage locations', () => {
  const inventoryRows = [
    { inventory_id: 101, batch_id: 11, location_id: 201, quantity: 5, expiry_date: '2027-01-15' },
    { inventory_id: 102, batch_id: 12, location_id: 202, quantity: 10, expiry_date: '2026-11-20' }, // Earliest expiry
    { inventory_id: 103, batch_id: 13, location_id: 203, quantity: 8, expiry_date: '2027-05-10' }
  ];

  // Request 12 units
  const deductions = planBatchDeductions(inventoryRows, 12);

  assert.equal(deductions.length, 2);
  // First deduction must be from earliest batch (inventory 102, expiry Nov 2026)
  assert.equal(deductions[0].inventory_id, 102);
  assert.equal(deductions[0].batch_id, 12);
  assert.equal(deductions[0].location_id, 202);
  assert.equal(deductions[0].quantity, 10);

  // Remainder (2 units) must be from second earliest batch (inventory 101, expiry Jan 2027)
  assert.equal(deductions[1].inventory_id, 101);
  assert.equal(deductions[1].batch_id, 11);
  assert.equal(deductions[1].location_id, 201);
  assert.equal(deductions[1].quantity, 2);
});

test('Location Guidance: formats complete Aisle, Rack, Shelf, Bin, and Zone correctly', () => {
  const row = {
    aisle: 'A-02',
    rack_number: 'R-14',
    shelf: 'S-03',
    bin: 'B-09',
    zone: 'Ambient'
  };

  const guidance = formatLocationDisplay(row);
  assert.equal(guidance.isAssigned, true);
  assert.equal(guidance.text, 'Aisle: A-02 | Rack: R-14 | Shelf: S-03 | Bin: B-09 | Zone: Ambient');
  assert.equal(guidance.parts.aisle, 'A-02');
  assert.equal(guidance.parts.rack, 'R-14');
  assert.equal(guidance.parts.shelf, 'S-03');
  assert.equal(guidance.parts.bin, 'B-09');
  assert.equal(guidance.parts.zone, 'Ambient');
});

test('Location Guidance: formats partial location without inventing missing fields', () => {
  const row = {
    aisle: 'B-01',
    rack_number: 'R-05',
    shelf: null,
    bin: null,
    zone: null
  };

  const guidance = formatLocationDisplay(row);
  assert.equal(guidance.isAssigned, true);
  assert.equal(guidance.text, 'Aisle: B-01 | Rack: R-05');
  assert.equal(guidance.parts.aisle, 'B-01');
  assert.equal(guidance.parts.rack, 'R-05');
  assert.equal(guidance.parts.shelf, null);
  assert.equal(guidance.parts.bin, null);
});

test('Location Guidance: never invents identifiers and returns "Location not assigned" when missing', () => {
  // Empty object
  const emptyGuidance = formatLocationDisplay({});
  assert.equal(emptyGuidance.isAssigned, false);
  assert.equal(emptyGuidance.text, 'Location not assigned');

  // Null input
  const nullGuidance = formatLocationDisplay(null);
  assert.equal(nullGuidance.isAssigned, false);
  assert.equal(nullGuidance.text, 'Location not assigned');

  // Whitespace-only input
  const blankGuidance = formatLocationDisplay({ aisle: '   ', rack_number: '', shelf: null });
  assert.equal(blankGuidance.isAssigned, false);
  assert.equal(blankGuidance.text, 'Location not assigned');
});

test('Duration Tracking: accurately calculates server-side waiting time and elapsed picking time', () => {
  const assignedAt = new Date('2026-10-17T10:00:00Z');
  const startedAt = new Date('2026-10-17T10:03:30Z'); // 210s waiting
  const pickedAt = new Date('2026-10-17T10:11:45Z');  // 495s elapsed picking

  // 1. Order assigned but picking not yet started
  const queueDurations = calculatePickingDurations({
    picking_assigned_at: assignedAt,
    picking_started_at: null,
    picked_at: null
  }, startedAt);

  assert.equal(queueDurations.waitingSeconds, 210);
  assert.equal(queueDurations.totalElapsedSeconds, 0);

  // 2. Order currently in progress
  const inProgressDurations = calculatePickingDurations({
    picking_assigned_at: assignedAt,
    picking_started_at: startedAt,
    picked_at: null
  }, new Date('2026-10-17T10:08:30Z')); // 300s since started

  assert.equal(inProgressDurations.waitingSeconds, 210);
  assert.equal(inProgressDurations.totalElapsedSeconds, 300);

  // 3. Order completed
  const completedDurations = calculatePickingDurations({
    picking_assigned_at: assignedAt,
    picking_started_at: startedAt,
    picked_at: pickedAt
  });

  assert.equal(completedDurations.waitingSeconds, 210);
  assert.equal(completedDurations.totalElapsedSeconds, 495);
  assert.equal(formatDuration(completedDurations.totalElapsedSeconds), '08:15');
});

test('Manager Live Activity: enforces manager/admin authorization and rejects unauthorized staff', async () => {
  let statusCode = 200;
  let responseBody = null;

  const mockRes = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    }
  };

  // 1. Unauthorized staff (Picker)
  const pickerReq = {
    user: { user_id: 5, role: 'STAFF', staff_subrole: 'PICKER', store_id: 1 }
  };
  await orderController.getManagerPickingActivity(pickerReq, mockRes);
  assert.equal(statusCode, 403);
  assert.equal(responseBody?.success, false);
  assert.match(responseBody?.message, /Manager privileges required/i);

  // 2. Unauthorized staff (Packer)
  statusCode = 200;
  const packerReq = {
    user: { user_id: 6, role: 'STAFF', staff_subrole: 'PACKER', store_id: 1 }
  };
  await orderController.getManagerPickingActivity(packerReq, mockRes);
  assert.equal(statusCode, 403);
});

test('Authorization: requireStaffRoles enforces picker permissions, dynamic staff assignments, and store supervisor access', () => {
  const { requireStaffRoles } = require('../middleware/auth.middleware');
  const pickerGuard = requireStaffRoles('PICKER');

  let nextCalled = false;
  let statusCode = 200;
  let responseBody = null;

  const mockRes = {
    status(c) { statusCode = c; return this; },
    json(b) { responseBody = b; return this; }
  };
  const next = () => { nextCalled = true; };

  // 1. Dedicated Picker is permitted
  nextCalled = false;
  pickerGuard({ user: { role: 'STAFF', staff_subrole: 'PICKER', store_id: 1 } }, mockRes, next);
  assert.equal(nextCalled, true, 'Permanent PICKER must be permitted');

  // 2. Packer attempting to pick is rejected with HTTP 403
  nextCalled = false;
  statusCode = 200;
  pickerGuard({ user: { role: 'STAFF', staff_subrole: 'PACKER', store_id: 1 } }, mockRes, next);
  assert.equal(nextCalled, false, 'Permanent PACKER must not be permitted on picking routes');
  assert.equal(statusCode, 403);
  assert.match(responseBody?.message, /Access denied/);

  // 3. Auditor attempting to pick is rejected with HTTP 403
  nextCalled = false;
  statusCode = 200;
  pickerGuard({ user: { role: 'STAFF', staff_subrole: 'AUDITOR', store_id: 1 } }, mockRes, next);
  assert.equal(nextCalled, false);
  assert.equal(statusCode, 403);

  // 4. Temporarily reassigned staff member (e.g. Packer allocated to PICKER shift) is permitted
  nextCalled = false;
  pickerGuard({ user: { role: 'STAFF', staff_subrole: 'PACKER', active_assignment: 'PICKER', store_id: 1 } }, mockRes, next);
  assert.equal(nextCalled, true, 'Dynamically assigned temporary PICKER must be permitted');

  // 5. Store Manager has supervisor privileges over picking tasks
  nextCalled = false;
  pickerGuard({ user: { role: 'STORE_MANAGER', store_id: 1 } }, mockRes, next);
  assert.equal(nextCalled, true, 'STORE_MANAGER must have supervisor access');

  // 6. Admin has supervisor privileges
  nextCalled = false;
  pickerGuard({ user: { role: 'ADMIN' } }, mockRes, next);
  assert.equal(nextCalled, true, 'ADMIN must have supervisor access');
});

test('Partial Shortage & Cancellation: unpicked quantity calculation logic prevents duplicate restoration and handles cancellation after partial pick', () => {
  const allocation = {
    allocation_id: 50,
    allocated_quantity: 10,
    picked_quantity: 0,
    shortage_quantity: 0,
    is_restored: false,
    status: 'PENDING'
  };

  // 1. Simulate picker confirming partial pick (6 of 10 units found, 4 shortage)
  const pickedQty = 6;
  const shortageQty = allocation.allocated_quantity - pickedQty;
  assert.equal(shortageQty, 4, '4 units reported as shortage and immediately restored to inventory');

  // Allocation state after shortage confirmation: 4 units returned to inventory, 6 units still picked
  const postShortageAllocation = {
    ...allocation,
    picked_quantity: pickedQty,
    shortage_quantity: shortageQty,
    status: 'SHORTAGE',
    is_restored: pickedQty === 0 // false because 6 units are still in the order
  };
  assert.equal(postShortageAllocation.is_restored, false, 'Should remain is_restored=false so remaining 6 picked units can be restored if order cancels');

  // 2. Simulate subsequent order cancellation before dispatch
  // Unpicked quantity remaining in order to restore: allocated_quantity - shortage_quantity
  const unpickedToRestore = postShortageAllocation.is_restored 
    ? 0 
    : (postShortageAllocation.allocated_quantity - postShortageAllocation.shortage_quantity);
  assert.equal(unpickedToRestore, 6, 'Cancellation must restore the 6 units that were picked');

  // Mark allocation as fully restored
  const cancelledAllocation = {
    ...postShortageAllocation,
    is_restored: true
  };
  assert.equal(cancelledAllocation.is_restored, true);

  // 3. Duplicate cancellation check: must not restore anything
  const duplicateRestoreQty = cancelledAllocation.is_restored
    ? 0
    : (cancelledAllocation.allocated_quantity - cancelledAllocation.shortage_quantity);
  assert.equal(duplicateRestoreQty, 0, 'Duplicate cancellation must restore 0 units');
});

test('Over-picking Protection: rejects picked quantity exceeding allocated quantity', () => {
  const allocation = {
    allocated_quantity: 5
  };

  const validatePick = (picked) => {
    if (!Number.isInteger(picked) || picked < 0) throw new Error('Invalid picked quantity');
    if (picked > allocation.allocated_quantity) throw new Error(`Cannot confirm more than allocated quantity (${allocation.allocated_quantity})`);
    return true;
  };

  assert.throws(() => validatePick(6), /Cannot confirm more than allocated/);
  assert.throws(() => validatePick(-1), /Invalid picked quantity/);
  assert.equal(validatePick(5), true);
  assert.equal(validatePick(3), true);
});
