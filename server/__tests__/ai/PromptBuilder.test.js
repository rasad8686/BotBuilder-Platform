/**
 * PromptBuilder Tests
 * Tests for server/ai/PromptBuilder.js
 */

const PromptBuilder = require('../../ai/PromptBuilder');

describe('PromptBuilder', () => {
  describe('buildFlowPrompt', () => {
    it('should build basic flow prompt', () => {
      const prompt = PromptBuilder.buildFlowPrompt('Create a support bot');

      expect(prompt).toContain('chatbot flow designer');
      expect(prompt).toContain('JSON object');
      expect(prompt).toContain('nodes');
      expect(prompt).toContain('edges');
    });

    it('should include complexity guide', () => {
      const simplePrompt = PromptBuilder.buildFlowPrompt('test', { complexity: 'simple' });
      const advancedPrompt = PromptBuilder.buildFlowPrompt('test', { complexity: 'advanced' });

      expect(simplePrompt).toContain('5-8 nodes');
      expect(advancedPrompt).toContain('15-25 nodes');
    });

    it('should set max nodes limit', () => {
      const prompt = PromptBuilder.buildFlowPrompt('test', { maxNodes: 50 });

      expect(prompt).toContain('Maximum nodes: 50');
    });

    it('should include language setting', () => {
      const prompt = PromptBuilder.buildFlowPrompt('test', { language: 'az' });

      expect(prompt).toContain('Language for content: az');
    });

    it('should include template reference when provided', () => {
      const template = {
        name: 'Support Bot',
        category: 'customer-service',
        features: ['FAQ', 'Live handoff']
      };

      const prompt = PromptBuilder.buildFlowPrompt('test', { baseTemplate: template });

      expect(prompt).toContain('Base Template Reference');
      expect(prompt).toContain('Support Bot');
      expect(prompt).toContain('customer-service');
      expect(prompt).toContain('FAQ, Live handoff');
    });

    it('should include variable guidelines when enabled', () => {
      const prompt = PromptBuilder.buildFlowPrompt('test', { includeVariables: true });

      expect(prompt).toContain('Variable Guidelines');
      expect(prompt).toContain('snake_case');
    });

    it('should exclude variable guidelines when disabled', () => {
      const prompt = PromptBuilder.buildFlowPrompt('test', { includeVariables: false });

      expect(prompt).not.toContain('Variable Guidelines');
    });

    it('should include all node types', () => {
      const prompt = PromptBuilder.buildFlowPrompt('test');

      expect(prompt).toContain('start');
      expect(prompt).toContain('message');
      expect(prompt).toContain('question');
      expect(prompt).toContain('condition');
      expect(prompt).toContain('api_call');
      expect(prompt).toContain('ai_response');
      expect(prompt).toContain('end');
    });

    it('should include best practices', () => {
      const prompt = PromptBuilder.buildFlowPrompt('test');

      expect(prompt).toContain('Best Practices');
      expect(prompt).toContain('friendly greeting');
    });
  });

  describe('buildNodePrompt', () => {
    it('should build basic node prompt', () => {
      const prompt = PromptBuilder.buildNodePrompt('message');

      expect(prompt).toContain('chatbot content writer');
      expect(prompt).toContain('message');
    });

    it('should include tone guide', () => {
      const professional = PromptBuilder.buildNodePrompt('message', { tone: 'professional' });
      const friendly = PromptBuilder.buildNodePrompt('message', { tone: 'friendly' });
      const playful = PromptBuilder.buildNodePrompt('message', { tone: 'playful' });

      expect(professional).toContain('formal, polite');
      expect(friendly).toContain('warm, conversational');
      expect(playful).toContain('fun, engaging');
    });

    it('should include purpose', () => {
      const prompt = PromptBuilder.buildNodePrompt('message', { purpose: 'Welcome new users' });

      expect(prompt).toContain('Purpose: Welcome new users');
    });

    it('should include previous messages context', () => {
      const prompt = PromptBuilder.buildNodePrompt('message', {
        previousMessages: ['Hello!', 'How can I help?']
      });

      expect(prompt).toContain('Conversation Context');
      expect(prompt).toContain('1. Hello!');
      expect(prompt).toContain('2. How can I help?');
    });

    it('should include available variables', () => {
      const prompt = PromptBuilder.buildNodePrompt('message', {
        variables: [
          { name: 'user_name', type: 'string' },
          { name: 'order_id', type: 'number' }
        ]
      });

      expect(prompt).toContain('Available Variables');
      expect(prompt).toContain('{{user_name}}: string');
      expect(prompt).toContain('{{order_id}}: number');
    });

    it('should include type-specific instructions', () => {
      const messagePrompt = PromptBuilder.buildNodePrompt('message');
      const questionPrompt = PromptBuilder.buildNodePrompt('question');
      const inputPrompt = PromptBuilder.buildNodePrompt('input');
      const menuPrompt = PromptBuilder.buildNodePrompt('menu');
      const conditionPrompt = PromptBuilder.buildNodePrompt('condition');

      expect(messagePrompt).toContain('clear');
      expect(questionPrompt).toContain('2-5 clear answer options');
      expect(inputPrompt).toContain('what information is needed');
      expect(menuPrompt).toContain('3-6 options');
      expect(conditionPrompt).toContain('condition logic');
    });

    it('should include type-specific examples', () => {
      const messagePrompt = PromptBuilder.buildNodePrompt('message');
      const questionPrompt = PromptBuilder.buildNodePrompt('question');

      expect(messagePrompt).toContain('Welcome Message');
      expect(questionPrompt).toContain('Satisfaction Check');
    });

    it('should handle unknown node type', () => {
      const prompt = PromptBuilder.buildNodePrompt('unknown_type');

      expect(prompt).toContain('appropriate content for this node type');
    });
  });

  describe('buildImprovementPrompt', () => {
    it('should build improvement prompt', () => {
      const flow = {
        nodes: [{ id: 'n1' }, { id: 'n2' }],
        edges: [{ source: 'n1', target: 'n2' }],
        variables: [{ name: 'test' }]
      };

      const prompt = PromptBuilder.buildImprovementPrompt(flow, 'Add error handling');

      expect(prompt).toContain('flow optimizer');
      expect(prompt).toContain('Nodes: 2');
      expect(prompt).toContain('Connections: 1');
      expect(prompt).toContain('Variables: 1');
      expect(prompt).toContain('Add error handling');
    });

    it('should include improvement guidelines', () => {
      const prompt = PromptBuilder.buildImprovementPrompt({}, 'test');

      expect(prompt).toContain('Preserve the overall structure');
      expect(prompt).toContain('Keep existing node IDs');
      expect(prompt).toContain('error handling');
    });

    it('should handle empty flow', () => {
      const prompt = PromptBuilder.buildImprovementPrompt({}, 'test');

      expect(prompt).toContain('Nodes: 0');
      expect(prompt).toContain('Connections: 0');
      expect(prompt).toContain('Variables: 0');
    });
  });

  describe('buildNaturalLanguagePrompt', () => {
    it('should build natural language prompt', () => {
      const description = 'Create a bot that helps users track their orders';
      const prompt = PromptBuilder.buildNaturalLanguagePrompt(description);

      expect(prompt).toContain('chatbot architect');
      expect(prompt).toContain(description);
      expect(prompt).toContain('Analysis Steps');
    });

    it('should include analysis steps', () => {
      const prompt = PromptBuilder.buildNaturalLanguagePrompt('test');

      expect(prompt).toContain('Identify the main purpose');
      expect(prompt).toContain('Extract key conversation points');
      expect(prompt).toContain('Determine required user inputs');
      expect(prompt).toContain('Identify decision points');
      expect(prompt).toContain('Plan the conversation flow');
    });

    it('should specify output requirements', () => {
      const prompt = PromptBuilder.buildNaturalLanguagePrompt('test');

      expect(prompt).toContain('Logical node sequence');
      expect(prompt).toContain('Clear branching');
      expect(prompt).toContain('Variables for all user inputs');
      expect(prompt).toContain('Error handling paths');
    });
  });

  describe('buildAnalysisPrompt', () => {
    it('should build analysis prompt', () => {
      const flow = { nodes: [], edges: [] };
      const prompt = PromptBuilder.buildAnalysisPrompt(flow);

      expect(prompt).toContain('Analyze this chatbot flow');
      expect(prompt).toContain('Flow Structure');
    });

    it('should include analysis categories', () => {
      const prompt = PromptBuilder.buildAnalysisPrompt({});

      expect(prompt).toContain('Completeness');
      expect(prompt).toContain('User Experience');
      expect(prompt).toContain('Error Handling');
      expect(prompt).toContain('Efficiency');
      expect(prompt).toContain('Variables');
    });

    it('should specify output format', () => {
      const prompt = PromptBuilder.buildAnalysisPrompt({});

      expect(prompt).toContain('score');
      expect(prompt).toContain('strengths');
      expect(prompt).toContain('weaknesses');
      expect(prompt).toContain('suggestions');
      expect(prompt).toContain('missingElements');
      expect(prompt).toContain('redundantElements');
    });
  });

  describe('buildTestGenerationPrompt', () => {
    it('should build test generation prompt', () => {
      const flow = {
        nodes: [
          { type: 'start' },
          { type: 'message' },
          { type: 'question' }
        ],
        variables: [{ name: 'user_input' }]
      };

      const prompt = PromptBuilder.buildTestGenerationPrompt(flow);

      expect(prompt).toContain('Generate test scenarios');
      expect(prompt).toContain('Total Nodes: 3');
      expect(prompt).toContain('start, message, question');
      expect(prompt).toContain('user_input');
    });

    it('should include test scenario types', () => {
      const prompt = PromptBuilder.buildTestGenerationPrompt({ nodes: [] });

      expect(prompt).toContain('Happy path');
      expect(prompt).toContain('Edge cases');
      expect(prompt).toContain('Error scenarios');
      expect(prompt).toContain('All branch paths');
      expect(prompt).toContain('Variable handling');
    });

    it('should specify test scenario format', () => {
      const prompt = PromptBuilder.buildTestGenerationPrompt({ nodes: [] });

      expect(prompt).toContain('testScenarios');
      expect(prompt).toContain('name');
      expect(prompt).toContain('description');
      expect(prompt).toContain('steps');
      expect(prompt).toContain('expectedOutcome');
    });

    it('should handle flow without variables', () => {
      const prompt = PromptBuilder.buildTestGenerationPrompt({ nodes: [] });

      expect(prompt).toContain('Variables: None');
    });

    it('should extract unique node types', () => {
      const flow = {
        nodes: [
          { type: 'message' },
          { type: 'message' },
          { type: 'condition' }
        ]
      };

      const prompt = PromptBuilder.buildTestGenerationPrompt(flow);

      expect(prompt).toContain('message, condition');
    });
  });
});
