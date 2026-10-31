/**
 * Rate Limiting Middleware for Sensitive Authentication and OTP Operations
 * In-memory sliding window implementation with zero external dependencies.
 */

const rateStore = new Map();

// Periodic cleanup of stale rate-limit buckets every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateStore.entries()) {
    if (now > data.resetTime) {
      rateStore.delete(key);
    }
  }
}, 10 * 60 * 1000).unref();

/**
 * Creates a rate limiter middleware.
 * @param {Object} options
 * @param {number} options.windowMs Window size in milliseconds
 * @param {number} options.max Maximum requests permitted in window
 * @param {number} [options.cooldownMs] Minimum interval between consecutive requests
 * @param {string} [options.message] Custom error message
 * @param {function} [options.keyGenerator] Function to derive bucket key from request
 */
function createRateLimiter(options) {
  const {
    windowMs = 15 * 60 * 1000,
    max = 5,
    cooldownMs = 0,
    message = 'Too many requests. Please wait before trying again.',
    keyGenerator = (req) => req.ip || req.connection?.remoteAddress || 'global'
  } = options;

  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();

    let entry = rateStore.get(key);

    if (!entry || now > entry.resetTime) {
      entry = {
        count: 1,
        lastRequestTime: now,
        resetTime: now + windowMs
      };
      rateStore.set(key, entry);
      return next();
    }

    // Cooldown check between immediate consecutive actions
    if (cooldownMs > 0 && (now - entry.lastRequestTime) < cooldownMs) {
      const waitSeconds = Math.ceil((cooldownMs - (now - entry.lastRequestTime)) / 1000);
      return res.status(429).json({
        success: false,
        message: `Please wait ${waitSeconds} second${waitSeconds > 1 ? 's' : ''} before requesting another code.`,
        retryAfter: waitSeconds
      });
    }

    if (entry.count >= max) {
      const waitMinutes = Math.ceil((entry.resetTime - now) / 60000);
      return res.status(429).json({
        success: false,
        message: `${message} Try again in ${waitMinutes} minute${waitMinutes > 1 ? 's' : ''}.`,
        retryAfterMinutes: waitMinutes
      });
    }

    entry.count += 1;
    entry.lastRequestTime = now;
    return next();
  };
}

// Preconfigured rate limiters
const otpSendLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                   // Max 5 OTPs per 15 mins
  cooldownMs: 45 * 1000,    // 45 seconds cooldown between resends
  message: 'OTP request rate limit reached.',
  keyGenerator: (req) => {
    const phone = (req.body?.phone || '').replace(/\D/g, '');
    const ip = req.ip || req.connection?.remoteAddress || 'ip';
    return `otp_send_${phone || ip}`;
  }
});

const otpVerifyLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many verification attempts.',
  keyGenerator: (req) => {
    const phone = (req.body?.phone || '').replace(/\D/g, '');
    return `otp_verify_${phone || req.ip}`;
  }
});

const signupLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,                  // Max 10 accounts created per hour from same IP
  message: 'Registration rate limit exceeded for this network.',
  keyGenerator: (req) => req.ip || req.connection?.remoteAddress || 'signup_global'
});

const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 1000 : 20, // 20 attempts per 15 mins in production
  message: 'Too many login attempts. Please wait before trying again.',
  keyGenerator: (req) => {
    const id = (req.body?.email || '').trim().toLowerCase();
    const ip = req.ip || req.connection?.remoteAddress || 'ip';
    return `login_${id}_${ip}`;
  }
});

module.exports = {
  createRateLimiter,
  otpSendLimiter,
  otpVerifyLimiter,
  signupLimiter,
  loginLimiter
};

