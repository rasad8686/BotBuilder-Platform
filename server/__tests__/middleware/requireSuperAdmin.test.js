/**
 * Superadmin & Admin Authorization Middleware Tests
 * Tests for admin access control middleware
 */

jest.mock('../../db');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../db');
const {
  requireSuperAdmin,
  requireAdmin,
  adminLoginRateLimit,
  adminIpWhitelist,
  requireAdmin2FA,
  isSuperAdmin,
  logAdminAction
} = require('../../middleware/requireSuperAdmin');

describe('Superadmin & Admin Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ADMIN_IP_WHITELIST;

    mockReq = {
      user: { id: 'user-1', email: 'test@example.com' },
      body: {},
      path: '/admin/test',
      method: 'GET',
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
      headers: { 'user-agent': 'test-agent' }
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    mockNext = jest.fn();
  });

  describe('requireSuperAdmin', () => {
    it('should reject unauthenticated request', () => {
      mockReq.user = null;

      requireSuperAdmin(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required'
      });
    });

    it('should reject request without user id', () => {
      mockReq.user = { email: 'test@example.com' };

      requireSuperAdmin(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should reject non-superadmin user', async () => {
      db.query.mockResolvedValue({ rows: [{ is_superadmin: false }] });

      requireSuperAdmin(mockReq, mockRes, mockNext);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Superadmin access required'
      });
    });

    it('should allow superadmin user', async () => {
      db.query.mockResolvedValue({ rows: [{ is_superadmin: true }] });

      requireSuperAdmin(mockReq, mockRes, mockNext);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockReq.isSuperAdmin).toBe(true);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject when user not found in database', async () => {
      db.query.mockResolvedValue({ rows: [] });

      requireSuperAdmin(mockReq, mockRes, mockNext);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      requireSuperAdmin(mockReq, mockRes, mockNext);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authorization check failed'
      });
    });
  });

  describe('requireAdmin', () => {
    it('should reject unauthenticated request', () => {
      mockReq.user = null;

      requireAdmin(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should allow superadmin', async () => {
      db.query.mockResolvedValue({ rows: [{ is_superadmin: true }] });

      requireAdmin(mockReq, mockRes, mockNext);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockReq.isSuperAdmin).toBe(true);
      expect(mockReq.isAdmin).toBe(true);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject non-admin without organization context', async () => {
      db.query.mockResolvedValue({ rows: [{ is_superadmin: false }] });

      requireAdmin(mockReq, mockRes, mockNext);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Organization context required for admin access'
      });
    });

    it('should allow organization admin', async () => {
      db.query.mockResolvedValue({ rows: [{ is_superadmin: false }] });
      mockReq.organization = { role: 'admin', org_id: 'org-1' };

      requireAdmin(mockReq, mockRes, mockNext);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockReq.isAdmin).toBe(true);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow organization owner', async () => {
      db.query.mockResolvedValue({ rows: [{ is_superadmin: false }] });
      mockReq.organization = { role: 'member', is_owner: true, org_id: 'org-1' };

      requireAdmin(mockReq, mockRes, mockNext);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockReq.isAdmin).toBe(true);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject non-admin organization member', async () => {
      db.query.mockResolvedValue({ rows: [{ is_superadmin: false }] });
      mockReq.organization = { role: 'member', is_owner: false, org_id: 'org-1' };

      requireAdmin(mockReq, mockRes, mockNext);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Admin access required'
      });
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      requireAdmin(mockReq, mockRes, mockNext);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('adminLoginRateLimit', () => {
    beforeEach(() => {
      db.query.mockResolvedValue({ rows: [{ count: '0' }] });
    });

    it('should reject request without email', async () => {
      mockReq.body = {};

      await adminLoginRateLimit(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email is required'
      });
    });

    it('should allow request within rate limits', async () => {
      mockReq.body = { email: 'test@example.com' };
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: [{ count: '5' }] });

      await adminLoginRateLimit(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(typeof mockReq.logLoginAttempt).toBe('function');
    });

    it('should reject after too many email attempts', async () => {
      mockReq.body = { email: 'test@example.com' };
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [{ count: '2' }] });

      await adminLoginRateLimit(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('Too many login attempts')
        })
      );
    });

    it('should reject after too many IP attempts', async () => {
      mockReq.body = { email: 'test@example.com' };
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: [{ count: '10' }] });

      await adminLoginRateLimit(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
    });

    it('should allow on database error (fail open)', async () => {
      mockReq.body = { email: 'test@example.com' };
      db.query.mockRejectedValue(new Error('DB error'));

      await adminLoginRateLimit(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('logLoginAttempt should log attempts', async () => {
      mockReq.body = { email: 'test@example.com' };
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await adminLoginRateLimit(mockReq, mockRes, mockNext);

      expect(mockReq.logLoginAttempt).toBeDefined();

      db.query.mockResolvedValue({ rows: [] });
      await mockReq.logLoginAttempt(true);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO admin_login_attempts'),
        expect.any(Array)
      );
    });
  });

  describe('adminIpWhitelist', () => {
    it('should skip if no whitelist configured', async () => {
      await adminIpWhitelist(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow whitelisted IP from env', async () => {
      process.env.ADMIN_IP_WHITELIST = '127.0.0.1,10.0.0.1';
      mockReq.ip = '127.0.0.1';
      db.query.mockResolvedValue({ rows: [] });

      await adminIpWhitelist(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow whitelisted IP from database', async () => {
      process.env.ADMIN_IP_WHITELIST = '10.0.0.1';
      mockReq.ip = '192.168.1.1';
      db.query.mockResolvedValue({ rows: [{ ip_address: '192.168.1.1' }] });

      await adminIpWhitelist(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject non-whitelisted IP', async () => {
      process.env.ADMIN_IP_WHITELIST = '10.0.0.1';
      mockReq.ip = '192.168.1.100';
      db.query.mockResolvedValue({ rows: [] });

      await adminIpWhitelist(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied from this IP address'
      });
    });

    it('should handle IPv6 mapped IPv4 addresses', async () => {
      process.env.ADMIN_IP_WHITELIST = '127.0.0.1';
      mockReq.ip = '::ffff:127.0.0.1';
      db.query.mockResolvedValue({ rows: [] });

      await adminIpWhitelist(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle database errors silently', async () => {
      process.env.ADMIN_IP_WHITELIST = '127.0.0.1';
      mockReq.ip = '127.0.0.1';
      db.query.mockRejectedValue(new Error('DB error'));

      await adminIpWhitelist(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireAdmin2FA', () => {
    it('should set require2FA flag', () => {
      requireAdmin2FA(mockReq, mockRes, mockNext);

      expect(mockReq.require2FA).toBe(true);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('isSuperAdmin', () => {
    it('should return true for superadmin', async () => {
      db.query.mockResolvedValue({ rows: [{ is_superadmin: true }] });

      const result = await isSuperAdmin('user-1');

      expect(result).toBe(true);
    });

    it('should return false for non-superadmin', async () => {
      db.query.mockResolvedValue({ rows: [{ is_superadmin: false }] });

      const result = await isSuperAdmin('user-1');

      expect(result).toBe(false);
    });

    it('should return false for non-existent user', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await isSuperAdmin('non-existent');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      const result = await isSuperAdmin('user-1');

      expect(result).toBe(false);
    });
  });

  describe('logAdminAction', () => {
    it('should log action to database', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await logAdminAction(
        'user-1',
        'test@example.com',
        'TEST_ACTION',
        'bot',
        'bot-1',
        { detail: 'test' },
        mockReq
      );

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO admin_audit_log'),
        expect.arrayContaining(['user-1', 'test@example.com', 'TEST_ACTION'])
      );
    });

    it('should handle database errors silently', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      await expect(logAdminAction(
        'user-1',
        'test@example.com',
        'TEST_ACTION',
        'bot',
        'bot-1',
        {},
        mockReq
      )).resolves.not.toThrow();
    });
  });
});
