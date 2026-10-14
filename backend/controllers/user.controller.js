const pool = require('../config/db.config');
const bcrypt = require('bcryptjs');
const { parseId } = require('../utils/validate.util');

const VALID_ROLES = ['ADMIN', 'STORE_MANAGER', 'STAFF'];
const VALID_SUBROLES = ['AUDITOR', 'PICKER', 'PACKER', 'INVENTORY_CLERK'];

exports.getAll = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.user_id, u.user_name, u.email, u.role, u.staff_subrole, u.store_id, u.is_active, u.created_at,
             s.store_name,
             sa.assigned_role AS active_assignment
      FROM \`user\` u
      LEFT JOIN store s ON u.store_id = s.store_id
      LEFT JOIN staff_allocation sa ON u.user_id = sa.user_id AND sa.status = 'ACTIVE'
      ORDER BY u.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid user ID' });

    const [rows] = await pool.query(`
      SELECT u.user_id, u.user_name, u.email, u.role, u.staff_subrole, u.store_id, u.is_active, u.created_at,
             s.store_name
      FROM \`user\` u
      LEFT JOIN store s ON u.store_id = s.store_id
      WHERE u.user_id = ?
    `, [id]);

    if (rows.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    let { user_name, email, password, role, staff_subrole, store_id } = req.body;
    if (!user_name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Missing required fields: user_name, email, password, and role' });
    }

    role = role.toUpperCase();
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid role: ${role}. Valid roles are: ${VALID_ROLES.join(', ')}` 
      });
    }

    // Role-subrole integrity validation
    if (role === 'STAFF') {
      if (!staff_subrole || !VALID_SUBROLES.includes(staff_subrole.toUpperCase())) {
        return res.status(400).json({ 
          success: false, 
          message: `Staff role requires a valid subrole: ${VALID_SUBROLES.join(', ')}` 
        });
      }
      staff_subrole = staff_subrole.toUpperCase();
    } else {
      staff_subrole = null; // Admin and Store Manager have no subrole
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const [result] = await pool.query(
      'INSERT INTO `user` (user_name, email, password_hash, role, staff_subrole, store_id, is_active) VALUES (?, ?, ?, ?, ?, ?, TRUE)',
      [user_name, email, hash, role, staff_subrole, store_id || null]
    );

    res.status(201).json({ 
      success: true, 
      message: 'User created successfully', 
      data: { insertId: result.insertId } 
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid user ID' });

    let { user_name, email, role, staff_subrole, store_id, is_active, password } = req.body;

    if (role) {
      role = role.toUpperCase();
      if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ success: false, message: `Invalid role: ${role}` });
      }
      if (role === 'STAFF' && staff_subrole) {
        staff_subrole = staff_subrole.toUpperCase();
        if (!VALID_SUBROLES.includes(staff_subrole)) {
          return res.status(400).json({ success: false, message: `Invalid staff subrole: ${staff_subrole}` });
        }
      } else if (role !== 'STAFF') {
        staff_subrole = null;
      }
    }

    let passwordClause = '';
    const params = [user_name, email, role, staff_subrole, store_id, is_active];

    if (password && password.trim()) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      passwordClause = ', password_hash = ?';
      params.push(hash);
    }
    params.push(id);

    const [result] = await pool.query(
      `UPDATE \`user\` 
       SET user_name = COALESCE(?, user_name), 
           email = COALESCE(?, email), 
           role = COALESCE(?, role), 
           staff_subrole = ?, 
           store_id = COALESCE(?, store_id), 
           is_active = COALESCE(?, is_active)
           ${passwordClause}
       WHERE user_id = ?`,
      params
    );

    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid user ID' });

    // Prevent deactivating own account if Admin
    if (req.user && req.user.user_id === id) {
      return res.status(400).json({ success: false, message: 'Cannot deactivate your own account' });
    }

    const [result] = await pool.query('UPDATE `user` SET is_active = FALSE WHERE user_id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'User deactivated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
