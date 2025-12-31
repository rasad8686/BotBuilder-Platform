/**
 * Session Management Routes Tests
 * Tests for active session viewing and management
 */

const express = require('express');
const request = require('supertest');

// Mock dependencies
jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 'user-1', email: 'test@example.com' };
  req.cookies = { session_token: 'current-session-token' };
  next();
}));

jest.mock('../../middleware/audit', () => ({
  auditLog: jest.fn().mockResolvedValue(true),
  getIpAddress: jest.fn(() => '192.168.1.1'),
  getUserAgent: jest.fn(() => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../db');
const { auditLog } = require('../../middleware/audit');
const sessionsRouter = require('../../routes/sessions');

describe('Session Management Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/sessions', sessionsRouter);
  });

  describe('Exported Functions', () => {
    it('should export createSession function', () => {
      expect(sessionsRouter.createSession).toBeDefined();
      expect(typeof sessionsRouter.createSession).toBe('function');
    });

    it('should export generateSessionToken function', () => {
      expect(sessionsRouter.generateSessionToken).toBeDefined();
      expect(typeof sessionsRouter.generateSessionToken).toBe('function');
    });

    it('should export SESSION_TIMEOUT_MS constant', () => {
      expect(sessionsRouter.SESSION_TIMEOUT_MS).toBeDefined();
      expect(sessionsRouter.SESSION_TIMEOUT_MS).toBe(24 * 60 * 60 * 1000);
    });

    it('should generate unique session tokens', () => {
      const token1 = sessionsRouter.generateSessionToken();
      const token2 = sessionsRouter.generateSessionToken();

      expect(token1).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2);
    });

    it('should create session with device info', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const mockReq = {
        headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0' },
        ip: '192.168.1.1'
      };

      const token = await sessionsRouter.createSession('user-1', mockReq);

      expect(token).toBeDefined();
      expect(token).toHaveLength(64);
      expect(db.query).toHaveBeenCalled();
    });
  });

  describe('GET /api/sessions', () => {
    it('should return all active sessions', async () => {
      const mockSessions = [
        {
          id: 1,
          device_info: 'Chrome on Windows (Desktop)',
          ip_address: '192.168.1.1',
          created_at: new Date(),
          last_activity_at: new Date()
        },
        {
          id: 2,
          device_info: 'Safari on macOS (Desktop)',
          ip_address: '10.0.0.1',
          created_at: new Date(),
          last_activity_at: new Date(Date.now() - 3600000)
        }
      ];
      db.query.mockResolvedValue({ rows: mockSessions });

      const response = await request(app).get('/api/sessions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.sessions).toHaveLength(2);
      expect(response.body.sessions[0].isCurrent).toBe(true);
      expect(response.body.sessions[1].isCurrent).toBe(false);
    });

    it('should return empty list when no sessions', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const response = await request(app).get('/api/sessions');

      expect(response.status).toBe(200);
      expect(response.body.sessions).toEqual([]);
    });

    it('should map session fields correctly', async () => {
      const mockSession = {
        id: 1,
        device_info: 'Firefox on Linux (Desktop)',
        ip_address: '127.0.0.1',
        created_at: new Date('2024-01-01'),
        last_activity_at: new Date('2024-01-02')
      };
      db.query.mockResolvedValue({ rows: [mockSession] });

      const response = await request(app).get('/api/sessions');

      expect(response.body.sessions[0]).toEqual({
        id: 1,
        deviceInfo: 'Firefox on Linux (Desktop)',
        ipAddress: '127.0.0.1',
        createdAt: mockSession.created_at,
        lastActivity: mockSession.last_activity_at,
        isCurrent: true
      });
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/sessions');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Server error');
    });
  });

  describe('DELETE /api/sessions/:id', () => {
    it('should terminate specific session', async () => {
      const mockSession = { id: 2, device_info: 'Firefox on Linux', ip_address: '10.0.0.1' };
      db.query
        .mockResolvedValueOnce({ rows: [mockSession] }) // Verify ownership
        .mockResolvedValueOnce({ rows: [] }); // Deactivate session

      const response = await request(app).delete('/api/sessions/2');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Session terminated successfully');
      expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'session.terminated',
        resourceType: 'session'
      }));
    });

    it('should return 404 for non-existent session', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const response = await request(app).delete('/api/sessions/999');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Session not found');
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValue(new Error('Database error'));

      const response = await request(app).delete('/api/sessions/1');

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Server error');
    });
  });

  describe('DELETE /api/sessions', () => {
    it('should terminate all other sessions', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 2 }, { id: 3 }], rowCount: 2 });

      const response = await request(app).delete('/api/sessions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.terminatedCount).toBe(2);
      expect(response.body.message).toContain('Logged out from 2 other session(s)');
    });

    it('should handle zero sessions terminated', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const response = await request(app).delete('/api/sessions');

      expect(response.status).toBe(200);
      expect(response.body.terminatedCount).toBe(0);
    });

    it('should create audit log', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 3 });

      await request(app).delete('/api/sessions');

      expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'session.terminated.all',
        metadata: { terminatedCount: 3 }
      }));
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValue(new Error('Database error'));

      const response = await request(app).delete('/api/sessions');

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Server error');
    });
  });

  describe('POST /api/sessions/refresh', () => {
    it('should refresh session with cookie token', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const response = await request(app).post('/api/sessions/refresh');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Session refreshed');
      expect(response.body.expiresAt).toBeDefined();
    });

    it('should refresh session with header token', async () => {
      // Mock auth middleware to not provide cookie
      const appWithHeaderToken = express();
      appWithHeaderToken.use(express.json());
      appWithHeaderToken.use((req, res, next) => {
        req.user = { id: 'user-1' };
        req.headers['x-session-token'] = 'header-token';
        req.cookies = {}; // Empty cookies
        next();
      });
      appWithHeaderToken.use('/api/sessions', sessionsRouter);

      db.query.mockResolvedValue({ rows: [] });

      const response = await request(appWithHeaderToken).post('/api/sessions/refresh');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 400 when no session token', async () => {
      // Mock auth middleware to not provide any token
      const appNoToken = express();
      appNoToken.use(express.json());
      appNoToken.use((req, res, next) => {
        req.user = { id: 'user-1' };
        req.cookies = {};
        req.headers = {};
        next();
      });
      appNoToken.use('/api/sessions', sessionsRouter);

      const response = await request(appNoToken).post('/api/sessions/refresh');

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('No session token');
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValue(new Error('Database error'));

      const response = await request(app).post('/api/sessions/refresh');

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Server error');
    });
  });

  describe('Device Info Parsing', () => {
    it('should handle various user agents correctly', async () => {
      const testCases = [
        {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          expected: 'Chrome on Windows (Desktop)'
        },
        {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
          expected: 'Safari on macOS (Desktop)'
        },
        {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1',
          expected: 'Safari on iOS (Mobile)'
        },
        {
          userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
          expected: 'Chrome on Android (Mobile)'
        },
        {
          userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0',
          expected: 'Firefox on Linux (Desktop)'
        },
        {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59',
          expected: 'Edge on Windows (Desktop)'
        }
      ];

      for (const testCase of testCases) {
        db.query.mockResolvedValue({ rows: [] });

        const mockReq = {
          headers: { 'user-agent': testCase.userAgent },
          ip: '127.0.0.1'
        };

        await sessionsRouter.createSession('user-1', mockReq);

        // Check the device_info parameter in the last db.query call
        const lastCall = db.query.mock.calls[db.query.mock.calls.length - 1];
        expect(lastCall[1][2]).toBe(testCase.expected);
      }
    });

    it('should handle missing user agent', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const mockReq = {
        headers: {},
        ip: '127.0.0.1'
      };

      await sessionsRouter.createSession('user-1', mockReq);

      const lastCall = db.query.mock.calls[db.query.mock.calls.length - 1];
      expect(lastCall[1][2]).toBe('Unknown Device');
    });
  });
});
