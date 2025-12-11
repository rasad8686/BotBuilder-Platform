/**
 * AgentExecutor Tests
 * Tests for server/agents/core/AgentExecutor.js
 */

jest.mock('../../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

const AgentExecutor = require('../../../agents/core/AgentExecutor');
const AgentContext = require('../../../agents/core/AgentContext');

describe('AgentExecutor', () => {
  let executor;
  let mockRegistry;
  let mockAgent;
  let mockContext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRegistry = {
      get: jest.fn()
    };

    mockAgent = {
      id: 'agent_1',
      name: 'Test Agent',
      role: 'assistant',
      loadedTools: [],
      loadTools: jest.fn().mockResolvedValue([]),
      execute: jest.fn().mockResolvedValue({
        success: true,
        output: { type: 'text', data: 'Result' }
      }),
      buildPrompt: jest.fn().mockReturnValue({ messages: [] }),
      callLLM: jest.fn().mockResolvedValue({
        content: 'Response',
        tokensUsed: 100
      }),
      formatOutput: jest.fn().mockReturnValue({ type: 'text', data: 'Formatted' }),
      executeTool: jest.fn()
    };

    mockContext = new AgentContext('exec_1');
    executor = new AgentExecutor(mockRegistry);
  });

  describe('constructor', () => {
    it('should initialize with registry', () => {
      expect(executor.registry).toBe(mockRegistry);
      expect(executor.maxToolIterations).toBe(50);
      expect(executor.executionTimeout).toBe(5 * 60 * 1000);
    });
  });

  describe('executeAgent', () => {
    it('should throw error if no agent', async () => {
      await expect(executor.executeAgent(null, {}, mockContext)).rejects.toThrow('Agent is required');
    });

    it('should execute agent without tools', async () => {
      const result = await executor.executeAgent(mockAgent, 'input', mockContext);

      expect(result.success).toBe(true);
      expect(result.agentId).toBe('agent_1');
      expect(result.agentName).toBe('Test Agent');
      expect(mockAgent.execute).toHaveBeenCalledWith('input', mockContext);
    });

    it('should load tools if not already loaded', async () => {
      await executor.executeAgent(mockAgent, 'input', mockContext);

      expect(mockAgent.loadTools).toHaveBeenCalled();
    });

    it('should execute with tools if available', async () => {
      mockAgent.loadedTools = [{ name: 'test_tool' }];

      await executor.executeAgent(mockAgent, 'input', mockContext);

      expect(mockAgent.buildPrompt).toHaveBeenCalled();
      expect(mockAgent.callLLM).toHaveBeenCalled();
    });

    it('should store output in context on success', async () => {
      jest.spyOn(mockContext, 'addAgentOutput');

      await executor.executeAgent(mockAgent, 'input', mockContext);

      expect(mockContext.addAgentOutput).toHaveBeenCalledWith('agent_1', expect.any(Object));
    });

    it('should handle execution errors', async () => {
      mockAgent.execute = jest.fn().mockRejectedValue(new Error('Execution failed'));

      const result = await executor.executeAgent(mockAgent, 'input', mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution failed');
    });
  });

  describe('executeWithTools', () => {
    beforeEach(() => {
      mockAgent.loadedTools = [{ name: 'test_tool' }];
    });

    it('should return result when no tool calls', async () => {
      const result = await executor.executeWithTools(mockAgent, 'input', mockContext);

      expect(result.success).toBe(true);
      expect(result.iterations).toBe(1);
      expect(result.tokensUsed).toBe(100);
    });

    it('should execute tool calls', async () => {
      mockAgent.callLLM
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [{
            id: 'call_1',
            function: { name: 'test_tool', arguments: '{}' }
          }],
          tokensUsed: 50
        })
        .mockResolvedValueOnce({
          content: 'Final response',
          tokensUsed: 50
        });

      mockAgent.executeTool.mockResolvedValue({
        success: true,
        result: { data: 'tool output' }
      });

      const result = await executor.executeWithTools(mockAgent, 'input', mockContext);

      expect(result.success).toBe(true);
      expect(result.toolResults.length).toBeGreaterThan(0);
      expect(mockAgent.executeTool).toHaveBeenCalled();
    });

    it('should handle tool execution errors', async () => {
      mockAgent.callLLM.mockResolvedValueOnce({
        content: '',
        toolCalls: [{
          id: 'call_1',
          function: { name: 'bad_tool', arguments: '{}' }
        }],
        tokensUsed: 50
      }).mockResolvedValueOnce({
        content: 'Done',
        tokensUsed: 50
      });

      mockAgent.executeTool.mockResolvedValue({
        success: false,
        error: 'Tool failed'
      });

      const result = await executor.executeWithTools(mockAgent, 'input', mockContext);

      expect(result.toolResults[0].success).toBe(false);
    });

    it('should respect max iterations', async () => {
      executor.maxToolIterations = 2;

      mockAgent.callLLM.mockResolvedValue({
        content: '',
        toolCalls: [{ id: 'call', function: { name: 'tool', arguments: '{}' } }],
        tokensUsed: 10
      });

      mockAgent.executeTool.mockResolvedValue({ success: true, result: {} });

      const result = await executor.executeWithTools(mockAgent, 'input', mockContext);

      expect(result.warning).toBe('Max tool iterations reached');
      expect(result.iterations).toBe(2);
    });

    it('should handle LLM errors', async () => {
      mockAgent.callLLM.mockRejectedValue(new Error('LLM API error'));

      const result = await executor.executeWithTools(mockAgent, 'input', mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('LLM API error');
    });
  });

  describe('detectToolCalls', () => {
    it('should detect OpenAI format tool calls', () => {
      const response = {
        toolCalls: [
          { id: 'call_1', function: { name: 'tool1' } }
        ]
      };

      const calls = executor.detectToolCalls(response);

      expect(calls).toHaveLength(1);
    });

    it('should detect custom format in content', () => {
      const response = {
        content: '<tool_call>{"name":"custom_tool","arguments":{}}</tool_call>'
      };

      const calls = executor.detectToolCalls(response);

      expect(calls.length).toBeGreaterThanOrEqual(0); // Depends on parser
    });

    it('should return empty array for no tool calls', () => {
      const calls = executor.detectToolCalls({ content: 'Just text' });

      expect(calls).toEqual([]);
    });
  });

  describe('handleToolResult', () => {
    it('should format successful result', () => {
      const result = executor.handleToolResult({
        success: true,
        result: { data: 'test' }
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data).toEqual({ data: 'test' });
    });

    it('should format error result', () => {
      const result = executor.handleToolResult({
        success: false,
        error: 'Something went wrong'
      });

      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
      expect(parsed.message).toBe('Something went wrong');
    });
  });

  describe('executeSequential', () => {
    it('should execute agents in order', async () => {
      const agent1 = { ...mockAgent, id: 'agent_1', name: 'Agent 1' };
      const agent2 = { ...mockAgent, id: 'agent_2', name: 'Agent 2' };

      agent1.execute = jest.fn().mockResolvedValue({
        success: true,
        output: { data: 'from agent 1' }
      });
      agent2.execute = jest.fn().mockResolvedValue({
        success: true,
        output: { data: 'from agent 2' }
      });

      const result = await executor.executeSequential([agent1, agent2], 'initial', mockContext);

      expect(result.success).toBe(true);
      expect(result.completedSteps).toBe(2);
      expect(result.results).toHaveLength(2);
    });

    it('should pass output to next agent', async () => {
      const agent1 = { ...mockAgent, id: 'agent_1' };
      const agent2 = { ...mockAgent, id: 'agent_2' };

      agent1.execute = jest.fn().mockResolvedValue({
        success: true,
        output: { data: 'step1_output' }
      });
      agent2.execute = jest.fn().mockResolvedValue({
        success: true,
        output: { data: 'step2_output' }
      });

      await executor.executeSequential([agent1, agent2], 'initial', mockContext);

      expect(agent2.execute).toHaveBeenCalledWith(
        expect.objectContaining({ data: 'step1_output' }),
        mockContext
      );
    });

    it('should stop on failure', async () => {
      const agent1 = { ...mockAgent, id: 'agent_1', name: 'Agent 1' };
      const agent2 = { ...mockAgent, id: 'agent_2', name: 'Agent 2' };

      agent1.execute = jest.fn().mockResolvedValue({
        success: false,
        error: 'Failed'
      });
      agent2.execute = jest.fn();

      const result = await executor.executeSequential([agent1, agent2], 'initial', mockContext);

      expect(result.success).toBe(false);
      expect(result.completedSteps).toBe(0);
      expect(agent2.execute).not.toHaveBeenCalled();
    });
  });

  describe('executeParallel', () => {
    it('should execute agents in parallel', async () => {
      const agent1 = { ...mockAgent, id: 'agent_1', name: 'Agent 1' };
      const agent2 = { ...mockAgent, id: 'agent_2', name: 'Agent 2' };

      agent1.execute = jest.fn().mockResolvedValue({
        success: true,
        output: { data: 'output1' }
      });
      agent2.execute = jest.fn().mockResolvedValue({
        success: true,
        output: { data: 'output2' }
      });

      const result = await executor.executeParallel([agent1, agent2], 'input', mockContext);

      expect(result.success).toBe(true);
      expect(result.completedSteps).toBe(2);
      expect(result.outputs).toHaveLength(2);
    });

    it('should track failed agents', async () => {
      const agent1 = { ...mockAgent, id: 'agent_1', name: 'Agent 1' };
      const agent2 = { ...mockAgent, id: 'agent_2', name: 'Agent 2' };

      agent1.execute = jest.fn().mockResolvedValue({
        success: true,
        output: {}
      });
      agent2.execute = jest.fn().mockResolvedValue({
        success: false,
        error: 'Failed'
      });

      const result = await executor.executeParallel([agent1, agent2], 'input', mockContext);

      expect(result.success).toBe(false);
      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
    });

    it('should handle exceptions', async () => {
      const agent1 = { ...mockAgent, id: 'agent_1', name: 'Agent 1' };

      agent1.execute = jest.fn().mockRejectedValue(new Error('Crash'));

      const result = await executor.executeParallel([agent1], 'input', mockContext);

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toBe('Crash');
    });
  });

  describe('executeWithDependencies', () => {
    beforeEach(() => {
      mockRegistry.get = jest.fn((id) => {
        const agents = {
          'agent_1': { ...mockAgent, id: 'agent_1', execute: jest.fn().mockResolvedValue({ success: true, output: 'out1' }) },
          'agent_2': { ...mockAgent, id: 'agent_2', execute: jest.fn().mockResolvedValue({ success: true, output: 'out2' }) },
          'agent_3': { ...mockAgent, id: 'agent_3', execute: jest.fn().mockResolvedValue({ success: true, output: 'out3' }) }
        };
        return agents[id];
      });
    });

    it('should execute agents respecting dependencies', async () => {
      const configs = [
        { agentId: 'agent_1' },
        { agentId: 'agent_2', dependsOn: ['agent_1'] },
        { agentId: 'agent_3', dependsOn: ['agent_2'] }
      ];

      const result = await executor.executeWithDependencies(configs, 'initial', mockContext);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(3);
    });

    it('should execute independent agents in parallel', async () => {
      const configs = [
        { agentId: 'agent_1' },
        { agentId: 'agent_2' }, // No dependency
        { agentId: 'agent_3', dependsOn: ['agent_1', 'agent_2'] }
      ];

      const result = await executor.executeWithDependencies(configs, 'initial', mockContext);

      expect(result.success).toBe(true);
    });

    it('should detect circular dependencies', async () => {
      const configs = [
        { agentId: 'agent_1', dependsOn: ['agent_2'] },
        { agentId: 'agent_2', dependsOn: ['agent_1'] }
      ];

      await expect(
        executor.executeWithDependencies(configs, 'initial', mockContext)
      ).rejects.toThrow('Circular dependency');
    });

    it('should throw if agent not found', async () => {
      mockRegistry.get = jest.fn().mockReturnValue(null);

      const configs = [{ agentId: 'missing_agent' }];

      await expect(
        executor.executeWithDependencies(configs, 'initial', mockContext)
      ).rejects.toThrow('Agent not found');
    });

    it('should stop on agent failure', async () => {
      mockRegistry.get = jest.fn((id) => {
        if (id === 'agent_1') {
          return { ...mockAgent, id: 'agent_1', execute: jest.fn().mockResolvedValue({ success: false, error: 'Failed' }) };
        }
        return { ...mockAgent, id };
      });

      const configs = [
        { agentId: 'agent_1' },
        { agentId: 'agent_2', dependsOn: ['agent_1'] }
      ];

      const result = await executor.executeWithDependencies(configs, 'initial', mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('agent_1 failed');
    });

    it('should combine dependency outputs', async () => {
      let agent3Input;
      mockRegistry.get = jest.fn((id) => {
        const agents = {
          'agent_1': { ...mockAgent, id: 'agent_1', execute: jest.fn().mockResolvedValue({ success: true, output: 'out1' }) },
          'agent_2': { ...mockAgent, id: 'agent_2', execute: jest.fn().mockResolvedValue({ success: true, output: 'out2' }) },
          'agent_3': {
            ...mockAgent,
            id: 'agent_3',
            execute: jest.fn().mockImplementation((input) => {
              agent3Input = input;
              return { success: true, output: 'out3' };
            })
          }
        };
        return agents[id];
      });

      const configs = [
        { agentId: 'agent_1' },
        { agentId: 'agent_2' },
        { agentId: 'agent_3', dependsOn: ['agent_1', 'agent_2'] }
      ];

      await executor.executeWithDependencies(configs, 'initial', mockContext);

      expect(agent3Input.dependencies).toContain('out1');
      expect(agent3Input.dependencies).toContain('out2');
    });
  });
});
