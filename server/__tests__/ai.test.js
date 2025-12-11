/**
 * AI API Tests
 * Tests for /api/ai endpoints: providers, models, configuration, chat
 */

const request = require('supertest');

jest.mock('../db', () => ({
  query: jest.fn()
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const express = require('express');
const db = require('../db');

const app = express();
app.use(express.json());

const mockAuth = (req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  req.organization = { id: 1, name: 'Test Org' };
  next();
};

// GET providers (public)
app.get('/api/ai/providers', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
      { id: 'anthropic', name: 'Anthropic', models: ['claude-sonnet-4-5', 'claude-haiku-4-5'] }
    ]
  });
});

// GET models by provider (public)
app.get('/api/ai/models/:provider', (req, res) => {
  const { provider } = req.params;

  const models = {
    openai: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' }
    ],
    anthropic: [
      { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' }
    ]
  };

  if (!models[provider]) {
    return res.status(404).json({ success: false, message: 'Provider not found' });
  }

  res.json({ success: true, data: models[provider] });
});

// GET AI config for bot
app.get('/api/bots/:botId/ai/configure', mockAuth, async (req, res) => {
  try {
    const botResult = await db.query(
      'SELECT * FROM bots WHERE id = $1 AND organization_id = $2',
      [req.params.botId, req.organization.id]
    );

    if (botResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Bot not found' });
    }

    const configResult = await db.query(
      'SELECT * FROM ai_configurations WHERE bot_id = $1',
      [req.params.botId]
    );

    if (configResult.rows.length === 0) {
      return res.json({ success: true, data: null });
    }

    // Don't expose the API key
    const config = configResult.rows[0];
    delete config.api_key_encrypted;

    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST/PUT AI config for bot
app.post('/api/bots/:botId/ai/configure', mockAuth, async (req, res) => {
  try {
    const { provider, model, api_key, temperature, max_tokens, system_prompt } = req.body;

    if (!provider) {
      return res.status(400).json({ success: false, message: 'Provider is required' });
    }
    if (!model) {
      return res.status(400).json({ success: false, message: 'Model is required' });
    }

    const validProviders = ['openai', 'anthropic', 'google', 'azure'];
    if (!validProviders.includes(provider)) {
      return res.status(400).json({ success: false, message: 'Invalid provider' });
    }

    const botResult = await db.query(
      'SELECT * FROM bots WHERE id = $1 AND organization_id = $2',
      [req.params.botId, req.organization.id]
    );

    if (botResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Bot not found' });
    }

    // Upsert config
    const result = await db.query(
      `INSERT INTO ai_configurations (bot_id, organization_id, provider, model, api_key_encrypted, temperature, max_tokens, system_prompt)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (bot_id) DO UPDATE SET
       provider = $3, model = $4, api_key_encrypted = COALESCE($5, ai_configurations.api_key_encrypted),
       temperature = $6, max_tokens = $7, system_prompt = $8, updated_at = NOW()
       RETURNING id, bot_id, provider, model, temperature, max_tokens, system_prompt`,
      [req.params.botId, req.organization.id, provider, model, api_key || null, temperature || 0.7, max_tokens || 2000, system_prompt || '']
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE AI config
app.delete('/api/bots/:botId/ai/configure', mockAuth, async (req, res) => {
  try {
    const botResult = await db.query(
      'SELECT * FROM bots WHERE id = $1 AND organization_id = $2',
      [req.params.botId, req.organization.id]
    );

    if (botResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Bot not found' });
    }

    await db.query('DELETE FROM ai_configurations WHERE bot_id = $1', [req.params.botId]);
    res.json({ success: true, message: 'AI configuration deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// TEST AI connection
app.post('/api/bots/:botId/ai/test', mockAuth, async (req, res) => {
  try {
    const configResult = await db.query(
      'SELECT * FROM ai_configurations WHERE bot_id = $1',
      [req.params.botId]
    );

    if (configResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'AI not configured for this bot' });
    }

    // Mock test result
    res.json({
      success: true,
      data: {
        connected: true,
        provider: configResult.rows[0].provider,
        model: configResult.rows[0].model,
        latency: 150
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// CHAT with AI
app.post('/api/bots/:botId/ai/chat', mockAuth, async (req, res) => {
  try {
    const { message, conversation_id } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const configResult = await db.query(
      'SELECT * FROM ai_configurations WHERE bot_id = $1',
      [req.params.botId]
    );

    if (configResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'AI not configured for this bot' });
    }

    // Mock chat response
    res.json({
      success: true,
      data: {
        message: `Response to: ${message}`,
        conversation_id: conversation_id || 'conv-123',
        usage: {
          input_tokens: message.split(' ').length * 2,
          output_tokens: 20
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET AI usage
app.get('/api/bots/:botId/ai/usage', mockAuth, async (req, res) => {
  try {
    const { period = '30d' } = req.query;

    const botResult = await db.query(
      'SELECT * FROM bots WHERE id = $1 AND organization_id = $2',
      [req.params.botId, req.organization.id]
    );

    if (botResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Bot not found' });
    }

    const usageResult = await db.query(
      `SELECT DATE(created_at) as date, SUM(input_tokens) as input_tokens, SUM(output_tokens) as output_tokens
       FROM ai_usage_logs WHERE bot_id = $1
       GROUP BY DATE(created_at) ORDER BY date DESC`,
      [req.params.botId]
    );

    res.json({
      success: true,
      data: {
        period,
        usage: usageResult.rows,
        totals: {
          input_tokens: usageResult.rows.reduce((sum, r) => sum + parseInt(r.input_tokens || 0), 0),
          output_tokens: usageResult.rows.reduce((sum, r) => sum + parseInt(r.output_tokens || 0), 0)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

describe('AI API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // GET PROVIDERS
  // ========================================
  describe('GET /api/ai/providers', () => {
    it('should return list of AI providers', async () => {
      const res = await request(app).get('/api/ai/providers');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].id).toBe('openai');
      expect(res.body.data[1].id).toBe('anthropic');
    });

    it('should include models for each provider', async () => {
      const res = await request(app).get('/api/ai/providers');

      expect(res.body.data[0].models).toBeDefined();
      expect(res.body.data[0].models).toContain('gpt-4o');
    });
  });

  // ========================================
  // GET MODELS BY PROVIDER
  // ========================================
  describe('GET /api/ai/models/:provider', () => {
    it('should return OpenAI models', async () => {
      const res = await request(app).get('/api/ai/models/openai');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.find(m => m.id === 'gpt-4o')).toBeDefined();
    });

    it('should return Anthropic models', async () => {
      const res = await request(app).get('/api/ai/models/anthropic');

      expect(res.status).toBe(200);
      expect(res.body.data.find(m => m.id === 'claude-sonnet-4-5')).toBeDefined();
    });

    it('should return 404 for invalid provider', async () => {
      const res = await request(app).get('/api/ai/models/invalid');

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Provider not found');
    });
  });

  // ========================================
  // GET AI CONFIG
  // ========================================
  describe('GET /api/bots/:botId/ai/configure', () => {
    it('should return AI configuration', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            provider: 'openai',
            model: 'gpt-4o',
            temperature: 0.7,
            api_key_encrypted: 'secret'
          }]
        });

      const res = await request(app).get('/api/bots/1/ai/configure');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.provider).toBe('openai');
      expect(res.body.data.api_key_encrypted).toBeUndefined();
    });

    it('should return null if not configured', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/bots/1/ai/configure');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/bots/999/ai/configure');

      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/bots/1/ai/configure');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // POST AI CONFIG
  // ========================================
  describe('POST /api/bots/:botId/ai/configure', () => {
    it('should create AI configuration', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            provider: 'openai',
            model: 'gpt-4o',
            temperature: 0.7
          }]
        });

      const res = await request(app)
        .post('/api/bots/1/ai/configure')
        .send({
          provider: 'openai',
          model: 'gpt-4o',
          api_key: 'sk-test123'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.provider).toBe('openai');
    });

    it('should return 400 if provider is missing', async () => {
      const res = await request(app)
        .post('/api/bots/1/ai/configure')
        .send({ model: 'gpt-4o' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Provider');
    });

    it('should return 400 if model is missing', async () => {
      const res = await request(app)
        .post('/api/bots/1/ai/configure')
        .send({ provider: 'openai' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Model');
    });

    it('should return 400 for invalid provider', async () => {
      const res = await request(app)
        .post('/api/bots/1/ai/configure')
        .send({ provider: 'invalid', model: 'test' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid provider');
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/bots/999/ai/configure')
        .send({ provider: 'openai', model: 'gpt-4o' });

      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .post('/api/bots/1/ai/configure')
        .send({ provider: 'openai', model: 'gpt-4o' });

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // DELETE AI CONFIG
  // ========================================
  describe('DELETE /api/bots/:botId/ai/configure', () => {
    it('should delete AI configuration', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app).delete('/api/bots/1/ai/configure');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).delete('/api/bots/999/ai/configure');

      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).delete('/api/bots/1/ai/configure');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // TEST AI CONNECTION
  // ========================================
  describe('POST /api/bots/:botId/ai/test', () => {
    it('should test AI connection successfully', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, provider: 'openai', model: 'gpt-4o' }]
      });

      const res = await request(app).post('/api/bots/1/ai/test');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.connected).toBe(true);
      expect(res.body.data.latency).toBeDefined();
    });

    it('should return 404 if AI not configured', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).post('/api/bots/1/ai/test');

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('not configured');
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).post('/api/bots/1/ai/test');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // CHAT WITH AI
  // ========================================
  describe('POST /api/bots/:botId/ai/chat', () => {
    it('should send chat message successfully', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, provider: 'openai', model: 'gpt-4o' }]
      });

      const res = await request(app)
        .post('/api/bots/1/ai/chat')
        .send({ message: 'Hello, how are you?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBeDefined();
      expect(res.body.data.conversation_id).toBeDefined();
      expect(res.body.data.usage).toBeDefined();
    });

    it('should return 400 if message is missing', async () => {
      const res = await request(app)
        .post('/api/bots/1/ai/chat')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Message');
    });

    it('should return 400 if message is empty', async () => {
      const res = await request(app)
        .post('/api/bots/1/ai/chat')
        .send({ message: '   ' });

      expect(res.status).toBe(400);
    });

    it('should return 404 if AI not configured', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/bots/1/ai/chat')
        .send({ message: 'Hello' });

      expect(res.status).toBe(404);
    });

    it('should accept conversation_id', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, provider: 'openai' }]
      });

      const res = await request(app)
        .post('/api/bots/1/ai/chat')
        .send({ message: 'Hello', conversation_id: 'conv-456' });

      expect(res.status).toBe(200);
      expect(res.body.data.conversation_id).toBe('conv-456');
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .post('/api/bots/1/ai/chat')
        .send({ message: 'Hello' });

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // GET AI USAGE
  // ========================================
  describe('GET /api/bots/:botId/ai/usage', () => {
    it('should return AI usage statistics', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({
          rows: [
            { date: '2024-01-01', input_tokens: '1000', output_tokens: '500' },
            { date: '2024-01-02', input_tokens: '2000', output_tokens: '1000' }
          ]
        });

      const res = await request(app).get('/api/bots/1/ai/usage');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.usage).toHaveLength(2);
      expect(res.body.data.totals.input_tokens).toBe(3000);
      expect(res.body.data.totals.output_tokens).toBe(1500);
    });

    it('should accept period parameter', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/bots/1/ai/usage?period=7d');

      expect(res.status).toBe(200);
      expect(res.body.data.period).toBe('7d');
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/bots/999/ai/usage');

      expect(res.status).toBe(404);
    });

    it('should handle empty usage data', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/bots/1/ai/usage');

      expect(res.status).toBe(200);
      expect(res.body.data.totals.input_tokens).toBe(0);
      expect(res.body.data.totals.output_tokens).toBe(0);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/bots/1/ai/usage');

      expect(res.status).toBe(500);
    });
  });
});

// ========================================
// AI EDGE CASES
// ========================================
describe('AI Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Provider Validation', () => {
    it('should accept all valid providers', async () => {
      const providers = ['openai', 'anthropic', 'google', 'azure'];

      for (const provider of providers) {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ provider }] });

        const res = await request(app)
          .post('/api/bots/1/ai/configure')
          .send({ provider, model: 'test-model' });

        expect(res.status).toBe(200);
      }
    });
  });

  describe('Temperature Validation', () => {
    it('should accept temperature 0', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ temperature: 0 }] });

      const res = await request(app)
        .post('/api/bots/1/ai/configure')
        .send({ provider: 'openai', model: 'gpt-4o', temperature: 0 });

      expect(res.status).toBe(200);
    });

    it('should accept temperature 1', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ temperature: 1 }] });

      const res = await request(app)
        .post('/api/bots/1/ai/configure')
        .send({ provider: 'openai', model: 'gpt-4o', temperature: 1 });

      expect(res.status).toBe(200);
    });
  });

  describe('Long Messages', () => {
    it('should handle very long chat messages', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, provider: 'openai' }] });

      const longMessage = 'A'.repeat(10000);
      const res = await request(app)
        .post('/api/bots/1/ai/chat')
        .send({ message: longMessage });

      expect(res.status).toBe(200);
    });
  });

  describe('System Prompt', () => {
    it('should accept system prompt in configuration', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ system_prompt: 'You are a helpful assistant' }] });

      const res = await request(app)
        .post('/api/bots/1/ai/configure')
        .send({
          provider: 'openai',
          model: 'gpt-4o',
          system_prompt: 'You are a helpful assistant'
        });

      expect(res.status).toBe(200);
    });
  });
});
