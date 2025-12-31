/**
 * VoiceToBot Routes Tests
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies
jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../middleware/auth', () => (req, res, next) => {
  req.user = { id: 'user-1', email: 'test@example.com' };
  next();
});

jest.mock('../../middleware/organizationContext', () => ({
  organizationContext: (req, res, next) => {
    req.organization = { id: 1, name: 'Test Org' };
    next();
  },
  requireOrganization: (req, res, next) => next()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../services/voiceToBot', () => ({
  VoiceProcessor: jest.fn().mockImplementation(() => ({
    getSupportedFormats: jest.fn(() => ['webm', 'mp3', 'wav']),
    getSupportedLanguages: jest.fn(() => ['en', 'tr', 'az']),
    preprocessAudio: jest.fn().mockResolvedValue({ success: true, buffer: Buffer.from('test'), format: 'wav' }),
    transcribe: jest.fn().mockResolvedValue({ success: true, text: 'test transcription', language: 'en', confidence: 0.95 }),
    cleanTranscription: jest.fn(text => text),
    correctTranscription: jest.fn().mockResolvedValue({ text: 'corrected text', corrected: true }),
    extractKeyPhrases: jest.fn(() => ['test', 'phrase']),
    transcribeChunk: jest.fn().mockResolvedValue({ success: true, text: 'chunk', confidence: 0.9 })
  })),
  IntentExtractor: jest.fn().mockImplementation(() => ({
    extractFromText: jest.fn().mockResolvedValue({
      success: true,
      name: 'Test Bot',
      description: 'A test bot',
      intents: [{ name: 'greeting' }],
      entities: [],
      flows: [],
      suggestedFeatures: [],
      processingTimeMs: 100
    })
  })),
  BotGenerator: jest.fn().mockImplementation(() => ({
    previewBot: jest.fn(() => ({ name: 'Preview Bot', nodeCount: 5 })),
    generateBot: jest.fn().mockResolvedValue({
      success: true,
      bot: { id: 'bot-1', name: 'Generated Bot' },
      intents: [],
      entities: [],
      flow: null,
      processingTimeMs: 200
    }),
    getTemplates: jest.fn().mockResolvedValue({ success: true, templates: [] }),
    getTemplate: jest.fn().mockResolvedValue({ success: true, template: { id: 1, name: 'Template' } })
  }))
}));

jest.mock('multer', () => {
  const multerMock = () => ({
    single: () => (req, res, next) => {
      req.file = { buffer: Buffer.from('test'), mimetype: 'audio/webm' };
      next();
    }
  });
  multerMock.memoryStorage = jest.fn(() => ({}));
  return multerMock;
});

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-session-uuid')
}));

const db = require('../../db');
const voiceToBotRouter = require('../../routes/voiceToBot');

describe('VoiceToBot Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/voice-to-bot', voiceToBotRouter);
  });

  describe('POST /api/voice-to-bot/start', () => {
    it('should start a new session', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, session_id: 'test-session-uuid', status: 'recording' }]
      });

      const res = await request(app)
        .post('/api/voice-to-bot/start')
        .send({ language: 'en' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.session.session_id).toBe('test-session-uuid');
      expect(res.body.supportedFormats).toBeDefined();
      expect(res.body.supportedLanguages).toBeDefined();
    });

    it('should use default language if not provided', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, session_id: 'test-session-uuid', status: 'recording' }]
      });

      const res = await request(app)
        .post('/api/voice-to-bot/start')
        .send({});

      expect(res.status).toBe(201);
      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['en'])
      );
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .post('/api/voice-to-bot/start')
        .send({});

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to start session');
    });
  });

  describe('GET /api/voice-to-bot/sessions', () => {
    it('should return user sessions', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, session_id: 'sess-1', status: 'completed', bot_name: 'Bot 1' },
          { id: 2, session_id: 'sess-2', status: 'recording', bot_name: null }
        ]
      });

      const res = await request(app).get('/api/voice-to-bot/sessions');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.sessions).toHaveLength(2);
    });

    it('should filter by status', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await request(app).get('/api/voice-to-bot/sessions?status=completed');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('status'),
        expect.arrayContaining(['completed'])
      );
    });

    it('should apply pagination', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await request(app).get('/api/voice-to-bot/sessions?limit=10&offset=5');

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['10', '5'])
      );
    });
  });

  describe('GET /api/voice-to-bot/sessions/:sessionId', () => {
    it('should return session details', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, session_id: 'sess-1', status: 'completed' }]
      });

      const res = await request(app).get('/api/voice-to-bot/sessions/sess-1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.session.session_id).toBe('sess-1');
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app).get('/api/voice-to-bot/sessions/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Session not found');
    });
  });

  describe('POST /api/voice-to-bot/transcribe', () => {
    it('should transcribe audio file', async () => {
      const res = await request(app)
        .post('/api/voice-to-bot/transcribe')
        .attach('audio', Buffer.from('test'), 'test.webm');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.transcription).toBeDefined();
    });
  });

  describe('POST /api/voice-to-bot/transcribe-chunk', () => {
    it('should transcribe audio chunk', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, session_id: 'sess-1', language: 'en' }]
      }).mockResolvedValue({ rows: [] });

      const res = await request(app)
        .post('/api/voice-to-bot/transcribe-chunk')
        .field('sessionId', 'sess-1')
        .field('chunkNumber', '0')
        .field('isFinal', 'false')
        .attach('audio', Buffer.from('test'), 'chunk.webm');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 for invalid session', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app)
        .post('/api/voice-to-bot/transcribe-chunk')
        .field('sessionId', 'invalid')
        .attach('audio', Buffer.from('test'), 'chunk.webm');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/voice-to-bot/extract', () => {
    it('should extract intents from text', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, session_id: 'sess-1', language: 'en', transcription: 'test text' }]
      }).mockResolvedValue({ rows: [] });

      const res = await request(app)
        .post('/api/voice-to-bot/extract')
        .send({ sessionId: 'sess-1', text: 'Create a support bot' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.extracted).toBeDefined();
      expect(res.body.preview).toBeDefined();
    });

    it('should return 404 for invalid session', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app)
        .post('/api/voice-to-bot/extract')
        .send({ sessionId: 'invalid' });

      expect(res.status).toBe(404);
    });

    it('should return 400 if no text to process', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, session_id: 'sess-1', transcription: null }]
      });

      const res = await request(app)
        .post('/api/voice-to-bot/extract')
        .send({ sessionId: 'sess-1' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('No text to process');
    });
  });

  describe('POST /api/voice-to-bot/generate', () => {
    it('should generate bot from session', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          session_id: 'sess-1',
          extracted_name: 'Test Bot',
          extracted_description: 'A test bot',
          extracted_intents: '[]',
          extracted_entities: '[]',
          extracted_flows: '[]',
          ai_analysis: { category: 'support' },
          language: 'en'
        }]
      }).mockResolvedValue({ rows: [] });

      const res = await request(app)
        .post('/api/voice-to-bot/generate')
        .send({ sessionId: 'sess-1' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.bot).toBeDefined();
    });

    it('should generate bot from direct data', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app)
        .post('/api/voice-to-bot/generate')
        .send({
          extractedData: {
            name: 'Direct Bot',
            description: 'Created directly',
            intents: []
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 if no data available', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app)
        .post('/api/voice-to-bot/generate')
        .send({ sessionId: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('No extracted data available');
    });

    it('should apply customizations', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          session_id: 'sess-1',
          extracted_intents: '[]',
          extracted_entities: '[]',
          extracted_flows: '[]',
          language: 'en'
        }]
      }).mockResolvedValue({ rows: [] });

      const res = await request(app)
        .post('/api/voice-to-bot/generate')
        .send({
          sessionId: 'sess-1',
          customizations: { name: 'Custom Name', description: 'Custom desc' }
        });

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/voice-to-bot/preview', () => {
    it('should generate preview', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          session_id: 'sess-1',
          extracted_name: 'Test Bot',
          extracted_intents: '[]',
          extracted_entities: '[]',
          ai_analysis: {}
        }]
      });

      const res = await request(app)
        .post('/api/voice-to-bot/preview')
        .send({ sessionId: 'sess-1' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.preview).toBeDefined();
    });

    it('should return 404 if session not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app)
        .post('/api/voice-to-bot/preview')
        .send({ sessionId: 'invalid' });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/voice-to-bot/templates', () => {
    it('should return templates', async () => {
      const res = await request(app).get('/api/voice-to-bot/templates');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.templates).toBeDefined();
    });
  });

  describe('GET /api/voice-to-bot/templates/:id', () => {
    it('should return template by id', async () => {
      const res = await request(app).get('/api/voice-to-bot/templates/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.template).toBeDefined();
    });
  });

  describe('DELETE /api/voice-to-bot/sessions/:sessionId', () => {
    it('should delete session', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1 }] });

      const res = await request(app).delete('/api/voice-to-bot/sessions/sess-1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app).delete('/api/voice-to-bot/sessions/invalid');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/voice-to-bot/supported', () => {
    it('should return supported formats and languages', async () => {
      const res = await request(app).get('/api/voice-to-bot/supported');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.formats).toBeDefined();
      expect(res.body.languages).toBeDefined();
    });
  });
});
