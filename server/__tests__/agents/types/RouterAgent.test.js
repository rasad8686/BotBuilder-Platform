/**
 * RouterAgent Tests
 * Tests for server/agents/types/RouterAgent.js
 */

// Mock the base Agent class dependencies
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

const RouterAgent = require('../../../agents/types/RouterAgent');

describe('RouterAgent', () => {
  let routerAgent;

  beforeEach(() => {
    routerAgent = new RouterAgent({
      id: 1,
      name: 'IntentRouter'
    });
  });

  describe('constructor', () => {
    it('should set default role to router', () => {
      expect(routerAgent.role).toBe('router');
    });

    it('should use custom role if provided', () => {
      const customAgent = new RouterAgent({
        id: 2,
        role: 'classifier'
      });

      expect(customAgent.role).toBe('classifier');
    });

    it('should set default system prompt', () => {
      expect(routerAgent.systemPrompt).toContain('routing agent specialized in intent detection');
    });

    it('should initialize empty routes', () => {
      expect(routerAgent.routes).toEqual([]);
    });

    it('should accept custom routes', () => {
      const routes = [
        { intent: 'greeting', target: 'greet_agent' }
      ];
      const agent = new RouterAgent({
        id: 1,
        routes
      });

      expect(agent.routes).toEqual(routes);
    });

    it('should initialize defaultRoute as null', () => {
      expect(routerAgent.defaultRoute).toBeNull();
    });

    it('should accept custom defaultRoute', () => {
      const agent = new RouterAgent({
        id: 1,
        defaultRoute: { agent: 'fallback' }
      });

      expect(agent.defaultRoute).toEqual({ agent: 'fallback' });
    });
  });

  describe('setRoutes', () => {
    it('should set routes', () => {
      const routes = [
        { intent: 'support', target: 'support_agent' },
        { intent: 'sales', target: 'sales_agent' }
      ];

      routerAgent.setRoutes(routes);

      expect(routerAgent.routes).toEqual(routes);
    });
  });

  describe('setDefaultRoute', () => {
    it('should set default route', () => {
      const defaultRoute = { agent: 'general' };

      routerAgent.setDefaultRoute(defaultRoute);

      expect(routerAgent.defaultRoute).toEqual(defaultRoute);
    });
  });

  describe('buildPrompt', () => {
    it('should include routes info in prompt', () => {
      routerAgent.setRoutes([
        { intent: 'billing', target: 'billing_agent', description: 'Handles billing' },
        { category: 'technical', target: 'tech_agent', description: 'Tech support' }
      ]);
      routerAgent.setDefaultRoute({ target: 'general' });

      const prompt = routerAgent.buildPrompt('Route this', null);

      const routesMessage = prompt.messages.find(m =>
        m.content && m.content.includes('Available routes:')
      );
      expect(routesMessage).toBeDefined();
      expect(routesMessage.content).toContain('billing: Route to billing_agent');
      expect(routesMessage.content).toContain('Default route: general');
    });

    it('should not include routes info if no routes', () => {
      const prompt = routerAgent.buildPrompt('Route this', null);

      const routesMessage = prompt.messages.find(m =>
        m.content && m.content.includes('Available routes:')
      );
      expect(routesMessage).toBeUndefined();
    });
  });

  describe('parseRouting', () => {
    it('should parse JSON routing decision', () => {
      const output = {
        type: 'json',
        data: {
          intent: { primary: 'support', confidence: 0.95 },
          routing: { targetAgent: 'support_agent' }
        }
      };

      const result = routerAgent.parseRouting(output);

      expect(result.valid).toBe(true);
      expect(result.routing.intent.primary).toBe('support');
    });

    it('should parse raw JSON string', () => {
      const output = {
        type: 'text',
        raw: '{"routing": {"targetWorkflow": "onboarding"}}'
      };

      const result = routerAgent.parseRouting(output);

      expect(result.valid).toBe(true);
      expect(result.routing.routing.targetWorkflow).toBe('onboarding');
    });

    it('should return invalid for non-JSON', () => {
      const output = {
        type: 'text',
        raw: 'Invalid response'
      };

      const result = routerAgent.parseRouting(output);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Failed to parse routing decision');
    });
  });

  describe('getTarget', () => {
    it('should extract target from routing decision', () => {
      const routing = {
        routing: {
          targetAgent: 'sales_agent',
          targetWorkflow: 'sales_flow',
          priority: 'high'
        }
      };

      const target = routerAgent.getTarget(routing);

      expect(target).toEqual({
        agent: 'sales_agent',
        workflow: 'sales_flow',
        priority: 'high'
      });
    });

    it('should use normal priority as default', () => {
      const routing = {
        routing: {
          targetAgent: 'agent1'
        }
      };

      const target = routerAgent.getTarget(routing);

      expect(target.priority).toBe('normal');
    });

    it('should use default route if no routing in decision', () => {
      routerAgent.setDefaultRoute({
        agent: 'fallback_agent',
        workflow: 'fallback_flow'
      });

      const target = routerAgent.getTarget({});

      expect(target).toEqual({
        agent: 'fallback_agent',
        workflow: 'fallback_flow',
        priority: 'normal'
      });
    });

    it('should return null if no routing and no default', () => {
      const target = routerAgent.getTarget({});

      expect(target).toBeNull();
    });
  });

  describe('needsClarification', () => {
    it('should return true when clarification required', () => {
      const routing = { requiresClarification: true };

      expect(routerAgent.needsClarification(routing)).toBe(true);
    });

    it('should return false when not required', () => {
      const routing = { requiresClarification: false };

      expect(routerAgent.needsClarification(routing)).toBe(false);
    });

    it('should return false when undefined', () => {
      expect(routerAgent.needsClarification({})).toBe(false);
    });
  });

  describe('getClarificationQuestion', () => {
    it('should return clarification question', () => {
      const routing = {
        clarificationQuestion: 'Do you mean billing or support?'
      };

      expect(routerAgent.getClarificationQuestion(routing)).toBe('Do you mean billing or support?');
    });

    it('should return null if no question', () => {
      expect(routerAgent.getClarificationQuestion({})).toBeNull();
    });
  });
});
