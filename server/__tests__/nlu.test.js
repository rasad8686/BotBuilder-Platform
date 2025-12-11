/**
 * NLU API Tests
 * Tests for /api/nlu endpoints: analyze, import/export, conflicts, analytics
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

// POST analyze message
app.post('/api/nlu/analyze', mockAuth, async (req, res) => {
  try {
    const { bot_id, message } = req.body;

    if (!bot_id) {
      return res.status(400).json({ success: false, message: 'Bot ID is required' });
    }
    if (!message || message.trim() === '') {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    // Get intents for matching
    const intentsResult = await db.query(
      'SELECT * FROM intents WHERE bot_id = $1',
      [bot_id]
    );

    // Mock NLU analysis
    const matchedIntent = intentsResult.rows[0] || null;
    const confidence = matchedIntent ? 0.85 : 0.1;

    res.json({
      success: true,
      data: {
        message,
        intent: matchedIntent ? {
          id: matchedIntent.id,
          name: matchedIntent.name,
          confidence
        } : null,
        entities: [],
        confidence,
        is_fallback: !matchedIntent || confidence < 0.5
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST import intents
app.post('/api/nlu/import/intents', mockAuth, async (req, res) => {
  try {
    const { bot_id, intents, format = 'json' } = req.body;

    if (!bot_id) {
      return res.status(400).json({ success: false, message: 'Bot ID is required' });
    }
    if (!intents || !Array.isArray(intents) || intents.length === 0) {
      return res.status(400).json({ success: false, message: 'Intents array is required' });
    }

    const validFormats = ['json', 'csv'];
    if (!validFormats.includes(format)) {
      return res.status(400).json({ success: false, message: 'Invalid format. Use json or csv' });
    }

    let imported = 0;
    let skipped = 0;

    for (const intent of intents) {
      if (!intent.name) {
        skipped++;
        continue;
      }

      await db.query(
        'INSERT INTO intents (bot_id, name, description) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [bot_id, intent.name, intent.description || '']
      );
      imported++;
    }

    res.json({
      success: true,
      data: {
        imported,
        skipped,
        total: intents.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST import entities
app.post('/api/nlu/import/entities', mockAuth, async (req, res) => {
  try {
    const { bot_id, entities, format = 'json' } = req.body;

    if (!bot_id) {
      return res.status(400).json({ success: false, message: 'Bot ID is required' });
    }
    if (!entities || !Array.isArray(entities) || entities.length === 0) {
      return res.status(400).json({ success: false, message: 'Entities array is required' });
    }

    let imported = 0;
    let skipped = 0;

    for (const entity of entities) {
      if (!entity.name) {
        skipped++;
        continue;
      }

      await db.query(
        'INSERT INTO entities (bot_id, name, type) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [bot_id, entity.name, entity.type || 'custom']
      );
      imported++;
    }

    res.json({
      success: true,
      data: {
        imported,
        skipped,
        total: entities.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET export intents
app.get('/api/nlu/export/intents', mockAuth, async (req, res) => {
  try {
    const { bot_id, format = 'json' } = req.query;

    if (!bot_id) {
      return res.status(400).json({ success: false, message: 'Bot ID is required' });
    }

    const result = await db.query(
      'SELECT id, name, description FROM intents WHERE bot_id = $1 ORDER BY name',
      [bot_id]
    );

    const examplesResult = await db.query(
      'SELECT intent_id, text FROM intent_examples WHERE intent_id IN (SELECT id FROM intents WHERE bot_id = $1)',
      [bot_id]
    );

    const intentsWithExamples = result.rows.map(intent => ({
      ...intent,
      examples: examplesResult.rows.filter(e => e.intent_id === intent.id).map(e => e.text)
    }));

    if (format === 'csv') {
      // Mock CSV output
      res.type('text/csv');
      res.send('name,description,examples\n' + intentsWithExamples.map(i => `${i.name},${i.description},"${i.examples.join('; ')}"`).join('\n'));
    } else {
      res.json({ success: true, data: intentsWithExamples });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET export entities
app.get('/api/nlu/export/entities', mockAuth, async (req, res) => {
  try {
    const { bot_id, format = 'json' } = req.query;

    if (!bot_id) {
      return res.status(400).json({ success: false, message: 'Bot ID is required' });
    }

    const result = await db.query(
      'SELECT id, name, type FROM entities WHERE bot_id = $1 ORDER BY name',
      [bot_id]
    );

    if (format === 'csv') {
      res.type('text/csv');
      res.send('name,type\n' + result.rows.map(e => `${e.name},${e.type}`).join('\n'));
    } else {
      res.json({ success: true, data: result.rows });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET conflicts
app.get('/api/nlu/conflicts', mockAuth, async (req, res) => {
  try {
    const { bot_id } = req.query;

    if (!bot_id) {
      return res.status(400).json({ success: false, message: 'Bot ID is required' });
    }

    // Mock conflict detection
    const intentsResult = await db.query(
      'SELECT id, name FROM intents WHERE bot_id = $1',
      [bot_id]
    );

    const conflicts = [];
    // In real implementation, would compare embeddings/examples

    res.json({
      success: true,
      data: {
        conflicts,
        total_intents: intentsResult.rows.length,
        conflict_count: conflicts.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST resolve conflict
app.post('/api/nlu/resolve-conflict', mockAuth, async (req, res) => {
  try {
    const { conflict_id, action, target_intent_id } = req.body;

    if (!conflict_id) {
      return res.status(400).json({ success: false, message: 'Conflict ID is required' });
    }
    if (!action) {
      return res.status(400).json({ success: false, message: 'Action is required' });
    }

    const validActions = ['delete', 'move', 'merge'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid action. Use delete, move, or merge' });
    }

    if ((action === 'move' || action === 'merge') && !target_intent_id) {
      return res.status(400).json({ success: false, message: 'Target intent ID is required for this action' });
    }

    res.json({
      success: true,
      message: `Conflict resolved using ${action} action`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST find similar
app.post('/api/nlu/find-similar', mockAuth, async (req, res) => {
  try {
    const { bot_id, text, threshold = 0.8 } = req.body;

    if (!bot_id) {
      return res.status(400).json({ success: false, message: 'Bot ID is required' });
    }
    if (!text || text.trim() === '') {
      return res.status(400).json({ success: false, message: 'Text is required' });
    }

    // Mock similar examples
    const result = await db.query(
      'SELECT ie.*, i.name as intent_name FROM intent_examples ie JOIN intents i ON ie.intent_id = i.id WHERE i.bot_id = $1 LIMIT 10',
      [bot_id]
    );

    const similar = result.rows.map(row => ({
      ...row,
      similarity: Math.random() * 0.3 + 0.7 // Mock similarity score
    })).filter(r => r.similarity >= threshold);

    res.json({
      success: true,
      data: {
        query: text,
        threshold,
        results: similar
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET analytics summary
app.get('/api/nlu/analytics/summary', mockAuth, async (req, res) => {
  try {
    const { bot_id } = req.query;

    if (!bot_id) {
      return res.status(400).json({ success: false, message: 'Bot ID is required' });
    }

    const intentsResult = await db.query('SELECT COUNT(*) FROM intents WHERE bot_id = $1', [bot_id]);
    const entitiesResult = await db.query('SELECT COUNT(*) FROM entities WHERE bot_id = $1', [bot_id]);
    const examplesResult = await db.query(
      'SELECT COUNT(*) FROM intent_examples WHERE intent_id IN (SELECT id FROM intents WHERE bot_id = $1)',
      [bot_id]
    );

    res.json({
      success: true,
      data: {
        intents: parseInt(intentsResult.rows[0].count),
        entities: parseInt(entitiesResult.rows[0].count),
        examples: parseInt(examplesResult.rows[0].count),
        avg_examples_per_intent: intentsResult.rows[0].count > 0
          ? Math.round(examplesResult.rows[0].count / intentsResult.rows[0].count)
          : 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET intent analytics
app.get('/api/nlu/analytics/intents', mockAuth, async (req, res) => {
  try {
    const { bot_id, period = '30d' } = req.query;

    if (!bot_id) {
      return res.status(400).json({ success: false, message: 'Bot ID is required' });
    }

    const result = await db.query(
      `SELECT i.name, COUNT(m.id) as match_count
       FROM intents i
       LEFT JOIN bot_messages m ON m.intent_id = i.id
       WHERE i.bot_id = $1
       GROUP BY i.id, i.name
       ORDER BY match_count DESC`,
      [bot_id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET entity analytics
app.get('/api/nlu/analytics/entities', mockAuth, async (req, res) => {
  try {
    const { bot_id } = req.query;

    if (!bot_id) {
      return res.status(400).json({ success: false, message: 'Bot ID is required' });
    }

    const result = await db.query(
      'SELECT name, type, COUNT(id) as value_count FROM entities WHERE bot_id = $1 GROUP BY id, name, type',
      [bot_id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET confidence analytics
app.get('/api/nlu/analytics/confidence', mockAuth, async (req, res) => {
  try {
    const { bot_id } = req.query;

    if (!bot_id) {
      return res.status(400).json({ success: false, message: 'Bot ID is required' });
    }

    // Mock confidence distribution
    res.json({
      success: true,
      data: {
        distribution: [
          { range: '0.9-1.0', count: 150 },
          { range: '0.8-0.9', count: 80 },
          { range: '0.7-0.8', count: 45 },
          { range: '0.6-0.7', count: 20 },
          { range: '0.5-0.6', count: 10 },
          { range: '0.0-0.5', count: 5 }
        ],
        avg_confidence: 0.82
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET low confidence messages
app.get('/api/nlu/analytics/low-confidence', mockAuth, async (req, res) => {
  try {
    const { bot_id, threshold = 0.5 } = req.query;

    if (!bot_id) {
      return res.status(400).json({ success: false, message: 'Bot ID is required' });
    }

    const result = await db.query(
      `SELECT m.*, i.name as intent_name
       FROM bot_messages m
       LEFT JOIN intents i ON m.intent_id = i.id
       WHERE m.bot_id = $1 AND m.confidence < $2
       ORDER BY m.created_at DESC LIMIT 50`,
      [bot_id, threshold]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET unmatched messages
app.get('/api/nlu/analytics/unmatched', mockAuth, async (req, res) => {
  try {
    const { bot_id } = req.query;

    if (!bot_id) {
      return res.status(400).json({ success: false, message: 'Bot ID is required' });
    }

    const result = await db.query(
      `SELECT * FROM bot_messages
       WHERE bot_id = $1 AND intent_id IS NULL
       ORDER BY created_at DESC LIMIT 50`,
      [bot_id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET training gaps
app.get('/api/nlu/analytics/training-gaps', mockAuth, async (req, res) => {
  try {
    const { bot_id } = req.query;

    if (!bot_id) {
      return res.status(400).json({ success: false, message: 'Bot ID is required' });
    }

    const result = await db.query(
      `SELECT i.id, i.name, COUNT(ie.id) as example_count
       FROM intents i
       LEFT JOIN intent_examples ie ON ie.intent_id = i.id
       WHERE i.bot_id = $1
       GROUP BY i.id, i.name
       HAVING COUNT(ie.id) < 10
       ORDER BY example_count ASC`,
      [bot_id]
    );

    res.json({
      success: true,
      data: {
        intents_needing_examples: result.rows,
        recommended_examples: 10
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET daily usage
app.get('/api/nlu/analytics/daily', mockAuth, async (req, res) => {
  try {
    const { bot_id, days = 30 } = req.query;

    if (!bot_id) {
      return res.status(400).json({ success: false, message: 'Bot ID is required' });
    }

    const result = await db.query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM bot_messages
       WHERE bot_id = $1 AND created_at > NOW() - INTERVAL '${days} days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      [bot_id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

describe('NLU API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // ANALYZE MESSAGE
  // ========================================
  describe('POST /api/nlu/analyze', () => {
    it('should analyze message successfully', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'greeting' }]
      });

      const res = await request(app)
        .post('/api/nlu/analyze')
        .send({ bot_id: 1, message: 'Hello!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Hello!');
      expect(res.body.data.intent).toBeDefined();
      expect(res.body.data.confidence).toBeDefined();
    });

    it('should return 400 if bot_id is missing', async () => {
      const res = await request(app)
        .post('/api/nlu/analyze')
        .send({ message: 'Hello!' });

      expect(res.status).toBe(400);
    });

    it('should return 400 if message is missing', async () => {
      const res = await request(app)
        .post('/api/nlu/analyze')
        .send({ bot_id: 1 });

      expect(res.status).toBe(400);
    });

    it('should handle no matching intent', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/nlu/analyze')
        .send({ bot_id: 1, message: 'Unknown query' });

      expect(res.status).toBe(200);
      expect(res.body.data.is_fallback).toBe(true);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .post('/api/nlu/analyze')
        .send({ bot_id: 1, message: 'Hello!' });

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // IMPORT INTENTS
  // ========================================
  describe('POST /api/nlu/import/intents', () => {
    it('should import intents successfully', async () => {
      db.query.mockResolvedValue({ rowCount: 1 });

      const res = await request(app)
        .post('/api/nlu/import/intents')
        .send({
          bot_id: 1,
          intents: [
            { name: 'greeting', description: 'Greeting intent' },
            { name: 'farewell', description: 'Farewell intent' }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.imported).toBe(2);
    });

    it('should return 400 if bot_id is missing', async () => {
      const res = await request(app)
        .post('/api/nlu/import/intents')
        .send({ intents: [{ name: 'test' }] });

      expect(res.status).toBe(400);
    });

    it('should return 400 if intents is empty', async () => {
      const res = await request(app)
        .post('/api/nlu/import/intents')
        .send({ bot_id: 1, intents: [] });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid format', async () => {
      const res = await request(app)
        .post('/api/nlu/import/intents')
        .send({ bot_id: 1, intents: [{ name: 'test' }], format: 'invalid' });

      expect(res.status).toBe(400);
    });

    it('should skip intents without name', async () => {
      db.query.mockResolvedValue({ rowCount: 1 });

      const res = await request(app)
        .post('/api/nlu/import/intents')
        .send({
          bot_id: 1,
          intents: [
            { name: 'valid' },
            { description: 'no name' }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.data.skipped).toBe(1);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .post('/api/nlu/import/intents')
        .send({ bot_id: 1, intents: [{ name: 'test' }] });

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // IMPORT ENTITIES
  // ========================================
  describe('POST /api/nlu/import/entities', () => {
    it('should import entities successfully', async () => {
      db.query.mockResolvedValue({ rowCount: 1 });

      const res = await request(app)
        .post('/api/nlu/import/entities')
        .send({
          bot_id: 1,
          entities: [
            { name: 'city', type: 'location' },
            { name: 'date', type: 'datetime' }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.data.imported).toBe(2);
    });

    it('should return 400 if bot_id is missing', async () => {
      const res = await request(app)
        .post('/api/nlu/import/entities')
        .send({ entities: [{ name: 'test' }] });

      expect(res.status).toBe(400);
    });

    it('should return 400 if entities is empty', async () => {
      const res = await request(app)
        .post('/api/nlu/import/entities')
        .send({ bot_id: 1, entities: [] });

      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .post('/api/nlu/import/entities')
        .send({ bot_id: 1, entities: [{ name: 'test' }] });

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // EXPORT INTENTS
  // ========================================
  describe('GET /api/nlu/export/intents', () => {
    it('should export intents as JSON', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'greeting' }] })
        .mockResolvedValueOnce({ rows: [{ intent_id: 1, text: 'Hello' }] });

      const res = await request(app).get('/api/nlu/export/intents?bot_id=1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('should export intents as CSV', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'greeting', description: '' }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/nlu/export/intents?bot_id=1&format=csv');

      expect(res.status).toBe(200);
      expect(res.type).toBe('text/csv');
    });

    it('should return 400 if bot_id is missing', async () => {
      const res = await request(app).get('/api/nlu/export/intents');

      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/nlu/export/intents?bot_id=1');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // EXPORT ENTITIES
  // ========================================
  describe('GET /api/nlu/export/entities', () => {
    it('should export entities as JSON', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'city', type: 'location' }]
      });

      const res = await request(app).get('/api/nlu/export/entities?bot_id=1');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should export entities as CSV', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'city', type: 'location' }]
      });

      const res = await request(app).get('/api/nlu/export/entities?bot_id=1&format=csv');

      expect(res.status).toBe(200);
      expect(res.type).toBe('text/csv');
    });

    it('should return 400 if bot_id is missing', async () => {
      const res = await request(app).get('/api/nlu/export/entities');

      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/nlu/export/entities?bot_id=1');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // CONFLICTS
  // ========================================
  describe('GET /api/nlu/conflicts', () => {
    it('should return conflict report', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'intent1' }, { id: 2, name: 'intent2' }]
      });

      const res = await request(app).get('/api/nlu/conflicts?bot_id=1');

      expect(res.status).toBe(200);
      expect(res.body.data.total_intents).toBe(2);
      expect(res.body.data.conflicts).toBeDefined();
    });

    it('should return 400 if bot_id is missing', async () => {
      const res = await request(app).get('/api/nlu/conflicts');

      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/nlu/conflicts?bot_id=1');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // RESOLVE CONFLICT
  // ========================================
  describe('POST /api/nlu/resolve-conflict', () => {
    it('should resolve conflict with delete action', async () => {
      const res = await request(app)
        .post('/api/nlu/resolve-conflict')
        .send({ conflict_id: 1, action: 'delete' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should resolve conflict with move action', async () => {
      const res = await request(app)
        .post('/api/nlu/resolve-conflict')
        .send({ conflict_id: 1, action: 'move', target_intent_id: 2 });

      expect(res.status).toBe(200);
    });

    it('should return 400 if conflict_id is missing', async () => {
      const res = await request(app)
        .post('/api/nlu/resolve-conflict')
        .send({ action: 'delete' });

      expect(res.status).toBe(400);
    });

    it('should return 400 if action is missing', async () => {
      const res = await request(app)
        .post('/api/nlu/resolve-conflict')
        .send({ conflict_id: 1 });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid action', async () => {
      const res = await request(app)
        .post('/api/nlu/resolve-conflict')
        .send({ conflict_id: 1, action: 'invalid' });

      expect(res.status).toBe(400);
    });

    it('should return 400 if target_intent_id missing for move/merge', async () => {
      const res = await request(app)
        .post('/api/nlu/resolve-conflict')
        .send({ conflict_id: 1, action: 'move' });

      expect(res.status).toBe(400);
    });
  });

  // ========================================
  // FIND SIMILAR
  // ========================================
  describe('POST /api/nlu/find-similar', () => {
    it('should find similar examples', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, text: 'Hello there', intent_name: 'greeting' }]
      });

      const res = await request(app)
        .post('/api/nlu/find-similar')
        .send({ bot_id: 1, text: 'Hello!' });

      expect(res.status).toBe(200);
      expect(res.body.data.query).toBe('Hello!');
      expect(res.body.data.results).toBeDefined();
    });

    it('should return 400 if bot_id is missing', async () => {
      const res = await request(app)
        .post('/api/nlu/find-similar')
        .send({ text: 'Hello!' });

      expect(res.status).toBe(400);
    });

    it('should return 400 if text is missing', async () => {
      const res = await request(app)
        .post('/api/nlu/find-similar')
        .send({ bot_id: 1 });

      expect(res.status).toBe(400);
    });

    it('should accept custom threshold', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/nlu/find-similar')
        .send({ bot_id: 1, text: 'test', threshold: 0.9 });

      expect(res.status).toBe(200);
      expect(res.body.data.threshold).toBe(0.9);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .post('/api/nlu/find-similar')
        .send({ bot_id: 1, text: 'test' });

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // ANALYTICS
  // ========================================
  describe('GET /api/nlu/analytics/summary', () => {
    it('should return analytics summary', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [{ count: '100' }] });

      const res = await request(app).get('/api/nlu/analytics/summary?bot_id=1');

      expect(res.status).toBe(200);
      expect(res.body.data.intents).toBe(10);
      expect(res.body.data.entities).toBe(5);
      expect(res.body.data.examples).toBe(100);
    });

    it('should return 400 if bot_id is missing', async () => {
      const res = await request(app).get('/api/nlu/analytics/summary');

      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/nlu/analytics/summary?bot_id=1');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/nlu/analytics/intents', () => {
    it('should return intent analytics', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { name: 'greeting', match_count: '50' },
          { name: 'farewell', match_count: '30' }
        ]
      });

      const res = await request(app).get('/api/nlu/analytics/intents?bot_id=1');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return 400 if bot_id is missing', async () => {
      const res = await request(app).get('/api/nlu/analytics/intents');

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/nlu/analytics/entities', () => {
    it('should return entity analytics', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ name: 'city', type: 'location', value_count: '20' }]
      });

      const res = await request(app).get('/api/nlu/analytics/entities?bot_id=1');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should return 400 if bot_id is missing', async () => {
      const res = await request(app).get('/api/nlu/analytics/entities');

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/nlu/analytics/confidence', () => {
    it('should return confidence distribution', async () => {
      const res = await request(app).get('/api/nlu/analytics/confidence?bot_id=1');

      expect(res.status).toBe(200);
      expect(res.body.data.distribution).toBeDefined();
      expect(res.body.data.avg_confidence).toBeDefined();
    });

    it('should return 400 if bot_id is missing', async () => {
      const res = await request(app).get('/api/nlu/analytics/confidence');

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/nlu/analytics/low-confidence', () => {
    it('should return low confidence messages', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, content: 'unclear message', confidence: 0.3 }]
      });

      const res = await request(app).get('/api/nlu/analytics/low-confidence?bot_id=1');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should return 400 if bot_id is missing', async () => {
      const res = await request(app).get('/api/nlu/analytics/low-confidence');

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/nlu/analytics/unmatched', () => {
    it('should return unmatched messages', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, content: 'random text', intent_id: null }]
      });

      const res = await request(app).get('/api/nlu/analytics/unmatched?bot_id=1');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should return 400 if bot_id is missing', async () => {
      const res = await request(app).get('/api/nlu/analytics/unmatched');

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/nlu/analytics/training-gaps', () => {
    it('should return intents needing more examples', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'new_intent', example_count: '3' }]
      });

      const res = await request(app).get('/api/nlu/analytics/training-gaps?bot_id=1');

      expect(res.status).toBe(200);
      expect(res.body.data.intents_needing_examples).toHaveLength(1);
    });

    it('should return 400 if bot_id is missing', async () => {
      const res = await request(app).get('/api/nlu/analytics/training-gaps');

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/nlu/analytics/daily', () => {
    it('should return daily usage', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { date: '2024-01-01', count: '50' },
          { date: '2024-01-02', count: '60' }
        ]
      });

      const res = await request(app).get('/api/nlu/analytics/daily?bot_id=1');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return 400 if bot_id is missing', async () => {
      const res = await request(app).get('/api/nlu/analytics/daily');

      expect(res.status).toBe(400);
    });
  });
});
