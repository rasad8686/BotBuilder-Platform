/**
 * ToolRegistry Tests
 * Tests for server/tools/core/ToolRegistry.js
 */

jest.mock('../../../db', () => ({
  query: jest.fn()
}));

const ToolRegistry = require('../../../tools/core/ToolRegistry');
const db = require('../../../db');

describe('ToolRegistry', () => {
  let registry;

  beforeEach(() => {
    jest.clearAllMocks();
    registry = new ToolRegistry();
  });

  describe('constructor', () => {
    it('should initialize with empty cache', () => {
      expect(registry.cache.size).toBe(0);
    });
  });

  describe('register', () => {
    it('should create tool in database', async () => {
      const tool = {
        bot_id: 1,
        name: 'SearchTool',
        description: 'Search the web',
        tool_type: 'http',
        configuration: { endpoint: 'https://api.example.com' },
        input_schema: { type: 'object' },
        output_schema: { type: 'object' }
      };

      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          ...tool,
          configuration: JSON.stringify(tool.configuration),
          input_schema: JSON.stringify(tool.input_schema),
          output_schema: JSON.stringify(tool.output_schema),
          is_active: true
        }]
      });

      const result = await registry.register(tool);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tools'),
        expect.arrayContaining([1, 'SearchTool', 'Search the web', 'http'])
      );
      expect(result.id).toBe(1);
      expect(result.name).toBe('SearchTool');
    });

    it('should cache created tool', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Tool', configuration: '{}' }]
      });

      await registry.register({ bot_id: 1, name: 'Tool', tool_type: 'http' });

      expect(registry.cache.has(1)).toBe(true);
    });

    it('should default is_active to true', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Tool', configuration: '{}' }]
      });

      await registry.register({ bot_id: 1, name: 'Tool', tool_type: 'http' });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([true])
      );
    });
  });

  describe('get', () => {
    it('should return cached tool', async () => {
      const cachedTool = { id: 1, name: 'CachedTool' };
      registry.cache.set(1, cachedTool);

      const result = await registry.get(1);

      expect(result).toBe(cachedTool);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should fetch from database if not cached', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'DBTool', configuration: '{}' }]
      });

      const result = await registry.get(1);

      expect(db.query).toHaveBeenCalledWith('SELECT * FROM tools WHERE id = $1', [1]);
      expect(result.name).toBe('DBTool');
    });

    it('should cache fetched tool', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'DBTool', configuration: '{}' }]
      });

      await registry.get(1);

      expect(registry.cache.has(1)).toBe(true);
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await registry.get(999);

      expect(result).toBeNull();
    });
  });

  describe('getByBot', () => {
    it('should return active tools for bot', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, name: 'Tool1', configuration: '{}' },
          { id: 2, name: 'Tool2', configuration: '{}' }
        ]
      });

      const result = await registry.getByBot(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('bot_id = $1'),
        [1]
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('getByAgent', () => {
    it('should return tools assigned to agent', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, name: 'Tool1', configuration: '{}', is_enabled: true, priority: 10 }
        ]
      });

      const result = await registry.getByAgent(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('agent_id = $1'),
        [1]
      );
      expect(result[0].is_enabled).toBe(true);
      expect(result[0].priority).toBe(10);
    });
  });

  describe('update', () => {
    it('should update tool fields', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // UPDATE
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Updated', configuration: '{}' }] }); // GET

      const result = await registry.update(1, {
        name: 'Updated',
        description: 'New description'
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE tools SET'),
        expect.arrayContaining(['Updated', 'New description'])
      );
    });

    it('should invalidate cache', async () => {
      registry.cache.set(1, { id: 1, name: 'Old' });
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'New', configuration: '{}' }] });

      await registry.update(1, { name: 'New' });

      // Cache should be refreshed with new value
      expect(registry.cache.get(1).name).toBe('New');
    });

    it('should handle all update fields', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1, configuration: '{}' }] });

      await registry.update(1, {
        name: 'Name',
        description: 'Desc',
        tool_type: 'http',
        configuration: { key: 'value' },
        input_schema: { type: 'object' },
        output_schema: { type: 'object' },
        is_active: false
      });

      expect(db.query).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete tool from database', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await registry.delete(1);

      expect(db.query).toHaveBeenCalledWith(
        'DELETE FROM tools WHERE id = $1',
        [1]
      );
    });

    it('should remove from cache', async () => {
      registry.cache.set(1, { id: 1 });
      db.query.mockResolvedValue({ rows: [] });

      await registry.delete(1);

      expect(registry.cache.has(1)).toBe(false);
    });
  });

  describe('assignToAgent', () => {
    it('should create assignment', async () => {
      db.query.mockResolvedValue({
        rows: [{ agent_id: 1, tool_id: 2, is_enabled: true, priority: 5 }]
      });

      const result = await registry.assignToAgent(1, 2, { priority: 5 });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agent_tools'),
        [1, 2, true, 5]
      );
      expect(result.priority).toBe(5);
    });

    it('should default is_enabled to true', async () => {
      db.query.mockResolvedValue({ rows: [{}] });

      await registry.assignToAgent(1, 2, {});

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [1, 2, true, 0]
      );
    });

    it('should handle upsert on conflict', async () => {
      db.query.mockResolvedValue({ rows: [{}] });

      await registry.assignToAgent(1, 2);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        expect.any(Array)
      );
    });
  });

  describe('removeFromAgent', () => {
    it('should delete assignment', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await registry.removeFromAgent(1, 2);

      expect(db.query).toHaveBeenCalledWith(
        'DELETE FROM agent_tools WHERE agent_id = $1 AND tool_id = $2',
        [1, 2]
      );
    });
  });

  describe('clearCache', () => {
    it('should clear all cached tools', () => {
      registry.cache.set(1, { id: 1 });
      registry.cache.set(2, { id: 2 });

      registry.clearCache();

      expect(registry.cache.size).toBe(0);
    });
  });

  describe('parseTool', () => {
    it('should parse JSON string configuration', () => {
      const row = {
        id: 1,
        configuration: '{"key":"value"}',
        input_schema: '{"type":"object"}',
        output_schema: '{"type":"string"}'
      };

      const result = registry.parseTool(row);

      expect(result.configuration).toEqual({ key: 'value' });
      expect(result.input_schema).toEqual({ type: 'object' });
      expect(result.output_schema).toEqual({ type: 'string' });
    });

    it('should handle already parsed configuration', () => {
      const row = {
        id: 1,
        configuration: { key: 'value' },
        input_schema: { type: 'object' },
        output_schema: null
      };

      const result = registry.parseTool(row);

      expect(result.configuration).toEqual({ key: 'value' });
    });

    it('should default configuration to empty object', () => {
      const row = {
        id: 1,
        configuration: null,
        input_schema: null,
        output_schema: null
      };

      const result = registry.parseTool(row);

      expect(result.configuration).toEqual({});
    });
  });
});
