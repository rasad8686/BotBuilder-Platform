/**
 * envValidator Tests
 * Tests for server/utils/envValidator.js
 */

jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Store original env
const originalEnv = { ...process.env };

describe('envValidator', () => {
  let envValidator;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Reset env to original
    process.env = { ...originalEnv };

    // Set required vars for tests
    process.env.JWT_SECRET = 'a'.repeat(32);
    process.env.AI_ENCRYPTION_SECRET = 'b'.repeat(32);
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    process.env.NODE_ENV = 'development';

    envValidator = require('../../utils/envValidator');
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('REQUIRED_ENV_VARS', () => {
    it('should define required variables', () => {
      expect(envValidator.REQUIRED_ENV_VARS).toBeDefined();
      expect(envValidator.REQUIRED_ENV_VARS.JWT_SECRET).toBeDefined();
      expect(envValidator.REQUIRED_ENV_VARS.AI_ENCRYPTION_SECRET).toBeDefined();
      expect(envValidator.REQUIRED_ENV_VARS.DATABASE_URL).toBeDefined();
    });
  });

  describe('RECOMMENDED_ENV_VARS', () => {
    it('should define recommended variables', () => {
      expect(envValidator.RECOMMENDED_ENV_VARS).toBeDefined();
      expect(envValidator.RECOMMENDED_ENV_VARS.STRIPE_SECRET_KEY).toBeDefined();
      expect(envValidator.RECOMMENDED_ENV_VARS.OPENAI_API_KEY).toBeDefined();
    });
  });

  describe('validateEnv', () => {
    it('should pass with valid required variables', () => {
      const result = envValidator.validateEnv();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail if JWT_SECRET is missing', () => {
      delete process.env.JWT_SECRET;

      // Re-require to pick up new env
      jest.resetModules();
      const validator = require('../../utils/envValidator');

      const result = validator.validateEnv();

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('JWT_SECRET'))).toBe(true);
    });

    it('should fail if JWT_SECRET is too short', () => {
      process.env.JWT_SECRET = 'short';

      jest.resetModules();
      const validator = require('../../utils/envValidator');

      const result = validator.validateEnv();

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('JWT_SECRET') && e.includes('32 characters'))).toBe(true);
    });

    it('should fail if AI_ENCRYPTION_SECRET is missing', () => {
      delete process.env.AI_ENCRYPTION_SECRET;

      jest.resetModules();
      const validator = require('../../utils/envValidator');

      const result = validator.validateEnv();

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('AI_ENCRYPTION_SECRET'))).toBe(true);
    });

    it('should fail if DATABASE_URL is missing', () => {
      delete process.env.DATABASE_URL;

      jest.resetModules();
      const validator = require('../../utils/envValidator');

      const result = validator.validateEnv();

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('DATABASE_URL'))).toBe(true);
    });

    it('should add warnings for missing recommended vars', () => {
      const result = envValidator.validateEnv();

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('STRIPE_SECRET_KEY'))).toBe(true);
    });

    it('should require admin vars in production', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ADMIN_EMAIL;
      delete process.env.ADMIN_PASSWORD;

      jest.resetModules();
      const validator = require('../../utils/envValidator');

      const result = validator.validateEnv();

      // ADMIN vars become required in production
      expect(result.valid).toBe(false);
    });
  });

  describe('validateEnvOrExit', () => {
    let mockExit;
    let mockConsoleError;

    beforeEach(() => {
      mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
      mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      mockExit.mockRestore();
      mockConsoleError.mockRestore();
    });

    it('should return result when valid', () => {
      const result = envValidator.validateEnvOrExit();

      expect(result.valid).toBe(true);
      expect(mockExit).not.toHaveBeenCalled();
    });

    it('should exit in production with invalid env', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;

      jest.resetModules();
      const validator = require('../../utils/envValidator');

      validator.validateEnvOrExit();

      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should not exit in development with invalid env', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.JWT_SECRET;

      jest.resetModules();
      const validator = require('../../utils/envValidator');

      validator.validateEnvOrExit();

      expect(mockExit).not.toHaveBeenCalled();
    });

    it('should print error messages on failure', () => {
      delete process.env.JWT_SECRET;

      jest.resetModules();
      const validator = require('../../utils/envValidator');

      validator.validateEnvOrExit();

      expect(mockConsoleError).toHaveBeenCalled();
    });
  });

  describe('getSecureEnv', () => {
    it('should return environment variable value', () => {
      process.env.TEST_VAR = 'test_value';

      const value = envValidator.getSecureEnv('TEST_VAR');

      expect(value).toBe('test_value');
    });

    it('should return fallback if not set', () => {
      delete process.env.MISSING_VAR;

      const value = envValidator.getSecureEnv('MISSING_VAR', 'default');

      expect(value).toBe('default');
    });

    it('should throw in production if not set and no fallback', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.MISSING_VAR;

      jest.resetModules();
      const validator = require('../../utils/envValidator');

      expect(() => {
        validator.getSecureEnv('MISSING_VAR');
      }).toThrow('Required environment variable MISSING_VAR is not set');
    });

    it('should return null if not set in development with no fallback', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.MISSING_VAR;

      const value = envValidator.getSecureEnv('MISSING_VAR');

      expect(value).toBeNull();
    });
  });
});
