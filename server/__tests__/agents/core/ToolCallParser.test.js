/**
 * ToolCallParser Tests
 * Tests for server/agents/core/ToolCallParser.js
 */

const ToolCallParser = require('../../../agents/core/ToolCallParser');

describe('ToolCallParser', () => {
  let parser;

  beforeEach(() => {
    parser = new ToolCallParser();
  });

  describe('parseToolCall', () => {
    describe('OpenAI format', () => {
      it('should parse OpenAI tool call with string arguments', () => {
        const toolCall = {
          id: 'call_123',
          function: {
            name: 'search',
            arguments: JSON.stringify({ query: 'test' })
          }
        };

        const result = parser.parseToolCall(toolCall);

        expect(result.valid).toBe(true);
        expect(result.id).toBe('call_123');
        expect(result.name).toBe('search');
        expect(result.arguments).toEqual({ query: 'test' });
      });

      it('should parse OpenAI tool call with object arguments', () => {
        const toolCall = {
          id: 'call_456',
          function: {
            name: 'calculate',
            arguments: { a: 1, b: 2 }
          }
        };

        const result = parser.parseToolCall(toolCall);

        expect(result.valid).toBe(true);
        expect(result.arguments).toEqual({ a: 1, b: 2 });
      });
    });

    describe('Anthropic format', () => {
      it('should parse Anthropic tool_use block', () => {
        const toolCall = {
          id: 'toolu_123',
          name: 'web_search',
          input: { query: 'Claude AI' }
        };

        const result = parser.parseToolCall(toolCall);

        expect(result.valid).toBe(true);
        expect(result.id).toBe('toolu_123');
        expect(result.name).toBe('web_search');
        expect(result.arguments).toEqual({ query: 'Claude AI' });
      });

      it('should handle empty input', () => {
        const toolCall = {
          id: 'toolu_456',
          name: 'get_time',
          input: {}
        };

        const result = parser.parseToolCall(toolCall);

        expect(result.valid).toBe(true);
        expect(result.arguments).toEqual({});
      });
    });

    describe('Custom format', () => {
      it('should parse custom format tool call', () => {
        const toolCall = {
          toolName: 'send_email',
          params: { to: 'test@example.com', subject: 'Hello' }
        };

        const result = parser.parseToolCall(toolCall);

        expect(result.valid).toBe(true);
        expect(result.name).toBe('send_email');
        expect(result.arguments).toEqual({ to: 'test@example.com', subject: 'Hello' });
        expect(result.id).toMatch(/^custom_\d+$/);
      });

      it('should use provided id if available', () => {
        const toolCall = {
          id: 'my_custom_id',
          toolName: 'test_tool',
          params: {}
        };

        const result = parser.parseToolCall(toolCall);

        expect(result.id).toBe('my_custom_id');
      });
    });

    describe('Error handling', () => {
      it('should return invalid for unknown format', () => {
        const toolCall = { unknown: 'format' };

        const result = parser.parseToolCall(toolCall);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Unknown tool call format');
      });

      it('should handle JSON parse error', () => {
        const toolCall = {
          function: {
            name: 'test',
            arguments: 'invalid json {'
          }
        };

        const result = parser.parseToolCall(toolCall);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Failed to parse tool call');
      });
    });
  });

  describe('extractToolCalls', () => {
    it('should extract tool calls from message', () => {
      const message = 'Let me search for that {{tool:search|query=test}}';

      const toolCalls = parser.extractToolCalls(message);

      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].toolName).toBe('search');
      expect(toolCalls[0].params).toEqual({ query: 'test' });
    });

    it('should extract multiple tool calls', () => {
      const message = '{{tool:search|query=test}} and {{tool:calculate|a=1|b=2}}';

      const toolCalls = parser.extractToolCalls(message);

      expect(toolCalls).toHaveLength(2);
      expect(toolCalls[0].toolName).toBe('search');
      expect(toolCalls[1].toolName).toBe('calculate');
    });

    it('should extract tool call without params', () => {
      const message = '{{tool:get_time}}';

      const toolCalls = parser.extractToolCalls(message);

      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].params).toEqual({});
    });

    it('should return empty array for null message', () => {
      expect(parser.extractToolCalls(null)).toEqual([]);
    });

    it('should return empty array for non-string message', () => {
      expect(parser.extractToolCalls(123)).toEqual([]);
    });

    it('should return empty array when no tool calls', () => {
      expect(parser.extractToolCalls('Hello world')).toEqual([]);
    });

    it('should include raw match in result', () => {
      const message = '{{tool:test|key=value}}';

      const toolCalls = parser.extractToolCalls(message);

      expect(toolCalls[0].raw).toBe('{{tool:test|key=value}}');
    });
  });

  describe('parseParams', () => {
    it('should parse simple params', () => {
      const result = parser.parseParams('key1=value1|key2=value2');

      expect(result).toEqual({ key1: 'value1', key2: 'value2' });
    });

    it('should return empty object for empty string', () => {
      expect(parser.parseParams('')).toEqual({});
    });

    it('should handle values with = sign', () => {
      const result = parser.parseParams('equation=a=b+c');

      expect(result.equation).toBe('a=b+c');
    });

    it('should trim keys', () => {
      const result = parser.parseParams(' key = value ');

      expect(result.key).toBe('value');
    });
  });

  describe('parseValue', () => {
    it('should parse true boolean', () => {
      expect(parser.parseValue('true')).toBe(true);
    });

    it('should parse false boolean', () => {
      expect(parser.parseValue('false')).toBe(false);
    });

    it('should parse null', () => {
      expect(parser.parseValue('null')).toBe(null);
    });

    it('should parse integer', () => {
      expect(parser.parseValue('42')).toBe(42);
    });

    it('should parse negative number', () => {
      expect(parser.parseValue('-3.14')).toBe(-3.14);
    });

    it('should parse float', () => {
      expect(parser.parseValue('3.14')).toBe(3.14);
    });

    it('should parse JSON object', () => {
      expect(parser.parseValue('{"key":"value"}')).toEqual({ key: 'value' });
    });

    it('should parse JSON array', () => {
      expect(parser.parseValue('[1,2,3]')).toEqual([1, 2, 3]);
    });

    it('should return string for invalid JSON', () => {
      expect(parser.parseValue('{invalid}')).toBe('{invalid}');
    });

    it('should strip double quotes', () => {
      expect(parser.parseValue('"hello"')).toBe('hello');
    });

    it('should strip single quotes', () => {
      expect(parser.parseValue("'hello'")).toBe('hello');
    });

    it('should return null for empty string', () => {
      expect(parser.parseValue('')).toBe(null);
    });

    it('should return null for undefined', () => {
      expect(parser.parseValue(undefined)).toBe(null);
    });
  });

  describe('formatToolResult', () => {
    it('should format success result', () => {
      const result = parser.formatToolResult('search', {
        success: true,
        result: { items: [1, 2, 3] }
      });

      expect(result).toContain('[Tool Result: search]');
      expect(result).toContain('Status: SUCCESS');
      expect(result).toContain('"items"');
    });

    it('should format error result', () => {
      const result = parser.formatToolResult('search', {
        success: false,
        error: 'Connection failed'
      });

      expect(result).toContain('[Tool Result: search]');
      expect(result).toContain('Status: ERROR');
      expect(result).toContain('Connection failed');
    });
  });

  describe('buildCustomFormat', () => {
    it('should build custom format without params', () => {
      const result = parser.buildCustomFormat('get_time', {});

      expect(result).toBe('{{tool:get_time}}');
    });

    it('should build custom format with null params', () => {
      const result = parser.buildCustomFormat('get_time', null);

      expect(result).toBe('{{tool:get_time}}');
    });

    it('should build custom format with params', () => {
      const result = parser.buildCustomFormat('search', { query: 'test', limit: 10 });

      expect(result).toBe('{{tool:search|query=test|limit=10}}');
    });

    it('should stringify object params', () => {
      const result = parser.buildCustomFormat('api_call', {
        data: { key: 'value' }
      });

      expect(result).toContain('data={"key":"value"}');
    });
  });

  describe('buildOpenAIFormat', () => {
    it('should build OpenAI function call format', () => {
      const result = parser.buildOpenAIFormat('search', { query: 'test' });

      expect(result.type).toBe('function');
      expect(result.function.name).toBe('search');
      expect(result.function.arguments).toBe('{"query":"test"}');
    });

    it('should handle empty params', () => {
      const result = parser.buildOpenAIFormat('get_time', null);

      expect(result.function.arguments).toBe('{}');
    });
  });

  describe('buildAnthropicFormat', () => {
    it('should build Anthropic tool_use format', () => {
      const result = parser.buildAnthropicFormat('search', { query: 'test' });

      expect(result.type).toBe('tool_use');
      expect(result.name).toBe('search');
      expect(result.input).toEqual({ query: 'test' });
      expect(result.id).toMatch(/^toolu_\d+$/);
    });

    it('should handle empty params', () => {
      const result = parser.buildAnthropicFormat('get_time', null);

      expect(result.input).toEqual({});
    });
  });

  describe('validateParams', () => {
    it('should return valid for no schema', () => {
      const result = parser.validateParams({ any: 'thing' }, null);

      expect(result.valid).toBe(true);
    });

    it('should validate required fields', () => {
      const schema = {
        required: ['name', 'email']
      };

      const result = parser.validateParams({ name: 'Test' }, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: email');
    });

    it('should validate type mismatch', () => {
      const schema = {
        properties: {
          count: { type: 'number' }
        }
      };

      const result = parser.validateParams({ count: 'not a number' }, schema);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid type for count');
    });

    it('should accept integer as number', () => {
      const schema = {
        properties: {
          count: { type: 'integer' }
        }
      };

      const result = parser.validateParams({ count: 42 }, schema);

      expect(result.valid).toBe(true);
    });

    it('should reject float for integer type', () => {
      const schema = {
        properties: {
          count: { type: 'integer' }
        }
      };

      const result = parser.validateParams({ count: 3.14 }, schema);

      expect(result.valid).toBe(false);
    });

    it('should validate array type', () => {
      const schema = {
        properties: {
          items: { type: 'array' }
        }
      };

      const result = parser.validateParams({ items: [1, 2, 3] }, schema);

      expect(result.valid).toBe(true);
    });

    it('should pass validation with all required fields', () => {
      const schema = {
        required: ['name'],
        properties: {
          name: { type: 'string' }
        }
      };

      const result = parser.validateParams({ name: 'Test' }, schema);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });
});
