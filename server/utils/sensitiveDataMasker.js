/**
 * Sensitive Data Masker Utility
 *
 * Masks sensitive information like API keys, passwords, tokens
 * for safe logging and display purposes.
 *
 * NEVER log raw sensitive data - always use this utility!
 */

/**
 * Sensitive data patterns to detect and mask
 */
const SENSITIVE_PATTERNS = {
  // API Keys
  OPENAI_KEY: /sk-[a-zA-Z0-9]{20,}/g,
  ANTHROPIC_KEY: /sk-ant-[a-zA-Z0-9-]{20,}/g,
  STRIPE_SECRET: /sk_(test|live)_[a-zA-Z0-9]{20,}/g,
  STRIPE_WEBHOOK: /whsec_[a-zA-Z0-9]{20,}/g,
  GEMINI_KEY: /AIza[a-zA-Z0-9_-]{30,}/g,
  GLADIA_KEY: /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi,

  // Database
  DATABASE_URL: /postgresql:\/\/[^:]+:[^@]+@[^\s]+/g,
  REDIS_URL: /redis:\/\/[^:]*:[^@]*@[^\s]+/g,

  // Auth tokens
  JWT_TOKEN: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
  BEARER_TOKEN: /Bearer\s+[a-zA-Z0-9_-]+/gi,

  // Generic secrets (32+ char hex strings)
  HEX_SECRET: /\b[a-f0-9]{32,}\b/gi,

  // Email (partial mask)
  EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,

  // Credit card patterns
  CREDIT_CARD: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,

  // Password fields in JSON/objects
  PASSWORD_FIELD: /"password"\s*:\s*"[^"]+"/gi,
  SECRET_FIELD: /"secret"\s*:\s*"[^"]+"/gi,
  TOKEN_FIELD: /"token"\s*:\s*"[^"]+"/gi,
  API_KEY_FIELD: /"api_?key"\s*:\s*"[^"]+"/gi
};

/**
 * Mask a single value showing only first and last few characters
 * @param {string} value - Value to mask
 * @param {number} showStart - Characters to show at start (default: 4)
 * @param {number} showEnd - Characters to show at end (default: 4)
 * @returns {string} Masked value
 */
function maskValue(value, showStart = 4, showEnd = 4) {
  if (!value || typeof value !== 'string') {
    return value;
  }

  const len = value.length;

  // For very short values, mask entirely
  if (len <= showStart + showEnd + 4) {
    return '*'.repeat(len);
  }

  const start = value.substring(0, showStart);
  const end = value.substring(len - showEnd);
  const middle = '*'.repeat(Math.min(len - showStart - showEnd, 20));

  return `${start}${middle}${end}`;
}

/**
 * Mask an API key (show prefix and last 4 chars)
 * @param {string} key - API key to mask
 * @returns {string} Masked key
 */
function maskApiKey(key) {
  if (!key || typeof key !== 'string') {
    return '[NOT_SET]';
  }

  // Different masking based on key type
  if (key.startsWith('sk-proj-')) {
    return `sk-proj-****${key.slice(-4)}`;
  }
  if (key.startsWith('sk-ant-')) {
    return `sk-ant-****${key.slice(-4)}`;
  }
  if (key.startsWith('sk_test_')) {
    return `sk_test_****${key.slice(-4)}`;
  }
  if (key.startsWith('sk_live_')) {
    return `sk_live_****${key.slice(-4)}`;
  }
  if (key.startsWith('pk_test_')) {
    return `pk_test_****${key.slice(-4)}`;
  }
  if (key.startsWith('pk_live_')) {
    return `pk_live_****${key.slice(-4)}`;
  }
  if (key.startsWith('whsec_')) {
    return `whsec_****${key.slice(-4)}`;
  }
  if (key.startsWith('AIza')) {
    return `AIza****${key.slice(-4)}`;
  }

  // Generic masking for other keys
  return maskValue(key, 4, 4);
}

/**
 * Mask email address (show first 2 chars and domain)
 * @param {string} email - Email to mask
 * @returns {string} Masked email
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return email;
  }

  const [local, domain] = email.split('@');
  const maskedLocal = local.length > 2
    ? `${local.substring(0, 2)}${'*'.repeat(Math.min(local.length - 2, 8))}`
    : '**';

  return `${maskedLocal}@${domain}`;
}

/**
 * Mask database URL (hide password)
 * @param {string} url - Database URL to mask
 * @returns {string} Masked URL
 */
function maskDatabaseUrl(url) {
  if (!url || typeof url !== 'string') {
    return url;
  }

  // Match postgresql://user:password@host/db
  return url.replace(
    /(postgresql|mysql|mongodb|redis):\/\/([^:]+):([^@]+)@/gi,
    '$1://$2:****@'
  );
}

/**
 * Mask all sensitive data in a string
 * @param {string} text - Text that may contain sensitive data
 * @returns {string} Text with sensitive data masked
 */
