/**
 * Migration Runner: Picker Location Guidance & Manager Activity Tracking (v3)
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

// Prevent local backend/.env from contaminating production runs
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

/**
 * Checks if the configured database target appears to be a production environment.
 */
function isProductionTarget(env = process.env) {
  const host = (env.DB_HOST || '').toLowerCase();
  const nodeEnv = (env.NODE_ENV || '').toLowerCase();

  const isCloudHost = host.includes('aivencloud.com') ||
                      host.includes('aws') ||
                      host.includes('rds') ||
                      host.includes('render.com') ||
                      host.includes('azure') ||
                      host.includes('digitalocean') ||
                      (!['localhost', '127.0.0.1', '::1', ''].includes(host));

  const isProdEnv = nodeEnv === 'production';
  return isCloudHost || isProdEnv;
}

/**
 * Validates the database target configuration.
 * Enforces that when production is authorized via --allow-production,
 * the target strictly matches the approved Aiven production target
 * and never falls back to local configuration.
 */
function validateTargetConfig(env = process.env, isAllowProduction = false) {
  const host = (env.DB_HOST || '').trim().toLowerCase();
  const rawPort = env.DB_PORT !== undefined && env.DB_PORT !== null ? String(env.DB_PORT).trim() : '';
  const port = rawPort ? Number(rawPort) : (isAllowProduction ? APPROVED_PRODUCTION_TARGET.port : 3306);
  const dbName = (env.DB_NAME || '').trim().toLowerCase();

  const isLocalHost = ['localhost', '127.0.0.1', '::1', ''].includes(host);
  const isLocalDb = dbName === 'smart_inventory';

  if (isAllowProduction) {
    // 1. Fail closed if --allow-production is passed with a local target
    if (isLocalHost || isLocalDb) {
      throw new Error(
        `Target mismatch: --allow-production was specified, but target resolved to local configuration ` +
        `(host: '${host || 'localhost'}', database: '${dbName || 'smart_inventory'}'). ` +
        `Production execution cannot fall back to local development.`
      );
    }

    // 2. Exact match against approved production host
    if (host !== APPROVED_PRODUCTION_TARGET.host.toLowerCase()) {
      throw new Error(
        `Target mismatch: Unapproved production host '${host}'. ` +
        `Production target host must be '${APPROVED_PRODUCTION_TARGET.host}'.`
      );
    }

    // 3. Exact match against approved production port
    if (port !== APPROVED_PRODUCTION_TARGET.port) {
      throw new Error(
        `Target mismatch: Unapproved production port '${port}'. ` +
        `Production target port must be '${APPROVED_PRODUCTION_TARGET.port}'.`
      );
    }

    // 4. Exact match against approved production database
    if (dbName && dbName !== APPROVED_PRODUCTION_TARGET.database.toLowerCase()) {
      throw new Error(
        `Target mismatch: Unapproved production database '${dbName}'. ` +
        `Production target database must be '${APPROVED_PRODUCTION_TARGET.database}'.`
      );
    }
  }

  const isCloudHost = host.includes('aivencloud.com') ||
                      host.includes('aws') ||
                      host.includes('rds') ||
                      host.includes('render.com') ||
                      host.includes('azure') ||
                      host.includes('digitalocean') ||
                      (!isLocalHost);

  const isProdEnv = (env.NODE_ENV || '').toLowerCase() === 'production';
  const isProd = isCloudHost || isProdEnv;

  return {
    isProd,
    host: host || 'localhost',
    port: port || 3306,
    database: dbName || (isAllowProduction ? APPROVED_PRODUCTION_TARGET.database : 'smart_inventory')
  };
}

/**
 * Validates required credentials and TLS configuration for production targets.
 */
