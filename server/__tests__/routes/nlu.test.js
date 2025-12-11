/**
 * NLU Routes Tests
 * Tests for server/routes/nlu.js
 */

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 1, email: 'test@example.com', current_organization_id: 1 };
  next();
}));

jest.mock('../../services/IntentEntityManager', () => {
  return jest.fn().mockImplementation(() => ({
    analyzeMessage: jest.fn(),
    createSystemEntities: jest.fn()
  }));
});

jest.mock('../../services/NLUImportExport', () => ({
  importIntentsFromJSON: jest.fn(),
  importIntentsFromCSV: jest.fn(),
  importEntitiesFromJSON: jest.fn(),
  importEntitiesFromCSV: jest.fn(),
  exportIntentsToJSON: jest.fn(),
  exportIntentsToCSV: jest.fn(),
  exportEntitiesToJSON: jest.fn(),
  exportEntitiesToCSV: jest.fn()
}));

jest.mock('../../services/IntentConflictDetector', () => ({
  getConflictReport: jest.fn(),
  resolveConflictByDelete: jest.fn(),
  resolveConflictByMove: jest.fn(),
  resolveConflictByMerge: jest.fn(),
  findSimilarExamples: jest.fn()
}));

jest.mock('../../services/NLUAnalytics', () => ({
  logAnalysis: jest.fn(),
  getSummary: jest.fn(),
  getIntentStats: jest.fn(),
  getEntityStats: jest.fn(),
  getConfidenceDistribution: jest.fn(),
  getLowConfidenceMessages: jest.fn(),
  getUnmatchedMessages: jest.fn(),
  getTrainingGaps: jest.fn(),
  getDailyUsage: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const IntentEntityManager = require('../../services/IntentEntityManager');
const NLUImportExport = require('../../services/NLUImportExport');
const IntentConflictDetector = require('../../services/IntentConflictDetector');
const NLUAnalytics = require('../../services/NLUAnalytics');
const nluRouter = require('../../routes/nlu');

const app = express();
app.use(express.json());
app.use('/api/nlu', nluRouter);

const mockManager = IntentEntityManager.mock.results[0]?.value || new IntentEntityManager();

describe('NLU Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/nlu/analyze', () => {
    it('should analyze message', async () => {
      mockManager.analyzeMessage.mockResolvedValueOnce({
        intent: { id: 1, name: 'greeting' },
        confidence: 0.95,
        entities: [],
        matched: true
      });
      NLUAnalytics.logAnalysis.mockResolvedValueOnce(true);

      const response = await request(app)
        .post('/api/nlu/analyze')
        .send({ botId: 1, message: 'Hello!' });

      expect(response.status).toBe(200);
      expect(response.body.intent.name).toBe('greeting');
      expect(response.body.confidence).toBe(0.95);
    });

    it('should reject missing botId', async () => {
      const response = await request(app)
        .post('/api/nlu/analyze')
        .send({ message: 'Hello!' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('botId and message');
    });

    it('should reject missing message', async () => {
      const response = await request(app)
        .post('/api/nlu/analyze')
        .send({ botId: 1 });

      expect(response.status).toBe(400);
    });

    it('should handle errors', async () => {
      mockManager.analyzeMessage.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app)
        .post('/api/nlu/analyze')
        .send({ botId: 1, message: 'Hello!' });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/nlu/system-entities', () => {
    it('should create system entities', async () => {
      mockManager.createSystemEntities.mockResolvedValueOnce([
        { id: 1, name: 'sys_date' },
        { id: 2, name: 'sys_number' }
      ]);

      const response = await request(app)
        .post('/api/nlu/system-entities')
        .send({ botId: 1 });

      expect(response.status).toBe(201);
      expect(response.body).toHaveLength(2);
    });

    it('should reject missing botId', async () => {
      const response = await request(app)
        .post('/api/nlu/system-entities')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('botId');
    });
  });

  describe('GET /api/nlu/export/intents', () => {
    it('should export intents as JSON', async () => {
      NLUImportExport.exportIntentsToJSON.mockResolvedValueOnce([
        { name: 'greeting', examples: ['hello'] }
      ]);

      const response = await request(app).get('/api/nlu/export/intents?bot_id=1&format=json');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should export intents as CSV', async () => {
      NLUImportExport.exportIntentsToCSV.mockResolvedValueOnce('name,examples\ngreeting,hello');

      const response = await request(app).get('/api/nlu/export/intents?bot_id=1&format=csv');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
    });

    it('should reject missing bot_id', async () => {
      const response = await request(app).get('/api/nlu/export/intents');

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/nlu/export/entities', () => {
    it('should export entities as JSON', async () => {
      NLUImportExport.exportEntitiesToJSON.mockResolvedValueOnce([
        { name: 'color', values: ['red'] }
      ]);

      const response = await request(app).get('/api/nlu/export/entities?bot_id=1&format=json');

      expect(response.status).toBe(200);
    });

    it('should export entities as CSV', async () => {
      NLUImportExport.exportEntitiesToCSV.mockResolvedValueOnce('name,values\ncolor,red');

      const response = await request(app).get('/api/nlu/export/entities?bot_id=1&format=csv');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
    });
  });

  describe('GET /api/nlu/conflicts', () => {
    it('should return conflict report', async () => {
      IntentConflictDetector.getConflictReport.mockResolvedValueOnce({
        conflicts: [],
        duplicates: [],
        totalConflicts: 0
      });

      const response = await request(app).get('/api/nlu/conflicts?bot_id=1');

      expect(response.status).toBe(200);
      expect(response.body.totalConflicts).toBe(0);
    });

    it('should reject missing bot_id', async () => {
      const response = await request(app).get('/api/nlu/conflicts');

      expect(response.status).toBe(400);
    });

    it('should handle errors', async () => {
      IntentConflictDetector.getConflictReport.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app).get('/api/nlu/conflicts?bot_id=1');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/nlu/resolve-conflict', () => {
    it('should resolve conflict by delete', async () => {
      IntentConflictDetector.resolveConflictByDelete.mockResolvedValueOnce({ success: true });

      const response = await request(app)
        .post('/api/nlu/resolve-conflict')
        .send({ action: 'delete', example_id: 1 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should resolve conflict by move', async () => {
      IntentConflictDetector.resolveConflictByMove.mockResolvedValueOnce({ success: true });

      const response = await request(app)
        .post('/api/nlu/resolve-conflict')
        .send({ action: 'move', example_id: 1, target_intent_id: 2 });

      expect(response.status).toBe(200);
    });

    it('should resolve conflict by merge', async () => {
      IntentConflictDetector.resolveConflictByMerge.mockResolvedValueOnce({ success: true });

      const response = await request(app)
        .post('/api/nlu/resolve-conflict')
        .send({ action: 'merge', source_intent_id: 1, target_intent_id: 2 });

      expect(response.status).toBe(200);
    });

    it('should reject missing action', async () => {
      const response = await request(app)
        .post('/api/nlu/resolve-conflict')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('action is required');
    });

    it('should reject invalid action', async () => {
      const response = await request(app)
        .post('/api/nlu/resolve-conflict')
        .send({ action: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid action');
    });

    it('should reject delete without example_id', async () => {
      const response = await request(app)
        .post('/api/nlu/resolve-conflict')
        .send({ action: 'delete' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('example_id');
    });

    it('should reject move without required params', async () => {
      const response = await request(app)
        .post('/api/nlu/resolve-conflict')
        .send({ action: 'move', example_id: 1 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('target_intent_id');
    });

    it('should reject merge without required params', async () => {
      const response = await request(app)
        .post('/api/nlu/resolve-conflict')
        .send({ action: 'merge', source_intent_id: 1 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('target_intent_id');
    });
  });

  describe('POST /api/nlu/find-similar', () => {
    it('should find similar examples', async () => {
      IntentConflictDetector.findSimilarExamples.mockResolvedValueOnce([
        { text: 'hello there', similarity: 0.85, intent_name: 'greeting' }
      ]);

      const response = await request(app)
        .post('/api/nlu/find-similar')
        .send({ bot_id: 1, text: 'hello' });

      expect(response.status).toBe(200);
      expect(response.body.similar).toHaveLength(1);
    });

    it('should reject missing bot_id or text', async () => {
      const response = await request(app)
        .post('/api/nlu/find-similar')
        .send({ text: 'hello' });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/nlu/analytics/summary', () => {
    it('should return analytics summary', async () => {
      NLUAnalytics.getSummary.mockResolvedValueOnce({
        totalQueries: 1000,
        matchRate: 0.85,
        avgConfidence: 0.78
      });

      const response = await request(app).get('/api/nlu/analytics/summary?bot_id=1');

      expect(response.status).toBe(200);
      expect(response.body.totalQueries).toBe(1000);
    });

    it('should reject missing bot_id', async () => {
      const response = await request(app).get('/api/nlu/analytics/summary');

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/nlu/analytics/intents', () => {
    it('should return intent stats', async () => {
      NLUAnalytics.getIntentStats.mockResolvedValueOnce([
        { name: 'greeting', count: 500, avgConfidence: 0.92 }
      ]);

      const response = await request(app).get('/api/nlu/analytics/intents?bot_id=1');

      expect(response.status).toBe(200);
      expect(response.body.intents).toHaveLength(1);
    });
  });

  describe('GET /api/nlu/analytics/entities', () => {
    it('should return entity stats', async () => {
      NLUAnalytics.getEntityStats.mockResolvedValueOnce([
        { name: 'color', count: 200 }
      ]);

      const response = await request(app).get('/api/nlu/analytics/entities?bot_id=1');

      expect(response.status).toBe(200);
      expect(response.body.entities).toHaveLength(1);
    });
  });

  describe('GET /api/nlu/analytics/confidence', () => {
    it('should return confidence distribution', async () => {
      NLUAnalytics.getConfidenceDistribution.mockResolvedValueOnce({
        high: 500,
        medium: 300,
        low: 100
      });

      const response = await request(app).get('/api/nlu/analytics/confidence?bot_id=1');

      expect(response.status).toBe(200);
      expect(response.body.high).toBe(500);
    });
  });

  describe('GET /api/nlu/analytics/low-confidence', () => {
    it('should return low confidence messages', async () => {
      NLUAnalytics.getLowConfidenceMessages.mockResolvedValueOnce([
        { message: 'test', confidence: 0.3 }
      ]);

      const response = await request(app).get('/api/nlu/analytics/low-confidence?bot_id=1');

      expect(response.status).toBe(200);
      expect(response.body.messages).toHaveLength(1);
    });
  });

  describe('GET /api/nlu/analytics/unmatched', () => {
    it('should return unmatched messages', async () => {
      NLUAnalytics.getUnmatchedMessages.mockResolvedValueOnce([
        { message: 'unknown query' }
      ]);

      const response = await request(app).get('/api/nlu/analytics/unmatched?bot_id=1');

      expect(response.status).toBe(200);
      expect(response.body.messages).toHaveLength(1);
    });
  });

  describe('GET /api/nlu/analytics/training-gaps', () => {
    it('should return training gaps', async () => {
      NLUAnalytics.getTrainingGaps.mockResolvedValueOnce([
        { intent: 'greeting', priority: 'high', reason: 'Few examples' }
      ]);

      const response = await request(app).get('/api/nlu/analytics/training-gaps?bot_id=1');

      expect(response.status).toBe(200);
      expect(response.body.gaps).toHaveLength(1);
      expect(response.body.summary).toBeDefined();
    });
  });

  describe('GET /api/nlu/analytics/daily', () => {
    it('should return daily usage', async () => {
      NLUAnalytics.getDailyUsage.mockResolvedValueOnce([
        { date: '2024-01-01', count: 100 }
      ]);

      const response = await request(app).get('/api/nlu/analytics/daily?bot_id=1');

      expect(response.status).toBe(200);
      expect(response.body.daily).toHaveLength(1);
    });
  });
});
