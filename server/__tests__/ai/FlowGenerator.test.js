/**
 * FlowGenerator Tests
 * Tests for server/ai/FlowGenerator.js
 */

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  }));
});

jest.mock('../../ai/PromptBuilder', () => ({
  buildFlowPrompt: jest.fn().mockReturnValue('flow prompt'),
  buildImprovementPrompt: jest.fn().mockReturnValue('improvement prompt'),
  buildNodePrompt: jest.fn().mockReturnValue('node prompt')
}));

jest.mock('../../ai/FlowTemplates', () => ({
  getTemplateById: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

const OpenAI = require('openai');
const FlowGenerator = require('../../ai/FlowGenerator');
const PromptBuilder = require('../../ai/PromptBuilder');
const FlowTemplates = require('../../ai/FlowTemplates');

describe('FlowGenerator', () => {
  let mockOpenAI;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenAI = new OpenAI();
  });

  describe('generateFlow', () => {
    it('should generate flow successfully', async () => {
      const mockFlow = {
        name: 'Test Flow',
        nodes: [{ id: 'node1', type: 'start' }],
        edges: []
      };

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockFlow) } }],
        usage: { total_tokens: 100 }
      });

      FlowGenerator.openai = mockOpenAI;

      const result = await FlowGenerator.generateFlow('Create a support bot');

      expect(result.success).toBe(true);
      expect(result.flow).toBeDefined();
      expect(result.metadata.tokensUsed).toBe(100);
    });

    it('should use template when provided', async () => {
      const mockTemplate = { name: 'Support', category: 'support', features: ['FAQ'] };
      FlowTemplates.getTemplateById.mockReturnValue(mockTemplate);

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ name: 'Test', nodes: [], edges: [] }) } }],
        usage: { total_tokens: 50 }
      });

      FlowGenerator.openai = mockOpenAI;

      await FlowGenerator.generateFlow('Create bot', { templateId: 'support' });

      expect(FlowTemplates.getTemplateById).toHaveBeenCalledWith('support');
      expect(PromptBuilder.buildFlowPrompt).toHaveBeenCalledWith(
        'Create bot',
        expect.objectContaining({ baseTemplate: mockTemplate })
      );
    });

    it('should handle generation error', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));
      FlowGenerator.openai = mockOpenAI;

      const result = await FlowGenerator.generateFlow('Create bot');

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
      expect(result.flow).toBeNull();
    });

    it('should pass options to prompt builder', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ nodes: [], edges: [] }) } }],
        usage: {}
      });

      FlowGenerator.openai = mockOpenAI;

      await FlowGenerator.generateFlow('test', {
        language: 'az',
        complexity: 'advanced',
        includeVariables: true,
        maxNodes: 30
      });

      expect(PromptBuilder.buildFlowPrompt).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          language: 'az',
          complexity: 'advanced',
          includeVariables: true,
          maxNodes: 30
        })
      );
    });
  });

  describe('improveFlow', () => {
    it('should improve flow successfully', async () => {
      const existingFlow = { nodes: [{ id: 'n1' }], edges: [] };
      const improvedFlow = { nodes: [{ id: 'n1' }, { id: 'n2' }], edges: [] };

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(improvedFlow) } }],
        usage: { total_tokens: 150 }
      });

      FlowGenerator.openai = mockOpenAI;

      const result = await FlowGenerator.improveFlow(existingFlow, 'Add error handling');

      expect(result.success).toBe(true);
      expect(result.flow).toBeDefined();
      expect(result.changes).toBeDefined();
    });

    it('should handle array suggestions', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ nodes: [], edges: [] }) } }],
        usage: {}
      });

      FlowGenerator.openai = mockOpenAI;

      await FlowGenerator.improveFlow({}, ['Suggestion 1', 'Suggestion 2']);

      expect(PromptBuilder.buildImprovementPrompt).toHaveBeenCalledWith(
        {},
        'Suggestion 1\n- Suggestion 2'
      );
    });

    it('should handle improvement error', async () => {
      const existingFlow = { nodes: [] };
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('Improvement failed'));
      FlowGenerator.openai = mockOpenAI;

      const result = await FlowGenerator.improveFlow(existingFlow, 'improve');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Improvement failed');
      expect(result.flow).toEqual(existingFlow);
    });
  });

  describe('suggestNextNodes', () => {
    it('should return node suggestions', async () => {
      const suggestions = [
        { nodeType: 'message', title: 'Confirmation', priority: 'high' }
      ];

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ suggestions }) } }],
        usage: { total_tokens: 80 }
      });

      FlowGenerator.openai = mockOpenAI;

      const result = await FlowGenerator.suggestNextNodes({ nodes: [] });

      expect(result.success).toBe(true);
      expect(result.suggestions).toEqual(suggestions);
    });

    it('should handle suggestion error', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('Suggestion error'));
      FlowGenerator.openai = mockOpenAI;

      const result = await FlowGenerator.suggestNextNodes({});

      expect(result.success).toBe(false);
      expect(result.suggestions).toEqual([]);
    });

    it('should handle empty suggestions', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({}) } }],
        usage: {}
      });

      FlowGenerator.openai = mockOpenAI;

      const result = await FlowGenerator.suggestNextNodes({});

      expect(result.suggestions).toEqual([]);
    });
  });

  describe('generateNodeContent', () => {
    it('should generate node content successfully', async () => {
      const nodeContent = { label: 'Welcome', content: 'Hello!' };

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(nodeContent) } }],
        usage: { total_tokens: 50 }
      });

      FlowGenerator.openai = mockOpenAI;

      const result = await FlowGenerator.generateNodeContent('message', {
        purpose: 'Welcome user',
        tone: 'friendly'
      });

      expect(result.success).toBe(true);
      expect(result.content).toEqual(nodeContent);
      expect(result.nodeType).toBe('message');
    });

    it('should handle content generation error', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('Content error'));
      FlowGenerator.openai = mockOpenAI;

      const result = await FlowGenerator.generateNodeContent('question', {});

      expect(result.success).toBe(false);
      expect(result.content).toBeNull();
    });

    it('should use default context values', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: '{}' } }],
        usage: {}
      });

      FlowGenerator.openai = mockOpenAI;

      await FlowGenerator.generateNodeContent('input');

      expect(PromptBuilder.buildNodePrompt).toHaveBeenCalledWith(
        'input',
        expect.objectContaining({
          purpose: '',
          tone: 'professional',
          language: 'en'
        })
      );
    });
  });

  describe('validateFlow', () => {
    it('should return empty flow for null input', () => {
      const result = FlowGenerator.validateFlow(null);

      expect(result.name).toBe('New Flow');
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].type).toBe('start');
    });

    it('should validate and normalize flow structure', () => {
      const flow = {
        name: 'Test',
        nodes: [
          { id: 'n1', type: 'start', data: { label: 'Start' } },
          { id: 'n2', type: 'message', data: { content: 'Hello' } }
        ],
        edges: [
          { source: 'n1', target: 'n2' }
        ]
      };

      const result = FlowGenerator.validateFlow(flow);

      expect(result.name).toBe('Test');
      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
      expect(result.settings.startNodeId).toBe('n1');
    });

    it('should filter invalid edges', () => {
      const flow = {
        nodes: [{ id: 'n1', type: 'start' }],
        edges: [
          { source: 'n1', target: 'nonexistent' },
          { source: 'n1', target: 'n1' }
        ]
      };

      const result = FlowGenerator.validateFlow(flow);

      expect(result.edges).toHaveLength(1);
    });

    it('should set first node as start if no start node exists', () => {
      const flow = {
        nodes: [
          { id: 'n1', type: 'message' },
          { id: 'n2', type: 'end' }
        ],
        edges: []
      };

      const result = FlowGenerator.validateFlow(flow);

      expect(result.settings.startNodeId).toBe('n1');
    });

    it('should handle missing optional fields', () => {
      const flow = {};

      const result = FlowGenerator.validateFlow(flow);

      expect(result.description).toBe('');
      expect(result.variables).toEqual([]);
      expect(result.settings.language).toBe('en');
      expect(result.settings.timezone).toBe('UTC');
    });
  });

  describe('validateNode', () => {
    it('should validate node with defaults', () => {
      const node = { id: 'test' };
      const result = FlowGenerator.validateNode(node, 0);

      expect(result.id).toBe('test');
      expect(result.type).toBe('message');
      expect(result.position).toEqual({ x: 0, y: 0 });
    });

    it('should normalize invalid node type', () => {
      const node = { type: 'invalid_type' };
      const result = FlowGenerator.validateNode(node, 0);

      expect(result.type).toBe('message');
    });

    it('should preserve valid node type', () => {
      const node = { type: 'condition' };
      const result = FlowGenerator.validateNode(node, 0);

      expect(result.type).toBe('condition');
    });

    it('should generate ID if missing', () => {
      const node = {};
      const result = FlowGenerator.validateNode(node, 5);

      expect(result.id).toContain('node_5_');
    });
  });

  describe('validateEdge', () => {
    it('should validate edge with defaults', () => {
      const edge = { source: 'n1', target: 'n2' };
      const result = FlowGenerator.validateEdge(edge, 0);

      expect(result.source).toBe('n1');
      expect(result.target).toBe('n2');
      expect(result.sourceHandle).toBeNull();
      expect(result.targetHandle).toBeNull();
      expect(result.label).toBe('');
      expect(result.condition).toBeNull();
    });

    it('should preserve existing edge properties', () => {
      const edge = {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        label: 'Yes',
        condition: { variable: 'answer', value: 'yes' }
      };

      const result = FlowGenerator.validateEdge(edge, 0);

      expect(result.id).toBe('e1');
      expect(result.label).toBe('Yes');
      expect(result.condition).toEqual({ variable: 'answer', value: 'yes' });
    });
  });

  describe('detectChanges', () => {
    it('should detect added nodes', () => {
      const oldFlow = { nodes: [{ id: 'n1' }], edges: [] };
      const newFlow = { nodes: [{ id: 'n1' }, { id: 'n2' }], edges: [] };

      const changes = FlowGenerator.detectChanges(oldFlow, newFlow);

      expect(changes.nodesAdded).toHaveLength(1);
      expect(changes.nodesAdded[0].id).toBe('n2');
    });

    it('should detect removed nodes', () => {
      const oldFlow = { nodes: [{ id: 'n1' }, { id: 'n2' }], edges: [] };
      const newFlow = { nodes: [{ id: 'n1' }], edges: [] };

      const changes = FlowGenerator.detectChanges(oldFlow, newFlow);

      expect(changes.nodesRemoved).toHaveLength(1);
      expect(changes.nodesRemoved[0].id).toBe('n2');
    });

    it('should detect modified nodes', () => {
      const oldFlow = { nodes: [{ id: 'n1', data: { label: 'Old' } }], edges: [] };
      const newFlow = { nodes: [{ id: 'n1', data: { label: 'New' } }], edges: [] };

      const changes = FlowGenerator.detectChanges(oldFlow, newFlow);

      expect(changes.nodesModified).toHaveLength(1);
    });

    it('should detect added edges', () => {
      const oldFlow = { nodes: [], edges: [] };
      const newFlow = { nodes: [], edges: [{ source: 'n1', target: 'n2' }] };

      const changes = FlowGenerator.detectChanges(oldFlow, newFlow);

      expect(changes.edgesAdded).toHaveLength(1);
    });

    it('should detect removed edges', () => {
      const oldFlow = { nodes: [], edges: [{ source: 'n1', target: 'n2' }] };
      const newFlow = { nodes: [], edges: [] };

      const changes = FlowGenerator.detectChanges(oldFlow, newFlow);

      expect(changes.edgesRemoved).toHaveLength(1);
    });

    it('should handle null/undefined arrays', () => {
      const changes = FlowGenerator.detectChanges({}, {});

      expect(changes.nodesAdded).toEqual([]);
      expect(changes.nodesRemoved).toEqual([]);
    });
  });

  describe('getEmptyFlow', () => {
    it('should create empty flow with start node', () => {
      const flow = FlowGenerator.getEmptyFlow();

      expect(flow.name).toBe('New Flow');
      expect(flow.nodes).toHaveLength(1);
      expect(flow.nodes[0].type).toBe('start');
      expect(flow.nodes[0].isStart).toBe(true);
      expect(flow.settings.startNodeId).toBe(flow.nodes[0].id);
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = FlowGenerator.generateId();
      const id2 = FlowGenerator.generateId();

      expect(id1).not.toBe(id2);
      expect(id1).toContain('_');
    });
  });
});
