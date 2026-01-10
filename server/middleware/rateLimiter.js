const rateLimit = require('express-rate-limit');
const db = require('../db');
const log = require('../utils/logger');

// Cache for rate limit settings (refresh every 60 seconds)
let settingsCache = {};
let settingsCacheTime = 0;
const CACHE_TTL = 60000; // 1 minute

// Fetch rate limit settings from database (new professional structure)
async function getRateLimitSettings(key = 'login') {
  const now = Date.now();

  // DEBUG: Skip cache for testing
  // Check cache - disabled for debugging
  // if (settingsCache[key] && (now - settingsCacheTime) < CACHE_TTL) {
  //   return settingsCache[key];
  // }

  console.log('[RATE_LIMIT] ====== Looking for rule with key:', key, '======');

  try {
    // Try new table structure first
    const result = await db.query(
      'SELECT * FROM rate_limit_settings WHERE key = $1',
      [key]
    );

    console.log('[RATE_LIMIT] Query result rows:', result.rows.length);

    if (result.rows.length > 0) {
      const row = result.rows[0];
      settingsCache[key] = {
        enabled: row.is_enabled,
        max_attempts: row.max_attempts,
        window_ms: row.window_ms,
        block_duration_ms: row.block_duration_ms
      };
      settingsCacheTime = now;
      console.log('[RATE_LIMIT] ✓ RULE FOUND for key:', key);
      console.log('[RATE_LIMIT] → max_attempts:', settingsCache[key].max_attempts);
      console.log('[RATE_LIMIT] → window_ms:', settingsCache[key].window_ms);
      console.log('[RATE_LIMIT] → block_duration_ms:', settingsCache[key].block_duration_ms);
      console.log('[RATE_LIMIT] → enabled:', settingsCache[key].enabled);
      return settingsCache[key];
    } else {
      console.log('[RATE_LIMIT] ✗ NO RULE FOUND for key:', key, '- Using defaults');
    }
  } catch (error) {
    console.log('[RATE_LIMIT] Error loading from rate_limit_settings table:', error.message);
    // Try old table structure as fallback
    try {
      const oldResult = await db.query('SELECT * FROM rate_limit_settings ORDER BY id DESC LIMIT 1');
      if (oldResult.rows.length > 0) {
        const row = oldResult.rows[0];
        settingsCache[key] = {
          enabled: row.enabled !== undefined ? row.enabled : true,
          max_attempts: row.max_attempts || 5,
          window_ms: (row.window_minutes || 15) * 60 * 1000,
          block_duration_ms: (row.block_duration_minutes || 15) * 60 * 1000
        };
        settingsCacheTime = now;
        console.log('[RATE_LIMIT] ✓ RULE FOUND in old table, max_attempts:', settingsCache[key].max_attempts);
        return settingsCache[key];
      }
    } catch (fallbackError) {
      console.log('[RATE_LIMIT] Old table also failed:', fallbackError.message);
    }
  }

  // Default settings
  console.log('[RATE_LIMIT] ⚠ Using DEFAULT settings - max_attempts: 5');
  return {
    enabled: true,
    max_attempts: 5,
    window_ms: 600000, // 10 minutes
    block_duration_ms: 600000 // 10 minutes
  };
}

// Normalize localhost IPs (127.0.0.1, ::1, ::ffff:127.0.0.1 are all localhost)
function getLocalhostVariants(ip) {
  const localhostIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost'];
  if (localhostIPs.includes(ip)) {
    return localhostIPs;
  }
  return [ip];
}

// Check if IP/email is blocked (supports both old and new table structures)
async function isBlocked(ip, email) {
  try {
    const ipVariants = getLocalhostVariants(ip);
    console.log('[RATE_LIMIT] isBlocked checking IP:', ip, 'variants:', ipVariants);

    // Try new blocked_ips table first
    try {
      const newResult = await db.query(
        `SELECT * FROM blocked_ips
         WHERE ip_address = ANY($1)
         AND unblocked_at IS NULL
         AND (is_permanent = true OR expires_at > NOW())
         LIMIT 1`,
        [ipVariants]
      );
      console.log('[RATE_LIMIT] blocked_ips table result:', newResult.rows.length > 0 ? newResult.rows[0] : 'none');
      if (newResult.rows.length > 0) {
        const row = newResult.rows[0];
        return {
          id: row.id,
          ip_address: row.ip_address,
          blocked_at: row.blocked_at,
          blocked_until: row.expires_at,
          attempt_count: row.attempts,
          is_permanent: row.is_permanent
        };
      }
    } catch (newTableError) {
      console.log('[RATE_LIMIT] blocked_ips table error:', newTableError.message);
    }

    // Fallback to old rate_limit_blocked table - check if attempt_count >= max from settings
    const settings = await getRateLimitSettings('login');
    console.log('[RATE_LIMIT] Checking rate_limit_blocked with max_attempts:', settings.max_attempts);
    const result = await db.query(
      `SELECT * FROM rate_limit_blocked
       WHERE (ip_address = ANY($1) OR email = $2)
       AND attempt_count >= $3
       AND blocked_until > NOW()
       LIMIT 1`,
      [ipVariants, email || '', settings.max_attempts]
    );
    console.log('[RATE_LIMIT] rate_limit_blocked result:', result.rows.length > 0 ? result.rows[0] : 'none');
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    return null;
  }
}

