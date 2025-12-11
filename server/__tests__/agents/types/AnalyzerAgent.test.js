/**
 * AnalyzerAgent Tests
 * Tests for server/agents/types/AnalyzerAgent.js
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

const AnalyzerAgent = require('../../../agents/types/AnalyzerAgent');

describe('AnalyzerAgent', () => {
  let analyzerAgent;

  beforeEach(() => {
    analyzerAgent = new AnalyzerAgent({
      id: 1,
      name: 'DataAnalyzer'
    });
  });

  describe('constructor', () => {
    it('should set default role to analyzer', () => {
      expect(analyzerAgent.role).toBe('analyzer');
    });

    it('should use custom role if provided', () => {
      const customAgent = new AnalyzerAgent({
        id: 2,
        role: 'data-scientist'
      });

      expect(customAgent.role).toBe('data-scientist');
    });

    it('should set default system prompt', () => {
      expect(analyzerAgent.systemPrompt).toContain('analytical agent specialized in data analysis');
    });

    it('should use custom system prompt if provided', () => {
      const customAgent = new AnalyzerAgent({
        id: 2,
        systemPrompt: 'Custom analyzer prompt'
      });

      expect(customAgent.systemPrompt).toBe('Custom analyzer prompt');
    });

    it('should initialize default analysis type', () => {
      expect(analyzerAgent.analysisType).toBe('general');
    });

    it('should accept custom analysis type', () => {
      const agent = new AnalyzerAgent({
        id: 1,
        analysisType: 'sentiment'
      });

      expect(agent.analysisType).toBe('sentiment');
    });
  });

  describe('setAnalysisType', () => {
    it('should set analysis type', () => {
      analyzerAgent.setAnalysisType('pattern');

      expect(analyzerAgent.analysisType).toBe('pattern');
    });
  });

  describe('buildPrompt', () => {
    it('should include analysis type in prompt', () => {
      analyzerAgent.setAnalysisType('sentiment');

      const prompt = analyzerAgent.buildPrompt('Analyze this', null);

      const typeMessage = prompt.messages.find(m =>
        m.content && m.content.includes('Focus on sentiment analysis')
      );
      expect(typeMessage).toBeDefined();
    });

    it('should not add type message for general analysis', () => {
      analyzerAgent.setAnalysisType('general');

      const prompt = analyzerAgent.buildPrompt('Analyze this', null);

      const typeMessage = prompt.messages.find(m =>
        m.content && m.content.includes('Focus on')
      );
      expect(typeMessage).toBeUndefined();
    });

    it('should include analysis tools info when available', () => {
      analyzerAgent.loadedTools = [
        { name: 'sql_query', type: 'database_query', description: 'Query database' }
      ];

      const prompt = analyzerAgent.buildPrompt('Analyze data', null);

      const toolsMessage = prompt.messages.find(m =>
        m.content && m.content.includes('Analysis tools available')
      );
      expect(toolsMessage).toBeDefined();
    });

    it('should filter only analysis tools', () => {
      analyzerAgent.loadedTools = [
        { name: 'sql_query', type: 'database_query', description: 'Query database' },
        { name: 'code_runner', type: 'code_execution', description: 'Run code' },
        { name: 'email', type: 'email', description: 'Send email' }
      ];

      const prompt = analyzerAgent.buildPrompt('Analyze', null);

      const toolsMessage = prompt.messages.find(m =>
        m.content && m.content.includes('Analysis tools available')
      );
      expect(toolsMessage).toBeDefined();
      expect(toolsMessage.content).toContain('sql_query');
      expect(toolsMessage.content).toContain('code_runner');
    });

    it('should not add tools message for non-analysis tools', () => {
      analyzerAgent.loadedTools = [
        { name: 'email', type: 'email', description: 'Send email' }
      ];

      const prompt = analyzerAgent.buildPrompt('Analyze', null);

      const toolsMessage = prompt.messages.find(m =>
        m.content && m.content.includes('Analysis tools available')
      );
      expect(toolsMessage).toBeUndefined();
    });
  });

  describe('parseAnalysis', () => {
    it('should parse JSON output', () => {
      const output = {
        type: 'json',
        data: {
          analysisType: 'sentiment',
          summary: 'Positive sentiment overall',
          findings: [{ category: 'sentiment', observation: 'Positive' }]
        }
      };

      const result = analyzerAgent.parseAnalysis(output);

      expect(result.valid).toBe(true);
      expect(result.analysis.analysisType).toBe('sentiment');
    });

    it('should parse raw JSON string', () => {
      const output = {
        type: 'text',
        raw: '{"summary": "Data analysis complete", "findings": []}'
      };

      const result = analyzerAgent.parseAnalysis(output);

      expect(result.valid).toBe(true);
      expect(result.analysis.summary).toBe('Data analysis complete');
    });

    it('should return invalid for non-JSON', () => {
      const output = {
        type: 'text',
        raw: 'Unable to analyze'
      };

      const result = analyzerAgent.parseAnalysis(output);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Failed to parse analysis results');
    });
  });

  describe('extractMetrics', () => {
    it('should extract metrics from analysis', () => {
      const analysis = {
        findings: [{ category: 'test' }, { category: 'test2' }],
        issues: [
          { severity: 'critical' },
          { severity: 'warning' }
        ],
        patterns: [{ pattern: 'test' }],
        confidence: 'high'
      };

      const metrics = analyzerAgent.extractMetrics(analysis);

      expect(metrics.findingsCount).toBe(2);
      expect(metrics.issuesCount).toBe(2);
      expect(metrics.patternsCount).toBe(1);
      expect(metrics.confidence).toBe('high');
      expect(metrics.criticalIssues).toBe(1);
    });

    it('should handle missing arrays', () => {
      const analysis = {};

      const metrics = analyzerAgent.extractMetrics(analysis);

      expect(metrics.findingsCount).toBe(0);
      expect(metrics.issuesCount).toBe(0);
      expect(metrics.patternsCount).toBe(0);
      expect(metrics.confidence).toBe('unknown');
      expect(metrics.criticalIssues).toBe(0);
    });
  });
});
