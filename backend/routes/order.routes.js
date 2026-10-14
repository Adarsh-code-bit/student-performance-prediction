const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/order.controller');
const { verifyToken, requireStaffRoles, isManagerOrAdmin } = require('../middleware/auth.middleware');

router.use(verifyToken);

// Queues for Pickers & Packers
router.get('/picking-queue', requireStaffRoles('PICKER'), ctrl.getPickingQueue);
router.get('/packing-queue', requireStaffRoles('PACKER'), ctrl.getPackingQueue);
router.get('/queue/picking', requireStaffRoles('PICKER'), ctrl.getPickingQueue);
router.get('/queue/packing', requireStaffRoles('PACKER'), ctrl.getPackingQueue);

// Order List & Details
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);

// Picking Workflow Actions (Pickers & temporarily reassigned Pickers)
router.post('/:id/claim-picking', requireStaffRoles('PICKER'), ctrl.claimPicking);
router.post('/:id/complete-picking', requireStaffRoles('PICKER'), ctrl.completePicking);

// Packing Workflow Actions (Packers)
router.post('/:id/claim-packing', requireStaffRoles('PACKER'), ctrl.claimPacking);
router.post('/:id/complete-packing', requireStaffRoles('PACKER'), ctrl.completePacking);

// General status transitions
router.put('/:id/status', isManagerOrAdmin, ctrl.updateStatus);

module.exports = router;

