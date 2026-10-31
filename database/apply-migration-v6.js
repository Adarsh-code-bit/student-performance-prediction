/**
 * Migration Runner: Purchase Line Item Storage Location & Capacity (v6)
 * Project: Smart Inventory Management System for Quick Commerce
 *
 * SAFETY SAFEGUARDS:
 *   1. Explicit Confirmation: Refuses to execute any DDL unless --confirm is passed.
 *   2. Production Protection: Detects production targets and refuses execution unless
 *      --allow-production AND --verified-backup-confirmed=<backup_file> are supplied.
 *   3. Dry-Run / Preflight: Defaults to non-destructive inspection mode (--dry-run).
 *   4. Zero Credential Exposure: Displays host and database name, never passwords or tokens.
 *   5. Idempotent & Non-destructive: Uses information_schema checks and conditional inserts.
 *   6. MySQL 8.4.11 ANSI_QUOTES Compatibility: Avoids double-quote string literals in DDL.
 */

if (process.argv.includes('--allow-production') || process.env.NODE_ENV === 'production') {
  process.env.SKIP_LOCAL_DOTENV = 'true';
}

const fs = require('fs');
const path = require('path');
const mysql = require('../backend/node_modules/mysql2/promise');
const defaultPool = require('../backend/config/db.config');

