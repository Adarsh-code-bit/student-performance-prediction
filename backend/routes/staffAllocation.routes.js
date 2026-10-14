const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/staffAllocation.controller');
const { verifyToken, isManagerOrAdmin } = require('../middleware/auth.middleware');

// All staff allocation routes require Manager or Admin authorization
router.use(verifyToken, isManagerOrAdmin);

router.get('/staff', ctrl.getStaff);
router.get('/backlog', ctrl.getBacklog);
router.post('/assign', ctrl.assign);
router.post('/end/:id', ctrl.endAssignment);
router.get('/history', ctrl.getHistory);

module.exports = router;
