const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/supplier.controller');
const { verifyToken, isAdmin } = require('../middleware/auth.middleware');

router.use(verifyToken);

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', isAdmin, ctrl.create);
router.put('/:id', isAdmin, ctrl.update);
router.delete('/:id', isAdmin, ctrl.remove);

module.exports = router;