// Write to audit log
async function writeAuditLog(ipAddress, endpoint, action, details) {
  try {
    await db.query(
      `INSERT INTO rate_limit_logs (ip_address, endpoint, user_id, action, details, created_at)
       VALUES ($1, $2, NULL, $3, $4, NOW())`,
      [ipAddress, endpoint, action, JSON.stringify(details)]
    );
  } catch (error) {
    // Silent fail - don't break main flow
    console.log('[RATE_LIMIT_DEBUG] Audit log error:', error.message);
  }
}

// Record failed attempt and block if necessary
async function recordFailedAttempt(ip, email, settings) {
  try {
    // Use window_ms from new structure, fallback to window_minutes for old structure
    const windowMs = settings.window_ms || (settings.window_minutes || 15) * 60 * 1000;
    const blockDurationMs = settings.block_duration_ms || (settings.block_duration_minutes || 15) * 60 * 1000;

    console.log('[RATE_LIMIT_DEBUG] recordFailedAttempt called:', { ip, email, settings, windowMs, blockDurationMs });

    // Check existing attempts within window
    const existing = await db.query(
      `SELECT * FROM rate_limit_blocked
       WHERE ip_address = $1
       AND created_at > NOW() - INTERVAL '1 millisecond' * $2
       LIMIT 1`,
      [ip, windowMs]
    );

    const blockedUntil = new Date(Date.now() + blockDurationMs);

    if (existing.rows.length > 0) {
      // Update existing record
      const newCount = existing.rows[0].attempt_count + 1;
      const shouldBlock = newCount >= settings.max_attempts;
      console.log('[RATE_LIMIT_DEBUG] Updating attempt count:', { oldCount: existing.rows[0].attempt_count, newCount, max_attempts: settings.max_attempts, shouldBlock });

      // Update with explicit casting and separate queries for clarity
      if (shouldBlock) {
        // Block the IP - update blocked_at and blocked_until
        await db.query(
          `UPDATE rate_limit_blocked
           SET attempt_count = $1,
               email = COALESCE($2, email),
               blocked_at = NOW(),
               blocked_until = $3
           WHERE id = $4`,
          [newCount, email || null, blockedUntil, existing.rows[0].id]
        );
        console.log('[RATE_LIMIT] *** BLOCKING IP:', ip, 'after', newCount, 'attempts ***');
        await writeAuditLog(ip, 'login', 'blocked', {
          attempts: newCount,
          block_duration_ms: blockDurationMs,
          blocked_until: blockedUntil.toISOString()
        });
      } else {
        // Just increment attempt count
        await db.query(
          `UPDATE rate_limit_blocked
           SET attempt_count = $1,
               email = COALESCE($2, email)
           WHERE id = $3`,
          [newCount, email || null, existing.rows[0].id]
        );
      }

      // Write attempt to audit log
      console.log('[RATE_LIMIT] FAILED LOGIN RECORDED for IP:', ip, ', attempt count:', newCount);
      await writeAuditLog(ip, 'login', 'attempt', { attempt_number: newCount, email: email || null });

      return shouldBlock;
    } else {
      // Insert new record - first attempt
      const shouldBlock = 1 >= settings.max_attempts;
      console.log('[RATE_LIMIT] FAILED LOGIN RECORDED for IP:', ip, ', attempt count: 1, shouldBlock:', shouldBlock);

      await db.query(
        `INSERT INTO rate_limit_blocked (ip_address, email, attempt_count, blocked_at, blocked_until)
         VALUES ($1, $2, 1, NOW(), $3)`,
        [ip, email || null, blockedUntil]
      );

      // Write first attempt to audit log
      await writeAuditLog(ip, 'login', 'attempt', { attempt_number: 1, email: email || null });

      if (shouldBlock) {
        console.log('[RATE_LIMIT] *** BLOCKING IP:', ip, 'after 1 attempt (max_attempts=1) ***');
        await writeAuditLog(ip, 'login', 'blocked', {
          attempts: 1,
          block_duration_ms: blockDurationMs,
          blocked_until: blockedUntil.toISOString()
        });
      }

      return shouldBlock;
    }
  } catch (error) {
    console.log('[RATE_LIMIT_DEBUG] Error in recordFailedAttempt:', error.message);
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

// Tier limits configuration
const TIER_LIMITS = {
  free: { requestsPerMinute: 20, requestsPerDay: 1000 },
  pro: { requestsPerMinute: 100, requestsPerDay: 10000 },
  enterprise: { requestsPerMinute: 500, requestsPerDay: 100000 }
};

// Rate limiter for API routes
// SECURITY: No localhost skip - rate limiting applies to ALL requests
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 500 : 5000, // Stricter in production, higher for dev
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // REMOVED: localhost skip - security vulnerability
});

