const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { getJwtSecret, getAllowedOrigins } = require('./config/security.config');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
// Fail before listening if authentication cannot be configured securely.
getJwtSecret();
const allowedOrigins = getAllowedOrigins();

// ─── Middleware ─────────────────────────────────────────────
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    const error = new Error('Origin is not allowed by CORS.');
    error.status = 403;
    return callback(error);
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Route Imports ─────────────────────────────────────────
const healthRoutes        = require('./routes/health.routes');
const dashboardRoutes     = require('./routes/dashboard.routes');
const categoryRoutes      = require('./routes/category.routes');
const productRoutes       = require('./routes/product.routes');
const supplierRoutes      = require('./routes/supplier.routes');
const purchaseRoutes      = require('./routes/purchase.routes');
const batchRoutes         = require('./routes/batch.routes');
const inventoryRoutes     = require('./routes/inventory.routes');
const locationRoutes      = require('./routes/location.routes');
const customerRoutes      = require('./routes/customer.routes');
const orderRoutes         = require('./routes/order.routes');
const stockMovementRoutes = require('./routes/stockMovement.routes');
const analyticsRoutes     = require('./routes/analytics.routes');
const authRoutes          = require('./routes/auth.routes');
const staffAllocationRoutes = require('./routes/staffAllocation.routes');
const stockAuditRoutes    = require('./routes/stockAudit.routes');

// ─── Route Registration ───────────────────────────────────
app.use('/api',                 healthRoutes);
app.use('/api',                 authRoutes); // Contains /auth/login, /users, /audit-logs
app.use('/api/dashboard',       dashboardRoutes);
app.use('/api/categories',      categoryRoutes);
app.use('/api/products',        productRoutes);
app.use('/api/suppliers',       supplierRoutes);
app.use('/api/purchases',       purchaseRoutes);
app.use('/api/batches',         batchRoutes);
app.use('/api/inventory',       inventoryRoutes);
app.use('/api/locations',       locationRoutes);
app.use('/api/customers',       customerRoutes);
app.use('/api/orders',          orderRoutes);
app.use('/api/stock-movements', stockMovementRoutes);
app.use('/api/analytics',       analyticsRoutes);
app.use('/api/staff-allocation', staffAllocationRoutes);
app.use('/api/stock-audits',    stockAuditRoutes);

// ─── 404 Handler ──────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

// ─── Global Error Handler ─────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: 'Internal server error',
  });
});

// ─── Start Server ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Smart Inventory API is running on http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📦 API base:     http://localhost:${PORT}/api\n`);
});

module.exports = app;



