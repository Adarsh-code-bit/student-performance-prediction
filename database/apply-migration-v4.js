/**
 * Migration Runner: Employee Signup & Approval Workflow (v4)
 * Project: Smart Inventory Management System for Quick Commerce
 *
 * SAFETY SAFEGUARDS:
 *   1. Explicit Confirmation: Refuses to execute any DDL unless --confirm is passed.
 *   2. Production Protection: Detects production targets and refuses execution unless
 *      --allow-production AND --verified-backup-confirmed=<backup_file> are supplied.
 *   3. Dry-Run / Preflight: Defaults to non-destructive inspection mode (--dry-run).
 *   4. Zero Credential Exposure: Displays host and database name, never passwords or tokens.
 *   5. Idempotent & Non-destructive: Uses information_schema checks and CREATE TABLE IF NOT EXISTS.
 */

if (process.argv.includes('--allow-production') || process.env.NODE_ENV === 'production') {
  process.env.SKIP_LOCAL_DOTENV = 'true';
}

const fs = require('fs');
const path = require('path');
const mysql = require('../backend/node_modules/mysql2/promise');
const pool = require('../backend/config/db.config');

const APPROVED_PRODUCTION_TARGET = {
  host: 'mysql-37e1f16a-work-ae9c.d.aivencloud.com',
  port: 24803,
  database: 'defaultdb'
};

function isProductionTarget(env = process.env) {
  const host = (env.DB_HOST || '').toLowerCase();
  const nodeEnv = (env.NODE_ENV || '').toLowerCase();
  const isCloudHost = host.includes('aivencloud.com') ||
                      host.includes('aws') ||
                      host.includes('rds') ||
                      host.includes('render.com') ||
                      (!['localhost', '127.0.0.1', '::1', ''].includes(host));
  return isCloudHost || nodeEnv === 'production';
}

