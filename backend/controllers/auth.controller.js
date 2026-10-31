const crypto = require('crypto');
const pool = require('../config/db.config');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/security.config');
const smsService = require('../services/sms.service');

/**
 * Validates mobile number format.
 * Accepts standard 10-digit formats (e.g. 9876543210) or international E.164 formats (+919876543210).
 */
function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * Validates password complexity.
 * Requires minimum 8 characters, at least one letter, and at least one number.
 */
function isStrongPassword(password) {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 8) return false;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  return hasLetter && hasDigit;
}

/**
 * Generates next unique sequential Employee ID (e.g. EMP-1008).
 */
async function generateEmployeeId(connection = pool) {
  const [rows] = await connection.query(
    "SELECT employee_id, user_id FROM `user` WHERE employee_id LIKE 'EMP-%' ORDER BY user_id DESC LIMIT 1"
  );
  if (rows.length > 0 && rows[0].employee_id) {
    const numPart = parseInt(rows[0].employee_id.replace('EMP-', ''), 10);
    if (!isNaN(numPart)) {
      return `EMP-${String(numPart + 1).padStart(4, '0')}`;
    }
  }
  const [maxUser] = await connection.query("SELECT MAX(user_id) AS maxId FROM `user`");
  const nextId = (maxUser[0]?.maxId || 0) + 1;
  return `EMP-${String(nextId).padStart(4, '0')}`;
}

/**
 * Sends a 6-digit OTP code to the requested mobile number for registration verification.
 */
exports.sendRegistrationOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || !isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: 'A valid 10 to 15 digit mobile number is required.'
      });
    }

    const cleanPhone = phone.trim();

    // Check if phone number is already registered to an approved active employee
    const [existing] = await pool.query(
      "SELECT user_id, approval_status FROM `user` WHERE phone = ? AND approval_status = 'APPROVED'",
      [cleanPhone]
    );
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'This mobile number is already registered to an active employee account.'
      });
    }

    // Cooldown check: if an active unexpired OTP was requested in the last 45 seconds, enforce wait
    const [recent] = await pool.query(
      `SELECT otp_id, created_at FROM user_otp 
       WHERE phone = ? AND purpose = 'REGISTRATION' AND is_used = FALSE AND expires_at > NOW() 
       ORDER BY created_at DESC LIMIT 1`,
      [cleanPhone]
    );
    if (recent.length > 0) {
      const elapsedMs = Date.now() - new Date(recent[0].created_at).getTime();
      if (elapsedMs < 45000) {
        const remainingSec = Math.ceil((45000 - elapsedMs) / 1000);
        return res.status(429).json({
          success: false,
          code: 'RATE_LIMIT_COOLDOWN',
          message: `Please wait ${remainingSec} second${remainingSec > 1 ? 's' : ''} before requesting another verification code.`,
          retryAfter: remainingSec
        });
      }
    }

    // Invalidate any previous unverified registration OTPs for this phone
    await pool.query(
      "UPDATE user_otp SET is_used = TRUE WHERE phone = ? AND purpose = 'REGISTRATION' AND is_used = FALSE",
      [cleanPhone]
    );

    const otp = smsService.generateOtp();
    const otpHash = smsService.hashOtp(otp, cleanPhone);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

    // Save hashed OTP in database
    await pool.query(
      `INSERT INTO user_otp (phone, otp_hash, purpose, expires_at)
       VALUES (?, ?, 'REGISTRATION', ?)`,
      [cleanPhone, otpHash, expiresAt]
    );

    // Send via SMS service - fail safely if provider credentials missing or delivery fails
    let smsResult;
    try {
      smsResult = await smsService.sendOtp(cleanPhone, otp);
    } catch (smsErr) {
      console.error('SMS delivery failure in sendRegistrationOtp:', smsErr.message);
      return res.status(500).json({
        success: false,
        code: 'SMS_DELIVERY_FAILURE',
        message: smsErr.message || 'Failed to dispatch verification code via SMS.'
      });
    }

    res.json({
      success: true,
      message: 'Verification code sent successfully to your mobile number.',
      expiresInSeconds: 300,
      provider: smsResult.provider,
      mock: smsResult.mock || false
    });
  } catch (error) {
    console.error('Error in sendRegistrationOtp:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to dispatch verification code.'
    });
  }
};

