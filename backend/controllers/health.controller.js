/**
 * Health Check Controller
 * Returns API status and database connectivity.
 */
const pool = require('../config/db.config');

const getHealth = async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    await pool.query('SELECT 1');
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = 'disconnected';
  }

  res.status(200).json({
    success: true,
    status: 'OK',
    message: 'Smart Inventory API is running',
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
};

module.exports = { getHealth };
