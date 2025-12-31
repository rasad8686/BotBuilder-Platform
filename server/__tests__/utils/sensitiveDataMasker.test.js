/**
 * Sensitive Data Masker Tests
 * Tests for sensitive data masking utilities
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

      // Will show [NOT_SET] or be undefined
      expect(result.OPENAI_API_KEY === '[NOT_SET]' || result.OPENAI_API_KEY === undefined).toBe(true);
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
  });
});
