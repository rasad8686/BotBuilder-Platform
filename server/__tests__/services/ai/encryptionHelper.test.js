/**
 * Encryption Helper Tests
 * Tests for server/services/ai/encryptionHelper.js
 */

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const EncryptionHelper = require('../../../services/ai/encryptionHelper');

describe('EncryptionHelper', () => {
  describe('getEncryptionKey', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should use AI_ENCRYPTION_SECRET if available', () => {
      process.env.AI_ENCRYPTION_SECRET = 'test-secret-key';
      const key = EncryptionHelper.getEncryptionKey();
      expect(key).toBeDefined();
      expect(key.length).toBe(32);
    });

    it('should fall back to JWT_SECRET', () => {
      delete process.env.AI_ENCRYPTION_SECRET;
      process.env.JWT_SECRET = 'jwt-secret-key';
      const key = EncryptionHelper.getEncryptionKey();
      expect(key).toBeDefined();
      expect(key.length).toBe(32);
    });

    it('should use insecure default in non-production', () => {
      delete process.env.AI_ENCRYPTION_SECRET;
      delete process.env.JWT_SECRET;
      process.env.NODE_ENV = 'development';
      const key = EncryptionHelper.getEncryptionKey();
      expect(key).toBeDefined();
      expect(key.length).toBe(32);
    });

    it('should throw in production without key', () => {
      delete process.env.AI_ENCRYPTION_SECRET;
      delete process.env.JWT_SECRET;
      process.env.NODE_ENV = 'production';
      expect(() => EncryptionHelper.getEncryptionKey()).toThrow();
    });
  });

  describe('encrypt and decrypt', () => {
    beforeEach(() => {
      process.env.AI_ENCRYPTION_SECRET = 'test-encryption-key-for-testing';
    });

    it('should encrypt and decrypt a string', () => {
      const plaintext = 'sk-test-api-key-12345';
      const encrypted = EncryptionHelper.encrypt(plaintext);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.split(':').length).toBe(3);

      const decrypted = EncryptionHelper.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should return null for empty plaintext', () => {
      expect(EncryptionHelper.encrypt('')).toBeNull();
      expect(EncryptionHelper.encrypt(null)).toBeNull();
      expect(EncryptionHelper.encrypt(undefined)).toBeNull();
    });

    it('should return null for empty encrypted text', () => {
      expect(EncryptionHelper.decrypt('')).toBeNull();
      expect(EncryptionHelper.decrypt(null)).toBeNull();
      expect(EncryptionHelper.decrypt(undefined)).toBeNull();
    });

    it('should throw for invalid encrypted format', () => {
      expect(() => EncryptionHelper.decrypt('invalid-format')).toThrow('Failed to decrypt data');
    });

    it('should throw for tampered encrypted data', () => {
      const encrypted = EncryptionHelper.encrypt('test-data');
      const tampered = encrypted.replace(/.$/, 'X');
      expect(() => EncryptionHelper.decrypt(tampered)).toThrow('Failed to decrypt data');
    });
  });

  describe('hash', () => {
    it('should hash a string', () => {
      const text = 'test-string';
      const hash = EncryptionHelper.hash(text);

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64); // SHA-256 produces 64 hex chars
    });

    it('should return consistent hashes', () => {
      const text = 'test-string';
      const hash1 = EncryptionHelper.hash(text);
      const hash2 = EncryptionHelper.hash(text);

      expect(hash1).toBe(hash2);
    });

    it('should return null for empty text', () => {
      expect(EncryptionHelper.hash('')).toBeNull();
      expect(EncryptionHelper.hash(null)).toBeNull();
      expect(EncryptionHelper.hash(undefined)).toBeNull();
    });
  });

  describe('verifyHash', () => {
    it('should verify matching hash', () => {
      const text = 'test-string';
      const hash = EncryptionHelper.hash(text);

      expect(EncryptionHelper.verifyHash(text, hash)).toBe(true);
    });

    it('should reject non-matching hash', () => {
      expect(EncryptionHelper.verifyHash('text', 'wrong-hash')).toBe(false);
    });

    it('should return false for empty inputs', () => {
      expect(EncryptionHelper.verifyHash('', 'hash')).toBe(false);
      expect(EncryptionHelper.verifyHash('text', '')).toBe(false);
      expect(EncryptionHelper.verifyHash(null, 'hash')).toBe(false);
      expect(EncryptionHelper.verifyHash('text', null)).toBe(false);
    });
  });

  describe('maskApiKey', () => {
    it('should mask long API key', () => {
      const apiKey = 'sk-ant-api03-verylongapikeythatshouldbemasks';
      const masked = EncryptionHelper.maskApiKey(apiKey);

      expect(masked).toMatch(/^sk-a.*sks$/);
      expect(masked).toContain('*');
    });

    it('should return **** for short API key', () => {
      expect(EncryptionHelper.maskApiKey('short')).toBe('****');
    });

    it('should return empty string for empty input', () => {
      expect(EncryptionHelper.maskApiKey('')).toBe('');
      expect(EncryptionHelper.maskApiKey(null)).toBe('');
      expect(EncryptionHelper.maskApiKey(undefined)).toBe('');
    });
  });

  describe('testEncryption', () => {
    beforeEach(() => {
      process.env.AI_ENCRYPTION_SECRET = 'test-key';
    });

    it('should return true when encryption works', () => {
      expect(EncryptionHelper.testEncryption()).toBe(true);
    });
  });

  describe('generateRandomKey', () => {
    it('should generate random key of default length', () => {
      const key = EncryptionHelper.generateRandomKey();
      expect(key.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it('should generate random key of custom length', () => {
      const key = EncryptionHelper.generateRandomKey(16);
      expect(key.length).toBe(32); // 16 bytes = 32 hex chars
    });

    it('should generate unique keys', () => {
      const key1 = EncryptionHelper.generateRandomKey();
      const key2 = EncryptionHelper.generateRandomKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe('validateApiKeyFormat', () => {
    it('should validate OpenAI API key', () => {
      const result = EncryptionHelper.validateApiKeyFormat('sk-12345678901234567890', 'openai');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid OpenAI API key prefix', () => {
      const result = EncryptionHelper.validateApiKeyFormat('invalid-key', 'openai');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('sk-');
    });

    it('should reject short OpenAI API key', () => {
      const result = EncryptionHelper.validateApiKeyFormat('sk-short', 'openai');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too short');
    });

    it('should validate Claude API key', () => {
      const result = EncryptionHelper.validateApiKeyFormat(
        'sk-ant-' + 'x'.repeat(50),
        'claude'
      );
      expect(result.valid).toBe(true);
    });

    it('should reject invalid Claude API key prefix', () => {
      const result = EncryptionHelper.validateApiKeyFormat('sk-invalid', 'claude');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('sk-ant-');
    });

    it('should reject short Claude API key', () => {
      const result = EncryptionHelper.validateApiKeyFormat('sk-ant-short', 'claude');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too short');
    });

    it('should use generic validation for unknown provider', () => {
      const result = EncryptionHelper.validateApiKeyFormat('validkey12345', 'unknown');
      expect(result.valid).toBe(true);
    });

    it('should reject short key for unknown provider', () => {
      const result = EncryptionHelper.validateApiKeyFormat('short', 'unknown');
      expect(result.valid).toBe(false);
    });

    it('should reject missing API key', () => {
      const result = EncryptionHelper.validateApiKeyFormat('', 'openai');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject non-string API key', () => {
      const result = EncryptionHelper.validateApiKeyFormat(123, 'openai');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('string');
    });
  });
});
