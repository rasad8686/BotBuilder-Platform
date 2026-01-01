/**
 * Audit Service Tests
 * Comprehensive tests for server/services/auditService.js
 *
 * Test Coverage:
 * - logAction - create audit log entry
 * - getAuditLogs - list logs with pagination
 * - filterByAction - filter by action type
 * - filterByUser - filter by user
 * - filterByResource - filter by resource
 * - exportLogs - export to CSV/JSON
 * - retentionPolicy - log cleanup
 * - sensitiveDataMasking - hide sensitive info
 * - Error handling
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

jest.mock('json2csv', () => ({
  Parser: jest.fn().mockImplementation(() => ({
    parse: jest.fn((data) => 'id,action,user_id\n1,test.action,123')
  }))
}));

const db = require('../../db');
const logger = require('../../utils/logger');
const AuditService = require('../../services/auditService');

describe('AuditService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logAction', () => {
    it('should create audit log entry with all fields', async () => {
      const mockResult = {
        rows: [{
          id: 1,
          user_id: 123,
          organization_id: 456,
          action: 'user.login',
          resource_type: 'user',
          resource_id: 123,
          created_at: new Date()
        }]
      };

      db.query.mockResolvedValue(mockResult);

      const result = await AuditService.logAction({
        userId: 123,
        organizationId: 456,
        action: 'user.login',
        resourceType: 'user',
        resourceId: 123,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        metadata: { source: 'web' }
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([123, 456, 'user.login', 'user', 123])
      );
      expect(logger.audit).toHaveBeenCalledWith('user.login', expect.any(Object));
      expect(result).toEqual(mockResult.rows[0]);
    });

    it('should handle minimal required fields', async () => {
      const mockResult = {
        rows: [{
          id: 1,
          action: 'test.action',
          resource_type: 'test'
        }]
      };

      db.query.mockResolvedValue(mockResult);

      const result = await AuditService.logAction({
        action: 'test.action',
        resourceType: 'test'
      });

      expect(db.query).toHaveBeenCalled();
      expect(result).toEqual(mockResult.rows[0]);
    });

    it('should mask sensitive data in oldValues', async () => {
      const mockResult = { rows: [{ id: 1 }] };
      db.query.mockResolvedValue(mockResult);

      await AuditService.logAction({
        action: 'user.updated',
        resourceType: 'user',
        oldValues: {
          email: 'test@example.com',
          password: 'secret123',
          name: 'John Doe'
        }
      });

      const queryArgs = db.query.mock.calls[0][1];
      const oldValues = JSON.parse(queryArgs[5]);

      expect(oldValues.password).toBe('***MASKED***');
      expect(oldValues.email).toBe('test@example.com');
      expect(oldValues.name).toBe('John Doe');
    });

    it('should mask sensitive data in newValues', async () => {
      const mockResult = { rows: [{ id: 1 }] };
      db.query.mockResolvedValue(mockResult);

      await AuditService.logAction({
        action: 'user.created',
        resourceType: 'user',
        newValues: {
          email: 'new@example.com',
          api_key: 'sk-1234567890',
          token: 'bearer-token-123'
        }
      });

      const queryArgs = db.query.mock.calls[0][1];
      const newValues = JSON.parse(queryArgs[6]);

      expect(newValues.api_key).toBe('***MASKED***');
      expect(newValues.token).toBe('***MASKED***');
      expect(newValues.email).toBe('new@example.com');
    });

    it('should mask sensitive data in metadata', async () => {
      const mockResult = { rows: [{ id: 1 }] };
      db.query.mockResolvedValue(mockResult);

      await AuditService.logAction({
        action: 'api.call',
        resourceType: 'api',
        metadata: {
          endpoint: '/api/users',
          secret: 'my-secret-key',
          requestId: 'req-123'
        }
      });

      const queryArgs = db.query.mock.calls[0][1];
      const metadata = JSON.parse(queryArgs[9]);

      expect(metadata.secret).toBe('***MASKED***');
      expect(metadata.endpoint).toBe('/api/users');
      expect(metadata.requestId).toBe('req-123');
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        AuditService.logAction({
          action: 'test.action',
          resourceType: 'test'
        })
      ).rejects.toThrow('Database connection failed');

      expect(logger.error).toHaveBeenCalledWith(
        'Audit logging failed',
        expect.objectContaining({
          error: 'Database connection failed'
        })
      );
    });

    it('should handle null values gracefully', async () => {
      const mockResult = { rows: [{ id: 1 }] };
      db.query.mockResolvedValue(mockResult);

      await AuditService.logAction({
        action: 'test.action',
        resourceType: 'test',
        oldValues: null,
        newValues: null,
        metadata: null
      });

      const queryArgs = db.query.mock.calls[0][1];
      expect(queryArgs[5]).toBeNull(); // oldValues
      expect(queryArgs[6]).toBeNull(); // newValues
      expect(queryArgs[9]).toBe('null'); // metadata (JSON.stringify(null))
    });

    it('should log action to Winston logger', async () => {
      const mockResult = { rows: [{ id: 1 }] };
      db.query.mockResolvedValue(mockResult);

      await AuditService.logAction({
        userId: 123,
        organizationId: 456,
        action: 'user.login',
        resourceType: 'user',
        ipAddress: '192.168.1.1'
      });

      expect(logger.audit).toHaveBeenCalledWith(
        'user.login',
        expect.objectContaining({
          userId: 123,
          organizationId: 456,
          resourceType: 'user',
          ipAddress: '192.168.1.1'
        })
      );
    });
  });

  describe('getAuditLogs', () => {
    it('should retrieve logs with default pagination', async () => {
      const mockLogs = [
        { id: 1, action: 'user.login', user_id: 123 },
        { id: 2, action: 'bot.created', user_id: 123 }
      ];

      db.query
        .mockResolvedValueOnce({ rows: [{ total: '2' }] }) // count query
        .mockResolvedValueOnce({ rows: mockLogs }); // data query

      const result = await AuditService.getAuditLogs();

      expect(result.logs).toEqual(mockLogs);
      expect(result.pagination).toEqual({
        total: 2,
        limit: 50,
        offset: 0,
        pages: 1
      });
    });

    it('should filter by organization ID', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await AuditService.getAuditLogs({ organizationId: 456 });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('organization_id = $1'),
        expect.arrayContaining([456])
      );
    });

    it('should filter by user ID', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await AuditService.getAuditLogs({ userId: 123 });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('user_id = $1'),
        expect.arrayContaining([123])
      );
    });

    it('should filter by action type', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await AuditService.getAuditLogs({ action: 'user.login' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('action = $1'),
        expect.arrayContaining(['user.login'])
      );
    });

    it('should filter by resource type', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await AuditService.getAuditLogs({ resourceType: 'bot' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('resource_type = $1'),
        expect.arrayContaining(['bot'])
      );
    });

    it('should filter by resource ID', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await AuditService.getAuditLogs({ resourceType: 'bot', resourceId: 789 });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('resource_id = $2'),
        expect.arrayContaining(['bot', 789])
      );
    });

    it('should filter by date range', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const startDate = '2024-01-01';
      const endDate = '2024-12-31';

      await AuditService.getAuditLogs({ startDate, endDate });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('created_at >= $1'),
        expect.arrayContaining([startDate, endDate])
      );
    });

    it('should filter by IP address', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await AuditService.getAuditLogs({ ipAddress: '192.168.1.1' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ip_address = $1'),
        expect.arrayContaining(['192.168.1.1'])
      );
    });

    it('should apply custom pagination', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '100' }] })
        .mockResolvedValueOnce({ rows: [] });

      await AuditService.getAuditLogs({ limit: 25, offset: 50 });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $1 OFFSET $2'),
        expect.arrayContaining([25, 50])
      );
    });

    it('should calculate pagination correctly', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '127' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await AuditService.getAuditLogs({ limit: 20 });

      expect(result.pagination.pages).toBe(7); // ceil(127/20)
    });

    it('should sort by created_at DESC by default', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [] });

      await AuditService.getAuditLogs();

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY al.created_at DESC'),
        expect.any(Array)
      );
    });

    it('should support custom sorting', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [] });

      await AuditService.getAuditLogs({ sortBy: 'action', sortOrder: 'ASC' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY al.action ASC'),
        expect.any(Array)
      );
    });

    it('should sanitize sort column to prevent SQL injection', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [] });

      await AuditService.getAuditLogs({ sortBy: 'invalid; DROP TABLE users;' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY al.created_at'),
        expect.any(Array)
      );
    });

    it('should sanitize sort order to prevent SQL injection', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [] });

      await AuditService.getAuditLogs({ sortOrder: 'DESC; DROP TABLE users;' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('DESC'),
        expect.any(Array)
      );
    });

    it('should join with users table for user info', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [] });

      await AuditService.getAuditLogs();

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LEFT JOIN users u ON al.user_id = u.id'),
        expect.any(Array)
      );
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValue(new Error('Connection timeout'));

      await expect(AuditService.getAuditLogs()).rejects.toThrow('Connection timeout');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should combine multiple filters', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await AuditService.getAuditLogs({
        organizationId: 456,
        userId: 123,
        action: 'bot.created',
        startDate: '2024-01-01'
      });

      const query = db.query.mock.calls[0][0];
      expect(query).toContain('organization_id = $1');
      expect(query).toContain('user_id = $2');
      expect(query).toContain('action = $3');
      expect(query).toContain('created_at >= $4');
    });
  });

  describe('filterByAction', () => {
    it('should filter logs by action type', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '2' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });

      const result = await AuditService.filterByAction('user.login');

      expect(result.logs).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('action = $1'),
        expect.arrayContaining(['user.login'])
      );
    });

    it('should accept additional filter options', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await AuditService.filterByAction('bot.created', {
        organizationId: 456,
        limit: 10
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('organization_id'),
        expect.arrayContaining(['bot.created', 456])
      );
    });
  });

  describe('filterByUser', () => {
    it('should filter logs by user ID', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '3' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }, { id: 3 }] });

      const result = await AuditService.filterByUser(123);

      expect(result.logs).toHaveLength(3);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('user_id = $1'),
        expect.arrayContaining([123])
      );
    });

    it('should accept additional filter options', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await AuditService.filterByUser(123, {
        action: 'user.login',
        startDate: '2024-01-01'
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('user_id'),
        expect.arrayContaining([123, 'user.login', '2024-01-01'])
      );
    });
  });

  describe('filterByResource', () => {
    it('should filter logs by resource type and ID', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '2' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });

      const result = await AuditService.filterByResource('bot', 789);

      expect(result.logs).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('resource_type = $1'),
        expect.arrayContaining(['bot', 789])
      );
    });

    it('should accept additional filter options', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await AuditService.filterByResource('organization', 456, {
        userId: 123
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('resource_type'),
        expect.arrayContaining(['organization', 456, 123])
      );
    });
  });

  describe('exportLogs', () => {
    const mockLogs = [
      {
        id: 1,
        user_id: 123,
        action: 'user.login',
        resource_type: 'user',
        created_at: '2024-01-01T00:00:00Z'
      },
      {
        id: 2,
        user_id: 123,
        action: 'bot.created',
        resource_type: 'bot',
        created_at: '2024-01-02T00:00:00Z'
      }
    ];

    beforeEach(() => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '2' }] })
        .mockResolvedValueOnce({ rows: mockLogs });
    });

    it('should export logs to JSON format', async () => {
      const result = await AuditService.exportLogs('json');

      expect(result).toContain('"id": 1');
      expect(result).toContain('"action": "user.login"');
      expect(JSON.parse(result)).toEqual(mockLogs);
    });

    it('should export logs to CSV format', async () => {
      const result = await AuditService.exportLogs('csv');

      expect(result).toContain('id,action,user_id');
    });

    it('should use large limit for export', async () => {
      await AuditService.exportLogs('json');

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([100000, 0])
      );
    });

    it('should apply filters when exporting', async () => {
      await AuditService.exportLogs('json', {
        organizationId: 456,
        action: 'user.login'
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('organization_id'),
        expect.arrayContaining([456, 'user.login'])
      );
    });

    it('should throw error for unsupported format', async () => {
      await expect(
        AuditService.exportLogs('xml')
      ).rejects.toThrow('Unsupported export format: xml');
    });

    it('should default to JSON format', async () => {
      const result = await AuditService.exportLogs();

      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should handle export errors', async () => {
      db.query.mockReset().mockRejectedValue(new Error('Export failed'));

      await expect(
        AuditService.exportLogs('json')
      ).rejects.toThrow('Export failed');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to export audit logs',
        expect.objectContaining({ format: 'json' })
      );
    });
  });

  describe('applyRetentionPolicy', () => {
    it('should delete logs older than retention days', async () => {
      db.query.mockResolvedValue({ rowCount: 42 });

      const result = await AuditService.applyRetentionPolicy(90);

      expect(result).toBe(42);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("created_at < NOW() - INTERVAL '1 day' * $1"),
        expect.arrayContaining([90])
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('deleted 42 logs')
      );
    });

    it('should apply retention for specific organization', async () => {
      db.query.mockResolvedValue({ rowCount: 10 });

      await AuditService.applyRetentionPolicy(30, 456);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('organization_id = $2'),
        expect.arrayContaining([30, 456])
      );
    });

    it('should use default retention of 90 days', async () => {
      db.query.mockResolvedValue({ rowCount: 5 });

      await AuditService.applyRetentionPolicy();

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([90])
      );
    });

    it('should validate retention days is positive integer', async () => {
      await expect(
        AuditService.applyRetentionPolicy(-1)
      ).rejects.toThrow('Retention days must be a positive integer');

      await expect(
        AuditService.applyRetentionPolicy(0)
      ).rejects.toThrow('Retention days must be a positive integer');
    });

    it('should validate retention days is a number', async () => {
      await expect(
        AuditService.applyRetentionPolicy('invalid')
      ).rejects.toThrow('Retention days must be a positive integer');
    });

    it('should convert string numbers to integers', async () => {
      db.query.mockResolvedValue({ rowCount: 3 });

      await AuditService.applyRetentionPolicy('60');

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([60])
      );
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValue(new Error('Delete failed'));

      await expect(
        AuditService.applyRetentionPolicy(90)
      ).rejects.toThrow('Delete failed');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to apply retention policy',
        expect.any(Object)
      );
    });

    it('should return deleted count', async () => {
      db.query.mockResolvedValue({ rowCount: 100 });

      const count = await AuditService.applyRetentionPolicy(365);

      expect(count).toBe(100);
    });
  });

  describe('maskSensitiveData', () => {
    it('should mask password field', () => {
      const data = { username: 'john', password: 'secret123' };
      const masked = AuditService.maskSensitiveData(data);

      expect(masked.password).toBe('***MASKED***');
      expect(masked.username).toBe('john');
    });

    it('should mask api_key field', () => {
      const data = { name: 'Test', api_key: 'sk-1234567890' };
      const masked = AuditService.maskSensitiveData(data);

      expect(masked.api_key).toBe('***MASKED***');
      expect(masked.name).toBe('Test');
    });

    it('should mask token field', () => {
      const data = { token: 'bearer-token', userId: 123 };
      const masked = AuditService.maskSensitiveData(data);

      expect(masked.token).toBe('***MASKED***');
      expect(masked.userId).toBe(123);
    });

    it('should mask secret field', () => {
      const data = { secret: 'my-secret', public: 'data' };
      const masked = AuditService.maskSensitiveData(data);

      expect(masked.secret).toBe('***MASKED***');
      expect(masked.public).toBe('data');
    });

    it('should mask nested sensitive fields', () => {
      const data = {
        user: {
          name: 'John',
          password: 'secret',
          settings: {
            apiKey: 'sk-123'
          }
        }
      };
      const masked = AuditService.maskSensitiveData(data);

      expect(masked.user.password).toBe('***MASKED***');
      expect(masked.user.settings.apiKey).toBe('***MASKED***');
      expect(masked.user.name).toBe('John');
    });

    it('should handle arrays with sensitive data', () => {
      const data = [
        { name: 'User 1', token: 'token1' },
        { name: 'User 2', token: 'token2' }
      ];
      const masked = AuditService.maskSensitiveData(data);

      expect(masked[0].token).toBe('***MASKED***');
      expect(masked[1].token).toBe('***MASKED***');
      expect(masked[0].name).toBe('User 1');
    });

    it('should mask camelCase sensitive fields', () => {
      const data = {
        accessToken: 'token123',
        refreshToken: 'refresh123',
        privateKey: 'key123'
      };
      const masked = AuditService.maskSensitiveData(data);

      expect(masked.accessToken).toBe('***MASKED***');
      expect(masked.refreshToken).toBe('***MASKED***');
      expect(masked.privateKey).toBe('***MASKED***');
    });

    it('should mask snake_case sensitive fields', () => {
      const data = {
        access_token: 'token123',
        refresh_token: 'refresh123',
        private_key: 'key123'
      };
      const masked = AuditService.maskSensitiveData(data);

      expect(masked.access_token).toBe('***MASKED***');
      expect(masked.refresh_token).toBe('***MASKED***');
      expect(masked.private_key).toBe('***MASKED***');
    });

    it('should handle null data', () => {
      const masked = AuditService.maskSensitiveData(null);
      expect(masked).toBeNull();
    });

    it('should handle undefined data', () => {
      const masked = AuditService.maskSensitiveData(undefined);
      expect(masked).toBeUndefined();
    });

    it('should handle primitive values', () => {
      expect(AuditService.maskSensitiveData('string')).toBe('string');
      expect(AuditService.maskSensitiveData(123)).toBe(123);
      expect(AuditService.maskSensitiveData(true)).toBe(true);
    });

    it('should not mutate original object', () => {
      const original = { password: 'secret', name: 'Test' };
      const masked = AuditService.maskSensitiveData(original);

      expect(original.password).toBe('secret');
      expect(masked.password).toBe('***MASKED***');
    });

    it('should mask credit_card fields', () => {
      const data = { credit_card: '4111111111111111', name: 'John' };
      const masked = AuditService.maskSensitiveData(data);

      expect(masked.credit_card).toBe('***MASKED***');
    });

    it('should mask ssn fields', () => {
      const data = { ssn: '123-45-6789', name: 'John' };
      const masked = AuditService.maskSensitiveData(data);

      expect(masked.ssn).toBe('***MASKED***');
    });

    it('should handle deeply nested objects', () => {
      const data = {
        level1: {
          level2: {
            level3: {
              password: 'secret',
              data: 'safe'
            }
          }
        }
      };
      const masked = AuditService.maskSensitiveData(data);

      expect(masked.level1.level2.level3.password).toBe('***MASKED***');
      expect(masked.level1.level2.level3.data).toBe('safe');
    });
  });

  describe('getStatistics', () => {
    it('should return audit statistics', async () => {
      const mockActionCounts = [
        { action: 'user.login', count: '50' },
        { action: 'bot.created', count: '20' }
      ];
      const mockResourceCounts = [
        { resource_type: 'user', count: '60' },
        { resource_type: 'bot', count: '30' }
      ];
      const mockUserActivity = [
        { user_id: 123, count: '40' },
        { user_id: 456, count: '30' }
      ];

      db.query
        .mockResolvedValueOnce({ rows: mockActionCounts })
        .mockResolvedValueOnce({ rows: mockResourceCounts })
        .mockResolvedValueOnce({ rows: mockUserActivity });

      const stats = await AuditService.getStatistics();

      expect(stats.actionCounts).toEqual(mockActionCounts);
      expect(stats.resourceCounts).toEqual(mockResourceCounts);
      expect(stats.topUsers).toEqual(mockUserActivity);
    });

    it('should filter statistics by organization', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await AuditService.getStatistics({ organizationId: 456 });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('organization_id = $1'),
        expect.arrayContaining([456])
      );
    });

    it('should filter statistics by date range', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await AuditService.getStatistics({
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('created_at >= $1'),
        expect.arrayContaining(['2024-01-01', '2024-12-31'])
      );
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValue(new Error('Stats query failed'));

      await expect(AuditService.getStatistics()).rejects.toThrow('Stats query failed');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('searchByMetadata', () => {
    it('should search logs by metadata', async () => {
      const mockLogs = [
        { id: 1, metadata: { source: 'web' } },
        { id: 2, metadata: { source: 'web' } }
      ];

      db.query.mockResolvedValue({ rows: mockLogs });

      const result = await AuditService.searchByMetadata({ source: 'web' });

      expect(result).toEqual(mockLogs);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('metadata @> $1::jsonb'),
        expect.arrayContaining([JSON.stringify({ source: 'web' })])
      );
    });

    it('should support pagination in metadata search', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await AuditService.searchByMetadata(
        { requestId: 'req-123' },
        { limit: 25, offset: 50 }
      );

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $2 OFFSET $3'),
        expect.arrayContaining([expect.any(String), 25, 50])
      );
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValue(new Error('Search failed'));

      await expect(
        AuditService.searchByMetadata({ key: 'value' })
      ).rejects.toThrow('Search failed');

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('should retrieve audit log by ID', async () => {
      const mockLog = {
        id: 1,
        action: 'user.login',
        user_name: 'John Doe',
        user_email: 'john@example.com'
      };

      db.query.mockResolvedValue({ rows: [mockLog] });

      const result = await AuditService.getById(1);

      expect(result).toEqual(mockLog);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE al.id = $1'),
        [1]
      );
    });

    it('should return undefined for non-existent ID', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await AuditService.getById(999);

      expect(result).toBeUndefined();
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValue(new Error('Query failed'));

      await expect(AuditService.getById(1)).rejects.toThrow('Query failed');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getRecent', () => {
    it('should get recent logs with default limit', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '10' }] })
        .mockResolvedValueOnce({ rows: new Array(10).fill({ id: 1 }) });

      const result = await AuditService.getRecent();

      expect(result.logs).toHaveLength(10);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $1'),
        expect.arrayContaining([10, 0])
      );
    });

    it('should support custom limit', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '5' }] })
        .mockResolvedValueOnce({ rows: new Array(5).fill({ id: 1 }) });

      await AuditService.getRecent(5);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([5, 0])
      );
    });

    it('should filter by organization', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '3' }] })
        .mockResolvedValueOnce({ rows: [] });

      await AuditService.getRecent(10, 456);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('organization_id'),
        expect.arrayContaining([456])
      );
    });
  });

  describe('hasRecentAction', () => {
    it('should return true when user has recent action', async () => {
      db.query.mockResolvedValue({ rows: [{ count: '3' }] });

      const result = await AuditService.hasRecentAction(123, 'user.login', 5);

      expect(result).toBe(true);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("created_at >= NOW() - INTERVAL '1 minute' * $3"),
        [123, 'user.login', 5]
      );
    });

    it('should return false when user has no recent action', async () => {
      db.query.mockResolvedValue({ rows: [{ count: '0' }] });

      const result = await AuditService.hasRecentAction(123, 'bot.deleted', 10);

      expect(result).toBe(false);
    });

    it('should use default time window of 5 minutes', async () => {
      db.query.mockResolvedValue({ rows: [{ count: '1' }] });

      await AuditService.hasRecentAction(123, 'user.login');

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([123, 'user.login', 5])
      );
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValue(new Error('Check failed'));

      await expect(
        AuditService.hasRecentAction(123, 'test.action')
      ).rejects.toThrow('Check failed');

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty result sets', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await AuditService.getAuditLogs();

      expect(result.logs).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('should handle very large datasets', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '1000000' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await AuditService.getAuditLogs({ limit: 100 });

      expect(result.pagination.pages).toBe(10000);
    });

    it('should handle concurrent log writes', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1 }] });

      const promises = Array.from({ length: 10 }, (_, i) =>
        AuditService.logAction({
          action: `test.action.${i}`,
          resourceType: 'test'
        })
      );

      await Promise.all(promises);

      expect(db.query).toHaveBeenCalledTimes(10);
    });

    it('should handle special characters in filters', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [] });

      await AuditService.getAuditLogs({
        action: "user.login'; DROP TABLE audit_logs; --"
      });

      // Should use parameterized query, not inject SQL
      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(["user.login'; DROP TABLE audit_logs; --"])
      );
    });

    it('should handle timezone-aware date filters', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [] });

      const startDate = new Date('2024-01-01T00:00:00Z');
      await AuditService.getAuditLogs({ startDate });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('created_at >= $1'),
        expect.arrayContaining([startDate])
      );
    });
  });
});
