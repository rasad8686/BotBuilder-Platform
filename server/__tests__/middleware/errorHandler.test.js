/**
 * ErrorHandler Middleware Tests
 * Tests for server/middleware/errorHandler.js
 */

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

const { APIError, ERROR_CODES, errorHandler, notFoundHandler, asyncHandler } = require('../../middleware/errorHandler');

describe('ErrorHandler Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      path: '/api/test',
      method: 'GET',
      ip: '127.0.0.1',
      headers: { 'user-agent': 'test-agent' },
      user: { id: 1, organization_id: 1 }
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('APIError', () => {
    it('should create error with default values', () => {
      const error = new APIError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.isOperational).toBe(true);
    });

    it('should create error with custom values', () => {
      const error = new APIError('Not found', 404, 'NOT_FOUND');

      expect(error.message).toBe('Not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should capture stack trace', () => {
      const error = new APIError('Test');

      expect(error.stack).toBeDefined();
    });
  });

  describe('ERROR_CODES', () => {
    it('should have standard error codes', () => {
      expect(ERROR_CODES.VALIDATION_ERROR).toBeDefined();
      expect(ERROR_CODES.UNAUTHORIZED).toBeDefined();
      expect(ERROR_CODES.FORBIDDEN).toBeDefined();
      expect(ERROR_CODES.NOT_FOUND).toBeDefined();
      expect(ERROR_CODES.CONFLICT).toBeDefined();
      expect(ERROR_CODES.RATE_LIMITED).toBeDefined();
      expect(ERROR_CODES.INTERNAL_ERROR).toBeDefined();
    });

    it('should have correct status codes', () => {
      expect(ERROR_CODES.VALIDATION_ERROR.status).toBe(400);
      expect(ERROR_CODES.UNAUTHORIZED.status).toBe(401);
      expect(ERROR_CODES.FORBIDDEN.status).toBe(403);
      expect(ERROR_CODES.NOT_FOUND.status).toBe(404);
    });
  });

  describe('errorHandler()', () => {
    it('should handle generic errors', () => {
      const error = new Error('Something went wrong');

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INTERNAL_ERROR'
          })
        })
      );
    });

    it('should handle APIError with custom status', () => {
      const error = new APIError('Not found', 404, 'NOT_FOUND');

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should handle ValidationError', () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should handle JsonWebTokenError', () => {
      const error = new Error('Invalid token');
      error.name = 'JsonWebTokenError';

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should handle TokenExpiredError', () => {
      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should handle PostgreSQL unique violation', () => {
      const error = new Error('Unique violation');
      error.code = '23505';

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(409);
    });

    it('should handle PostgreSQL foreign key violation', () => {
      const error = new Error('Foreign key violation');
      error.code = '23503';

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should include request ID if available', () => {
      mockReq.id = 'req_12345';
      const error = new Error('Test');

      errorHandler(error, mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.error.requestId).toBe('req_12345');
    });

    it('should include details in development', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Test error');

      errorHandler(error, mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.error.details).toBeDefined();
      expect(response.error.path).toBeDefined();
    });

    it('should hide details in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Sensitive error info');

      errorHandler(error, mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.error.details).toBeUndefined();
      expect(response.error.message).not.toBe('Sensitive error info');
    });
  });

  describe('notFoundHandler()', () => {
    it('should return 404 response', () => {
      notFoundHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'NOT_FOUND',
            message: 'Route not found',
            path: '/api/test'
          })
        })
      );
    });
  });

  describe('asyncHandler()', () => {
    it('should pass resolved value to next handler', async () => {
      const handler = jest.fn().mockResolvedValue('success');
      const wrappedHandler = asyncHandler(handler);

      await wrappedHandler(mockReq, mockRes, mockNext);

      expect(handler).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
    });

    it('should catch rejected promises and pass to next', async () => {
      const error = new Error('Async error');
      const handler = jest.fn().mockRejectedValue(error);
      const wrappedHandler = asyncHandler(handler);

      await wrappedHandler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should work with synchronous functions', async () => {
      const handler = jest.fn().mockReturnValue('sync');
      const wrappedHandler = asyncHandler(handler);

      await wrappedHandler(mockReq, mockRes, mockNext);

      expect(handler).toHaveBeenCalled();
    });
  });
});
