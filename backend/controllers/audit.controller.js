const pool = require('../config/db.config');

exports.getAll = async (req, res) => {
  try {
    let sql = `
      SELECT a.*, u.user_name
      FROM audit_log a
      JOIN \`user\` u ON a.user_id = u.user_id
      WHERE 1=1
    `;
    const params = [];

    if (req.query.user_id) {
      sql += ' AND a.user_id = ?';
      params.push(req.query.user_id);
    }
    if (req.query.action) {
      sql += ' AND a.action = ?';
      params.push(req.query.action);
    }
    if (req.query.table_name) {
      sql += ' AND a.table_name = ?';
      params.push(req.query.table_name);
    }
    if (req.query.date) {
      sql += ' AND DATE(a.action_date) = ?';
      params.push(req.query.date);
    }

    sql += ' ORDER BY a.action_date DESC';

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
