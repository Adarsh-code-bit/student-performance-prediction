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

// Manager Live Picking Activity Dashboard (Must be before /:id)
router.get('/manager/picking-activity', isManagerOrAdmin, ctrl.getManagerPickingActivity);
router.get('/:id/picking-history', isManagerOrAdmin, ctrl.getPickingHistory);

// Order List & Details
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);

// Picking Workflow Actions (Pickers & temporarily reassigned Pickers)
router.post('/:id/claim-picking', requireStaffRoles('PICKER'), ctrl.claimPicking);
router.post('/:id/start-picking', requireStaffRoles('PICKER'), ctrl.startPicking);
router.post('/:id/items/:allocationId/start', requireStaffRoles('PICKER'), ctrl.startItem);
router.post('/:id/items/:allocationId/confirm', requireStaffRoles('PICKER'), ctrl.confirmItem);
router.post('/:id/items/:allocationId/pause', requireStaffRoles('PICKER'), ctrl.pauseItem);
router.post('/:id/items/:allocationId/resume', requireStaffRoles('PICKER'), ctrl.resumeItem);
router.post('/:id/complete-picking', requireStaffRoles('PICKER'), ctrl.completePicking);

// Packing Workflow Actions (Packers)
router.post('/:id/claim-packing', requireStaffRoles('PACKER'), ctrl.claimPacking);
router.post('/:id/complete-packing', requireStaffRoles('PACKER'), ctrl.completePacking);

// General status transitions
router.put('/:id/status', isManagerOrAdmin, ctrl.updateStatus);

// Physical return confirmation for cancelled orders with picked items
router.post('/:id/items/:allocationId/confirm-return', isManagerOrAdmin, ctrl.confirmItemReturn);

module.exports = router;

