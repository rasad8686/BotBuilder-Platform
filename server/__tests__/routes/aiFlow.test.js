/**
 * AI Flow Routes Tests
 * Tests for server/routes/aiFlow.js
 */

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 1, email: 'test@example.com', current_organization_id: 1 };
  next();
}));

jest.mock('../../ai/FlowGenerator', () => ({
  generateFlow: jest.fn(),
  improveFlow: jest.fn(),
  suggestNextNodes: jest.fn(),
  generateNodeContent: jest.fn(),
  validateFlow: jest.fn()
}));

jest.mock('../../ai/FlowTemplates', () => ({
  getTemplates: jest.fn(),
  getTemplatesByCategory: jest.fn(),
  searchTemplates: jest.fn(),
  getTemplateById: jest.fn(),
  getCategories: jest.fn()
}));

jest.mock('../../ai/PromptBuilder', () => ({
  buildAnalysisPrompt: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const FlowGenerator = require('../../ai/FlowGenerator');
const FlowTemplates = require('../../ai/FlowTemplates');
const aiFlowRouter = require('../../routes/aiFlow');

const app = express();
app.use(express.json());
app.use('/api/ai/flow', aiFlowRouter);

describe('AI Flow Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/ai/flow/generate', () => {
    it('should generate flow from prompt', async () => {
      FlowGenerator.generateFlow.mockResolvedValueOnce({
        success: true,
        flow: { nodes: [], edges: [] },
        metadata: { tokensUsed: 100 }
      });

      const response = await request(app)
        .post('/api/ai/flow/generate')
        .send({ prompt: 'Create a customer support bot flow' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.flow).toBeDefined();
    });

    it('should reject short prompt', async () => {
      const response = await request(app)
        .post('/api/ai/flow/generate')
        .send({ prompt: 'test' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('at least 10 characters');
    });

    it('should reject missing prompt', async () => {
      const response = await request(app)
        .post('/api/ai/flow/generate')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should handle generation failure', async () => {
      FlowGenerator.generateFlow.mockResolvedValueOnce({
        success: false,
        error: 'Generation failed'
      });

      const response = await request(app)
        .post('/api/ai/flow/generate')
        .send({ prompt: 'Create a customer support bot' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Generation failed');
    });

    it('should handle errors', async () => {
      FlowGenerator.generateFlow.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app)
        .post('/api/ai/flow/generate')
        .send({ prompt: 'Create a customer support bot' });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/ai/flow/improve', () => {
    it('should improve existing flow', async () => {
      FlowGenerator.improveFlow.mockResolvedValueOnce({
        success: true,
        flow: { nodes: [{ id: 'improved' }] },
        changes: ['Added error handling']
      });

      const response = await request(app)
        .post('/api/ai/flow/improve')
        .send({
          flow: { nodes: [{ id: '1' }], edges: [] },
          suggestions: ['Add error handling']
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject missing flow', async () => {
      const response = await request(app)
        .post('/api/ai/flow/improve')
        .send({ suggestions: ['test'] });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('valid flow');
    });

    it('should reject missing suggestions', async () => {
      const response = await request(app)
        .post('/api/ai/flow/improve')
        .send({ flow: { nodes: [], edges: [] } });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('suggestions');
    });

    it('should reject empty suggestions array', async () => {
      const response = await request(app)
        .post('/api/ai/flow/improve')
        .send({ flow: { nodes: [], edges: [] }, suggestions: [] });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/ai/flow/suggest-nodes', () => {
    it('should suggest next nodes', async () => {
      FlowGenerator.suggestNextNodes.mockResolvedValueOnce({
        success: true,
        suggestions: [{ type: 'message', label: 'Welcome message' }]
      });

      const response = await request(app)
        .post('/api/ai/flow/suggest-nodes')
        .send({ flow: { nodes: [{ id: '1' }], edges: [] } });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.suggestions).toBeDefined();
    });

    it('should reject missing flow', async () => {
      const response = await request(app)
        .post('/api/ai/flow/suggest-nodes')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should handle failure', async () => {
      FlowGenerator.suggestNextNodes.mockResolvedValueOnce({
        success: false,
        error: 'Failed'
      });

      const response = await request(app)
        .post('/api/ai/flow/suggest-nodes')
        .send({ flow: { nodes: [], edges: [] } });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/ai/flow/generate-content', () => {
    it('should generate content for node type', async () => {
      FlowGenerator.generateNodeContent.mockResolvedValueOnce({
        success: true,
        content: { text: 'Welcome!' },
        nodeType: 'message'
      });

      const response = await request(app)
        .post('/api/ai/flow/generate-content')
        .send({ nodeType: 'message', context: { botName: 'Support Bot' } });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.content).toBeDefined();
    });

    it('should reject invalid node type', async () => {
      const response = await request(app)
        .post('/api/ai/flow/generate-content')
        .send({ nodeType: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid node type');
    });

    it('should reject missing node type', async () => {
      const response = await request(app)
        .post('/api/ai/flow/generate-content')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/ai/flow/templates', () => {
    it('should return all templates', async () => {
      FlowTemplates.getTemplates.mockReturnValueOnce([
        { id: '1', name: 'Support Bot' },
        { id: '2', name: 'FAQ Bot' }
      ]);
      FlowTemplates.getCategories.mockReturnValueOnce(['support', 'faq']);

      const response = await request(app).get('/api/ai/flow/templates');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.templates).toHaveLength(2);
      expect(response.body.categories).toBeDefined();
    });

    it('should filter by category', async () => {
      FlowTemplates.getTemplatesByCategory.mockReturnValueOnce([
        { id: '1', name: 'Support Bot', category: 'support' }
      ]);
      FlowTemplates.getCategories.mockReturnValueOnce(['support']);

      const response = await request(app).get('/api/ai/flow/templates?category=support');

      expect(response.status).toBe(200);
      expect(FlowTemplates.getTemplatesByCategory).toHaveBeenCalledWith('support');
    });

    it('should search templates', async () => {
      FlowTemplates.searchTemplates.mockReturnValueOnce([
        { id: '1', name: 'Support Bot' }
      ]);
      FlowTemplates.getCategories.mockReturnValueOnce([]);

      const response = await request(app).get('/api/ai/flow/templates?search=support');

      expect(response.status).toBe(200);
      expect(FlowTemplates.searchTemplates).toHaveBeenCalledWith('support');
    });

    it('should handle errors', async () => {
      FlowTemplates.getTemplates.mockImplementationOnce(() => {
        throw new Error('Error');
      });

      const response = await request(app).get('/api/ai/flow/templates');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/ai/flow/templates/:id', () => {
    it('should return specific template', async () => {
      FlowTemplates.getTemplateById.mockReturnValueOnce({
        id: 'support-bot',
        name: 'Support Bot',
        flow: { nodes: [], edges: [] }
      });

      const response = await request(app).get('/api/ai/flow/templates/support-bot');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.template.name).toBe('Support Bot');
    });

    it('should return 404 if template not found', async () => {
      FlowTemplates.getTemplateById.mockReturnValueOnce(null);

      const response = await request(app).get('/api/ai/flow/templates/nonexistent');

      expect(response.status).toBe(404);
    });

    it('should handle errors', async () => {
      FlowTemplates.getTemplateById.mockImplementationOnce(() => {
        throw new Error('Error');
      });

      const response = await request(app).get('/api/ai/flow/templates/test');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/ai/flow/analyze', () => {
    it('should analyze flow', async () => {
      FlowGenerator.validateFlow.mockReturnValueOnce({
        nodes: [{ id: '1', type: 'start' }],
        edges: [],
        variables: []
      });

      const response = await request(app)
        .post('/api/ai/flow/analyze')
        .send({
          flow: {
            nodes: [{ id: '1', type: 'start', data: {} }],
            edges: [],
            variables: []
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.analysis).toBeDefined();
      expect(response.body.analysis.validation).toBeDefined();
      expect(response.body.analysis.staticAnalysis).toBeDefined();
      expect(response.body.analysis.suggestions).toBeDefined();
    });

    it('should reject missing flow', async () => {
      const response = await request(app)
        .post('/api/ai/flow/analyze')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('valid flow');
    });

    it('should detect missing start node', async () => {
      FlowGenerator.validateFlow.mockReturnValueOnce({
        nodes: [{ id: '1', type: 'message' }],
        edges: [],
        variables: []
      });

      const response = await request(app)
        .post('/api/ai/flow/analyze')
        .send({
          flow: {
            nodes: [{ id: '1', type: 'message', data: {} }],
            edges: [],
            variables: []
          }
        });

      expect(response.status).toBe(200);
      const suggestions = response.body.analysis.suggestions;
      expect(suggestions.some(s => s.message.includes('start node'))).toBe(true);
    });

    it('should detect orphaned nodes', async () => {
      FlowGenerator.validateFlow.mockReturnValueOnce({
        nodes: [
          { id: '1', type: 'start' },
          { id: '2', type: 'message' }
        ],
        edges: [],
        variables: []
      });

      const response = await request(app)
        .post('/api/ai/flow/analyze')
        .send({
          flow: {
            nodes: [
              { id: '1', type: 'start', data: {} },
              { id: '2', type: 'message', data: {} }
            ],
            edges: [],
            variables: []
          }
        });

      expect(response.status).toBe(200);
    });

    it('should handle errors', async () => {
      FlowGenerator.validateFlow.mockImplementationOnce(() => {
        throw new Error('Error');
      });

      const response = await request(app)
        .post('/api/ai/flow/analyze')
        .send({ flow: { nodes: [], edges: [] } });

      expect(response.status).toBe(500);
    });
  });
});
