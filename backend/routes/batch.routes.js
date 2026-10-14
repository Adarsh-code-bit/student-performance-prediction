const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batch.controller');
const { verifyToken, isManagerOrAdmin } = require('../middleware/auth.middleware');

router.use(verifyToken);

const canManageBatches = (req, res, next) => {
  if (req.user.role === 'ADMIN' || req.user.role === 'STORE_MANAGER') return next();
  const effectiveSubrole = (req.user.role === 'STAFF' && req.user.active_assignment) 
    ? req.user.active_assignment 
    : req.user.staff_subrole;
  if (effectiveSubrole === 'INVENTORY_CLERK') return next();
  return res.status(403).json({ success: false, message: 'Forbidden: Insufficient permissions for batch modification' });
};

router.get('/', batchController.getAll);
router.get('/:id', batchController.getOne);
router.post('/', canManageBatches, batchController.create);
router.put('/:id', canManageBatches, batchController.update);

module.exports = router;
