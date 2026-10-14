const test = require('node:test');
const assert = require('node:assert/strict');
const { getJwtSecret, getAllowedOrigins } = require('../config/security.config');
const { planBatchDeductions } = require('../utils/stock.util');
const { requireRoles, requireStaffRoles } = require('../middleware/auth.middleware');

test('JWT secret fails closed when absent or weak', () => {
  assert.throws(() => getJwtSecret({}), /JWT_SECRET/);
  assert.throws(() => getJwtSecret({ JWT_SECRET: 'short' }), /JWT_SECRET/);
  assert.equal(getJwtSecret({ JWT_SECRET: 'x'.repeat(48) }), 'x'.repeat(48));
});
test('CORS allowlist contains only configured origins', () => {
  assert.deepEqual(getAllowedOrigins({ CLIENT_URL:'https://app.example', FRONTEND_ORIGINS:'https://admin.example, https://app.example' }), ['https://app.example','https://admin.example']);
});
test('role guards reject and permit expected roles', () => {
  const invoke=(guard,user)=>{let called=false,code;guard({user},{status(n){code=n;return this},json(){}},()=>called=true);return {called,code};};
  assert.equal(invoke(requireRoles('ADMIN'),{role:'STAFF'}).code,403);
  assert.equal(invoke(requireRoles('ADMIN'),{role:'ADMIN'}).called,true);
  assert.equal(invoke(requireStaffRoles('PICKER'),{role:'STAFF',staff_subrole:'AUDITOR'}).code,403);
});
test('batch allocation follows earliest expiry and splits stock', () => {
  assert.deepEqual(planBatchDeductions([{inventory_id:2,quantity:3,expiry_date:'2027-02-01'},{inventory_id:1,quantity:2,expiry_date:'2027-01-01'}],4),[{inventory_id:1,quantity:2},{inventory_id:2,quantity:2}]);
});
test('insufficient eligible stock is rejected', () => {
  assert.throws(()=>planBatchDeductions([{inventory_id:1,quantity:2,expiry_date:'2027-01-01'}],3),/Insufficient/);
});
