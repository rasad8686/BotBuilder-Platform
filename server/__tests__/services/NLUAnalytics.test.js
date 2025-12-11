/**
 * NLUAnalytics Service Tests
 * Tests for server/services/NLUAnalytics.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

const db = require('../../db');
const nluAnalytics = require('../../services/NLUAnalytics');

describe('NLUAnalytics Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logAnalysis()', () => {
    it('should log NLU analysis result', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await nluAnalytics.logAnalysis(1, 1, {
        message: 'Hello',
        detectedIntentId: 1,
        detectedIntentName: 'greeting',
        confidence: 0.95,
        entitiesExtracted: [{ type: 'name', value: 'John' }],
        matched: true,
        responseTimeMs: 50,
        userSessionId: 'session123'
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO nlu_logs'),
        expect.arrayContaining([1, 1, 'Hello', 1, 'greeting'])
      );
    });

    it('should handle null values', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await nluAnalytics.logAnalysis(1, 1, {
        message: 'Hello',
        matched: false
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO nlu_logs'),
        expect.arrayContaining([1, 1, 'Hello', null, null, 0, '[]', false, 0, null])
      );
    });
  });

  describe('getIntentStats()', () => {
    it('should return intent usage statistics', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            intent_id: 1,
            name: 'greeting',
            display_name: 'Greeting',
            hit_count: '100',
            avg_confidence: '0.9500',
            matched_count: '95',
            last_used: new Date()
          },
          {
            intent_id: 2,
            name: 'goodbye',
            display_name: 'Goodbye',
            hit_count: '50',
            avg_confidence: '0.8800',
            matched_count: '45',
            last_used: new Date()
          }
        ]
      });

      const stats = await nluAnalytics.getIntentStats(1, 1, 30);

      expect(stats).toHaveLength(2);
      expect(stats[0].intentId).toBe(1);
      expect(stats[0].hitCount).toBe(100);
      expect(stats[0].avgConfidence).toBe(0.95);
    });

    it('should handle empty results', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const stats = await nluAnalytics.getIntentStats(1, 1);

      expect(stats).toEqual([]);
    });
  });

  describe('getEntityStats()', () => {
    it('should return entity extraction statistics', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            entity_id: '1',
            entity_name: 'name',
            extraction_count: '75',
            unique_values: '50'
          }
        ]
      });

      const stats = await nluAnalytics.getEntityStats(1, 1);

      expect(stats).toHaveLength(1);
      expect(stats[0].entityName).toBe('name');
      expect(stats[0].extractionCount).toBe(75);
      expect(stats[0].uniqueValues).toBe(50);
    });
  });

  describe('getConfidenceDistribution()', () => {
    it('should return confidence score distribution', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { range_idx: '0', count: '10' },
          { range_idx: '1', count: '20' },
          { range_idx: '2', count: '30' },
          { range_idx: '3', count: '50' },
          { range_idx: '4', count: '90' }
        ]
      });

      const result = await nluAnalytics.getConfidenceDistribution(1, 1);

      expect(result.ranges).toHaveLength(5);
      expect(result.total).toBe(200);
      expect(result.ranges[4].label).toContain('Very High');
      expect(result.ranges[4].count).toBe(90);
    });

    it('should fill missing ranges with zero', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { range_idx: '4', count: '100' }
        ]
      });

      const result = await nluAnalytics.getConfidenceDistribution(1, 1);

      expect(result.ranges[0].count).toBe(0);
      expect(result.ranges[1].count).toBe(0);
      expect(result.ranges[4].count).toBe(100);
    });
  });

  describe('getLowConfidenceMessages()', () => {
    it('should return low confidence messages', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            message: 'What is this?',
            detected_intent: 'question',
            confidence: 0.35,
            timestamp: new Date(),
            entities_extracted: []
          }
        ]
      });

      const messages = await nluAnalytics.getLowConfidenceMessages(1, 1, 50, 0.5);

      expect(messages).toHaveLength(1);
      expect(messages[0].confidence).toBe(0.35);
      expect(messages[0].detectedIntent).toBe('question');
    });
  });

  describe('getUnmatchedMessages()', () => {
    it('should return unmatched messages with suggestions', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [
            { message: 'greetings everyone', timestamp: new Date() }
          ]
        })
        .mockResolvedValueOnce({
          rows: [
            { id: 1, name: 'greeting', display_name: 'Greeting' }
          ]
        });

      const messages = await nluAnalytics.getUnmatchedMessages(1, 1, 50);

      expect(messages).toHaveLength(1);
      expect(messages[0].message).toBe('greetings everyone');
      expect(messages[0].suggestedIntent).toBeDefined();
      expect(messages[0].suggestedIntent.intentId).toBe(1);
    });

    it('should return null suggestion if no matching intent', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [
            { message: 'xyz123', timestamp: new Date() }
          ]
        })
        .mockResolvedValueOnce({
          rows: [
            { id: 1, name: 'greeting', display_name: 'Greeting' }
          ]
        });

      const messages = await nluAnalytics.getUnmatchedMessages(1, 1);

      expect(messages[0].suggestedIntent).toBeNull();
    });
  });

  describe('suggestIntent()', () => {
    it('should suggest intent based on keyword matching', () => {
      const intents = [
        { id: 1, name: 'book_flight', display_name: 'Book Flight' },
        { id: 2, name: 'cancel_booking', display_name: 'Cancel Booking' }
      ];

      const suggestion = nluAnalytics.suggestIntent('I want to book a flight', intents);

      expect(suggestion).not.toBeNull();
      expect(suggestion.intentId).toBe(1);
    });

    it('should return null if no intents', () => {
      const suggestion = nluAnalytics.suggestIntent('Hello', []);

      expect(suggestion).toBeNull();
    });

    it('should ignore short keywords', () => {
      const intents = [
        { id: 1, name: 'to_be', display_name: 'To Be' }
      ];

      const suggestion = nluAnalytics.suggestIntent('I want to go', intents);

      // 'to' is too short (2 chars), 'be' is too short
      expect(suggestion).toBeNull();
    });
  });

  describe('getTrainingGaps()', () => {
    it('should identify training gaps', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { intent_id: 1, name: 'greeting', display_name: 'Greeting', example_count: '0', usage_count: '100' },
          { intent_id: 2, name: 'goodbye', display_name: 'Goodbye', example_count: '2', usage_count: '50' },
          { intent_id: 3, name: 'help', display_name: 'Help', example_count: '4', usage_count: '30' },
          { intent_id: 4, name: 'faq', display_name: 'FAQ', example_count: '8', usage_count: '60' },
          { intent_id: 5, name: 'other', display_name: 'Other', example_count: '15', usage_count: '10' }
        ]
      });

      const gaps = await nluAnalytics.getTrainingGaps(1, 1);

      expect(gaps).toHaveLength(5);
      expect(gaps[0].priority).toBe('critical');
      expect(gaps[0].recommendation).toContain('Critical');
      expect(gaps[1].priority).toBe('high');
      expect(gaps[4].priority).toBe('low');
    });
  });

  describe('getDailyUsage()', () => {
    it('should return daily usage statistics', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            date: '2024-01-15',
            total_queries: '100',
            avg_confidence: '0.8500',
            matched_queries: '85',
            avg_response_time: '45.50'
          },
          {
            date: '2024-01-14',
            total_queries: '120',
            avg_confidence: '0.8200',
            matched_queries: '100',
            avg_response_time: '50.20'
          }
        ]
      });

      const usage = await nluAnalytics.getDailyUsage(1, 1, 30);

      expect(usage).toHaveLength(2);
      expect(usage[0].totalQueries).toBe(100);
      expect(usage[0].matchRate).toBe(85);
      expect(usage[0].avgResponseTime).toBe(45.5);
    });

    it('should handle zero queries', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            date: '2024-01-15',
            total_queries: '0',
            avg_confidence: null,
            matched_queries: '0',
            avg_response_time: null
          }
        ]
      });

      const usage = await nluAnalytics.getDailyUsage(1, 1);

      expect(usage[0].matchRate).toBe(0);
    });
  });

  describe('getSummary()', () => {
    it('should return NLU summary', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          total_queries: '500',
          avg_confidence: '0.8700',
          matched_queries: '450',
          low_confidence_queries: '30',
          unique_intents_used: '15',
          avg_response_time: '42.50'
        }]
      });

      const summary = await nluAnalytics.getSummary(1, 1, 30);

      expect(summary.totalQueries).toBe(500);
      expect(summary.avgConfidence).toBe(0.87);
      expect(summary.matchRate).toBe(90);
      expect(summary.lowConfidenceQueries).toBe(30);
      expect(summary.uniqueIntentsUsed).toBe(15);
      expect(summary.period).toBe('30 days');
    });

    it('should handle empty results', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          total_queries: '0',
          avg_confidence: null,
          matched_queries: '0',
          low_confidence_queries: '0',
          unique_intents_used: '0',
          avg_response_time: null
        }]
      });

      const summary = await nluAnalytics.getSummary(1, 1);

      expect(summary.totalQueries).toBe(0);
      expect(summary.matchRate).toBe(0);
      expect(summary.avgConfidence).toBe(0);
    });
  });
});
