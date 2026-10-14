const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const { verifyToken, isManagerOrAdmin } = require('../middleware/auth.middleware');

router.use(verifyToken, isManagerOrAdmin);

router.get('/dashboard', analyticsController.getDashboard);
router.get('/low-stock', analyticsController.getLowStock);
router.get('/reorder', analyticsController.getReorder);
router.get('/expired', analyticsController.getExpired);
router.get('/near-expiry', analyticsController.getNearExpiry);
router.get('/fast-moving', analyticsController.getFastMoving);
router.get('/slow-moving', analyticsController.getSlowMoving);

module.exports = router;
