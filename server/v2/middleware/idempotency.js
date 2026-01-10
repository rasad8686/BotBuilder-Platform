/**
 * Idempotency Middleware
 * Ensures POST/PUT/PATCH requests can be safely retried
 */

const crypto = require('crypto');
const { ErrorCodes } = require('../constants/errorCodes');

// In-memory store (use Redis in production)
const idempotencyStore = new Map();
const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of idempotencyStore) {
    if (now - value.timestamp > EXPIRY_MS) {
      idempotencyStore.delete(key);
    }
  }
}, 60 * 60 * 1000); // Every hour

function idempotency(req, res, next) {
  // Only apply to mutating methods
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
    return next();
  }

  const idempotencyKey = req.headers['idempotency-key'];

  // If no key provided, proceed normally
  if (!idempotencyKey) {
    return next();
  }

  // Create fingerprint of request
  const fingerprint = crypto
    .createHash('sha256')
    .update(JSON.stringify({
      method: req.method,
      path: req.path,
      body: req.body
    }))
    .digest('hex');

  const userId = req.user?.id || 'anonymous';
  const storeKey = `${userId}:${idempotencyKey}`;

  // Check if we've seen this key before
  const existing = idempotencyStore.get(storeKey);

  if (existing) {
    // Check if the fingerprint matches
    if (existing.fingerprint !== fingerprint) {
      return res.apiError(ErrorCodes.IDEMPOTENCY_CONFLICT, {
        message: 'Idempotency key was already used with different request parameters'
      });
    }

    // Return cached response
    res.setHeader('X-Idempotency-Replayed', 'true');
    return res.status(existing.statusCode).json({
      ...existing.body,
      _wrapped: true
    });
  }

  // Store original json method
  const originalJson = res.json.bind(res);

  // Override to capture response
  res.json = function(body) {
    // Store response for future replay
    idempotencyStore.set(storeKey, {
      fingerprint,
      statusCode: res.statusCode,
      body,
      timestamp: Date.now()
    });

    return originalJson(body);
  };

  next();
}

module.exports = idempotency;
