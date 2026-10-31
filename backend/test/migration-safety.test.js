const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { 
  isProductionTarget, 
  validateSafetyFlags, 
  validateBackupConfirmation, 
  validateTargetConfig, 
  validateProductionCredentials, 
  APPROVED_PRODUCTION_TARGET, 
  runMigration 
} = require('../../database/apply-migration-v3');
const { 
  validateBackfillFlags, 
  isProductionTarget: isBackfillProd, 
  backfillAllocations 
} = require('../../database/backfill-pre-v3-allocations');
const { buildPoolConfig } = require('../config/db.config');

test('Migration Safety: correctly identifies production vs local target databases', () => {
  // Cloud database host detection
  assert.equal(isProductionTarget({ DB_HOST: 'mysql-37e1f16a-work-ae9c.d.aivencloud.com' }), true);
  assert.equal(isProductionTarget({ DB_HOST: 'database-1.cluster-xyz.us-east-1.rds.amazonaws.com' }), true);
  assert.equal(isProductionTarget({ DB_HOST: 'dpg-c1234.singapore-postgres.render.com' }), true);
  assert.equal(isProductionTarget({ DB_HOST: 'localhost', NODE_ENV: 'production' }), true);

  // Local development host detection
  assert.equal(isProductionTarget({ DB_HOST: 'localhost', NODE_ENV: 'development' }), false);
  assert.equal(isProductionTarget({ DB_HOST: '127.0.0.1', NODE_ENV: 'development' }), false);
  assert.equal(isProductionTarget({ DB_HOST: '::1', NODE_ENV: 'test' }), false);
});

test('Migration Safety: refuses execution without explicit --confirm flag', () => {
  // Invoking without flags defaults to dry-run
  const dryRunState = validateSafetyFlags(['node', 'apply-migration-v3.js'], { DB_HOST: 'localhost' });
  assert.equal(dryRunState.canExecute, false);
  assert.equal(dryRunState.isDryRun, true);

  // Invoking with explicit --dry-run
  const explicitDryRun = validateSafetyFlags(['node', 'apply-migration-v3.js', '--dry-run'], { DB_HOST: 'localhost' });
  assert.equal(explicitDryRun.canExecute, false);
  assert.equal(explicitDryRun.isDryRun, true);
});

test('Migration Safety: production target refuses execution without separate --allow-production flag', () => {
  const prodEnv = { DB_HOST: 'mysql-37e1f16a-work-ae9c.d.aivencloud.com', NODE_ENV: 'production' };

  // Attempting to run with only --confirm against production MUST throw
  assert.throws(
    () => validateSafetyFlags(['node', 'apply-migration-v3.js', '--confirm'], prodEnv),
    /Refusing migration: Target is a PRODUCTION database. Explicit authorization required via --allow-production/
  );
});

test('Migration Safety: production target refuses execution when backup confirmation is missing or empty', () => {
  const prodEnv = { DB_HOST: 'mysql-37e1f16a-work-ae9c.d.aivencloud.com', NODE_ENV: 'production' };

  // Missing backup flag
  assert.throws(
    () => validateSafetyFlags(['node', 'apply-migration-v3.js', '--confirm', '--allow-production'], prodEnv),
    /Production migration requires verified backup confirmation via --verified-backup-confirmed/
  );

  // Empty backup flag value
  assert.throws(
    () => validateSafetyFlags(['node', 'apply-migration-v3.js', '--confirm', '--allow-production', '--verified-backup-confirmed='], prodEnv),
    /Production migration requires verified backup confirmation via --verified-backup-confirmed/
  );

  // Whitespace-only backup flag value
  assert.throws(
    () => validateSafetyFlags(['node', 'apply-migration-v3.js', '--confirm', '--allow-production', '--verified-backup-confirmed=   '], prodEnv),
    /Production migration requires verified backup confirmation via --verified-backup-confirmed/
  );
});

test('Migration Safety: production target rejects nonexistent local backup file path', () => {
  const prodEnv = { DB_HOST: 'mysql-37e1f16a-work-ae9c.d.aivencloud.com', NODE_ENV: 'production' };

  assert.throws(
    () => validateSafetyFlags(['node', 'apply-migration-v3.js', '--confirm', '--allow-production', '--verified-backup-confirmed=nonexistent_backup.sql'], prodEnv),
    /Specified backup file does not exist at path: nonexistent_backup.sql/
  );
});

