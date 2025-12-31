/**
 * ToolRegistry Tests
 * Tests for autonomous agent tool registry
 */

// Mock dependencies
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../../utils/codeSandbox', () => ({
  safeMathEval: jest.fn((expr) => {
    if (expr === '2 + 2') return { success: true, result: 4 };
    if (expr === '10 / 2') return { success: true, result: 5 };
    if (expr === 'invalid') return { success: false, error: 'Invalid expression' };
    return { success: true, result: 0 };
  })
}));

const log = require('../../../utils/logger');

// Clear module cache to get fresh instance
beforeEach(() => {
  jest.resetModules();
});

describe('ToolRegistry', () => {
  let toolRegistry;

  beforeEach(() => {
    jest.resetModules();
    toolRegistry = require('../../../services/autonomous/ToolRegistry');
    jest.clearAllMocks();
  });

  describe('constructor and initialization', () => {
    it('should register built-in tools on initialization', () => {
      expect(toolRegistry.tools.size).toBeGreaterThan(0);
      expect(log.info).toHaveBeenCalledWith(
        'ToolRegistry: Built-in tools registered',
        expect.any(Object)
      );
    });

    it('should have web_search tool', () => {
      expect(toolRegistry.has('web_search')).toBe(true);
    });

    it('should have analyze_text tool', () => {
      expect(toolRegistry.has('analyze_text')).toBe(true);
    });

    it('should have format_data tool', () => {
      expect(toolRegistry.has('format_data')).toBe(true);
    });

    it('should have calculate tool', () => {
      expect(toolRegistry.has('calculate')).toBe(true);
    });

    it('should have generate_list tool', () => {
      expect(toolRegistry.has('generate_list')).toBe(true);
    });

    it('should have save_note tool', () => {
      expect(toolRegistry.has('save_note')).toBe(true);
    });

    it('should have get_note tool', () => {
      expect(toolRegistry.has('get_note')).toBe(true);
    });
  });

  describe('register', () => {
    it('should register a new tool', () => {
      toolRegistry.register({
        name: 'custom_tool',
        description: 'A custom tool',
        execute: jest.fn()
      });

      expect(toolRegistry.has('custom_tool')).toBe(true);
    });

    it('should throw error if tool has no name', () => {
      expect(() => {
        toolRegistry.register({
          description: 'No name',
          execute: jest.fn()
        });
      }).toThrow('Tool must have name and execute function');
    });

    it('should throw error if tool has no execute function', () => {
      expect(() => {
        toolRegistry.register({
          name: 'no_execute',
          description: 'No execute'
        });
      }).toThrow('Tool must have name and execute function');
    });

    it('should log tool registration', () => {
      toolRegistry.register({
        name: 'logged_tool',
        execute: jest.fn()
      });

      expect(log.debug).toHaveBeenCalledWith(
        'ToolRegistry: Tool registered',
        { name: 'logged_tool' }
      );
    });
  });

  describe('unregister', () => {
    it('should unregister a tool', () => {
      toolRegistry.register({
        name: 'temp_tool',
        execute: jest.fn()
      });

      expect(toolRegistry.unregister('temp_tool')).toBe(true);
      expect(toolRegistry.has('temp_tool')).toBe(false);
    });

    it('should return false for non-existent tool', () => {
      expect(toolRegistry.unregister('nonexistent')).toBe(false);
    });
  });

  describe('get', () => {
    it('should get tool by name', () => {
      const tool = toolRegistry.get('web_search');

      expect(tool).toBeDefined();
      expect(tool.name).toBe('web_search');
    });

    it('should return undefined for non-existent tool', () => {
      expect(toolRegistry.get('nonexistent')).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for existing tool', () => {
      expect(toolRegistry.has('web_search')).toBe(true);
    });

    it('should return false for non-existent tool', () => {
      expect(toolRegistry.has('nonexistent')).toBe(false);
    });
  });

  describe('getAll', () => {
    it('should return all tools', () => {
      const tools = toolRegistry.getAll();

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });
  });

  describe('getToolDefinitions', () => {
    it('should return tool definitions in OpenAI format', () => {
      const definitions = toolRegistry.getToolDefinitions();

      expect(Array.isArray(definitions)).toBe(true);
      expect(definitions[0].type).toBe('function');
      expect(definitions[0].function).toBeDefined();
      expect(definitions[0].function.name).toBeDefined();
      expect(definitions[0].function.description).toBeDefined();
      expect(definitions[0].function.parameters).toBeDefined();
    });

    it('should include required parameters', () => {
      const definitions = toolRegistry.getToolDefinitions();
      const webSearch = definitions.find(d => d.function.name === 'web_search');

      expect(webSearch.function.parameters.required).toContain('query');
    });
  });

  describe('execute', () => {
    it('should execute tool and return result', async () => {
      const result = await toolRegistry.execute('web_search', { query: 'test' });

      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
    });

    it('should throw error for non-existent tool', async () => {
      await expect(toolRegistry.execute('nonexistent', {}))
        .rejects.toThrow('Tool not found: nonexistent');
    });

    it('should pass context to tool', async () => {
      const context = { notes: {} };
      await toolRegistry.execute('save_note', { key: 'test', value: 'data' }, context);

      expect(context.notes.test).toBe('data');
    });

    it('should handle tool execution errors', async () => {
      toolRegistry.register({
        name: 'error_tool',
        execute: async () => { throw new Error('Tool error'); }
      });

      const result = await toolRegistry.execute('error_tool', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tool error');
    });

    it('should log tool execution', async () => {
      await toolRegistry.execute('web_search', { query: 'test' });

      expect(log.debug).toHaveBeenCalledWith(
        'ToolRegistry: Executing tool',
        expect.any(Object)
      );
    });
  });

  describe('Built-in Tools', () => {
    describe('web_search', () => {
      it('should return search results', async () => {
        const result = await toolRegistry.execute('web_search', { query: 'test query' });

        expect(result.success).toBe(true);
        expect(result.results).toBeDefined();
        expect(result.results[0].title).toContain('test query');
      });
    });

    describe('analyze_text', () => {
      it('should analyze text and return word count', async () => {
        const result = await toolRegistry.execute('analyze_text', {
          text: 'Hello world this is a test',
          analysis_type: 'summary'
        });

        expect(result.success).toBe(true);
        expect(result.analysis.word_count).toBe(6);
        expect(result.analysis.char_count).toBe(26);
      });
    });

    describe('format_data', () => {
      it('should format data as JSON', async () => {
        const result = await toolRegistry.execute('format_data', {
          data: { key: 'value' },
          format: 'json'
        });

        expect(result.success).toBe(true);
        expect(JSON.parse(result.formatted)).toEqual({ key: 'value' });
      });

      it('should format data as list', async () => {
        const result = await toolRegistry.execute('format_data', {
          data: ['item1', 'item2', 'item3'],
          format: 'list'
        });

        expect(result.success).toBe(true);
        expect(result.formatted).toContain('1. item1');
        expect(result.formatted).toContain('2. item2');
      });

      it('should format data as table', async () => {
        const result = await toolRegistry.execute('format_data', {
          data: [{ name: 'John', age: 30 }, { name: 'Jane', age: 25 }],
          format: 'table'
        });

        expect(result.success).toBe(true);
        expect(result.formatted).toContain('name');
        expect(result.formatted).toContain('age');
      });

      it('should handle non-array for table format', async () => {
        const result = await toolRegistry.execute('format_data', {
          data: 'simple string',
          format: 'table'
        });

        expect(result.success).toBe(true);
        expect(result.formatted).toBe('simple string');
      });

      it('should handle unknown format', async () => {
        const result = await toolRegistry.execute('format_data', {
          data: { key: 'value' },
          format: 'unknown'
        });

        expect(result.success).toBe(true);
        expect(result.formatted).toBe('[object Object]');
      });
    });

    describe('calculate', () => {
      it('should calculate expression', async () => {
        const result = await toolRegistry.execute('calculate', { expression: '2 + 2' });

        expect(result.success).toBe(true);
        expect(result.result).toBe(4);
      });

      it('should handle division', async () => {
        const result = await toolRegistry.execute('calculate', { expression: '10 / 2' });

        expect(result.success).toBe(true);
        expect(result.result).toBe(5);
      });

      it('should handle invalid expression', async () => {
        const result = await toolRegistry.execute('calculate', { expression: 'invalid' });

        expect(result.success).toBe(false);
      });
    });

    describe('generate_list', () => {
      it('should generate numbered list', async () => {
        const result = await toolRegistry.execute('generate_list', {
          items: ['Item A', 'Item B', 'Item C']
        });

        expect(result.success).toBe(true);
        expect(result.output).toContain('1. Item A');
        expect(result.output).toContain('2. Item B');
        expect(result.output).toContain('3. Item C');
      });

      it('should include title if provided', async () => {
        const result = await toolRegistry.execute('generate_list', {
          items: ['Item A', 'Item B'],
          title: 'My List'
        });

        expect(result.success).toBe(true);
        expect(result.output).toContain('My List:');
      });
    });

    describe('save_note and get_note', () => {
      it('should save and retrieve note', async () => {
        const context = { notes: {} };

        await toolRegistry.execute('save_note', { key: 'mykey', value: 'myvalue' }, context);
        const result = await toolRegistry.execute('get_note', { key: 'mykey' }, context);

        expect(result.success).toBe(true);
        expect(result.value).toBe('myvalue');
      });

      it('should return error for non-existent note', async () => {
        const context = { notes: {} };
        const result = await toolRegistry.execute('get_note', { key: 'nonexistent' }, context);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Note not found');
      });

      it('should initialize notes if not present', async () => {
        const context = {};
        await toolRegistry.execute('save_note', { key: 'test', value: 'data' }, context);

        expect(context.notes).toBeDefined();
        expect(context.notes.test).toBe('data');
      });
    });
  });
});
