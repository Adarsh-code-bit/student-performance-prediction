const http = require('http');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { getJwtSecret, getAllowedOrigins } = require('./config/security.config');
const socketService = require('./services/socket.service');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
// Fail before listening if authentication cannot be configured securely.
getJwtSecret();
const allowedOrigins = getAllowedOrigins();
socketService.init(server, allowedOrigins);

// Trust first proxy hop (Railway, Render, Cloudflare, Vercel) for accurate client IPs and SSL detection
app.set('trust proxy', 1);

// ─── Security Headers Middleware ────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// ─── Middleware ─────────────────────────────────────────────
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    try {
      const originUrl = new URL(origin);
      const isLoopback = originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1' || originUrl.hostname === '::1';
      if (isLoopback && (process.env.NODE_ENV !== 'production' || allowedOrigins.includes(origin))) {
        return callback(null, true);
      }
      const hasMatchingPort = allowedOrigins.some(ao => {
        try {
          const aoUrl = new URL(ao);
          return aoUrl.port === originUrl.port && (aoUrl.hostname === 'localhost' || aoUrl.hostname === '127.0.0.1' || aoUrl.hostname === '::1');
        } catch (e) {
          return false;
        }
      });
      if (isLoopback && hasMatchingPort) return callback(null, true);
    } catch (e) {}
    const error = new Error(`Origin ${origin} is not allowed by CORS.`);
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
  const isProd = process.env.NODE_ENV === 'production';
  const statusCode = err.status || 500;
  const message = statusCode === 403 
    ? err.message 
    : (isProd && statusCode === 500 ? 'Internal server error' : (err.message || 'Internal server error'));
  res.status(statusCode).json({
    success: false,
    message,
  });
});

// ─── Start Server ─────────────────────────────────────────
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`\n🚀 Smart Inventory API is running on http://${HOST}:${PORT}`);
  console.log(`📡 Health check: http://${HOST}:${PORT}/api/health`);
  console.log(`📦 API base:     http://${HOST}:${PORT}/api\n`);
});

// ─── Graceful Shutdown ────────────────────────────────────
const pool = require('./config/db.config');
function handleGracefulShutdown(signal) {
  console.log(`\n${signal} received. Closing HTTP server and WebSocket connections...`);
  server.close(async () => {
    console.log('HTTP and WebSocket server closed.');
    try {
      await pool.end();
      console.log('Database connections closed cleanly.');
    } catch (e) {
      console.error('Error closing database pool:', e.message);
    }
    process.exit(0);
  });
  setTimeout(() => {
    console.error('Graceful shutdown timeout exceeded. Forcing exit.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

module.exports = app;
module.exports.server = server;

