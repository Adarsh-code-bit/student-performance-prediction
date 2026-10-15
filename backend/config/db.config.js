const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config();

function buildPoolConfig(env = process.env) {
  const poolConfig = {
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT) || 3306,
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'smart_inventory',
    waitForConnections: true,
    connectionLimit: Number(env.DB_CONNECTION_LIMIT) || 10,
    queueLimit: 0,
  };

  if (env.DB_SSL === 'true') {
    const sslConfig = {
      rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
    };

    const caInput = env.DB_SSL_CA || env.DB_SSL_CA_PATH;
    if (caInput && typeof caInput === 'string' && caInput.trim()) {
      const caVal = caInput.trim();
      if (!caVal.includes('BEGIN CERTIFICATE') && fs.existsSync(caVal)) {
        sslConfig.ca = fs.readFileSync(caVal, 'utf8');
      } else {
        sslConfig.ca = caVal.includes('\\n') ? caVal.replace(/\\n/g, '\n') : caVal;
      }
    }

    poolConfig.ssl = sslConfig;
  }

  return poolConfig;
}

const pool = mysql.createPool(buildPoolConfig(process.env));

pool.buildPoolConfig = buildPoolConfig;

module.exports = pool;

