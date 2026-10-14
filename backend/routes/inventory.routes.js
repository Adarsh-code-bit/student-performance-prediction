const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.use(verifyToken);

router.get('/', inventoryController.getAll);
router.get('/:id', inventoryController.getOne);

module.exports = router;
