const jwt = require('jsonwebtoken');
const pool = require('../config/db.config');
const { getJwtSecret } = require('../config/security.config');

/**
 * Verifies JWT from Authorization header.
 * Attaches decoded payload and current active staff allocation to req.user.
 */
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  if (!token) {
    return res.status(401).json({ success: false, message: 'Invalid token format.' });
  }

  jwt.verify(token, getJwtSecret(), async (err, decoded) => {
    if (err) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Invalid or expired token.' });
    }

    try {
      req.user = decoded;

      // Check if user has an active temporary operational assignment
      if (decoded.role === 'STAFF') {
        const [allocRows] = await pool.query(
          "SELECT assigned_role, allocation_id FROM staff_allocation WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1",
          [decoded.user_id]
        );
        if (allocRows.length > 0) {
          req.user.active_assignment = allocRows[0].assigned_role;
          req.user.allocation_id = allocRows[0].allocation_id;
        } else {
          req.user.active_assignment = null;
        }
      }

      next();
    } catch (dbErr) {
      console.error('Error fetching staff allocation in middleware:', dbErr.message);
      next();
    }
  });
};

/**
 * Role-based authorization guard.
 * Allows access only if req.user.role matches one of the specified roles (case-insensitive).
 */
const requireRoles = (...allowedRoles) => {
  const normalized = allowedRoles.map(r => r.toUpperCase());
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const userRole = (req.user.role || '').toUpperCase();
    if (normalized.includes(userRole)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Access denied. Requires one of the following roles: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`
    });
  };
};

/**
 * Staff subrole authorization guard.
 * Allows Admins and Store Managers automatically.
 * For Staff, checks their active_assignment (if temporarily reassigned) or permanent staff_subrole.
 */
const requireStaffRoles = (...allowedSubroles) => {
  const normalized = allowedSubroles.map(s => s.toUpperCase());
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const userRole = (req.user.role || '').toUpperCase();
    // Admins and Store Managers have supervisor privileges over operational tasks
    if (userRole === 'ADMIN' || userRole === 'STORE_MANAGER') {
      return next();
    }

    // Determine current effective operational role
    const effectiveSubrole = (req.user.active_assignment || req.user.staff_subrole || '').toUpperCase();
    if (normalized.includes(effectiveSubrole)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Access denied. Task requires subrole [${allowedSubroles.join(', ')}]. Current operational role: ${effectiveSubrole || 'None'}`
    });
  };
};

// Aliases for common role guards
const isAdmin = requireRoles('ADMIN');
const isManagerOrAdmin = requireRoles('ADMIN', 'STORE_MANAGER');

module.exports = {
  verifyToken,
  requireRoles,
  requireStaffRoles,
  isAdmin,
  isManagerOrAdmin
};