test('Migration Safety: production target rejects directory supplied as backup path', () => {
  const prodEnv = { DB_HOST: 'mysql-37e1f16a-work-ae9c.d.aivencloud.com', NODE_ENV: 'production' };

  assert.throws(
    () => validateSafetyFlags(['node', 'apply-migration-v3.js', '--confirm', '--allow-production', `--verified-backup-confirmed=${__dirname}`], prodEnv),
    /Specified backup path is a directory, not a valid backup file/
  );
});

test('Migration Safety: production target rejects empty (0-byte) backup file', () => {
  const prodEnv = { DB_HOST: 'mysql-37e1f16a-work-ae9c.d.aivencloud.com', NODE_ENV: 'production' };
  const emptyFile = path.join(os.tmpdir(), `test_empty_backup_${Date.now()}.sql`);

  try {
    fs.writeFileSync(emptyFile, '');
    assert.throws(
      () => validateSafetyFlags(['node', 'apply-migration-v3.js', '--confirm', '--allow-production', `--verified-backup-confirmed=${emptyFile}`], prodEnv),
      /Specified backup file is empty \(0 bytes\)/
    );
  } finally {
    if (fs.existsSync(emptyFile)) fs.unlinkSync(emptyFile);
  }
});

test('Migration Safety: valid backup file passes file-existence check with explicit scope limitation disclaimer', () => {
  const prodEnv = {
    DB_HOST: 'mysql-37e1f16a-work-ae9c.d.aivencloud.com',
    DB_PORT: '24803',
    DB_USER: 'avnadmin',
    DB_PASSWORD: 'mock_password_not_real_secret',
    DB_NAME: 'defaultdb',
    DB_SSL: 'true',
    DB_SSL_CA: '-----BEGIN CERTIFICATE-----\nMOCK_CA\n-----END CERTIFICATE-----',
    NODE_ENV: 'production'
  };
  const validFile = path.join(os.tmpdir(), `test_valid_backup_${Date.now()}.sql`);

  try {
    fs.writeFileSync(validFile, '-- VALID MOCK BACKUP DUMP CONTENT\n');
    const validProdRun = validateSafetyFlags(
      ['node', 'apply-migration-v3.js', '--confirm', '--allow-production', `--verified-backup-confirmed=${validFile}`],
      prodEnv
    );

    assert.equal(validProdRun.canExecute, true);
    assert.equal(validProdRun.isDryRun, false);
    assert.equal(validProdRun.isProd, true);
    assert.ok(validProdRun.fileVerification, 'fileVerification object must be present');
    assert.equal(validProdRun.fileVerification.fileVerified, true);
    assert.ok(validProdRun.fileVerification.sizeBytes > 0);
    // Verifies that existence check does NOT assert logical backup validity or restorability
    assert.ok(validProdRun.fileVerification.note.includes('NOTE: This confirms file presence and non-zero size only; it does NOT constitute proof of logical backup validity, data completeness, or restorability.'));
  } finally {
    if (fs.existsSync(validFile)) fs.unlinkSync(validFile);
  }
});

test('Backfill Safety: refuses unsafe execution and requires explicit confirmation', () => {
  const localEnv = { DB_HOST: 'localhost', NODE_ENV: 'development' };

  // Default invocation is dry run
  const dryRun = validateBackfillFlags(['node', 'backfill.js'], localEnv);
  assert.equal(dryRun.canExecute, false);
  assert.equal(dryRun.isDryRun, true);

  // Missing --confirm flag
  const missingConfirm = validateBackfillFlags(['node', 'backfill.js', '--execute'], localEnv);
  assert.equal(missingConfirm.canExecute, false);
  assert.equal(missingConfirm.isDryRun, true);

  // Production environment requires --allow-production and verified backup
  const prodEnv = { DB_HOST: 'mysql-37e1f16a-work-ae9c.d.aivencloud.com' };
  assert.throws(
    () => validateBackfillFlags(['node', 'backfill.js', '--execute', '--confirm'], prodEnv),
    /Target is a PRODUCTION database. Explicit authorization required via --allow-production/
  );

  assert.throws(
    () => validateBackfillFlags(['node', 'backfill.js', '--execute', '--confirm', '--allow-production'], prodEnv),
    /Production execution requires verified backup confirmation via --verified-backup-confirmed/
  );
});

