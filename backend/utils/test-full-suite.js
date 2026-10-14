const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

const client = axios.create({
  baseURL: BASE_URL,
  validateStatus: () => true // do not throw on 4xx/5xx
});

async function runTests() {
  console.log('====================================================');
  console.log('   FULL VERIFICATION SUITE FOR QUICK COMMERCE SIMS   ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // TEST 1: Unauthenticated Requests (Security & Tokens)
  // ----------------------------------------------------
  console.log('--- TEST 1: Unauthenticated Requests to Protected Endpoints ---');
  const resNoAuthUsers = await client.get('/users');
  assert(resNoAuthUsers.status === 401, `GET /api/users with no token returns 401 (got ${resNoAuthUsers.status})`);

  const resNoAuthInv = await client.get('/inventory');
  assert(resNoAuthInv.status === 401, `GET /api/inventory with no token returns 401 (got ${resNoAuthInv.status})`);

  const resNoAuthOrders = await client.get('/orders');
  assert(resNoAuthOrders.status === 401, `GET /api/orders with no token returns 401 (got ${resNoAuthOrders.status})`);

  const resNoAuthStaff = await client.get('/staff-allocation/staff');
  assert(resNoAuthStaff.status === 401, `GET /api/staff-allocation/staff with no token returns 401 (got ${resNoAuthStaff.status})`);

  const resNoAuthAudits = await client.get('/stock-audits');
  assert(resNoAuthAudits.status === 401, `GET /api/stock-audits with no token returns 401 (got ${resNoAuthAudits.status})`);

  const resNoAuthDash = await client.get('/dashboard/stats');
  assert(resNoAuthDash.status === 401, `GET /api/dashboard/stats with no token returns 401 (got ${resNoAuthDash.status})`);

  // ----------------------------------------------------
  // TEST 2: Role Authentication & Credentials
  // ----------------------------------------------------
  console.log('\n--- TEST 2: Authenticating Roles & Token Issuance ---');
  const loginAdmin = await client.post('/auth/login', { email: 'admin@example.com', password: 'password123' });
  assert(loginAdmin.status === 200 && loginAdmin.data.data.token, 'Admin login succeeds and receives JWT');
  const adminToken = loginAdmin.data?.data?.token;

  const loginManager = await client.post('/auth/login', { email: 'manager@example.com', password: 'password123' });
  assert(loginManager.status === 200 && loginManager.data.data.token, 'Store Manager login succeeds and receives JWT');
  const managerToken = loginManager.data?.data?.token;

  const loginAuditor = await client.post('/auth/login', { email: 'auditor@example.com', password: 'password123' });
  assert(loginAuditor.status === 200 && loginAuditor.data.data.user.staff_subrole === 'AUDITOR', 'Auditor login succeeds with permanent subrole AUDITOR');
  const auditorToken = loginAuditor.data?.data?.token;

  const loginPicker = await client.post('/auth/login', { email: 'picker@example.com', password: 'password123' });
  assert(loginPicker.status === 200 && loginPicker.data.data.user.staff_subrole === 'PICKER', 'Picker login succeeds with permanent subrole PICKER');
  const pickerToken = loginPicker.data?.data?.token;

  const loginPacker = await client.post('/auth/login', { email: 'packer@example.com', password: 'password123' });
  assert(loginPacker.status === 200 && loginPacker.data.data.user.staff_subrole === 'PACKER', 'Packer login succeeds with permanent subrole PACKER');
  const packerToken = loginPacker.data?.data?.token;

  const loginClerk = await client.post('/auth/login', { email: 'clerk@example.com', password: 'password123' });
  assert(loginClerk.status === 200 && loginClerk.data.data.user.staff_subrole === 'INVENTORY_CLERK', 'Inventory Clerk login succeeds with permanent subrole INVENTORY_CLERK');
  const clerkToken = loginClerk.data?.data?.token;

  // ----------------------------------------------------
  // TEST 3: Staff Authorization Restrictions
  // ----------------------------------------------------
  console.log('\n--- TEST 3: Staff Authorization Restrictions ---');
  const staffGetUsers = await client.get('/users', { headers: { Authorization: `Bearer ${auditorToken}` } });
  assert(staffGetUsers.status === 403, `Staff accessing /api/users returns 403 Forbidden (got ${staffGetUsers.status})`);

  const staffAssign = await client.post('/staff-allocation/assign', {}, { headers: { Authorization: `Bearer ${auditorToken}` } });
  assert(staffAssign.status === 403, `Staff attempting staff allocation returns 403 Forbidden (got ${staffAssign.status})`);

  const staffCreateProduct = await client.post('/products', { product_name: 'Test' }, { headers: { Authorization: `Bearer ${auditorToken}` } });
  assert(staffCreateProduct.status === 403, `Staff creating products returns 403 Forbidden (got ${staffCreateProduct.status})`);

  const adminGetUsers = await client.get('/users', { headers: { Authorization: `Bearer ${adminToken}` } });
  assert(adminGetUsers.status === 200 && Array.isArray(adminGetUsers.data.data), 'Admin accessing /api/users returns 200 with users list');

  // ----------------------------------------------------
  // TEST 4: Previously Broken Endpoints (location_type fix)
  // ----------------------------------------------------
  console.log('\n--- TEST 4: Previously Broken Inventory Endpoints ---');
  const invRes = await client.get('/inventory', { headers: { Authorization: `Bearer ${adminToken}` } });
  assert(invRes.status === 200 && Array.isArray(invRes.data.data), `GET /api/inventory returns 200 (records: ${invRes.data.data?.length})`);

  const moveRes = await client.get('/stock-movements', { headers: { Authorization: `Bearer ${adminToken}` } });
  assert(moveRes.status === 200 && Array.isArray(moveRes.data.data), `GET /api/stock-movements returns 200 (records: ${moveRes.data.data?.length})`);

  // ----------------------------------------------------
  // TEST 5: Dynamic Staff Allocation Lifecycle
  // ----------------------------------------------------
  console.log('\n--- TEST 5: Dynamic Staff Allocation Lifecycle ---');
  // Clean up any stale active allocations for auditor@example.com (user_id: 4)
  const staffList = await client.get('/staff-allocation/staff', { headers: { Authorization: `Bearer ${managerToken}` } });
  assert(staffList.status === 200, 'Store Manager can query staff availability list');
  const auditorUser = staffList.data.data.find(s => s.email === 'auditor@example.com');
  assert(auditorUser, 'Found auditor user in staff list');

  if (auditorUser.active_assignment) {
    // End active assignment first
    await client.post(`/staff-allocation/end/${auditorUser.active_allocation_id}`, { notes: 'Reset before test' }, { headers: { Authorization: `Bearer ${managerToken}` } });
  }

  // Auditor attempts to claim picking -> should fail with 403
  const pickBeforeReassign = await client.post('/orders/1/claim-picking', {}, { headers: { Authorization: `Bearer ${auditorToken}` } });
  assert(pickBeforeReassign.status === 403, `Auditor before reassignment rejected from claiming picking (got ${pickBeforeReassign.status})`);

  // Manager creates temporary assignment: AUDITOR -> PICKER
  const assignRes = await client.post('/staff-allocation/assign', {
    user_id: auditorUser.user_id,
    assigned_role: 'PICKER',
    reason: 'Surge rush hour'
  }, { headers: { Authorization: `Bearer ${managerToken}` } });
  assert(assignRes.status === 201 && assignRes.data.data.allocation_id, 'Store Manager successfully reassigns AUDITOR to PICKER');
  const allocationId = assignRes.data.data.allocation_id;

  // Duplicate assignment attempt -> must be rejected with 400
  const dupAssign = await client.post('/staff-allocation/assign', {
    user_id: auditorUser.user_id,
    assigned_role: 'PICKER',
    reason: 'Duplicate attempt'
  }, { headers: { Authorization: `Bearer ${managerToken}` } });
  assert(dupAssign.status === 400, `Conflicting active assignment correctly rejected with 400 (got ${dupAssign.status})`);

  // Auditor checks /auth/me -> verify active_assignment is PICKER while permanent is AUDITOR
  const auditorProfile = await client.get('/auth/me', { headers: { Authorization: `Bearer ${auditorToken}` } });
  assert(
    auditorProfile.data.data.user.staff_subrole === 'AUDITOR' &&
    auditorProfile.data.data.user.active_assignment === 'PICKER',
    'Auditor profile reflects active_assignment: PICKER while preserving permanent staff_subrole: AUDITOR'
  );

  // Auditor now has operational access to picking queue
  const pickQueueReassigned = await client.get('/orders/picking-queue', { headers: { Authorization: `Bearer ${auditorToken}` } });
  assert(pickQueueReassigned.status === 200, 'Reassigned Auditor now has access to /orders/picking-queue');

  // End temporary assignment
  const endAssignRes = await client.post(`/staff-allocation/end/${allocationId}`, { notes: 'Surge volume subsided' }, { headers: { Authorization: `Bearer ${managerToken}` } });
  assert(endAssignRes.status === 200, 'Store Manager successfully ended temporary assignment');

  // Auditor checks /auth/me again -> active_assignment is null, subrole is AUDITOR
  const auditorProfileAfter = await client.get('/auth/me', { headers: { Authorization: `Bearer ${auditorToken}` } });
  assert(
    auditorProfileAfter.data.data.user.staff_subrole === 'AUDITOR' &&
    auditorProfileAfter.data.data.user.active_assignment === null,
    'Auditor reverted to regular workflow with no active assignment'
  );

  // Picking access is now revoked again (HTTP 403)
  const pickQueueRevoked = await client.get('/orders/picking-queue', { headers: { Authorization: `Bearer ${auditorToken}` } });
  assert(pickQueueRevoked.status === 403, `Auditor picking access correctly revoked on assignment completion (got ${pickQueueRevoked.status})`);

  // ----------------------------------------------------
  // TEST 6: Quick Commerce Order Workflow & State Transitions
  // ----------------------------------------------------
  console.log('\n--- TEST 6: Quick Commerce Order Workflow Validation ---');
  // Create a new test order with 'confirmed' status
  const orderNumber = 'QC-' + Date.now().toString().slice(-6);
  const createOrderRes = await client.post('/orders', {
    order_number: orderNumber,
    customer_id: 1,
    store_id: 1,
    status: 'confirmed',
    shipping_address: 'Indiranagar 100ft Rd',
    items: [{ product_id: 1, quantity: 2, unit_price: 50 }]
  }, { headers: { Authorization: `Bearer ${managerToken}` } });
  assert(createOrderRes.status === 201 && createOrderRes.data.data.order_id, `Created test quick commerce order ${orderNumber}`);
  const orderId = createOrderRes.data.data.order_id;

  // Packer attempts to pack order before picking is done -> MUST FAIL with 400
  const prematurePack = await client.post(`/orders/${orderId}/claim-packing`, {}, { headers: { Authorization: `Bearer ${packerToken}` } });
  assert(prematurePack.status === 400, `Premature packing rejected with 400: "${prematurePack.data.message}"`);

  // Picker claims picking task
  const claimPick = await client.post(`/orders/${orderId}/claim-picking`, {}, { headers: { Authorization: `Bearer ${pickerToken}` } });
  assert(claimPick.status === 200 && claimPick.data.data.status === 'picking_in_progress', 'Picker claims order -> status: picking_in_progress');

  // Picker completes picking task
  const completePick = await client.post(`/orders/${orderId}/complete-picking`, {
    items: [{ product_id: 1, picked_quantity: 2 }]
  }, { headers: { Authorization: `Bearer ${pickerToken}` } });
  assert(completePick.status === 200 && completePick.data.data.status === 'picked', 'Picker completes order -> status: picked');

  // Packer claims packing task
  const claimPack = await client.post(`/orders/${orderId}/claim-packing`, {}, { headers: { Authorization: `Bearer ${packerToken}` } });
  assert(claimPack.status === 200 && claimPack.data.data.status === 'packing_in_progress', 'Packer claims picked order -> status: packing_in_progress');

  // Packer completes packing task
  const completePack = await client.post(`/orders/${orderId}/complete-packing`, {}, { headers: { Authorization: `Bearer ${packerToken}` } });
  assert(completePack.status === 200 && completePack.data.data.status === 'packed', 'Packer completes order -> status: packed');

  // ----------------------------------------------------
  // TEST 7: Physical Stock Audits & Discrepancies
  // ----------------------------------------------------
  console.log('\n--- TEST 7: Physical Stock Audits & Adjustments ---');
  // Auditor records physical stock count
  const auditRes = await client.post('/stock-audits', {
    product_id: 1,
    location_id: 1,
    store_id: 1,
    physical_quantity: 95,
    notes: 'Missing 5 units during aisle inspection'
  }, { headers: { Authorization: `Bearer ${auditorToken}` } });
  assert(auditRes.status === 201 && typeof auditRes.data?.data?.discrepancy === 'number', `Auditor recorded physical count (discrepancy: ${auditRes.data?.data?.discrepancy})`);
  const auditId = auditRes.data.data.audit_id;

  // Auditor attempts to approve their own audit -> MUST FAIL with 403
  const auditorSelfApprove = await client.post(`/stock-audits/${auditId}/review`, { action: 'APPROVE' }, { headers: { Authorization: `Bearer ${auditorToken}` } });
  assert(auditorSelfApprove.status === 403, `Auditor prevented from unauthorized stock approval (got ${auditorSelfApprove.status})`);

  // Store Manager reviews and approves the audit
  const managerApprove = await client.post(`/stock-audits/${auditId}/review`, { action: 'APPROVE', notes: 'Approved after cycle check' }, { headers: { Authorization: `Bearer ${managerToken}` } });
  if (managerApprove.status !== 200 || managerApprove.data?.data?.status !== 'APPROVED') {
    console.log('Manager approve failed response:', managerApprove.status, managerApprove.data);
  }
  assert(managerApprove.status === 200 && managerApprove.data?.data?.status === 'APPROVED', 'Store Manager approved physical stock adjustment and updated inventory');

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
