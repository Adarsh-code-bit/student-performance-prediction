const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const fs = require('fs');

const path = require('path');

dotenv.config();
if (process.env.SKIP_LOCAL_DOTENV !== 'true' && process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
}

function buildPoolConfig(env = process.env) {
  let host = env.DB_HOST || 'localhost';
  let port = Number(env.DB_PORT) || 3306;
  let user = env.DB_USER || 'root';
  let password = env.DB_PASSWORD || '';
  let database = env.DB_NAME || 'smart_inventory';

  const connUrl = env.DATABASE_URL || env.MYSQL_URL;
  if (connUrl && typeof connUrl === 'string' && (connUrl.startsWith('mysql://') || connUrl.startsWith('mysql2://'))) {
    try {
      const parsed = new URL(connUrl);
      host = parsed.hostname || host;
      port = parsed.port ? Number(parsed.port) : port;
      user = parsed.username ? decodeURIComponent(parsed.username) : user;
      password = parsed.password ? decodeURIComponent(parsed.password) : password;
      const dbPath = parsed.pathname ? parsed.pathname.replace(/^\//, '') : '';
      if (dbPath) database = dbPath;
    } catch (e) {
      // Keep explicit param fallbacks
    }
  }

  const poolConfig = {
    host,
    port,
    user,
    password,
    database,
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
      if (caVal.includes('BEGIN CERTIFICATE')) {
        sslConfig.ca = caVal.includes('\\n') ? caVal.replace(/\\n/g, '\n') : caVal;
      } else if (fs.existsSync(caVal)) {
        sslConfig.ca = fs.readFileSync(caVal, 'utf8');
      } else {
        throw new Error(`CA certificate file not found at path: ${caVal}`);
      }
    }

    poolConfig.ssl = sslConfig;
  }

  return poolConfig;
}

const pool = mysql.createPool(buildPoolConfig(process.env));

pool.buildPoolConfig = buildPoolConfig;

module.exports = pool;