/**
 * Verifies the 6-digit OTP entered by the employee.
 */
exports.verifyRegistrationOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_FIELDS',
        message: 'Both mobile number and verification code are required.'
      });
    }

    const cleanPhone = phone.trim();
    const cleanOtp = String(otp).trim();

    // Fetch the most recent, unexpired, unused OTP record for this phone
    const [records] = await pool.query(
      `SELECT * FROM user_otp 
       WHERE phone = ? AND purpose = 'REGISTRATION' AND is_used = FALSE AND expires_at > NOW() 
       ORDER BY created_at DESC LIMIT 1`,
      [cleanPhone]
    );

    if (records.length === 0) {
      // Check if an expired OTP exists for precise feedback
      const [expiredRecords] = await pool.query(
        `SELECT * FROM user_otp 
         WHERE phone = ? AND purpose = 'REGISTRATION' AND is_used = FALSE 
         ORDER BY created_at DESC LIMIT 1`,
        [cleanPhone]
      );
      if (expiredRecords.length > 0 && new Date(expiredRecords[0].expires_at) <= new Date()) {
        return res.status(400).json({
          success: false,
          code: 'OTP_EXPIRED',
          message: 'Verification code has expired. Please request a new code.'
        });
      }
      return res.status(400).json({
        success: false,
        code: 'OTP_NOT_FOUND',
        message: 'Verification code has expired or was not requested. Please request a new code.'
      });
    }

    const record = records[0];

    // Check maximum attempts
    if (record.attempts >= record.max_attempts) {
      return res.status(400).json({
        success: false,
        code: 'TOO_MANY_ATTEMPTS',
        message: 'Maximum verification attempts exceeded. Please request a new verification code.'
      });
    }

    // Verify hash safely
    const isMatch = smsService.verifyOtpHash(cleanOtp, cleanPhone, record.otp_hash);

    if (!isMatch) {
      const remaining = record.max_attempts - record.attempts - 1;
      await pool.query(
        'UPDATE user_otp SET attempts = attempts + 1 WHERE otp_id = ?',
        [record.otp_id]
      );

      if (remaining <= 0) {
        return res.status(400).json({
          success: false,
          code: 'TOO_MANY_ATTEMPTS',
          message: 'Incorrect code. Maximum attempts reached. Please request a new code.'
        });
      }

      return res.status(400).json({
        success: false,
        code: 'INVALID_OTP',
        message: `Incorrect verification code. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`,
        remainingAttempts: remaining
      });
    }

    // Mark as used
    await pool.query(
      'UPDATE user_otp SET is_used = TRUE WHERE otp_id = ?',
      [record.otp_id]
    );

    // Generate securely signed, short-lived verification challenge token (15 mins)
    const verificationToken = jwt.sign(
      {
        phone: cleanPhone,
        otp_id: record.otp_id,
        purpose: 'REGISTRATION_CHALLENGE',
        jti: crypto.randomBytes(16).toString('hex')
      },
      getJwtSecret(),
      { expiresIn: '15m' }
    );

    res.json({
      success: true,
      verified: true,
      verification_token: verificationToken,
      phone: cleanPhone,
      message: 'Mobile number verified successfully.'
    });
  } catch (error) {
    console.error('Error in verifyRegistrationOtp:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Error during code verification.'
    });
  }
};

/**
 * Public Employee Registration Endpoint
 * Creates account in 'PENDING_APPROVAL' state with least-privileged role 'STAFF' / 'PICKER'.
 * Public callers can NEVER escalate permissions or activate accounts.
 * Mobile OTP verification is strictly mandatory on the backend.
 */