test('Backfill Safety: historical backfill defaults is_restored to false and never modifies inventory', async () => {
  const executedQueries = [];
  const insertedAllocations = [];
  let transactionBegun = false;
  let transactionCommitted = false;
  let connectionReleased = false;

  const mockOrders = [
    { order_id: 101, store_id: 1, status: 'delivered', order_date: '2026-01-01', picked_at: '2026-01-01' },
    { order_id: 102, store_id: 1, status: 'cancelled', order_date: '2026-01-02', picked_at: null },
    { order_id: 103, store_id: 1, status: 'packed', order_date: '2026-01-03', picked_at: '2026-01-03' },
    { order_id: 104, store_id: 1, status: 'pending', order_date: '2026-01-04', picked_at: null }
  ];

  const mockDetails = [
    { order_detail_id: 501, order_id: 101, product_id: 10, quantity: 3 },
    { order_detail_id: 502, order_id: 102, product_id: 10, quantity: 2 },
    { order_detail_id: 503, order_id: 103, product_id: 10, quantity: 4 },
    { order_detail_id: 504, order_id: 104, product_id: 10, quantity: 1 }
  ];

  const mockConn = {
    beginTransaction: async () => { transactionBegun = true; },
    commit: async () => { transactionCommitted = true; },
    rollback: async () => {},
    release: () => { connectionReleased = true; },
    query: async (sql, params) => {
      executedQueries.push({ sql, params });

      if (sql.includes('FROM orders o') && sql.includes('LEFT JOIN order_item_allocations')) {
        return [mockOrders];
      }
      if (sql.includes('FROM order_details WHERE order_id = ?')) {
        const orderId = params[0];
        return [mockDetails.filter(d => d.order_id === orderId)];
      }
      if (sql.includes('FROM inventory i')) {
        return [[{ inventory_id: 201, batch_id: 301, location_id: 401, expiry_date: '2027-12-31' }]];
      }
      if (sql.includes('INSERT INTO order_item_allocations')) {
        insertedAllocations.push({
          order_id: params[0],
          order_detail_id: params[1],
          product_id: params[2],
          allocated_quantity: params[6],
          picked_quantity: params[7],
          shortage_quantity: params[8],
          status: params[9],
          is_restored: params[10]
        });
        return [{ affectedRows: 1 }];
      }
      return [[]];
    }
  };

  const mockPool = {
    getConnection: async () => mockConn,
    end: async () => {}
  };

  const result = await backfillAllocations({
    argv: ['node', 'backfill.js', '--execute', '--confirm'],
    env: { DB_HOST: 'localhost', NODE_ENV: 'development' },
    pool: mockPool,
    closePool: false
  });

  assert.equal(transactionBegun, true, 'Transaction must be begun');
  assert.equal(transactionCommitted, true, 'Transaction must be committed');
  assert.equal(connectionReleased, true, 'Connection must be released');
  assert.equal(result.ordersCount, 4, 'Must process 4 legacy orders');
  assert.equal(result.allocationsCount, 4, 'Must create 4 allocations');

  // Verify that EVERY backfilled allocation strictly defaults is_restored to false
  for (const alloc of insertedAllocations) {
    assert.equal(
      alloc.is_restored, 
      false, 
      `Order #${alloc.order_id} (status: ${alloc.status}) must have is_restored = false, but got ${alloc.is_restored}`
    );
  }

  // Verify ZERO inventory table mutations occurred
  const inventoryMutations = executedQueries.filter(q =>
    q.sql.toUpperCase().includes('UPDATE INVENTORY') ||
    q.sql.toUpperCase().includes('DELETE FROM INVENTORY') ||
    q.sql.toUpperCase().includes('INSERT INTO INVENTORY')
  );
  assert.equal(inventoryMutations.length, 0, 'Backfill must never modify inventory table');
});

