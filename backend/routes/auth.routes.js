const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const authController = require('../controllers/auth.controller');
const auditController = require('../controllers/audit.controller');
const { verifyToken, isAdmin, isManagerOrAdmin } = require('../middleware/auth.middleware');
const { otpSendLimiter, otpVerifyLimiter, signupLimiter, loginLimiter } = require('../middleware/rateLimit.middleware');

// Public Authentication & Registration Routes
router.post('/auth/login', loginLimiter, authController.login);
router.post('/auth/send-otp', otpSendLimiter, authController.sendRegistrationOtp);
router.post('/auth/verify-otp', otpVerifyLimiter, authController.verifyRegistrationOtp);
router.post('/auth/signup', signupLimiter, authController.signup);

// Protected Auth Profile
router.get('/auth/me', verifyToken, authController.me);

// Employee Approval Workflow (Protected: Admin & Store Manager)
router.get('/users/pending-registrations', verifyToken, isManagerOrAdmin, userController.getPendingRegistrations);
router.post('/users/:id/approve', verifyToken, isManagerOrAdmin, userController.approveRegistration);
router.post('/users/:id/reject', verifyToken, isManagerOrAdmin, userController.rejectRegistration);

// User Management (Protected)
router.get('/users', verifyToken, isManagerOrAdmin, userController.getAll);
router.get('/users/:id', verifyToken, isManagerOrAdmin, userController.getById);
router.post('/users', verifyToken, isAdmin, userController.create);
router.put('/users/:id', verifyToken, isAdmin, userController.update);
router.delete('/users/:id', verifyToken, isAdmin, userController.remove);

// Audit Logs (Protected: Admin & Store Manager only)
router.get('/audit-logs', verifyToken, isManagerOrAdmin, auditController.getAll);

module.exports = router;
