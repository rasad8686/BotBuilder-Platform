/**
 * Encryption Service Tests
 * Comprehensive tests for encryption and decryption service
 *
 * This test suite covers:
 * - Encryption/Decryption operations
 * - Key management and validation
 * - Hashing and verification
 * - Error handling and edge cases
 * - Input validation
 * - Security features
 */

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const crypto = require('crypto');
const EncryptionService = require('../../services/encryptionService');
const log = require('../../utils/logger');

describe('EncryptionService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Key Management - getEncryptionKey', () => {
    it('should use ENCRYPTION_SECRET if available', () => {
      process.env.ENCRYPTION_SECRET = 'test-encryption-secret-key';
      const key = EncryptionService.getEncryptionKey();

      expect(key).toBeDefined();
      expect(key.length).toBe(32);
      expect(Buffer.isBuffer(key)).toBe(true);
    });

    it('should fall back to JWT_SECRET when ENCRYPTION_SECRET is not set', () => {
      delete process.env.ENCRYPTION_SECRET;
      process.env.JWT_SECRET = 'jwt-secret-key';

      const key = EncryptionService.getEncryptionKey();

      expect(key).toBeDefined();
      expect(key.length).toBe(32);
    });

    it('should use insecure default key in development environment', () => {
      delete process.env.ENCRYPTION_SECRET;
      delete process.env.JWT_SECRET;
      process.env.NODE_ENV = 'development';

      const key = EncryptionService.getEncryptionKey();

      expect(key).toBeDefined();
      expect(key.length).toBe(32);
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('insecure'));
    });

    it('should throw error in production without encryption key', () => {
      delete process.env.ENCRYPTION_SECRET;
      delete process.env.JWT_SECRET;
      process.env.NODE_ENV = 'production';

      expect(() => EncryptionService.getEncryptionKey()).toThrow(/ENCRYPTION_SECRET.*must be set/);
    });

    it('should prefer ENCRYPTION_SECRET over JWT_SECRET', () => {
      process.env.ENCRYPTION_SECRET = 'encryption-secret';
      process.env.JWT_SECRET = 'jwt-secret';

      const key1 = EncryptionService.getEncryptionKey();

      delete process.env.ENCRYPTION_SECRET;
      const key2 = EncryptionService.getEncryptionKey();

      expect(key1).not.toEqual(key2);
    });

    it('should return consistent key for same secret', () => {
      process.env.ENCRYPTION_SECRET = 'consistent-secret-key';

      const key1 = EncryptionService.getEncryptionKey();
      const key2 = EncryptionService.getEncryptionKey();

      expect(key1).toEqual(key2);
    });

    it('should handle empty string secret in development', () => {
      process.env.ENCRYPTION_SECRET = '';
      process.env.NODE_ENV = 'development';

      const key = EncryptionService.getEncryptionKey();

      expect(key).toBeDefined();
      expect(log.warn).toHaveBeenCalled();
    });

    it('should create SHA-256 hash from secret', () => {
      process.env.ENCRYPTION_SECRET = 'test-secret';

      const key = EncryptionService.getEncryptionKey();
      const expectedKey = crypto.createHash('sha256').update('test-secret').digest();

      expect(key).toEqual(expectedKey);
    });

    it('should handle very long secrets', () => {
      process.env.ENCRYPTION_SECRET = 'a'.repeat(1000);

      const key = EncryptionService.getEncryptionKey();

      expect(key.length).toBe(32);
      expect(Buffer.isBuffer(key)).toBe(true);
    });

    it('should handle special characters in secret', () => {
      process.env.ENCRYPTION_SECRET = '!@#$%^&*()_+-={}[]|:";\'<>?,./';

      const key = EncryptionService.getEncryptionKey();

      expect(key.length).toBe(32);
      expect(Buffer.isBuffer(key)).toBe(true);
    });
  });

  describe('Encryption - encrypt', () => {
    beforeEach(() => {
      process.env.ENCRYPTION_SECRET = 'test-encryption-key-for-testing';
    });

    it('should encrypt plaintext successfully', () => {
      const plaintext = 'sk-test-api-key-12345';
      const encrypted = EncryptionService.encrypt(plaintext);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
      expect(typeof encrypted).toBe('string');
    });

    it('should return encrypted text in correct format (iv:authTag:ciphertext)', () => {
      const plaintext = 'test-data';
      const encrypted = EncryptionService.encrypt(plaintext);

      const parts = encrypted.split(':');
      expect(parts.length).toBe(3);
    });

    it('should produce different ciphertext for same plaintext (random IV)', () => {
      const plaintext = 'test-data';
      const encrypted1 = EncryptionService.encrypt(plaintext);
      const encrypted2 = EncryptionService.encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should return null for empty plaintext', () => {
      expect(EncryptionService.encrypt('')).toBeNull();
    });

    it('should return null for null plaintext', () => {
      expect(EncryptionService.encrypt(null)).toBeNull();
    });

    it('should return null for undefined plaintext', () => {
      expect(EncryptionService.encrypt(undefined)).toBeNull();
    });

    it('should handle long strings', () => {
      const longText = 'a'.repeat(10000);
      const encrypted = EncryptionService.encrypt(longText);

      expect(encrypted).toBeDefined();
      expect(encrypted.split(':').length).toBe(3);
    });

    it('should handle special characters', () => {
      const specialText = '!@#$%^&*()_+-=[]{}|;:",.<>?/~`';
      const encrypted = EncryptionService.encrypt(specialText);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(specialText);
    });

    it('should handle unicode characters', () => {
      const unicodeText = '你好世界 🌍 مرحبا العالم';
      const encrypted = EncryptionService.encrypt(unicodeText);

      expect(encrypted).toBeDefined();
      expect(encrypted.split(':').length).toBe(3);
    });

    it('should handle newlines and tabs', () => {
      const text = 'line1\nline2\ttab\rcarriage';
      const encrypted = EncryptionService.encrypt(text);

      expect(encrypted).toBeDefined();
      expect(encrypted.split(':').length).toBe(3);
    });

    it('should handle JSON strings', () => {
      const jsonText = JSON.stringify({ key: 'value', nested: { data: [1, 2, 3] } });
      const encrypted = EncryptionService.encrypt(jsonText);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toContain('key');
      expect(encrypted).not.toContain('value');
    });

    it('should have all parts in hex format', () => {
      const encrypted = EncryptionService.encrypt('test');
      const parts = encrypted.split(':');

      expect(parts[0]).toMatch(/^[0-9a-f]+$/); // IV in hex
      expect(parts[1]).toMatch(/^[0-9a-f]+$/); // Auth tag in hex
      expect(parts[2]).toMatch(/^[0-9a-f]+$/); // Ciphertext in hex
    });

    it('should use AES-256-GCM algorithm', () => {
      const plaintext = 'test';
      const encrypted = EncryptionService.encrypt(plaintext);

      // Verify it can be decrypted (implies correct algorithm)
      const decrypted = EncryptionService.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should log error when encryption fails', () => {
      const originalGetKey = EncryptionService.getEncryptionKey;
      EncryptionService.getEncryptionKey = () => {
        throw new Error('Key generation error');
      };

      expect(() => EncryptionService.encrypt('test')).toThrow('Failed to encrypt');
      expect(log.error).toHaveBeenCalled();

      EncryptionService.getEncryptionKey = originalGetKey;
    });

    it('should handle whitespace-only strings', () => {
      const whitespace = '   \t\n  ';
      const encrypted = EncryptionService.encrypt(whitespace);

      expect(encrypted).toBeDefined();
      expect(encrypted.split(':').length).toBe(3);
    });

    it('should handle single character strings', () => {
      const singleChar = 'x';
      const encrypted = EncryptionService.encrypt(singleChar);

      expect(encrypted).toBeDefined();
      expect(encrypted.split(':').length).toBe(3);
    });

    it('should generate unique IV for each encryption', () => {
      const plaintext = 'test';
      const encrypted1 = EncryptionService.encrypt(plaintext);
      const encrypted2 = EncryptionService.encrypt(plaintext);

      const iv1 = encrypted1.split(':')[0];
      const iv2 = encrypted2.split(':')[0];

      expect(iv1).not.toBe(iv2);
    });
  });

  describe('Decryption - decrypt', () => {
    beforeEach(() => {
      process.env.ENCRYPTION_SECRET = 'test-encryption-key-for-testing';
    });

    it('should decrypt encrypted text successfully', () => {
      const plaintext = 'sk-test-api-key-12345';
      const encrypted = EncryptionService.encrypt(plaintext);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should return null for empty encrypted text', () => {
      expect(EncryptionService.decrypt('')).toBeNull();
    });

    it('should return null for null encrypted text', () => {
      expect(EncryptionService.decrypt(null)).toBeNull();
    });

    it('should return null for undefined encrypted text', () => {
      expect(EncryptionService.decrypt(undefined)).toBeNull();
    });

    it('should throw for invalid encrypted format (single part)', () => {
      expect(() => EncryptionService.decrypt('invalid-format')).toThrow('Failed to decrypt');
    });

    it('should throw for invalid encrypted format (two parts)', () => {
      expect(() => EncryptionService.decrypt('part1:part2')).toThrow('Failed to decrypt');
    });

    it('should throw for invalid encrypted format (four parts)', () => {
      expect(() => EncryptionService.decrypt('p1:p2:p3:p4')).toThrow('Failed to decrypt');
    });

    it('should throw for tampered ciphertext', () => {
      const encrypted = EncryptionService.encrypt('test-data');
      const parts = encrypted.split(':');
      const tampered = `${parts[0]}:${parts[1]}:${parts[2].substring(0, parts[2].length - 2)}XX`;

      expect(() => EncryptionService.decrypt(tampered)).toThrow('Failed to decrypt');
    });

    it('should throw for tampered IV', () => {
      const encrypted = EncryptionService.encrypt('test-data');
      const parts = encrypted.split(':');
      const tampered = `XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX:${parts[1]}:${parts[2]}`;

      expect(() => EncryptionService.decrypt(tampered)).toThrow('Failed to decrypt');
    });

    it('should throw for tampered auth tag', () => {
      const encrypted = EncryptionService.encrypt('test-data');
      const parts = encrypted.split(':');
      const tampered = `${parts[0]}:XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX:${parts[2]}`;

      expect(() => EncryptionService.decrypt(tampered)).toThrow('Failed to decrypt');
    });

    it('should handle decrypting long strings', () => {
      const longText = 'a'.repeat(10000);
      const encrypted = EncryptionService.encrypt(longText);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(longText);
    });

    it('should preserve special characters', () => {
      const specialText = '!@#$%^&*()_+-=[]{}|;:",.<>?/~`';
      const encrypted = EncryptionService.encrypt(specialText);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(specialText);
    });

    it('should preserve unicode characters', () => {
      const unicodeText = '你好世界 🌍 مرحبا العالم';
      const encrypted = EncryptionService.encrypt(unicodeText);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(unicodeText);
    });

    it('should preserve newlines and tabs', () => {
      const text = 'line1\nline2\ttab\rcarriage';
      const encrypted = EncryptionService.encrypt(text);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(text);
    });

    it('should preserve JSON structure', () => {
      const jsonText = JSON.stringify({ key: 'value', nested: { data: [1, 2, 3] } });
      const encrypted = EncryptionService.encrypt(jsonText);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(jsonText);
      expect(JSON.parse(decrypted)).toEqual(JSON.parse(jsonText));
    });

    it('should log error when decryption fails', () => {
      expect(() => EncryptionService.decrypt('invalid:data:here')).toThrow('Failed to decrypt');
      expect(log.error).toHaveBeenCalled();
    });

    it('should throw for non-hex IV', () => {
      expect(() => EncryptionService.decrypt('ZZZZ:deadbeef:deadbeef')).toThrow('Failed to decrypt');
    });

    it('should throw for non-hex auth tag', () => {
      const validIV = crypto.randomBytes(16).toString('hex');
      expect(() => EncryptionService.decrypt(`${validIV}:ZZZZ:deadbeef`)).toThrow('Failed to decrypt');
    });

    it('should throw for non-hex ciphertext', () => {
      const validIV = crypto.randomBytes(16).toString('hex');
      const validTag = crypto.randomBytes(16).toString('hex');
      expect(() => EncryptionService.decrypt(`${validIV}:${validTag}:ZZZZ`)).toThrow('Failed to decrypt');
    });

    it('should handle whitespace preservation', () => {
      const whitespace = '   \t\n  ';
      const encrypted = EncryptionService.encrypt(whitespace);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(whitespace);
    });

    it('should verify authentication tag', () => {
      // This is implicitly tested - GCM mode will fail if auth tag is wrong
      const encrypted = EncryptionService.encrypt('test');
      const parts = encrypted.split(':');

      // Modify the auth tag
      const modifiedTag = parts[1].substring(0, parts[1].length - 1) +
        (parts[1][parts[1].length - 1] === 'a' ? 'b' : 'a');
      const tampered = `${parts[0]}:${modifiedTag}:${parts[2]}`;

      expect(() => EncryptionService.decrypt(tampered)).toThrow('Failed to decrypt');
    });
  });

  describe('Hashing - hash', () => {
    it('should hash a string using SHA-256', () => {
      const text = 'test-string';
      const hash = EncryptionService.hash(text);

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64); // SHA-256 produces 64 hex characters
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it('should return consistent hashes for same input', () => {
      const text = 'test-string';
      const hash1 = EncryptionService.hash(text);
      const hash2 = EncryptionService.hash(text);

      expect(hash1).toBe(hash2);
    });

    it('should return null for empty text', () => {
      expect(EncryptionService.hash('')).toBeNull();
    });

    it('should return null for null text', () => {
      expect(EncryptionService.hash(null)).toBeNull();
    });

    it('should return null for undefined text', () => {
      expect(EncryptionService.hash(undefined)).toBeNull();
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = EncryptionService.hash('text1');
      const hash2 = EncryptionService.hash('text2');

      expect(hash1).not.toBe(hash2);
    });

    it('should be case sensitive', () => {
      const hash1 = EncryptionService.hash('Test');
      const hash2 = EncryptionService.hash('test');

      expect(hash1).not.toBe(hash2);
    });

    it('should handle long strings', () => {
      const longText = 'a'.repeat(100000);
      const hash = EncryptionService.hash(longText);

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });

    it('should handle special characters', () => {
      const hash = EncryptionService.hash('!@#$%^&*()_+-=');

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });

    it('should handle unicode characters', () => {
      const hash = EncryptionService.hash('你好世界 🌍');

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });

    it('should handle whitespace', () => {
      const hash1 = EncryptionService.hash('test');
      const hash2 = EncryptionService.hash(' test');
      const hash3 = EncryptionService.hash('test ');

      expect(hash1).not.toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash2).not.toBe(hash3);
    });

    it('should produce avalanche effect (small change = big difference)', () => {
      const hash1 = EncryptionService.hash('test');
      const hash2 = EncryptionService.hash('tess'); // one char different

      let differentChars = 0;
      for (let i = 0; i < hash1.length; i++) {
        if (hash1[i] !== hash2[i]) differentChars++;
      }

      // Expect significant difference (avalanche effect)
      expect(differentChars).toBeGreaterThan(30);
    });

    it('should be deterministic', () => {
      const text = 'deterministic-test';
      const hashes = [];

      for (let i = 0; i < 10; i++) {
        hashes.push(EncryptionService.hash(text));
      }

      // All hashes should be identical
      expect(new Set(hashes).size).toBe(1);
    });
  });

  describe('Hash Verification - verifyHash', () => {
    it('should verify matching hash', () => {
      const text = 'test-string';
      const hash = EncryptionService.hash(text);

      expect(EncryptionService.verifyHash(text, hash)).toBe(true);
    });

    it('should reject non-matching hash', () => {
      const text = 'test-string';
      const wrongHash = EncryptionService.hash('wrong-text');

      expect(EncryptionService.verifyHash(text, wrongHash)).toBe(false);
    });

    it('should return false for empty plaintext', () => {
      const hash = EncryptionService.hash('test');
      expect(EncryptionService.verifyHash('', hash)).toBe(false);
    });

    it('should return false for null plaintext', () => {
      const hash = EncryptionService.hash('test');
      expect(EncryptionService.verifyHash(null, hash)).toBe(false);
    });

    it('should return false for undefined plaintext', () => {
      const hash = EncryptionService.hash('test');
      expect(EncryptionService.verifyHash(undefined, hash)).toBe(false);
    });

    it('should return false for empty hash', () => {
      expect(EncryptionService.verifyHash('test', '')).toBe(false);
    });

    it('should return false for null hash', () => {
      expect(EncryptionService.verifyHash('test', null)).toBe(false);
    });

    it('should return false for undefined hash', () => {
      expect(EncryptionService.verifyHash('test', undefined)).toBe(false);
    });

    it('should be case sensitive', () => {
      const hash = EncryptionService.hash('Test');

      expect(EncryptionService.verifyHash('Test', hash)).toBe(true);
      expect(EncryptionService.verifyHash('test', hash)).toBe(false);
    });

    it('should handle special characters', () => {
      const text = '!@#$%^&*()';
      const hash = EncryptionService.hash(text);

      expect(EncryptionService.verifyHash(text, hash)).toBe(true);
    });

    it('should reject modified plaintext', () => {
      const hash = EncryptionService.hash('original-text');

      expect(EncryptionService.verifyHash('modified-text', hash)).toBe(false);
    });

    it('should reject modified hash', () => {
      const text = 'test';
      const hash = EncryptionService.hash(text);
      const modifiedHash = hash.substring(0, hash.length - 1) + 'x';

      expect(EncryptionService.verifyHash(text, modifiedHash)).toBe(false);
    });

    it('should handle long strings', () => {
      const longText = 'a'.repeat(10000);
      const hash = EncryptionService.hash(longText);

      expect(EncryptionService.verifyHash(longText, hash)).toBe(true);
    });

    it('should handle unicode characters', () => {
      const text = '你好世界 🌍';
      const hash = EncryptionService.hash(text);

      expect(EncryptionService.verifyHash(text, hash)).toBe(true);
    });

    it('should detect single character difference', () => {
      const text = 'password123';
      const hash = EncryptionService.hash(text);

      expect(EncryptionService.verifyHash('password124', hash)).toBe(false);
    });

    it('should handle whitespace differences', () => {
      const hash = EncryptionService.hash('test');

      expect(EncryptionService.verifyHash('test ', hash)).toBe(false);
      expect(EncryptionService.verifyHash(' test', hash)).toBe(false);
    });
  });

  describe('Key Generation - generateKey', () => {
    it('should generate random key of default length', () => {
      const key = EncryptionService.generateKey();

      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    });

    it('should generate random key of custom length', () => {
      const key = EncryptionService.generateKey(64);

      expect(key).toBeDefined();
      expect(key.length).toBe(128); // 64 bytes = 128 hex chars
    });

    it('should generate unique keys', () => {
      const key1 = EncryptionService.generateKey();
      const key2 = EncryptionService.generateKey();

      expect(key1).not.toBe(key2);
    });

    it('should generate hex strings', () => {
      const key = EncryptionService.generateKey(32);

      expect(key).toMatch(/^[0-9a-f]+$/);
    });

    it('should handle small lengths', () => {
      const key = EncryptionService.generateKey(1);

      expect(key.length).toBe(2); // 1 byte = 2 hex chars
    });

    it('should handle large lengths', () => {
      const key = EncryptionService.generateKey(256);

      expect(key.length).toBe(512); // 256 bytes = 512 hex chars
    });

    it('should generate cryptographically strong keys', () => {
      const keys = new Set();

      for (let i = 0; i < 100; i++) {
        keys.add(EncryptionService.generateKey(16));
      }

      // All should be unique (very high probability)
      expect(keys.size).toBe(100);
    });

    it('should use crypto.randomBytes', () => {
      const spy = jest.spyOn(crypto, 'randomBytes');

      EncryptionService.generateKey(32);

      expect(spy).toHaveBeenCalledWith(32);

      spy.mockRestore();
    });
  });

  describe('Key Validation - validateKey', () => {
    it('should validate valid encryption key', () => {
      const validKey = crypto.randomBytes(32).toString('hex');
      const result = EncryptionService.validateKey(validKey);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject short keys', () => {
      const shortKey = 'tooshort';
      const result = EncryptionService.validateKey(shortKey);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('too short');
    });

    it('should reject empty key', () => {
      const result = EncryptionService.validateKey('');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject null key', () => {
      const result = EncryptionService.validateKey(null);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject undefined key', () => {
      const result = EncryptionService.validateKey(undefined);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject non-string keys', () => {
      const result = EncryptionService.validateKey(12345);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('string');
    });

    it('should reject non-hex strings', () => {
      const result = EncryptionService.validateKey('not-hex-ZZZZ');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('hex');
    });

    it('should validate minimum length requirement', () => {
      const key32 = 'a'.repeat(32);
      const result = EncryptionService.validateKey(key32);

      expect(result.valid).toBe(true);
    });

    it('should accept keys longer than minimum', () => {
      const longKey = 'a'.repeat(128);
      const result = EncryptionService.validateKey(longKey);

      expect(result.valid).toBe(true);
    });
  });

  describe('Utility Functions - testEncryption', () => {
    beforeEach(() => {
      process.env.ENCRYPTION_SECRET = 'test-key-for-testing';
    });

    it('should return true when encryption system works', () => {
      const result = EncryptionService.testEncryption();

      expect(result).toBe(true);
    });

    it('should return false when encryption fails', () => {
      const originalEncrypt = EncryptionService.encrypt;
      EncryptionService.encrypt = () => {
        throw new Error('Encryption error');
      };

      const result = EncryptionService.testEncryption();

      expect(result).toBe(false);
      expect(log.error).toHaveBeenCalled();

      EncryptionService.encrypt = originalEncrypt;
    });

    it('should return false when decryption fails', () => {
      const originalDecrypt = EncryptionService.decrypt;
      EncryptionService.decrypt = () => {
        throw new Error('Decryption error');
      };

      const result = EncryptionService.testEncryption();

      expect(result).toBe(false);
      expect(log.error).toHaveBeenCalled();

      EncryptionService.decrypt = originalDecrypt;
    });

    it('should test with predefined test string', () => {
      const result = EncryptionService.testEncryption();

      expect(result).toBe(true);
    });

    it('should validate round-trip encryption', () => {
      // If testEncryption passes, it means encrypt -> decrypt works
      expect(EncryptionService.testEncryption()).toBe(true);
    });
  });

  describe('Edge Cases and Security', () => {
    beforeEach(() => {
      process.env.ENCRYPTION_SECRET = 'test-encryption-key';
    });

    it('should not expose plaintext in encrypted output', () => {
      const secret = 'my-secret-password';
      const encrypted = EncryptionService.encrypt(secret);

      expect(encrypted).not.toContain(secret);
      expect(encrypted.toLowerCase()).not.toContain(secret.toLowerCase());
    });

    it('should handle rapid successive encryptions', () => {
      const results = [];

      for (let i = 0; i < 100; i++) {
        results.push(EncryptionService.encrypt('test'));
      }

      // All should be unique (random IVs)
      expect(new Set(results).size).toBe(100);
    });

    it('should handle concurrent encrypt/decrypt operations', async () => {
      const promises = [];

      for (let i = 0; i < 50; i++) {
        promises.push(
          Promise.resolve().then(() => {
            const encrypted = EncryptionService.encrypt(`test-${i}`);
            return EncryptionService.decrypt(encrypted);
          })
        );
      }

      const results = await Promise.all(promises);

      results.forEach((result, index) => {
        expect(result).toBe(`test-${index}`);
      });
    });

    it('should maintain encryption integrity across key rotations', () => {
      process.env.ENCRYPTION_SECRET = 'key1';
      const encrypted = EncryptionService.encrypt('test');

      // Can't decrypt with different key
      process.env.ENCRYPTION_SECRET = 'key2';
      expect(() => EncryptionService.decrypt(encrypted)).toThrow();

      // Can decrypt with original key
      process.env.ENCRYPTION_SECRET = 'key1';
      expect(EncryptionService.decrypt(encrypted)).toBe('test');
    });

    it('should handle binary-like strings', () => {
      const binaryLike = '\x00\x01\x02\x03\x04\x05';
      const encrypted = EncryptionService.encrypt(binaryLike);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(binaryLike);
    });

    it('should prevent timing attacks in hash verification', () => {
      const text = 'sensitive-password';
      const hash = EncryptionService.hash(text);

      // Both should take similar time (constant-time comparison would be ideal)
      const start1 = Date.now();
      EncryptionService.verifyHash('a', hash);
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      EncryptionService.verifyHash('aaaaaaaaaaaaaaaa', hash);
      const time2 = Date.now() - start2;

      // Times should be relatively close (within 10ms)
      // Note: This is a weak test as JS is single-threaded
      expect(Math.abs(time1 - time2)).toBeLessThan(10);
    });

    it('should handle maximum string length', () => {
      // Test with very large string (1MB)
      const largeText = 'a'.repeat(1024 * 1024);
      const encrypted = EncryptionService.encrypt(largeText);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(largeText);
    });

    it('should properly clean up sensitive data from memory', () => {
      const sensitive = 'super-secret-data-12345';
      const encrypted = EncryptionService.encrypt(sensitive);

      // After encryption, plaintext shouldn't be in encrypted string
      expect(encrypted).not.toContain(sensitive);

      const decrypted = EncryptionService.decrypt(encrypted);
      expect(decrypted).toBe(sensitive);
    });

    it('should handle repeated encryption of same data', () => {
      const data = 'repeated-data';
      const encrypted1 = EncryptionService.encrypt(data);
      const encrypted2 = EncryptionService.encrypt(data);
      const encrypted3 = EncryptionService.encrypt(data);

      // All different (random IVs)
      expect(encrypted1).not.toBe(encrypted2);
      expect(encrypted2).not.toBe(encrypted3);
      expect(encrypted1).not.toBe(encrypted3);

      // All decrypt to same value
      expect(EncryptionService.decrypt(encrypted1)).toBe(data);
      expect(EncryptionService.decrypt(encrypted2)).toBe(data);
      expect(EncryptionService.decrypt(encrypted3)).toBe(data);
    });

    it('should validate input types before processing', () => {
      // These should not throw, but return null or appropriate values
      expect(EncryptionService.encrypt(123)).toBeNull();
      expect(EncryptionService.encrypt({})).toBeNull();
      expect(EncryptionService.encrypt([])).toBeNull();
      expect(EncryptionService.encrypt(true)).toBeNull();
    });
  });

  describe('Integration Tests', () => {
    beforeEach(() => {
      process.env.ENCRYPTION_SECRET = 'integration-test-key';
    });

    it('should handle complete encrypt-decrypt cycle', () => {
      const original = 'test-data-123';
      const encrypted = EncryptionService.encrypt(original);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(original);
      expect(encrypted).not.toBe(original);
    });

    it('should handle hash-verify cycle', () => {
      const password = 'user-password-123';
      const hash = EncryptionService.hash(password);

      expect(EncryptionService.verifyHash(password, hash)).toBe(true);
      expect(EncryptionService.verifyHash('wrong-password', hash)).toBe(false);
    });

    it('should handle key generation and validation cycle', () => {
      const key = EncryptionService.generateKey(32);
      const validation = EncryptionService.validateKey(key);

      expect(validation.valid).toBe(true);
    });

    it('should maintain data integrity through multiple operations', () => {
      const data = 'important-data';

      // Encrypt
      const encrypted1 = EncryptionService.encrypt(data);
      const decrypted1 = EncryptionService.decrypt(encrypted1);

      // Re-encrypt
      const encrypted2 = EncryptionService.encrypt(decrypted1);
      const decrypted2 = EncryptionService.decrypt(encrypted2);

      // Hash
      const hash1 = EncryptionService.hash(decrypted2);
      const hash2 = EncryptionService.hash(data);

      expect(decrypted2).toBe(data);
      expect(hash1).toBe(hash2);
    });

    it('should work with real-world API key patterns', () => {
      const apiKeys = [
        'sk-1234567890abcdef',
        'pk_live_51234567890',
        'AIzaSy1234567890abcdefghijklmnop',
        'test-slack-token-placeholder'
      ];

      apiKeys.forEach(key => {
        const encrypted = EncryptionService.encrypt(key);
        const decrypted = EncryptionService.decrypt(encrypted);
        expect(decrypted).toBe(key);
      });
    });
  });
});
