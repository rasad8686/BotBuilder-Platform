/**
 * ToolExecution Model Tests
 * Tests for server/models/ToolExecution.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

const db = require('../../db');
const ToolExecution = require('../../models/ToolExecution');

describe('ToolExecution Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('should create execution record with all fields', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, input: '{}', output: 'null' }] });

      const result = await ToolExecution.create({
        tool_id: 1,
        agent_id: 2,
        execution_id: 'exec_123',
        input: { param: 'value' },
        output: { result: 'success' },
        status: 'completed',
        duration_ms: 100
      });

      expect(result.id).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tool_executions'),
        expect.arrayContaining([1, 2, 'exec_123'])
      );
    });

    it('should stringify input and output', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, input: '{}', output: 'null' }] });

      await ToolExecution.create({
        tool_id: 1,
        input: { key: 'value' },
        output: { result: 'data' }
      });

      const insertValues = db.query.mock.calls[0][1];
      expect(insertValues[3]).toBe('{"key":"value"}');
      expect(insertValues[4]).toBe('{"result":"data"}');
    });

    it('should use default values', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, input: '{}', output: 'null' }] });

      await ToolExecution.create({ tool_id: 1 });

      const insertValues = db.query.mock.calls[0][1];
      expect(insertValues[1]).toBeNull(); // agent_id
      expect(insertValues[2]).toBeNull(); // execution_id
      expect(insertValues[5]).toBe('pending'); // status
    });
  });

  describe('findById()', () => {
    it('should return execution if found', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, input: '{}', output: 'null' }] });

      const result = await ToolExecution.findById(1);

      expect(result.id).toBe(1);
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await ToolExecution.findById(999);

      expect(result).toBeNull();
    });

    it('should parse JSON fields', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, input: '{"key":"value"}', output: '{"result":"data"}' }] });

      const result = await ToolExecution.findById(1);

      expect(result.input).toEqual({ key: 'value' });
      expect(result.output).toEqual({ result: 'data' });
    });
  });

  describe('findByToolId()', () => {
    it('should return executions for tool', async () => {
      const mockExecutions = [
        { id: 1, tool_id: 1, input: '{}', output: 'null' },
        { id: 2, tool_id: 1, input: '{}', output: 'null' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockExecutions });

      const result = await ToolExecution.findByToolId(1);

      expect(result).toHaveLength(2);
    });

    it('should use custom limit and offset', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await ToolExecution.findByToolId(1, { limit: 10, offset: 20 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [1, 10, 20]
      );
    });
  });

  describe('findByAgentId()', () => {
    it('should return executions for agent', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, agent_id: 1, input: '{}', output: 'null' }] });

      const result = await ToolExecution.findByAgentId(1);

      expect(result).toHaveLength(1);
    });
  });

  describe('findByExecutionId()', () => {
    it('should return executions for workflow execution', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, execution_id: 'exec_123', input: '{}', output: 'null' }] });

      const result = await ToolExecution.findByExecutionId('exec_123');

      expect(result).toHaveLength(1);
    });
  });

  describe('findByStatus()', () => {
    it('should return executions by status', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'failed', input: '{}', output: 'null' }] });

      const result = await ToolExecution.findByStatus('failed');

      expect(result).toHaveLength(1);
    });
  });

  describe('updateStatus()', () => {
    it('should update status', async () => {
      db.query
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'completed', input: '{}', output: 'null' }] });

      const result = await ToolExecution.updateStatus(1, 'completed');

      expect(result.status).toBe('completed');
    });

    it('should update with additional data', async () => {
      db.query
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 1, input: '{}', output: '{"result":"data"}' }] });

      await ToolExecution.updateStatus(1, 'completed', {
        output: { result: 'data' },
        duration_ms: 150,
        error: null
      });

      const updateQuery = db.query.mock.calls[0][0];
      expect(updateQuery).toContain('output = $');
      expect(updateQuery).toContain('duration_ms = $');
    });
  });

  describe('delete()', () => {
    it('should delete execution', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });

      await ToolExecution.delete(1);

      expect(db.query).toHaveBeenCalledWith(
        'DELETE FROM tool_executions WHERE id = $1',
        [1]
      );
    });
  });

  describe('deleteOlderThan()', () => {
    it('should delete old executions', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 100 });

      const result = await ToolExecution.deleteOlderThan(30);

      expect(result).toBe(100);
      expect(db.query.mock.calls[0][0]).toContain('30 days');
    });
  });

  describe('getStatsByToolId()', () => {
    it('should return statistics for tool', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          total_executions: 100,
          successful: 90,
          failed: 10,
          avg_duration_ms: 150,
          min_duration_ms: 10,
          max_duration_ms: 500
        }]
      });

      const result = await ToolExecution.getStatsByToolId(1);

      expect(result.total_executions).toBe(100);
      expect(result.successful).toBe(90);
    });

    it('should use custom days', async () => {
      db.query.mockResolvedValueOnce({ rows: [{}] });

      await ToolExecution.getStatsByToolId(1, { days: 7 });

      expect(db.query.mock.calls[0][0]).toContain('7 days');
    });
  });

  describe('getStatsByAgentId()', () => {
    it('should return statistics for agent', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          total_executions: 50,
          successful: 45,
          failed: 5,
          avg_duration_ms: 200
        }]
      });

      const result = await ToolExecution.getStatsByAgentId(1);

      expect(result.total_executions).toBe(50);
    });
  });

  describe('parseExecution()', () => {
    it('should parse JSON string input and output', () => {
      const raw = {
        id: 1,
        input: '{"key":"value"}',
        output: '{"result":"data"}'
      };

      const result = ToolExecution.parseExecution(raw);

      expect(result.input).toEqual({ key: 'value' });
      expect(result.output).toEqual({ result: 'data' });
    });

    it('should handle already parsed input', () => {
      const raw = {
        id: 1,
        input: { key: 'value' },
        output: null
      };

      const result = ToolExecution.parseExecution(raw);

      expect(result.input).toEqual({ key: 'value' });
    });

    it('should default to empty object for null input', () => {
      const raw = {
        id: 1,
        input: null,
        output: null
      };

      const result = ToolExecution.parseExecution(raw);

      expect(result.input).toEqual({});
    });
  });
});