test('Migration Dry-Run Mode: performs read-only preflight and executes zero DDL', async () => {
  const executedQueries = [];
  let connectionReleased = false;

  const mockConn = {
    query: async (sql) => {
      executedQueries.push(sql);
      if (sql.includes('information_schema.COLUMNS') && sql.includes('location')) {
        return [[{ COLUMN_NAME: 'location_id' }, { COLUMN_NAME: 'location_name' }]];
      }
      if (sql.includes('information_schema.COLUMNS') && sql.includes('orders')) {
        return [[{ COLUMN_NAME: 'order_id' }]];
      }
      if (sql.includes('information_schema.TABLES')) {
        return [[]];
      }
      return [[]];
    },
    release: () => {
      connectionReleased = true;
    }
  };

  const mockPool = {
    getConnection: async () => mockConn,
    end: async () => {}
  };

  const result = await runMigration({
    argv: ['node', 'apply-migration-v3.js', '--dry-run'],
    env: { DB_HOST: 'localhost', DB_NAME: 'smart_inventory' },
    pool: mockPool,
    closePool: false
  });

  assert.equal(result.isDryRun, true, 'Dry run flag must be true');
  assert.equal(connectionReleased, true, 'Database connection must be released');

  // Verify missing columns were accurately identified
  assert.deepEqual(result.missingLocCols, ['aisle', 'shelf', 'bin']);
  assert.deepEqual(result.missingOrdCols, ['picking_assigned_at', 'picking_started_at']);
  assert.deepEqual(result.missingTables, ['order_item_allocations', 'picking_event_log']);

  // Verify ZERO DDL or mutation queries were executed
  const ddlKeywords = ['ALTER TABLE', 'CREATE TABLE', 'DROP TABLE', 'INSERT INTO', 'UPDATE '];
  const executedDdl = executedQueries.filter(q =>
    ddlKeywords.some(keyword => q.toUpperCase().includes(keyword))
  );
  assert.equal(executedDdl.length, 0, `Dry-run must not execute DDL! Executed: ${JSON.stringify(executedDdl)}`);
});

test('TLS Protection: migration runner retains strict TLS verification and rejectUnauthorized by default', () => {
  const sslConfig = buildPoolConfig({
    DB_HOST: 'mysql-37e1f16a-work-ae9c.d.aivencloud.com',
    DB_SSL: 'true'
  });

  assert.ok(sslConfig.ssl, 'SSL configuration must be present when DB_SSL is true');
  assert.equal(sslConfig.ssl.rejectUnauthorized, true, 'rejectUnauthorized must be strictly true');
});

test('Target Guard: --allow-production with localhost or local database is rejected immediately', () => {
  // Reject localhost with --allow-production
  assert.throws(
    () => validateSafetyFlags(['node', 'apply-migration-v3.js', '--confirm', '--allow-production'], { DB_HOST: 'localhost' }),
    /Target mismatch: --allow-production was specified, but target resolved to local configuration/
  );

  assert.throws(
    () => validateBackfillFlags(['node', 'backfill.js', '--execute', '--confirm', '--allow-production'], { DB_HOST: '127.0.0.1' }),
    /Target mismatch: --allow-production was specified, but target resolved to local configuration/
  );

  // Reject local database smart_inventory with --allow-production even if host looks like cloud
  assert.throws(
    () => validateSafetyFlags(['node', 'apply-migration-v3.js', '--confirm', '--allow-production'], { DB_HOST: 'mysql-37e1f16a-work-ae9c.d.aivencloud.com', DB_NAME: 'smart_inventory' }),
    /Target mismatch: --allow-production was specified, but target resolved to local configuration/
  );
});

test('Target Guard: unapproved production host, port, or database is rejected', () => {
  const validTarget = {
    DB_HOST: 'mysql-37e1f16a-work-ae9c.d.aivencloud.com',
    DB_PORT: '24803',
    DB_USER: 'avnadmin',
    DB_PASSWORD: 'mock_password_not_real_secret',
    DB_NAME: 'defaultdb',
    DB_SSL: 'true',
    DB_SSL_CA: '-----BEGIN CERTIFICATE-----\nMOCK\n-----END CERTIFICATE-----',
    NODE_ENV: 'production'
  };

  // Wrong host
  assert.throws(
    () => validateTargetConfig({ ...validTarget, DB_HOST: 'wrong-host.aivencloud.com' }, true),
    /Target mismatch: Unapproved production host 'wrong-host.aivencloud.com'/
  );

  // Wrong port
  assert.throws(
    () => validateTargetConfig({ ...validTarget, DB_PORT: '3306' }, true),
    /Target mismatch: Unapproved production port '3306'/
  );

  // Wrong database
  assert.throws(
    () => validateTargetConfig({ ...validTarget, DB_NAME: 'other_database' }, true),
    /Target mismatch: Unapproved production database 'other_database'/
  );
});

