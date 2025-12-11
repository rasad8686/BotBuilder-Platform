/**
 * CodeTool Tests
 * Tests for server/tools/types/CodeTool.js
 */

const CodeTool = require('../../../tools/types/CodeTool');

describe('CodeTool', () => {
  let codeTool;

  beforeEach(() => {
    jest.clearAllMocks();
    codeTool = new CodeTool();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      expect(codeTool.config.timeout).toBe(5000);
      expect(codeTool.config.memoryLimit).toBe(50 * 1024 * 1024);
      expect(codeTool.config.allowedModules).toEqual([]);
    });

    it('should accept custom config', () => {
      const tool = new CodeTool({ timeout: 10000, allowedModules: ['lodash'] });

      expect(tool.config.timeout).toBe(10000);
      expect(tool.config.allowedModules).toContain('lodash');
    });
  });

  describe('execute', () => {
    it('should throw error if no code provided', async () => {
      await expect(codeTool.execute({})).rejects.toThrow('Code is required');
    });

    it('should execute simple code', async () => {
      const result = await codeTool.execute({
        code: 'return 2 + 2;'
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe(4);
    });

    it('should access input variables', async () => {
      const result = await codeTool.execute({
        code: 'return input.x + input.y;',
        variables: { x: 10, y: 20 }
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe(30);
    });

    it('should capture console output', async () => {
      const result = await codeTool.execute({
        code: `
          console.log('Hello');
          console.info('Info');
          console.warn('Warning');
          console.error('Error');
          return 'done';
        `
      });

      expect(result.success).toBe(true);
      expect(result.console).toHaveLength(4);
      expect(result.console[0]).toEqual({ level: 'log', message: 'Hello' });
      expect(result.console[1]).toEqual({ level: 'info', message: 'Info' });
      expect(result.console[2]).toEqual({ level: 'warn', message: 'Warning' });
      expect(result.console[3]).toEqual({ level: 'error', message: 'Error' });
    });

    it('should handle errors gracefully', async () => {
      const result = await codeTool.execute({
        code: 'throw new Error("Test error");'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Test error');
    });

    it('should have access to safe built-ins', async () => {
      const result = await codeTool.execute({
        code: `
          const arr = [1, 2, 3];
          const obj = { a: 1 };
          const date = new Date('2024-01-01');
          const num = Math.sqrt(16);
          return { arr, obj, dateYear: date.getFullYear(), num };
        `
      });

      expect(result.success).toBe(true);
      expect(result.result.arr).toEqual([1, 2, 3]);
      expect(result.result.obj).toEqual({ a: 1 });
      expect(result.result.dateYear).toBe(2024);
      expect(result.result.num).toBe(4);
    });

    it('should not have access to require', async () => {
      const result = await codeTool.execute({
        code: 'const fs = require("fs"); return fs;'
      });

      expect(result.success).toBe(false);
    });

    it('should extract output variables', async () => {
      const result = await codeTool.execute({
        code: `
          var myVar = 'test';
          var myNum = 42;
          return 'done';
        `
      });

      expect(result.success).toBe(true);
      expect(result.variables.myVar).toBe('test');
      expect(result.variables.myNum).toBe(42);
    });
  });

  describe('stringify', () => {
    it('should handle undefined', () => {
      expect(codeTool.stringify(undefined)).toBe('undefined');
    });

    it('should handle null', () => {
      expect(codeTool.stringify(null)).toBe('null');
    });

    it('should handle objects', () => {
      const result = codeTool.stringify({ key: 'value' });
      expect(result).toContain('key');
      expect(result).toContain('value');
    });

    it('should handle primitives', () => {
      expect(codeTool.stringify(123)).toBe('123');
      expect(codeTool.stringify('test')).toBe('test');
      expect(codeTool.stringify(true)).toBe('true');
    });

    it('should handle circular references', () => {
      const obj = { a: 1 };
      obj.self = obj;

      const result = codeTool.stringify(obj);
      expect(result).toBeDefined();
    });
  });

  describe('sanitizeContext', () => {
    it('should only keep allowed keys', () => {
      const context = {
        executionId: 'exec_1',
        agentId: 5,
        timestamp: '2024-01-01',
        secretKey: 'should-be-removed',
        password: 'also-removed'
      };

      const sanitized = codeTool.sanitizeContext(context);

      expect(sanitized.executionId).toBe('exec_1');
      expect(sanitized.agentId).toBe(5);
      expect(sanitized.timestamp).toBe('2024-01-01');
      expect(sanitized.secretKey).toBeUndefined();
      expect(sanitized.password).toBeUndefined();
    });

    it('should handle missing keys', () => {
      const sanitized = codeTool.sanitizeContext({});

      expect(Object.keys(sanitized)).toHaveLength(0);
    });
  });

  describe('extractOutputVariables', () => {
    it('should extract serializable variables', () => {
      const sandbox = {
        console: {},
        input: {},
        context: {},
        result: 42,
        JSON: JSON,
        Math: Math,
        myVar: 'test',
        myNum: 123
      };

      const output = codeTool.extractOutputVariables(sandbox);

      expect(output.myVar).toBe('test');
      expect(output.myNum).toBe(123);
      expect(output.console).toBeUndefined();
      expect(output.JSON).toBeUndefined();
    });

    it('should skip non-serializable values', () => {
      const sandbox = {
        console: {},
        circularRef: {}
      };
      sandbox.circularRef.self = sandbox.circularRef;

      const output = codeTool.extractOutputVariables(sandbox);

      expect(output.circularRef).toBeUndefined();
    });
  });

  describe('sanitizeStack', () => {
    it('should return undefined for null stack', () => {
      expect(codeTool.sanitizeStack(null)).toBeUndefined();
    });

    it('should filter stack trace', () => {
      const stack = `Error: test
        at user-code.js:1:1
        at internal/process.js:100:10
        at some other location`;

      const sanitized = codeTool.sanitizeStack(stack);

      expect(sanitized).toContain('user-code.js');
      expect(sanitized.split('\n').length).toBeLessThanOrEqual(5);
    });
  });

  describe('validateCode', () => {
    it('should pass valid code', () => {
      expect(codeTool.validateCode('const x = 1;')).toBe(true);
    });

    it('should reject process access', () => {
      expect(() => {
        codeTool.validateCode('process.exit(1)');
      }).toThrow('Forbidden pattern');
    });

    it('should reject require', () => {
      expect(() => {
        codeTool.validateCode('require("fs")');
      }).toThrow('Forbidden pattern');
    });

    it('should reject import', () => {
      expect(() => {
        codeTool.validateCode('import fs from "fs"');
      }).toThrow('Forbidden pattern');
    });

    it('should reject eval', () => {
      expect(() => {
        codeTool.validateCode('eval("1+1")');
      }).toThrow('Forbidden pattern');
    });

    it('should reject Function constructor', () => {
      expect(() => {
        codeTool.validateCode('new Function("return 1")');
      }).toThrow('Forbidden pattern');
    });

    it('should reject __proto__ access', () => {
      expect(() => {
        codeTool.validateCode('obj.__proto__.isAdmin = true');
      }).toThrow('Forbidden pattern');
    });

    it('should reject constructor.constructor', () => {
      expect(() => {
        codeTool.validateCode('({}).constructor.constructor("return this")()');
      }).toThrow('Forbidden pattern');
    });
  });

  describe('static schemas', () => {
    it('should return input schema', () => {
      const schema = CodeTool.getInputSchema();

      expect(schema.type).toBe('object');
      expect(schema.properties.code).toBeDefined();
      expect(schema.properties.variables).toBeDefined();
      expect(schema.required).toContain('code');
    });

    it('should return output schema', () => {
      const schema = CodeTool.getOutputSchema();

      expect(schema.type).toBe('object');
      expect(schema.properties.success).toBeDefined();
      expect(schema.properties.result).toBeDefined();
      expect(schema.properties.console).toBeDefined();
    });

    it('should return config schema', () => {
      const schema = CodeTool.getConfigSchema();

      expect(schema.type).toBe('object');
      expect(schema.properties.timeout).toBeDefined();
      expect(schema.properties.memoryLimit).toBeDefined();
    });
  });
});
