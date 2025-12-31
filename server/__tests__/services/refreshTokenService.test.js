/**
 * Refresh Token Service Tests
 * Tests for server/services/refreshTokenService.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-access-token'),
  verify: jest.fn()
}));

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid')
}));

jest.mock('../../utils/envValidator', () => ({
  getSecureEnv: jest.fn().mockReturnValue('test-jwt-secret')
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../db');
const jwt = require('jsonwebtoken');
const {
  generateAccessToken,
  createRefreshToken,
  rotateRefreshToken,
  revokeTokenFamily,
  revokeAllUserTokens,
  revokeRefreshToken,
  cleanupExpiredTokens,
  getUserSessions,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY_DAYS
} = require('../../services/refreshTokenService');

describe('Refresh Token Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Constants', () => {
    it('should export correct token expiry values', () => {
      expect(ACCESS_TOKEN_EXPIRY).toBe('15m');
      expect(REFRESH_TOKEN_EXPIRY_DAYS).toBe(7);
    });
  });

  describe('generateAccessToken', () => {
    it('should generate access token with user data', () => {
      const user = {
        id: 1,
        email: 'test@test.com',
        name: 'Test User',
        organizationId: 10
      };

      const result = generateAccessToken(user);

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          id: 1,
          email: 'test@test.com',
          username: 'Test User',
          current_organization_id: 10
        },
        'test-jwt-secret',
        { expiresIn: '15m' }
      );
      expect(result).toBe('mock-access-token');
    });

    it('should use username if name is not provided', () => {
      const user = {
        id: 1,
        email: 'test@test.com',
        username: 'testuser'
      };

      generateAccessToken(user);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'testuser' }),
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should use current_organization_id if organizationId not provided', () => {
      const user = {
        id: 1,
        email: 'test@test.com',
        current_organization_id: 20
      };

      generateAccessToken(user);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ current_organization_id: 20 }),
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('createRefreshToken', () => {
    it('should create refresh token and store in database', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await createRefreshToken(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO refresh_tokens'),
        expect.arrayContaining([1, expect.any(String), 'mock-uuid'])
      );
      expect(result.token).toBeDefined();
      expect(result.familyId).toBe('mock-uuid');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should use existing familyId if provided', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await createRefreshToken(1, null, 'existing-family-id');

      expect(result.familyId).toBe('existing-family-id');
      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['existing-family-id'])
      );
    });

    it('should capture IP and user agent from request', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const mockReq = {
        ip: '192.168.1.1',
        headers: {
          'user-agent': 'Mozilla/5.0 Test Browser'
        }
      };

      await createRefreshToken(1, mockReq);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['192.168.1.1', 'Mozilla/5.0 Test Browser'])
      );
    });

    it('should handle missing request object', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await createRefreshToken(1, null);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([null, null])
      );
    });

    it('should truncate long user agent', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const longUserAgent = 'A'.repeat(1000);
      const mockReq = {
        headers: {
          'user-agent': longUserAgent
        }
      };

      await createRefreshToken(1, mockReq);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([expect.stringMatching(/^A{500}$/)])
      );
    });
  });

  describe('rotateRefreshToken', () => {
    it('should return null if token not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await rotateRefreshToken('invalid-token');

      expect(result).toBeNull();
    });

    it('should revoke token family on reuse detection', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          user_id: 1,
          family_id: 'family-123',
          is_revoked: true,
          expires_at: new Date(Date.now() + 86400000)
        }]
      });

      const result = await rotateRefreshToken('reused-token');

      expect(result).toBeNull();
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE refresh_tokens SET is_revoked = true WHERE family_id'),
        ['family-123']
      );
    });

    it('should return null for expired token', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          user_id: 1,
          family_id: 'family-123',
          is_revoked: false,
          expires_at: new Date(Date.now() - 86400000) // Expired
        }]
      });

      const result = await rotateRefreshToken('expired-token');

      expect(result).toBeNull();
    });

    it('should rotate valid token and return new tokens', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            user_id: 1,
            email: 'test@test.com',
            name: 'Test User',
            family_id: 'family-123',
            is_revoked: false,
            is_superadmin: false,
            expires_at: new Date(Date.now() + 86400000)
          }]
        })
        .mockResolvedValueOnce({ rows: [] }) // Revoke current token
        .mockResolvedValueOnce({ rows: [{ org_id: 10 }] }) // Get organization
        .mockResolvedValueOnce({ rows: [] }); // Create new token

      const result = await rotateRefreshToken('valid-token');

      expect(result).not.toBeNull();
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.expiresIn).toBe(900);
      expect(result.user.id).toBe(1);
      expect(result.user.currentOrganizationId).toBe(10);
    });

    it('should handle user without organization', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            user_id: 1,
            email: 'test@test.com',
            name: 'Test User',
            family_id: 'family-123',
            is_revoked: false,
            is_superadmin: true,
            expires_at: new Date(Date.now() + 86400000)
          }]
        })
        .mockResolvedValueOnce({ rows: [] }) // Revoke current token
        .mockResolvedValueOnce({ rows: [] }) // No organization
        .mockResolvedValueOnce({ rows: [] }); // Create new token

      const result = await rotateRefreshToken('valid-token');

      expect(result.user.currentOrganizationId).toBeNull();
      expect(result.user.is_superadmin).toBe(true);
    });
  });

  describe('revokeTokenFamily', () => {
    it('should revoke all tokens in family', async () => {
      db.query.mockResolvedValue({ rowCount: 5 });

      await revokeTokenFamily('family-123');

      expect(db.query).toHaveBeenCalledWith(
        'UPDATE refresh_tokens SET is_revoked = true WHERE family_id = $1',
        ['family-123']
      );
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all user tokens and return count', async () => {
      db.query.mockResolvedValue({ rowCount: 3 });

      const result = await revokeAllUserTokens(1);

      expect(result).toBe(3);
      expect(db.query).toHaveBeenCalledWith(
        'UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1 AND is_revoked = false',
        [1]
      );
    });

    it('should return 0 if no tokens to revoke', async () => {
      db.query.mockResolvedValue({ rowCount: 0 });

      const result = await revokeAllUserTokens(999);

      expect(result).toBe(0);
    });
  });

  describe('revokeRefreshToken', () => {
    it('should revoke specific token', async () => {
      db.query.mockResolvedValue({ rowCount: 1 });

      const result = await revokeRefreshToken('token-to-revoke');

      expect(result).toBe(true);
      expect(db.query).toHaveBeenCalledWith(
        'UPDATE refresh_tokens SET is_revoked = true WHERE token_hash = $1',
        [expect.any(String)]
      );
    });

    it('should return false if token not found', async () => {
      db.query.mockResolvedValue({ rowCount: 0 });

      const result = await revokeRefreshToken('nonexistent-token');

      expect(result).toBe(false);
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should delete expired and revoked tokens', async () => {
      db.query.mockResolvedValue({ rowCount: 10 });

      const result = await cleanupExpiredTokens();

      expect(result).toBe(10);
      expect(db.query).toHaveBeenCalledWith(
        'DELETE FROM refresh_tokens WHERE expires_at < NOW() OR is_revoked = true'
      );
    });
  });

  describe('getUserSessions', () => {
    it('should return active sessions for user', async () => {
      const sessions = [
        { id: 1, created_at: new Date(), expires_at: new Date(), ip_address: '192.168.1.1', user_agent: 'Chrome' },
        { id: 2, created_at: new Date(), expires_at: new Date(), ip_address: '192.168.1.2', user_agent: 'Firefox' }
      ];
      db.query.mockResolvedValue({ rows: sessions });

      const result = await getUserSessions(1);

      expect(result).toEqual(sessions);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, created_at, expires_at, ip_address, user_agent'),
        [1]
      );
    });

    it('should return empty array if no sessions', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await getUserSessions(999);

      expect(result).toEqual([]);
    });
  });
});