test('Target Guard: missing production credentials or invalid TLS configuration are rejected', () => {
  const baseTarget = {
    DB_HOST: 'mysql-37e1f16a-work-ae9c.d.aivencloud.com',
    DB_PORT: '24803',
    DB_NAME: 'defaultdb',
    NODE_ENV: 'production'
  };

  // Missing DB_USER
  assert.throws(
    () => validateProductionCredentials({ ...baseTarget, DB_PASSWORD: 'p', DB_SSL: 'true', DB_SSL_CA: 'cert' }),
    /Refusing production execution: DB_USER is required/
  );

  // Missing DB_PASSWORD
  assert.throws(
    () => validateProductionCredentials({ ...baseTarget, DB_USER: 'avnadmin', DB_SSL: 'true', DB_SSL_CA: 'cert' }),
    /Refusing production execution: DB_PASSWORD is required/
  );

  // Insecure TLS (DB_SSL != 'true')
  assert.throws(
    () => validateProductionCredentials({ ...baseTarget, DB_USER: 'avnadmin', DB_PASSWORD: 'p', DB_SSL: 'false', DB_SSL_CA: 'cert' }),
    /Refusing production execution: DB_SSL must be set to "true"/
  );

  // Relaxed TLS (rejectUnauthorized == 'false')
  assert.throws(
    () => validateProductionCredentials({ ...baseTarget, DB_USER: 'avnadmin', DB_PASSWORD: 'p', DB_SSL: 'true', DB_SSL_REJECT_UNAUTHORIZED: 'false', DB_SSL_CA: 'cert' }),
    /Refusing production execution: Strict TLS verification/
  );

  // Missing CA certificate
  assert.throws(
    () => validateProductionCredentials({ ...baseTarget, DB_USER: 'avnadmin', DB_PASSWORD: 'p', DB_SSL: 'true' }),
    /Refusing production execution: CA certificate/
  );

  // Non-existent CA path
  assert.throws(
    () => validateProductionCredentials({ ...baseTarget, DB_USER: 'avnadmin', DB_PASSWORD: 'p', DB_SSL: 'true', DB_SSL_CA_PATH: '/nonexistent/path/to/ca.pem' }),
    /Refusing production execution: CA certificate file not found at path/
  );
});

test('Target Guard: valid approved production configuration passes target validation without connecting', () => {
  const validTarget = {
    DB_HOST: 'mysql-37e1f16a-work-ae9c.d.aivencloud.com',
    DB_PORT: '24803',
    DB_NAME: 'defaultdb',
    DB_USER: 'avnadmin',
    DB_PASSWORD: 'mock_password_not_real_secret',
    DB_SSL: 'true',
    DB_SSL_CA: '-----BEGIN CERTIFICATE-----\nMOCK\n-----END CERTIFICATE-----',
    NODE_ENV: 'production'
  };

  const targetConfig = validateTargetConfig(validTarget, true);
  assert.equal(targetConfig.isProd, true);
  assert.equal(targetConfig.host, APPROVED_PRODUCTION_TARGET.host);
  assert.equal(targetConfig.port, APPROVED_PRODUCTION_TARGET.port);
  assert.equal(targetConfig.database, APPROVED_PRODUCTION_TARGET.database);

  // Proves credentials and TLS validate successfully in-memory without initiating any network connection
  assert.doesNotThrow(() => validateProductionCredentials(validTarget));
});

test('Target Guard: production configuration does not fall back to backend/.env', () => {
  // When --allow-production is set, empty/cleared process.env must NOT fall back to local configuration
  assert.throws(
    () => validateSafetyFlags(['node', 'apply-migration-v3.js', '--confirm', '--allow-production'], {}),
    /Target mismatch: --allow-production was specified, but target resolved to local configuration/
  );

  assert.throws(
    () => validateBackfillFlags(['node', 'backfill.js', '--execute', '--confirm', '--allow-production'], {}),
    /Target mismatch: --allow-production was specified, but target resolved to local configuration/
  );
});