exports.signup = async (req, res) => {
  try {
    const {
      user_name,
      phone,
      email,
      employment_type,
      department,
      password,
      confirm_password,
      verification_token
    } = req.body;

    // 1. Validate required fields
    if (!user_name || typeof user_name !== 'string' || user_name.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Full name is required (minimum 2 characters).' });
    }

    if (!phone || !isValidPhone(phone)) {
      return res.status(400).json({ success: false, message: 'A valid mobile number (10-15 digits) is required.' });
    }

    if (!employment_type || !['FULL_TIME', 'PART_TIME'].includes(employment_type.toUpperCase())) {
      return res.status(400).json({ success: false, message: 'Employment type must be FULL_TIME or PART_TIME.' });
    }

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required.' });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long and contain both letters and numbers.'
      });
    }

    if (confirm_password && password !== confirm_password) {
      return res.status(400).json({ success: false, message: 'Password and Confirm Password do not match.' });
    }

    // Optional email validation
    const cleanEmail = email && typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;
    if (cleanEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
      }
    }

    const cleanPhone = phone.trim();
    const cleanName = user_name.trim();
    const cleanDept = department && department.trim() ? department.trim() : 'Warehouse Operations';
    const cleanEmpType = employment_type.toUpperCase();

    // 2. Prevent duplicate accounts (Check email and phone)
    if (cleanEmail) {
      const [emailExists] = await pool.query('SELECT user_id FROM `user` WHERE email = ?', [cleanEmail]);
      if (emailExists.length > 0) {
        return res.status(409).json({ success: false, message: 'An account with this email address already exists.' });
      }
    }

    const [phoneExists] = await pool.query('SELECT user_id FROM `user` WHERE phone = ?', [cleanPhone]);
    if (phoneExists.length > 0) {
      return res.status(409).json({ success: false, message: 'An account with this mobile number already exists.' });
    }

    // 3. Mandatory Server-Side OTP Enforcement
    // Never trust frontend booleans (e.g. isMobileVerified=true)
    if (!verification_token || typeof verification_token !== 'string') {
      return res.status(400).json({
        success: false,
        code: 'OTP_VERIFICATION_REQUIRED',
        message: 'Mobile number verification is mandatory. Please verify your mobile number via OTP before completing registration.'
      });
    }

    let challenge;
    try {
      challenge = jwt.verify(verification_token, getJwtSecret());
    } catch (tokenErr) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_VERIFICATION_TOKEN',
        message: 'Mobile verification session has expired or is invalid. Please verify your mobile number again.'
      });
    }

    if (challenge.purpose !== 'REGISTRATION_CHALLENGE') {
      return res.status(400).json({
        success: false,
        code: 'INVALID_CHALLENGE',
        message: 'Invalid verification token challenge purpose.'
      });
    }

    // Bind verification strictly to the exact mobile number being registered
    // Prevents an OTP verified for one phone from being used to register another number
    if (challenge.phone !== cleanPhone) {
      return res.status(400).json({
        success: false,
        code: 'PHONE_MISMATCH',
        message: 'Verified mobile number does not match the registration mobile number.'
      });
    }

    // Invalidate / consume the verification challenge in the database
    // Prevents OTP replay and repeated registration using the same verification challenge
    const [consumeResult] = await pool.query(
      `UPDATE user_otp 
       SET consumed_at = CURRENT_TIMESTAMP 
       WHERE otp_id = ? AND phone = ? AND is_used = TRUE AND consumed_at IS NULL`,
      [challenge.otp_id, cleanPhone]
    );

    if (consumeResult.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        code: 'CHALLENGE_ALREADY_USED',
        message: 'This mobile verification challenge has already been used or has expired. Please request a new verification code.'
      });
    }

    const isMobileVerified = true;
    const mobileVerifiedAt = new Date();

    // 4. Hash password with bcrypt
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 5. Generate server-side Employee ID (never trust user input)
    const employeeId = await generateEmployeeId(pool);

    // 6. Enforce least-privileged role & pending approval lifecycle
    // Public signup is ALWAYS role 'STAFF', staff_subrole 'PICKER', is_active FALSE, approval_status 'PENDING_APPROVAL'
    const fallbackEmail = cleanEmail || `${cleanPhone}@quickstock.internal`;

    const [result] = await pool.query(
      `INSERT INTO \`user\` (
        user_name, employee_id, email, phone, password_hash,
        role, staff_subrole, employment_type, department,
        store_id, is_active, approval_status, is_mobile_verified, mobile_verified_at
      ) VALUES (?, ?, ?, ?, ?, 'STAFF', 'PICKER', ?, ?, NULL, FALSE, 'PENDING_APPROVAL', ?, ?)`,
      [
        cleanName,
        employeeId,
        fallbackEmail,
        cleanPhone,
        passwordHash,
        cleanEmpType,
        cleanDept,
        isMobileVerified,
        mobileVerifiedAt
      ]
    );

    const newUserId = result.insertId;

    // 7. Audit log the registration event
    try {
      await pool.query(
        `INSERT INTO audit_log (user_id, action, table_name, record_id, details)
         VALUES (?, 'INSERT', 'user', ?, ?)`,
        [
          newUserId,
          newUserId,
          `Public employee signup submitted: ${cleanName} (${employeeId}, ${cleanEmpType}, ${cleanDept}). Mobile verified via OTP. Pending manager review.`
        ]
      );
    } catch (auditErr) {
      console.warn('Audit logging error on signup:', auditErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Registration submitted successfully. Your account is pending manager approval.',
      data: {
        user_id: newUserId,
        employee_id: employeeId,
        user_name: cleanName,
        phone: cleanPhone,
        employment_type: cleanEmpType,
        department: cleanDept,
        approval_status: 'PENDING_APPROVAL',
        is_mobile_verified: isMobileVerified
      }
    });
  } catch (error) {
    console.error('Error in signup:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'An account with this email or mobile number already exists.' });
    }
    res.status(500).json({ success: false, message: error.message || 'Server error during registration.' });
  }
};

