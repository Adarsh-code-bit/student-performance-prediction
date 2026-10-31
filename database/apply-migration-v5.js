const fs = require('fs');
const path = require('path');
const pool = require('../backend/config/db.config');

async function applyMigrationV5() {
  console.log('--- Applying Migration v5: Product Image Attributes Verification ---');
  const sqlFile = path.join(__dirname, 'migration-v5-product-image.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('USE'));

  const connection = await pool.getConnection();
  try {
    for (const stmt of statements) {
      if (stmt.trim()) {
        await connection.query(stmt);
      }
    }
    console.log('✓ Migration v5 applied successfully. Columns verified.');
  } catch (err) {
    console.error('Migration v5 error:', err.message);
    throw err;
  } finally {
    connection.release();
  }
}

if (require.main === module) {
  applyMigrationV5()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = applyMigrationV5;
