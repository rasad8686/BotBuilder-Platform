/**
 * Rate Limit Headers Middleware
 * Adds rate limit information to response headers
 */

// Simple in-memory rate limiter (use Redis in production)
const rateLimitStore = new Map();
const WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_LIMIT = 100;

// Cleanup old entries
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore) {
    if (now - value.windowStart > WINDOW_MS) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000);

function rateLimitHeaders(options = {}) {
  const limit = options.limit || DEFAULT_LIMIT;
  const windowMs = options.windowMs || WINDOW_MS;

  return (req, res, next) => {
    const key = req.user?.id || req.ip;
    const now = Date.now();

    let record = rateLimitStore.get(key);

    if (!record || now - record.windowStart > windowMs) {
      record = {
        count: 0,
        windowStart: now
      };
    }

    record.count++;
    rateLimitStore.set(key, record);

    const remaining = Math.max(0, limit - record.count);
    const reset = Math.ceil((record.windowStart + windowMs) / 1000);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', reset);
    res.setHeader('X-RateLimit-Policy', `${limit};w=${windowMs / 1000}`);

    // If limit exceeded, return error
    if (record.count > limit) {
      res.setHeader('Retry-After', Math.ceil((record.windowStart + windowMs - now) / 1000));
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later'
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: 'v2',
          retryAfter: Math.ceil((record.windowStart + windowMs - now) / 1000)
        },
        _wrapped: true
      });
    }

    next();
  };
}

module.exports = rateLimitHeaders;
