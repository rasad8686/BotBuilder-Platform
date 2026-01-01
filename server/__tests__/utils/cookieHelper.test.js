/**
 * Cookie Helper Tests
 * Comprehensive tests for JWT cookie management utilities
 */

const {
  JWT_COOKIE_NAME,
  setAuthCookie,
  clearAuthCookie,
  getAuthToken
} = require('../../utils/cookieHelper');

describe('cookieHelper', () => {
  let mockRes;
  let originalEnv;

  beforeAll(() => {
    originalEnv = process.env.NODE_ENV;
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
  });

  beforeEach(() => {
    mockRes = {
      cookie: jest.fn()
    };
    delete process.env.NODE_ENV;
  });

  describe('JWT_COOKIE_NAME', () => {
    it('should be defined', () => {
      expect(JWT_COOKIE_NAME).toBe('auth_token');
    });

    it('should be a string', () => {
      expect(typeof JWT_COOKIE_NAME).toBe('string');
    });

    it('should not be empty', () => {
      expect(JWT_COOKIE_NAME.length).toBeGreaterThan(0);
    });
  });

  describe('setAuthCookie', () => {
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

    it('should handle test environment', () => {
      process.env.NODE_ENV = 'test';
      setAuthCookie(mockRes, 'test-token');

      const options = mockRes.cookie.mock.calls[0][2];
      expect(options.secure).toBe(false);
      expect(options.sameSite).toBe('lax');
    });

    it('should handle staging environment', () => {
      process.env.NODE_ENV = 'staging';
      setAuthCookie(mockRes, 'test-token');

      const options = mockRes.cookie.mock.calls[0][2];
      expect(options.secure).toBe(false);
      expect(options.sameSite).toBe('lax');
    });

    it('should handle undefined NODE_ENV', () => {
      delete process.env.NODE_ENV;
      setAuthCookie(mockRes, 'test-token');

      const options = mockRes.cookie.mock.calls[0][2];
      expect(options.secure).toBe(false);
      expect(options.sameSite).toBe('lax');
    });

    it('should handle empty token', () => {
      setAuthCookie(mockRes, '');

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'auth_token',
        '',
        expect.any(Object)
      );
    });

    it('should handle very long token', () => {
      const longToken = 'a'.repeat(1000);
      setAuthCookie(mockRes, longToken);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'auth_token',
        longToken,
        expect.any(Object)
      );
    });

    it('should handle tokens with special characters', () => {
      const specialToken = 'token.with-special_chars123!@#';
      setAuthCookie(mockRes, specialToken);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'auth_token',
        specialToken,
        expect.any(Object)
      );
    });

    it('should set all required cookie options', () => {
      setAuthCookie(mockRes, 'test-token');

      const options = mockRes.cookie.mock.calls[0][2];
      expect(options).toHaveProperty('httpOnly');
      expect(options).toHaveProperty('secure');
      expect(options).toHaveProperty('sameSite');
      expect(options).toHaveProperty('maxAge');
      expect(options).toHaveProperty('path');
    });

    it('should be called exactly once per invocation', () => {
      setAuthCookie(mockRes, 'test-token');

      expect(mockRes.cookie).toHaveBeenCalledTimes(1);
    });

    it('should handle null token gracefully', () => {
      setAuthCookie(mockRes, null);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'auth_token',
        null,
        expect.any(Object)
      );
    });
  });

  describe('clearAuthCookie', () => {
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

    it('should maintain security settings in production', () => {
      process.env.NODE_ENV = 'production';
      clearAuthCookie(mockRes);

      const options = mockRes.cookie.mock.calls[0][2];
      expect(options.httpOnly).toBe(true);
      expect(options.secure).toBe(true);
      expect(options.sameSite).toBe('strict');
    });

    it('should maintain security settings in development', () => {
      process.env.NODE_ENV = 'development';
      clearAuthCookie(mockRes);

      const options = mockRes.cookie.mock.calls[0][2];
      expect(options.httpOnly).toBe(true);
      expect(options.secure).toBe(false);
      expect(options.sameSite).toBe('lax');
    });

    it('should set path to root', () => {
      clearAuthCookie(mockRes);

      const options = mockRes.cookie.mock.calls[0][2];
      expect(options.path).toBe('/');
    });

    it('should be idempotent', () => {
      clearAuthCookie(mockRes);
      clearAuthCookie(mockRes);

      expect(mockRes.cookie).toHaveBeenCalledTimes(2);
      expect(mockRes.cookie.mock.calls[0]).toEqual(mockRes.cookie.mock.calls[1]);
    });

    it('should handle test environment', () => {
      process.env.NODE_ENV = 'test';
      clearAuthCookie(mockRes);

      const options = mockRes.cookie.mock.calls[0][2];
      expect(options.httpOnly).toBe(true);
      expect(options.maxAge).toBe(0);
    });

    it('should be called exactly once per invocation', () => {
      clearAuthCookie(mockRes);

      expect(mockRes.cookie).toHaveBeenCalledTimes(1);
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

    it('should return null if cookies is undefined', () => {
      const mockReq = {
        cookies: undefined
      };

      const token = getAuthToken(mockReq);

      expect(token).toBeNull();
    });

    it('should return null if auth_token is undefined', () => {
      const mockReq = {
        cookies: {
          other_cookie: 'value'
        }
      };

      const token = getAuthToken(mockReq);

      expect(token).toBeNull();
    });

    it('should return empty string if token is empty', () => {
      const mockReq = {
        cookies: {
          auth_token: ''
        }
      };

      const token = getAuthToken(mockReq);

      expect(token).toBe('');
    });

    it('should handle long tokens', () => {
      const longToken = 'a'.repeat(1000);
      const mockReq = {
        cookies: {
          auth_token: longToken
        }
      };

      const token = getAuthToken(mockReq);

      expect(token).toBe(longToken);
    });

    it('should handle tokens with special characters', () => {
      const specialToken = 'token.with-special_chars123';
      const mockReq = {
        cookies: {
          auth_token: specialToken
        }
      };

      const token = getAuthToken(mockReq);

      expect(token).toBe(specialToken);
    });

    it('should ignore other cookies', () => {
      const mockReq = {
        cookies: {
          auth_token: 'correct-token',
          other_cookie: 'other-value',
          session: 'session-value'
        }
      };

      const token = getAuthToken(mockReq);

      expect(token).toBe('correct-token');
    });

    it('should handle null cookie value', () => {
      const mockReq = {
        cookies: {
          auth_token: null
        }
      };

      const token = getAuthToken(mockReq);

      expect(token).toBeNull();
    });

    it('should not modify the request object', () => {
      const mockReq = {
        cookies: {
          auth_token: 'test-token'
        }
      };

      getAuthToken(mockReq);

      expect(mockReq.cookies.auth_token).toBe('test-token');
    });
  });

  describe('Integration scenarios', () => {
    it('should set and retrieve token in same flow', () => {
      const token = 'test-jwt-token-12345';
      setAuthCookie(mockRes, token);

      const mockReq = {
        cookies: {
          auth_token: token
        }
      };

      const retrievedToken = getAuthToken(mockReq);
      expect(retrievedToken).toBe(token);
    });

    it('should clear token after setting', () => {
      setAuthCookie(mockRes, 'test-token');
      expect(mockRes.cookie).toHaveBeenCalledWith('auth_token', 'test-token', expect.any(Object));

      clearAuthCookie(mockRes);
      const lastCall = mockRes.cookie.mock.calls[1];
      expect(lastCall[1]).toBe('');
      expect(lastCall[2].maxAge).toBe(0);
    });

    it('should handle multiple set operations', () => {
      setAuthCookie(mockRes, 'token1');
      setAuthCookie(mockRes, 'token2');
      setAuthCookie(mockRes, 'token3');

      expect(mockRes.cookie).toHaveBeenCalledTimes(3);
      expect(mockRes.cookie.mock.calls[2][1]).toBe('token3');
    });
  });

  describe('Security considerations', () => {
    it('should always set httpOnly flag', () => {
      const environments = ['development', 'test', 'staging', 'production'];

      environments.forEach(env => {
        process.env.NODE_ENV = env;
        mockRes.cookie.mockClear();

        setAuthCookie(mockRes, 'token');
        const options = mockRes.cookie.mock.calls[0][2];
        expect(options.httpOnly).toBe(true);
      });
    });

    it('should use strict sameSite only in production', () => {
      process.env.NODE_ENV = 'production';
      setAuthCookie(mockRes, 'token');
      expect(mockRes.cookie.mock.calls[0][2].sameSite).toBe('strict');

      mockRes.cookie.mockClear();
      process.env.NODE_ENV = 'development';
      setAuthCookie(mockRes, 'token');
      expect(mockRes.cookie.mock.calls[0][2].sameSite).toBe('lax');
    });

    it('should use secure flag only in production', () => {
      process.env.NODE_ENV = 'production';
      setAuthCookie(mockRes, 'token');
      expect(mockRes.cookie.mock.calls[0][2].secure).toBe(true);

      mockRes.cookie.mockClear();
      process.env.NODE_ENV = 'development';
      setAuthCookie(mockRes, 'token');
      expect(mockRes.cookie.mock.calls[0][2].secure).toBe(false);
    });

    it('should maintain security settings when clearing in production', () => {
      process.env.NODE_ENV = 'production';
      clearAuthCookie(mockRes);

      const options = mockRes.cookie.mock.calls[0][2];
      expect(options.httpOnly).toBe(true);
      expect(options.secure).toBe(true);
      expect(options.sameSite).toBe('strict');
    });
  });
});
