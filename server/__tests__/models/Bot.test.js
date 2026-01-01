/**
 * Bot Model Tests
 * Tests for server/models/Bot.js
 */

// Mock the database BEFORE importing the model
jest.mock('../../db', () => ({
  query: jest.fn()
}));

const db = require('../../db');
const Bot = require('../../models/Bot');

describe('Bot Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // create()
  // ========================================
  describe('create()', () => {
    it('should create a new bot with all required fields', async () => {
      const mockBotRow = {
        id: 1,
        name: 'Test Bot',
        description: 'A test bot',
        user_id: 10,
        organization_id: 5,
        settings: '{}',
        is_active: true
      };

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // INSERT
        .mockResolvedValueOnce({ rows: [mockBotRow] }); // SELECT for findById

      const result = await Bot.create({
        name: 'Test Bot',
        description: 'A test bot',
        user_id: 10,
        organization_id: 5
      });

      expect(result.id).toBe(1);
      expect(result.name).toBe('Test Bot');
      expect(db.query).toHaveBeenCalledTimes(2);
    });

    it('should create bot with null description if not provided', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, settings: '{}' }] });

      await Bot.create({
        name: 'Test Bot',
        user_id: 10,
        organization_id: 5
      });

      const insertCall = db.query.mock.calls[0];
      expect(insertCall[1][1]).toBeNull(); // description should be null
    });

    it('should set is_active to true by default', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, is_active: true, settings: '{}' }] });

      await Bot.create({
        name: 'Test Bot',
        user_id: 10,
        organization_id: 5
      });

      const insertCall = db.query.mock.calls[0];
      expect(insertCall[1][5]).toBe(true); // is_active should be true
    });

    it('should allow is_active to be set to false', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, is_active: false, settings: '{}' }] });

      await Bot.create({
        name: 'Test Bot',
        user_id: 10,
        organization_id: 5,
        is_active: false
      });

      const insertCall = db.query.mock.calls[0];
      expect(insertCall[1][5]).toBe(false);
    });

    it('should stringify settings object', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, settings: '{"key":"value"}' }] });

      await Bot.create({
        name: 'Test Bot',
        user_id: 10,
        organization_id: 5,
        settings: { key: 'value' }
      });

      const insertCall = db.query.mock.calls[0];
      expect(insertCall[1][4]).toBe('{"key":"value"}');
    });

    it('should use empty object for settings if not provided', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, settings: '{}' }] });

      await Bot.create({
        name: 'Test Bot',
        user_id: 10,
        organization_id: 5
      });

      const insertCall = db.query.mock.calls[0];
      expect(insertCall[1][4]).toBe('{}');
    });
  });

  // ========================================
  // findById()
  // ========================================
  describe('findById()', () => {
    it('should return bot if found', async () => {
      const mockBot = {
        id: 1,
        name: 'Test Bot',
        settings: '{"theme":"dark"}'
      };
      db.query.mockResolvedValueOnce({ rows: [mockBot] });

      const result = await Bot.findById(1);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Test Bot');
      expect(result.settings).toEqual({ theme: 'dark' });
      expect(db.query).toHaveBeenCalledWith('SELECT * FROM bots WHERE id = $1', [1]);
    });

    it('should return null if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Bot.findById(999);

      expect(result).toBeNull();
    });

    it('should parse JSON settings', async () => {
      const mockBot = {
        id: 1,
        name: 'Test Bot',
        settings: '{"a":1,"b":2}'
      };
      db.query.mockResolvedValueOnce({ rows: [mockBot] });

      const result = await Bot.findById(1);

      expect(result.settings).toEqual({ a: 1, b: 2 });
      expect(typeof result.settings).toBe('object');
    });
  });

  // ========================================
  // findAll()
  // ========================================
  describe('findAll()', () => {
    it('should return all bots with default pagination', async () => {
      const mockBots = [
        { id: 1, name: 'Bot 1', settings: '{}' },
        { id: 2, name: 'Bot 2', settings: '{}' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockBots });

      const result = await Bot.findAll();

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('deleted_at IS NULL'),
        [10, 0] // default limit and offset
      );
    });

    it('should support custom pagination', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Bot.findAll({ limit: 20, offset: 10 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [20, 10]
      );
    });

    it('should return empty array if no bots', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Bot.findAll();

      expect(result).toEqual([]);
    });

    it('should parse settings for all bots', async () => {
      const mockBots = [
        { id: 1, settings: '{"a":1}' },
        { id: 2, settings: '{"b":2}' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockBots });

      const result = await Bot.findAll();

      expect(result[0].settings).toEqual({ a: 1 });
      expect(result[1].settings).toEqual({ b: 2 });
    });
  });

  // ========================================
  // findByOrganization()
  // ========================================
  describe('findByOrganization()', () => {
    it('should return bots for a specific organization', async () => {
      const mockBots = [
        { id: 1, organization_id: 5, name: 'Org Bot 1', settings: '{}' },
        { id: 2, organization_id: 5, name: 'Org Bot 2', settings: '{}' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockBots });

      const result = await Bot.findByOrganization(5);

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('organization_id = $1'),
        [5, 10, 0]
      );
    });

    it('should support pagination for organization bots', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Bot.findByOrganization(5, { limit: 15, offset: 5 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [5, 15, 5]
      );
    });

    it('should return empty array if organization has no bots', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Bot.findByOrganization(999);

      expect(result).toEqual([]);
    });
  });

  // ========================================
  // findByUser()
  // ========================================
  describe('findByUser()', () => {
    it('should return bots for a specific user', async () => {
      const mockBots = [
        { id: 1, user_id: 10, name: 'User Bot 1', settings: '{}' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockBots });

      const result = await Bot.findByUser(10);

      expect(result).toHaveLength(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('user_id = $1'),
        [10, 10, 0]
      );
    });

    it('should support pagination for user bots', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Bot.findByUser(10, { limit: 25, offset: 10 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [10, 25, 10]
      );
    });
  });

  // ========================================
  // search()
  // ========================================
  describe('search()', () => {
    it('should search bots by name', async () => {
      const mockBots = [
        { id: 1, name: 'Customer Support Bot', settings: '{}' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockBots });

      const result = await Bot.search('customer');

      expect(result).toHaveLength(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('name ILIKE $1'),
        ['%customer%', 10, 0]
      );
    });

    it('should be case-insensitive', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Bot.search('CUSTOMER');

      expect(db.query.mock.calls[0][1][0]).toBe('%CUSTOMER%');
    });

    it('should support pagination for search results', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Bot.search('test', { limit: 5, offset: 2 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        ['%test%', 5, 2]
      );
    });

    it('should return empty array if no matches', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Bot.search('nonexistent');

      expect(result).toEqual([]);
    });
  });

  // ========================================
  // update()
  // ========================================
  describe('update()', () => {
    it('should update bot name', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Updated Bot', settings: '{}' }] }); // SELECT

      const result = await Bot.update(1, { name: 'Updated Bot' });

      expect(result.name).toBe('Updated Bot');
      expect(db.query.mock.calls[0][0]).toContain('name = $1');
    });

    it('should update bot description', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, description: 'New description', settings: '{}' }] });

      await Bot.update(1, { description: 'New description' });

      expect(db.query.mock.calls[0][0]).toContain('description = $1');
    });

    it('should update multiple fields', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, settings: '{}' }] });

      await Bot.update(1, {
        name: 'Updated',
        description: 'New desc',
        is_active: false
      });

      const updateQuery = db.query.mock.calls[0][0];
      expect(updateQuery).toContain('name = $1');
      expect(updateQuery).toContain('description = $2');
      expect(updateQuery).toContain('is_active = $3');
    });

    it('should update settings', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, settings: '{"new":"settings"}' }] });

      await Bot.update(1, { settings: { new: 'settings' } });

      expect(db.query.mock.calls[0][1]).toContain('{"new":"settings"}');
    });

    it('should update is_active status', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, is_active: false, settings: '{}' }] });

      await Bot.update(1, { is_active: false });

      const updateValues = db.query.mock.calls[0][1];
      expect(updateValues).toContain(false);
    });

    it('should not update if no fields provided', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, settings: '{}' }] });

      await Bot.update(1, {});

      expect(db.query).toHaveBeenCalledTimes(1); // Only SELECT, no UPDATE
    });

    it('should always update updated_at timestamp', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, settings: '{}' }] });

      await Bot.update(1, { name: 'Test' });

      expect(db.query.mock.calls[0][0]).toContain('updated_at = NOW()');
    });
  });

  // ========================================
  // delete()
  // ========================================
  describe('delete()', () => {
    it('should soft delete bot by id', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });

      await Bot.delete(1);

      expect(db.query).toHaveBeenCalledWith(
        'UPDATE bots SET deleted_at = NOW() WHERE id = $1',
        [1]
      );
    });

    it('should handle deletion of non-existent bot', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 0 });

      await Bot.delete(999);

      expect(db.query).toHaveBeenCalledTimes(1);
    });
  });

  // ========================================
  // countByOrganization()
  // ========================================
  describe('countByOrganization()', () => {
    it('should return count of bots for organization', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '5' }] });

      const result = await Bot.countByOrganization(1);

      expect(result).toBe(5);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)'),
        [1]
      );
    });

    it('should return 0 if organization has no bots', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const result = await Bot.countByOrganization(999);

      expect(result).toBe(0);
    });

    it('should exclude deleted bots from count', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '3' }] });

      await Bot.countByOrganization(1);

      expect(db.query.mock.calls[0][0]).toContain('deleted_at IS NULL');
    });
  });

  // ========================================
  // parseBot()
  // ========================================
  describe('parseBot()', () => {
    it('should parse JSON string settings', () => {
      const raw = {
        id: 1,
        name: 'Test Bot',
        settings: '{"key":"value"}'
      };

      const result = Bot.parseBot(raw);

      expect(result.settings).toEqual({ key: 'value' });
      expect(typeof result.settings).toBe('object');
    });

    it('should handle already parsed settings', () => {
      const raw = {
        id: 1,
        name: 'Test Bot',
        settings: { key: 'value' }
      };

      const result = Bot.parseBot(raw);

      expect(result.settings).toEqual({ key: 'value' });
    });

    it('should default to empty object for null/undefined settings', () => {
      const raw = {
        id: 1,
        name: 'Test Bot',
        settings: null
      };

      const result = Bot.parseBot(raw);

      expect(result.settings).toEqual({});
    });

    it('should preserve all other fields', () => {
      const raw = {
        id: 1,
        name: 'Test Bot',
        description: 'Description',
        user_id: 10,
        organization_id: 5,
        is_active: true,
        settings: '{}'
      };

      const result = Bot.parseBot(raw);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Test Bot');
      expect(result.description).toBe('Description');
      expect(result.user_id).toBe(10);
      expect(result.organization_id).toBe(5);
      expect(result.is_active).toBe(true);
    });
  });

  // ========================================
  // Error Handling
  // ========================================
  describe('Error Handling', () => {
    it('should propagate database errors on create', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(Bot.create({
        name: 'Test Bot',
        user_id: 10,
        organization_id: 5
      })).rejects.toThrow('Database error');
    });

    it('should propagate database errors on findById', async () => {
      db.query.mockRejectedValueOnce(new Error('Connection error'));

      await expect(Bot.findById(1)).rejects.toThrow('Connection error');
    });

    it('should propagate database errors on update', async () => {
      db.query.mockRejectedValueOnce(new Error('Update failed'));

      await expect(Bot.update(1, { name: 'Test' })).rejects.toThrow('Update failed');
    });

    it('should propagate database errors on delete', async () => {
      db.query.mockRejectedValueOnce(new Error('Delete failed'));

      await expect(Bot.delete(1)).rejects.toThrow('Delete failed');
    });
  });

  // ========================================
  // Validation Tests
  // ========================================
  describe('Validation', () => {
    it('should handle empty name gracefully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: '', settings: '{}' }] });

      const result = await Bot.create({
        name: '',
        user_id: 10,
        organization_id: 5
      });

      expect(result.name).toBe('');
    });

    it('should handle special characters in name', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot <>&"', settings: '{}' }] });

      const result = await Bot.create({
        name: 'Bot <>&"',
        user_id: 10,
        organization_id: 5
      });

      expect(result.name).toBe('Bot <>&"');
    });

    it('should handle complex settings object', async () => {
      const complexSettings = {
        theme: 'dark',
        features: ['chat', 'voice'],
        config: { timeout: 3000 }
      };

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, settings: JSON.stringify(complexSettings) }] });

      const result = await Bot.create({
        name: 'Test Bot',
        user_id: 10,
        organization_id: 5,
        settings: complexSettings
      });

      expect(result.settings).toEqual(complexSettings);
    });
  });
});
