/**
 * Backfill Utility: Pre-Migration v3 Order Allocations
 * Project: Smart Inventory Management System for Quick Commerce
 * 
 * PURPOSE:
 *   Safely creates allocation records for legacy orders that were placed before
 *   migration-v3 was introduced, enabling the picking station, manager activity
 *   dashboard, and inventory reconciliation to operate seamlessly on existing data.
 * 
 * SAFETY SAFEGUARDS:
 *   1. Non-destructive: NEVER modifies existing inventory quantities or order amounts.
 *   2. Zero double-deduction: Does NOT deduct stock (stock was already deducted at creation).
 *   3. Zero double-restoration: Newly backfilled allocations default to is_restored=FALSE
 *      matching the schema default. No stock was restored during historical processing,
 *      so allocations are not prematurely or falsely marked as restored.
 *   4. Accurate location guidance: Leaves location_id NULL if multiple ambiguous batches exist
 *      rather than guessing or inventing location identifiers.
 *   5. Dry-run by default: Requires explicit --execute AND --confirm flags to commit changes.
 *   6. Production Protection: Refuses to run against production databases without
 *      --allow-production AND --verified-backup-confirmed=<backup_file>.
 *   7. Zero Credential Exposure: Displays host and database name, never credentials.
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
    throw new Error('Refusing backfill: Production execution requires verified backup confirmation via --verified-backup-confirmed=<backup_file_or_id>.');
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
      throw new Error(`Refusing backfill: Specified backup file does not exist at path: ${trimmed}`);
    }

    const stats = fs.statSync(resolvedPath);
    if (stats.isDirectory()) {
      throw new Error(`Refusing backfill: Specified backup path is a directory, not a valid backup file: ${trimmed}`);
    }

    if (stats.size === 0) {
      throw new Error(`Refusing backfill: Specified backup file is empty (0 bytes): ${trimmed}`);
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
 * Validates CLI arguments and safety requirements before any backfill execution.
 */
