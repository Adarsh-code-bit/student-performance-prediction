const pool = require('../config/db.config');
const bcrypt = require('bcryptjs');
const { parseId } = require('../utils/validate.util');

const VALID_ROLES = ['ADMIN', 'STORE_MANAGER', 'STAFF'];
const VALID_SUBROLES = ['AUDITOR', 'PICKER', 'PACKER', 'INVENTORY_CLERK'];
const VALID_EMP_TYPES = ['FULL_TIME', 'PART_TIME'];

/**
 * Get all users (Admin & Store Manager)
 */
exports.getAll = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.user_id, u.employee_id, u.user_name, u.email, u.phone, 
             u.role, u.staff_subrole, u.employment_type, u.department,
             u.store_id, u.is_active, u.approval_status, u.is_mobile_verified, 
             u.created_at, u.approved_at,
             s.store_name,
             approver.user_name AS approved_by_name,
             sa.assigned_role AS active_assignment
      FROM \`user\` u
      LEFT JOIN store s ON u.store_id = s.store_id
      LEFT JOIN \`user\` approver ON u.approved_by = approver.user_id
      LEFT JOIN staff_allocation sa ON u.user_id = sa.user_id AND sa.status = 'ACTIVE'
      ORDER BY u.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get pending employee registrations awaiting manager approval
 */
exports.getPendingRegistrations = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.user_id, u.employee_id, u.user_name, u.email, u.phone,
             u.employment_type, u.department, u.role, u.staff_subrole,
             u.is_mobile_verified, u.created_at, u.approval_status
      FROM \`user\` u
      WHERE u.approval_status = 'PENDING_APPROVAL'
      ORDER BY u.created_at ASC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Approve a pending employee registration
 * Only authorized Admins and Store Managers can execute this.
 */
exports.approveRegistration = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid employee user ID' });

    const { store_id, staff_subrole } = req.body;

    // Check if target user exists and is pending approval
    const [targetRows] = await pool.query(
      'SELECT user_id, employee_id, user_name, email, phone, approval_status FROM `user` WHERE user_id = ?',
      [id]
    );

    if (targetRows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const targetUser = targetRows[0];
    if (targetUser.approval_status !== 'PENDING_APPROVAL') {
      return res.status(400).json({
        success: false,
        message: `Account is not in pending approval state (current status: ${targetUser.approval_status})`
      });
    }

    // Determine assigned store: specified store, supervisor's store, or Store #1 default
    const assignedStoreId = store_id ? parseId(store_id) : (req.user.store_id || 1);
    const assignedSubrole = staff_subrole && VALID_SUBROLES.includes(staff_subrole.toUpperCase())
      ? staff_subrole.toUpperCase()
      : 'PICKER';

    // Update user record: approve, activate, assign store & subrole
    await pool.query(
      `UPDATE \`user\` 
       SET approval_status = 'APPROVED',
           is_active = TRUE,
           store_id = ?,
           staff_subrole = ?,
           approved_by = ?,
           approved_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      [assignedStoreId, assignedSubrole, req.user.user_id, id]
    );

    // Record in audit log
    try {
      await pool.query(
        `INSERT INTO audit_log (user_id, action, table_name, record_id, details)
         VALUES (?, 'UPDATE', 'user', ?, ?)`,
        [
          req.user.user_id,
          id,
          `Employee approved by ${req.user.user_name} (${req.user.role}): Assigned to Store #${assignedStoreId} as ${assignedSubrole}`
        ]
      );
    } catch (auditErr) {
      console.warn('Audit log error on approve:', auditErr.message);
    }

    res.json({
      success: true,
      message: `Employee ${targetUser.user_name} (${targetUser.employee_id}) has been approved and activated.`
    });
  } catch (error) {
    console.error('Error approving registration:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Reject a pending employee registration
 * Only authorized Admins and Store Managers can execute this.
 */
exports.rejectRegistration = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid employee user ID' });

    const { reason } = req.body;

    const [targetRows] = await pool.query(
      'SELECT user_id, employee_id, user_name, approval_status FROM `user` WHERE user_id = ?',
      [id]
    );

    if (targetRows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const targetUser = targetRows[0];
    if (targetUser.approval_status !== 'PENDING_APPROVAL') {
      return res.status(400).json({
        success: false,
        message: `Account is not in pending approval state (current status: ${targetUser.approval_status})`
      });
    }

    const rejectionReason = reason && typeof reason === 'string' && reason.trim()
      ? reason.trim()
      : 'Application rejected by warehouse supervisor.';

    await pool.query(
      `UPDATE \`user\` 
       SET approval_status = 'REJECTED',
           is_active = FALSE,
           approved_by = ?,
           approved_at = CURRENT_TIMESTAMP,
           rejection_reason = ?
       WHERE user_id = ?`,
      [req.user.user_id, rejectionReason, id]
    );

    // Record in audit log
    try {
      await pool.query(
        `INSERT INTO audit_log (user_id, action, table_name, record_id, details)
         VALUES (?, 'UPDATE', 'user', ?, ?)`,
        [
          req.user.user_id,
          id,
          `Employee registration rejected by ${req.user.user_name} (${req.user.role}): ${rejectionReason}`
        ]
      );
    } catch (auditErr) {
      console.warn('Audit log error on reject:', auditErr.message);
    }

    res.json({
      success: true,
      message: `Employee registration for ${targetUser.user_name} has been rejected.`
    });
  } catch (error) {
    console.error('Error rejecting registration:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid user ID' });

    const [rows] = await pool.query(`
      SELECT u.user_id, u.employee_id, u.user_name, u.email, u.phone, 
             u.role, u.staff_subrole, u.employment_type, u.department,
             u.store_id, u.is_active, u.approval_status, u.is_mobile_verified, 
             u.created_at, u.approved_at,
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
    let { user_name, email, phone, password, role, staff_subrole, employment_type, department, store_id } = req.body;
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
      staff_subrole = null;
    }

    const empType = employment_type && VALID_EMP_TYPES.includes(employment_type.toUpperCase())
      ? employment_type.toUpperCase()
      : 'FULL_TIME';

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // Server-generated unique employee ID
    const [maxUser] = await pool.query("SELECT MAX(user_id) AS maxId FROM `user`");
    const nextId = (maxUser[0]?.maxId || 0) + 1;
    const employeeId = `EMP-${String(nextId).padStart(4, '0')}`;

    const [result] = await pool.query(
      `INSERT INTO \`user\` (
        user_name, employee_id, email, phone, password_hash, role, staff_subrole,
        employment_type, department, store_id, is_active, approval_status, is_mobile_verified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, 'APPROVED', TRUE)`,
      [
        user_name,
        employeeId,
        email,
        phone || null,
        hash,
        role,
        staff_subrole,
        empType,
        department || 'Warehouse Operations',
        store_id || null
      ]
    );

    res.status(201).json({ 
      success: true, 
      message: 'User created successfully', 
      data: { insertId: result.insertId, employee_id: employeeId } 
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Email or mobile number already registered' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid user ID' });

    let { user_name, email, phone, role, staff_subrole, employment_type, department, store_id, is_active, password } = req.body;

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
    const params = [user_name, email, phone, role, staff_subrole, employment_type, department, store_id, is_active];

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
           phone = COALESCE(?, phone),
           role = COALESCE(?, role), 
           staff_subrole = ?, 
           employment_type = COALESCE(?, employment_type),
           department = COALESCE(?, department),
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
