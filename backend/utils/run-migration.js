// Read-only migration preflight. This utility deliberately does not apply DDL or data changes.
// A reviewed, versioned migration must be created after the preflight results and backup are verified.
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

function readConfig(env = process.env) {
  const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missing = required.filter((key) => !env[key]);
  if (missing.length) throw new Error(`Missing required database configuration: ${missing.join(', ')}`);
  return { host: env.DB_HOST, port: Number(env.DB_PORT), user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME };
}

async function inspectDatabase({ env = process.env, driver = mysql } = {}) {
  const config = readConfig(env);
  const connection = await driver.createConnection({ ...config, multipleStatements: false });
  try {
    const [tables] = await connection.query('SELECT table_name FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name', [config.database]);
    const [columns] = await connection.query('SELECT table_name, column_name, column_type, is_nullable FROM information_schema.columns WHERE table_schema = ? ORDER BY table_name, ordinal_position', [config.database]);
    const [roles] = await connection.query("SELECT role, COUNT(*) AS account_count FROM `user` GROUP BY role ORDER BY role");
    const [foreignKeys] = await connection.query('SELECT table_name, constraint_name, referenced_table_name FROM information_schema.key_column_usage WHERE table_schema = ? AND referenced_table_name IS NOT NULL ORDER BY table_name, constraint_name', [config.database]);
    const [indexes] = await connection.query('SELECT table_name, index_name, non_unique FROM information_schema.statistics WHERE table_schema = ? GROUP BY table_name, index_name, non_unique ORDER BY table_name, index_name', [config.database]);
    const [triggers] = await connection.query('SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE trigger_schema = ? ORDER BY trigger_name', [config.database]);
    const [views] = await connection.query('SELECT table_name FROM information_schema.views WHERE table_schema = ? ORDER BY table_name', [config.database]);
    return { database: config.database, tables, columns, roles, foreignKeys, indexes, triggers, views };
  } finally { await connection.end(); }
}

if (require.main === module) {
  if (process.argv.includes('--apply')) {
    console.error('Migration blocked: this utility is read-only. Create and review a versioned migration after backup and schema inspection.');
    process.exitCode = 2;
  } else {
    inspectDatabase().then((result) => console.log(JSON.stringify(result, null, 2)))
      .catch((error) => { console.error(`Preflight failed: ${error.message}`); process.exitCode = 1; });
  }
}
module.exports = { readConfig, inspectDatabase };