function validateProductionCredentials(env = process.env) {
  if (!env.DB_USER || !env.DB_USER.trim()) {
    throw new Error('Refusing production execution: DB_USER is required for production database target.');
  }
  if (!env.DB_PASSWORD || !env.DB_PASSWORD.trim()) {
    throw new Error('Refusing production execution: DB_PASSWORD is required for production database target.');
  }
  if (env.DB_SSL !== 'true') {
    throw new Error('Refusing production execution: DB_SSL must be set to "true" for production database target.');
  }
  if (env.DB_SSL_REJECT_UNAUTHORIZED === 'false') {
    throw new Error('Refusing production execution: Strict TLS verification (DB_SSL_REJECT_UNAUTHORIZED !== "false") is required.');
  }
  const caInput = env.DB_SSL_CA || env.DB_SSL_CA_PATH;
  if (!caInput || !caInput.trim()) {
    throw new Error('Refusing production execution: CA certificate (DB_SSL_CA or DB_SSL_CA_PATH) is required for production database target.');
  }
  if (env.DB_SSL_CA_PATH && !env.DB_SSL_CA) {
    const resolvedPath = path.resolve(env.DB_SSL_CA_PATH.trim());
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Refusing production execution: CA certificate file not found at path: ${env.DB_SSL_CA_PATH.trim()}`);
    }
  }
}

/**
 * Validates the backup confirmation argument.
 * Verifies local file existence and non-zero size if a file path is provided,
 * while clearly distinguishing file presence from logical validity/restorability.
 */
function validateBackupConfirmation(backupConfirmed) {
  if (!backupConfirmed || typeof backupConfirmed !== 'string' || !backupConfirmed.trim()) {
    throw new Error('Refusing migration: Production migration requires verified backup confirmation via --verified-backup-confirmed=<backup_file_or_id>.');
  }

  const trimmed = backupConfirmed.trim();

  // Determine if input is or references a local filesystem path
  const isFilePath = trimmed.includes('/') || trimmed.includes('\\') || 
                     /\.(sql|dump|bak|tar|gz)$/i.test(trimmed) || 
                     fs.existsSync(trimmed);

  let fileVerification = null;

  if (isFilePath) {
    const resolvedPath = path.resolve(trimmed);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Refusing migration: Specified backup file does not exist at path: ${trimmed}`);
    }

    const stats = fs.statSync(resolvedPath);
    if (stats.isDirectory()) {
      throw new Error(`Refusing migration: Specified backup path is a directory, not a valid backup file: ${trimmed}`);
    }

    if (stats.size === 0) {
      throw new Error(`Refusing migration: Specified backup file is empty (0 bytes): ${trimmed}`);
    }

    fileVerification = {
      path: resolvedPath,
      sizeBytes: stats.size,
      fileVerified: true,
      note: 'Local backup file presence confirmed on disk. NOTE: This confirms file presence and non-zero size only; it does NOT constitute proof of logical backup validity, data completeness, or restorability.'
    };
  }

  return {
    backupConfirmed: trimmed,
    fileVerification
  };
}

/**
 * Validates CLI arguments and safety requirements before any migration execution.
 */
function validateSafetyFlags(argv = process.argv, env = process.env) {
  const isConfirm = argv.includes('--confirm');
  const isDryRun = argv.includes('--dry-run') || !isConfirm;
  const isAllowProduction = argv.includes('--allow-production');
  const backupFlag = argv.find(arg => arg.startsWith('--verified-backup-confirmed='));
  const rawBackupConfirmed = backupFlag ? backupFlag.split('=')[1]?.trim() : null;

  // Validate target configuration before any connection creation
  const targetConfig = validateTargetConfig(env, isAllowProduction);
  const isProd = targetConfig.isProd;

  if (isDryRun) {
    return { canExecute: false, isDryRun: true, isProd, targetConfig };
  }

  // Refuse execution without explicit --confirm
  if (!isConfirm) {
    throw new Error('Refusing migration: Execution requires the explicit --confirm flag.');
  }

  // If target is production, require explicit authorization and verified backup
  let backupValidation = null;
  if (isProd) {
    if (!isAllowProduction) {
      throw new Error('Refusing migration: Target is a PRODUCTION database. Explicit authorization required via --allow-production.');
    }
    backupValidation = validateBackupConfirmation(rawBackupConfirmed);
    validateProductionCredentials(env);
  }

  return { 
    canExecute: true, 
    isDryRun: false, 
    isProd, 
    backupConfirmed: backupValidation ? backupValidation.backupConfirmed : rawBackupConfirmed,
    fileVerification: backupValidation ? backupValidation.fileVerification : null,
    targetConfig
  };
}

/**
 * Runs preflight inspection or executes migration v3 based on validated flags.
 */
