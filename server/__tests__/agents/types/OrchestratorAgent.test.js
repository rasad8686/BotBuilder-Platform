/**
 * OrchestratorAgent Tests
 * Tests for server/agents/types/OrchestratorAgent.js
 */

jest.mock('openai', () => jest.fn());
jest.mock('@anthropic-ai/sdk', () => jest.fn());
jest.mock('../../../models/AgentTool', () => ({ findEnabledByAgentId: jest.fn() }));
jest.mock('../../../models/Tool', () => ({ findById: jest.fn() }));
jest.mock('../../../tools/types', () => ({ createTool: jest.fn() }));
jest.mock('../../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

const OrchestratorAgent = require('../../../agents/types/OrchestratorAgent');

describe('OrchestratorAgent', () => {
  let orchestratorAgent;

  beforeEach(() => {
    orchestratorAgent = new OrchestratorAgent({
      id: 1,
      name: 'WorkflowOrchestrator'
    });
  });

  describe('constructor', () => {
    it('should set default role to orchestrator', () => {
      expect(orchestratorAgent.role).toBe('orchestrator');
    });

    it('should use custom role if provided', () => {
      const agent = new OrchestratorAgent({
        id: 2,
        role: 'coordinator'
      });

      expect(agent.role).toBe('coordinator');
    });

    it('should set default system prompt', () => {
      expect(orchestratorAgent.systemPrompt).toContain('orchestrator agent');
    });

    it('should use custom system prompt if provided', () => {
      const agent = new OrchestratorAgent({
        id: 2,
        systemPrompt: 'Custom orchestrator prompt'
      });

      expect(agent.systemPrompt).toBe('Custom orchestrator prompt');
    });

    it('should initialize empty availableAgents array', () => {
      expect(orchestratorAgent.availableAgents).toEqual([]);
    });

    it('should accept availableAgents in config', () => {
      const agents = [{ id: 1, name: 'Agent1' }];
      const agent = new OrchestratorAgent({
        id: 1,
        availableAgents: agents
      });

      expect(agent.availableAgents).toEqual(agents);
    });
  });

  describe('setAvailableAgents', () => {
    it('should set available agents', () => {
      const agents = [
        { id: 1, name: 'Writer', role: 'writer' },
        { id: 2, name: 'Researcher', role: 'researcher' }
      ];

      orchestratorAgent.setAvailableAgents(agents);

      expect(orchestratorAgent.availableAgents).toEqual(agents);
    });
  });

  describe('buildPrompt', () => {
    it('should include available agents in prompt', () => {
      orchestratorAgent.setAvailableAgents([
        { id: 1, name: 'Writer', role: 'writer', capabilities: ['blog', 'email'] }
      ]);

      const prompt = orchestratorAgent.buildPrompt('Orchestrate task', null);

      const agentsMessage = prompt.messages.find(m =>
        m.content && m.content.includes('Available agents for delegation')
      );
      expect(agentsMessage).toBeDefined();
      expect(agentsMessage.content).toContain('Writer');
      expect(agentsMessage.content).toContain('writer');
    });

    it('should include available tools in prompt', () => {
      orchestratorAgent.loadedTools = [
        { name: 'http_tool', type: 'http_request', description: 'Make HTTP requests' }
      ];

      const prompt = orchestratorAgent.buildPrompt('Do something', null);

      const toolsMessage = prompt.messages.find(m =>
        m.content && m.content.includes('Available tools')
      );
      expect(toolsMessage).toBeDefined();
      expect(toolsMessage.content).toContain('http_tool');
    });

    it('should handle agents without capabilities', () => {
      orchestratorAgent.setAvailableAgents([
        { id: 1, name: 'Generic', role: 'generic' }
      ]);

      const prompt = orchestratorAgent.buildPrompt('Task', null);

      const agentsMessage = prompt.messages.find(m =>
        m.content && m.content.includes('General purpose')
      );
      expect(agentsMessage).toBeDefined();
    });
  });

  describe('routeToolCall', () => {
    beforeEach(() => {
      orchestratorAgent.loadedTools = [
        { name: 'api_call', type: 'http_request' },
        { name: 'scraper', type: 'web_scraper' },
        { name: 'db_query', type: 'database_query' },
        { name: 'code_run', type: 'code_execution' },
        { name: 'send_mail', type: 'email' }
      ];

      orchestratorAgent.setAvailableAgents([
        { id: 'researcher_1', role: 'researcher', name: 'Researcher' },
        { id: 'analyzer_1', role: 'analyzer', name: 'Analyzer' },
        { id: 'writer_1', role: 'writer', name: 'Writer' }
      ]);
    });

    it('should return error for non-existent tool', () => {
      const result = orchestratorAgent.routeToolCall('non_existent', {});

      expect(result.routed).toBe(false);
      expect(result.error).toContain('Tool not found');
    });

    it('should route to specified target role', () => {
      const result = orchestratorAgent.routeToolCall('api_call', { url: 'test' }, 'researcher');

      expect(result.routed).toBe(true);
      expect(result.targetAgent).toBe('researcher_1');
      expect(result.tool).toBe('api_call');
    });

    it('should auto-route http_request to researcher', () => {
      const result = orchestratorAgent.routeToolCall('api_call', {});

      expect(result.routed).toBe(true);
      expect(result.targetAgent).toBe('researcher_1');
      expect(result.autoRouted).toBe(true);
    });

    it('should auto-route web_scraper to researcher', () => {
      const result = orchestratorAgent.routeToolCall('scraper', {});

      expect(result.routed).toBe(true);
      expect(result.targetAgent).toBe('researcher_1');
    });

    it('should auto-route database_query to analyzer', () => {
      const result = orchestratorAgent.routeToolCall('db_query', {});

      expect(result.routed).toBe(true);
      expect(result.targetAgent).toBe('analyzer_1');
    });

    it('should auto-route code_execution to analyzer', () => {
      const result = orchestratorAgent.routeToolCall('code_run', {});

      expect(result.routed).toBe(true);
      expect(result.targetAgent).toBe('analyzer_1');
    });

    it('should auto-route email to writer', () => {
      const result = orchestratorAgent.routeToolCall('send_mail', {});

      expect(result.routed).toBe(true);
      expect(result.targetAgent).toBe('writer_1');
    });

    it('should execute locally if no matching agent', () => {
      orchestratorAgent.setAvailableAgents([]);
      orchestratorAgent.loadedTools = [{ name: 'custom_tool', type: 'custom' }];

      const result = orchestratorAgent.routeToolCall('custom_tool', {});

      expect(result.routed).toBe(false);
      expect(result.executeLocally).toBe(true);
    });
  });

  describe('parseOrchestrationPlan', () => {
    it('should parse JSON output', () => {
      const output = {
        type: 'json',
        data: {
          taskAnalysis: 'Test task',
          complexity: 'moderate',
          subtasks: [{ id: '1', description: 'Subtask 1' }],
          executionStrategy: 'sequential'
        }
      };

      const result = orchestratorAgent.parseOrchestrationPlan(output);

      expect(result.valid).toBe(true);
      expect(result.plan.taskAnalysis).toBe('Test task');
      expect(result.plan.complexity).toBe('moderate');
    });

    it('should parse raw JSON string', () => {
      const output = {
        type: 'text',
        raw: '{"taskAnalysis": "Parse test", "executionStrategy": "parallel"}'
      };

      const result = orchestratorAgent.parseOrchestrationPlan(output);

      expect(result.valid).toBe(true);
      expect(result.plan.executionStrategy).toBe('parallel');
    });

    it('should handle parse errors', () => {
      const output = {
        type: 'text',
        raw: 'Not valid JSON plan'
      };

      const result = orchestratorAgent.parseOrchestrationPlan(output);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Failed to parse orchestration plan');
      expect(result.raw).toBe('Not valid JSON plan');
    });
  });
});
