/**
 * ToolPlugin Tests
 * Tests for server/plugins/types/ToolPlugin.js
 */

jest.useFakeTimers();

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const ToolPlugin = require('../../../plugins/types/ToolPlugin');

describe('ToolPlugin', () => {
  let plugin;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.setSystemTime(new Date('2024-01-01'));

    plugin = new ToolPlugin({
      id: 'test-tool',
      name: 'Test Tool',
      toolName: 'test_tool',
      toolDescription: 'A test tool for testing',
      parameters: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', minimum: 1, maximum: 100 }
      },
      requiredParams: ['query'],
      timeout: 5000,
      rateLimitPerMinute: 10
    });
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      expect(plugin.toolName).toBe('test_tool');
      expect(plugin.toolDescription).toBe('A test tool for testing');
      expect(plugin.parameters.query).toBeDefined();
      expect(plugin.requiredParams).toContain('query');
      expect(plugin.timeout).toBe(5000);
      expect(plugin.rateLimitPerMinute).toBe(10);
      expect(plugin.callCount).toBe(0);
    });

    it('should use defaults for missing config', () => {
      const defaultPlugin = new ToolPlugin({ id: 'default' });
      expect(defaultPlugin.toolName).toBe('default');
      expect(defaultPlugin.toolDescription).toBe('');
      expect(defaultPlugin.parameters).toEqual({});
      expect(defaultPlugin.timeout).toBe(30000);
      expect(defaultPlugin.rateLimitPerMinute).toBe(60);
    });
  });

  describe('getType', () => {
    it('should return tool type', () => {
      expect(plugin.getType()).toBe('tool');
    });
  });

  describe('execute', () => {
    beforeEach(async () => {
      await plugin.install(1);
    });

    it('should throw error if plugin not enabled', async () => {
      plugin.enabled = false;
      await expect(plugin.execute({})).rejects.toThrow('Tool is not enabled');
    });

    it('should execute successfully', async () => {
      plugin.doExecute = jest.fn().mockResolvedValue({
        data: { results: [1, 2, 3] }
      });

      const result = await plugin.execute({ query: 'test' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ results: [1, 2, 3] });
      expect(result.metadata.tool).toBe('test_tool');
      expect(result.metadata.duration).toBeGreaterThanOrEqual(0);
    });

    it('should return validation errors', async () => {
      const result = await plugin.execute({ limit: 5 }); // missing required query

      expect(result.success).toBe(false);
      expect(result.error).toContain('query is required');
    });

    it('should handle execution errors gracefully', async () => {
      plugin.doExecute = jest.fn().mockRejectedValue(new Error('Execution failed'));

      const result = await plugin.execute({ query: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution failed');
    });

    it('should enforce rate limit', async () => {
      plugin.doExecute = jest.fn().mockResolvedValue({ data: {} });

      // Execute up to rate limit
      for (let i = 0; i < 10; i++) {
        await plugin.execute({ query: 'test' });
      }

      // Next call should fail
      await expect(plugin.execute({ query: 'test' })).rejects.toThrow('Rate limit exceeded');
    });

    it('should reset rate limit after minute', async () => {
      plugin.doExecute = jest.fn().mockResolvedValue({ data: {} });

      // Use up rate limit
      for (let i = 0; i < 10; i++) {
        await plugin.execute({ query: 'test' });
      }

      // Advance time by 1 minute
      jest.advanceTimersByTime(60001);

      // Should work again
      const result = await plugin.execute({ query: 'test' });
      expect(result.success).toBe(true);
    });

    it('should increment call count', async () => {
      plugin.doExecute = jest.fn().mockResolvedValue({ data: {} });

      await plugin.execute({ query: 'test' });
      expect(plugin.callCount).toBe(1);

      await plugin.execute({ query: 'test' });
      expect(plugin.callCount).toBe(2);
    });
  });

  describe('validate', () => {
    it('should pass valid parameters', async () => {
      const result = await plugin.validate({ query: 'test', limit: 50 });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail missing required parameters', async () => {
      const result = await plugin.validate({});

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'query',
        message: 'query is required'
      });
    });

    it('should validate parameter types', async () => {
      const result = await plugin.validate({
        query: 'test',
        limit: 'not a number'
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'limit')).toBe(true);
    });

    it('should validate minimum value', async () => {
      const result = await plugin.validate({ query: 'test', limit: 0 });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Minimum'))).toBe(true);
    });

    it('should validate maximum value', async () => {
      const result = await plugin.validate({ query: 'test', limit: 200 });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Maximum'))).toBe(true);
    });

    it('should include custom validation errors', async () => {
      plugin.customValidate = jest.fn().mockResolvedValue([
        { field: 'query', message: 'Custom error' }
      ]);

      const result = await plugin.validate({ query: 'test' });

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({ field: 'query', message: 'Custom error' });
    });
  });

  describe('validateType', () => {
    it('should validate string type', () => {
      expect(plugin.validateType('hello', { type: 'string' })).toBeNull();
      expect(plugin.validateType(123, { type: 'string' })).toContain('Expected string');
    });

    it('should validate string minLength', () => {
      expect(plugin.validateType('hi', { type: 'string', minLength: 5 })).toContain('Minimum length');
    });

    it('should validate string maxLength', () => {
      expect(plugin.validateType('hello world', { type: 'string', maxLength: 5 })).toContain('Maximum length');
    });

    it('should validate string pattern', () => {
      expect(plugin.validateType('abc', { type: 'string', pattern: '^[0-9]+$' })).toContain('pattern');
      expect(plugin.validateType('123', { type: 'string', pattern: '^[0-9]+$' })).toBeNull();
    });

    it('should validate number type', () => {
      expect(plugin.validateType(42, { type: 'number' })).toBeNull();
      expect(plugin.validateType('42', { type: 'number' })).toContain('Expected number');
    });

    it('should validate number minimum', () => {
      expect(plugin.validateType(5, { type: 'number', minimum: 10 })).toContain('Minimum value');
    });

    it('should validate number maximum', () => {
      expect(plugin.validateType(100, { type: 'number', maximum: 50 })).toContain('Maximum value');
    });

    it('should validate integer type', () => {
      expect(plugin.validateType(42, { type: 'integer' })).toBeNull();
      expect(plugin.validateType('42', { type: 'integer' })).toContain('Expected number');
    });

    it('should validate boolean type', () => {
      expect(plugin.validateType(true, { type: 'boolean' })).toBeNull();
      expect(plugin.validateType('true', { type: 'boolean' })).toContain('Expected boolean');
    });

    it('should validate array type', () => {
      expect(plugin.validateType([1, 2], { type: 'array' })).toBeNull();
      expect(plugin.validateType('not array', { type: 'array' })).toContain('Expected array');
    });

    it('should validate array minItems', () => {
      expect(plugin.validateType([], { type: 'array', minItems: 1 })).toContain('Minimum items');
    });

    it('should validate array maxItems', () => {
      expect(plugin.validateType([1, 2, 3], { type: 'array', maxItems: 2 })).toContain('Maximum items');
    });

    it('should validate object type', () => {
      expect(plugin.validateType({}, { type: 'object' })).toBeNull();
      expect(plugin.validateType([], { type: 'object' })).toContain('Expected object');
      expect(plugin.validateType('string', { type: 'object' })).toContain('Expected object');
    });

    it('should validate enum values', () => {
      expect(plugin.validateType('a', { type: 'string', enum: ['a', 'b'] })).toBeNull();
      expect(plugin.validateType('c', { type: 'string', enum: ['a', 'b'] })).toContain('one of');
    });
  });

  describe('getSchema', () => {
    it('should return OpenAI function schema format', () => {
      const schema = plugin.getSchema();

      expect(schema.type).toBe('function');
      expect(schema.function.name).toBe('test_tool');
      expect(schema.function.description).toBe('A test tool for testing');
      expect(schema.function.parameters.type).toBe('object');
      expect(schema.function.parameters.properties.query).toBeDefined();
      expect(schema.function.parameters.required).toContain('query');
    });

    it('should include enum and default values', () => {
      plugin.parameters = {
        mode: {
          type: 'string',
          enum: ['fast', 'slow'],
          default: 'fast',
          required: true
        }
      };

      const schema = plugin.getSchema();

      expect(schema.function.parameters.properties.mode.enum).toEqual(['fast', 'slow']);
      expect(schema.function.parameters.properties.mode.default).toBe('fast');
      expect(schema.function.parameters.required).toContain('mode');
    });
  });

  describe('customValidate', () => {
    it('should return empty array by default', async () => {
      const errors = await plugin.customValidate({});
      expect(errors).toEqual([]);
    });
  });

  describe('executeWithTimeout', () => {
    it('should resolve if promise completes in time', async () => {
      const promise = Promise.resolve('success');
      const result = await plugin.executeWithTimeout(promise, 1000);
      expect(result).toBe('success');
    });

    it('should reject if promise times out', async () => {
      const promise = new Promise(resolve => setTimeout(resolve, 10000));

      const timeoutPromise = plugin.executeWithTimeout(promise, 100);

      jest.advanceTimersByTime(101);

      await expect(timeoutPromise).rejects.toThrow('Execution timed out');
    });
  });

  describe('checkRateLimit', () => {
    it('should return true when under limit', () => {
      expect(plugin.checkRateLimit()).toBe(true);
    });

    it('should return false when at limit', () => {
      plugin.callCount = 10;
      expect(plugin.checkRateLimit()).toBe(false);
    });

    it('should reset after one minute', () => {
      plugin.callCount = 10;
      plugin.lastResetTime = Date.now() - 60001;

      expect(plugin.checkRateLimit()).toBe(true);
      expect(plugin.callCount).toBe(0);
    });
  });

  describe('doExecute', () => {
    it('should throw error (must be implemented)', async () => {
      await expect(plugin.doExecute({}, {})).rejects.toThrow('doExecute must be implemented');
    });
  });

  describe('getToolInfo', () => {
    it('should return tool information', () => {
      const info = plugin.getToolInfo();

      expect(info.name).toBe('test_tool');
      expect(info.description).toBe('A test tool for testing');
      expect(info.parameters).toEqual(plugin.parameters);
      expect(info.requiredParams).toEqual(['query']);
      expect(info.schema).toBeDefined();
    });
  });

  describe('getSettingsSchema', () => {
    it('should return settings schema', () => {
      const schema = plugin.getSettingsSchema();

      expect(schema.timeout).toBeDefined();
      expect(schema.timeout.type).toBe('number');
      expect(schema.rateLimitPerMinute).toBeDefined();
    });
  });
});

describe('ToolPlugin subclass', () => {
  class SearchTool extends ToolPlugin {
    constructor() {
      super({
        id: 'search-tool',
        name: 'Search Tool',
        toolName: 'search',
        toolDescription: 'Search the web',
        parameters: {
          query: { type: 'string', description: 'Search query', required: true }
        },
        requiredParams: ['query']
      });
    }

    async doExecute(params, context) {
      return {
        data: {
          results: [
            { title: 'Result 1', url: 'http://example.com/1' },
            { title: 'Result 2', url: 'http://example.com/2' }
          ],
          query: params.query
        }
      };
    }

    async customValidate(params) {
      const errors = [];
      if (params.query && params.query.length < 2) {
        errors.push({ field: 'query', message: 'Query too short' });
      }
      return errors;
    }
  }

  it('should execute custom tool', async () => {
    const tool = new SearchTool();
    await tool.install(1);

    const result = await tool.execute({ query: 'hello world' });

    expect(result.success).toBe(true);
    expect(result.data.results).toHaveLength(2);
    expect(result.data.query).toBe('hello world');
  });

  it('should use custom validation', async () => {
    const tool = new SearchTool();
    await tool.install(1);

    const result = await tool.execute({ query: 'a' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Query too short');
  });
});
