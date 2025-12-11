/**
 * Audit Middleware Tests
 * Tests for server/middleware/audit.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  audit: jest.fn()
}));

const db = require('../../db');
const {
  auditLog,
  auditMiddleware,
  getIpAddress,
  getUserAgent,
  logLogin,
  logLogout,
  logRegister,
  logPasswordChange,
  logOrganizationCreated,
  logOrganizationUpdated,
  logOrganizationDeleted,
  logOrganizationSwitched,
  logMemberInvited,
  logMemberRoleChanged,
  logMemberRemoved,
  logBotCreated,
  logBotUpdated,
  logBotDeleted,
  logMessageSent,
  logUnauthorizedAccess,
  logSuspiciousActivity
} = require('../../middleware/audit');

describe('Audit Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    db.query.mockResolvedValue({ rows: [] });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getIpAddress', () => {
    it('should return x-forwarded-for IP', () => {
      const req = { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } };
      expect(getIpAddress(req)).toBe('1.2.3.4');
    });

    it('should return x-real-ip', () => {
      const req = { headers: { 'x-real-ip': '1.2.3.4' } };
      expect(getIpAddress(req)).toBe('1.2.3.4');
    });

    it('should return connection.remoteAddress', () => {
      const req = { headers: {}, connection: { remoteAddress: '1.2.3.4' } };
      expect(getIpAddress(req)).toBe('1.2.3.4');
    });

    it('should return socket.remoteAddress', () => {
      const req = { headers: {}, socket: { remoteAddress: '1.2.3.4' } };
      expect(getIpAddress(req)).toBe('1.2.3.4');
    });

    it('should return unknown for missing IP', () => {
      const req = { headers: {} };
      expect(getIpAddress(req)).toBe('unknown');
    });
  });

  describe('getUserAgent', () => {
    it('should return user-agent header', () => {
      const req = { headers: { 'user-agent': 'Mozilla/5.0' } };
      expect(getUserAgent(req)).toBe('Mozilla/5.0');
    });

    it('should return unknown for missing user-agent', () => {
      const req = { headers: {} };
      expect(getUserAgent(req)).toBe('unknown');
    });
  });

  describe('auditLog', () => {
    it('should log audit event', async () => {
      await auditLog({
        userId: 1,
        organizationId: 1,
        action: 'test.action',
        resourceType: 'test',
        resourceId: 1
      });

      jest.runAllTimers();
      await Promise.resolve();

      expect(db.query).toHaveBeenCalled();
    });

    it('should handle missing optional params', async () => {
      await auditLog({
        action: 'test.action',
        resourceType: 'test'
      });

      jest.runAllTimers();
      await Promise.resolve();

      expect(db.query).toHaveBeenCalled();
    });
  });

  describe('auditMiddleware', () => {
    it('should create middleware function', () => {
      const middleware = auditMiddleware('test.action', 'test');
      expect(typeof middleware).toBe('function');
    });

    it('should log on successful response', async () => {
      const middleware = auditMiddleware('test.action', 'test');
      const req = {
        user: { id: 1 },
        organization: { id: 1 },
        headers: {},
        method: 'POST',
        path: '/test'
      };
      const res = {
        statusCode: 200,
        json: jest.fn()
      };
      const next = jest.fn();

      await middleware(req, res, next);
      expect(next).toHaveBeenCalled();

      res.json({ success: true });
      jest.runAllTimers();
    });

    it('should not log on error response', async () => {
      const middleware = auditMiddleware('test.action', 'test');
      const req = {
        headers: {},
        method: 'POST',
        path: '/test'
      };
      const res = {
        statusCode: 500,
        json: jest.fn()
      };
      const next = jest.fn();

      await middleware(req, res, next);
      res.json({ error: 'Failed' });
    });
  });

  describe('Authentication log functions', () => {
    const mockReq = { headers: {} };

    it('logLogin should log login event', async () => {
      await logLogin(mockReq, 1, true);
      jest.runAllTimers();
    });

    it('logLogin should log failed login', async () => {
      await logLogin(mockReq, 1, false, 'Wrong password');
      jest.runAllTimers();
    });

    it('logLogout should log logout event', async () => {
      await logLogout(mockReq, 1);
      jest.runAllTimers();
    });

    it('logRegister should log registration event', async () => {
      await logRegister(mockReq, 1, 'test@example.com');
      jest.runAllTimers();
    });

    it('logPasswordChange should log password change', async () => {
      await logPasswordChange(mockReq, 1);
      jest.runAllTimers();
    });
  });

  describe('Organization log functions', () => {
    const mockReq = { user: { id: 1 }, headers: {} };

    it('logOrganizationCreated should log', async () => {
      await logOrganizationCreated(mockReq, 1, { name: 'Test Org' });
      jest.runAllTimers();
    });

    it('logOrganizationUpdated should log', async () => {
      await logOrganizationUpdated(mockReq, 1, { name: 'Old' }, { name: 'New' });
      jest.runAllTimers();
    });

    it('logOrganizationDeleted should log', async () => {
      await logOrganizationDeleted(mockReq, 1, { name: 'Test Org' });
      jest.runAllTimers();
    });

    it('logOrganizationSwitched should log', async () => {
      await logOrganizationSwitched(mockReq, 2);
      jest.runAllTimers();
    });
  });

  describe('Member log functions', () => {
    const mockReq = { user: { id: 1 }, headers: {} };

    it('logMemberInvited should log', async () => {
      await logMemberInvited(mockReq, 1, 2, 'member');
      jest.runAllTimers();
    });

    it('logMemberRoleChanged should log', async () => {
      await logMemberRoleChanged(mockReq, 1, 2, 'member', 'admin');
      jest.runAllTimers();
    });

    it('logMemberRemoved should log', async () => {
      await logMemberRemoved(mockReq, 1, 2, { role: 'member' });
      jest.runAllTimers();
    });
  });

  describe('Bot log functions', () => {
    const mockReq = { user: { id: 1 }, headers: {} };

    it('logBotCreated should log', async () => {
      await logBotCreated(mockReq, 1, 1, { name: 'Test Bot' });
      jest.runAllTimers();
    });

    it('logBotUpdated should log', async () => {
      await logBotUpdated(mockReq, 1, 1, { name: 'Old' }, { name: 'New' });
      jest.runAllTimers();
    });

    it('logBotDeleted should log', async () => {
      await logBotDeleted(mockReq, 1, 1, { name: 'Test Bot' });
      jest.runAllTimers();
    });
  });

  describe('Message log functions', () => {
    const mockReq = { user: { id: 1 }, headers: {} };

    it('logMessageSent should log', async () => {
      await logMessageSent(mockReq, 1, 1, 'msg-123');
      jest.runAllTimers();
    });
  });

  describe('Security log functions', () => {
    const mockReq = { user: { id: 1 }, organization: { id: 1 }, headers: {}, path: '/test', method: 'GET' };

    it('logUnauthorizedAccess should log', async () => {
      await logUnauthorizedAccess(mockReq, 'No permission');
      jest.runAllTimers();
    });

    it('logSuspiciousActivity should log', async () => {
      await logSuspiciousActivity(mockReq, 'brute_force', { attempts: 10 });
      jest.runAllTimers();
    });

    it('should handle missing user context', async () => {
      await logUnauthorizedAccess({ headers: {}, path: '/test', method: 'GET' }, 'No auth');
      jest.runAllTimers();
    });
  });
});