// Middleware to add custom rate limit headers with tier info
const rateLimitHeaders = async (req, res, next) => {
  try {
    // Get user's tier from organization
    let tier = 'free';
    if (req.user && req.user.current_organization_id) {
      const orgResult = await db.query(
        'SELECT plan_tier FROM organizations WHERE id = $1',
        [req.user.current_organization_id]
      );
      if (orgResult.rows.length > 0) {
        tier = (orgResult.rows[0].plan_tier || 'free').toLowerCase();
      }
    }

    // Normalize tier
    if (!TIER_LIMITS[tier]) {
      tier = 'free';
    }

    const limits = TIER_LIMITS[tier];
    const now = new Date();
    const resetTime = new Date(now);
    resetTime.setMinutes(resetTime.getMinutes() + 1);
    resetTime.setSeconds(0, 0);

    // Set custom headers
    res.setHeader('X-RateLimit-Limit', limits.requestsPerMinute);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limits.requestsPerMinute - 1));
    res.setHeader('X-RateLimit-Reset', Math.floor(resetTime.getTime() / 1000));
    res.setHeader('X-RateLimit-Tier', tier);
  } catch (error) {
    // Silent fail - don't block request if header setting fails
  }
  next();
};

// REMOVED: Hardcoded authLimiter - now using dbAuthLimiter which reads from database
// const authLimiter = rateLimit({...});
// Use dbAuthLimiter instead for login rate limiting

// Format time for display
function formatRetryAfter(seconds) {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours !== 1 ? 's' : ''}`;
}

// Database-backed auth rate limiter middleware
const dbAuthLimiter = async (req, res, next) => {
  const settings = await getRateLimitSettings('login');
  console.log('[RATE_LIMIT_DEBUG] dbAuthLimiter - settings:', settings);

  // If rate limiting is disabled, skip
  if (!settings.enabled) {
    console.log('[RATE_LIMIT_DEBUG] Rate limiting disabled, skipping');
    return next();
  }

  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const email = req.body?.email || '';
  console.log('[RATE_LIMIT_DEBUG] Checking block for IP:', ip, 'Email:', email);

  // Check if already blocked
  const blocked = await isBlocked(ip, email);
  console.log('[RATE_LIMIT_DEBUG] isBlocked result:', blocked);
  if (blocked) {
    const remainingMs = blocked.is_permanent
      ? Infinity
      : new Date(blocked.blocked_until) - new Date();
    const retryAfter = blocked.is_permanent ? 0 : Math.ceil(remainingMs / 1000);

    // Professional error response format
    return res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: blocked.is_permanent
          ? 'Your IP has been permanently blocked. Please contact support.'
          : 'Too many login attempts',
        retryAfter: retryAfter,
        retryAfterFormatted: blocked.is_permanent ? 'Permanent' : formatRetryAfter(retryAfter)
      },
      // Legacy fields for backward compatibility
      blocked: true,
      blockedUntil: blocked.blocked_until,
      remainingMinutes: Math.ceil(remainingMs / 60000)
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
        console.log('[RATE_LIMIT] recordFailedLogin - statusCode:', res.statusCode, 'data.success:', data?.success);
        // If login failed (401 or success: false)
        if (res.statusCode === 401 || (data && data.success === false)) {
          const settings = await getRateLimitSettings('login');
          console.log('[RATE_LIMIT] Failed login detected, settings:', settings);
          if (settings.enabled) {
            const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
            const email = req.body?.email || '';
            console.log('[RATE_LIMIT] Recording failed attempt for IP:', ip);
            const blocked = await recordFailedAttempt(ip, email, settings);
            console.log('[RATE_LIMIT] recordFailedAttempt returned blocked:', blocked);
          }
        }
        // If login succeeded, clear attempts
        else if (data && data.success === true && !data.requires2FA) {
          const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
          const email = req.body?.email || '';
          await clearAttempts(ip, email);
        }
      } catch (error) {
        console.log('[RATE_LIMIT] Error in recordFailedLogin:', error.message);
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
  authLimiter: dbAuthLimiter, // Alias for backward compatibility - now uses database settings
  dbAuthLimiter,
  recordFailedLogin,
  getRateLimitSettings,
  isBlocked,
  recordFailedAttempt,
  clearAttempts,
  rateLimitHeaders,
  TIER_LIMITS
};