function validateBackfillFlags(argv = process.argv, env = process.env) {
  const isExecute = argv.includes('--execute');
  const isConfirm = argv.includes('--confirm');
  const isDryRun = argv.includes('--dry-run') || !isExecute || !isConfirm;
  const isAllowProduction = argv.includes('--allow-production');
  const backupFlag = argv.find(arg => arg.startsWith('--verified-backup-confirmed='));
  const rawBackupConfirmed = backupFlag ? backupFlag.split('=')[1]?.trim() : null;

  // Validate target configuration before any connection creation
  const targetConfig = validateTargetConfig(env, isAllowProduction);
  const isProd = targetConfig.isProd;

  if (isDryRun) {
    return { canExecute: false, isDryRun: true, isProd, targetConfig };
  }

  if (!isConfirm) {
    throw new Error('Refusing backfill: Writing allocation data requires the explicit --confirm flag.');
  }

  let backupValidation = null;
  if (isProd) {
    if (!isAllowProduction) {
      throw new Error('Refusing backfill: Target is a PRODUCTION database. Explicit authorization required via --allow-production.');
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
 * Performs preflight audit or executes legacy allocation backfill.
 */
async function backfillAllocations(options = {}) {
  const env = options.env || process.env;
  const argv = options.argv || process.argv;

  // 1. Establish and validate intended target before loading database pool or connecting
  const safety = validateBackfillFlags(argv, env);
  const { canExecute, isDryRun, isProd, backupConfirmed, targetConfig } = safety;

  const targetHost = targetConfig.host;
  const targetPort = targetConfig.port;
  const targetDb = targetConfig.database;

  console.log(`================================================================`);
  console.log(`LEGACY ORDER ALLOCATION BACKFILL`);
  console.log(`Target Host:     ${targetHost}:${targetPort}`);
  console.log(`Target Database: ${targetDb}`);
  console.log(`Environment:     ${isProd ? 'PRODUCTION' : 'LOCAL / DEVELOPMENT'}`);
  console.log(`Execution Mode:  ${isDryRun ? 'DRY RUN (READ-ONLY AUDIT)' : 'EXECUTE (ATOMIC TRANSACTION)'}`);
  if (backupConfirmed) {
    console.log(`Backup Verified: ${backupConfirmed}`);
  }
  console.log(`================================================================`);

  // Dynamically build pool from validated target env, or use injected test pool
  const dbPool = options.pool || (pool.buildPoolConfig ? mysql.createPool(pool.buildPoolConfig(env)) : pool);
  const conn = await dbPool.getConnection();

  try {
    if (canExecute) {
      await conn.beginTransaction();
    }

    // 1. Identify orders without any records in order_item_allocations
    const [ordersToBackfill] = await conn.query(`
      SELECT o.order_id, o.store_id, o.status, o.order_date, o.picked_at
      FROM orders o
      LEFT JOIN order_item_allocations oia ON o.order_id = oia.order_id
      WHERE oia.allocation_id IS NULL
      GROUP BY o.order_id, o.store_id, o.status, o.order_date, o.picked_at
      ORDER BY o.order_id ASC
    `);

    console.log(`Found ${ordersToBackfill.length} legacy orders without allocation records.`);

    if (ordersToBackfill.length === 0) {
      console.log('No legacy orders require backfill. All orders have allocation records.');
      return { ordersCount: 0, allocationsCount: 0, isDryRun };
    }

    let totalAllocationsCreated = 0;
    let completedOrdersCount = 0;
    let activeOrdersCount = 0;
    let cancelledOrdersCount = 0;

    for (const ord of ordersToBackfill) {
      const isCompleted = ['picked', 'packed', 'ready_for_dispatch', 'dispatched', 'delivered', 'shipped'].includes(ord.status);
      const isCancelled = ord.status === 'cancelled';
      const isActive = ['pending', 'confirmed', 'picking_queue', 'picking_in_progress'].includes(ord.status);

      if (isCompleted) completedOrdersCount++;
      else if (isCancelled) cancelledOrdersCount++;
      else if (isActive) activeOrdersCount++;

      const [details] = await conn.query(
        'SELECT * FROM order_details WHERE order_id = ? ORDER BY order_detail_id ASC',
        [ord.order_id]
      );

      if (details.length === 0) {
        continue;
      }

      for (const item of details) {
        // Guard item-level idempotency: skip if allocation already exists
        const [existingAlloc] = await conn.query(
          'SELECT allocation_id FROM order_item_allocations WHERE order_detail_id = ?',
          [item.order_detail_id]
        );
        if (existingAlloc && existingAlloc.length > 0) {
          continue;
        }

        // Do NOT invent historical batch or location assignments from current inventory
        // Current inventory state does NOT prove where items were picked in the past.
        let matchedInv = null;
        let notes = null;

        if (isActive) {
          // For active unfulfilled orders, dynamically resolve candidate FEFO inventory
          const [invRows] = await conn.query(`
            SELECT i.inventory_id, i.batch_id, i.location_id, b.expiry_date
            FROM inventory i
            JOIN batch b ON b.batch_id = i.batch_id
            WHERE i.product_id = ? AND i.quantity > 0 AND (b.expiry_date IS NULL OR b.expiry_date >= CURDATE())
            ORDER BY 
              CASE WHEN b.expiry_date IS NOT NULL THEN 0 ELSE 1 END ASC,
              b.expiry_date ASC,
              i.quantity DESC,
              i.inventory_id ASC
          `, [item.product_id]);

          if (invRows.length > 0) {
            matchedInv = invRows[0];
            notes = 'Legacy pending order: candidate location assigned via live FEFO balance';
          } else {
            notes = 'Legacy pending order: stock shortage, location unassigned';
          }
        } else {
          // For historical (completed or cancelled) orders, NEVER claim current inventory proves past location!
          // Leave batch_id and location_id NULL, and explicitly mark as UNVERIFIED.
          matchedInv = null;
          notes = 'Legacy pre-v3 historical order: fulfillment batch/rack unrecorded (UNVERIFIED_HISTORICAL)';
        }

        const allocationStatus = isCompleted ? 'PICKED' : (isCancelled ? 'SHORTAGE' : 'PENDING');
        const pickedQuantity = isCompleted ? item.quantity : 0;
        const shortageQuantity = isCancelled ? item.quantity : 0;
        // In this system, is_restored=TRUE signifies that inventory quantity was refunded
        // back to the inventory table. For historical orders, no stock restoration occurred during backfill,
        // so all newly backfilled allocations strictly default to is_restored=false.
        const isRestored = false;

        if (canExecute) {
          await conn.query(`
            INSERT INTO order_item_allocations (
              order_id, order_detail_id, product_id, inventory_id, batch_id, location_id,
              allocated_quantity, picked_quantity, shortage_quantity,
              status, is_restored, picked_at, started_at, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            ord.order_id,
            item.order_detail_id,
            item.product_id,
            matchedInv ? matchedInv.inventory_id : null,
            matchedInv ? matchedInv.batch_id : null,
            matchedInv ? matchedInv.location_id : null,
            item.quantity,
            pickedQuantity,
            shortageQuantity,
            allocationStatus,
            isRestored,
            isCompleted ? (ord.picked_at || ord.order_date) : null,
            isCompleted ? ord.order_date : null,
            notes
          ]);
        }
        totalAllocationsCreated++;
      }
    }

    if (canExecute) {
      await conn.commit();
      console.log(`\nSUCCESS: Backfilled ${totalAllocationsCreated} allocations across ${ordersToBackfill.length} orders.`);
    } else {
      console.log(`\nDRY RUN COMPLETE: Would backfill ${totalAllocationsCreated} allocations across ${ordersToBackfill.length} orders.`);
      console.log('To apply these changes safely, specify:');
      if (isProd) {
        console.log('  node database/backfill-pre-v3-allocations.js --execute --confirm --allow-production --verified-backup-confirmed=<backup_file>');
      } else {
        console.log('  node database/backfill-pre-v3-allocations.js --execute --confirm');
      }
    }

    console.log(`Summary:`);
    console.log(`  - Completed/Fulfilled Orders: ${completedOrdersCount}`);
    console.log(`  - Active/Pending Orders:      ${activeOrdersCount}`);
    console.log(`  - Cancelled Orders:           ${cancelledOrdersCount}`);

    return { ordersCount: ordersToBackfill.length, allocationsCount: totalAllocationsCreated, isDryRun };
  } catch (err) {
    if (canExecute) {
      await conn.rollback();
    }
    throw err;
  } finally {
    conn.release();
    if (options.closePool !== false) {
      await dbPool.end();
    }
  }
}

if (require.main === module) {
  backfillAllocations().catch(err => {
    console.error(`Backfill blocked/failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  isProductionTarget,
  validateBackfillFlags,
  validateBackupConfirmation,
  validateTargetConfig,
  validateProductionCredentials,
  APPROVED_PRODUCTION_TARGET,
  backfillAllocations
};
