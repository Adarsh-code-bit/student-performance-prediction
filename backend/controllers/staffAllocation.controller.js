const pool = require('../config/db.config');
const { parseId } = require('../utils/validate.util');

/**
 * GET /api/staff-allocation/staff
 * Lists staff members with permanent subrole, active operational assignment, and picking eligibility.
 */
exports.getStaff = async (req, res) => {
  try {
    const storeId = req.user.role === 'ADMIN' ? req.query.store_id : req.user.store_id;

    let query = `
      SELECT u.user_id, u.user_name, u.email, u.role, u.staff_subrole, u.store_id, u.is_active,
             s.store_name,
             sa.allocation_id,
             sa.assigned_role,
             sa.start_time AS assignment_start_time,
             sa.reason AS assignment_reason,
             assigner.user_name AS assigned_by_name
      FROM \`user\` u
      LEFT JOIN store s ON u.store_id = s.store_id
      LEFT JOIN staff_allocation sa ON u.user_id = sa.user_id AND sa.status = 'ACTIVE'
      LEFT JOIN \`user\` assigner ON sa.assigned_by = assigner.user_id
      WHERE u.role = 'STAFF' AND u.is_active = TRUE
    `;
    const params = [];

    if (storeId) {
      query += ` AND u.store_id = ?`;
      params.push(storeId);
    }

    query += ` ORDER BY u.user_name ASC`;

    const [rows] = await pool.query(query, params);

    // Format availability and picking eligibility
    const staffWithEligibility = rows.map(staff => {
      const isReassigned = !!staff.assigned_role;
      const isOriginalPicker = staff.staff_subrole === 'PICKER';
      const isEligibleForPicking = !isOriginalPicker && !isReassigned && ['AUDITOR', 'PACKER', 'INVENTORY_CLERK'].includes(staff.staff_subrole);

      return {
        user_id: staff.user_id,
        user_name: staff.user_name,
        email: staff.email,
        store_id: staff.store_id,
        store_name: staff.store_name,
        permanent_subrole: staff.staff_subrole,
        current_assignment: staff.assigned_role || staff.staff_subrole,
        is_temporarily_reassigned: isReassigned,
        allocation_id: staff.allocation_id,
        assignment_start_time: staff.assignment_start_time,
        assignment_reason: staff.assignment_reason,
        assigned_by_name: staff.assigned_by_name,
        is_eligible_for_picking: isEligibleForPicking,
        status: isReassigned ? 'Reassigned (Picker)' : (isOriginalPicker ? 'Active Picker' : 'Regular Duties')
      };
    });

    res.json({ success: true, data: staffWithEligibility });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/staff-allocation/backlog
 * Returns picking queue backlog and intelligent reallocation recommendation.
 */
exports.getBacklog = async (req, res) => {
  try {
    const storeId = req.user.role === 'ADMIN' ? (req.query.store_id || 1) : (req.user.store_id || 1);

    // 1. Pending/unpicked orders
    const [backlogRows] = await pool.query(
      `SELECT COUNT(*) as count FROM orders 
       WHERE (store_id = ? OR store_id IS NULL) 
         AND status IN ('pending', 'confirmed', 'picking_queue')`,
      [storeId]
    );
    const unpickedOrders = backlogRows[0].count;

    // 2. Active pickers (permanent + temporarily assigned)
    const [pickerRows] = await pool.query(`
      SELECT COUNT(DISTINCT u.user_id) as count
      FROM \`user\` u
      LEFT JOIN staff_allocation sa ON u.user_id = sa.user_id AND sa.status = 'ACTIVE'
      WHERE u.role = 'STAFF' AND u.is_active = TRUE AND (u.store_id = ? OR u.store_id IS NULL)
        AND (u.staff_subrole = 'PICKER' OR sa.assigned_role = 'PICKER')
    `, [storeId]);
    const activePickers = pickerRows[0].count;

    // Recommendation logic
    const isBacklogHigh = unpickedOrders > 3 || (unpickedOrders > 0 && activePickers === 0);
    const recommendedPickers = Math.max(1, Math.ceil(unpickedOrders / 2));

    res.json({
      success: true,
      data: {
        store_id: storeId,
        unpicked_orders: unpickedOrders,
        active_pickers: activePickers,
        recommended_pickers: recommendedPickers,
        is_backlog_high: isBacklogHigh,
        recommendation: isBacklogHigh 
          ? `High picking backlog detected (${unpickedOrders} pending orders). Reallocating available staff to Picker duties is recommended.`
          : 'Order volume is normal. Standard staff allocation is sufficient.'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/staff-allocation/assign
 * Temporarily reassigns an eligible employee to Picker duties.
 * Preserves permanent subrole and tracks start time & assigner.
 */
exports.assign = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { user_id, assigned_role = 'PICKER', reason, notes } = req.body;
    const targetUserId = parseId(user_id);

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'Valid employee user_id is required' });
    }

    // 1. Fetch employee
    const [userRows] = await connection.query(
      'SELECT user_id, user_name, role, staff_subrole, store_id, is_active FROM `user` WHERE user_id = ?',
      [targetUserId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const employee = userRows[0];
    if (!employee.is_active) {
      return res.status(400).json({ success: false, message: 'Cannot assign inactive employee' });
    }
    if (employee.role !== 'STAFF') {
      return res.status(400).json({ success: false, message: 'Only staff members can be assigned operational duties' });
    }
    if (employee.staff_subrole === assigned_role) {
      return res.status(400).json({ 
        success: false, 
        message: `Employee is already permanently assigned as ${assigned_role}. Temporary assignment is redundant.` 
      });
    }

    // 2. Prevent conflicting active assignments
    const [conflictRows] = await connection.query(
      "SELECT allocation_id, assigned_role FROM staff_allocation WHERE user_id = ? AND status = 'ACTIVE'",
      [targetUserId]
    );

    if (conflictRows.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Employee already has an active assignment as ${conflictRows[0].assigned_role}. End the active assignment first.`
      });
    }

    await connection.beginTransaction();

    // 3. Create allocation record
    const [allocResult] = await connection.query(
      `INSERT INTO staff_allocation 
       (user_id, original_subrole, assigned_role, store_id, assigned_by, start_time, status, reason, notes)
       VALUES (?, ?, ?, ?, ?, NOW(), 'ACTIVE', ?, ?)`,
      [
        employee.user_id,
        employee.staff_subrole,
        assigned_role,
        employee.store_id || req.user.store_id || 1,
        req.user.user_id,
        reason || 'High order volume surge',
        notes || null
      ]
    );

    // 4. Record audit log
    await connection.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, details)
       VALUES (?, 'INSERT', 'staff_allocation', ?, ?)`,
      [
        req.user.user_id,
        allocResult.insertId,
        `Temporarily assigned ${employee.user_name} (${employee.staff_subrole} -> ${assigned_role}) due to: ${reason || 'High order volume'}`
      ]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: `Employee ${employee.user_name} successfully reassigned to ${assigned_role}. Permanent subrole remains ${employee.staff_subrole}.`,
      data: {
        allocation_id: allocResult.insertId,
        user_id: employee.user_id,
        permanent_subrole: employee.staff_subrole,
        current_assignment: assigned_role,
        status: 'ACTIVE'
      }
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

/**
 * POST /api/staff-allocation/end/:id
 * Ends a temporary assignment, restoring the employee's regular duties.
 */
exports.endAssignment = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const allocationId = parseId(req.params.id);
    if (!allocationId) {
      return res.status(400).json({ success: false, message: 'Invalid allocation ID' });
    }

    const [allocRows] = await connection.query(`
      SELECT sa.*, u.user_name 
      FROM staff_allocation sa
      JOIN \`user\` u ON sa.user_id = u.user_id
      WHERE sa.allocation_id = ?
    `, [allocationId]);

    if (allocRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Allocation record not found' });
    }

    const allocation = allocRows[0];
    if (allocation.status !== 'ACTIVE') {
      return res.status(400).json({ 
        success: false, 
        message: `Allocation is already closed (Status: ${allocation.status})` 
      });
    }

    await connection.beginTransaction();

    // End assignment
    await connection.query(
      `UPDATE staff_allocation 
       SET status = 'COMPLETED', end_time = NOW() 
       WHERE allocation_id = ?`,
      [allocationId]
    );

    // Audit log
    await connection.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, details)
       VALUES (?, 'UPDATE', 'staff_allocation', ?, ?)`,
      [
        req.user.user_id,
        allocationId,
        `Ended temporary assignment for ${allocation.user_name}. Returned to permanent role: ${allocation.original_subrole}.`
      ]
    );

    await connection.commit();

    res.json({
      success: true,
      message: `Temporary assignment ended for ${allocation.user_name}. Returned to regular duties as ${allocation.original_subrole}.`,
      data: {
        allocation_id: allocationId,
        permanent_subrole: allocation.original_subrole,
        current_assignment: allocation.original_subrole,
        status: 'COMPLETED'
      }
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

/**
 * GET /api/staff-allocation/history
 * Returns historical allocation log with start/end timestamps and assigner names.
 */
exports.getHistory = async (req, res) => {
  try {
    const storeId = req.user.role === 'ADMIN' ? req.query.store_id : req.user.store_id;

    let query = `
      SELECT sa.allocation_id, sa.original_subrole, sa.assigned_role, sa.start_time, sa.end_time,
             sa.status, sa.reason, sa.notes,
             u.user_id, u.user_name,
             assigner.user_name AS assigned_by_name,
             s.store_name
      FROM staff_allocation sa
      JOIN \`user\` u ON sa.user_id = u.user_id
      LEFT JOIN \`user\` assigner ON sa.assigned_by = assigner.user_id
      LEFT JOIN store s ON sa.store_id = s.store_id
    `;
    const params = [];

    if (storeId) {
      query += ` WHERE sa.store_id = ?`;
      params.push(storeId);
    }

    query += ` ORDER BY sa.created_at DESC LIMIT 100`;

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
