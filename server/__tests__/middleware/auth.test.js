/**
 * Auth Middleware Tests
 * Tests for server/middleware/auth.js
 */

jest.mock('jsonwebtoken');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const jwt = require('jsonwebtoken');
const authenticateToken = require('../../middleware/auth');

describe('Auth Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      headers: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
    process.env.JWT_SECRET = 'test-secret';
  });

  it('should return 401 if no token provided', () => {
    authenticateToken(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: expect.stringContaining('No token')
    }));
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 if Authorization header without token', () => {
    mockReq.headers.authorization = 'Bearer ';

    authenticateToken(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  it('should return 403 for invalid token', () => {
    mockReq.headers.authorization = 'Bearer invalid-token';
    jwt.verify.mockImplementation((token, secret, callback) => {
      callback(new Error('Invalid token'), null);
    });

    authenticateToken(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: expect.stringContaining('Invalid or expired')
    }));
  });

  it('should attach user to req and call next for valid token', () => {
    mockReq.headers.authorization = 'Bearer valid-token';
    const decodedUser = {
      id: 1,
      email: 'test@example.com',
      username: 'testuser',
      current_organization_id: 1
    };
    jwt.verify.mockImplementation((token, secret, callback) => {
      callback(null, decodedUser);
    });

    authenticateToken(mockReq, mockRes, mockNext);

    expect(mockReq.user).toBeDefined();
    expect(mockReq.user.id).toBe(1);
    expect(mockReq.user.email).toBe('test@example.com');
    expect(mockReq.user.organization_id).toBe(1);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle jwt.verify throwing error', () => {
    mockReq.headers.authorization = 'Bearer token';
    jwt.verify.mockImplementation(() => {
      throw new Error('Unexpected error');
    });

    authenticateToken(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: 'Authentication error'
    }));
  });
});
