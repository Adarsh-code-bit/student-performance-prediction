const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/purchase.controller');
const { verifyToken, isManagerOrAdmin, requireStaffRoles } = require('../middleware/auth.middleware');

router.use(verifyToken);

// Accessible by Admin, Store Manager, or Inventory Clerk
const canManagePurchases = (req, res, next) => {
  if (req.user.role === 'ADMIN' || req.user.role === 'STORE_MANAGER') return next();
  const effectiveSubrole = (req.user.role === 'STAFF' && req.user.active_assignment) 
    ? req.user.active_assignment 
    : req.user.staff_subrole;
  if (effectiveSubrole === 'INVENTORY_CLERK') return next();
  return res.status(403).json({ success: false, message: 'Forbidden: Insufficient permissions for purchases' });
};

router.get('/', canManagePurchases, ctrl.getAll);
router.get('/:id', canManagePurchases, ctrl.getById);
router.post('/', canManagePurchases, ctrl.create);

module.exports = router;
