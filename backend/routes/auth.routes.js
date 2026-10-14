const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const authController = require('../controllers/auth.controller');
const auditController = require('../controllers/audit.controller');
const { verifyToken, isAdmin, isManagerOrAdmin } = require('../middleware/auth.middleware');

// Public route
router.post('/auth/login', authController.login);

// Protected Auth Profile
router.get('/auth/me', verifyToken, authController.me);

// User Management (Protected)
router.get('/users', verifyToken, isManagerOrAdmin, userController.getAll);
router.get('/users/:id', verifyToken, isManagerOrAdmin, userController.getById);
router.post('/users', verifyToken, isAdmin, userController.create);
router.put('/users/:id', verifyToken, isAdmin, userController.update);
router.delete('/users/:id', verifyToken, isAdmin, userController.remove);

// Audit Logs (Protected: Admin & Store Manager only)
router.get('/audit-logs', verifyToken, isManagerOrAdmin, auditController.getAll);

module.exports = router;
