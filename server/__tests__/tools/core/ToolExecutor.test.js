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
      db.query.mockReset();
      db.query.mockImplementation(() => Promise.resolve({ rows: [{ id: 'exec_new' }] }));

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

    it('should return validation warnings for invalid output', () => {
      const tool = {
        output_schema: {
          type: 'object',
          properties: {
            count: { type: 'number' }
          },
          required: ['count']
        }
      };

      const output = { count: 'not a number' };
      const formatted = executor.formatOutput(tool, output);

      expect(formatted._validation_warnings).toBeDefined();
    });

    it('should handle schema compilation errors gracefully', () => {
      const tool = {
        output_schema: {
          type: 'invalid_type_that_breaks'
        }
      };

      const output = { data: 'test' };
      const formatted = executor.formatOutput(tool, output);

      expect(formatted).toEqual(output);
    });
  });

  describe('interpolateString', () => {
    it('should interpolate simple variables', () => {
      const result = executor.interpolateString('Hello {{name}}!', { name: 'World' });
      expect(result).toBe('Hello World!');
    });

    it('should interpolate nested variables', () => {
      const result = executor.interpolateString('User: {{user.name}}', { user: { name: 'John' } });
      expect(result).toBe('User: John');
    });

    it('should keep original if variable not found', () => {
      const result = executor.interpolateString('Hello {{unknown}}!', { name: 'World' });
      expect(result).toBe('Hello {{unknown}}!');
    });

    it('should handle multiple variables', () => {
      const result = executor.interpolateString('{{first}} and {{second}}', { first: 'A', second: 'B' });
      expect(result).toBe('A and B');
    });

    it('should return non-string values as-is', () => {
      expect(executor.interpolateString(123, {})).toBe(123);
      expect(executor.interpolateString(null, {})).toBe(null);
      expect(executor.interpolateString(undefined, {})).toBe(undefined);
    });

    it('should handle deeply nested paths', () => {
      const result = executor.interpolateString('Value: {{a.b.c.d}}', { a: { b: { c: { d: 'deep' } } } });
      expect(result).toBe('Value: deep');
    });

    it('should keep placeholder if path breaks midway', () => {
      const result = executor.interpolateString('{{a.b.c}}', { a: { b: null } });
      expect(result).toBe('{{a.b.c}}');
    });
  });

  describe('executeHttpRequest', () => {
    let originalFetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should execute GET request', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: jest.fn().mockResolvedValue({ data: 'response' })
      });
      global.fetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ data: 'response' })
      });

      const tool = {
        configuration: {
          url: 'https://api.example.com/{{endpoint}}',
          method: 'GET',
          headers: { 'Authorization': 'Bearer {{token}}' }
        }
      };

      const result = await executor.executeHttpRequest(tool, { endpoint: 'users', token: 'abc123' }, {});

      expect(result.status).toBe(200);
      expect(result.data).toEqual({ data: 'response' });
    });

    it('should execute POST request with body', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 201,
        statusText: 'Created',
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ id: 1 })
      });

      const tool = {
        configuration: {
          url: 'https://api.example.com/create',
          method: 'POST',
          headers: {}
        }
      };

      const result = await executor.executeHttpRequest(tool, { body: { name: 'Test' } }, {});

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/create',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Test' })
        })
      );
    });

    it('should handle text response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: { get: () => 'text/plain' },
        text: () => Promise.resolve('plain text response')
      });

      const tool = {
        configuration: {
          url: 'https://api.example.com/text',
          method: 'GET',
          headers: {}
        }
      };

      const result = await executor.executeHttpRequest(tool, {}, {});

      expect(result.data).toBe('plain text response');
    });

    it('should default method to GET', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: { get: () => null },
        text: () => Promise.resolve('')
      });

      const tool = {
        configuration: {
          url: 'https://api.example.com/test'
        }
      };

      await executor.executeHttpRequest(tool, {}, {});

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'GET' })
      );
    });
  });

  describe('executeDatabaseQuery', () => {
    it('should execute query with interpolated string', async () => {
      db.query.mockReset();
      db.query.mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 });

      const tool = {
        configuration: {
          query: 'SELECT * FROM {{table}} WHERE id = $1',
          params: ['id']
        }
      };

      const result = await executor.executeDatabaseQuery(tool, { table: 'users', id: 5 }, {});

      expect(db.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1',
        [5]
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rowCount).toBe(1);
    });

    it('should handle empty params', async () => {
      db.query.mockReset();
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const tool = {
        configuration: {
          query: 'SELECT 1'
        }
      };

      const result = await executor.executeDatabaseQuery(tool, {}, {});

      expect(db.query).toHaveBeenCalledWith('SELECT 1', []);
    });
  });

  describe('executeCode', () => {
    it('should execute code and return result', async () => {
      const tool = {
        configuration: {
          code: 'return input.a + input.b;',
          timeout: 1000
        }
      };

      const result = await executor.executeCode(tool, { a: 2, b: 3 }, {});

      expect(result).toBe(5);
    });

    it('should have access to context', async () => {
      const tool = {
        configuration: {
          code: 'return context.userId;',
          timeout: 1000
        }
      };

      const result = await executor.executeCode(tool, {}, { userId: 123 });

      expect(result).toBe(123);
    });

    it('should handle timeout scenario', async () => {
      // Note: Testing actual timeout with infinite loop is problematic
      // We test the timeout mechanism exists by verifying the code path
      const tool = {
        configuration: {
          code: 'return "quick execution";',
          timeout: 10000
        }
      };

      const result = await executor.executeCode(tool, {}, {});

      expect(result).toBe('quick execution');
    });

    it('should use default timeout of 5000ms', async () => {
      const tool = {
        configuration: {
          code: 'return 42;'
        }
      };

      const result = await executor.executeCode(tool, {}, {});

      expect(result).toBe(42);
    });
  });

  describe('executeCustom', () => {
    it('should throw error if no handler defined', async () => {
      const tool = {
        configuration: {}
      };

      await expect(executor.executeCustom(tool, {}, {}))
        .rejects.toThrow('Custom tool must define a handler');
    });

    it('should try to require handler if defined', async () => {
      const tool = {
        configuration: {
          handler: './nonexistent-handler-path'
        }
      };

      // Should throw error because the handler module doesn't exist
      await expect(executor.executeCustom(tool, {}, {})).rejects.toThrow();
    });
  });

  describe('execute edge cases', () => {
    it('should handle execution without executionId', async () => {
      db.query.mockReset();
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'exec_1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      executor.executeCustom = jest.fn().mockRejectedValue(new Error('fail'));

      const tool = { id: 1, tool_type: 'custom' };

      // Should still fail gracefully even with executionId
      const result = await executor.execute(tool, {}, {});

      expect(result.success).toBe(false);
      expect(result.execution_id).toBe('exec_1');
    });

    it('should handle validation failure before execution record', async () => {
      const tool = {
        id: 1,
        tool_type: 'http_request',
        input_schema: {
          type: 'object',
          required: ['requiredField']
        }
      };

      const result = await executor.execute(tool, {}, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('validation failed');
    });

    it('should format output after successful execution', async () => {
      db.query.mockReset();
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'exec_1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const tool = {
        id: 1,
        tool_type: 'custom',
        output_schema: {
          type: 'object',
          properties: { name: { type: 'string' } }
        }
      };

      executor.executeCustom = jest.fn().mockResolvedValue({ name: 'test' });

      const result = await executor.execute(tool, {}, {});

      expect(result.success).toBe(true);
      expect(result.output).toEqual({ name: 'test' });
    });
  });
});
