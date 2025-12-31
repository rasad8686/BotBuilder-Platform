/**
 * Password Validator Tests
 * Tests for password validation utility
 */

const { validatePassword } = require('../../utils/passwordValidator');

describe('passwordValidator', () => {
  describe('validatePassword', () => {
    it('should return valid for a strong password', () => {
      const result = validatePassword('Password123');

      expect(result.valid).toBe(true);
    });

    it('should reject password shorter than 8 characters', () => {
      const result = validatePassword('Pass1');

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Password must be at least 8 characters');
    });

    it('should reject password without uppercase letter', () => {
      const result = validatePassword('password123');

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Password must contain uppercase letter');
    });

    it('should reject password without lowercase letter', () => {
      const result = validatePassword('PASSWORD123');

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Password must contain lowercase letter');
    });

    it('should reject password without number', () => {
      const result = validatePassword('PasswordABC');

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Password must contain a number');
    });

    it('should accept password with special characters', () => {
      const result = validatePassword('Password123!@#');

      expect(result.valid).toBe(true);
    });

    it('should accept password that is exactly 8 characters', () => {
      const result = validatePassword('Passwo1d');

      expect(result.valid).toBe(true);
    });

    it('should accept very long passwords', () => {
      const result = validatePassword('ThisIsAVeryLongPassword123WithManyCharacters');

      expect(result.valid).toBe(true);
    });

    it('should reject password with only spaces', () => {
      const result = validatePassword('        ');

      expect(result.valid).toBe(false);
    });

    it('should accept password with spaces in middle', () => {
      const result = validatePassword('Pass word 123');

      expect(result.valid).toBe(true);
    });
  });
});