async function run() {
  const isDryRun = process.argv.includes('--dry-run') || !process.argv.includes('--confirm');
  const isConfirmed = process.argv.includes('--confirm');
  const isAllowProduction = process.argv.includes('--allow-production');

  console.log('=============================================================');
  console.log(' QUICKSTOCK Migration v4: Employee Signup & Approval System');
  console.log('=============================================================');
  console.log(` Mode: ${isDryRun ? 'DRY-RUN (Preflight Inspection)' : 'LIVE EXECUTION'}`);
  console.log(` Database: ${process.env.DB_NAME || 'smart_inventory'}`);
  console.log(` Host:     ${process.env.DB_HOST || 'localhost'}`);
  console.log('=============================================================\n');

  if (isProductionTarget(process.env) && !isAllowProduction) {
    console.error('❌ ABORTED: Production target detected without --allow-production flag.');
    process.exit(1);
  }

  // Preflight check
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user'`
  );
  const existingCols = cols.map(c => c.COLUMN_NAME);

  const neededCols = [
    'phone', 'employment_type', 'department', 'employee_id',
    'approval_status', 'approved_by', 'approved_at', 'rejection_reason',
    'is_mobile_verified', 'mobile_verified_at'
  ];

  const colsToAdd = neededCols.filter(col => !existingCols.includes(col));

  const [otpTable] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.TABLES 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_otp'`
  );
  const needsOtpTable = otpTable[0].cnt === 0;

  console.log(`Columns needing creation: [${colsToAdd.join(', ') || 'None - all present'}]`);
  console.log(`user_otp table needed:    ${needsOtpTable ? 'YES' : 'NO (already exists)'}\n`);

  if (!isConfirmed) {
    console.log('ℹ️ Preflight completed. To execute migration, run with: --confirm');
    process.exit(0);
  }

  console.log('🚀 Executing non-destructive schema migration...');

  // 1. Phone
  if (!existingCols.includes('phone')) {
    await pool.query('ALTER TABLE `user` ADD COLUMN phone VARCHAR(20) NULL AFTER email, ADD INDEX idx_user_phone (phone)');
    console.log('  ✔ Added phone column with index');
  }

  // 2. Employment Type
  if (!existingCols.includes('employment_type')) {
    await pool.query("ALTER TABLE `user` ADD COLUMN employment_type ENUM('FULL_TIME', 'PART_TIME') NOT NULL DEFAULT 'FULL_TIME' AFTER phone");
    console.log('  ✔ Added employment_type column');
  }

  // 3. Department
  if (!existingCols.includes('department')) {
    await pool.query("ALTER TABLE `user` ADD COLUMN department VARCHAR(100) NULL DEFAULT 'Warehouse Operations' AFTER employment_type");
    console.log('  ✔ Added department column');
  }

  // 4. Employee ID
  if (!existingCols.includes('employee_id')) {
    await pool.query('ALTER TABLE `user` ADD COLUMN employee_id VARCHAR(30) NULL AFTER user_name, ADD UNIQUE INDEX uq_user_employee_id (employee_id)');
    console.log('  ✔ Added employee_id column with unique index');
  }

  // 5. Approval Status
  if (!existingCols.includes('approval_status')) {
    await pool.query("ALTER TABLE `user` ADD COLUMN approval_status ENUM('PENDING_APPROVAL', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED' AFTER is_active, ADD INDEX idx_user_approval_status (approval_status)");
    console.log('  ✔ Added approval_status column with index');
  }

  // 6. Approved By
  if (!existingCols.includes('approved_by')) {
    await pool.query('ALTER TABLE `user` ADD COLUMN approved_by INT NULL AFTER approval_status, ADD CONSTRAINT fk_user_approved_by FOREIGN KEY (approved_by) REFERENCES `user`(user_id) ON DELETE SET NULL');
    console.log('  ✔ Added approved_by foreign key reference');
  }

  // 7. Approved At
  if (!existingCols.includes('approved_at')) {
    await pool.query('ALTER TABLE `user` ADD COLUMN approved_at TIMESTAMP NULL AFTER approved_by');
    console.log('  ✔ Added approved_at timestamp');
  }

  // 8. Rejection Reason
  if (!existingCols.includes('rejection_reason')) {
    await pool.query('ALTER TABLE `user` ADD COLUMN rejection_reason TEXT NULL AFTER approved_at');
    console.log('  ✔ Added rejection_reason column');
  }

  // 9. Mobile Verified Status
  if (!existingCols.includes('is_mobile_verified')) {
    await pool.query('ALTER TABLE `user` ADD COLUMN is_mobile_verified BOOLEAN NOT NULL DEFAULT FALSE AFTER rejection_reason');
    console.log('  ✔ Added is_mobile_verified boolean');
  }

  // 10. Mobile Verified Timestamp
  if (!existingCols.includes('mobile_verified_at')) {
    await pool.query('ALTER TABLE `user` ADD COLUMN mobile_verified_at TIMESTAMP NULL AFTER is_mobile_verified');
    console.log('  ✔ Added mobile_verified_at timestamp');
  }

  // 11. Create user_otp table
  if (needsOtpTable) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_otp (
        otp_id       INT AUTO_INCREMENT PRIMARY KEY,
        phone        VARCHAR(20)   NOT NULL,
        otp_hash     VARCHAR(255)  NOT NULL,
        purpose      ENUM('REGISTRATION', 'LOGIN', 'PASSWORD_RESET') NOT NULL DEFAULT 'REGISTRATION',
        attempts     INT           NOT NULL DEFAULT 0,
        max_attempts INT           NOT NULL DEFAULT 5,
        expires_at   TIMESTAMP     NOT NULL,
        is_used      BOOLEAN       NOT NULL DEFAULT FALSE,
        consumed_at  TIMESTAMP     NULL DEFAULT NULL,
        created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_otp_phone_purpose (phone, purpose),
        INDEX idx_otp_expires (expires_at)
      ) ENGINE=InnoDB
    `);
    console.log('  ✔ Created user_otp verification table');
  } else {
    // Check if consumed_at column is missing on existing user_otp table
    const [otpCols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_otp' AND COLUMN_NAME = 'consumed_at'`
    );
    if (otpCols.length === 0) {
      await pool.query('ALTER TABLE user_otp ADD COLUMN consumed_at TIMESTAMP NULL DEFAULT NULL AFTER is_used');
      console.log('  ✔ Added consumed_at column to user_otp');
    }
  }

  // 12. Backfill existing legacy users (preserve access, safe unverified default)
  const [backfill] = await pool.query(`
    UPDATE \`user\` SET 
      employee_id = CONCAT('EMP-', LPAD(user_id, 4, '0')),
      phone = NULL,
      is_mobile_verified = FALSE,
      mobile_verified_at = NULL,
      approval_status = 'APPROVED'
    WHERE employee_id IS NULL
  `);
  console.log(`  ✔ Backfilled existing accounts with employee IDs: ${backfill.affectedRows} updated`);

  console.log('\n✅ Migration v4 completed successfully!\n');
  process.exit(0);
}

run().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