async function runMigration(options = {}) {
  const env = options.env || process.env;
  const argv = options.argv || process.argv;

  // 1. Establish and validate intended target before loading database pool or connecting
  const safety = validateSafetyFlags(argv, env);
  const { canExecute, isDryRun, isProd, backupConfirmed, fileVerification, targetConfig } = safety;

  const targetHost = targetConfig.host;
  const targetPort = targetConfig.port;
  const targetDb = targetConfig.database;

  console.log(`================================================================`);
  console.log(`MIGRATION v3 PREFLIGHT & RUNNER`);
  console.log(`Target Host:     ${targetHost}:${targetPort}`);
  console.log(`Target Database: ${targetDb}`);
  console.log(`Environment:     ${isProd ? 'PRODUCTION' : 'LOCAL / DEVELOPMENT'}`);
  console.log(`Execution Mode:  ${isDryRun ? 'DRY RUN (READ-ONLY AUDIT)' : 'EXECUTE (APPLY DDL)'}`);
  if (backupConfirmed) {
    console.log(`Backup Confirmed Ref: ${backupConfirmed}`);
    if (fileVerification) {
      console.log(`Backup File Check:    ${fileVerification.path} (${fileVerification.sizeBytes} bytes)`);
      console.log(`Verification Scope:   ${fileVerification.note}`);
    }
  }
  console.log(`================================================================`);

  // Dynamically build pool from validated target env, or use injected test pool
  const dbPool = options.pool || (pool.buildPoolConfig ? mysql.createPool(pool.buildPoolConfig(env)) : pool);
  const conn = await dbPool.getConnection();

  try {
    // 1. Inspect location columns
    const [locCols] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'location'`
    );
    const locColNames = locCols.map(c => c.COLUMN_NAME);

    const missingLocCols = ['aisle', 'shelf', 'bin'].filter(c => !locColNames.includes(c));

    // 2. Inspect orders columns
    const [ordCols] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'`
    );
    const ordColNames = ordCols.map(c => c.COLUMN_NAME);

    const missingOrdCols = ['picking_assigned_at', 'picking_started_at'].filter(c => !ordColNames.includes(c));

    // 3. Inspect tables existence
    const [tables] = await conn.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('order_item_allocations', 'picking_event_log')`
    );
    const existingTables = tables.map(t => t.TABLE_NAME);
    const missingTables = ['order_item_allocations', 'picking_event_log'].filter(t => !existingTables.includes(t));

    if (isDryRun) {
      console.log(`\n[PREFLIGHT AUDIT RESULTS]`);
      console.log(`  - Missing location columns: ${missingLocCols.length ? missingLocCols.join(', ') : 'None (All present)'}`);
      console.log(`  - Missing orders columns:   ${missingOrdCols.length ? missingOrdCols.join(', ') : 'None (All present)'}`);
      console.log(`  - Missing tables:           ${missingTables.length ? missingTables.join(', ') : 'None (All present)'}`);
      console.log(`\nDry-run complete. Zero DDL executed. Database unchanged.`);
      console.log(`To apply these changes safely, specify:`);
      if (isProd) {
        console.log(`  node database/apply-migration-v3.js --confirm --allow-production --verified-backup-confirmed=<backup_file>`);
      } else {
        console.log(`  node database/apply-migration-v3.js --confirm`);
      }
      return { isDryRun: true, missingLocCols, missingOrdCols, missingTables };
    }

    // --- EXECUTE DDL SAFELY ---
    console.log(`\nApplying Migration v3 DDL...`);

    if (!locColNames.includes('aisle')) {
      console.log('Adding column aisle to location...');
      await conn.query(`ALTER TABLE location ADD COLUMN aisle VARCHAR(50) NULL AFTER rack_number`);
    }
    if (!locColNames.includes('shelf')) {
      console.log('Adding column shelf to location...');
      await conn.query(`ALTER TABLE location ADD COLUMN shelf VARCHAR(50) NULL AFTER aisle`);
    }
    if (!locColNames.includes('bin')) {
      console.log('Adding column bin to location...');
      await conn.query(`ALTER TABLE location ADD COLUMN bin VARCHAR(50) NULL AFTER shelf`);
    }

    if (!ordColNames.includes('picking_assigned_at')) {
      console.log('Adding column picking_assigned_at to orders...');
      await conn.query(`ALTER TABLE orders ADD COLUMN picking_assigned_at DATETIME NULL AFTER assigned_picker_id`);
    }
    if (!ordColNames.includes('picking_started_at')) {
      console.log('Adding column picking_started_at to orders...');
      await conn.query(`ALTER TABLE orders ADD COLUMN picking_started_at DATETIME NULL AFTER picking_assigned_at`);
    }

    if (!existingTables.includes('order_item_allocations')) {
      console.log('Creating table order_item_allocations...');
      await conn.query(`
        CREATE TABLE IF NOT EXISTS order_item_allocations (
            allocation_id        INT AUTO_INCREMENT PRIMARY KEY,
            order_id             INT NOT NULL,
            order_detail_id      INT NOT NULL,
            product_id           INT NOT NULL,
            inventory_id         INT NULL,
            batch_id             INT NULL,
            location_id          INT NULL,
            allocated_quantity   INT NOT NULL,
            picked_quantity      INT NOT NULL DEFAULT 0,
            shortage_quantity    INT NOT NULL DEFAULT 0,
            status               ENUM('PENDING', 'IN_PROGRESS', 'PAUSED', 'PICKED', 'SHORTAGE', 'RETURN_PENDING', 'RETURNED') NOT NULL DEFAULT 'PENDING',
            started_at           DATETIME NULL,
            picked_at            DATETIME NULL,
            paused_at            DATETIME NULL,
            total_paused_seconds INT NOT NULL DEFAULT 0,
            is_restored          BOOLEAN NOT NULL DEFAULT FALSE,
            shortage_reason      VARCHAR(255) NULL,
            notes                TEXT NULL,
            created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT fk_oia_order
                FOREIGN KEY (order_id) REFERENCES orders(order_id)
                ON UPDATE CASCADE ON DELETE CASCADE,
            CONSTRAINT fk_oia_order_detail
                FOREIGN KEY (order_detail_id) REFERENCES order_details(order_detail_id)
                ON UPDATE CASCADE ON DELETE CASCADE,
            CONSTRAINT fk_oia_product
                FOREIGN KEY (product_id) REFERENCES product(product_id)
                ON UPDATE CASCADE ON DELETE RESTRICT,
            CONSTRAINT fk_oia_inventory
                FOREIGN KEY (inventory_id) REFERENCES inventory(inventory_id)
                ON UPDATE CASCADE ON DELETE SET NULL,
            CONSTRAINT fk_oia_batch
                FOREIGN KEY (batch_id) REFERENCES batch(batch_id)
                ON UPDATE CASCADE ON DELETE SET NULL,
            CONSTRAINT fk_oia_location
                FOREIGN KEY (location_id) REFERENCES location(location_id)
                ON UPDATE CASCADE ON DELETE SET NULL,

            INDEX idx_oia_order    (order_id),
            INDEX idx_oia_product  (product_id),
            INDEX idx_oia_location (location_id),
            INDEX idx_oia_status   (status)
        ) ENGINE=InnoDB;
      `);
    }

    if (!existingTables.includes('picking_event_log')) {
      console.log('Creating table picking_event_log...');
      await conn.query(`
        CREATE TABLE IF NOT EXISTS picking_event_log (
            event_id         INT AUTO_INCREMENT PRIMARY KEY,
            order_id         INT NOT NULL,
            allocation_id    INT NULL,
            picker_id        INT NOT NULL,
            event_type       ENUM('ASSIGNED', 'PICK_STARTED', 'ITEM_STARTED', 'ITEM_PAUSED', 'ITEM_RESUMED', 'ITEM_CONFIRMED', 'ITEM_SHORTAGE', 'ORDER_COMPLETED', 'ITEM_RETURNED') NOT NULL,
            event_time       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            duration_seconds INT NULL,
            details          TEXT NULL,

            CONSTRAINT fk_pel_order
                FOREIGN KEY (order_id) REFERENCES orders(order_id)
                ON UPDATE CASCADE ON DELETE CASCADE,
            CONSTRAINT fk_pel_picker
                FOREIGN KEY (picker_id) REFERENCES \`user\`(user_id)
                ON UPDATE CASCADE ON DELETE RESTRICT,

            INDEX idx_pel_order  (order_id),
            INDEX idx_pel_picker (picker_id),
            INDEX idx_pel_type   (event_type),
            INDEX idx_pel_time   (event_time)
        ) ENGINE=InnoDB;
      `);
    }

    // Seed default location routing values if missing
    await conn.query(`
      UPDATE location 
      SET aisle = 'AISLE-01', shelf = 'SHELF-A', bin = 'BIN-01' 
      WHERE location_id = 1 AND aisle IS NULL
    `);
    await conn.query(`
      UPDATE location 
      SET aisle = 'AISLE-CHILL', shelf = 'SHELF-C', bin = 'BIN-C1' 
      WHERE location_id = 2 AND aisle IS NULL
    `);

    console.log('Migration v3 completed successfully!');
    return { success: true };
  } finally {
    conn.release();
    if (options.closePool !== false) {
      await dbPool.end();
    }
  }
}

if (require.main === module) {
  runMigration().catch(err => {
    console.error(`Migration blocked/failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  isProductionTarget,
  validateSafetyFlags,
  validateBackupConfirmation,
  validateTargetConfig,
  validateProductionCredentials,
  APPROVED_PRODUCTION_TARGET,
  runMigration
};
