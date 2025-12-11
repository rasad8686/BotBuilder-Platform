/**
 * ToolExecutor Tests
 * Tests for server/tools/core/ToolExecutor.js
 */

jest.mock('../../../db', () => ({
  query: jest.fn()
}));

const ToolExecutor = require('../../../tools/core/ToolExecutor');
const db = require('../../../db');

describe('ToolExecutor', () => {
  let executor;

  beforeEach(() => {
    jest.clearAllMocks();
    executor = new ToolExecutor();
  });

  describe('constructor', () => {
    it('should initialize with Ajv instance', () => {
      expect(executor.ajv).toBeDefined();
    });
  });

  describe('validateInput', () => {
    it('should skip validation if no schema', () => {
      expect(() => {
        executor.validateInput({}, { any: 'input' });
      }).not.toThrow();
    });

    it('should pass valid input', () => {
      const tool = {
        input_schema: {
          type: 'object',
          properties: {
            name: { type: 'string' }
          },
          required: ['name']
        }
      };

      expect(() => {
        executor.validateInput(tool, { name: 'test' });
      }).not.toThrow();
    });

    it('should throw on invalid input', () => {
      const tool = {
        input_schema: {
          type: 'object',
          properties: {
            count: { type: 'number' }
          },
          required: ['count']
        }
      };

      expect(() => {
        executor.validateInput(tool, { count: 'not a number' });
      }).toThrow('Input validation failed');
    });
  });

  describe('execute', () => {
    beforeEach(() => {
      // Mock execution record creation
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'exec_1' }] }) // createExecution
        .mockResolvedValueOnce({ rows: [] }); // updateExecutionStatus
    });

    it('should execute http_request tool', async () => {
      const tool = {
        id: 1,
        tool_type: 'http_request',
        configuration: {
          url: 'https://api.example.com/test',
          method: 'GET'
        }
      };

      // Mock the HTTP execution
      executor.executeHttpRequest = jest.fn().mockResolvedValue({ data: 'response' });
      db.query.mockResolvedValueOnce({ rows: [] }); // completeExecution

      const result = await executor.execute(tool, {}, { agentId: 1 });

      expect(result.success).toBe(true);
      expect(result.execution_id).toBe('exec_1');
      expect(executor.executeHttpRequest).toHaveBeenCalled();
    });

    it('should execute database_query tool', async () => {
      const tool = {
        id: 2,
        tool_type: 'database_query',
        configuration: {}
      };

      executor.executeDatabaseQuery = jest.fn().mockResolvedValue([{ id: 1 }]);
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await executor.execute(tool, { query: 'SELECT 1' }, {});

      expect(result.success).toBe(true);
      expect(executor.executeDatabaseQuery).toHaveBeenCalled();
    });

    it('should execute code_execution tool', async () => {
      const tool = {
        id: 3,
        tool_type: 'code_execution',
        configuration: {}
      };

      executor.executeCode = jest.fn().mockResolvedValue({ result: 42 });
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await executor.execute(tool, { code: '1 + 1' }, {});

      expect(result.success).toBe(true);
    });

    it('should execute custom tool', async () => {
      const tool = {
        id: 4,
        tool_type: 'custom',
        configuration: {}
      };

      executor.executeCustom = jest.fn().mockResolvedValue({ custom: 'output' });
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await executor.execute(tool, {}, {});

      expect(result.success).toBe(true);
    });

    it('should fail for unknown tool type', async () => {
      const tool = {
        id: 5,
        tool_type: 'unknown_type',
        configuration: {}
      };

      db.query.mockResolvedValueOnce({ rows: [] }); // failExecution

      const result = await executor.execute(tool, {}, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool type');
    });

    it('should handle execution errors', async () => {
      const tool = {
        id: 6,
        tool_type: 'http_request',
        configuration: {}
      };

      executor.executeHttpRequest = jest.fn().mockRejectedValue(new Error('Network error'));
      db.query.mockResolvedValueOnce({ rows: [] }); // failExecution

      const result = await executor.execute(tool, {}, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should validate input before execution', async () => {
      const tool = {
        id: 7,
        tool_type: 'http_request',
        input_schema: {
          type: 'object',
          required: ['url']
        }
      };

      const result = await executor.execute(tool, {}, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('validation failed');
    });

    it('should include duration in result', async () => {
      const tool = {
        id: 8,
        tool_type: 'custom'
      };

      executor.executeCustom = jest.fn().mockResolvedValue({});
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await executor.execute(tool, {}, {});

      expect(result.duration_ms).toBeDefined();
      expect(result.duration_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe('createExecution', () => {
    it('should create execution record', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'exec_new' }] });

      const result = await executor.createExecution(1, { agentId: 5 }, { query: 'test' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tool_executions'),
        expect.any(Array)
      );
      expect(result).toBe('exec_new');
    });
  });

  describe('updateExecutionStatus', () => {
    it('should update status', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await executor.updateExecutionStatus('exec_1', 'running');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE tool_executions'),
        ['running', 'exec_1']
      );
    });
  });

  describe('completeExecution', () => {
    it('should complete execution with output', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await executor.completeExecution('exec_1', { result: 'data' }, 150);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE tool_executions'),
        expect.arrayContaining(['completed', JSON.stringify({ result: 'data' }), 150, 'exec_1'])
      );
    });
  });

  describe('failExecution', () => {
    it('should fail execution with error', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await executor.failExecution('exec_1', 'Something went wrong', 50);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE tool_executions'),
        expect.arrayContaining(['failed', 'Something went wrong', 50, 'exec_1'])
      );
    });
  });

  describe('formatOutput', () => {
    it('should format output with schema', () => {
      const tool = {
        output_schema: {
          type: 'object',
          properties: {
            name: { type: 'string' }
          }
        }
      };

      const output = { name: 'test', extra: 'data' };
      const formatted = executor.formatOutput(tool, output);

      expect(formatted).toBeDefined();
    });

    it('should return output as-is without schema', () => {
      const output = { data: 'test' };
      const formatted = executor.formatOutput({}, output);

      expect(formatted).toEqual(output);
    });
  });
});
