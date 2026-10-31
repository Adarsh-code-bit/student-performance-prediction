const test = require('node:test');
const { before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const pool = require('../config/db.config');
const authController = require('../controllers/auth.controller');
const userController = require('../controllers/user.controller');
const smsService = require('../services/sms.service');
const { isManagerOrAdmin, verifyToken } = require('../middleware/auth.middleware');
const { otpSendLimiter, otpVerifyLimiter } = require('../middleware/rateLimit.middleware');
const { getJwtSecret } = require('../config/security.config');

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

async function cleanup() {
  try {
    const [users] = await pool.query("SELECT user_id FROM `user` WHERE email LIKE '%@test-employee.com' OR phone LIKE '+9199999999%'");
    if (users.length > 0) {
      const ids = users.map(u => u.user_id);
      await pool.query(`DELETE FROM audit_log WHERE user_id IN (${ids.join(',')}) OR (table_name = 'user' AND record_id IN (${ids.join(',')}))`);
      await pool.query(`DELETE FROM \`user\` WHERE user_id IN (${ids.join(',')})`);
    }
    await pool.query("DELETE FROM user_otp WHERE phone LIKE '+9199999999%'");
  } catch (err) {
    console.warn('Cleanup warning:', err.message);
  }
}

/**
 * Helper to execute full OTP send and verify flow in tests
 */
async function sendAndVerifyOtpForTest(phone) {
  const { res: sendRes, getStatus: getSendStatus, getData: getSendData } = mockRes();
  await authController.sendRegistrationOtp({ body: { phone } }, sendRes);
  assert.equal(getSendStatus(), 200, `sendRegistrationOtp failed: ${getSendData()?.message}`);

  const otp = smsService.getTestOtp(phone);
  assert.ok(otp, `Expected test OTP for ${phone}`);

  const { res: verRes, getStatus: getVerStatus, getData: getVerData } = mockRes();
  await authController.verifyRegistrationOtp({ body: { phone, otp } }, verRes);
  assert.equal(getVerStatus(), 200, `verifyRegistrationOtp failed: ${getVerData()?.message}`);
  assert.equal(getVerData()?.verified, true);
  assert.ok(getVerData()?.verification_token, 'Expected verification_token');

  return getVerData().verification_token;
}

before(async () => {
  await cleanup();
});

after(async () => {
  await cleanup();
  await pool.end();
});

test('Employee Signup: rejects missing full name', async () => {
  const { res, getStatus, getData } = mockRes();
  const req = {
    body: {
      phone: '+919999999901',
      employment_type: 'FULL_TIME',
      password: 'Password123'
    }
  };

  await authController.signup(req, res);
  assert.equal(getStatus(), 400);
  assert.equal(getData()?.success, false);
  assert.match(getData()?.message, /name is required/i);
});

test('Employee Signup: rejects invalid mobile number', async () => {
  const { res, getStatus, getData } = mockRes();
  const req = {
    body: {
      user_name: 'Test Operator',
      phone: '123', // Too short
      employment_type: 'FULL_TIME',
      password: 'Password123'
    }
  };

  await authController.signup(req, res);
  assert.equal(getStatus(), 400);
  assert.equal(getData()?.success, false);
  assert.match(getData()?.message, /valid mobile number/i);
});

test('Employee Signup: rejects weak password', async () => {
  const { res, getStatus, getData } = mockRes();
  const req = {
    body: {
      user_name: 'Test Operator',
      phone: '+919999999902',
      employment_type: 'FULL_TIME',
      password: 'pass' // Less than 8 chars
    }
  };

  await authController.signup(req, res);
  assert.equal(getStatus(), 400);
  assert.equal(getData()?.success, false);
  assert.match(getData()?.message, /at least 8 characters/i);
});

test('Employee Signup: rejects password mismatch', async () => {
  const { res, getStatus, getData } = mockRes();
  const req = {
    body: {
      user_name: 'Test Operator',
      phone: '+919999999903',
      employment_type: 'FULL_TIME',
      password: 'Password123',
      confirm_password: 'Password456'
    }
  };

  await authController.signup(req, res);
  assert.equal(getStatus(), 400);
  assert.equal(getData()?.success, false);
  assert.match(getData()?.message, /do not match/i);
});

test('Employee Signup: rejects invalid employment type', async () => {
  const { res, getStatus, getData } = mockRes();
  const req = {
    body: {
      user_name: 'Test Operator',
      phone: '+919999999904',
      employment_type: 'FREELANCE', // Invalid
      password: 'Password123'
    }
  };

  await authController.signup(req, res);
  assert.equal(getStatus(), 400);
  assert.equal(getData()?.success, false);
  assert.match(getData()?.message, /FULL_TIME or PART_TIME/i);
});

test('Employee Signup: rejects signup without OTP verification (mandatory backend enforcement)', async () => {
  const { res, getStatus, getData } = mockRes();
  const req = {
    body: {
      user_name: 'Unverified Operator',
      phone: '+919999999920',
      employment_type: 'FULL_TIME',
      password: 'Password123',
      confirm_password: 'Password123',
      isMobileVerified: true // Attacker passes frontend flag without server token
    }
  };

  await authController.signup(req, res);
  assert.equal(getStatus(), 400);
  assert.equal(getData()?.success, false);
  assert.equal(getData()?.code, 'OTP_VERIFICATION_REQUIRED');
  assert.match(getData()?.message, /mobile number verification is mandatory/i);

  // Verify no user was created in DB
  const [users] = await pool.query("SELECT user_id FROM `user` WHERE phone = '+919999999920'");
  assert.equal(users.length, 0);
});

test('Mobile OTP: incorrect verification code is rejected with remaining attempt count', async () => {
  const phone = '+919999999921';

  // Send OTP
  const { res: sendRes, getStatus: getSendStatus } = mockRes();
  await authController.sendRegistrationOtp({ body: { phone } }, sendRes);
  assert.equal(getSendStatus(), 200);

  // Submit wrong OTP
  const { res: wrongRes, getStatus: getWrongStatus, getData: getWrongData } = mockRes();
  await authController.verifyRegistrationOtp({ body: { phone, otp: '000000' } }, wrongRes);
  assert.equal(getWrongStatus(), 400);
  assert.equal(getWrongData()?.success, false);
  assert.equal(getWrongData()?.code, 'INVALID_OTP');
  assert.match(getWrongData()?.message, /incorrect verification code/i);
  assert.ok(getWrongData()?.remainingAttempts > 0);
});

test('Mobile OTP: expired verification code is rejected', async () => {
  const phone = '+919999999922';

  // Send OTP
  const { res: sendRes } = mockRes();
  await authController.sendRegistrationOtp({ body: { phone } }, sendRes);
  const otp = smsService.getTestOtp(phone);

  // Manually expire the OTP in database (set expires_at to 10 seconds ago)
  await pool.query(
    "UPDATE user_otp SET expires_at = DATE_SUB(NOW(), INTERVAL 10 SECOND) WHERE phone = ?",
    [phone]
  );

  // Verify attempt
  const { res: verRes, getStatus: getVerStatus, getData: getVerData } = mockRes();
  await authController.verifyRegistrationOtp({ body: { phone, otp } }, verRes);
  assert.equal(getVerStatus(), 400);
  assert.equal(getVerData()?.success, false);
  assert.equal(getVerData()?.code, 'OTP_EXPIRED');
  assert.match(getVerData()?.message, /expired/i);
});

test('Mobile OTP: excessive verification attempts are rate-limited and locked', async () => {
  const phone = '+919999999923';

  // Send OTP
  const { res: sendRes } = mockRes();
  await authController.sendRegistrationOtp({ body: { phone } }, sendRes);

  // Attempt verification with invalid code 5 times (max_attempts = 5)
  for (let i = 0; i < 4; i++) {
    const { res, getStatus } = mockRes();
    await authController.verifyRegistrationOtp({ body: { phone, otp: '111111' } }, res);
    assert.equal(getStatus(), 400);
  }

  // 5th attempt exhausts limit
  const { res: fifthRes, getStatus: getFifthStatus, getData: getFifthData } = mockRes();
  await authController.verifyRegistrationOtp({ body: { phone, otp: '111111' } }, fifthRes);
  assert.equal(getFifthStatus(), 400);
  assert.equal(getFifthData()?.code, 'TOO_MANY_ATTEMPTS');
  assert.match(getFifthData()?.message, /maximum.*attempts/i);

  // 6th attempt is rejected because max attempts exceeded
  const { res: sixthRes, getStatus: getSixthStatus, getData: getSixthData } = mockRes();
  await authController.verifyRegistrationOtp({ body: { phone, otp: '111111' } }, sixthRes);
  assert.equal(getSixthStatus(), 400);
  assert.equal(getSixthData()?.code, 'TOO_MANY_ATTEMPTS');
});

test('SMS Service: provider failure does not dispatch code or permit registration', async () => {
  const phone = '+919999999924';
  const originalProvider = process.env.SMS_PROVIDER;

  try {
    // Set provider to NONE (unconfigured)
    process.env.SMS_PROVIDER = 'NONE';

    const { res: sendRes, getStatus: getSendStatus, getData: getSendData } = mockRes();
    await authController.sendRegistrationOtp({ body: { phone } }, sendRes);
    assert.equal(getSendStatus(), 500);
    assert.equal(getSendData()?.success, false);
    assert.equal(getSendData()?.code, 'SMS_DELIVERY_FAILURE');
    assert.match(getSendData()?.message, /SMS provider is not configured/i);

    // Signup without valid verification token must fail
    const { res: signupRes, getStatus: getSignupStatus } = mockRes();
    await authController.signup({
      body: {
        user_name: 'Failed Delivery User',
        phone,
        employment_type: 'FULL_TIME',
        password: 'Password123',
        confirm_password: 'Password123'
      }
    }, signupRes);
    assert.equal(getSignupStatus(), 400);
  } finally {
    if (originalProvider !== undefined) {
      process.env.SMS_PROVIDER = originalProvider;
    } else {
      delete process.env.SMS_PROVIDER;
    }
  }
});

test('Employee Signup: a successfully verified OTP permits registration in PENDING_APPROVAL', async () => {
  const phone = '+919999999925';
  const email = 'success-otp@test-employee.com';

  const verificationToken = await sendAndVerifyOtpForTest(phone);
  assert.ok(verificationToken);

  const { res: signupRes, getStatus: getSignupStatus, getData: getSignupData } = mockRes();
  await authController.signup({
    body: {
      user_name: 'Verified Candidate',
      phone,
      email,
      employment_type: 'FULL_TIME',
      department: 'Order Picking',
      password: 'Password123',
      confirm_password: 'Password123',
      verification_token: verificationToken
    }
  }, signupRes);

  assert.equal(getSignupStatus(), 201);
  assert.equal(getSignupData()?.success, true);
  assert.equal(getSignupData()?.data?.approval_status, 'PENDING_APPROVAL');
  assert.equal(getSignupData()?.data?.is_mobile_verified, true);
  assert.match(getSignupData()?.data?.employee_id, /^EMP-\d{4}$/);

  // Verify in database that consumed_at was stamped on user_otp
  const [otpRows] = await pool.query(
    "SELECT is_used, consumed_at FROM user_otp WHERE phone = ? ORDER BY created_at DESC LIMIT 1",
    [phone]
  );
  assert.equal(otpRows[0].is_used, 1);
  assert.ok(otpRows[0].consumed_at, 'consumed_at timestamp must be set');
});

test('Employee Signup: a verified OTP / verification challenge cannot be reused', async () => {
  const phone = '+919999999926';
  const email1 = 'first-use@test-employee.com';
  const email2 = 'second-use@test-employee.com';

  const verificationToken = await sendAndVerifyOtpForTest(phone);

  // 1. First signup succeeds
  const { res: firstRes, getStatus: getFirstStatus } = mockRes();
  await authController.signup({
    body: {
      user_name: 'First Applicant',
      phone,
      email: email1,
      employment_type: 'FULL_TIME',
      password: 'Password123',
      confirm_password: 'Password123',
      verification_token: verificationToken
    }
  }, firstRes);
  assert.equal(getFirstStatus(), 201);

  // 2. Second signup with the SAME verification challenge token must be rejected (Replay Prevention)
  const { res: secondRes, getStatus: getSecondStatus, getData: getSecondData } = mockRes();
  await authController.signup({
    body: {
      user_name: 'Second Applicant',
      phone,
      email: email2,
      employment_type: 'FULL_TIME',
      password: 'Password123',
      confirm_password: 'Password123',
      verification_token: verificationToken
    }
  }, secondRes);

  assert.equal(getSecondStatus(), 409); // Mobile number already exists, or challenge already used
  assert.equal(getSecondData()?.success, false);
});

test('Employee Signup: verified OTP for one mobile number cannot be substituted with another number', async () => {
  const phoneA = '+919999999927';
  const phoneB = '+919999999928';

  // Verify phone A
  const verificationTokenA = await sendAndVerifyOtpForTest(phoneA);

  // Attacker tries to submit registration for phone B using Phone A's verification token
  const { res: attackRes, getStatus: getAttackStatus, getData: getAttackData } = mockRes();
  await authController.signup({
    body: {
      user_name: 'Phone Switcher',
      phone: phoneB,
      email: 'switcher@test-employee.com',
      employment_type: 'FULL_TIME',
      password: 'Password123',
      confirm_password: 'Password123',
      verification_token: verificationTokenA
    }
  }, attackRes);

  assert.equal(getAttackStatus(), 400);
  assert.equal(getAttackData()?.success, false);
  assert.equal(getAttackData()?.code, 'PHONE_MISMATCH');
  assert.match(getAttackData()?.message, /does not match/i);
});

test('Employee Signup & Security: prevents privilege escalation and assigns least-privileged role in PENDING_APPROVAL', async () => {
  const phone = '+919999999905';
  const email = 'escalate@test-employee.com';

  const verificationToken = await sendAndVerifyOtpForTest(phone);

  const { res, getStatus, getData } = mockRes();
  const req = {
    body: {
      user_name: 'Sneaky Operator',
      phone,
      email,
      employment_type: 'FULL_TIME',
      department: 'Order Picking',
      password: 'Password123',
      confirm_password: 'Password123',
      verification_token: verificationToken,
      // Attacker attempts to grant themselves ADMIN or pre-approve themselves:
      role: 'ADMIN',
      staff_subrole: 'AUDITOR',
      is_active: true,
      approval_status: 'APPROVED',
      employee_id: 'EMP-9999'
    }
  };

  await authController.signup(req, res);
  assert.equal(getStatus(), 201);
  assert.equal(getData()?.success, true);
  assert.equal(getData()?.data?.approval_status, 'PENDING_APPROVAL');

  // Verify in database that privilege escalation was blocked
  const [rows] = await pool.query(
    'SELECT user_id, employee_id, role, staff_subrole, is_active, approval_status FROM `user` WHERE email = ?',
    [email]
  );
  assert.equal(rows.length, 1);
  const created = rows[0];

  assert.equal(created.role, 'STAFF', 'Role must strictly default to STAFF');
  assert.equal(created.staff_subrole, 'PICKER', 'Subrole must strictly default to PICKER');
  assert.equal(created.approval_status, 'PENDING_APPROVAL', 'Approval status must strictly be PENDING_APPROVAL');
  assert.equal(created.is_active, 0, 'New account must be inactive until manager approval');
  assert.notEqual(created.employee_id, 'EMP-9999', 'Client-supplied employee_id must be ignored');
  assert.match(created.employee_id, /^EMP-\d{4}$/, 'Must be a server-generated employee ID');
});

test('Employee Signup: rejects duplicate mobile number and email', async () => {
  const { res, getStatus, getData } = mockRes();
  const req = {
    body: {
      user_name: 'Duplicate Operator',
      phone: '+919999999905', // Already created in previous test
      email: 'unique@test-employee.com',
      employment_type: 'FULL_TIME',
      password: 'Password123'
    }
  };

  await authController.signup(req, res);
  assert.equal(getStatus(), 409);
  assert.equal(getData()?.success, false);
  assert.match(getData()?.message, /already exists/i);
});

test('Account Access Restriction: pending accounts cannot log in or access protected operations', async () => {
  const { res, getStatus, getData } = mockRes();
  const req = {
    body: {
      email: 'escalate@test-employee.com',
      password: 'Password123'
    }
  };

  await authController.login(req, res);
  assert.equal(getStatus(), 403);
  assert.equal(getData()?.success, false);
  assert.equal(getData()?.code, 'ACCOUNT_PENDING_APPROVAL');
  assert.match(getData()?.message, /pending dark store supervisor approval/i);

  // Also verify token guard rejects non-approved tokens
  const unapprovedToken = jwt.sign(
    { user_id: 999, email: 'pending@test.com', role: 'STAFF', approval_status: 'PENDING_APPROVAL' },
    getJwtSecret()
  );

  let nextCalled = false;
  const { res: authRes, getStatus: getAuthStatus, getData: getAuthData } = mockRes();
  const authReq = { headers: { authorization: `Bearer ${unapprovedToken}` } };

  await verifyToken(authReq, authRes, () => { nextCalled = true; });
  assert.equal(getAuthStatus(), 403);
  assert.equal(nextCalled, false);
  assert.equal(getAuthData()?.code, 'ACCOUNT_NOT_APPROVED');
});

test('Manager Approval Workflow: manager can view, approve, and activate pending registration', async () => {
  // 1. Get Pending Registrations
  const { res: listRes, getStatus: getListStatus, getData: getListData } = mockRes();
  await userController.getPendingRegistrations({}, listRes);
  assert.equal(getListStatus(), 200);
  assert.equal(getListData()?.success, true);
  assert.ok(Array.isArray(getListData()?.data));

  const pendingTarget = getListData()?.data.find(u => u.email === 'escalate@test-employee.com');
  assert.ok(pendingTarget, 'Pending user appears in manager pending queue');

  // 2. Approve Registration
  const { res: apprRes, getStatus: getApprStatus, getData: getApprData } = mockRes();
  const approveReq = {
    params: { id: pendingTarget.user_id },
    body: {
      store_id: 1,
      staff_subrole: 'PICKER'
    },
    user: {
      user_id: 2, // Manager User
      user_name: 'Manager User',
      role: 'STORE_MANAGER',
      store_id: 1
    }
  };

  await userController.approveRegistration(approveReq, apprRes);
  assert.equal(getApprStatus(), 200);
  assert.equal(getApprData()?.success, true);
  assert.match(getApprData()?.message, /has been approved and activated/i);

  // 3. Verify in database
  const [approvedRows] = await pool.query(
    'SELECT approval_status, is_active, store_id, approved_by, approved_at FROM `user` WHERE user_id = ?',
    [pendingTarget.user_id]
  );
  assert.equal(approvedRows[0].approval_status, 'APPROVED');
  assert.equal(approvedRows[0].is_active, 1);
  assert.equal(approvedRows[0].store_id, 1);
  assert.equal(approvedRows[0].approved_by, 2);
  assert.ok(approvedRows[0].approved_at);

  // 4. Now the approved employee can log in!
  const { res: loginRes, getStatus: getLoginStatus, getData: getLoginData } = mockRes();
  await authController.login({
    body: {
      email: 'escalate@test-employee.com',
      password: 'Password123'
    }
  }, loginRes);

  assert.equal(getLoginStatus(), 200);
  assert.equal(getLoginData()?.success, true);
  assert.ok(getLoginData()?.data?.token);
  assert.equal(getLoginData()?.data?.user?.approval_status, 'APPROVED');
});

test('Manager Rejection Workflow: supervisor can reject registration and provide reason', async () => {
  const phone = '+919999999907';
  const email = 'reject-me@test-employee.com';

  const verificationToken = await sendAndVerifyOtpForTest(phone);

  const { res: signupRes } = mockRes();
  await authController.signup({
    body: {
      user_name: 'Reject Candidate',
      phone,
      email,
      employment_type: 'PART_TIME',
      department: 'Shipping',
      password: 'Password123',
      confirm_password: 'Password123',
      verification_token: verificationToken
    }
  }, signupRes);

  const [newUser] = await pool.query('SELECT user_id FROM `user` WHERE email = ?', [email]);
  const candidateId = newUser[0].user_id;

  // Reject the application
  const { res: rejRes, getStatus: getRejStatus, getData: getRejData } = mockRes();
  const rejectReq = {
    params: { id: candidateId },
    body: {
      reason: 'No part-time shifts available at this dark store hub'
    },
    user: {
      user_id: 2,
      user_name: 'Manager User',
      role: 'STORE_MANAGER'
    }
  };

  await userController.rejectRegistration(rejectReq, rejRes);
  assert.equal(getRejStatus(), 200);
  assert.equal(getRejData()?.success, true);

  // Verify in database
  const [rejRows] = await pool.query(
    'SELECT approval_status, is_active, rejection_reason FROM `user` WHERE user_id = ?',
    [candidateId]
  );
  assert.equal(rejRows[0].approval_status, 'REJECTED');
  assert.equal(rejRows[0].is_active, 0);
  assert.match(rejRows[0].rejection_reason, /No part-time shifts/i);

  // Verify login fails with REJECTED reason
  const { res: loginRes, getStatus: getLoginStatus, getData: getLoginData } = mockRes();
  await authController.login({
    body: {
      email,
      password: 'Password123'
    }
  }, loginRes);

  assert.equal(getLoginStatus(), 403);
  assert.equal(getLoginData()?.code, 'ACCOUNT_REJECTED');
  assert.match(getLoginData()?.message, /No part-time shifts/i);
});

test('Authorization Guard: unauthorised staff users cannot approve accounts', async () => {
  const { res, getStatus, getData } = mockRes();
  let nextCalled = false;
  const req = {
    user: {
      user_id: 3,
      user_name: 'Picker User',
      role: 'STAFF' // Non-manager staff
    }
  };

  isManagerOrAdmin(req, res, () => { nextCalled = true; });

  assert.equal(getStatus(), 403);
  assert.equal(nextCalled, false);
  assert.equal(getData()?.success, false);
  assert.match(getData()?.message, /access denied/i);
});

test('Existing User Login Compatibility: Admin, Manager, and Picker continue to log in seamlessly', async () => {
  const accounts = [
    { email: 'admin@example.com', role: 'ADMIN' },
    { email: 'manager@example.com', role: 'STORE_MANAGER' },
    { email: 'picker@example.com', role: 'STAFF' }
  ];

  for (const acc of accounts) {
    const { res, getStatus, getData } = mockRes();
    await authController.login({
      body: {
        email: acc.email,
        password: 'password123'
      }
    }, res);

    assert.equal(getStatus(), 200, `Login must succeed for ${acc.email}`);
    assert.equal(getData()?.success, true);
    assert.equal(getData()?.data?.user?.role, acc.role);
    assert.equal(getData()?.data?.user?.approval_status, 'APPROVED');
    assert.ok(getData()?.data?.user?.employee_id);
  }
});

test('Security: production mode strictly disallows mock/console SMS provider bypass', async () => {
  const originalEnv = process.env.NODE_ENV;
  const originalProvider = process.env.SMS_PROVIDER;

  try {
    process.env.NODE_ENV = 'production';
    process.env.SMS_PROVIDER = 'CONSOLE';

    await assert.rejects(
      async () => {
        await smsService.sendOtp('+919999999999', '123456');
      },
      /Development\/Mock SMS provider is strictly prohibited in production mode/
    );

    process.env.SMS_PROVIDER = 'MOCK';
    await assert.rejects(
      async () => {
        await smsService.sendOtp('+919999999999', '123456');
      },
      /Development\/Mock SMS provider is strictly prohibited in production mode/
    );

    // Verify test OTP hook is blocked in production mode
    assert.equal(smsService.getTestOtp('+919999999999'), null);
  } finally {
    process.env.NODE_ENV = originalEnv;
    if (originalProvider !== undefined) {
      process.env.SMS_PROVIDER = originalProvider;
    } else {
      delete process.env.SMS_PROVIDER;
    }
  }
});
