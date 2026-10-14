const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/stockMovement.controller');
const { verifyToken, requireStaffRoles } = require('../middleware/auth.middleware');

router.use(verifyToken);

router.get('/', ctrl.getAll);
router.post('/', requireStaffRoles('INVENTORY_CLERK'), ctrl.create);

module.exports = router;
