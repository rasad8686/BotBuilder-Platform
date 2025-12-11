/**
 * AgentContext Tests
 * Tests for server/agents/core/AgentContext.js
 */

const AgentContext = require('../../../agents/core/AgentContext');

describe('AgentContext', () => {
  let context;

  beforeEach(() => {
    context = new AgentContext('exec_123');
  });

  describe('constructor', () => {
    it('should initialize with execution ID', () => {
      expect(context.executionId).toBe('exec_123');
    });

    it('should initialize empty collections', () => {
      expect(context.sharedMemory.size).toBe(0);
      expect(context.messageHistory).toEqual([]);
      expect(context.previousOutputs.size).toBe(0);
      expect(context.variables.size).toBe(0);
    });
  });

  describe('set/get', () => {
    it('should set and get values', () => {
      context.set('key1', 'value1');

      expect(context.get('key1')).toBe('value1');
    });

    it('should return default value for missing keys', () => {
      expect(context.get('missing', 'default')).toBe('default');
    });

    it('should return null as default', () => {
      expect(context.get('missing')).toBeNull();
    });

    it('should overwrite existing values', () => {
      context.set('key', 'old');
      context.set('key', 'new');

      expect(context.get('key')).toBe('new');
    });
  });

  describe('addMessage/getMessagesFor/getMessagesFrom', () => {
    it('should add message with timestamp', () => {
      context.addMessage({
        fromAgentId: 1,
        toAgentId: 2,
        type: 'data',
        content: 'Hello'
      });

      expect(context.messageHistory).toHaveLength(1);
      expect(context.messageHistory[0].timestamp).toBeDefined();
    });

    it('should get messages for specific agent', () => {
      context.addMessage({ fromAgentId: 1, toAgentId: 2, content: 'For 2' });
      context.addMessage({ fromAgentId: 1, toAgentId: 3, content: 'For 3' });

      const messages = context.getMessagesFor(2);

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('For 2');
    });

    it('should include broadcast messages', () => {
      context.addMessage({ fromAgentId: 1, toAgentId: '*', content: 'Broadcast' });
      context.addMessage({ fromAgentId: 1, toAgentId: 2, content: 'Direct' });

      const messages = context.getMessagesFor(2);

      expect(messages).toHaveLength(2);
    });

    it('should get messages from specific agent', () => {
      context.addMessage({ fromAgentId: 1, toAgentId: 2, content: 'From 1' });
      context.addMessage({ fromAgentId: 3, toAgentId: 2, content: 'From 3' });

      const messages = context.getMessagesFrom(1);

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('From 1');
    });
  });

  describe('addAgentOutput/getAgentOutput', () => {
    it('should add and get agent output', () => {
      context.addAgentOutput(1, { result: 'success' });

      expect(context.getAgentOutput(1)).toEqual({ result: 'success' });
    });

    it('should return null for missing output', () => {
      expect(context.getAgentOutput(999)).toBeNull();
    });

    it('should track previous agents', () => {
      context.setCurrentAgent({ id: 1, name: 'Agent1' });
      context.addAgentOutput(1, 'output1');

      expect(context.previousAgents).toHaveLength(1);
    });
  });

  describe('setVariable/getVariable', () => {
    it('should set and get variable', () => {
      context.setVariable('count', 10);

      expect(context.getVariable('count')).toBe(10);
    });

    it('should return default for missing variable', () => {
      expect(context.getVariable('missing', 0)).toBe(0);
    });

    it('should return null as default', () => {
      expect(context.getVariable('missing')).toBeNull();
    });
  });

  describe('setCurrentAgent', () => {
    it('should set current agent', () => {
      const agent = { id: 1, name: 'TestAgent' };
      context.setCurrentAgent(agent);

      expect(context.currentAgent).toBe(agent);
    });
  });

  describe('toPromptContext', () => {
    it('should generate empty context string', () => {
      const result = context.toPromptContext();

      expect(result).toBe('');
    });

    it('should include previous outputs', () => {
      context.addAgentOutput(1, 'Analysis result');

      const result = context.toPromptContext();

      expect(result).toContain('Previous agent outputs:');
      expect(result).toContain('Agent 1: Analysis result');
    });

    it('should include shared memory', () => {
      context.set('topic', 'AI');

      const result = context.toPromptContext();

      expect(result).toContain('Shared information:');
      expect(result).toContain('topic: AI');
    });

    it('should include variables', () => {
      context.setVariable('iteration', 3);

      const result = context.toPromptContext();

      expect(result).toContain('Variables:');
      expect(result).toContain('iteration: 3');
    });

    it('should stringify object values', () => {
      context.set('data', { key: 'value' });

      const result = context.toPromptContext();

      expect(result).toContain('{"key":"value"}');
    });
  });

  describe('toJSON', () => {
    it('should serialize context to JSON', () => {
      context.set('key', 'value');
      context.setVariable('var', 123);
      context.addMessage({ fromAgentId: 1, toAgentId: 2, content: 'test' });

      const json = context.toJSON();

      expect(json.executionId).toBe('exec_123');
      expect(json.sharedMemory.key).toBe('value');
      expect(json.variables.var).toBe(123);
      expect(json.messageHistory).toHaveLength(1);
    });

    it('should serialize current agent with toJSON', () => {
      const agent = {
        id: 1,
        toJSON: () => ({ id: 1, serialized: true })
      };
      context.setCurrentAgent(agent);

      const json = context.toJSON();

      expect(json.currentAgent.serialized).toBe(true);
    });
  });

  describe('fromJSON', () => {
    it('should restore context from JSON', () => {
      const json = {
        executionId: 'exec_456',
        sharedMemory: { key: 'value' },
        messageHistory: [{ content: 'test' }],
        previousOutputs: { 1: 'output1' },
        variables: { count: 5 },
        currentAgent: { id: 1 },
        previousAgents: [{ id: 2 }]
      };

      const restored = AgentContext.fromJSON(json);

      expect(restored.executionId).toBe('exec_456');
      expect(restored.get('key')).toBe('value');
      expect(restored.messageHistory).toHaveLength(1);
      expect(restored.getAgentOutput('1')).toBe('output1');
      expect(restored.getVariable('count')).toBe(5);
      expect(restored.currentAgent).toEqual({ id: 1 });
      expect(restored.previousAgents).toHaveLength(1);
    });

    it('should handle missing optional fields', () => {
      const json = { executionId: 'exec_789' };

      const restored = AgentContext.fromJSON(json);

      expect(restored.executionId).toBe('exec_789');
      expect(restored.messageHistory).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should clear all data', () => {
      context.set('key', 'value');
      context.setVariable('var', 123);
      context.addMessage({ content: 'test' });
      context.setCurrentAgent({ id: 1 });
      context.addAgentOutput(1, 'output');

      context.clear();

      expect(context.sharedMemory.size).toBe(0);
      expect(context.variables.size).toBe(0);
      expect(context.messageHistory).toEqual([]);
      expect(context.currentAgent).toBeNull();
      expect(context.previousAgents).toEqual([]);
      expect(context.previousOutputs.size).toBe(0);
    });
  });
});
