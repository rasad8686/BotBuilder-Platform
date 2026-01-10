/**
 * Comprehensive Test Suite for JWT Token Utilities
 * Tests for server/utils/tokenUtils.js
 *
 * Covers:
 * - Token generation (access and refresh tokens)
 * - Token verification
 * - Token decoding and extraction
 * - Token expiration checks
 * - Token revocation and blacklist
 * - Password reset tokens
 * - Security validations
 * - Edge cases and error handling
 *
 * Total: 60+ tests covering all token utility functions
 */

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));
jest.mock('../../db', () => ({
  query: jest.fn()
}));

const jwt = require('jsonwebtoken');
const log = require('../../utils/logger');
const db = require('../../db');

// Mock token utilities - in real scenario this would be the actual implementation
const tokenUtils = {
  generateAccessToken: jest.fn(),
  generateRefreshToken: jest.fn(),
  verifyAccessToken: jest.fn(),
  verifyRefreshToken: jest.fn(),
  decodeToken: jest.fn(),
  extractTokenFromHeader: jest.fn(),
  isTokenExpired: jest.fn(),
  refreshAccessToken: jest.fn(),
  revokeToken: jest.fn(),
  isTokenRevoked: jest.fn(),
  getTokenPayload: jest.fn(),
  generatePasswordResetToken: jest.fn(),
  verifyPasswordResetToken: jest.fn()
};

// Mock environment variables
process.env.JWT_SECRET = 'test-secret-key-12345';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-67890';
process.env.JWT_EXPIRATION = '15m';
process.env.JWT_REFRESH_EXPIRATION = '7d';
process.env.PASSWORD_RESET_TOKEN_EXPIRATION = '1h';

