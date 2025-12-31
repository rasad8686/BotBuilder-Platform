/**
 * Cookie Helper Tests
 * Tests for JWT cookie management utilities
 */

const {
  JWT_COOKIE_NAME,
  setAuthCookie,
  clearAuthCookie,
  getAuthToken
} = require('../../utils/cookieHelper');

describe('cookieHelper', () => {
  let mockRes;

  beforeEach(() => {
    mockRes = {
      cookie: jest.fn()
    };
  });

  describe('JWT_COOKIE_NAME', () => {
    it('should be defined', () => {
      expect(JWT_COOKIE_NAME).toBe('auth_token');
    });
  });

  describe('setAuthCookie', () => {
    beforeEach(() => {
      delete process.env.NODE_ENV;
    });

    it('should set cookie with correct name and token', () => {
      setAuthCookie(mockRes, 'test-jwt-token');

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'auth_token',
        'test-jwt-token',
        expect.any(Object)
      );
    });

    it('should set httpOnly to true', () => {
      setAuthCookie(mockRes, 'test-token');

      const options = mockRes.cookie.mock.calls[0][2];
      expect(options.httpOnly).toBe(true);
    });

    it('should set secure to false in non-production', () => {
      process.env.NODE_ENV = 'development';
      setAuthCookie(mockRes, 'test-token');

      const options = mockRes.cookie.mock.calls[0][2];
      expect(options.secure).toBe(false);
    });

    it('should set secure to true in production', () => {
      process.env.NODE_ENV = 'production';
      setAuthCookie(mockRes, 'test-token');

      const options = mockRes.cookie.mock.calls[0][2];
      expect(options.secure).toBe(true);
    });

    it('should set sameSite to lax in non-production', () => {
      process.env.NODE_ENV = 'development';
      setAuthCookie(mockRes, 'test-token');

      const options = mockRes.cookie.mock.calls[0][2];
      expect(options.sameSite).toBe('lax');
    });

    it('should set sameSite to strict in production', () => {
      process.env.NODE_ENV = 'production';
      setAuthCookie(mockRes, 'test-token');

      const options = mockRes.cookie.mock.calls[0][2];
      expect(options.sameSite).toBe('strict');
    });

    it('should set maxAge to 24 hours', () => {
      setAuthCookie(mockRes, 'test-token');

      const options = mockRes.cookie.mock.calls[0][2];
      expect(options.maxAge).toBe(24 * 60 * 60 * 1000);
    });

    it('should set path to root', () => {
      setAuthCookie(mockRes, 'test-token');

      const options = mockRes.cookie.mock.calls[0][2];
      expect(options.path).toBe('/');
    });
  });

  describe('clearAuthCookie', () => {
    beforeEach(() => {
      delete process.env.NODE_ENV;
    });

    it('should set empty cookie value', () => {
      clearAuthCookie(mockRes);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'auth_token',
        '',
        expect.any(Object)
      );
    });

    it('should set maxAge to 0', () => {
      clearAuthCookie(mockRes);

      const options = mockRes.cookie.mock.calls[0][2];
      expect(options.maxAge).toBe(0);
    });

    it('should maintain security settings', () => {
      process.env.NODE_ENV = 'production';
      clearAuthCookie(mockRes);

      const options = mockRes.cookie.mock.calls[0][2];
      expect(options.httpOnly).toBe(true);
      expect(options.secure).toBe(true);
      expect(options.sameSite).toBe('strict');
    });
  });

  describe('getAuthToken', () => {
    it('should return token from cookies', () => {
      const mockReq = {
        cookies: {
          auth_token: 'test-jwt-token'
        }
      };

      const token = getAuthToken(mockReq);

      expect(token).toBe('test-jwt-token');
    });

    it('should return null if no token present', () => {
      const mockReq = {
        cookies: {}
      };

      const token = getAuthToken(mockReq);

      expect(token).toBeNull();
    });

    it('should return null if cookies object is empty', () => {
      const mockReq = {
        cookies: {}
      };

      const token = getAuthToken(mockReq);

      expect(token).toBeNull();
    });
  });
});
