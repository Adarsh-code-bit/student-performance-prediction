const pool = require('../config/db.config');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/security.config');

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const [rows] = await pool.query('SELECT * FROM `user` WHERE email = ? AND is_active = TRUE', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if employee has an active temporary operational allocation
    let activeAssignment = null;
    let allocationId = null;
    if (user.role === 'STAFF') {
      const [allocRows] = await pool.query(
        "SELECT allocation_id, assigned_role FROM staff_allocation WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1",
        [user.user_id]
      );
      if (allocRows.length > 0) {
        activeAssignment = allocRows[0].assigned_role;
        allocationId = allocRows[0].allocation_id;
      }
    }

    const tokenPayload = {
      user_id: user.user_id,
      user_name: user.user_name,
      email: user.email,
      role: user.role,
      staff_subrole: user.staff_subrole,
      store_id: user.store_id
    };

    const token = jwt.sign(
      tokenPayload,
      getJwtSecret(),
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          user_id: user.user_id,
          user_name: user.user_name,
          email: user.email,
          role: user.role,
          staff_subrole: user.staff_subrole,
          store_id: user.store_id,
          active_assignment: activeAssignment,
          allocation_id: allocationId
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.me = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT user_id, user_name, email, role, staff_subrole, store_id, is_active FROM `user` WHERE user_id = ? AND is_active = TRUE',
      [req.user.user_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = rows[0];
    let activeAssignment = null;
    let allocationId = null;
    if (user.role === 'STAFF') {
      const [allocRows] = await pool.query(
        "SELECT allocation_id, assigned_role FROM staff_allocation WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1",
        [user.user_id]
      );
      if (allocRows.length > 0) {
        activeAssignment = allocRows[0].assigned_role;
        allocationId = allocRows[0].allocation_id;
      }
    }

    res.json({
      success: true,
      data: {
        user: {
          ...user,
          active_assignment: activeAssignment,
          allocation_id: allocationId
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

