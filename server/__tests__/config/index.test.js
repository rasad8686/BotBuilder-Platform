/**
 * Main Configuration Tests
 * Tests for server/config/index.js
 */

// Mock dotenv BEFORE importing
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

const dotenv = require('dotenv');

describe('Main Configuration', () => {
  let originalEnv;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ========================================
  // Module Loading
  // ========================================
  describe('Module Loading', () => {
    it('should load dotenv config on import', () => {
      delete require.cache[require.resolve('../../config/index')];
      require('../../config/index');

      expect(dotenv.config).toHaveBeenCalled();
    });

    it('should export config object', () => {
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });

    it('should export validateConfig function', () => {
      delete require.cache[require.resolve('../../config/index')];
      const { validateConfig } = require('../../config/index');

      expect(typeof validateConfig).toBe('function');
    });

    it('should export get function', () => {
      delete require.cache[require.resolve('../../config/index')];
      const { get } = require('../../config/index');

      expect(typeof get).toBe('function');
    });

    it('should export environment check functions', () => {
      delete require.cache[require.resolve('../../config/index')];
      const { isProduction, isDevelopment, isTest } = require('../../config/index');

      expect(typeof isProduction).toBe('function');
      expect(typeof isDevelopment).toBe('function');
      expect(typeof isTest).toBe('function');
    });
  });

  // ========================================
  // Server Configuration
  // ========================================
  describe('Server Configuration', () => {
    it('should use PORT from environment', () => {
      process.env.PORT = '8080';
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.server.port).toBe(8080);
    });

    it('should use default port 5000', () => {
      delete process.env.PORT;
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.server.port).toBe(5000);
    });

    it('should use HOST from environment', () => {
      process.env.HOST = '127.0.0.1';
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.server.host).toBe('127.0.0.1');
    });

    it('should use default host 0.0.0.0', () => {
      delete process.env.HOST;
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.server.host).toBe('0.0.0.0');
    });

    it('should set environment from NODE_ENV', () => {
      process.env.NODE_ENV = 'production';
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.server.env).toBe('production');
      expect(config.server.isProduction).toBe(true);
      expect(config.server.isDevelopment).toBe(false);
      expect(config.server.isTest).toBe(false);
    });

    it('should default to development environment', () => {
      delete process.env.NODE_ENV;
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.server.env).toBe('development');
      expect(config.server.isDevelopment).toBe(true);
    });

    it('should recognize test environment', () => {
      process.env.NODE_ENV = 'test';
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.server.isTest).toBe(true);
      expect(config.server.isProduction).toBe(false);
      expect(config.server.isDevelopment).toBe(false);
    });
  });

  // ========================================
  // Database Configuration
  // ========================================
  describe('Database Configuration', () => {
    it('should use DATABASE_URL from environment', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/testdb';
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.database.url).toBe('postgresql://localhost:5432/testdb');
    });

    it('should parse DB_SSL flag', () => {
      process.env.DB_SSL = 'true';
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.database.ssl).toBe(true);
    });

    it('should use custom max connections', () => {
      process.env.DB_MAX_CONNECTIONS = '50';
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.database.maxConnections).toBe(50);
    });

    it('should use default database settings', () => {
      delete process.env.DB_MAX_CONNECTIONS;
      delete process.env.DB_IDLE_TIMEOUT;
      delete process.env.DB_CONNECTION_TIMEOUT;
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.database.maxConnections).toBe(20);
      expect(config.database.idleTimeout).toBe(30000);
      expect(config.database.connectionTimeout).toBe(10000);
    });
  });

  // ========================================
  // Redis Configuration
  // ========================================
  describe('Redis Configuration', () => {
    it('should use REDIS_URL from environment', () => {
      process.env.REDIS_URL = 'redis://custom:6380';
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.redis.url).toBe('redis://custom:6380');
    });

    it('should use default Redis URL', () => {
      delete process.env.REDIS_URL;
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.redis.url).toBe('redis://localhost:6379');
    });

    it('should parse Redis host and port', () => {
      process.env.REDIS_HOST = 'redis.example.com';
      process.env.REDIS_PORT = '6380';
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.redis.host).toBe('redis.example.com');
      expect(config.redis.port).toBe(6380);
    });

    it('should use Redis password if provided', () => {
      process.env.REDIS_PASSWORD = 'secret123';
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.redis.password).toBe('secret123');
    });

    it('should parse Redis database number', () => {
      process.env.REDIS_DB = '5';
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.redis.db).toBe(5);
    });

    it('should use default Redis settings', () => {
      delete process.env.REDIS_HOST;
      delete process.env.REDIS_PORT;
      delete process.env.REDIS_DB;
      delete process.env.REDIS_MAX_RETRIES;
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.redis.host).toBe('localhost');
      expect(config.redis.port).toBe(6379);
      expect(config.redis.db).toBe(0);
      expect(config.redis.maxRetries).toBe(10);
      expect(config.redis.retryDelay).toBe(3000);
    });
  });

  // ========================================
  // JWT Configuration
  // ========================================
  describe('JWT Configuration', () => {
    it('should use JWT_SECRET from environment', () => {
      process.env.JWT_SECRET = 'my-secret-key';
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.jwt.secret).toBe('my-secret-key');
    });

    it('should use default JWT secret', () => {
      delete process.env.JWT_SECRET;
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.jwt.secret).toBe('default-secret-change-in-production');
    });

    it('should parse JWT expiry settings', () => {
      process.env.JWT_ACCESS_EXPIRY = '30m';
      process.env.JWT_REFRESH_EXPIRY = '14d';
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.jwt.accessTokenExpiry).toBe('30m');
      expect(config.jwt.refreshTokenExpiry).toBe('14d');
    });

    it('should use JWT issuer and audience', () => {
      process.env.JWT_ISSUER = 'my-app';
      process.env.JWT_AUDIENCE = 'my-api';
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.jwt.issuer).toBe('my-app');
      expect(config.jwt.audience).toBe('my-api');
    });
  });

  // ========================================
  // AI Configuration
  // ========================================
  describe('AI Configuration', () => {
    it('should parse OpenAI configuration', () => {
      process.env.OPENAI_API_KEY = 'sk-test123';
      process.env.OPENAI_ORG_ID = 'org-test';
      process.env.OPENAI_DEFAULT_MODEL = 'gpt-4';
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.ai.openai.apiKey).toBe('sk-test123');
      expect(config.ai.openai.organization).toBe('org-test');
      expect(config.ai.openai.defaultModel).toBe('gpt-4');
    });

    it('should parse Anthropic configuration', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      process.env.ANTHROPIC_DEFAULT_MODEL = 'claude-3-opus-20240229';
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.ai.anthropic.apiKey).toBe('sk-ant-test');
      expect(config.ai.anthropic.defaultModel).toBe('claude-3-opus-20240229');
    });

    it('should parse AI model parameters', () => {
      process.env.OPENAI_MAX_TOKENS = '2048';
      process.env.OPENAI_TEMPERATURE = '0.9';
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.ai.openai.maxTokens).toBe(2048);
      expect(config.ai.openai.temperature).toBe(0.9);
    });

    it('should use default AI settings', () => {
      delete process.env.OPENAI_DEFAULT_MODEL;
      delete process.env.OPENAI_MAX_TOKENS;
      delete process.env.OPENAI_TEMPERATURE;
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.ai.openai.defaultModel).toBe('gpt-4o-mini');
      expect(config.ai.openai.maxTokens).toBe(1024);
      expect(config.ai.openai.temperature).toBe(0.7);
    });
  });

  // ========================================
  // Email Configuration
  // ========================================
  describe('Email Configuration', () => {
    it('should parse email provider configuration', () => {
      process.env.EMAIL_PROVIDER = 'smtp';
      process.env.EMAIL_FROM = 'test@example.com';
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.email.provider).toBe('smtp');
      expect(config.email.from).toBe('test@example.com');
    });

    it('should parse Resend configuration', () => {
      process.env.RESEND_API_KEY = 're_test123';
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.email.resend.apiKey).toBe('re_test123');
    });

    it('should parse SMTP configuration', () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '465';
      process.env.SMTP_SECURE = 'true';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASSWORD = 'password';
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.email.smtp.host).toBe('smtp.example.com');
      expect(config.email.smtp.port).toBe(465);
      expect(config.email.smtp.secure).toBe(true);
      expect(config.email.smtp.user).toBe('user@example.com');
      expect(config.email.smtp.password).toBe('password');
    });

    it('should use default email settings', () => {
      delete process.env.EMAIL_PROVIDER;
      delete process.env.EMAIL_FROM;
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.email.provider).toBe('resend');
      expect(config.email.from).toBe('noreply@botbuilder.com');
    });
  });

  // ========================================
  // Upload Configuration
  // ========================================
  describe('Upload Configuration', () => {
    it('should parse max file size', () => {
      process.env.MAX_FILE_SIZE = '20971520'; // 20MB
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.upload.maxFileSize).toBe(20971520);
    });

    it('should parse allowed MIME types', () => {
      process.env.ALLOWED_MIME_TYPES = 'image/png,image/jpeg';
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.upload.allowedMimeTypes).toEqual(['image/png', 'image/jpeg']);
    });

    it('should use custom upload directories', () => {
      process.env.UPLOAD_DIR = '/var/uploads';
      process.env.TEMP_DIR = '/tmp/uploads';
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.upload.uploadDir).toBe('/var/uploads');
      expect(config.upload.tempDir).toBe('/tmp/uploads');
    });

    it('should use default upload settings', () => {
      delete process.env.MAX_FILE_SIZE;
      delete process.env.ALLOWED_MIME_TYPES;
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.upload.maxFileSize).toBe(10485760); // 10MB
      expect(config.upload.allowedMimeTypes).toContain('image/jpeg');
      expect(config.upload.allowedMimeTypes).toContain('application/pdf');
    });
  });

  // ========================================
  // Rate Limiting Configuration
  // ========================================
  describe('Rate Limiting Configuration', () => {
    it('should parse rate limit settings', () => {
      process.env.RATE_LIMIT_WINDOW = '120000';
      process.env.RATE_LIMIT_MAX = '200';
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.rateLimit.windowMs).toBe(120000);
      expect(config.rateLimit.maxRequests).toBe(200);
    });

    it('should parse auth rate limit settings', () => {
      process.env.AUTH_RATE_LIMIT_WINDOW = '1800000';
      process.env.AUTH_RATE_LIMIT_MAX = '3';
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.rateLimit.authWindowMs).toBe(1800000);
      expect(config.rateLimit.authMaxRequests).toBe(3);
    });

    it('should use default rate limit settings', () => {
      delete process.env.RATE_LIMIT_WINDOW;
      delete process.env.RATE_LIMIT_MAX;
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.rateLimit.windowMs).toBe(60000);
      expect(config.rateLimit.maxRequests).toBe(100);
      expect(config.rateLimit.authWindowMs).toBe(900000);
      expect(config.rateLimit.authMaxRequests).toBe(5);
    });
  });

  // ========================================
  // Security Configuration
  // ========================================
  describe('Security Configuration', () => {
    it('should parse CORS origins', () => {
      process.env.CORS_ORIGINS = 'http://localhost:3000,https://app.example.com';
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.security.corsOrigins).toEqual([
        'http://localhost:3000',
        'https://app.example.com'
      ]);
    });

    it('should parse security secrets', () => {
      process.env.COOKIE_SECRET = 'cookie-secret';
      process.env.SESSION_SECRET = 'session-secret';
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.security.cookieSecret).toBe('cookie-secret');
      expect(config.security.sessionSecret).toBe('session-secret');
    });

    it('should parse bcrypt rounds', () => {
      process.env.BCRYPT_ROUNDS = '12';
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.security.bcryptRounds).toBe(12);
    });

    it('should parse CSRF protection flag', () => {
      process.env.CSRF_PROTECTION = 'false';
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.security.csrfProtection).toBe(false);
    });

    it('should use default security settings', () => {
      delete process.env.CORS_ORIGINS;
      delete process.env.BCRYPT_ROUNDS;
      delete process.env.CSRF_PROTECTION;
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.security.corsOrigins).toEqual(['http://localhost:3000']);
      expect(config.security.bcryptRounds).toBe(10);
      expect(config.security.csrfProtection).toBe(true);
    });
  });

  // ========================================
  // Feature Flags
  // ========================================
  describe('Feature Flags', () => {
    it('should enable features by default', () => {
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.features.enableSwagger).toBe(true);
      expect(config.features.enableAnalytics).toBe(true);
      expect(config.features.enableFineTuning).toBe(true);
      expect(config.features.enableVoice).toBe(true);
      expect(config.features.enableClone).toBe(true);
      expect(config.features.enableSSO).toBe(true);
    });

    it('should disable features when set to false', () => {
      process.env.ENABLE_SWAGGER = 'false';
      process.env.ENABLE_ANALYTICS = 'false';
      delete require.cache[require.resolve('../../config/index')];
      const { config } = require('../../config/index');

      expect(config.features.enableSwagger).toBe(false);
      expect(config.features.enableAnalytics).toBe(false);
    });
  });

  // ========================================
  // Configuration Validation
  // ========================================
  describe('Configuration Validation', () => {
    it('should pass validation with valid config', () => {
      process.env.NODE_ENV = 'development';
      process.env.OPENAI_API_KEY = 'sk-test';
      delete require.cache[require.resolve('../../config/index')];
      const { validateConfig } = require('../../config/index');

      expect(() => validateConfig()).not.toThrow();
    });

    it('should require DATABASE_URL in production', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.DATABASE_URL;
      process.env.OPENAI_API_KEY = 'sk-test';
      delete require.cache[require.resolve('../../config/index')];
      const { validateConfig } = require('../../config/index');

      expect(() => validateConfig()).toThrow('DATABASE_URL is required in production');
    });

    it('should require JWT_SECRET in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://localhost/db';
      delete process.env.JWT_SECRET;
      process.env.OPENAI_API_KEY = 'sk-test';
      delete require.cache[require.resolve('../../config/index')];
      const { validateConfig } = require('../../config/index');

      expect(() => validateConfig()).toThrow('JWT_SECRET must be set in production');
    });

    it('should require at least one AI provider API key', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete require.cache[require.resolve('../../config/index')];
      const { validateConfig } = require('../../config/index');

      expect(() => validateConfig()).toThrow('At least one AI provider API key');
    });

    it('should accept Anthropic API key instead of OpenAI', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.OPENAI_API_KEY;
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      delete require.cache[require.resolve('../../config/index')];
      const { validateConfig } = require('../../config/index');

      expect(() => validateConfig()).not.toThrow();
    });

    it('should return true when validation passes', () => {
      process.env.NODE_ENV = 'development';
      process.env.OPENAI_API_KEY = 'sk-test';
      delete require.cache[require.resolve('../../config/index')];
      const { validateConfig } = require('../../config/index');

      expect(validateConfig()).toBe(true);
    });
  });

  // ========================================
  // get() Method
  // ========================================
  describe('get() Method', () => {
    beforeEach(() => {
      process.env.PORT = '3000';
      process.env.OPENAI_API_KEY = 'sk-test';
      delete require.cache[require.resolve('../../config/index')];
    });

    it('should get top-level config values', () => {
      const { get } = require('../../config/index');

      expect(get('server')).toBeDefined();
      expect(typeof get('server')).toBe('object');
    });

    it('should get nested config values', () => {
      const { get } = require('../../config/index');

      expect(get('server.port')).toBe(3000);
    });

    it('should get deeply nested values', () => {
      process.env.OPENAI_DEFAULT_MODEL = 'gpt-4';
      delete require.cache[require.resolve('../../config/index')];
      const { get } = require('../../config/index');

      expect(get('ai.openai.defaultModel')).toBe('gpt-4');
    });

    it('should return undefined for non-existent paths', () => {
      const { get } = require('../../config/index');

      expect(get('nonexistent.path')).toBeUndefined();
    });

    it('should handle paths with undefined intermediate values', () => {
      const { get } = require('../../config/index');

      expect(get('server.nonexistent.value')).toBeUndefined();
    });
  });

  // ========================================
  // Environment Check Functions
  // ========================================
  describe('Environment Check Functions', () => {
    it('should identify production environment', () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://localhost/db';
      process.env.JWT_SECRET = 'secret';
      process.env.COOKIE_SECRET = 'cookie';
      process.env.SESSION_SECRET = 'session';
      process.env.OPENAI_API_KEY = 'sk-test';
      delete require.cache[require.resolve('../../config/index')];
      const { isProduction, isDevelopment, isTest } = require('../../config/index');

      expect(isProduction()).toBe(true);
      expect(isDevelopment()).toBe(false);
      expect(isTest()).toBe(false);
    });

    it('should identify development environment', () => {
      process.env.NODE_ENV = 'development';
      process.env.OPENAI_API_KEY = 'sk-test';
      delete require.cache[require.resolve('../../config/index')];
      const { isProduction, isDevelopment, isTest } = require('../../config/index');

      expect(isProduction()).toBe(false);
      expect(isDevelopment()).toBe(true);
      expect(isTest()).toBe(false);
    });

    it('should identify test environment', () => {
      process.env.NODE_ENV = 'test';
      process.env.OPENAI_API_KEY = 'sk-test';
      delete require.cache[require.resolve('../../config/index')];
      const { isProduction, isDevelopment, isTest } = require('../../config/index');

      expect(isProduction()).toBe(false);
      expect(isDevelopment()).toBe(false);
      expect(isTest()).toBe(true);
    });
  });
});