/**
 * Terminal Operator Login
 * Enforces approval status: rejects PENDING_APPROVAL and REJECTED accounts.
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email or mobile number and password are required' });
    }

    const identifier = String(email).trim();

    // Allow login with either Email or Phone number
    const [rows] = await pool.query(
      'SELECT * FROM `user` WHERE email = ? OR phone = ? LIMIT 1',
      [identifier, identifier]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid operator credentials' });
    }

    const user = rows[0];

    // Enforce Approval Lifecycle & Security Checks
    if (user.approval_status === 'PENDING_APPROVAL') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_PENDING_APPROVAL',
        message: 'Your registration is currently pending dark store supervisor approval. You will receive an SMS when your account is activated.'
      });
    }

    if (user.approval_status === 'REJECTED') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_REJECTED',
        message: user.rejection_reason 
          ? `Your registration was not approved. Reason: ${user.rejection_reason}`
          : 'Your operator registration was not approved. Please contact dark store HR.'
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_INACTIVE',
        message: 'This operator account has been deactivated. Please contact an administrator.'
      });
    }

    // Verify Password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid operator credentials' });
    }

    // Check if employee has an active temporary operational allocation
    let activeAssignment = null;
    let allocationId = null;
    if (user.role === 'STAFF') {
      const [allocRows] = await pool.query(
        "SELECT allocation_id, assigned_role FROM staff_allocation WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1",
        [user.user_id]
      );
      if (allocRows.length > 0) {
        activeAssignment = allocRows[0].assigned_role;
        allocationId = allocRows[0].allocation_id;
      }
    }

    const tokenPayload = {
      user_id: user.user_id,
      employee_id: user.employee_id,
      user_name: user.user_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      staff_subrole: user.staff_subrole,
      store_id: user.store_id,
      approval_status: user.approval_status
    };

    const token = jwt.sign(
      tokenPayload,
      getJwtSecret(),
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          user_id: user.user_id,
          employee_id: user.employee_id,
          user_name: user.user_name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          staff_subrole: user.staff_subrole,
          employment_type: user.employment_type,
          department: user.department,
          store_id: user.store_id,
          approval_status: user.approval_status,
          active_assignment: activeAssignment,
          allocation_id: allocationId
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Returns current authenticated user profile
 */
exports.me = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT user_id, employee_id, user_name, email, phone, role, staff_subrole, 
              employment_type, department, store_id, is_active, approval_status, is_mobile_verified 
       FROM \`user\` 
       WHERE user_id = ? AND is_active = TRUE`,
      [req.user.user_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = rows[0];
    let activeAssignment = null;
    let allocationId = null;
    if (user.role === 'STAFF') {
      const [allocRows] = await pool.query(
        "SELECT allocation_id, assigned_role FROM staff_allocation WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1",
        [user.user_id]
      );
      if (allocRows.length > 0) {
        activeAssignment = allocRows[0].assigned_role;
        allocationId = allocRows[0].allocation_id;
      }
    }

    res.json({
      success: true,
      data: {
        user: {
          ...user,
          active_assignment: activeAssignment,
          allocation_id: allocationId
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
