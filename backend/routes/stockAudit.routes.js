const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/stockAudit.controller');
const { verifyToken, requireStaffRoles, isManagerOrAdmin } = require('../middleware/auth.middleware');

router.get('/', verifyToken, ctrl.getAll);
router.post('/', verifyToken, requireStaffRoles('AUDITOR'), ctrl.create);
router.put('/:id/review', verifyToken, isManagerOrAdmin, ctrl.review);
router.post('/:id/review', verifyToken, isManagerOrAdmin, ctrl.review);

module.exports = router;
