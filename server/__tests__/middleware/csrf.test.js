/**
 * CSRF Middleware Tests
 * Tests for CSRF protection middleware
 */

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const {
  csrfTokenMiddleware,
  csrfValidationMiddleware,
  csrfTokenEndpoint,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME
} = require('../../middleware/csrf');

describe('CSRF Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      cookies: {},
      headers: {},
      method: 'GET',
      path: '/test',
      ip: '127.0.0.1'
    };
    mockRes = {
      cookie: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: {}
    };
    mockNext = jest.fn();
  });

  describe('Constants', () => {
    it('should have correct cookie name', () => {
      expect(CSRF_COOKIE_NAME).toBe('csrf_token');
    });

    it('should have correct header name', () => {
      expect(CSRF_HEADER_NAME).toBe('x-csrf-token');
    });
  });

  describe('csrfTokenMiddleware', () => {
    it('should generate token if not exists', () => {
      csrfTokenMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'csrf_token',
        expect.any(String),
        expect.any(Object)
      );
      expect(mockReq.csrfToken).toBeDefined();
      expect(mockRes.locals.csrfToken).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reuse existing token from cookie', () => {
      mockReq.cookies.csrf_token = 'existing-token';

      csrfTokenMiddleware(mockReq, mockRes, mockNext);

      expect(mockReq.csrfToken).toBe('existing-token');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should set cookie with correct options', () => {
      csrfTokenMiddleware(mockReq, mockRes, mockNext);

      const cookieOptions = mockRes.cookie.mock.calls[0][2];
      expect(cookieOptions.httpOnly).toBe(false);
      expect(cookieOptions.sameSite).toBe('lax');
      expect(cookieOptions.path).toBe('/');
    });
  });

  describe('csrfValidationMiddleware', () => {
    describe('Safe methods', () => {
      it('should skip validation for GET', () => {
        mockReq.method = 'GET';

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      it('should skip validation for HEAD', () => {
        mockReq.method = 'HEAD';

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should skip validation for OPTIONS', () => {
        mockReq.method = 'OPTIONS';

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('Exempt routes', () => {
      it('should skip validation for auth/login', () => {
        mockReq.method = 'POST';
        mockReq.path = '/auth/login';

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should skip validation for auth/register', () => {
        mockReq.method = 'POST';
        mockReq.path = '/auth/register';

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should skip validation for webhooks', () => {
        mockReq.method = 'POST';
        mockReq.path = '/webhooks/stripe';

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should skip validation for widget', () => {
        mockReq.method = 'POST';
        mockReq.path = '/widget/chat';

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('Protected routes', () => {
      beforeEach(() => {
        mockReq.method = 'POST';
        mockReq.path = '/api/bots';
      });

      it('should reject request without cookie token', () => {
        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: 'CSRF_TOKEN_MISSING'
          })
        );
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should reject request without header token', () => {
        mockReq.cookies.csrf_token = 'cookie-token';

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: 'CSRF_TOKEN_MISSING'
          })
        );
      });

      it('should reject request with mismatched tokens', () => {
        const token = 'a'.repeat(64);
        const differentToken = 'b'.repeat(64);
        mockReq.cookies.csrf_token = token;
        mockReq.headers['x-csrf-token'] = differentToken;

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: 'CSRF_TOKEN_INVALID'
          })
        );
      });

      it('should accept request with matching tokens', () => {
        const token = 'a'.repeat(64);
        mockReq.cookies.csrf_token = token;
        mockReq.headers['x-csrf-token'] = token;

        csrfValidationMiddleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });
    });

    describe('All protected methods', () => {
      const token = 'c'.repeat(64);

      beforeEach(() => {
        mockReq.path = '/api/protected';
        mockReq.cookies.csrf_token = token;
        mockReq.headers['x-csrf-token'] = token;
      });

      it('should validate POST requests', () => {
        mockReq.method = 'POST';
        csrfValidationMiddleware(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalled();
      });

      it('should validate PUT requests', () => {
        mockReq.method = 'PUT';
        csrfValidationMiddleware(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalled();
      });

      it('should validate DELETE requests', () => {
        mockReq.method = 'DELETE';
        csrfValidationMiddleware(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalled();
      });

      it('should validate PATCH requests', () => {
        mockReq.method = 'PATCH';
        csrfValidationMiddleware(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalled();
      });
    });
  });

  describe('csrfTokenEndpoint', () => {
    it('should return CSRF token', () => {
      mockReq.csrfToken = 'existing-token';

      csrfTokenEndpoint(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        csrfToken: 'existing-token'
      });
    });

    it('should generate new token if not available', () => {
      csrfTokenEndpoint(mockReq, mockRes);

      expect(mockRes.cookie).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          csrfToken: expect.any(String)
        })
      );
    });

    it('should set cookie with token', () => {
      mockReq.csrfToken = 'token123';

      csrfTokenEndpoint(mockReq, mockRes);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'csrf_token',
        'token123',
        expect.any(Object)
      );
    });
  });
});