function maskSensitiveString(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let masked = text;

  // Mask API keys
  masked = masked.replace(SENSITIVE_PATTERNS.OPENAI_KEY, (match) => maskApiKey(match));
  masked = masked.replace(SENSITIVE_PATTERNS.ANTHROPIC_KEY, (match) => maskApiKey(match));
  masked = masked.replace(SENSITIVE_PATTERNS.STRIPE_SECRET, (match) => maskApiKey(match));
  masked = masked.replace(SENSITIVE_PATTERNS.STRIPE_WEBHOOK, (match) => maskApiKey(match));
  masked = masked.replace(SENSITIVE_PATTERNS.GEMINI_KEY, (match) => maskApiKey(match));

  // Mask database URLs
  masked = masked.replace(SENSITIVE_PATTERNS.DATABASE_URL, (match) => maskDatabaseUrl(match));
  masked = masked.replace(SENSITIVE_PATTERNS.REDIS_URL, (match) => maskDatabaseUrl(match));

  // Mask JWT tokens
  masked = masked.replace(SENSITIVE_PATTERNS.JWT_TOKEN, 'eyJ****[JWT_TOKEN]****');

  // Mask Bearer tokens
  masked = masked.replace(SENSITIVE_PATTERNS.BEARER_TOKEN, 'Bearer ****');

  // Mask UUIDs (potential API keys like Gladia)
  masked = masked.replace(SENSITIVE_PATTERNS.GLADIA_KEY, (match) => `${match.substring(0, 8)}-****-****-****-${match.slice(-4)}`);

  // Mask credit cards
  masked = masked.replace(SENSITIVE_PATTERNS.CREDIT_CARD, (match) => {
    const digits = match.replace(/[\s-]/g, '');
    return `****-****-****-${digits.slice(-4)}`;
  });

  // Mask JSON password/secret/token fields
  masked = masked.replace(SENSITIVE_PATTERNS.PASSWORD_FIELD, '"password": "****"');
  masked = masked.replace(SENSITIVE_PATTERNS.SECRET_FIELD, '"secret": "****"');
  masked = masked.replace(SENSITIVE_PATTERNS.TOKEN_FIELD, '"token": "****"');
  masked = masked.replace(SENSITIVE_PATTERNS.API_KEY_FIELD, '"api_key": "****"');

  return masked;
}

/**
 * Mask sensitive data in an object (deep)
 * @param {Object} obj - Object that may contain sensitive data
 * @param {string[]} sensitiveKeys - Additional keys to mask
 * @returns {Object} Object with sensitive data masked
 */
function maskSensitiveObject(obj, sensitiveKeys = []) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  // Default sensitive key patterns
  const defaultSensitiveKeys = [
    'password', 'passwd', 'pwd',
    'secret', 'api_key', 'apiKey', 'api-key',
    'token', 'access_token', 'accessToken', 'refresh_token', 'refreshToken',
    'authorization', 'auth',
    'private_key', 'privateKey',
    'credentials', 'creds',
    'database_url', 'databaseUrl', 'db_url',
    'connection_string', 'connectionString',
    'stripe_key', 'stripeKey',
    'openai_key', 'openaiKey',
    'anthropic_key', 'anthropicKey',
    'jwt_secret', 'jwtSecret',
    'encryption_key', 'encryptionKey',
    'signing_secret', 'signingSecret',
    'webhook_secret', 'webhookSecret',
    'bot_token', 'botToken',
    ...sensitiveKeys
  ];

  const masked = Array.isArray(obj) ? [] : {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = defaultSensitiveKeys.some(sk =>
      lowerKey.includes(sk.toLowerCase())
    );

    if (isSensitive && typeof value === 'string') {
      // Mask the sensitive value
      if (lowerKey.includes('email')) {
        masked[key] = maskEmail(value);
      } else if (lowerKey.includes('url') || lowerKey.includes('database')) {
        masked[key] = maskDatabaseUrl(value);
      } else {
        masked[key] = maskApiKey(value);
      }
    } else if (typeof value === 'object' && value !== null) {
      // Recursively mask nested objects
      masked[key] = maskSensitiveObject(value, sensitiveKeys);
    } else if (typeof value === 'string') {
      // Check string content for sensitive patterns
      masked[key] = maskSensitiveString(value);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

/**
 * Get masked environment variables for logging
 * @returns {Object} Environment variables with secrets masked
 */
function getMaskedEnv() {
  const sensitiveEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'AI_ENCRYPTION_SECRET',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'GEMINI_API_KEY',
    'GLADIA_API_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'ADMIN_PASSWORD',
    'EMAIL_PASSWORD',
    'EMAIL_PASS',
    'WHATSAPP_APP_SECRET',
    'INSTAGRAM_APP_SECRET',
    'TELEGRAM_BOT_TOKEN',
    'DISCORD_BOT_TOKEN',
    'REDIS_URL',
    'RESEND_API_KEY'
  ];

  const masked = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (sensitiveEnvVars.includes(key) ||
        key.toLowerCase().includes('secret') ||
        key.toLowerCase().includes('password') ||
        key.toLowerCase().includes('token') ||
        key.toLowerCase().includes('api_key')) {
      masked[key] = value ? maskApiKey(value) : '[NOT_SET]';
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

/**
 * Create a safe logger wrapper that masks sensitive data
 * @param {Function} logFn - Original log function
 * @returns {Function} Wrapped log function that masks sensitive data
 */
function createSafeLogger(logFn) {
  return (...args) => {
    const maskedArgs = args.map(arg => {
      if (typeof arg === 'string') {
        return maskSensitiveString(arg);
      } else if (typeof arg === 'object' && arg !== null) {
        return maskSensitiveObject(arg);
      }
      return arg;
    });
    return logFn(...maskedArgs);
  };
}

module.exports = {
  maskValue,
  maskApiKey,
  maskEmail,
  maskDatabaseUrl,
  maskSensitiveString,
  maskSensitiveObject,
  getMaskedEnv,
  createSafeLogger,
  SENSITIVE_PATTERNS
};
