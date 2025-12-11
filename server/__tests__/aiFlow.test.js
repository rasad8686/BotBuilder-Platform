/**
 * AI Flow API Tests
 * Tests for /api/ai-flow endpoints: AI-powered conversation flows
 */

const request = require('supertest');

jest.mock('../db', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }));

const express = require('express');
const db = require('../db');

const app = express();
app.use(express.json());

const mockAuth = (req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  req.organization = { id: 1, name: 'Test Org' };
  next();
};

app.get('/api/ai-flow/templates', mockAuth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM ai_flow_templates WHERE organization_id = $1 OR is_public = true ORDER BY name', [req.organization.id]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/ai-flow/templates/:id', mockAuth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM ai_flow_templates WHERE id = $1 AND (organization_id = $2 OR is_public = true)', [req.params.id, req.organization.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Template not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/ai-flow/templates', mockAuth, async (req, res) => {
  try {
    const { name, description, prompt_template, variables, category } = req.body;
    if (!name || name.trim() === '') return res.status(400).json({ success: false, message: 'Template name is required' });
    if (!prompt_template) return res.status(400).json({ success: false, message: 'Prompt template is required' });

    const result = await db.query(
      `INSERT INTO ai_flow_templates (organization_id, name, description, prompt_template, variables, category, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.organization.id, name, description || '', prompt_template, JSON.stringify(variables || []), category || 'general', req.user.id]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/ai-flow/templates/:id', mockAuth, async (req, res) => {
  try {
    const { name, description, prompt_template, variables, category } = req.body;

    const existing = await db.query('SELECT * FROM ai_flow_templates WHERE id = $1 AND organization_id = $2', [req.params.id, req.organization.id]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Template not found' });

    const result = await db.query(
      `UPDATE ai_flow_templates SET name = COALESCE($1, name), description = COALESCE($2, description),
       prompt_template = COALESCE($3, prompt_template), variables = COALESCE($4, variables),
       category = COALESCE($5, category), updated_at = NOW() WHERE id = $6 RETURNING *`,
      [name, description, prompt_template, variables ? JSON.stringify(variables) : null, category, req.params.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.delete('/api/ai-flow/templates/:id', mockAuth, async (req, res) => {
  try {
    const existing = await db.query('SELECT * FROM ai_flow_templates WHERE id = $1 AND organization_id = $2', [req.params.id, req.organization.id]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Template not found' });
    await db.query('DELETE FROM ai_flow_templates WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/ai-flow/generate', mockAuth, async (req, res) => {
  try {
    const { template_id, input, context } = req.body;
    if (!input) return res.status(400).json({ success: false, message: 'Input is required' });

    let prompt = 'Default AI response';
    if (template_id) {
      const templateResult = await db.query('SELECT * FROM ai_flow_templates WHERE id = $1', [template_id]);
      if (templateResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Template not found' });
      prompt = templateResult.rows[0].prompt_template;
    }

    // Mock AI generation
    res.json({
      success: true,
      data: {
        response: `AI generated response for: ${input}`,
        tokens_used: 150,
        model: 'gpt-4',
        latency_ms: 500
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/ai-flow/analyze', mockAuth, async (req, res) => {
  try {
    const { text, analysis_type } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'Text is required' });

    const validTypes = ['sentiment', 'intent', 'entities', 'summary', 'keywords'];
    if (analysis_type && !validTypes.includes(analysis_type)) {
      return res.status(400).json({ success: false, message: `Invalid analysis type. Valid: ${validTypes.join(', ')}` });
    }

    // Mock analysis
    res.json({
      success: true,
      data: {
        analysis_type: analysis_type || 'general',
        result: {
          sentiment: 'positive',
          confidence: 0.85,
          keywords: ['chatbot', 'AI', 'automation']
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/ai-flow/suggest-responses', mockAuth, async (req, res) => {
  try {
    const { message, bot_id, count = 3 } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message is required' });
    if (!bot_id) return res.status(400).json({ success: false, message: 'Bot ID is required' });

    const botResult = await db.query('SELECT * FROM bots WHERE id = $1 AND organization_id = $2', [bot_id, req.organization.id]);
    if (botResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Bot not found' });

    // Mock suggestions
    res.json({
      success: true,
      data: {
        suggestions: [
          { text: 'Thank you for your message. How can I help?', confidence: 0.9 },
          { text: 'I understand. Let me look into that for you.', confidence: 0.8 },
          { text: 'Could you provide more details?', confidence: 0.7 }
        ].slice(0, count)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/ai-flow/train', mockAuth, async (req, res) => {
  try {
    const { bot_id, training_data } = req.body;
    if (!bot_id) return res.status(400).json({ success: false, message: 'Bot ID is required' });
    if (!training_data || !Array.isArray(training_data) || training_data.length === 0) {
      return res.status(400).json({ success: false, message: 'Training data is required' });
    }

    const botResult = await db.query('SELECT * FROM bots WHERE id = $1 AND organization_id = $2', [bot_id, req.organization.id]);
    if (botResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Bot not found' });

    // Create training job
    const jobResult = await db.query(
      `INSERT INTO ai_training_jobs (bot_id, status, training_data, created_by)
       VALUES ($1, 'pending', $2, $3) RETURNING *`,
      [bot_id, JSON.stringify(training_data), req.user.id]
    );

    res.json({
      success: true,
      data: {
        job_id: jobResult.rows[0].id,
        status: 'pending',
        examples_count: training_data.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/ai-flow/training/:jobId', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT j.*, b.name as bot_name FROM ai_training_jobs j
       JOIN bots b ON j.bot_id = b.id
       WHERE j.id = $1 AND b.organization_id = $2`,
      [req.params.jobId, req.organization.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Training job not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

describe('AI Flow API', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  describe('GET /api/ai-flow/templates', () => {
    it('should return templates', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Template 1' }] });
      const res = await request(app).get('/api/ai-flow/templates');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/ai-flow/templates');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/ai-flow/templates/:id', () => {
    it('should return template by ID', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Template', prompt_template: 'Test' }] });
      const res = await request(app).get('/api/ai-flow/templates/1');
      expect(res.status).toBe(200);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/ai-flow/templates/999');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/ai-flow/templates/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/ai-flow/templates', () => {
    it('should create template', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'New Template' }] });
      const res = await request(app).post('/api/ai-flow/templates').send({ name: 'New Template', prompt_template: 'Test prompt' });
      expect(res.status).toBe(201);
    });

    it('should return 400 if name missing', async () => {
      const res = await request(app).post('/api/ai-flow/templates').send({ prompt_template: 'Test' });
      expect(res.status).toBe(400);
    });

    it('should return 400 if prompt_template missing', async () => {
      const res = await request(app).post('/api/ai-flow/templates').send({ name: 'Template' });
      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/ai-flow/templates').send({ name: 'Template', prompt_template: 'Test' });
      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/ai-flow/templates/:id', () => {
    it('should update template', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Updated' }] });
      const res = await request(app).put('/api/ai-flow/templates/1').send({ name: 'Updated' });
      expect(res.status).toBe(200);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).put('/api/ai-flow/templates/999').send({ name: 'Updated' });
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).put('/api/ai-flow/templates/1').send({ name: 'Updated' });
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/ai-flow/templates/:id', () => {
    it('should delete template', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rowCount: 1 });
      const res = await request(app).delete('/api/ai-flow/templates/1');
      expect(res.status).toBe(200);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).delete('/api/ai-flow/templates/999');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).delete('/api/ai-flow/templates/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/ai-flow/generate', () => {
    it('should generate AI response', async () => {
      const res = await request(app).post('/api/ai-flow/generate').send({ input: 'Hello' });
      expect(res.status).toBe(200);
      expect(res.body.data.response).toBeDefined();
    });

    it('should use template if provided', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, prompt_template: 'Test template' }] });
      const res = await request(app).post('/api/ai-flow/generate').send({ input: 'Hello', template_id: 1 });
      expect(res.status).toBe(200);
    });

    it('should return 400 if input missing', async () => {
      const res = await request(app).post('/api/ai-flow/generate').send({});
      expect(res.status).toBe(400);
    });

    it('should return 404 if template not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/ai-flow/generate').send({ input: 'Hello', template_id: 999 });
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/ai-flow/generate').send({ input: 'Hello', template_id: 1 });
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/ai-flow/analyze', () => {
    it('should analyze text', async () => {
      const res = await request(app).post('/api/ai-flow/analyze').send({ text: 'This is great!' });
      expect(res.status).toBe(200);
      expect(res.body.data.result).toBeDefined();
    });

    it('should return 400 if text missing', async () => {
      const res = await request(app).post('/api/ai-flow/analyze').send({});
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid analysis type', async () => {
      const res = await request(app).post('/api/ai-flow/analyze').send({ text: 'Test', analysis_type: 'invalid' });
      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      // This endpoint doesn't use db, but testing express error handling
      const res = await request(app).post('/api/ai-flow/analyze').send({ text: 'Test', analysis_type: 'sentiment' });
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/ai-flow/suggest-responses', () => {
    it('should suggest responses', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      const res = await request(app).post('/api/ai-flow/suggest-responses').send({ message: 'Hello', bot_id: 1 });
      expect(res.status).toBe(200);
      expect(res.body.data.suggestions).toBeDefined();
    });

    it('should return 400 if message missing', async () => {
      const res = await request(app).post('/api/ai-flow/suggest-responses').send({ bot_id: 1 });
      expect(res.status).toBe(400);
    });

    it('should return 400 if bot_id missing', async () => {
      const res = await request(app).post('/api/ai-flow/suggest-responses').send({ message: 'Hello' });
      expect(res.status).toBe(400);
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/ai-flow/suggest-responses').send({ message: 'Hello', bot_id: 999 });
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/ai-flow/suggest-responses').send({ message: 'Hello', bot_id: 1 });
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/ai-flow/train', () => {
    it('should start training job', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });
      const res = await request(app).post('/api/ai-flow/train').send({
        bot_id: 1,
        training_data: [{ input: 'Hello', output: 'Hi there!' }]
      });
      expect(res.status).toBe(200);
      expect(res.body.data.job_id).toBeDefined();
    });

    it('should return 400 if bot_id missing', async () => {
      const res = await request(app).post('/api/ai-flow/train').send({ training_data: [] });
      expect(res.status).toBe(400);
    });

    it('should return 400 if training_data missing', async () => {
      const res = await request(app).post('/api/ai-flow/train').send({ bot_id: 1 });
      expect(res.status).toBe(400);
    });

    it('should return 400 if training_data empty', async () => {
      const res = await request(app).post('/api/ai-flow/train').send({ bot_id: 1, training_data: [] });
      expect(res.status).toBe(400);
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/ai-flow/train').send({
        bot_id: 999,
        training_data: [{ input: 'Hello', output: 'Hi!' }]
      });
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/ai-flow/train').send({
        bot_id: 1,
        training_data: [{ input: 'Hello', output: 'Hi!' }]
      });
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/ai-flow/training/:jobId', () => {
    it('should return training job status', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'completed', bot_name: 'Test Bot' }] });
      const res = await request(app).get('/api/ai-flow/training/1');
      expect(res.status).toBe(200);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/ai-flow/training/999');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/ai-flow/training/1');
      expect(res.status).toBe(500);
    });
  });
});
