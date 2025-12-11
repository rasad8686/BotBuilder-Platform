/**
 * Tool Model Tests
 * Tests for server/models/Tool.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

const db = require('../../db');
const Tool = require('../../models/Tool');

describe('Tool Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('should create tool with all fields', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // INSERT
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Calculator', configuration: '{}' }] }); // findById

      const result = await Tool.create({
        bot_id: 1,
        name: 'Calculator',
        description: 'Math operations',
        tool_type: 'function',
        configuration: { precision: 2 },
        input_schema: { type: 'object' },
        output_schema: { type: 'number' }
      });

      expect(result.id).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tools'),
        expect.arrayContaining([1, 'Calculator', 'Math operations', 'function'])
      );
    });

    it('should use default values for optional fields', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, configuration: '{}' }] });

      await Tool.create({
        bot_id: 1,
        name: 'Tool',
        tool_type: 'api'
      });

      const insertValues = db.query.mock.calls[0][1];
      expect(insertValues).toContain(null); // description
      expect(insertValues).toContain('{}'); // default configuration
      expect(insertValues).toContain(true); // is_active default
    });

    it('should stringify configuration object', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, configuration: '{"key":"value"}' }] });

      await Tool.create({
        bot_id: 1,
        name: 'Tool',
        tool_type: 'api',
        configuration: { key: 'value' }
      });

      const insertValues = db.query.mock.calls[0][1];
      expect(insertValues).toContain('{"key":"value"}');
    });

    it('should allow is_active to be false', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, is_active: false, configuration: '{}' }] });

      await Tool.create({
        bot_id: 1,
        name: 'Tool',
        tool_type: 'api',
        is_active: false
      });

      const insertValues = db.query.mock.calls[0][1];
      expect(insertValues).toContain(false);
    });
  });

  describe('findById()', () => {
    it('should return tool if found', async () => {
      const mockTool = { id: 1, name: 'Calculator', configuration: '{}', input_schema: null, output_schema: null };
      db.query.mockResolvedValueOnce({ rows: [mockTool] });

      const result = await Tool.findById(1);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Calculator');
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Tool.findById(999);

      expect(result).toBeNull();
    });

    it('should parse JSON configuration', async () => {
      const mockTool = { id: 1, configuration: '{"key":"value"}', input_schema: null, output_schema: null };
      db.query.mockResolvedValueOnce({ rows: [mockTool] });

      const result = await Tool.findById(1);

      expect(result.configuration).toEqual({ key: 'value' });
    });
  });

  describe('findByBotId()', () => {
    it('should return all tools for bot', async () => {
      const mockTools = [
        { id: 1, bot_id: 1, name: 'Tool 1', configuration: '{}', input_schema: null, output_schema: null },
        { id: 2, bot_id: 1, name: 'Tool 2', configuration: '{}', input_schema: null, output_schema: null }
      ];
      db.query.mockResolvedValueOnce({ rows: mockTools });

      const result = await Tool.findByBotId(1);

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('bot_id = $1'),
        [1]
      );
    });

    it('should return empty array if no tools', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Tool.findByBotId(999);

      expect(result).toEqual([]);
    });
  });

  describe('findActiveByBotId()', () => {
    it('should return only active tools', async () => {
      const mockTools = [
        { id: 1, is_active: true, configuration: '{}', input_schema: null, output_schema: null }
      ];
      db.query.mockResolvedValueOnce({ rows: mockTools });

      const result = await Tool.findActiveByBotId(1);

      expect(result).toHaveLength(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('is_active = true'),
        [1]
      );
    });
  });

  describe('findByType()', () => {
    it('should return tools by type', async () => {
      const mockTools = [
        { id: 1, tool_type: 'api', configuration: '{}', input_schema: null, output_schema: null }
      ];
      db.query.mockResolvedValueOnce({ rows: mockTools });

      const result = await Tool.findByType(1, 'api');

      expect(result).toHaveLength(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('tool_type = $2'),
        [1, 'api']
      );
    });
  });

  describe('update()', () => {
    it('should update tool name', async () => {
      db.query
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Updated', configuration: '{}', input_schema: null, output_schema: null }] });

      const result = await Tool.update(1, { name: 'Updated' });

      expect(result.name).toBe('Updated');
      expect(db.query.mock.calls[0][0]).toContain('name = $1');
    });

    it('should update multiple fields', async () => {
      db.query
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 1, configuration: '{}', input_schema: null, output_schema: null }] });

      await Tool.update(1, {
        name: 'Updated',
        description: 'New desc',
        tool_type: 'function'
      });

      const updateQuery = db.query.mock.calls[0][0];
      expect(updateQuery).toContain('name = $1');
      expect(updateQuery).toContain('description = $2');
      expect(updateQuery).toContain('tool_type = $3');
    });

    it('should stringify configuration on update', async () => {
      db.query
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 1, configuration: '{"new":"config"}', input_schema: null, output_schema: null }] });

      await Tool.update(1, { configuration: { new: 'config' } });

      expect(db.query.mock.calls[0][1]).toContain('{"new":"config"}');
    });

    it('should stringify input_schema on update', async () => {
      db.query
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 1, configuration: '{}', input_schema: '{"type":"object"}', output_schema: null }] });

      await Tool.update(1, { input_schema: { type: 'object' } });

      expect(db.query.mock.calls[0][1]).toContain('{"type":"object"}');
    });

    it('should stringify output_schema on update', async () => {
      db.query
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 1, configuration: '{}', input_schema: null, output_schema: '{"type":"string"}' }] });

      await Tool.update(1, { output_schema: { type: 'string' } });

      expect(db.query.mock.calls[0][1]).toContain('{"type":"string"}');
    });

    it('should update is_active', async () => {
      db.query
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 1, is_active: false, configuration: '{}', input_schema: null, output_schema: null }] });

      await Tool.update(1, { is_active: false });

      expect(db.query.mock.calls[0][1]).toContain(false);
    });
  });

  describe('delete()', () => {
    it('should delete tool', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });

      await Tool.delete(1);

      expect(db.query).toHaveBeenCalledWith(
        'DELETE FROM tools WHERE id = $1',
        [1]
      );
    });
  });

  describe('parseTool()', () => {
    it('should parse JSON string configuration', () => {
      const raw = {
        id: 1,
        configuration: '{"key":"value"}',
        input_schema: '{"type":"object"}',
        output_schema: '{"type":"string"}'
      };

      const result = Tool.parseTool(raw);

      expect(result.configuration).toEqual({ key: 'value' });
      expect(result.input_schema).toEqual({ type: 'object' });
      expect(result.output_schema).toEqual({ type: 'string' });
    });

    it('should handle already parsed configuration', () => {
      const raw = {
        id: 1,
        configuration: { key: 'value' },
        input_schema: { type: 'object' },
        output_schema: null
      };

      const result = Tool.parseTool(raw);

      expect(result.configuration).toEqual({ key: 'value' });
      expect(result.input_schema).toEqual({ type: 'object' });
    });

    it('should default to empty object for null configuration', () => {
      const raw = {
        id: 1,
        configuration: null,
        input_schema: null,
        output_schema: null
      };

      const result = Tool.parseTool(raw);

      expect(result.configuration).toEqual({});
    });

    it('should preserve other fields', () => {
      const raw = {
        id: 1,
        name: 'Test',
        tool_type: 'api',
        configuration: '{}',
        input_schema: null,
        output_schema: null
      };

      const result = Tool.parseTool(raw);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Test');
      expect(result.tool_type).toBe('api');
    });
  });
});
