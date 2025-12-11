/**
 * ResearcherAgent Tests
 * Tests for server/agents/types/ResearcherAgent.js
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

const ResearcherAgent = require('../../../agents/types/ResearcherAgent');

describe('ResearcherAgent', () => {
  let researcherAgent;

  beforeEach(() => {
    researcherAgent = new ResearcherAgent({
      id: 1,
      name: 'DataResearcher'
    });
  });

  describe('constructor', () => {
    it('should set default role to researcher', () => {
      expect(researcherAgent.role).toBe('researcher');
    });

    it('should use custom role if provided', () => {
      const agent = new ResearcherAgent({
        id: 2,
        role: 'data-gatherer'
      });

      expect(agent.role).toBe('data-gatherer');
    });

    it('should set default system prompt', () => {
      expect(researcherAgent.systemPrompt).toContain('research agent');
    });

    it('should use custom system prompt if provided', () => {
      const agent = new ResearcherAgent({
        id: 2,
        systemPrompt: 'Custom researcher prompt'
      });

      expect(agent.systemPrompt).toBe('Custom researcher prompt');
    });

    it('should initialize knowledgeBase as null', () => {
      expect(researcherAgent.knowledgeBase).toBeNull();
    });

    it('should accept knowledgeBase in config', () => {
      const kb = { documents: [] };
      const agent = new ResearcherAgent({
        id: 1,
        knowledgeBase: kb
      });

      expect(agent.knowledgeBase).toEqual(kb);
    });
  });

  describe('setKnowledgeBase', () => {
    it('should set knowledge base', () => {
      const kb = { id: 1, name: 'Test KB' };
      researcherAgent.setKnowledgeBase(kb);

      expect(researcherAgent.knowledgeBase).toEqual(kb);
    });
  });

  describe('buildPrompt', () => {
    it('should include knowledge base in prompt when set', () => {
      researcherAgent.setKnowledgeBase({ topic: 'AI' });

      const prompt = researcherAgent.buildPrompt('Research topic', null);

      const kbMessage = prompt.messages.find(m =>
        m.content && m.content.includes('Available knowledge base')
      );
      expect(kbMessage).toBeDefined();
    });

    it('should include research tools in prompt', () => {
      researcherAgent.loadedTools = [
        { name: 'api_search', type: 'http_request', description: 'Search API' },
        { name: 'web_scrape', type: 'web_scraper', description: 'Scrape web' }
      ];

      const prompt = researcherAgent.buildPrompt('Research something', null);

      const toolsMessage = prompt.messages.find(m =>
        m.content && m.content.includes('Research tools available')
      );
      expect(toolsMessage).toBeDefined();
      expect(toolsMessage.content).toContain('api_search');
      expect(toolsMessage.content).toContain('web_scrape');
    });

    it('should only include research-related tools', () => {
      researcherAgent.loadedTools = [
        { name: 'api_search', type: 'http_request' },
        { name: 'email_send', type: 'email' },
        { name: 'code_run', type: 'code_execution' }
      ];

      const prompt = researcherAgent.buildPrompt('Research', null);

      const toolsMessage = prompt.messages.find(m =>
        m.content && m.content.includes('Research tools available')
      );

      if (toolsMessage) {
        expect(toolsMessage.content).toContain('api_search');
        expect(toolsMessage.content).not.toContain('email_send');
        expect(toolsMessage.content).not.toContain('code_run');
      }
    });

    it('should not include tools section if no research tools', () => {
      researcherAgent.loadedTools = [
        { name: 'email_send', type: 'email' }
      ];

      const prompt = researcherAgent.buildPrompt('Research', null);

      const toolsMessage = prompt.messages.find(m =>
        m.content && m.content.includes('Research tools available')
      );
      expect(toolsMessage).toBeUndefined();
    });
  });

  describe('executeResearch', () => {
    beforeEach(() => {
      researcherAgent.loadTools = jest.fn().mockResolvedValue();
      researcherAgent.executeTool = jest.fn();
    });

    it('should load tools if not loaded', async () => {
      researcherAgent.loadedTools = [];

      await researcherAgent.executeResearch('test query', {});

      expect(researcherAgent.loadTools).toHaveBeenCalled();
    });

    it('should not reload tools if already loaded', async () => {
      researcherAgent.loadedTools = [{ name: 'tool', type: 'http_request' }];

      await researcherAgent.executeResearch('test query', {});

      expect(researcherAgent.loadTools).not.toHaveBeenCalled();
    });

    it('should execute http and scraper tools', async () => {
      researcherAgent.loadedTools = [
        { name: 'http_tool', type: 'http_request' },
        { name: 'scraper_tool', type: 'web_scraper' }
      ];
      researcherAgent.executeTool.mockResolvedValue({ success: true, result: 'data' });

      const result = await researcherAgent.executeResearch('query', {});

      expect(researcherAgent.executeTool).toHaveBeenCalledTimes(2);
      expect(result.toolResults).toHaveLength(2);
    });

    it('should limit to 3 tools', async () => {
      researcherAgent.loadedTools = [
        { name: 'tool1', type: 'http_request' },
        { name: 'tool2', type: 'http_request' },
        { name: 'tool3', type: 'web_scraper' },
        { name: 'tool4', type: 'web_scraper' }
      ];
      researcherAgent.executeTool.mockResolvedValue({ success: true, result: 'data' });

      const result = await researcherAgent.executeResearch('query', {});

      expect(researcherAgent.executeTool).toHaveBeenCalledTimes(3);
    });

    it('should handle tool failures gracefully', async () => {
      researcherAgent.loadedTools = [
        { name: 'failing_tool', type: 'http_request' }
      ];
      researcherAgent.executeTool.mockRejectedValue(new Error('Tool failed'));

      const result = await researcherAgent.executeResearch('query', {});

      expect(result.toolResults).toHaveLength(0);
      expect(result.toolCount).toBe(0);
    });

    it('should skip unsuccessful tool results', async () => {
      researcherAgent.loadedTools = [
        { name: 'tool1', type: 'http_request' }
      ];
      researcherAgent.executeTool.mockResolvedValue({ success: false, error: 'Failed' });

      const result = await researcherAgent.executeResearch('query', {});

      expect(result.toolResults).toHaveLength(0);
    });

    it('should return query and results', async () => {
      researcherAgent.loadedTools = [];

      const result = await researcherAgent.executeResearch('my query', {});

      expect(result.query).toBe('my query');
      expect(result.toolResults).toBeDefined();
      expect(result.toolCount).toBeDefined();
    });
  });

  describe('parseResearchResults', () => {
    it('should parse JSON output', () => {
      const output = {
        type: 'json',
        data: {
          query: 'Test query',
          findings: [{ topic: 'AI', summary: 'AI findings' }],
          synthesis: 'Overall summary'
        }
      };

      const result = researcherAgent.parseResearchResults(output);

      expect(result.valid).toBe(true);
      expect(result.results.query).toBe('Test query');
      expect(result.results.findings).toHaveLength(1);
    });

    it('should parse raw JSON string', () => {
      const output = {
        type: 'text',
        raw: '{"query": "Raw test", "synthesis": "Summary"}'
      };

      const result = researcherAgent.parseResearchResults(output);

      expect(result.valid).toBe(true);
      expect(result.results.synthesis).toBe('Summary');
    });

    it('should handle parse errors', () => {
      const output = {
        type: 'text',
        raw: 'Not valid JSON research'
      };

      const result = researcherAgent.parseResearchResults(output);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Failed to parse research results');
      expect(result.raw).toBe('Not valid JSON research');
    });
  });
});
