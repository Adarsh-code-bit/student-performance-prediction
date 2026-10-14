const test = require('node:test');
const assert = require('node:assert/strict');
const { readConfig, setupDatabase } = require('../setup-db');
const { readConfig: readMigrationConfig } = require('../utils/run-migration');

test('setup requires all database environment values', () => {
  assert.throws(() => readConfig({}), /Missing required database configuration/);
});
test('setup rejects unsafe database names', () => {
  assert.throws(() => readConfig({ DB_HOST:'localhost', DB_PORT:'3306', DB_USER:'u', DB_PASSWORD:'p', DB_NAME:'bad-name' }), /DB_NAME/);
});
test('setup refuses default invocation without creating a connection', async () => {
  let connected = false;
  await assert.rejects(setupDatabase({ env:{}, argv:['node','setup-db.js'], mysqlDriver:{ createConnection(){ connected=true; } } }), /Refusing database setup/);
  assert.equal(connected, false);
});
test('migration config requires database credentials', () => {
  assert.throws(() => readMigrationConfig({}), /Missing required database configuration/);
});
