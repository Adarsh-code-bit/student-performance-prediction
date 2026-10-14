const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/location.controller');
const { verifyToken, isManagerOrAdmin } = require('../middleware/auth.middleware');

router.use(verifyToken);

const canManageLocations = (req, res, next) => {
  if (req.user.role === 'ADMIN' || req.user.role === 'STORE_MANAGER') return next();
  const effectiveSubrole = (req.user.role === 'STAFF' && req.user.active_assignment) 
    ? req.user.active_assignment 
    : req.user.staff_subrole;
  if (effectiveSubrole === 'INVENTORY_CLERK') return next();
  return res.status(403).json({ success: false, message: 'Forbidden: Insufficient permissions for location modification' });
};

router.get('/', ctrl.getAll);
router.post('/', canManageLocations, ctrl.create);
router.put('/:id', canManageLocations, ctrl.update);
router.delete('/:id', canManageLocations, ctrl.remove);

module.exports = router;
