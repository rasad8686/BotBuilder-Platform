/**
 * Encryption Helper Tests
 * Comprehensive tests for encryption and decryption utilities
 */

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const EncryptionHelper = require('../../../services/ai/encryptionHelper');
const log = require('../../../utils/logger');

describe('EncryptionHelper', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getEncryptionKey', () => {
    it('should use AI_ENCRYPTION_SECRET if available', () => {
      process.env.AI_ENCRYPTION_SECRET = 'test-secret-key';
      const key = EncryptionHelper.getEncryptionKey();

      expect(key).toBeDefined();
      expect(key.length).toBe(32);
      expect(Buffer.isBuffer(key)).toBe(true);
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
      expect(log.warn).toHaveBeenCalled();
    });

    it('should throw in production without key', () => {
      delete process.env.AI_ENCRYPTION_SECRET;
      delete process.env.JWT_SECRET;
      process.env.NODE_ENV = 'production';

      expect(() => EncryptionHelper.getEncryptionKey()).toThrow('AI_ENCRYPTION_SECRET or JWT_SECRET must be set in production');
    });

    it('should prefer AI_ENCRYPTION_SECRET over JWT_SECRET', () => {
      process.env.AI_ENCRYPTION_SECRET = 'encryption-secret';
      process.env.JWT_SECRET = 'jwt-secret';

      const key1 = EncryptionHelper.getEncryptionKey();

      delete process.env.AI_ENCRYPTION_SECRET;
      const key2 = EncryptionHelper.getEncryptionKey();

      expect(key1).not.toEqual(key2);
    });

    it('should return consistent key for same secret', () => {
      process.env.AI_ENCRYPTION_SECRET = 'consistent-secret';

      const key1 = EncryptionHelper.getEncryptionKey();
      const key2 = EncryptionHelper.getEncryptionKey();

      expect(key1).toEqual(key2);
    });

    it('should handle empty string secret in development', () => {
      process.env.AI_ENCRYPTION_SECRET = '';
      process.env.NODE_ENV = 'development';

      const key = EncryptionHelper.getEncryptionKey();

      expect(key).toBeDefined();
      expect(log.warn).toHaveBeenCalled();
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

    it('should produce different ciphertext for same plaintext', () => {
      const plaintext = 'test-data';
      const encrypted1 = EncryptionHelper.encrypt(plaintext);
      const encrypted2 = EncryptionHelper.encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
      expect(EncryptionHelper.decrypt(encrypted1)).toBe(plaintext);
      expect(EncryptionHelper.decrypt(encrypted2)).toBe(plaintext);
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

    it('should handle long strings', () => {
      const longText = 'a'.repeat(1000);
      const encrypted = EncryptionHelper.encrypt(longText);
      const decrypted = EncryptionHelper.decrypt(encrypted);

      expect(decrypted).toBe(longText);
    });

    it('should handle special characters', () => {
      const specialText = '!@#$%^&*()_+-=[]{}|;:",.<>?/~`';
      const encrypted = EncryptionHelper.encrypt(specialText);
      const decrypted = EncryptionHelper.decrypt(encrypted);

      expect(decrypted).toBe(specialText);
    });

    it('should handle unicode characters', () => {
      const unicodeText = '你好世界 🌍 مرحبا';
      const encrypted = EncryptionHelper.encrypt(unicodeText);
      const decrypted = EncryptionHelper.decrypt(encrypted);

      expect(decrypted).toBe(unicodeText);
    });

    it('should handle newlines and tabs', () => {
      const text = 'line1\nline2\tcolumn';
      const encrypted = EncryptionHelper.encrypt(text);
      const decrypted = EncryptionHelper.decrypt(encrypted);

      expect(decrypted).toBe(text);
    });

    it('should throw for encrypted text with wrong format (missing parts)', () => {
      expect(() => EncryptionHelper.decrypt('part1:part2')).toThrow('Failed to decrypt data');
    });

    it('should throw for encrypted text with too many parts', () => {
      expect(() => EncryptionHelper.decrypt('part1:part2:part3:part4')).toThrow('Failed to decrypt data');
    });

    it('should log error when encryption fails', () => {
      const originalMethod = EncryptionHelper.getEncryptionKey;
      EncryptionHelper.getEncryptionKey = () => { throw new Error('Key error'); };

      expect(() => EncryptionHelper.encrypt('test')).toThrow('Failed to encrypt data');
      expect(log.error).toHaveBeenCalled();

      EncryptionHelper.getEncryptionKey = originalMethod;
    });

    it('should log error when decryption fails', () => {
      expect(() => EncryptionHelper.decrypt('invalid:data:here')).toThrow('Failed to decrypt data');
      expect(log.error).toHaveBeenCalled();
    });

    it('should handle JSON strings', () => {
      const jsonText = JSON.stringify({ key: 'value', nested: { data: [1, 2, 3] } });
      const encrypted = EncryptionHelper.encrypt(jsonText);
      const decrypted = EncryptionHelper.decrypt(encrypted);

      expect(decrypted).toBe(jsonText);
      expect(JSON.parse(decrypted)).toEqual(JSON.parse(jsonText));
    });

    it('should have all three parts in encrypted format', () => {
      const encrypted = EncryptionHelper.encrypt('test');
      const parts = encrypted.split(':');

      expect(parts).toHaveLength(3);
      expect(parts[0]).toMatch(/^[0-9a-f]+$/); // IV in hex
      expect(parts[1]).toMatch(/^[0-9a-f]+$/); // Auth tag in hex
      expect(parts[2]).toMatch(/^[0-9a-f]+$/); // Ciphertext in hex
    });
  });

  describe('hash', () => {
    it('should hash a string', () => {
      const text = 'test-string';
      const hash = EncryptionHelper.hash(text);

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64); // SHA-256 produces 64 hex chars
      expect(hash).toMatch(/^[0-9a-f]+$/);
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

    it('should produce different hashes for different inputs', () => {
      const hash1 = EncryptionHelper.hash('text1');
      const hash2 = EncryptionHelper.hash('text2');

      expect(hash1).not.toBe(hash2);
    });

    it('should be case sensitive', () => {
      const hash1 = EncryptionHelper.hash('Test');
      const hash2 = EncryptionHelper.hash('test');

      expect(hash1).not.toBe(hash2);
    });

    it('should handle long strings', () => {
      const longText = 'a'.repeat(10000);
      const hash = EncryptionHelper.hash(longText);

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });

    it('should handle special characters', () => {
      const hash = EncryptionHelper.hash('!@#$%^&*()');

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
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

    it('should be case sensitive', () => {
      const hash = EncryptionHelper.hash('Test');

      expect(EncryptionHelper.verifyHash('Test', hash)).toBe(true);
      expect(EncryptionHelper.verifyHash('test', hash)).toBe(false);
    });

    it('should handle special characters', () => {
      const text = '!@#$%^&*()';
      const hash = EncryptionHelper.hash(text);

      expect(EncryptionHelper.verifyHash(text, hash)).toBe(true);
    });

    it('should reject modified plaintext', () => {
      const hash = EncryptionHelper.hash('original');

      expect(EncryptionHelper.verifyHash('modified', hash)).toBe(false);
    });

    it('should reject modified hash', () => {
      const text = 'test';
      const hash = EncryptionHelper.hash(text);
      const modifiedHash = hash.substring(0, hash.length - 1) + 'x';

      expect(EncryptionHelper.verifyHash(text, modifiedHash)).toBe(false);
    });
  });

  describe('maskApiKey', () => {
    it('should mask long API key', () => {
      const apiKey = 'sk-ant-api03-verylongapikeythatshouldbemasks';
      const masked = EncryptionHelper.maskApiKey(apiKey);

      expect(masked).toMatch(/^sk-a.*sks$/);
      expect(masked).toContain('*');
      expect(masked).not.toContain('verylongapikey');
    });

    it('should return **** for short API key', () => {
      expect(EncryptionHelper.maskApiKey('short')).toBe('****');
    });

    it('should return empty string for empty input', () => {
      expect(EncryptionHelper.maskApiKey('')).toBe('');
      expect(EncryptionHelper.maskApiKey(null)).toBe('');
      expect(EncryptionHelper.maskApiKey(undefined)).toBe('');
    });

    it('should show first 4 and last 4 characters', () => {
      const key = 'sk-test-1234567890-abcdefghijk';
      const masked = EncryptionHelper.maskApiKey(key);

      expect(masked.startsWith('sk-t')).toBe(true);
      expect(masked.endsWith('hijk')).toBe(true);
    });

    it('should limit middle asterisks to 20', () => {
      const longKey = 'a'.repeat(100);
      const masked = EncryptionHelper.maskApiKey(longKey);

      const asterisks = (masked.match(/\*/g) || []).length;
      expect(asterisks).toBe(20);
    });

    it('should handle exactly 8 character key', () => {
      const masked = EncryptionHelper.maskApiKey('12345678');

      expect(masked).toBe('****');
    });

    it('should handle 9 character key', () => {
      const masked = EncryptionHelper.maskApiKey('123456789');

      expect(masked.length).toBeGreaterThan(0);
    });
  });

  describe('testEncryption', () => {
    beforeEach(() => {
      process.env.AI_ENCRYPTION_SECRET = 'test-key';
    });

    it('should return true when encryption works', () => {
      expect(EncryptionHelper.testEncryption()).toBe(true);
    });

    it('should return false when encryption fails', () => {
      const originalEncrypt = EncryptionHelper.encrypt;
      EncryptionHelper.encrypt = () => { throw new Error('Test error'); };

      expect(EncryptionHelper.testEncryption()).toBe(false);
      expect(log.error).toHaveBeenCalled();

      EncryptionHelper.encrypt = originalEncrypt;
    });

    it('should return false when decryption fails', () => {
      const originalDecrypt = EncryptionHelper.decrypt;
      EncryptionHelper.decrypt = () => { throw new Error('Test error'); };

      expect(EncryptionHelper.testEncryption()).toBe(false);
      expect(log.error).toHaveBeenCalled();

      EncryptionHelper.decrypt = originalDecrypt;
    });

    it('should test with default test string', () => {
      const result = EncryptionHelper.testEncryption();

      expect(result).toBe(true);
    });
  });

  describe('generateRandomKey', () => {
    it('should generate random key of default length', () => {
      const key = EncryptionHelper.generateRandomKey();

      expect(key.length).toBe(64); // 32 bytes = 64 hex chars
      expect(key).toMatch(/^[0-9a-f]+$/);
    });

    it('should generate random key of custom length', () => {
      const key = EncryptionHelper.generateRandomKey(16);

      expect(key.length).toBe(32); // 16 bytes = 32 hex chars
      expect(key).toMatch(/^[0-9a-f]+$/);
    });

    it('should generate unique keys', () => {
      const key1 = EncryptionHelper.generateRandomKey();
      const key2 = EncryptionHelper.generateRandomKey();

      expect(key1).not.toBe(key2);
    });

    it('should handle length of 1', () => {
      const key = EncryptionHelper.generateRandomKey(1);

      expect(key.length).toBe(2); // 1 byte = 2 hex chars
    });

    it('should handle large lengths', () => {
      const key = EncryptionHelper.generateRandomKey(128);

      expect(key.length).toBe(256); // 128 bytes = 256 hex chars
    });

    it('should generate cryptographically strong keys', () => {
      const keys = new Set();
      for (let i = 0; i < 100; i++) {
        keys.add(EncryptionHelper.generateRandomKey(8));
      }

      expect(keys.size).toBe(100); // All should be unique
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
      expect(result.error).toContain('too short');
    });

    it('should reject missing API key', () => {
      const result = EncryptionHelper.validateApiKeyFormat('', 'openai');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject null API key', () => {
      const result = EncryptionHelper.validateApiKeyFormat(null, 'openai');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject undefined API key', () => {
      const result = EncryptionHelper.validateApiKeyFormat(undefined, 'openai');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject non-string API key', () => {
      const result = EncryptionHelper.validateApiKeyFormat(123, 'openai');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('string');
    });

    it('should be case sensitive for OpenAI prefix', () => {
      const result = EncryptionHelper.validateApiKeyFormat('SK-12345678901234567890', 'openai');

      expect(result.valid).toBe(false);
    });

    it('should validate with lowercase provider name', () => {
      const result = EncryptionHelper.validateApiKeyFormat('sk-12345678901234567890', 'openai');

      expect(result.valid).toBe(true);
    });

    it('should validate with uppercase provider name', () => {
      const result = EncryptionHelper.validateApiKeyFormat('sk-12345678901234567890', 'OPENAI');

      expect(result.valid).toBe(true);
    });

    it('should validate with mixed case provider name', () => {
      const result = EncryptionHelper.validateApiKeyFormat('sk-ant-' + 'x'.repeat(50), 'ClAuDe');

      expect(result.valid).toBe(true);
    });

    it('should handle exactly 20 character OpenAI key', () => {
      const result = EncryptionHelper.validateApiKeyFormat('sk-' + 'x'.repeat(17), 'openai');

      expect(result.valid).toBe(true);
    });

    it('should handle exactly 50 character Claude key', () => {
      const result = EncryptionHelper.validateApiKeyFormat('sk-ant-' + 'x'.repeat(43), 'claude');

      expect(result.valid).toBe(true);
    });

    it('should handle exactly 10 character generic key', () => {
      const result = EncryptionHelper.validateApiKeyFormat('1234567890', 'other');

      expect(result.valid).toBe(true);
    });

    it('should reject 9 character generic key', () => {
      const result = EncryptionHelper.validateApiKeyFormat('123456789', 'other');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('too short');
    });
  });
});