const APPROVED_PRODUCTION_TARGET = {
  host: 'mysql-37e1f16a-work-ae9c.d.aivencloud.com',
  port: 24803,
  database: 'defaultdb',
  caPath: path.resolve(__dirname, '../backups/aiven-ca.pem')
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

function getBackupConfirmedArg() {
  const arg = process.argv.find(a => a.startsWith('--verified-backup-confirmed='));
  return arg ? arg.split('=')[1]?.trim() : null;
}

async function applyMigrationV6(activePool = null) {
  const isDryRun = process.argv.includes('--dry-run') || !process.argv.includes('--confirm');
  const isConfirmed = process.argv.includes('--confirm');
  const isAllowProduction = process.argv.includes('--allow-production');
  const backupConfirmed = getBackupConfirmedArg();

  let targetHost = process.env.DB_HOST || 'localhost';
  let targetDb = process.env.DB_NAME || 'smart_inventory';
  let pool = activePool || defaultPool;
  let customConnection = null;

  if (isAllowProduction) {
    targetHost = APPROVED_PRODUCTION_TARGET.host;
    targetDb = APPROVED_PRODUCTION_TARGET.database;

    if (!backupConfirmed) {
      console.error('❌ ABORTED: Production migration requires verified backup confirmation via --verified-backup-confirmed=<backup_file>.');
      process.exit(1);
    }
    const backupResolved = path.resolve(backupConfirmed);
    if (!fs.existsSync(backupResolved) || fs.statSync(backupResolved).size === 0) {
      console.error(`❌ ABORTED: Verified backup file does not exist or is empty at path: ${backupConfirmed}`);
      process.exit(1);
    }

    if (!activePool) {
      const dotenv = require('../backend/node_modules/dotenv');
      dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

      const caCert = fs.readFileSync(APPROVED_PRODUCTION_TARGET.caPath, 'utf8');
      pool = await mysql.createPool({
        host: APPROVED_PRODUCTION_TARGET.host,
        port: APPROVED_PRODUCTION_TARGET.port,
        user: 'avnadmin',
        password: process.env.AIVEN_PASSWORD,
        database: APPROVED_PRODUCTION_TARGET.database,
        ssl: {
          ca: caCert,
          rejectUnauthorized: true
        },
        waitForConnections: true,
        connectionLimit: 5
      });
      customConnection = pool;
    }
  }

  console.log('=============================================================');
  console.log(' QUICKSTOCK Migration v6: Warehouse Zones & Purchase Location');
  console.log('=============================================================');
  console.log(` Mode:     ${isDryRun ? 'DRY-RUN (Preflight Inspection)' : 'LIVE EXECUTION'}`);
  console.log(` Target:   ${targetDb} on ${targetHost}`);
  if (backupConfirmed) {
    console.log(` Backup:   Confirmed (${path.basename(backupConfirmed)})`);
  }
  console.log('=============================================================\n');

  if (isProductionTarget(process.env) && !isAllowProduction) {
    console.error('❌ ABORTED: Production target detected without --allow-production flag.');
    process.exit(1);
  }

  try {
    // Preflight inspection
    const [locCols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'location'`
    );
    const existingLocCols = locCols.map(c => c.COLUMN_NAME);
    const needsMaxCapacity = !existingLocCols.includes('max_capacity');

    const [pdCols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_details'`
    );
    const existingPdCols = pdCols.map(c => c.COLUMN_NAME);
    const needsLocationId = !existingPdCols.includes('location_id');

    const [fks] = await pool.query(
      `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'purchase_details' 
         AND CONSTRAINT_NAME = 'fk_purchase_details_location'`
    );
    const needsFk = fks.length === 0;

    const [smCols] = await pool.query(
      `SELECT IS_NULLABLE FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_movement' AND COLUMN_NAME = 'from_location_id'`
    );
    const needsSmNullable = smCols.length > 0 && smCols[0].IS_NULLABLE === 'NO';

    console.log('[PREFLIGHT AUDIT]');
    console.log(`  - location.max_capacity needed:          ${needsMaxCapacity ? 'YES' : 'NO (already exists)'}`);
    console.log(`  - purchase_details.location_id needed:   ${needsLocationId ? 'YES' : 'NO (already exists)'}`);
    console.log(`  - fk_purchase_details_location needed:   ${needsFk ? 'YES' : 'NO (already exists)'}`);
    console.log(`  - stock_movement.from_location_id NULL:  ${needsSmNullable ? 'YES (currently NOT NULL)' : 'NO (already nullable)'}\n`);

    if (!isConfirmed) {
      console.log('ℹ️ Preflight completed. Zero DDL executed. To execute migration, run with: --confirm');
      return;
    }

    console.log('🚀 Executing non-destructive schema migration...');

    // 1. max_capacity on location
    if (needsMaxCapacity) {
      await pool.query('ALTER TABLE location ADD COLUMN max_capacity INT NULL DEFAULT NULL AFTER bin');
      console.log('  ✔ Added max_capacity column to location table');
    } else {
      console.log('  ℹ max_capacity column already exists on location');
    }

    // 2. location_id on purchase_details
    if (needsLocationId) {
      await pool.query('ALTER TABLE purchase_details ADD COLUMN location_id INT NULL AFTER product_id');
      console.log('  ✔ Added location_id column to purchase_details table');
    } else {
      console.log('  ℹ location_id column already exists on purchase_details');
    }

    // 3. Foreign key on purchase_details(location_id)
    if (needsFk) {
      try {
        await pool.query(
          `ALTER TABLE purchase_details 
           ADD CONSTRAINT fk_purchase_details_location 
           FOREIGN KEY (location_id) REFERENCES location(location_id) ON DELETE SET NULL`
        );
        console.log('  ✔ Added foreign key fk_purchase_details_location to purchase_details');
      } catch (e) {
        console.log('  ℹ Foreign key creation note:', e.message);
      }
    } else {
      console.log('  ℹ Foreign key fk_purchase_details_location already exists');
    }

    // 3b. Make stock_movement.from_location_id nullable for external supplier restocks
    if (needsSmNullable) {
      try {
        await pool.query('ALTER TABLE stock_movement MODIFY COLUMN from_location_id INT NULL');
        console.log('  ✔ stock_movement.from_location_id made nullable for supplier inbound restocks');
      } catch (e) {
        console.log('  ℹ stock_movement column note:', e.message);
      }
    } else {
      console.log('  ℹ stock_movement.from_location_id is already nullable');
    }

    // 4. Seed standard warehouse rack positions
    const seedLocations = [
      {
        location_name: 'Rack A01 Position 02-0B',
        location_type: 'dark_store',
        store_id: 1,
        rack_number: 'A01',
        aisle: '01',
        shelf: '02',
        bin: '0B',
        zone: 'Cold Storage',
        description: 'Cold drinks primary rack position',
        is_active: 1,
        max_capacity: 500
      },
      {
        location_name: 'Rack A02 Position 01-0A',
        location_type: 'dark_store',
        store_id: 1,
        rack_number: 'A02',
        aisle: '01',
        shelf: '01',
        bin: '0A',
        zone: 'Ambient',
        description: 'Biscuits & confectionery primary rack position',
        is_active: 1,
        max_capacity: 500
      },
      {
        location_name: 'Rack A03 Position 04-0C',
        location_type: 'dark_store',
        store_id: 1,
        rack_number: 'A03',
        aisle: '02',
        shelf: '04',
        bin: '0C',
        zone: 'Ambient',
        description: 'Chips & savory snacks rack position',
        is_active: 1,
        max_capacity: 500
      },
      {
        location_name: 'Rack A04 Position 01-0A (Limited)',
        location_type: 'dark_store',
        store_id: 1,
        rack_number: 'A04',
        aisle: '02',
        shelf: '01',
        bin: '0A',
        zone: 'Ambient',
        description: 'Limited capacity test location',
        is_active: 1,
        max_capacity: 10
      },
      {
        location_name: 'Rack A99 Position 99-9Z (Decommissioned)',
        location_type: 'dark_store',
        store_id: 1,
        rack_number: 'A99',
        aisle: '99',
        shelf: '99',
        bin: '9Z',
        zone: 'Archive',
        description: 'Inactive decommissioned rack position',
        is_active: 0,
        max_capacity: 100
      }
    ];

    for (const loc of seedLocations) {
      const [existing] = await pool.query(
        'SELECT location_id FROM location WHERE rack_number = ? AND shelf = ? AND bin = ?',
        [loc.rack_number, loc.shelf, loc.bin]
      );
      if (existing.length === 0) {
        await pool.query(
          `INSERT INTO location (location_name, location_type, store_id, rack_number, aisle, shelf, bin, zone, description, is_active, max_capacity)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [loc.location_name, loc.location_type, loc.store_id, loc.rack_number, loc.aisle, loc.shelf, loc.bin, loc.zone, loc.description, loc.is_active, loc.max_capacity]
        );
        console.log(`  ✔ Seeded rack location ${loc.rack_number}-${loc.shelf}-${loc.bin}`);
      } else {
        await pool.query(
          'UPDATE location SET max_capacity = COALESCE(max_capacity, ?) WHERE location_id = ?',
          [loc.max_capacity, existing[0].location_id]
        );
        console.log(`  ℹ Location ${loc.rack_number}-${loc.shelf}-${loc.bin} already exists (updated max_capacity)`);
      }
    }

    console.log('\n✅ Migration v6 completed successfully.\n');
  } finally {
    if (customConnection) {
      await customConnection.end();
    }
  }
}

if (require.main === module) {
  applyMigrationV6()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n❌ Migration v6 failed:', err.message);
      process.exit(1);
    });
}

module.exports = applyMigrationV6;
