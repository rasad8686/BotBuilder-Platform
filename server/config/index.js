/**
 * Main Configuration
 * Centralized configuration for the BotBuilder application
 */

require('dotenv').config();

/**
 * Application Configuration
 */
const config = {
  // Server Configuration
  server: {
    port: parseInt(process.env.PORT || '5000'),
    host: process.env.HOST || '0.0.0.0',
    env: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV === 'development',
    isTest: process.env.NODE_ENV === 'test'
  },

  // Database Configuration
  database: {
    url: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
    idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000')
  },

  // Redis Configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '10'),
    retryDelay: parseInt(process.env.REDIS_RETRY_DELAY || '3000')
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-in-production',
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    issuer: process.env.JWT_ISSUER || 'botbuilder',
    audience: process.env.JWT_AUDIENCE || 'botbuilder-api'
  },

  // AI Provider Configuration
  ai: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      organization: process.env.OPENAI_ORG_ID,
      defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o-mini',
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '1024'),
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7')
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      defaultModel: process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-3-5-sonnet-20241022',
      maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '1024'),
      temperature: parseFloat(process.env.ANTHROPIC_TEMPERATURE || '0.7')
    }
  },

  // Email Configuration
  email: {
    provider: process.env.EMAIL_PROVIDER || 'resend',
    from: process.env.EMAIL_FROM || 'noreply@botbuilder.com',
    resend: {
      apiKey: process.env.RESEND_API_KEY
    },
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD
    }
  },

  // File Upload Configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB default
    allowedMimeTypes: (process.env.ALLOWED_MIME_TYPES || 'image/jpeg,image/png,image/gif,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document').split(','),
    uploadDir: process.env.UPLOAD_DIR || './server/uploads',
    tempDir: process.env.TEMP_DIR || './server/uploads/temp'
  },

  // Rate Limiting Configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000'), // 1 minute
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    authWindowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW || '900000'), // 15 minutes
    authMaxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5')
  },

  // Security Configuration
  security: {
    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000'],
    cookieSecret: process.env.COOKIE_SECRET || 'default-cookie-secret',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10'),
    sessionSecret: process.env.SESSION_SECRET || 'default-session-secret',
    csrfProtection: process.env.CSRF_PROTECTION !== 'false'
  },

  // Webhook Configuration
  webhook: {
    baseUrl: process.env.WEBHOOK_BASE_URL || 'http://localhost:5000',
    secret: process.env.WEBHOOK_SECRET || 'default-webhook-secret',
    timeout: parseInt(process.env.WEBHOOK_TIMEOUT || '30000')
  },

  // Feature Flags
  features: {
    enableSwagger: process.env.ENABLE_SWAGGER !== 'false',
    enableAnalytics: process.env.ENABLE_ANALYTICS !== 'false',
    enableFineTuning: process.env.ENABLE_FINE_TUNING !== 'false',
    enableVoice: process.env.ENABLE_VOICE !== 'false',
    enableClone: process.env.ENABLE_CLONE !== 'false',
    enableSSO: process.env.ENABLE_SSO !== 'false'
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '14'),
    maxSize: process.env.LOG_MAX_SIZE || '20m'
  }
};

/**
 * Validate required configuration
 * @throws {Error} If required config is missing
 */
function validateConfig() {
  const errors = [];

  // Required in production
  if (config.server.isProduction) {
    if (!config.database.url) {
      errors.push('DATABASE_URL is required in production');
    }
    if (config.jwt.secret === 'default-secret-change-in-production') {
      errors.push('JWT_SECRET must be set in production');
    }
    if (config.security.cookieSecret === 'default-cookie-secret') {
      errors.push('COOKIE_SECRET must be set in production');
    }
    if (config.security.sessionSecret === 'default-session-secret') {
      errors.push('SESSION_SECRET must be set in production');
    }
  }

  // AI API keys (at least one required)
  if (!config.ai.openai.apiKey && !config.ai.anthropic.apiKey) {
    errors.push('At least one AI provider API key (OPENAI_API_KEY or ANTHROPIC_API_KEY) is required');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }

  return true;
}

/**
 * Get configuration value by path
 * @param {string} path - Dot-notation path (e.g., 'server.port')
 * @returns {*} Configuration value
 */
function get(path) {
  return path.split('.').reduce((obj, key) => obj?.[key], config);
}

/**
 * Check if environment is production
 * @returns {boolean}
 */
function isProduction() {
  return config.server.isProduction;
}

/**
 * Check if environment is development
 * @returns {boolean}
 */
function isDevelopment() {
  return config.server.isDevelopment;
}

/**
 * Check if environment is test
 * @returns {boolean}
 */
function isTest() {
  return config.server.isTest;
}

module.exports = {
  config,
  validateConfig,
  get,
  isProduction,
  isDevelopment,
  isTest
};
