/**
 * Sensitive Data Masker Tests
 * Comprehensive tests for sensitive data masking utilities
 */

const {
  maskValue,
  maskApiKey,
  maskEmail,
  maskDatabaseUrl,
  maskSensitiveString,
  maskSensitiveObject,
  getMaskedEnv,
  createSafeLogger,
  SENSITIVE_PATTERNS
} = require('../../utils/sensitiveDataMasker');

describe('sensitiveDataMasker', () => {
  describe('SENSITIVE_PATTERNS', () => {
    it('should have patterns defined', () => {
      expect(SENSITIVE_PATTERNS).toBeDefined();
      expect(SENSITIVE_PATTERNS.OPENAI_KEY).toBeDefined();
      expect(SENSITIVE_PATTERNS.JWT_TOKEN).toBeDefined();
    });

    it('should have all required pattern types', () => {
      expect(SENSITIVE_PATTERNS.OPENAI_KEY).toBeInstanceOf(RegExp);
      expect(SENSITIVE_PATTERNS.ANTHROPIC_KEY).toBeInstanceOf(RegExp);
      expect(SENSITIVE_PATTERNS.STRIPE_SECRET).toBeInstanceOf(RegExp);
      expect(SENSITIVE_PATTERNS.GEMINI_KEY).toBeInstanceOf(RegExp);
      expect(SENSITIVE_PATTERNS.DATABASE_URL).toBeInstanceOf(RegExp);
      expect(SENSITIVE_PATTERNS.JWT_TOKEN).toBeInstanceOf(RegExp);
    });

    it('should use global flags for patterns', () => {
      expect(SENSITIVE_PATTERNS.OPENAI_KEY.global).toBe(true);
      expect(SENSITIVE_PATTERNS.EMAIL.global).toBe(true);
    });
  });

  describe('maskValue', () => {
    it('should mask middle of string', () => {
      const result = maskValue('abcdefghijklmnop');

      expect(result).toMatch(/^abcd\*+mnop$/);
    });

    it('should mask entire short strings', () => {
      const result = maskValue('short');

      expect(result).toBe('*****');
    });

    it('should return non-string values unchanged', () => {
      expect(maskValue(null)).toBeNull();
      expect(maskValue(undefined)).toBeUndefined();
      expect(maskValue(123)).toBe(123);
    });

    it('should respect custom show start and end', () => {
      const result = maskValue('abcdefghijklmnopqrst', 2, 2);

      expect(result.startsWith('ab')).toBe(true);
      expect(result.endsWith('st')).toBe(true);
    });

    it('should limit middle asterisks to 20', () => {
      const longString = 'a'.repeat(100);
      const result = maskValue(longString, 4, 4);

      const middleAsterisks = result.match(/\*/g).length;
      expect(middleAsterisks).toBe(20);
    });

    it('should handle empty string', () => {
      const result = maskValue('');

      expect(result).toBe('');
    });

    it('should handle single character', () => {
      const result = maskValue('a');

      expect(result).toBe('*');
    });

    it('should mask exactly at boundary length', () => {
      const result = maskValue('abcdefghijkl', 4, 4); // length 12

      expect(result).toBe('************');
    });

    it('should handle custom show parameters', () => {
      const result = maskValue('0123456789', 1, 1);

      expect(result.startsWith('0')).toBe(true);
      expect(result.endsWith('9')).toBe(true);
    });
  });

  describe('maskApiKey', () => {
    it('should return [NOT_SET] for empty values', () => {
      expect(maskApiKey(null)).toBe('[NOT_SET]');
      expect(maskApiKey(undefined)).toBe('[NOT_SET]');
      expect(maskApiKey('')).toBe('[NOT_SET]');
    });

    it('should mask OpenAI project keys', () => {
      const result = maskApiKey('sk-proj-abcdefghijklmnop1234');

      expect(result).toBe('sk-proj-****1234');
    });

    it('should mask Anthropic keys', () => {
      const result = maskApiKey('sk-ant-abcdefghijklmnop1234');

      expect(result).toBe('sk-ant-****1234');
    });

    it('should mask Stripe test secret keys', () => {
      const result = maskApiKey('sk_test_abcdefghijklmnop1234');

      expect(result).toBe('sk_test_****1234');
    });

    it('should mask Stripe live secret keys', () => {
      const result = maskApiKey('sk_live_abcdefghijklmnop1234');

      expect(result).toBe('sk_live_****1234');
    });

    it('should mask Stripe test public keys', () => {
      const result = maskApiKey('pk_test_abcdefghijklmnop1234');

      expect(result).toBe('pk_test_****1234');
    });

    it('should mask Stripe live public keys', () => {
      const result = maskApiKey('pk_live_abcdefghijklmnop1234');

      expect(result).toBe('pk_live_****1234');
    });

    it('should mask Stripe webhook secrets', () => {
      const result = maskApiKey('whsec_abcdefghijklmnop1234');

      expect(result).toBe('whsec_****1234');
    });

    it('should mask Google/Gemini API keys', () => {
      const result = maskApiKey('AIzaAbcdefghijklmnopqrstuvwx');

      expect(result).toBe('AIza****uvwx');
    });

    it('should use generic masking for other keys', () => {
      const result = maskApiKey('some-random-api-key-here');

      expect(result).toMatch(/^some\*+here$/);
    });

    it('should handle non-string input', () => {
      expect(maskApiKey(123)).toBe('[NOT_SET]');
      expect(maskApiKey({})).toBe('[NOT_SET]');
      expect(maskApiKey([])).toBe('[NOT_SET]');
    });

    it('should preserve key prefix information', () => {
      expect(maskApiKey('sk-proj-test1234')).toContain('sk-proj-');
      expect(maskApiKey('sk-ant-test1234')).toContain('sk-ant-');
      expect(maskApiKey('AIzatest1234')).toContain('AIza');
    });
  });

  describe('maskEmail', () => {
    it('should mask email local part', () => {
      const result = maskEmail('john.doe@example.com');

      expect(result).toMatch(/^jo\*+@example\.com$/);
    });

    it('should preserve domain', () => {
      const result = maskEmail('test@company.org');

      expect(result).toContain('@company.org');
    });

    it('should handle short local parts', () => {
      const result = maskEmail('a@example.com');

      expect(result).toBe('**@example.com');
    });

    it('should return invalid emails unchanged', () => {
      expect(maskEmail('notanemail')).toBe('notanemail');
      expect(maskEmail(null)).toBeNull();
    });

    it('should handle empty string', () => {
      expect(maskEmail('')).toBe('');
    });

    it('should handle undefined', () => {
      expect(maskEmail(undefined)).toBeUndefined();
    });

    it('should handle non-string input', () => {
      expect(maskEmail(123)).toBe(123);
      expect(maskEmail({})).toEqual({});
    });

    it('should limit asterisks to 8 for long local parts', () => {
      const result = maskEmail('verylongemailaddress@example.com');

      const asterisks = result.split('@')[0].match(/\*/g).length;
      expect(asterisks).toBeLessThanOrEqual(8);
    });

    it('should handle multiple @ symbols gracefully', () => {
      const result = maskEmail('test@@example.com');

      expect(result).toContain('@');
    });

    it('should handle two-character local part', () => {
      const result = maskEmail('ab@example.com');

      expect(result).toBe('ab@example.com');
    });
  });

  describe('maskDatabaseUrl', () => {
    it('should mask PostgreSQL password', () => {
      const url = 'postgresql://user:secretpassword@localhost:5432/mydb';
      const result = maskDatabaseUrl(url);

      expect(result).toBe('postgresql://user:****@localhost:5432/mydb');
    });

    it('should mask MySQL password', () => {
      const url = 'mysql://admin:password123@db.server.com/database';
      const result = maskDatabaseUrl(url);

      expect(result).toBe('mysql://admin:****@db.server.com/database');
    });

    it('should mask MongoDB password', () => {
      const url = 'mongodb://user:pass@cluster.mongodb.net/db';
      const result = maskDatabaseUrl(url);

      expect(result).toBe('mongodb://user:****@cluster.mongodb.net/db');
    });

    it('should mask Redis password', () => {
      const url = 'redis://default:mypassword@redis.host:6379';
      const result = maskDatabaseUrl(url);

      expect(result).toBe('redis://default:****@redis.host:6379');
    });

    it('should return non-string values unchanged', () => {
      expect(maskDatabaseUrl(null)).toBeNull();
      expect(maskDatabaseUrl(123)).toBe(123);
    });

    it('should handle empty string', () => {
      expect(maskDatabaseUrl('')).toBe('');
    });

    it('should handle URLs without passwords', () => {
      const url = 'postgresql://localhost:5432/mydb';
      const result = maskDatabaseUrl(url);

      expect(result).toBe('postgresql://localhost:5432/mydb');
    });

    it('should be case insensitive', () => {
      const url = 'PostgreSQL://user:pass@host/db';
      const result = maskDatabaseUrl(url);

      expect(result).toBe('PostgreSQL://user:****@host/db');
    });
  });

  describe('maskSensitiveString', () => {
    it('should mask OpenAI keys in text', () => {
      const text = 'My key is sk-abcdefghijklmnopqrstuvwxyz12345678';
      const result = maskSensitiveString(text);

      expect(result).not.toContain('abcdefghijklmnopqrstuvwxyz12345678');
    });

    it('should mask JWT tokens', () => {
      const text = 'Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const result = maskSensitiveString(text);

      expect(result).toContain('eyJ****[JWT_TOKEN]****');
    });

    it('should mask Bearer tokens', () => {
      const text = 'Authorization: Bearer abc123token456';
      const result = maskSensitiveString(text);

      expect(result).toContain('Bearer ****');
    });

    it('should mask credit card numbers', () => {
      const text = 'Card: 4111-1111-1111-1111';
      const result = maskSensitiveString(text);

      expect(result).toContain('****-****-****-1111');
    });

    it('should mask password fields in JSON', () => {
      const text = '{"username": "admin", "password": "secret123"}';
      const result = maskSensitiveString(text);

      expect(result).toContain('"password": "****"');
      expect(result).not.toContain('secret123');
    });

    it('should mask secret fields in JSON', () => {
      const text = '{"secret": "mysupersecret"}';
      const result = maskSensitiveString(text);

      expect(result).toContain('"secret": "****"');
    });

    it('should return non-string values unchanged', () => {
      expect(maskSensitiveString(null)).toBeNull();
      expect(maskSensitiveString(undefined)).toBeUndefined();
    });

    it('should mask multiple patterns in same string', () => {
      const text = 'Key: sk-test123456789 Token: eyJ.test.token Email: test@example.com';
      const result = maskSensitiveString(text);

      expect(result).not.toContain('sk-test123456789');
      expect(result).toContain('eyJ****[JWT_TOKEN]****');
    });

    it('should mask UUIDs (Gladia keys)', () => {
      const text = 'API key: 12345678-1234-1234-1234-123456789abc';
      const result = maskSensitiveString(text);

      expect(result).toContain('12345678-****-****-****-9abc');
    });

    it('should mask token fields in JSON', () => {
      const text = '{"token": "secret-token-value"}';
      const result = maskSensitiveString(text);

      expect(result).toContain('"token": "****"');
    });

    it('should mask api_key fields in JSON', () => {
      const text = '{"api_key": "my-api-key"}';
      const result = maskSensitiveString(text);

      expect(result).toContain('"api_key": "****"');
    });

    it('should handle empty string', () => {
      expect(maskSensitiveString('')).toBe('');
    });

    it('should mask Anthropic keys', () => {
      const text = 'Using sk-ant-api03-1234567890abcdef';
      const result = maskSensitiveString(text);

      expect(result).not.toContain('1234567890abcdef');
    });

    it('should mask database URLs', () => {
      const text = 'DB: postgresql://user:password@host/db';
      const result = maskSensitiveString(text);

      expect(result).toContain('postgresql://user:****@host/db');
    });

    it('should mask credit cards without dashes', () => {
      const text = 'Card: 4111 1111 1111 1111';
      const result = maskSensitiveString(text);

      expect(result).toContain('****-****-****-1111');
    });
  });

  describe('maskSensitiveObject', () => {
    it('should mask password fields', () => {
      const obj = { username: 'admin', password: 'secret123' };
      const result = maskSensitiveObject(obj);

      expect(result.username).toBe('admin');
      expect(result.password).not.toBe('secret123');
    });

    it('should mask api_key fields', () => {
      const obj = { api_key: 'sk-proj-abcdefghijklmnop1234' };
      const result = maskSensitiveObject(obj);

      expect(result.api_key).toBe('sk-proj-****1234');
    });

    it('should mask token fields', () => {
      const obj = { access_token: 'bearer-token-here-12345678' };
      const result = maskSensitiveObject(obj);

      expect(result.access_token).not.toBe('bearer-token-here-12345678');
    });

    it('should handle nested objects', () => {
      const obj = {
        user: 'admin',
        credentials: {
          password: 'secret',
          api_key: 'key123456789012345678901234'
        }
      };
      const result = maskSensitiveObject(obj);

      expect(result.user).toBe('admin');
      expect(result.credentials.password).not.toBe('secret');
    });

    it('should handle arrays', () => {
      const obj = {
        tokens: [
          { token: 'token1234567890123456' },
          { token: 'token9876543210987654' }
        ]
      };
      const result = maskSensitiveObject(obj);

      expect(result.tokens[0].token).not.toBe('token1234567890123456');
    });

    it('should use custom sensitive keys', () => {
      const obj = { myCustomSecret: 'hidden_value_12345678' };
      const result = maskSensitiveObject(obj, ['myCustomSecret']);

      expect(result.myCustomSecret).not.toBe('hidden_value_12345678');
    });

    it('should return non-object values unchanged', () => {
      expect(maskSensitiveObject(null)).toBeNull();
      expect(maskSensitiveObject('string')).toBe('string');
    });

    it('should mask database URLs in objects', () => {
      const obj = {
        databaseUrl: 'postgresql://user:password@localhost/db'
      };
      const result = maskSensitiveObject(obj);

      expect(result.databaseUrl).toBe('postgresql://user:****@localhost/db');
    });

    it('should mask email fields', () => {
      const obj = {
        userEmail: 'john.doe@example.com',
        contactEmail: 'contact@company.com'
      };
      const result = maskSensitiveObject(obj);

      expect(result.userEmail).toContain('@example.com');
      expect(result.userEmail).not.toBe('john.doe@example.com');
    });

    it('should handle deeply nested objects', () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              password: 'deep-secret'
            }
          }
        }
      };
      const result = maskSensitiveObject(obj);

      expect(result.level1.level2.level3.password).not.toBe('deep-secret');
    });

    it('should mask camelCase field names', () => {
      const obj = {
        apiKey: 'test-key',
        accessToken: 'test-token',
        jwtSecret: 'secret-jwt'
      };
      const result = maskSensitiveObject(obj);

      expect(result.apiKey).not.toBe('test-key');
      expect(result.accessToken).not.toBe('test-token');
      expect(result.jwtSecret).not.toBe('secret-jwt');
    });

    it('should mask kebab-case field names', () => {
      const obj = {
        'api-key': 'test-key',
        'private-key': 'private'
      };
      const result = maskSensitiveObject(obj);

      expect(result['api-key']).not.toBe('test-key');
      expect(result['private-key']).not.toBe('private');
    });

    it('should mask snake_case field names', () => {
      const obj = {
        api_key: 'test-key',
        private_key: 'private',
        refresh_token: 'token'
      };
      const result = maskSensitiveObject(obj);

      expect(result.api_key).not.toBe('test-key');
      expect(result.private_key).not.toBe('private');
      expect(result.refresh_token).not.toBe('token');
    });

    it('should handle arrays of primitives', () => {
      const obj = {
        tokens: ['token1', 'token2', 'token3']
      };
      const result = maskSensitiveObject(obj);

      expect(Array.isArray(result.tokens)).toBe(true);
    });

    it('should preserve non-sensitive fields', () => {
      const obj = {
        username: 'john',
        email: 'john@example.com',
        role: 'admin',
        password: 'secret'
      };
      const result = maskSensitiveObject(obj);

      expect(result.username).toBe('john');
      expect(result.role).toBe('admin');
      expect(result.password).not.toBe('secret');
    });
  });

  describe('getMaskedEnv', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should mask sensitive environment variables', () => {
      process.env.OPENAI_API_KEY = 'sk-abcdefghijklmnopqrstuvwxyz123456';
      process.env.JWT_SECRET = 'my-super-secret-jwt-key';
      process.env.NODE_ENV = 'test';

      const result = getMaskedEnv();

      expect(result.OPENAI_API_KEY).not.toBe('sk-abcdefghijklmnopqrstuvwxyz123456');
      expect(result.JWT_SECRET).not.toBe('my-super-secret-jwt-key');
      expect(result.NODE_ENV).toBe('test');
    });

    it('should return [NOT_SET] for undefined sensitive vars', () => {
      process.env.OPENAI_API_KEY = undefined;

      const result = getMaskedEnv();

      expect(result.OPENAI_API_KEY === '[NOT_SET]' || result.OPENAI_API_KEY === undefined).toBe(true);
    });

    it('should mask DATABASE_URL', () => {
      process.env.DATABASE_URL = 'postgresql://user:password@host/db';

      const result = getMaskedEnv();

      expect(result.DATABASE_URL).not.toBe('postgresql://user:password@host/db');
    });

    it('should preserve non-sensitive variables', () => {
      process.env.PORT = '3000';
      process.env.NODE_ENV = 'development';

      const result = getMaskedEnv();

      expect(result.PORT).toBe('3000');
      expect(result.NODE_ENV).toBe('development');
    });

    it('should mask variables with "secret" in name', () => {
      process.env.MY_SECRET_KEY = 'secret-value';

      const result = getMaskedEnv();

      expect(result.MY_SECRET_KEY).not.toBe('secret-value');
    });

    it('should mask variables with "password" in name', () => {
      process.env.ADMIN_PASSWORD = 'admin-pass';

      const result = getMaskedEnv();

      expect(result.ADMIN_PASSWORD).not.toBe('admin-pass');
    });

    it('should mask variables with "token" in name', () => {
      process.env.GITHUB_TOKEN = 'github-token';

      const result = getMaskedEnv();

      expect(result.GITHUB_TOKEN).not.toBe('github-token');
    });

    it('should mask all listed sensitive env vars', () => {
      const sensitiveVars = [
        'OPENAI_API_KEY',
        'ANTHROPIC_API_KEY',
        'GEMINI_API_KEY',
        'STRIPE_SECRET_KEY',
        'TELEGRAM_BOT_TOKEN'
      ];

      sensitiveVars.forEach(varName => {
        process.env[varName] = 'sensitive-value';
      });

      const result = getMaskedEnv();

      sensitiveVars.forEach(varName => {
        expect(result[varName]).not.toBe('sensitive-value');
      });
    });
  });

  describe('createSafeLogger', () => {
    it('should mask strings in log arguments', () => {
      const mockLog = jest.fn();
      const safeLog = createSafeLogger(mockLog);

      safeLog('API key is sk-abcdefghijklmnopqrstuvwxyz12345678');

      expect(mockLog).toHaveBeenCalled();
      const loggedValue = mockLog.mock.calls[0][0];
      expect(loggedValue).not.toContain('abcdefghijklmnopqrstuvwxyz12345678');
    });

    it('should mask objects in log arguments', () => {
      const mockLog = jest.fn();
      const safeLog = createSafeLogger(mockLog);

      safeLog({ password: 'secret123', username: 'admin' });

      expect(mockLog).toHaveBeenCalled();
      const loggedValue = mockLog.mock.calls[0][0];
      expect(loggedValue.username).toBe('admin');
      expect(loggedValue.password).not.toBe('secret123');
    });

    it('should pass through non-sensitive values', () => {
      const mockLog = jest.fn();
      const safeLog = createSafeLogger(mockLog);

      safeLog('Hello', 123, true);

      expect(mockLog).toHaveBeenCalledWith('Hello', 123, true);
    });

    it('should handle multiple arguments', () => {
      const mockLog = jest.fn();
      const safeLog = createSafeLogger(mockLog);

      safeLog('Message', { password: 'secret' }, 'More text');

      expect(mockLog).toHaveBeenCalledTimes(1);
      expect(mockLog.mock.calls[0].length).toBe(3);
    });

    it('should handle null and undefined', () => {
      const mockLog = jest.fn();
      const safeLog = createSafeLogger(mockLog);

      safeLog(null, undefined, 'text');

      expect(mockLog).toHaveBeenCalledWith(null, undefined, 'text');
    });

    it('should mask nested sensitive data', () => {
      const mockLog = jest.fn();
      const safeLog = createSafeLogger(mockLog);

      safeLog({
        level1: {
          level2: {
            apiKey: 'sk-test-key-12345678901234567890'
          }
        }
      });

      const loggedValue = mockLog.mock.calls[0][0];
      expect(loggedValue.level1.level2.apiKey).not.toBe('sk-test-key-12345678901234567890');
    });

    it('should return the result of the original logger', () => {
      const mockLog = jest.fn().mockReturnValue('logged');
      const safeLog = createSafeLogger(mockLog);

      const result = safeLog('test');

      expect(result).toBe('logged');
    });

    it('should handle arrays in log arguments', () => {
      const mockLog = jest.fn();
      const safeLog = createSafeLogger(mockLog);

      safeLog(['normal', { password: 'secret' }]);

      expect(mockLog).toHaveBeenCalled();
      const loggedValue = mockLog.mock.calls[0][0];
      expect(loggedValue[1].password).not.toBe('secret');
    });
  });
});