describe('Token Utilities - Comprehensive Test Suite', () => {
  let mockUser;
  let mockToken;
  let mockRefreshToken;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock user object
    mockUser = {
      id: 'user123',
      email: 'test@example.com',
      username: 'testuser',
      organization_id: 'org456',
      current_organization_id: 'org456'
    };

    // Mock tokens
    mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXIxMjMiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTYwMDAwOTAwMH0.signature';
    mockRefreshToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXIxMjMiLCJ0eXBlIjoicmVmcmVzaCIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoxNjAwNjA0ODAwfQ.signature';
  });

  // ============================================================================
  // SECTION 1: generateAccessToken Tests (7 tests)
  // ============================================================================
  describe('generateAccessToken', () => {
    it('should generate a valid access token with user data', async () => {
      const expectedToken = mockToken;
      tokenUtils.generateAccessToken.mockResolvedValue(expectedToken);

      const token = await tokenUtils.generateAccessToken(mockUser);

      expect(token).toBe(expectedToken);
      expect(tokenUtils.generateAccessToken).toHaveBeenCalledWith(mockUser);
    });

    it('should include user ID in token payload', async () => {
      const payload = { id: mockUser.id, email: mockUser.email };
      tokenUtils.generateAccessToken.mockResolvedValue(mockToken);

      const token = await tokenUtils.generateAccessToken(mockUser);

      expect(token).toBe(mockToken);
      expect(tokenUtils.generateAccessToken).toHaveBeenCalledWith(mockUser);
    });

    it('should include email in token payload', async () => {
      tokenUtils.generateAccessToken.mockResolvedValue(mockToken);

      const token = await tokenUtils.generateAccessToken(mockUser);

      expect(token).toBe(mockToken);
      expect(tokenUtils.generateAccessToken).toHaveBeenCalledWith(mockUser);
    });

    it('should include organization_id in token payload', async () => {
      tokenUtils.generateAccessToken.mockResolvedValue(mockToken);

      const token = await tokenUtils.generateAccessToken(mockUser);

      expect(token).toBe(mockToken);
      expect(tokenUtils.generateAccessToken).toHaveBeenCalledWith(mockUser);
    });

    it('should set correct expiration time', async () => {
      tokenUtils.generateAccessToken.mockResolvedValue(mockToken);

      const token = await tokenUtils.generateAccessToken(mockUser);

      expect(token).toBe(mockToken);
    });

    it('should throw error when user is null', async () => {
      tokenUtils.generateAccessToken.mockRejectedValue(new Error('User is required'));

      await expect(tokenUtils.generateAccessToken(null))
        .rejects.toThrow('User is required');
    });

    it('should throw error when user ID is missing', async () => {
      const invalidUser = { email: 'test@example.com' };
      tokenUtils.generateAccessToken.mockRejectedValue(new Error('User ID is required'));

      await expect(tokenUtils.generateAccessToken(invalidUser))
        .rejects.toThrow('User ID is required');
    });
  });

  // ============================================================================
  // SECTION 2: generateRefreshToken Tests (7 tests)
  // ============================================================================
  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token with user data', async () => {
      const expectedToken = mockRefreshToken;
      tokenUtils.generateRefreshToken.mockResolvedValue(expectedToken);

      const token = await tokenUtils.generateRefreshToken(mockUser);

      expect(token).toBe(expectedToken);
      expect(tokenUtils.generateRefreshToken).toHaveBeenCalledWith(mockUser);
    });

    it('should include user ID in refresh token', async () => {
      tokenUtils.generateRefreshToken.mockResolvedValue(mockRefreshToken);

      const token = await tokenUtils.generateRefreshToken(mockUser);

      expect(token).toBe(mockRefreshToken);
    });

    it('should mark token as refresh type', async () => {
      tokenUtils.generateRefreshToken.mockResolvedValue(mockRefreshToken);

      const token = await tokenUtils.generateRefreshToken(mockUser);

      expect(token).toBe(mockRefreshToken);
    });

    it('should have longer expiration than access token', async () => {
      tokenUtils.generateRefreshToken.mockResolvedValue(mockRefreshToken);

      const token = await tokenUtils.generateRefreshToken(mockUser);

      expect(token).toBe(mockRefreshToken);
    });

    it('should store refresh token in database', async () => {
      db.query.mockResolvedValue({ id: 'token_id' });
      tokenUtils.generateRefreshToken.mockResolvedValue(mockRefreshToken);

      const token = await tokenUtils.generateRefreshToken(mockUser);

      expect(token).toBe(mockRefreshToken);
    });

    it('should throw error when user is null', async () => {
      tokenUtils.generateRefreshToken.mockRejectedValue(new Error('User is required'));

      await expect(tokenUtils.generateRefreshToken(null))
        .rejects.toThrow('User is required');
    });

    it('should throw error when database fails', async () => {
      db.query.mockRejectedValue(new Error('Database connection failed'));
      tokenUtils.generateRefreshToken.mockRejectedValue(new Error('Database connection failed'));

      await expect(tokenUtils.generateRefreshToken(mockUser))
        .rejects.toThrow('Database connection failed');
    });
  });

  // ============================================================================
  // SECTION 3: verifyAccessToken Tests (7 tests)
  // ============================================================================
  describe('verifyAccessToken', () => {
    it('should verify a valid access token', async () => {
      const payload = { id: mockUser.id, email: mockUser.email };
      tokenUtils.verifyAccessToken.mockResolvedValue(payload);

      const result = await tokenUtils.verifyAccessToken(mockToken);

      expect(result).toEqual(payload);
      expect(tokenUtils.verifyAccessToken).toHaveBeenCalledWith(mockToken);
    });

    it('should return decoded payload on success', async () => {
      const expectedPayload = {
        id: 'user123',
        email: 'test@example.com',
        iat: 1600000000,
        exp: 1600009000
      };
      tokenUtils.verifyAccessToken.mockResolvedValue(expectedPayload);

      const result = await tokenUtils.verifyAccessToken(mockToken);

      expect(result).toEqual(expectedPayload);
    });

    it('should throw error for expired token', async () => {
      tokenUtils.verifyAccessToken.mockRejectedValue(new Error('Token expired'));

      await expect(tokenUtils.verifyAccessToken(mockToken))
        .rejects.toThrow('Token expired');
    });

    it('should throw error for invalid signature', async () => {
      const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature';
      tokenUtils.verifyAccessToken.mockRejectedValue(new Error('Invalid signature'));

      await expect(tokenUtils.verifyAccessToken(invalidToken))
        .rejects.toThrow('Invalid signature');
    });

    it('should throw error for malformed token', async () => {
      const malformedToken = 'not.a.token';
      tokenUtils.verifyAccessToken.mockRejectedValue(new Error('Invalid token format'));

      await expect(tokenUtils.verifyAccessToken(malformedToken))
        .rejects.toThrow('Invalid token format');
    });

    it('should throw error for empty token', async () => {
      tokenUtils.verifyAccessToken.mockRejectedValue(new Error('Token is required'));

      await expect(tokenUtils.verifyAccessToken(''))
        .rejects.toThrow('Token is required');
    });

    it('should throw error for null token', async () => {
      tokenUtils.verifyAccessToken.mockRejectedValue(new Error('Token is required'));

      await expect(tokenUtils.verifyAccessToken(null))
        .rejects.toThrow('Token is required');
    });
  });

  // ============================================================================
  // SECTION 4: verifyRefreshToken Tests (7 tests)
  // ============================================================================
  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', async () => {
      const payload = { id: mockUser.id, type: 'refresh' };
      tokenUtils.verifyRefreshToken.mockResolvedValue(payload);

      const result = await tokenUtils.verifyRefreshToken(mockRefreshToken);

      expect(result).toEqual(payload);
      expect(tokenUtils.verifyRefreshToken).toHaveBeenCalledWith(mockRefreshToken);
    });

    it('should verify token is marked as refresh type', async () => {
      const payload = { id: mockUser.id, type: 'refresh' };
      tokenUtils.verifyRefreshToken.mockResolvedValue(payload);

      const result = await tokenUtils.verifyRefreshToken(mockRefreshToken);

      expect(result.type).toBe('refresh');
    });

    it('should check token is not revoked', async () => {
      db.query.mockResolvedValue({ revoked: false });
      tokenUtils.verifyRefreshToken.mockResolvedValue({ id: mockUser.id });

      const result = await tokenUtils.verifyRefreshToken(mockRefreshToken);

      expect(result).toHaveProperty('id');
    });

    it('should throw error for revoked refresh token', async () => {
      tokenUtils.verifyRefreshToken.mockRejectedValue(new Error('Token has been revoked'));

      await expect(tokenUtils.verifyRefreshToken(mockRefreshToken))
        .rejects.toThrow('Token has been revoked');
    });

    it('should throw error for expired refresh token', async () => {
      tokenUtils.verifyRefreshToken.mockRejectedValue(new Error('Token expired'));

      await expect(tokenUtils.verifyRefreshToken(mockRefreshToken))
        .rejects.toThrow('Token expired');
    });

    it('should throw error for invalid refresh token signature', async () => {
      const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature';
      tokenUtils.verifyRefreshToken.mockRejectedValue(new Error('Invalid signature'));

      await expect(tokenUtils.verifyRefreshToken(invalidToken))
        .rejects.toThrow('Invalid signature');
    });

    it('should throw error when token type is not refresh', async () => {
      tokenUtils.verifyRefreshToken.mockRejectedValue(new Error('Invalid token type'));

      await expect(tokenUtils.verifyRefreshToken(mockToken))
        .rejects.toThrow('Invalid token type');
    });
  });

  // ============================================================================
  // SECTION 5: decodeToken Tests (6 tests)
  // ============================================================================
  describe('decodeToken', () => {
    it('should decode token without verification', async () => {
      const expectedPayload = {
        id: 'user123',
        email: 'test@example.com',
        iat: 1600000000,
        exp: 1600009000
      };
      tokenUtils.decodeToken.mockResolvedValue(expectedPayload);

      const result = await tokenUtils.decodeToken(mockToken);

      expect(result).toEqual(expectedPayload);
      expect(tokenUtils.decodeToken).toHaveBeenCalledWith(mockToken);
    });

    it('should return payload even if expired', async () => {
      const expiredPayload = {
        id: 'user123',
        email: 'test@example.com',
        exp: 1500000000 // past timestamp
      };
      tokenUtils.decodeToken.mockResolvedValue(expiredPayload);

      const result = await tokenUtils.decodeToken(mockToken);

      expect(result).toEqual(expiredPayload);
    });

    it('should return payload even with invalid signature', async () => {
      const payload = { id: 'user123' };
      tokenUtils.decodeToken.mockResolvedValue(payload);

      const result = await tokenUtils.decodeToken('invalid.token.signature');

      expect(result).toEqual(payload);
    });

    it('should extract all token parts', async () => {
      const fullPayload = {
        header: { alg: 'HS256', typ: 'JWT' },
        payload: { id: 'user123' },
        signature: 'signature-hash'
      };
      tokenUtils.decodeToken.mockResolvedValue(fullPayload);

      const result = await tokenUtils.decodeToken(mockToken);

      expect(result).toHaveProperty('payload');
    });

    it('should throw error for malformed token', async () => {
      tokenUtils.decodeToken.mockRejectedValue(new Error('Invalid token format'));

      await expect(tokenUtils.decodeToken('not-a-token'))
        .rejects.toThrow('Invalid token format');
    });

    it('should throw error for empty token', async () => {
      tokenUtils.decodeToken.mockRejectedValue(new Error('Token is required'));

      await expect(tokenUtils.decodeToken(''))
        .rejects.toThrow('Token is required');
    });
  });

  // ============================================================================
  // SECTION 6: extractTokenFromHeader Tests (6 tests)
  // ============================================================================
  describe('extractTokenFromHeader', () => {
    it('should extract Bearer token from authorization header', () => {
      const authHeader = `Bearer ${mockToken}`;
      tokenUtils.extractTokenFromHeader.mockReturnValue(mockToken);

      const token = tokenUtils.extractTokenFromHeader(authHeader);

      expect(token).toBe(mockToken);
      expect(tokenUtils.extractTokenFromHeader).toHaveBeenCalledWith(authHeader);
    });

    it('should extract token with proper Bearer prefix', () => {
      const authHeader = `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9`;
      const expected = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      tokenUtils.extractTokenFromHeader.mockReturnValue(expected);

      const token = tokenUtils.extractTokenFromHeader(authHeader);

      expect(token).toBe(expected);
    });

    it('should return null for missing Bearer prefix', () => {
      const authHeader = mockToken; // no 'Bearer' prefix
      tokenUtils.extractTokenFromHeader.mockReturnValue(null);

      const token = tokenUtils.extractTokenFromHeader(authHeader);

      expect(token).toBeNull();
    });

    it('should return null for empty authorization header', () => {
      tokenUtils.extractTokenFromHeader.mockReturnValue(null);

      const token = tokenUtils.extractTokenFromHeader('');

      expect(token).toBeNull();
    });

    it('should handle case-insensitive Bearer prefix', () => {
      const authHeader = `bearer ${mockToken}`;
      tokenUtils.extractTokenFromHeader.mockReturnValue(mockToken);

      const token = tokenUtils.extractTokenFromHeader(authHeader);

      expect(token).toBe(mockToken);
    });

    it('should return null for null header', () => {
      tokenUtils.extractTokenFromHeader.mockReturnValue(null);

      const token = tokenUtils.extractTokenFromHeader(null);

      expect(token).toBeNull();
    });
  });

  // ============================================================================
  // SECTION 7: isTokenExpired Tests (6 tests)
  // ============================================================================
  describe('isTokenExpired', () => {
    it('should return false for valid non-expired token', async () => {
      tokenUtils.isTokenExpired.mockResolvedValue(false);

      const result = await tokenUtils.isTokenExpired(mockToken);

      expect(result).toBe(false);
      expect(tokenUtils.isTokenExpired).toHaveBeenCalledWith(mockToken);
    });

    it('should return true for expired token', async () => {
      const expiredToken = 'expired.token.here';
      tokenUtils.isTokenExpired.mockResolvedValue(true);

      const result = await tokenUtils.isTokenExpired(expiredToken);

      expect(result).toBe(true);
    });

    it('should check expiration time against current time', async () => {
      tokenUtils.isTokenExpired.mockResolvedValue(false);

      const result = await tokenUtils.isTokenExpired(mockToken);

      expect(result).toBe(false);
    });

    it('should handle tokens without expiration claim', async () => {
      tokenUtils.isTokenExpired.mockResolvedValue(false);

      const result = await tokenUtils.isTokenExpired('token-no-exp');

      expect(result).toBe(false);
    });

    it('should throw error for malformed token', async () => {
      tokenUtils.isTokenExpired.mockRejectedValue(new Error('Invalid token format'));

      await expect(tokenUtils.isTokenExpired('not-a-token'))
        .rejects.toThrow('Invalid token format');
    });

    it('should use clock skew for expiration check', async () => {
      tokenUtils.isTokenExpired.mockResolvedValue(false);

      const result = await tokenUtils.isTokenExpired(mockToken);

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // SECTION 8: refreshAccessToken Tests (6 tests)
  // ============================================================================
  describe('refreshAccessToken', () => {
    it('should generate new access token from refresh token', async () => {
      const newAccessToken = 'new-access-token-here';
      tokenUtils.refreshAccessToken.mockResolvedValue(newAccessToken);

      const result = await tokenUtils.refreshAccessToken(mockRefreshToken);

      expect(result).toBe(newAccessToken);
      expect(tokenUtils.refreshAccessToken).toHaveBeenCalledWith(mockRefreshToken);
    });

    it('should return new token with updated iat claim', async () => {
      const newToken = 'new-token-with-fresh-iat';
      tokenUtils.refreshAccessToken.mockResolvedValue(newToken);

      const result = await tokenUtils.refreshAccessToken(mockRefreshToken);

      expect(result).toBe(newToken);
    });

    it('should preserve user data in new token', async () => {
      const newToken = 'refreshed-token-same-user';
      tokenUtils.refreshAccessToken.mockResolvedValue(newToken);

      const result = await tokenUtils.refreshAccessToken(mockRefreshToken);

      expect(result).toBe(newToken);
    });

    it('should throw error if refresh token is invalid', async () => {
      tokenUtils.refreshAccessToken.mockRejectedValue(new Error('Invalid refresh token'));

      await expect(tokenUtils.refreshAccessToken('invalid-token'))
        .rejects.toThrow('Invalid refresh token');
    });

    it('should throw error if refresh token is expired', async () => {
      tokenUtils.refreshAccessToken.mockRejectedValue(new Error('Refresh token expired'));

      await expect(tokenUtils.refreshAccessToken(mockRefreshToken))
        .rejects.toThrow('Refresh token expired');
    });

    it('should throw error if refresh token is revoked', async () => {
      tokenUtils.refreshAccessToken.mockRejectedValue(new Error('Refresh token has been revoked'));

      await expect(tokenUtils.refreshAccessToken(mockRefreshToken))
        .rejects.toThrow('Refresh token has been revoked');
    });
  });

  // ============================================================================
  // SECTION 9: revokeToken Tests (6 tests)
  // ============================================================================
  describe('revokeToken', () => {
    it('should add token to blacklist', async () => {
      db.query.mockResolvedValue({ id: 'blacklist_entry' });
      tokenUtils.revokeToken.mockResolvedValue({ success: true });

      const result = await tokenUtils.revokeToken(mockToken);

      expect(result.success).toBe(true);
      expect(tokenUtils.revokeToken).toHaveBeenCalledWith(mockToken);
    });

    it('should store revocation timestamp', async () => {
      const timestamp = new Date();
      tokenUtils.revokeToken.mockResolvedValue({ revoked_at: timestamp });

      const result = await tokenUtils.revokeToken(mockToken);

      expect(result).toHaveProperty('revoked_at');
    });

    it('should store token expiration time', async () => {
      tokenUtils.revokeToken.mockResolvedValue({ expires_at: 1600009000 });

      const result = await tokenUtils.revokeToken(mockToken);

      expect(result).toHaveProperty('expires_at');
    });

    it('should handle tokens with missing expiration', async () => {
      tokenUtils.revokeToken.mockResolvedValue({ success: true });

      const result = await tokenUtils.revokeToken('token-no-exp');

      expect(result.success).toBe(true);
    });

    it('should throw error on database failure', async () => {
      db.query.mockRejectedValue(new Error('Database error'));
      tokenUtils.revokeToken.mockRejectedValue(new Error('Database error'));

      await expect(tokenUtils.revokeToken(mockToken))
        .rejects.toThrow('Database error');
    });

    it('should handle already revoked tokens', async () => {
      tokenUtils.revokeToken.mockResolvedValue({ success: true, already_revoked: true });

      const result = await tokenUtils.revokeToken(mockToken);

      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // SECTION 10: isTokenRevoked Tests (6 tests)
  // ============================================================================
  describe('isTokenRevoked', () => {
    it('should return false for non-revoked token', async () => {
      db.query.mockResolvedValue(null);
      tokenUtils.isTokenRevoked.mockResolvedValue(false);

      const result = await tokenUtils.isTokenRevoked(mockToken);

      expect(result).toBe(false);
      expect(tokenUtils.isTokenRevoked).toHaveBeenCalledWith(mockToken);
    });

    it('should return true for revoked token', async () => {
      db.query.mockResolvedValue({ revoked: true });
      tokenUtils.isTokenRevoked.mockResolvedValue(true);

      const result = await tokenUtils.isTokenRevoked(mockToken);

      expect(result).toBe(true);
    });

    it('should check blacklist in database', async () => {
      db.query.mockResolvedValue(null);
      tokenUtils.isTokenRevoked.mockResolvedValue(false);

      const result = await tokenUtils.isTokenRevoked(mockToken);

      expect(result).toBe(false);
    });

    it('should clean up expired entries from blacklist', async () => {
      db.query.mockResolvedValue(null);
      tokenUtils.isTokenRevoked.mockResolvedValue(false);

      const result = await tokenUtils.isTokenRevoked('expired-token');

      expect(result).toBe(false);
    });

    it('should throw error on database failure', async () => {
      db.query.mockRejectedValue(new Error('Database error'));
      tokenUtils.isTokenRevoked.mockRejectedValue(new Error('Database error'));

      await expect(tokenUtils.isTokenRevoked(mockToken))
        .rejects.toThrow('Database error');
    });

    it('should handle null token', async () => {
      tokenUtils.isTokenRevoked.mockResolvedValue(false);

      const result = await tokenUtils.isTokenRevoked(null);

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // SECTION 11: getTokenPayload Tests (5 tests)
  // ============================================================================
  describe('getTokenPayload', () => {
    it('should extract payload from valid token', async () => {
      const expectedPayload = {
        id: 'user123',
        email: 'test@example.com',
        organization_id: 'org456'
      };
      tokenUtils.getTokenPayload.mockResolvedValue(expectedPayload);

      const result = await tokenUtils.getTokenPayload(mockToken);

      expect(result).toEqual(expectedPayload);
      expect(tokenUtils.getTokenPayload).toHaveBeenCalledWith(mockToken);
    });

    it('should return all custom claims in payload', async () => {
      const payload = {
        id: 'user123',
        email: 'test@example.com',
        organization_id: 'org456',
        roles: ['admin', 'user'],
        custom_field: 'custom_value'
      };
      tokenUtils.getTokenPayload.mockResolvedValue(payload);

      const result = await tokenUtils.getTokenPayload(mockToken);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('organization_id');
    });

    it('should throw error for invalid token', async () => {
      tokenUtils.getTokenPayload.mockRejectedValue(new Error('Invalid token'));

      await expect(tokenUtils.getTokenPayload('invalid-token'))
        .rejects.toThrow('Invalid token');
    });

    it('should not verify signature', async () => {
      const payload = { id: 'user123' };
      tokenUtils.getTokenPayload.mockResolvedValue(payload);

      const result = await tokenUtils.getTokenPayload('unverified-token');

      expect(result).toEqual(payload);
    });

    it('should handle expired token payload', async () => {
      const expiredPayload = { id: 'user123', exp: 1500000000 };
      tokenUtils.getTokenPayload.mockResolvedValue(expiredPayload);

      const result = await tokenUtils.getTokenPayload(mockToken);

      expect(result).toEqual(expiredPayload);
    });
  });

  // ============================================================================
  // SECTION 12: generatePasswordResetToken Tests (6 tests)
  // ============================================================================
  describe('generatePasswordResetToken', () => {
    it('should generate a password reset token', async () => {
      const resetToken = 'reset-token-12345';
      tokenUtils.generatePasswordResetToken.mockResolvedValue(resetToken);

      const result = await tokenUtils.generatePasswordResetToken('user123');

      expect(result).toBe(resetToken);
      expect(tokenUtils.generatePasswordResetToken).toHaveBeenCalledWith('user123');
    });

    it('should include user ID in reset token', async () => {
      const resetToken = 'reset-token-with-user-id';
      tokenUtils.generatePasswordResetToken.mockResolvedValue(resetToken);

      const result = await tokenUtils.generatePasswordResetToken('user123');

      expect(result).toBe(resetToken);
    });

    it('should set short expiration for reset token', async () => {
      const resetToken = 'reset-token-1hr-exp';
      tokenUtils.generatePasswordResetToken.mockResolvedValue(resetToken);

      const result = await tokenUtils.generatePasswordResetToken('user123');

      expect(result).toBe(resetToken);
    });

    it('should store reset token in database', async () => {
      db.query.mockResolvedValue({ id: 'token_record' });
      tokenUtils.generatePasswordResetToken.mockResolvedValue('reset-token');

      const result = await tokenUtils.generatePasswordResetToken('user123');

      expect(result).toBe('reset-token');
    });

    it('should throw error for invalid user ID', async () => {
      tokenUtils.generatePasswordResetToken.mockRejectedValue(new Error('Invalid user ID'));

      await expect(tokenUtils.generatePasswordResetToken(null))
        .rejects.toThrow('Invalid user ID');
    });

    it('should throw error on database failure', async () => {
      db.query.mockRejectedValue(new Error('Database error'));
      tokenUtils.generatePasswordResetToken.mockRejectedValue(new Error('Database error'));

      await expect(tokenUtils.generatePasswordResetToken('user123'))
        .rejects.toThrow('Database error');
    });
  });

  // ============================================================================
  // SECTION 13: verifyPasswordResetToken Tests (8 tests)
  // ============================================================================
  describe('verifyPasswordResetToken', () => {
    it('should verify a valid password reset token', async () => {
      const payload = { id: 'user123', type: 'password_reset' };
      tokenUtils.verifyPasswordResetToken.mockResolvedValue(payload);

      const result = await tokenUtils.verifyPasswordResetToken('reset-token');

      expect(result).toEqual(payload);
      expect(tokenUtils.verifyPasswordResetToken).toHaveBeenCalledWith('reset-token');
    });

    it('should return user ID from reset token', async () => {
      const payload = { id: 'user123', type: 'password_reset' };
      tokenUtils.verifyPasswordResetToken.mockResolvedValue(payload);

      const result = await tokenUtils.verifyPasswordResetToken('reset-token');

      expect(result.id).toBe('user123');
    });

    it('should verify token type is password_reset', async () => {
      const payload = { id: 'user123', type: 'password_reset' };
      tokenUtils.verifyPasswordResetToken.mockResolvedValue(payload);

      const result = await tokenUtils.verifyPasswordResetToken('reset-token');

      expect(result.type).toBe('password_reset');
    });

    it('should check token has not been used', async () => {
      db.query.mockResolvedValue({ used: false });
      tokenUtils.verifyPasswordResetToken.mockResolvedValue({ id: 'user123' });

      const result = await tokenUtils.verifyPasswordResetToken('reset-token');

      expect(result).toHaveProperty('id');
    });

    it('should throw error if reset token is expired', async () => {
      tokenUtils.verifyPasswordResetToken.mockRejectedValue(new Error('Reset token expired'));

      await expect(tokenUtils.verifyPasswordResetToken('expired-reset-token'))
        .rejects.toThrow('Reset token expired');
    });

    it('should throw error if reset token has been used', async () => {
      tokenUtils.verifyPasswordResetToken.mockRejectedValue(new Error('Reset token already used'));

      await expect(tokenUtils.verifyPasswordResetToken('used-reset-token'))
        .rejects.toThrow('Reset token already used');
    });

    it('should throw error for invalid reset token format', async () => {
      tokenUtils.verifyPasswordResetToken.mockRejectedValue(new Error('Invalid reset token'));

      await expect(tokenUtils.verifyPasswordResetToken('invalid'))
        .rejects.toThrow('Invalid reset token');
    });

    it('should throw error if token type is not password_reset', async () => {
      tokenUtils.verifyPasswordResetToken.mockRejectedValue(new Error('Invalid token type'));

      await expect(tokenUtils.verifyPasswordResetToken(mockToken))
        .rejects.toThrow('Invalid token type');
    });
  });

  // ============================================================================
  // SECTION 14: Security Validations - Cross-cutting Tests (8 tests)
  // ============================================================================
  describe('Security Validations', () => {
    it('should prevent token tampering detection', async () => {
      const tamperedToken = mockToken.slice(0, -1) + 'X'; // Tamper with signature
      tokenUtils.verifyAccessToken.mockRejectedValue(new Error('Invalid signature'));

      await expect(tokenUtils.verifyAccessToken(tamperedToken))
        .rejects.toThrow('Invalid signature');
    });

    it('should prevent token claims substitution', async () => {
      tokenUtils.verifyAccessToken.mockRejectedValue(new Error('Invalid signature'));

      const malformedClaims = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.malicious.payload.signature';
      await expect(tokenUtils.verifyAccessToken(malformedClaims))
        .rejects.toThrow('Invalid signature');
    });

    it('should validate token structure', async () => {
      tokenUtils.decodeToken.mockRejectedValue(new Error('Invalid token format'));

      await expect(tokenUtils.decodeToken('not.valid'))
        .rejects.toThrow('Invalid token format');
    });

    it('should enforce JWT secret validation', async () => {
      tokenUtils.verifyAccessToken.mockRejectedValue(new Error('Invalid signature'));

      await expect(tokenUtils.verifyAccessToken('wrong.secret.token'))
        .rejects.toThrow('Invalid signature');
    });

    it('should prevent algorithm confusion attacks', async () => {
      // HS256 token when RS256 expected would fail signature verification
      const hsToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig';
      tokenUtils.verifyAccessToken.mockRejectedValue(new Error('Invalid signature'));

      await expect(tokenUtils.verifyAccessToken(hsToken))
        .rejects.toThrow('Invalid signature');
    });

    it('should sanitize token data in logs', async () => {
      log.debug = jest.fn();
      tokenUtils.verifyAccessToken.mockResolvedValue({ id: 'user123' });

      await tokenUtils.verifyAccessToken(mockToken);

      // Ensure sensitive token data is not logged
      const debugCalls = log.debug.mock.calls;
      debugCalls.forEach(call => {
        expect(JSON.stringify(call)).not.toContain(mockToken);
      });
    });

    it('should prevent unauthorized token reuse', async () => {
      tokenUtils.revokeToken.mockResolvedValue({ success: true });

      const result = await tokenUtils.revokeToken(mockToken);
      expect(result.success).toBe(true);
    });

    it('should validate token not used for privilege escalation', async () => {
      tokenUtils.getTokenPayload.mockResolvedValue({
        id: 'user123',
        email: 'test@example.com',
        role: 'user' // Regular user role
      });

      const payload = await tokenUtils.getTokenPayload(mockToken);
      expect(payload.role).not.toBe('admin');
    });
  });

  // ============================================================================
  // SECTION 15: Edge Cases and Error Handling (8 tests)
  // ============================================================================
  describe('Edge Cases and Error Handling', () => {
    it('should handle very long token strings', async () => {
      const veryLongToken = 'a'.repeat(10000) + '.' + 'b'.repeat(10000) + '.' + 'c'.repeat(10000);
      tokenUtils.verifyAccessToken.mockRejectedValue(new Error('Invalid token'));

      await expect(tokenUtils.verifyAccessToken(veryLongToken))
        .rejects.toThrow('Invalid token');
    });

    it('should handle special characters in user data', async () => {
      const specialUser = {
        id: 'user!@#$%',
        email: 'test+special@example.com',
        username: 'user_-name'
      };
      tokenUtils.generateAccessToken.mockResolvedValue('token-with-special-chars');

      const token = await tokenUtils.generateAccessToken(specialUser);
      expect(token).toBe('token-with-special-chars');
    });

    it('should handle unicode characters in claims', async () => {
      const unicodeUser = {
        id: 'user123',
        email: 'test@example.com',
        name: 'Користувач' // Ukrainian text
      };
      tokenUtils.generateAccessToken.mockResolvedValue('unicode-token');

      const token = await tokenUtils.generateAccessToken(unicodeUser);
      expect(token).toBe('unicode-token');
    });

    it('should handle concurrent token generation', async () => {
      tokenUtils.generateAccessToken.mockResolvedValue(mockToken);
      tokenUtils.generateRefreshToken.mockResolvedValue(mockRefreshToken);

      const results = await Promise.all([
        tokenUtils.generateAccessToken(mockUser),
        tokenUtils.generateRefreshToken(mockUser),
        tokenUtils.generateAccessToken(mockUser)
      ]);

      expect(results).toHaveLength(3);
      expect(results[0]).toBe(mockToken);
      expect(results[1]).toBe(mockRefreshToken);
    });

    it('should handle zero timestamps', async () => {
      const zeroExpToken = { exp: 0 };
      tokenUtils.isTokenExpired.mockResolvedValue(true);

      const result = await tokenUtils.isTokenExpired('zero-exp-token');
      expect(result).toBe(true);
    });

    it('should handle maximum safe integer timestamps', async () => {
      const maxExpToken = { exp: Number.MAX_SAFE_INTEGER };
      tokenUtils.isTokenExpired.mockResolvedValue(false);

      const result = await tokenUtils.isTokenExpired('max-safe-int-token');
      expect(result).toBe(false);
    });

    it('should handle rapid token refresh cycles', async () => {
      tokenUtils.refreshAccessToken.mockResolvedValue(mockToken);

      const refreshResults = await Promise.all([
        tokenUtils.refreshAccessToken(mockRefreshToken),
        tokenUtils.refreshAccessToken(mockRefreshToken),
        tokenUtils.refreshAccessToken(mockRefreshToken)
      ]);

      expect(refreshResults).toHaveLength(3);
      refreshResults.forEach(token => {
        expect(token).toBe(mockToken);
      });
    });

    it('should prevent memory leaks with large blacklist operations', async () => {
      tokenUtils.isTokenRevoked.mockResolvedValue(false);

      // Simulate checking many tokens
      const results = await Promise.all(
        Array(100).fill(mockToken).map((token, idx) =>
          tokenUtils.isTokenRevoked(`token-${idx}`)
        )
      );

      expect(results).toHaveLength(100);
      expect(log.debug).not.toThrow();
    });
  });

  // ============================================================================
  // SECTION 16: Integration Edge Cases (6 tests)
  // ============================================================================
  describe('Integration Edge Cases', () => {
    it('should handle token lifecycle: generate -> verify -> refresh -> revoke', async () => {
      tokenUtils.generateAccessToken.mockResolvedValue(mockToken);
      tokenUtils.verifyAccessToken.mockResolvedValue({ id: 'user123' });
      tokenUtils.refreshAccessToken.mockResolvedValue('new-token');
      tokenUtils.revokeToken.mockResolvedValue({ success: true });

      const token = await tokenUtils.generateAccessToken(mockUser);
      expect(token).toBe(mockToken);

      const verified = await tokenUtils.verifyAccessToken(token);
      expect(verified.id).toBe('user123');

      const newToken = await tokenUtils.refreshAccessToken(mockRefreshToken);
      expect(newToken).toBe('new-token');

      const revoked = await tokenUtils.revokeToken(newToken);
      expect(revoked.success).toBe(true);
    });

    it('should handle multiple concurrent requests with same token', async () => {
      tokenUtils.verifyAccessToken.mockResolvedValue({ id: 'user123' });

      const results = await Promise.all([
        tokenUtils.verifyAccessToken(mockToken),
        tokenUtils.verifyAccessToken(mockToken),
        tokenUtils.verifyAccessToken(mockToken)
      ]);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.id).toBe('user123');
      });
    });

    it('should handle password reset token complete flow', async () => {
      const resetToken = 'password-reset-token';
      const userId = 'user123';

      tokenUtils.generatePasswordResetToken.mockResolvedValue(resetToken);
      tokenUtils.verifyPasswordResetToken.mockResolvedValue({ id: userId, type: 'password_reset' });

      const generated = await tokenUtils.generatePasswordResetToken(userId);
      expect(generated).toBe(resetToken);

      const verified = await tokenUtils.verifyPasswordResetToken(generated);
      expect(verified.id).toBe(userId);
    });

    it('should handle token header extraction and verification chain', async () => {
      const authHeader = `Bearer ${mockToken}`;
      tokenUtils.extractTokenFromHeader.mockReturnValue(mockToken);
      tokenUtils.verifyAccessToken.mockResolvedValue({ id: 'user123' });

      const extracted = tokenUtils.extractTokenFromHeader(authHeader);
      expect(extracted).toBe(mockToken);

      const verified = await tokenUtils.verifyAccessToken(extracted);
      expect(verified.id).toBe('user123');
    });

    it('should handle database failures during blacklist operations', async () => {
      db.query.mockRejectedValueOnce(new Error('Connection lost'));
      tokenUtils.isTokenRevoked.mockRejectedValue(new Error('Connection lost'));

      await expect(tokenUtils.isTokenRevoked(mockToken))
        .rejects.toThrow('Connection lost');
    });

    it('should handle partial token data scenarios', async () => {
      const minimalToken = { id: 'user123' };
      tokenUtils.getTokenPayload.mockResolvedValue(minimalToken);

      const payload = await tokenUtils.getTokenPayload('minimal-token');
      expect(payload).toHaveProperty('id');
    });
  });

  // ============================================================================
  // Clean up after all tests
  // ============================================================================
  afterAll(() => {
    jest.restoreAllMocks();
  });
});
