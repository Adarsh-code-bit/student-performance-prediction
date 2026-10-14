const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

function readConfig(env = process.env) {
  const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missing = required.filter((key) => !env[key]);
  if (missing.length) throw new Error(`Missing required database configuration: ${missing.join(', ')}`);
  if (!/^[A-Za-z0-9_]+$/.test(env.DB_NAME)) throw new Error('DB_NAME must contain only letters, numbers, and underscores.');
  return { host: env.DB_HOST, port: Number(env.DB_PORT), user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME };
}

async function setupDatabase({ env = process.env, argv = process.argv, mysqlDriver = mysql } = {}) {
  if (!argv.includes('--initialize-empty')) {
    throw new Error('Refusing database setup. This command only initializes a NEW, EMPTY development database. Pass --initialize-empty explicitly. Existing databases require a reviewed backup and a separate migration procedure.');
  }
  const config = readConfig(env);
  const connection = await mysqlDriver.createConnection({ ...config, multipleStatements: true });
  try {
    const [rows] = await connection.query('SELECT COUNT(*) AS table_count FROM information_schema.tables WHERE table_schema = ?', [config.database]);
    if (Number(rows[0].table_count) > 0) throw new Error(`Database ${config.database} already contains tables; initialization is blocked to preserve data.`);
    // Schema scripts contain CREATE DATABASE/USE and seed data. Run only after explicit
    // opt-in and confirming the configured database is empty. Never drop or reset it.
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const seedPath = path.join(__dirname, '..', 'database', 'seed-users.sql');
    await connection.query(fs.readFileSync(schemaPath, 'utf8'));
    await connection.query(fs.readFileSync(seedPath, 'utf8'));
    console.log(`Initialized empty development database ${config.database}.`);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  setupDatabase().catch((error) => { console.error(`Database initialization refused/failed: ${error.message}`); process.exitCode = 1; });
}
module.exports = { readConfig, setupDatabase };

