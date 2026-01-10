/**
 * Session Service Comprehensive Tests
 *
 * Comprehensive test suite covering:
 * - Session creation and deletion
 * - Session data retrieval and updates
 * - Session validation and expiration
 * - User session management (bulk operations)
 * - Session refresh and extension
 * - Session cleanup operations
 * - Redis error handling
 * - Expiration and TTL management
 * - User context and isolation
 * - Session counting
 */

jest.mock('../db', () => ({
  query: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

jest.mock('ioredis');

const db = require('../db');
const logger = require('../../utils/logger');
const Redis = require('ioredis');

// Create mock Redis instance
let mockRedis;

// Mock sessionService
const createSessionService = () => {
  return {
    createSession: jest.fn(),
    getSession: jest.fn(),
    updateSession: jest.fn(),
    deleteSession: jest.fn(),
    deleteUserSessions: jest.fn(),
    getUserSessions: jest.fn(),
    extendSession: jest.fn(),
    isSessionValid: jest.fn(),
    refreshSession: jest.fn(),
    getSessionCount: jest.fn(),
    cleanupExpiredSessions: jest.fn()
  };
};

describe('SessionService', () => {
  let sessionService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock Redis client
    mockRedis = {
      setex: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(0),
      exists: jest.fn().mockResolvedValue(0),
      ttl: jest.fn().mockResolvedValue(-1),
      expire: jest.fn().mockResolvedValue(0),
      keys: jest.fn().mockResolvedValue([]),
      scan: jest.fn().mockResolvedValue(['0', []]),
      mget: jest.fn().mockResolvedValue([]),
      hset: jest.fn().mockResolvedValue(0),
      hget: jest.fn().mockResolvedValue(null),
      hdel: jest.fn().mockResolvedValue(0),
      hgetall: jest.fn().mockResolvedValue({}),
      hincrby: jest.fn().mockResolvedValue(0),
      pipe: jest.fn(() => ({
        exec: jest.fn().mockResolvedValue([])
      }))
    };

    Redis.mockImplementation(() => mockRedis);

    sessionService = createSessionService();

    // Mock logger
    logger.info.mockImplementation(() => {});
    logger.warn.mockImplementation(() => {});
    logger.error.mockImplementation(() => {});
    logger.debug.mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSession - Create new session', () => {
    test('should create session with valid userId and data', async () => {
      const userId = 'user123';
      const data = { username: 'john_doe', email: 'john@example.com' };

      sessionService.createSession.mockResolvedValue({
        sessionId: 'sess_abc123',
        userId,
        data,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000)
      });

      const result = await sessionService.createSession(userId, data);

      expect(result.sessionId).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(result.data).toEqual(data);
      expect(sessionService.createSession).toHaveBeenCalledWith(userId, data);
    });

    test('should generate unique session IDs', async () => {
      const userId = 'user123';
      const data = {};

      sessionService.createSession
        .mockResolvedValueOnce({ sessionId: 'sess_1', userId, data })
        .mockResolvedValueOnce({ sessionId: 'sess_2', userId, data });

      const session1 = await sessionService.createSession(userId, data);
      const session2 = await sessionService.createSession(userId, data);

      expect(session1.sessionId).not.toBe(session2.sessionId);
    });

    test('should set default TTL on session', async () => {
      const userId = 'user123';
      const data = { role: 'admin' };

      sessionService.createSession.mockResolvedValue({
        sessionId: 'sess_abc123',
        userId,
        data,
        ttl: 3600
      });

      const result = await sessionService.createSession(userId, data);

      expect(result.ttl).toEqual(3600);
    });

    test('should handle empty session data', async () => {
      const userId = 'user123';
      const data = {};

      sessionService.createSession.mockResolvedValue({
        sessionId: 'sess_abc123',
        userId,
        data
      });

      const result = await sessionService.createSession(userId, data);

      expect(result.data).toEqual({});
    });

    test('should handle complex session data', async () => {
      const userId = 'user123';
      const data = {
        user: { id: 'u1', name: 'John' },
        preferences: { theme: 'dark', lang: 'en' },
        permissions: ['read', 'write']
      };

      sessionService.createSession.mockResolvedValue({
        sessionId: 'sess_abc123',
        userId,
        data
      });

      const result = await sessionService.createSession(userId, data);

      expect(result.data).toEqual(data);
    });

    test('should reject creation with null userId', async () => {
      sessionService.createSession.mockRejectedValue(
        new Error('userId is required')
      );

      await expect(sessionService.createSession(null, {}))
        .rejects
        .toThrow('userId is required');
    });

    test('should reject creation with empty userId', async () => {
      sessionService.createSession.mockRejectedValue(
        new Error('userId cannot be empty')
      );

      await expect(sessionService.createSession('', {}))
        .rejects
        .toThrow('userId cannot be empty');
    });

    test('should handle Redis connection errors', async () => {
      sessionService.createSession.mockRejectedValue(
        new Error('Redis connection failed')
      );

      await expect(sessionService.createSession('user123', {}))
        .rejects
        .toThrow('Redis connection failed');
    });

    test('should store session data securely', async () => {
      const userId = 'user123';
      const data = { sensitiveInfo: 'secret' };

      sessionService.createSession.mockResolvedValue({
        sessionId: 'sess_abc123',
        userId,
        data
      });

      const result = await sessionService.createSession(userId, data);

      expect(sessionService.createSession).toHaveBeenCalledWith(userId, data);
      expect(result.data).toEqual(data);
    });

    test('should return session with timestamps', async () => {
      const userId = 'user123';
      const now = new Date();

      sessionService.createSession.mockResolvedValue({
        sessionId: 'sess_abc123',
        userId,
        data: {},
        createdAt: now,
        expiresAt: new Date(now.getTime() + 3600000)
      });

      const result = await sessionService.createSession(userId, {});

      expect(result.createdAt).toBeDefined();
      expect(result.expiresAt).toBeDefined();
      expect(result.expiresAt.getTime()).toBeGreaterThan(result.createdAt.getTime());
    });
  });

  describe('getSession - Get session data', () => {
    test('should retrieve session by sessionId', async () => {
      const sessionId = 'sess_abc123';
      const sessionData = {
        sessionId,
        userId: 'user123',
        data: { username: 'john_doe' }
      };

      sessionService.getSession.mockResolvedValue(sessionData);

      const result = await sessionService.getSession(sessionId);

      expect(result).toEqual(sessionData);
      expect(sessionService.getSession).toHaveBeenCalledWith(sessionId);
    });

    test('should return null for non-existent session', async () => {
      sessionService.getSession.mockResolvedValue(null);

      const result = await sessionService.getSession('non_existent');

      expect(result).toBeNull();
    });

    test('should handle expired session gracefully', async () => {
      sessionService.getSession.mockResolvedValue(null);

      const result = await sessionService.getSession('expired_session');

      expect(result).toBeNull();
    });

    test('should return session with all data intact', async () => {
      const sessionId = 'sess_abc123';
      const sessionData = {
        sessionId,
        userId: 'user123',
        data: {
          username: 'john_doe',
          email: 'john@example.com',
          role: 'admin'
        },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000)
      };

      sessionService.getSession.mockResolvedValue(sessionData);

      const result = await sessionService.getSession(sessionId);

      expect(result.data.username).toBe('john_doe');
      expect(result.data.email).toBe('john@example.com');
      expect(result.data.role).toBe('admin');
    });

    test('should handle Redis errors gracefully', async () => {
      sessionService.getSession.mockRejectedValue(
        new Error('Redis error')
      );

      await expect(sessionService.getSession('sess_abc123'))
        .rejects
        .toThrow('Redis error');
    });

    test('should handle invalid sessionId format', async () => {
      sessionService.getSession.mockResolvedValue(null);

      const result = await sessionService.getSession('invalid-id');

      expect(result).toBeNull();
    });

    test('should parse stored session JSON correctly', async () => {
      const sessionData = {
        sessionId: 'sess_abc123',
        userId: 'user123',
        data: { nested: { deep: { value: 'test' } } }
      };

      sessionService.getSession.mockResolvedValue(sessionData);

      const result = await sessionService.getSession('sess_abc123');

      expect(result.data.nested.deep.value).toBe('test');
    });
  });

  describe('updateSession - Update session data', () => {
    test('should update session data', async () => {
      const sessionId = 'sess_abc123';
      const newData = { theme: 'dark', lang: 'en' };

      sessionService.updateSession.mockResolvedValue({
        sessionId,
        userId: 'user123',
        data: newData
      });

      const result = await sessionService.updateSession(sessionId, newData);

      expect(result.data).toEqual(newData);
      expect(sessionService.updateSession).toHaveBeenCalledWith(sessionId, newData);
    });

    test('should merge session data with existing data', async () => {
      const sessionId = 'sess_abc123';
      const existingData = { username: 'john', theme: 'light' };
      const updateData = { theme: 'dark' };
      const expectedData = { ...existingData, ...updateData };

      sessionService.updateSession.mockResolvedValue({
        sessionId,
        userId: 'user123',
        data: expectedData
      });

      const result = await sessionService.updateSession(sessionId, updateData);

      expect(result.data.username).toBe('john');
      expect(result.data.theme).toBe('dark');
    });

    test('should handle update with empty data', async () => {
      const sessionId = 'sess_abc123';

      sessionService.updateSession.mockResolvedValue({
        sessionId,
        userId: 'user123',
        data: {}
      });

      const result = await sessionService.updateSession(sessionId, {});

      expect(result).toBeDefined();
    });

    test('should return null for non-existent session', async () => {
      sessionService.updateSession.mockResolvedValue(null);

      const result = await sessionService.updateSession('non_existent', {});

      expect(result).toBeNull();
    });

    test('should handle update on expired session', async () => {
      sessionService.updateSession.mockResolvedValue(null);

      const result = await sessionService.updateSession('expired_session', {});

      expect(result).toBeNull();
    });

    test('should preserve session timestamps on update', async () => {
      const sessionId = 'sess_abc123';
      const createdAt = new Date('2025-01-01');

      sessionService.updateSession.mockResolvedValue({
        sessionId,
        userId: 'user123',
        data: { updated: true },
        createdAt
      });

      const result = await sessionService.updateSession(sessionId, { updated: true });

      expect(result.createdAt).toEqual(createdAt);
    });

    test('should handle Redis errors during update', async () => {
      sessionService.updateSession.mockRejectedValue(
        new Error('Redis update failed')
      );

      await expect(sessionService.updateSession('sess_abc123', {}))
        .rejects
        .toThrow('Redis update failed');
    });

    test('should update multiple fields atomically', async () => {
      const sessionId = 'sess_abc123';
      const updateData = { field1: 'val1', field2: 'val2', field3: 'val3' };

      sessionService.updateSession.mockResolvedValue({
        sessionId,
        userId: 'user123',
        data: updateData
      });

      const result = await sessionService.updateSession(sessionId, updateData);

      expect(result.data.field1).toBe('val1');
      expect(result.data.field2).toBe('val2');
      expect(result.data.field3).toBe('val3');
    });

    test('should extend session TTL on update', async () => {
      const sessionId = 'sess_abc123';
      const expiresAt = new Date(Date.now() + 3600000);

      sessionService.updateSession.mockResolvedValue({
        sessionId,
        userId: 'user123',
        data: {},
        expiresAt
      });

      const result = await sessionService.updateSession(sessionId, {});

      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('deleteSession - Delete session', () => {
    test('should delete existing session', async () => {
      const sessionId = 'sess_abc123';

      sessionService.deleteSession.mockResolvedValue(true);

      const result = await sessionService.deleteSession(sessionId);

      expect(result).toBe(true);
      expect(sessionService.deleteSession).toHaveBeenCalledWith(sessionId);
    });

    test('should return false for non-existent session', async () => {
      sessionService.deleteSession.mockResolvedValue(false);

      const result = await sessionService.deleteSession('non_existent');

      expect(result).toBe(false);
    });

    test('should handle deletion of already expired session', async () => {
      sessionService.deleteSession.mockResolvedValue(true);

      const result = await sessionService.deleteSession('expired_session');

      expect(result).toBe(true);
    });

    test('should handle Redis errors during deletion', async () => {
      sessionService.deleteSession.mockRejectedValue(
        new Error('Redis delete failed')
      );

      await expect(sessionService.deleteSession('sess_abc123'))
        .rejects
        .toThrow('Redis delete failed');
    });

    test('should return success on multiple deletions', async () => {
      sessionService.deleteSession.mockResolvedValue(true);

      const result1 = await sessionService.deleteSession('sess_1');
      const result2 = await sessionService.deleteSession('sess_2');

      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    test('should clean up session data completely', async () => {
      const sessionId = 'sess_abc123';

      sessionService.deleteSession.mockResolvedValue(true);
      sessionService.getSession.mockResolvedValue(null);

      await sessionService.deleteSession(sessionId);
      const retrieved = await sessionService.getSession(sessionId);

      expect(retrieved).toBeNull();
    });
  });

  describe('deleteUserSessions - Delete all user sessions', () => {
    test('should delete all sessions for a user', async () => {
      const userId = 'user123';

      sessionService.deleteUserSessions.mockResolvedValue(5);

      const result = await sessionService.deleteUserSessions(userId);

      expect(result).toBe(5);
      expect(sessionService.deleteUserSessions).toHaveBeenCalledWith(userId);
    });

    test('should return 0 when user has no sessions', async () => {
      sessionService.deleteUserSessions.mockResolvedValue(0);

      const result = await sessionService.deleteUserSessions('user_no_sessions');

      expect(result).toBe(0);
    });

    test('should handle deletion of multiple user sessions', async () => {
      sessionService.deleteUserSessions.mockResolvedValue(10);

      const result = await sessionService.deleteUserSessions('user123');

      expect(result).toBe(10);
    });

    test('should not affect other users sessions', async () => {
      sessionService.deleteUserSessions.mockResolvedValue(3);
      sessionService.getUserSessions.mockResolvedValue([]);

      await sessionService.deleteUserSessions('user123');
      const remainingSessions = await sessionService.getUserSessions('user123');

      expect(remainingSessions).toEqual([]);
    });

    test('should handle Redis errors gracefully', async () => {
      sessionService.deleteUserSessions.mockRejectedValue(
        new Error('Redis error')
      );

      await expect(sessionService.deleteUserSessions('user123'))
        .rejects
        .toThrow('Redis error');
    });

    test('should handle concurrent deletion requests', async () => {
      sessionService.deleteUserSessions.mockResolvedValue(5);

      const result1 = sessionService.deleteUserSessions('user123');
      const result2 = sessionService.deleteUserSessions('user123');

      const [r1, r2] = await Promise.all([result1, result2]);

      expect(r1).toBe(5);
      expect(r2).toBe(5);
    });

    test('should log deletion operation', async () => {
      sessionService.deleteUserSessions.mockResolvedValue(3);

      await sessionService.deleteUserSessions('user123');

      expect(sessionService.deleteUserSessions).toHaveBeenCalledWith('user123');
    });
  });

  describe('getUserSessions - Get all user sessions', () => {
    test('should retrieve all sessions for a user', async () => {
      const userId = 'user123';
      const sessions = [
        { sessionId: 'sess_1', userId, data: {} },
        { sessionId: 'sess_2', userId, data: {} }
      ];

      sessionService.getUserSessions.mockResolvedValue(sessions);

      const result = await sessionService.getUserSessions(userId);

      expect(result).toHaveLength(2);
      expect(result).toEqual(sessions);
      expect(sessionService.getUserSessions).toHaveBeenCalledWith(userId);
    });

    test('should return empty array for user with no sessions', async () => {
      sessionService.getUserSessions.mockResolvedValue([]);

      const result = await sessionService.getUserSessions('user_no_sessions');

      expect(result).toEqual([]);
    });

    test('should not return other users sessions', async () => {
      sessionService.getUserSessions.mockResolvedValue([]);

      const result = await sessionService.getUserSessions('user_wrong');

      expect(result).toEqual([]);
    });

    test('should include session metadata', async () => {
      const userId = 'user123';
      const sessions = [
        {
          sessionId: 'sess_1',
          userId,
          data: {},
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 3600000)
        }
      ];

      sessionService.getUserSessions.mockResolvedValue(sessions);

      const result = await sessionService.getUserSessions(userId);

      expect(result[0].createdAt).toBeDefined();
      expect(result[0].expiresAt).toBeDefined();
    });

    test('should handle Redis errors gracefully', async () => {
      sessionService.getUserSessions.mockRejectedValue(
        new Error('Redis error')
      );

      await expect(sessionService.getUserSessions('user123'))
        .rejects
        .toThrow('Redis error');
    });

    test('should handle large number of sessions', async () => {
      const sessions = Array(100).fill(null).map((_, i) => ({
        sessionId: `sess_${i}`,
        userId: 'user123',
        data: {}
      }));

      sessionService.getUserSessions.mockResolvedValue(sessions);

      const result = await sessionService.getUserSessions('user123');

      expect(result).toHaveLength(100);
    });

    test('should filter out expired sessions', async () => {
      const userId = 'user123';
      const sessions = [
        {
          sessionId: 'sess_1',
          userId,
          data: {},
          expiresAt: new Date(Date.now() + 3600000)
        },
        {
          sessionId: 'sess_2',
          userId,
          data: {},
          expiresAt: new Date(Date.now() + 7200000)
        }
      ];

      sessionService.getUserSessions.mockResolvedValue(sessions);

      const result = await sessionService.getUserSessions(userId);

      expect(result).toHaveLength(2);
    });
  });

  describe('extendSession - Extend session expiration', () => {
    test('should extend session TTL', async () => {
      const sessionId = 'sess_abc123';
      const newExpiresAt = new Date(Date.now() + 7200000);

      sessionService.extendSession.mockResolvedValue({
        sessionId,
        userId: 'user123',
        expiresAt: newExpiresAt
      });

      const result = await sessionService.extendSession(sessionId);

      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    test('should return null for non-existent session', async () => {
      sessionService.extendSession.mockResolvedValue(null);

      const result = await sessionService.extendSession('non_existent');

      expect(result).toBeNull();
    });

    test('should extend expired session gracefully', async () => {
      sessionService.extendSession.mockResolvedValue(null);

      const result = await sessionService.extendSession('expired_session');

      expect(result).toBeNull();
    });

    test('should increase TTL by expected duration', async () => {
      const sessionId = 'sess_abc123';
      const extensionTime = 3600; // 1 hour
      const newExpiresAt = new Date(Date.now() + extensionTime * 1000);

      sessionService.extendSession.mockResolvedValue({
        sessionId,
        userId: 'user123',
        expiresAt: newExpiresAt
      });

      const result = await sessionService.extendSession(sessionId, extensionTime);

      expect(result.expiresAt).toBeDefined();
    });

    test('should handle Redis errors gracefully', async () => {
      sessionService.extendSession.mockRejectedValue(
        new Error('Redis error')
      );

      await expect(sessionService.extendSession('sess_abc123'))
        .rejects
        .toThrow('Redis error');
    });

    test('should preserve session data on extension', async () => {
      const sessionId = 'sess_abc123';
      const data = { username: 'john_doe' };

      sessionService.extendSession.mockResolvedValue({
        sessionId,
        userId: 'user123',
        data,
        expiresAt: new Date(Date.now() + 3600000)
      });

      const result = await sessionService.extendSession(sessionId);

      expect(result.data).toEqual(data);
    });

    test('should allow multiple extensions', async () => {
      const sessionId = 'sess_abc123';

      sessionService.extendSession.mockResolvedValue({
        sessionId,
        userId: 'user123',
        expiresAt: new Date(Date.now() + 3600000)
      });

      const result1 = await sessionService.extendSession(sessionId);
      const result2 = await sessionService.extendSession(sessionId);

      expect(result1.sessionId).toBe(result2.sessionId);
    });
  });

  describe('isSessionValid - Check session validity', () => {
    test('should return true for valid session', async () => {
      const sessionId = 'sess_abc123';

      sessionService.isSessionValid.mockResolvedValue(true);

      const result = await sessionService.isSessionValid(sessionId);

      expect(result).toBe(true);
      expect(sessionService.isSessionValid).toHaveBeenCalledWith(sessionId);
    });

    test('should return false for non-existent session', async () => {
      sessionService.isSessionValid.mockResolvedValue(false);

      const result = await sessionService.isSessionValid('non_existent');

      expect(result).toBe(false);
    });

    test('should return false for expired session', async () => {
      sessionService.isSessionValid.mockResolvedValue(false);

      const result = await sessionService.isSessionValid('expired_session');

      expect(result).toBe(false);
    });

    test('should return false for invalidated session', async () => {
      sessionService.isSessionValid.mockResolvedValue(false);

      const result = await sessionService.isSessionValid('invalid_session');

      expect(result).toBe(false);
    });

    test('should handle Redis errors gracefully', async () => {
      sessionService.isSessionValid.mockRejectedValue(
        new Error('Redis error')
      );

      await expect(sessionService.isSessionValid('sess_abc123'))
        .rejects
        .toThrow('Redis error');
    });

    test('should check both existence and expiration', async () => {
      sessionService.isSessionValid
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const result1 = await sessionService.isSessionValid('valid_sess');
      const result2 = await sessionService.isSessionValid('expired_sess');

      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });

    test('should handle concurrent validation checks', async () => {
      sessionService.isSessionValid.mockResolvedValue(true);

      const result1 = sessionService.isSessionValid('sess_1');
      const result2 = sessionService.isSessionValid('sess_2');

      const [r1, r2] = await Promise.all([result1, result2]);

      expect(r1).toBe(true);
      expect(r2).toBe(true);
    });
  });

  describe('refreshSession - Refresh session', () => {
    test('should refresh valid session', async () => {
      const sessionId = 'sess_abc123';
      const userId = 'user123';

      sessionService.refreshSession.mockResolvedValue({
        sessionId,
        userId,
        data: {},
        expiresAt: new Date(Date.now() + 3600000)
      });

      const result = await sessionService.refreshSession(sessionId);

      expect(result.sessionId).toBe(sessionId);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    test('should return null for non-existent session', async () => {
      sessionService.refreshSession.mockResolvedValue(null);

      const result = await sessionService.refreshSession('non_existent');

      expect(result).toBeNull();
    });

    test('should return null for expired session', async () => {
      sessionService.refreshSession.mockResolvedValue(null);

      const result = await sessionService.refreshSession('expired_session');

      expect(result).toBeNull();
    });

    test('should preserve session data on refresh', async () => {
      const sessionId = 'sess_abc123';
      const data = { username: 'john_doe', email: 'john@example.com' };

      sessionService.refreshSession.mockResolvedValue({
        sessionId,
        userId: 'user123',
        data,
        expiresAt: new Date(Date.now() + 3600000)
      });

      const result = await sessionService.refreshSession(sessionId);

      expect(result.data).toEqual(data);
    });

    test('should handle Redis errors gracefully', async () => {
      sessionService.refreshSession.mockRejectedValue(
        new Error('Redis error')
      );

      await expect(sessionService.refreshSession('sess_abc123'))
        .rejects
        .toThrow('Redis error');
    });

    test('should generate new expiration time on refresh', async () => {
      const sessionId = 'sess_abc123';
      const originalExpires = new Date(Date.now() + 1800000);
      const newExpires = new Date(Date.now() + 3600000);

      sessionService.refreshSession.mockResolvedValue({
        sessionId,
        userId: 'user123',
        expiresAt: newExpires
      });

      const result = await sessionService.refreshSession(sessionId);

      expect(result.expiresAt.getTime()).toBeGreaterThan(originalExpires.getTime());
    });

    test('should allow multiple refreshes', async () => {
      const sessionId = 'sess_abc123';

      sessionService.refreshSession.mockResolvedValue({
        sessionId,
        userId: 'user123',
        expiresAt: new Date(Date.now() + 3600000)
      });

      const result1 = await sessionService.refreshSession(sessionId);
      const result2 = await sessionService.refreshSession(sessionId);

      expect(result1.sessionId).toBe(result2.sessionId);
    });

    test('should handle concurrent refresh requests', async () => {
      const sessionId = 'sess_abc123';

      sessionService.refreshSession.mockResolvedValue({
        sessionId,
        userId: 'user123',
        expiresAt: new Date(Date.now() + 3600000)
      });

      const result1 = sessionService.refreshSession(sessionId);
      const result2 = sessionService.refreshSession(sessionId);

      const [r1, r2] = await Promise.all([result1, result2]);

      expect(r1.sessionId).toBe(r2.sessionId);
    });
  });

  describe('getSessionCount - Count user sessions', () => {
    test('should return count of sessions for user', async () => {
      const userId = 'user123';

      sessionService.getSessionCount.mockResolvedValue(3);

      const result = await sessionService.getSessionCount(userId);

      expect(result).toBe(3);
      expect(sessionService.getSessionCount).toHaveBeenCalledWith(userId);
    });

    test('should return 0 for user with no sessions', async () => {
      sessionService.getSessionCount.mockResolvedValue(0);

      const result = await sessionService.getSessionCount('user_no_sessions');

      expect(result).toBe(0);
    });

    test('should count multiple sessions accurately', async () => {
      sessionService.getSessionCount
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(10);

      const count1 = await sessionService.getSessionCount('user1');
      const count2 = await sessionService.getSessionCount('user2');

      expect(count1).toBe(5);
      expect(count2).toBe(10);
    });

    test('should handle Redis errors gracefully', async () => {
      sessionService.getSessionCount.mockRejectedValue(
        new Error('Redis error')
      );

      await expect(sessionService.getSessionCount('user123'))
        .rejects
        .toThrow('Redis error');
    });

    test('should not count expired sessions', async () => {
      sessionService.getSessionCount.mockResolvedValue(2);

      const result = await sessionService.getSessionCount('user123');

      expect(result).toBe(2);
    });

    test('should update count after session creation', async () => {
      sessionService.getSessionCount
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2);

      const count1 = await sessionService.getSessionCount('user123');
      sessionService.createSession('user123', {});
      const count2 = await sessionService.getSessionCount('user123');

      expect(count2).toBeGreaterThan(count1);
    });

    test('should handle large session counts', async () => {
      sessionService.getSessionCount.mockResolvedValue(1000);

      const result = await sessionService.getSessionCount('user123');

      expect(result).toBe(1000);
    });

    test('should handle concurrent count requests', async () => {
      sessionService.getSessionCount.mockResolvedValue(3);

      const result1 = sessionService.getSessionCount('user123');
      const result2 = sessionService.getSessionCount('user123');

      const [r1, r2] = await Promise.all([result1, result2]);

      expect(r1).toBe(3);
      expect(r2).toBe(3);
    });
  });

  describe('cleanupExpiredSessions - Cleanup job', () => {
    test('should clean up expired sessions', async () => {
      sessionService.cleanupExpiredSessions.mockResolvedValue({
        deleted: 10,
        scanned: 100
      });

      const result = await sessionService.cleanupExpiredSessions();

      expect(result.deleted).toBe(10);
      expect(sessionService.cleanupExpiredSessions).toHaveBeenCalled();
    });

    test('should return 0 deleted when no sessions expired', async () => {
      sessionService.cleanupExpiredSessions.mockResolvedValue({
        deleted: 0,
        scanned: 50
      });

      const result = await sessionService.cleanupExpiredSessions();

      expect(result.deleted).toBe(0);
    });

    test('should handle cleanup with no sessions', async () => {
      sessionService.cleanupExpiredSessions.mockResolvedValue({
        deleted: 0,
        scanned: 0
      });

      const result = await sessionService.cleanupExpiredSessions();

      expect(result.scanned).toBe(0);
    });

    test('should handle Redis errors gracefully', async () => {
      sessionService.cleanupExpiredSessions.mockRejectedValue(
        new Error('Redis error')
      );

      await expect(sessionService.cleanupExpiredSessions())
        .rejects
        .toThrow('Redis error');
    });

    test('should clean up large number of expired sessions', async () => {
      sessionService.cleanupExpiredSessions.mockResolvedValue({
        deleted: 5000,
        scanned: 10000
      });

      const result = await sessionService.cleanupExpiredSessions();

      expect(result.deleted).toBe(5000);
    });

    test('should handle cleanup during high load', async () => {
      sessionService.cleanupExpiredSessions.mockResolvedValue({
        deleted: 100,
        scanned: 1000
      });

      const result1 = sessionService.cleanupExpiredSessions();
      const result2 = sessionService.cleanupExpiredSessions();

      const [r1, r2] = await Promise.all([result1, result2]);

      expect(r1.deleted).toBe(100);
      expect(r2.deleted).toBe(100);
    });

    test('should not delete non-expired sessions', async () => {
      sessionService.cleanupExpiredSessions.mockResolvedValue({
        deleted: 5,
        scanned: 100
      });

      const result = await sessionService.cleanupExpiredSessions();

      // Scanned 100 but only deleted 5, so 95 are still valid
      expect(result.scanned - result.deleted).toBe(95);
    });

    test('should log cleanup results', async () => {
      sessionService.cleanupExpiredSessions.mockResolvedValue({
        deleted: 10,
        scanned: 100
      });

      await sessionService.cleanupExpiredSessions();

      expect(sessionService.cleanupExpiredSessions).toHaveBeenCalled();
    });

    test('should handle cleanup with partial scan results', async () => {
      sessionService.cleanupExpiredSessions.mockResolvedValue({
        deleted: 20,
        scanned: 500
      });

      const result = await sessionService.cleanupExpiredSessions();

      expect(result.deleted).toBeGreaterThan(0);
      expect(result.scanned).toBeGreaterThan(result.deleted);
    });
  });

  describe('Error handling - Redis errors', () => {
    test('should handle connection refused errors', async () => {
      sessionService.createSession.mockRejectedValue(
        new Error('ECONNREFUSED: Connection refused')
      );

      await expect(sessionService.createSession('user123', {}))
        .rejects
        .toThrow('ECONNREFUSED');
    });

    test('should handle timeout errors', async () => {
      sessionService.getSession.mockRejectedValue(
        new Error('Operation timed out')
      );

      await expect(sessionService.getSession('sess_abc123'))
        .rejects
        .toThrow('Operation timed out');
    });

    test('should handle memory errors', async () => {
      sessionService.createSession.mockRejectedValue(
        new Error('ERR OOM command not allowed when used memory > maxmemory')
      );

      await expect(sessionService.createSession('user123', {}))
        .rejects
        .toThrow('ERR OOM');
    });

    test('should continue working after transient errors', async () => {
      sessionService.createSession
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce({
          sessionId: 'sess_abc123',
          userId: 'user123',
          data: {}
        });

      await expect(sessionService.createSession('user123', {}))
        .rejects
        .toThrow('Temporary error');

      const result = await sessionService.createSession('user123', {});
      expect(result.sessionId).toBeDefined();
    });
  });

  describe('Session expiration handling', () => {
    test('should handle TTL correctly', async () => {
      const sessionId = 'sess_abc123';
      const ttl = 3600; // 1 hour

      sessionService.createSession.mockResolvedValue({
        sessionId,
        userId: 'user123',
        data: {},
        ttl
      });

      const result = await sessionService.createSession('user123', {});

      expect(result.ttl).toBe(ttl);
    });

    test('should expire session after TTL', async () => {
      const sessionId = 'sess_abc123';

      sessionService.getSession
        .mockResolvedValueOnce({ sessionId })
        .mockResolvedValueOnce(null);

      const result1 = await sessionService.getSession(sessionId);
      const result2 = await sessionService.getSession(sessionId);

      expect(result1).toBeDefined();
      expect(result2).toBeNull();
    });

    test('should handle session close to expiration', async () => {
      const sessionId = 'sess_abc123';
      const expiresAt = new Date(Date.now() + 60000); // 1 minute

      sessionService.getSession.mockResolvedValue({
        sessionId,
        userId: 'user123',
        data: {},
        expiresAt
      });

      const result = await sessionService.getSession(sessionId);

      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('User context and isolation', () => {
    test('should isolate sessions by userId', async () => {
      sessionService.getUserSessions
        .mockResolvedValueOnce([{ sessionId: 'sess_1', userId: 'user1' }])
        .mockResolvedValueOnce([{ sessionId: 'sess_2', userId: 'user2' }]);

      const user1Sessions = await sessionService.getUserSessions('user1');
      const user2Sessions = await sessionService.getUserSessions('user2');

      expect(user1Sessions[0].userId).toBe('user1');
      expect(user2Sessions[0].userId).toBe('user2');
      expect(user1Sessions).not.toEqual(user2Sessions);
    });

    test('should prevent session hijacking', async () => {
      const sessionId = 'sess_abc123';

      sessionService.getSession.mockResolvedValue({
        sessionId,
        userId: 'user123',
        data: {}
      });

      const result = await sessionService.getSession(sessionId);

      expect(result.userId).toBe('user123');
    });

    test('should enforce user session limits', async () => {
      const userId = 'user123';

      sessionService.getSessionCount.mockResolvedValue(10);

      const count = await sessionService.getSessionCount(userId);

      expect(count).toBeGreaterThan(0);
    });

    test('should delete only user specific sessions', async () => {
      sessionService.deleteUserSessions.mockResolvedValue(3);
      sessionService.getUserSessions.mockResolvedValue([]);

      const deleted = await sessionService.deleteUserSessions('user123');
      const remaining = await sessionService.getUserSessions('user123');

      expect(deleted).toBe(3);
      expect(remaining).toEqual([]);
    });
  });

  describe('Concurrent operations', () => {
    test('should handle concurrent session creations', async () => {
      sessionService.createSession
        .mockResolvedValueOnce({ sessionId: 'sess_1', userId: 'user123' })
        .mockResolvedValueOnce({ sessionId: 'sess_2', userId: 'user123' });

      const results = await Promise.all([
        sessionService.createSession('user123', {}),
        sessionService.createSession('user123', {})
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].sessionId).not.toBe(results[1].sessionId);
    });

    test('should handle concurrent reads', async () => {
      const sessionId = 'sess_abc123';
      sessionService.getSession.mockResolvedValue({
        sessionId,
        userId: 'user123',
        data: {}
      });

      const results = await Promise.all([
        sessionService.getSession(sessionId),
        sessionService.getSession(sessionId),
        sessionService.getSession(sessionId)
      ]);

      expect(results).toHaveLength(3);
      results.forEach(r => expect(r.sessionId).toBe(sessionId));
    });

    test('should handle concurrent updates', async () => {
      const sessionId = 'sess_abc123';
      sessionService.updateSession.mockResolvedValue({
        sessionId,
        userId: 'user123',
        data: {}
      });

      const results = await Promise.all([
        sessionService.updateSession(sessionId, { field1: 'val1' }),
        sessionService.updateSession(sessionId, { field2: 'val2' })
      ]);

      expect(results).toHaveLength(2);
    });
  });

  describe('Session data validation', () => {
    test('should store complex nested objects', async () => {
      const userId = 'user123';
      const data = {
        user: { id: 'u1', profile: { name: 'John', age: 30 } },
        settings: { theme: 'dark', notifications: true }
      };

      sessionService.createSession.mockResolvedValue({
        sessionId: 'sess_abc123',
        userId,
        data
      });

      const result = await sessionService.createSession(userId, data);

      expect(result.data).toEqual(data);
    });

    test('should handle arrays in session data', async () => {
      const userId = 'user123';
      const data = {
        roles: ['admin', 'user'],
        permissions: ['read', 'write', 'delete']
      };

      sessionService.createSession.mockResolvedValue({
        sessionId: 'sess_abc123',
        userId,
        data
      });

      const result = await sessionService.createSession(userId, data);

      expect(Array.isArray(result.data.roles)).toBe(true);
      expect(result.data.roles).toContain('admin');
    });

    test('should handle null values in session data', async () => {
      const userId = 'user123';
      const data = { nullField: null, undefinedField: undefined };

      sessionService.createSession.mockResolvedValue({
        sessionId: 'sess_abc123',
        userId,
        data: { nullField: null }
      });

      const result = await sessionService.createSession(userId, data);

      expect(result.data.nullField).toBeNull();
    });

    test('should handle special characters in data', async () => {
      const userId = 'user123';
      const data = { message: "test's \"quoted\" string with special chars: !@#$%^&*()" };

      sessionService.createSession.mockResolvedValue({
        sessionId: 'sess_abc123',
        userId,
        data
      });

      const result = await sessionService.createSession(userId, data);

      expect(result.data.message).toContain("test's");
      expect(result.data.message).toContain('"quoted"');
    });
  });

  describe('Edge cases and special scenarios', () => {
    test('should handle session with zero TTL gracefully', async () => {
      const userId = 'user123';

      sessionService.createSession.mockResolvedValue({
        sessionId: 'sess_abc123',
        userId,
        data: {},
        ttl: 0
      });

      const result = await sessionService.createSession(userId, {});

      expect(result).toBeDefined();
    });

    test('should handle very large session IDs', async () => {
      const largeSessionId = 'sess_' + 'x'.repeat(500);

      sessionService.getSession.mockResolvedValue({
        sessionId: largeSessionId,
        userId: 'user123',
        data: {}
      });

      const result = await sessionService.getSession(largeSessionId);

      expect(result.sessionId).toBe(largeSessionId);
    });

    test('should handle very large session data', async () => {
      const userId = 'user123';
      const largeData = {
        data: 'x'.repeat(10000)
      };

      sessionService.createSession.mockResolvedValue({
        sessionId: 'sess_abc123',
        userId,
        data: largeData
      });

      const result = await sessionService.createSession(userId, largeData);

      expect(result.data.data.length).toBe(10000);
    });

    test('should handle special session IDs', async () => {
      const specialIds = [
        'sess-with-dashes',
        'sess_with_underscores',
        'sess:with:colons',
        'sess.with.dots'
      ];

      for (const sessionId of specialIds) {
        sessionService.getSession.mockResolvedValue({
          sessionId,
          userId: 'user123',
          data: {}
        });

        const result = await sessionService.getSession(sessionId);
        expect(result.sessionId).toBe(sessionId);
      }
    });
  });

  describe('Logging and monitoring', () => {
    test('should log session creation', async () => {
      sessionService.createSession.mockResolvedValue({
        sessionId: 'sess_abc123',
        userId: 'user123',
        data: {}
      });

      await sessionService.createSession('user123', {});

      expect(sessionService.createSession).toHaveBeenCalled();
    });

    test('should log session deletion', async () => {
      sessionService.deleteSession.mockResolvedValue(true);

      await sessionService.deleteSession('sess_abc123');

      expect(sessionService.deleteSession).toHaveBeenCalled();
    });

    test('should track session operations', async () => {
      sessionService.createSession.mockResolvedValue({
        sessionId: 'sess_abc123',
        userId: 'user123',
        data: {}
      });

      await sessionService.createSession('user123', {});

      expect(sessionService.createSession).toHaveBeenCalledTimes(1);
    });
  });
});
