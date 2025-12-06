const crypto = require('crypto');
const log = require('./../../utils/logger');

/**
 * Encryption Helper
 * Handles encryption and decryption of sensitive data (API keys)
 * Uses AES-256-GCM for encryption
 */
class EncryptionHelper {
  /**
   * Get encryption key from environment
   * @returns {Buffer} Encryption key
   */
  static getEncryptionKey() {
    const key = process.env.AI_ENCRYPTION_SECRET || process.env.JWT_SECRET || 'default-encryption-key-change-in-production';

    // Create a 32-byte key from the secret
    return crypto.createHash('sha256').update(key).digest();
  }

  /**
   * Encrypt a string
   * @param {string} plaintext - Text to encrypt
   * @returns {string} Encrypted text in format: iv:authTag:ciphertext
   */
  static encrypt(plaintext) {
    if (!plaintext) {
      return null;
    }

    try {
      const key = this.getEncryptionKey();

      // Generate a random initialization vector
      const iv = crypto.randomBytes(16);

      // Create cipher
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

      // Encrypt the plaintext
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      // Return iv:authTag:encrypted (all in hex)
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      log.error('Encryption error:', { error: error.message });
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt a string
   * @param {string} encryptedText - Encrypted text in format: iv:authTag:ciphertext
   * @returns {string} Decrypted plaintext
   */
  static decrypt(encryptedText) {
    if (!encryptedText) {
      return null;
    }

    try {
      const key = this.getEncryptionKey();

      // Split the encrypted text
      const parts = encryptedText.split(':');

      if (parts.length !== 3) {
        throw new Error('Invalid encrypted text format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      // Create decipher
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);

      // Set authentication tag
      decipher.setAuthTag(authTag);

      // Decrypt the ciphertext
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      log.error('Decryption error:', { error: error.message });
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Hash a string (one-way, cannot be decrypted)
   * Useful for comparing values without storing the original
   * @param {string} text - Text to hash
   * @returns {string} Hashed text
   */
  static hash(text) {
    if (!text) {
      return null;
    }

    return crypto.createHash('sha256').update(text).digest('hex');
  }

  /**
   * Verify if plaintext matches a hash
   * @param {string} plaintext - Plaintext to verify
   * @param {string} hash - Hash to compare against
   * @returns {boolean} True if matches
   */
  static verifyHash(plaintext, hash) {
    if (!plaintext || !hash) {
      return false;
    }

    const computedHash = this.hash(plaintext);
    return computedHash === hash;
  }

  /**
   * Mask API key for display (show only first/last 4 chars)
   * @param {string} apiKey - API key to mask
   * @returns {string} Masked API key
   */
  static maskApiKey(apiKey) {
    if (!apiKey) {
      return '';
    }

    if (apiKey.length <= 8) {
      return '****';
    }

    const start = apiKey.substring(0, 4);
    const end = apiKey.substring(apiKey.length - 4);
    const masked = '*'.repeat(Math.min(apiKey.length - 8, 20));

    return `${start}${masked}${end}`;
  }

  /**
   * Test encryption/decryption
   * @returns {boolean} True if encryption is working
   */
  static testEncryption() {
    try {
      const testString = 'test-api-key-12345';
      const encrypted = this.encrypt(testString);
      const decrypted = this.decrypt(encrypted);

      return decrypted === testString;
    } catch (error) {
      log.error('Encryption test failed:', { error: error.message });
      return false;
    }
  }

  /**
   * Generate a random API key (for testing)
   * @param {number} length - Length of the key
   * @returns {string} Random key
   */
  static generateRandomKey(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Validate API key format
   * @param {string} apiKey - API key to validate
   * @param {string} provider - Provider name ('openai' or 'claude')
   * @returns {Object} { valid: boolean, error: string }
   */
  static validateApiKeyFormat(apiKey, provider) {
    if (!apiKey) {
      return { valid: false, error: 'API key is required' };
    }

    if (typeof apiKey !== 'string') {
      return { valid: false, error: 'API key must be a string' };
    }

    // Provider-specific validation
    switch(provider.toLowerCase()) {
      case 'openai':
        // OpenAI keys start with 'sk-' and are typically 48+ characters
        if (!apiKey.startsWith('sk-')) {
          return { valid: false, error: 'OpenAI API key must start with "sk-"' };
        }
        if (apiKey.length < 20) {
          return { valid: false, error: 'OpenAI API key is too short' };
        }
        break;

      case 'claude':
        // Anthropic keys start with 'sk-ant-' and are typically 100+ characters
        if (!apiKey.startsWith('sk-ant-')) {
          return { valid: false, error: 'Anthropic API key must start with "sk-ant-"' };
        }
        if (apiKey.length < 50) {
          return { valid: false, error: 'Anthropic API key is too short' };
        }
        break;

      default:
        // Generic validation
        if (apiKey.length < 10) {
          return { valid: false, error: 'API key is too short' };
        }
    }

    return { valid: true };
  }
}

module.exports = EncryptionHelper;
