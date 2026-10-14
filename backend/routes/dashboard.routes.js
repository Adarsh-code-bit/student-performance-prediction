const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/dashboard.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.use(verifyToken);

router.get('/stats', ctrl.getStats);
router.get('/sales-chart', ctrl.getSalesChart);
router.get('/inventory-status', ctrl.getInventoryStatus);
router.get('/top-selling', ctrl.getTopSelling);
router.get('/low-stock', ctrl.getLowStock);
router.get('/recent-orders', ctrl.getRecentOrders);
router.get('/recent-movements', ctrl.getRecentMovements);

module.exports = router;
