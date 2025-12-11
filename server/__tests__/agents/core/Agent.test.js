/**
 * Agent Tests
 * Tests for server/agents/core/Agent.js
 */

// Mock external dependencies
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  }));
});

jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn()
    }
  }));
});

jest.mock('../../../models/AgentTool', () => ({
  findEnabledByAgentId: jest.fn()
}));

jest.mock('../../../models/Tool', () => ({
  findById: jest.fn()
}));

jest.mock('../../../tools/types', () => ({
  createTool: jest.fn()
}));

jest.mock('../../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

const Agent = require('../../../agents/core/Agent');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const AgentTool = require('../../../models/AgentTool');
const Tool = require('../../../models/Tool');
const { createTool } = require('../../../tools/types');

describe('Agent', () => {
  let agent;

  beforeEach(() => {
    jest.clearAllMocks();
    agent = new Agent({
      id: 1,
      name: 'TestAgent',
      role: 'test',
      systemPrompt: 'You are a test agent.',
      modelProvider: 'openai',
      modelName: 'gpt-4',
      temperature: 0.5,
      maxTokens: 1024
    });
  });

  describe('constructor', () => {
    it('should initialize with config', () => {
      expect(agent.id).toBe(1);
      expect(agent.name).toBe('TestAgent');
      expect(agent.role).toBe('test');
      expect(agent.modelProvider).toBe('openai');
      expect(agent.modelName).toBe('gpt-4');
      expect(agent.temperature).toBe(0.5);
      expect(agent.maxTokens).toBe(1024);
    });

    it('should use defaults', () => {
      const defaultAgent = new Agent({ id: 2 });

      expect(defaultAgent.modelProvider).toBe('openai');
      expect(defaultAgent.modelName).toBe('gpt-4');
      expect(defaultAgent.temperature).toBe(0.7);
      expect(defaultAgent.maxTokens).toBe(2048);
    });

    it('should initialize empty tool arrays', () => {
      expect(agent.loadedTools).toEqual([]);
      expect(agent.toolDefinitions).toEqual([]);
    });
  });

  describe('loadTools', () => {
    it('should return empty array if no agent id', async () => {
      const noIdAgent = new Agent({ name: 'NoId' });

      const result = await noIdAgent.loadTools();

      expect(result).toEqual([]);
    });

    it('should load enabled tools from database', async () => {
      const assignments = [
        { tool_id: 1, priority: 10 }
      ];
      const tool = {
        id: 1,
        name: 'SearchTool',
        description: 'Searches the web',
        tool_type: 'search',
        is_active: true,
        input_schema: { type: 'object', properties: {} },
        configuration: {}
      };

      AgentTool.findEnabledByAgentId.mockResolvedValue(assignments);
      Tool.findById.mockResolvedValue(tool);
      createTool.mockReturnValue({ execute: jest.fn() });

      const result = await agent.loadTools();

      expect(AgentTool.findEnabledByAgentId).toHaveBeenCalledWith(1);
      expect(Tool.findById).toHaveBeenCalledWith(1);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('SearchTool');
    });

    it('should skip inactive tools', async () => {
      AgentTool.findEnabledByAgentId.mockResolvedValue([{ tool_id: 1 }]);
      Tool.findById.mockResolvedValue({
        id: 1,
        name: 'InactiveTool',
        is_active: false
      });

      const result = await agent.loadTools();

      expect(result).toHaveLength(0);
    });

    it('should sort tools by priority', async () => {
      AgentTool.findEnabledByAgentId.mockResolvedValue([
        { tool_id: 1, priority: 5 },
        { tool_id: 2, priority: 10 }
      ]);
      Tool.findById
        .mockResolvedValueOnce({ id: 1, name: 'LowPriority', is_active: true, tool_type: 'test' })
        .mockResolvedValueOnce({ id: 2, name: 'HighPriority', is_active: true, tool_type: 'test' });
      createTool.mockReturnValue({ execute: jest.fn() });

      const result = await agent.loadTools();

      expect(result[0].name).toBe('HighPriority');
      expect(result[1].name).toBe('LowPriority');
    });
  });

  describe('buildToolDefinition', () => {
    it('should build LLM-ready definition', () => {
      const tool = {
        id: 1,
        name: 'My Tool',
        description: 'Does something',
        tool_type: 'custom',
        input_schema: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query']
        }
      };

      const definition = agent.buildToolDefinition(tool);

      expect(definition.name).toBe('My_Tool');
      expect(definition.description).toBe('Does something');
      expect(definition.parameters).toEqual(tool.input_schema);
      expect(definition.toolId).toBe(1);
    });

    it('should use default schema if not provided', () => {
      const tool = { id: 1, name: 'Simple', tool_type: 'test' };

      const definition = agent.buildToolDefinition(tool);

      expect(definition.parameters).toEqual({
        type: 'object',
        properties: {},
        required: []
      });
    });
  });

  describe('getAvailableTools', () => {
    it('should return tool info', () => {
      agent.loadedTools = [
        { id: 1, name: 'Tool1', description: 'First', type: 'search', inputSchema: {} },
        { id: 2, name: 'Tool2', description: 'Second', type: 'api', inputSchema: {} }
      ];

      const tools = agent.getAvailableTools();

      expect(tools).toHaveLength(2);
      expect(tools[0]).toEqual({
        id: 1,
        name: 'Tool1',
        description: 'First',
        type: 'search',
        inputSchema: {}
      });
    });
  });

  describe('executeTool', () => {
    it('should execute tool and return result', async () => {
      const mockExecute = jest.fn().mockResolvedValue({ data: 'result' });
      agent.loadedTools = [
        { id: 1, name: 'TestTool', instance: { execute: mockExecute } }
      ];

      const result = await agent.executeTool('TestTool', { input: 'test' });

      expect(result.success).toBe(true);
      expect(result.result).toEqual({ data: 'result' });
      expect(result.durationMs).toBeDefined();
    });

    it('should return error if tool not found', async () => {
      agent.loadedTools = [];

      const result = await agent.executeTool('NonExistent', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool not found');
    });

    it('should handle tool execution error', async () => {
      agent.loadedTools = [
        { id: 1, name: 'FailTool', instance: { execute: jest.fn().mockRejectedValue(new Error('Failed')) } }
      ];

      const result = await agent.executeTool('FailTool', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed');
    });
  });

  describe('buildOpenAIFunctions', () => {
    it('should build OpenAI function definitions', () => {
      agent.toolDefinitions = [
        { name: 'search', description: 'Search', parameters: { type: 'object' } }
      ];

      const functions = agent.buildOpenAIFunctions();

      expect(functions).toHaveLength(1);
      expect(functions[0]).toEqual({
        name: 'search',
        description: 'Search',
        parameters: { type: 'object' }
      });
    });
  });

  describe('buildAnthropicTools', () => {
    it('should build Anthropic tool definitions', () => {
      agent.toolDefinitions = [
        { name: 'search', description: 'Search', parameters: { type: 'object' } }
      ];

      const tools = agent.buildAnthropicTools();

      expect(tools).toHaveLength(1);
      expect(tools[0]).toEqual({
        name: 'search',
        description: 'Search',
        input_schema: { type: 'object' }
      });
    });
  });

  describe('getOpenAIClient/getAnthropicClient', () => {
    it('should create OpenAI client lazily', () => {
      const client = agent.getOpenAIClient();

      expect(OpenAI).toHaveBeenCalled();
      expect(agent.openaiClient).toBe(client);

      // Second call should return same instance
      const client2 = agent.getOpenAIClient();
      expect(client2).toBe(client);
    });

    it('should create Anthropic client lazily', () => {
      const client = agent.getAnthropicClient();

      expect(Anthropic).toHaveBeenCalled();
      expect(agent.anthropicClient).toBe(client);
    });
  });

  describe('execute', () => {
    it('should execute and return success', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [{ message: { content: '{"result": "success"}' } }],
        usage: { total_tokens: 100 }
      });
      OpenAI.mockImplementation(() => ({
        chat: { completions: { create: mockCreate } }
      }));

      const result = await agent.execute('Test input', null);

      expect(result.success).toBe(true);
      expect(result.output.type).toBe('json');
      expect(result.tokensUsed).toBe(100);
    });

    it('should return error on failure', async () => {
      OpenAI.mockImplementation(() => ({
        chat: { completions: { create: jest.fn().mockRejectedValue(new Error('API Error')) } }
      }));
      agent.openaiClient = null;

      const result = await agent.execute('Test', null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
    });
  });

  describe('buildPrompt', () => {
    it('should build basic prompt', () => {
      const prompt = agent.buildPrompt('Hello', null);

      expect(prompt.messages).toHaveLength(2);
      expect(prompt.messages[0].role).toBe('system');
      expect(prompt.messages[0].content).toBe('You are a test agent.');
      expect(prompt.messages[1].role).toBe('user');
      expect(prompt.messages[1].content).toBe('Hello');
    });

    it('should include context if provided', () => {
      const mockContext = {
        toPromptContext: () => 'Previous data: xyz',
        getMessagesFor: () => []
      };

      const prompt = agent.buildPrompt('Test', mockContext);

      expect(prompt.messages).toHaveLength(3);
      expect(prompt.messages[1].content).toContain('Previous context');
    });

    it('should stringify object input', () => {
      const prompt = agent.buildPrompt({ key: 'value' }, null);

      expect(prompt.messages[1].content).toBe('{"key":"value"}');
    });
  });

  describe('callLLM', () => {
    it('should call OpenAI for openai provider', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [{ message: { content: 'Response' } }]
      });
      agent.openaiClient = { chat: { completions: { create: mockCreate } } };

      await agent.callLLM({ messages: [] });

      expect(mockCreate).toHaveBeenCalled();
    });

    it('should call Anthropic for anthropic provider', async () => {
      agent.modelProvider = 'anthropic';
      const mockCreate = jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }]
      });
      agent.anthropicClient = { messages: { create: mockCreate } };

      await agent.callLLM({ messages: [{ role: 'user', content: 'Test' }] });

      expect(mockCreate).toHaveBeenCalled();
    });

    it('should throw for unsupported provider', async () => {
      agent.modelProvider = 'unknown';

      await expect(agent.callLLM({})).rejects.toThrow('Unsupported model provider');
    });
  });

  describe('callOpenAI', () => {
    it('should include tools if available', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [{ message: { content: 'OK', tool_calls: [] } }],
        usage: { total_tokens: 50 }
      });
      agent.openaiClient = { chat: { completions: { create: mockCreate } } };
      agent.toolDefinitions = [{ name: 'tool1', description: 'Test', parameters: {} }];

      await agent.callOpenAI({ messages: [] });

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        tools: expect.any(Array),
        tool_choice: 'auto'
      }));
    });
  });

  describe('callAnthropic', () => {
    it('should format messages for Anthropic', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 10, output_tokens: 20 }
      });
      agent.modelProvider = 'anthropic';
      agent.anthropicClient = { messages: { create: mockCreate } };

      const result = await agent.callAnthropic({
        messages: [
          { role: 'system', content: 'System prompt' },
          { role: 'user', content: 'User message' }
        ]
      });

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        system: 'System prompt',
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'user' })
        ])
      }));
      expect(result.tokensUsed).toBe(30);
    });

    it('should extract tool use blocks', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        content: [
          { type: 'text', text: 'Using tool' },
          { type: 'tool_use', id: 'tool_1', name: 'search', input: { q: 'test' } }
        ]
      });
      agent.anthropicClient = { messages: { create: mockCreate } };

      const result = await agent.callAnthropic({
        messages: [{ role: 'user', content: 'Search' }]
      });

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].function.name).toBe('search');
    });
  });

  describe('formatOutput', () => {
    it('should parse JSON content', () => {
      const response = { content: '{"key": "value"}' };

      const output = agent.formatOutput(response);

      expect(output.type).toBe('json');
      expect(output.data).toEqual({ key: 'value' });
    });

    it('should return text for non-JSON', () => {
      const response = { content: 'Plain text response' };

      const output = agent.formatOutput(response);

      expect(output.type).toBe('text');
      expect(output.data).toBe('Plain text response');
    });
  });

  describe('toJSON', () => {
    it('should serialize agent info', () => {
      const json = agent.toJSON();

      expect(json).toEqual({
        id: 1,
        name: 'TestAgent',
        role: 'test',
        modelProvider: 'openai',
        modelName: 'gpt-4',
        temperature: 0.5,
        maxTokens: 1024,
        capabilities: [],
        tools: []
      });
    });
  });
});
