/**
 * ActivityLog Model Tests
 * Tests for server/models/ActivityLog.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

const db = require('../../db');
const ActivityLog = require('../../models/ActivityLog');

describe('ActivityLog Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('should create activity log with all fields', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await ActivityLog.create({
        tenantId: 1,
        userId: 1,
        action: 'create',
        entityType: 'bot',
        entityId: 5,
        changes: { name: 'Test Bot' },
        ipAddress: '192.168.1.1'
      });

      expect(result.id).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO activity_logs'),
        [1, 1, 'create', 'bot', 5, '{"name":"Test Bot"}', '192.168.1.1']
      );
    });

    it('should use default values for optional fields', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await ActivityLog.create({
        tenantId: 1,
        userId: 1,
        action: 'create',
        entityType: 'bot'
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [1, 1, 'create', 'bot', null, '{}', null]
      );
    });
  });

  describe('findByTenant()', () => {
    it('should return logs for tenant', async () => {
      const mockLogs = [{ id: 1 }, { id: 2 }];
      db.query.mockResolvedValueOnce({ rows: mockLogs });

      const result = await ActivityLog.findByTenant(1);

      expect(result).toHaveLength(2);
    });

    it('should filter by action', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await ActivityLog.findByTenant(1, { action: 'create' });

      expect(db.query.mock.calls[0][0]).toContain('action = $');
    });

    it('should filter by entityType', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await ActivityLog.findByTenant(1, { entityType: 'bot' });

      expect(db.query.mock.calls[0][0]).toContain('entity_type = $');
    });

    it('should filter by date range', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await ActivityLog.findByTenant(1, {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      });

      expect(db.query.mock.calls[0][0]).toContain('created_at >= $');
      expect(db.query.mock.calls[0][0]).toContain('created_at <= $');
    });

    it('should use custom limit and offset', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await ActivityLog.findByTenant(1, { limit: 10, offset: 20 });

      expect(db.query.mock.calls[0][1]).toContain(10);
      expect(db.query.mock.calls[0][1]).toContain(20);
    });
  });

  describe('findByEntity()', () => {
    it('should return logs for specific entity', async () => {
      const mockLogs = [{ id: 1, entity_id: 5 }];
      db.query.mockResolvedValueOnce({ rows: mockLogs });

      const result = await ActivityLog.findByEntity(1, 'bot', 5);

      expect(result).toHaveLength(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('entity_type = $2'),
        [1, 'bot', 5, 50, 0]
      );
    });

    it('should use custom limit and offset', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await ActivityLog.findByEntity(1, 'bot', 5, { limit: 10, offset: 20 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [1, 'bot', 5, 10, 20]
      );
    });
  });

  describe('findByUser()', () => {
    it('should return logs for user', async () => {
      const mockLogs = [{ id: 1, user_id: 1 }];
      db.query.mockResolvedValueOnce({ rows: mockLogs });

      const result = await ActivityLog.findByUser(1, 1);

      expect(result).toHaveLength(1);
    });

    it('should filter by action', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await ActivityLog.findByUser(1, 1, { action: 'delete' });

      expect(db.query.mock.calls[0][0]).toContain('action = $');
    });
  });

  describe('getRecent()', () => {
    it('should return recent logs', async () => {
      const mockLogs = [{ id: 1 }, { id: 2 }];
      db.query.mockResolvedValueOnce({ rows: mockLogs });

      const result = await ActivityLog.getRecent(1, 10);

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [1, 10]
      );
    });

    it('should use default limit of 10', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await ActivityLog.getRecent(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [1, 10]
      );
    });
  });

  describe('findById()', () => {
    it('should return log if found', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await ActivityLog.findById(1);

      expect(result.id).toBe(1);
    });

    it('should return undefined if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await ActivityLog.findById(999);

      expect(result).toBeUndefined();
    });
  });

  describe('countByTenant()', () => {
    it('should return count', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '100' }] });

      const result = await ActivityLog.countByTenant(1);

      expect(result).toBe(100);
    });

    it('should filter by action', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '10' }] });

      await ActivityLog.countByTenant(1, { action: 'create' });

      expect(db.query.mock.calls[0][0]).toContain('action = $');
    });

    it('should filter by entityType', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '5' }] });

      await ActivityLog.countByTenant(1, { entityType: 'bot' });

      expect(db.query.mock.calls[0][0]).toContain('entity_type = $');
    });

    it('should filter by date range', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '20' }] });

      await ActivityLog.countByTenant(1, {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      });

      expect(db.query.mock.calls[0][0]).toContain('created_at >= $');
      expect(db.query.mock.calls[0][0]).toContain('created_at <= $');
    });
  });

  describe('getStats()', () => {
    it('should return statistics', async () => {
      const mockStats = [
        { action: 'create', entity_type: 'bot', count: 10, date: '2024-01-01' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockStats });

      const result = await ActivityLog.getStats(1, 30);

      expect(result).toHaveLength(1);
      expect(db.query.mock.calls[0][0]).toContain('30 days');
    });

    it('should use default 30 days', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await ActivityLog.getStats(1);

      expect(db.query.mock.calls[0][0]).toContain('30 days');
    });
  });

  describe('deleteOld()', () => {
    it('should delete old logs', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 50 });

      const result = await ActivityLog.deleteOld(1, 90);

      expect(result).toBe(50);
      expect(db.query.mock.calls[0][0]).toContain('90 days');
    });

    it('should use default 90 days', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 10 });

      await ActivityLog.deleteOld(1);

      expect(db.query.mock.calls[0][0]).toContain('90 days');
    });
  });
});
