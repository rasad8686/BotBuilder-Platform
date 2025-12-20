const rateLimit = require('express-rate-limit');
const db = require('../db');

// Cache for rate limit settings (refresh every 60 seconds)
let settingsCache = {
  enabled: true,
  max_attempts: 5,
  window_minutes: 15,
  block_duration_minutes: 15,
  lastFetch: 0
};

const CACHE_TTL = 5000; // 5 seconds - faster refresh for admin changes

// Fetch rate limit settings from database
async function getRateLimitSettings() {
  const now = Date.now();
  if (now - settingsCache.lastFetch < CACHE_TTL) {
    return settingsCache;
  }

  try {
    const result = await db.query('SELECT * FROM rate_limit_settings ORDER BY id DESC LIMIT 1');
    if (result.rows.length > 0) {
      settingsCache = {
        enabled: result.rows[0].enabled,
        max_attempts: result.rows[0].max_attempts,
        window_minutes: result.rows[0].window_minutes,
        block_duration_minutes: result.rows[0].block_duration_minutes,
        lastFetch: now
      };
    }
  } catch (error) {
    // If table doesn't exist yet, use defaults
  }

  return settingsCache;
}

// Check if IP/email is blocked
async function isBlocked(ip, email) {
  try {
    const result = await db.query(
      `SELECT * FROM rate_limit_blocked
       WHERE (ip_address = $1 OR email = $2)
       AND blocked_until > NOW()
       LIMIT 1`,
      [ip, email || '']
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    return null;
  }
}

// Record failed attempt and block if necessary
async function recordFailedAttempt(ip, email, settings) {
  try {
    // Check existing attempts
    const existing = await db.query(
      `SELECT * FROM rate_limit_blocked
       WHERE ip_address = $1
       AND created_at > NOW() - INTERVAL '${settings.window_minutes} minutes'
       LIMIT 1`,
      [ip]
    );

    const blockedUntil = new Date(Date.now() + settings.block_duration_minutes * 60 * 1000);

    if (existing.rows.length > 0) {
      // Update existing record
      const newCount = existing.rows[0].attempt_count + 1;
      await db.query(
        `UPDATE rate_limit_blocked
         SET attempt_count = $1,
             email = COALESCE($2, email),
             blocked_at = CASE WHEN $1 >= $3 THEN NOW() ELSE blocked_at END,
             blocked_until = CASE WHEN $1 >= $3 THEN $4 ELSE blocked_until END
         WHERE id = $5`,
        [newCount, email, settings.max_attempts, blockedUntil, existing.rows[0].id]
      );
      return newCount >= settings.max_attempts;
    } else {
      // Insert new record
      await db.query(
        `INSERT INTO rate_limit_blocked (ip_address, email, attempt_count, blocked_at, blocked_until)
         VALUES ($1, $2, 1, NOW(), $3)`,
        [ip, email || null, blockedUntil]
      );
      return 1 >= settings.max_attempts;
    }
  } catch (error) {
    // Error recording failed attempt - silent fail
    return false;
  }
}

// Clear attempts on successful login
async function clearAttempts(ip, email) {
  try {
    await db.query(
      `DELETE FROM rate_limit_blocked WHERE ip_address = $1 OR email = $2`,
      [ip, email || '']
    );
  } catch (error) {
    // Error clearing attempts - silent fail
  }
}

// Rate limiter for API routes
// SECURITY: No localhost skip - rate limiting applies to ALL requests
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 500 : 1000, // Stricter in production
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // REMOVED: localhost skip - security vulnerability
});

// Stricter rate limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per windowMs
  message: {
    success: false,
    message: 'Too many login attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Database-backed auth rate limiter middleware
const dbAuthLimiter = async (req, res, next) => {
  const settings = await getRateLimitSettings();

  // If rate limiting is disabled, skip
  if (!settings.enabled) {
    return next();
  }

  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const email = req.body?.email || '';

  // Check if already blocked
  const blocked = await isBlocked(ip, email);
  if (blocked) {
    const remainingMs = new Date(blocked.blocked_until) - new Date();
    const remainingMinutes = Math.ceil(remainingMs / 60000);

    return res.status(429).json({
      success: false,
      message: `Too many login attempts. Please try again in ${remainingMinutes} minute(s).`,
      blocked: true,
      blockedUntil: blocked.blocked_until,
      remainingMinutes
    });
  }

  next();
};

// Middleware to record failed login attempts
const recordFailedLogin = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = function(data) {
    // Process async operations but don't wait for them
    const processAttempt = async () => {
      try {
        // If login failed (401 or success: false)
        if (res.statusCode === 401 || (data && data.success === false)) {
          const settings = await getRateLimitSettings();
          if (settings.enabled) {
            const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
            const email = req.body?.email || '';
            await recordFailedAttempt(ip, email, settings);
          }
        }
        // If login succeeded, clear attempts
        else if (data && data.success === true && !data.requires2FA) {
          const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
          const email = req.body?.email || '';
          await clearAttempts(ip, email);
        }
      } catch (error) {
        // RateLimiter Error processing attempt - silent fail
      }
    };

    // Fire and forget - don't block response
    processAttempt();

    return originalJson(data);
  };

  next();
};

module.exports = {
  apiLimiter,
  authLimiter,
  dbAuthLimiter,
  recordFailedLogin,
  getRateLimitSettings,
  isBlocked,
  recordFailedAttempt,
  clearAttempts
};
