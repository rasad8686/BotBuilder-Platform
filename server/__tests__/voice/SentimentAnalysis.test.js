/**
 * Sentiment Analysis Service Tests
 */

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Mock fetch
global.fetch = jest.fn();

let SentimentAnalysis;

describe('SentimentAnalysis', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    global.fetch.mockReset();
    SentimentAnalysis = require('../../services/voice/SentimentAnalysis');
  });

  describe('analyzeSentiment', () => {
    it('should analyze positive sentiment locally', async () => {
      const result = await SentimentAnalysis.analyzeSentiment(
        'Thank you so much! This is excellent service!',
        { provider: 'local' }
      );

      expect(result.sentiment).toBe('positive');
      expect(result.score).toBeGreaterThan(0);
      expect(result.provider).toBe('local');
    });

    it('should analyze negative sentiment locally', async () => {
      const result = await SentimentAnalysis.analyzeSentiment(
        'This is terrible! I am so frustrated and angry!',
        { provider: 'local' }
      );

      expect(result.sentiment).toBe('negative');
      expect(result.score).toBeLessThan(0);
    });

    it('should analyze neutral sentiment', async () => {
      const result = await SentimentAnalysis.analyzeSentiment(
        'I understand. That makes sense.',
        { provider: 'local' }
      );

      expect(['neutral', 'positive', 'negative']).toContain(result.sentiment);
    });

    it('should return neutral for empty text', async () => {
      const result = await SentimentAnalysis.analyzeSentiment('');

      expect(result.sentiment).toBe('neutral');
      expect(result.error).toBeDefined();
    });

    it('should include emotions when requested', async () => {
      const result = await SentimentAnalysis.analyzeSentiment(
        'I am so happy and excited about this!',
        { provider: 'local', includeEmotions: true }
      );

      expect(result.emotions).toBeDefined();
      expect(result.emotions.joy).toBeDefined();
    });

    it('should include key phrases when detailed', async () => {
      const result = await SentimentAnalysis.analyzeSentiment(
        'Great service! Thank you!',
        { provider: 'local', detailed: true }
      );

      expect(result.key_phrases).toBeDefined();
      expect(Array.isArray(result.key_phrases)).toBe(true);
    });
  });

  describe('analyzeWithOpenAI', () => {
    it('should call OpenAI API', async () => {
      process.env.OPENAI_API_KEY = 'test-key';

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: JSON.stringify({
                sentiment: 'positive',
                score: 0.8,
                confidence: 0.9,
                summary: 'Positive feedback'
              })
            }
          }]
        })
      });

      const result = await SentimentAnalysis.analyzeSentiment(
        'Great service!',
        { provider: 'openai' }
      );

      expect(result.sentiment).toBe('positive');
      expect(result.provider).toBe('openai');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.any(Object)
      );
    });

    it('should fallback to local on API error', async () => {
      process.env.OPENAI_API_KEY = 'test-key';

      global.fetch.mockResolvedValue({
        ok: false,
        status: 500
      });

      const result = await SentimentAnalysis.analyzeSentiment(
        'Great service!',
        { provider: 'openai' }
      );

      // Should fallback to local
      expect(result.provider).toBe('local');
    });
  });

  describe('detectEmotions', () => {
    it('should detect anger', () => {
      const emotions = SentimentAnalysis.detectEmotions(
        'i am so angry and frustrated about this'
      );

      expect(emotions.anger).toBeDefined();
      expect(emotions.anger).toBeGreaterThan(0);
    });

    it('should detect joy', () => {
      const emotions = SentimentAnalysis.detectEmotions(
        'i am so happy and excited and delighted'
      );

      expect(emotions.joy).toBeDefined();
      expect(emotions.joy).toBeGreaterThan(0);
    });

    it('should detect multiple emotions', () => {
      const emotions = SentimentAnalysis.detectEmotions(
        'i am surprised but also worried about this situation'
      );

      expect(Object.keys(emotions).length).toBeGreaterThan(1);
    });
  });

  describe('analyzeCallSentiment', () => {
    it('should analyze sentiment timeline', async () => {
      const segments = [
        { start: 0, end: 5, text: 'Hello, how can I help you?' },
        { start: 5, end: 10, text: 'I am frustrated with your service!' },
        { start: 10, end: 15, text: 'Let me help fix that for you.' },
        { start: 15, end: 20, text: 'Thank you so much, that is great!' }
      ];

      const result = await SentimentAnalysis.analyzeCallSentiment(segments, {
        provider: 'local'
      });

      expect(result.overall).toBeDefined();
      expect(result.timeline).toHaveLength(4);
      expect(result.trends).toBeDefined();
    });

    it('should identify improving trends', async () => {
      const segments = [
        { start: 0, end: 5, text: 'This is terrible service!' },
        { start: 5, end: 10, text: 'I am so frustrated!' },
        { start: 10, end: 15, text: 'Okay, that helps a bit.' },
        { start: 15, end: 20, text: 'Thank you so much! Great help!' }
      ];

      const result = await SentimentAnalysis.analyzeCallSentiment(segments, {
        provider: 'local'
      });

      expect(result.trends.direction).toBe('improving');
    });

    it('should identify critical moments', async () => {
      const segments = [
        { start: 0, end: 5, text: 'Hello' },
        { start: 5, end: 10, text: 'This is the worst experience ever! Terrible!' },
        { start: 10, end: 15, text: 'Goodbye' }
      ];

      const result = await SentimentAnalysis.analyzeCallSentiment(segments, {
        provider: 'local'
      });

      expect(result.criticalMoments.length).toBeGreaterThan(0);
    });

    it('should handle empty segments', async () => {
      const result = await SentimentAnalysis.analyzeCallSentiment([]);

      expect(result.overall.sentiment).toBe('neutral');
      expect(result.timeline).toHaveLength(0);
    });
  });

  describe('identifyTrends', () => {
    it('should identify stable trend', () => {
      const timeline = [
        { score: 0.5 },
        { score: 0.4 },
        { score: 0.5 },
        { score: 0.4 }
      ];

      const trend = SentimentAnalysis.identifyTrends(timeline);

      expect(trend.direction).toBe('stable');
    });

    it('should identify improving trend', () => {
      const timeline = [
        { score: -0.5 },
        { score: -0.3 },
        { score: 0.3 },
        { score: 0.7 }
      ];

      const trend = SentimentAnalysis.identifyTrends(timeline);

      expect(trend.direction).toBe('improving');
    });

    it('should identify declining trend', () => {
      const timeline = [
        { score: 0.7 },
        { score: 0.3 },
        { score: -0.3 },
        { score: -0.5 }
      ];

      const trend = SentimentAnalysis.identifyTrends(timeline);

      expect(trend.direction).toBe('declining');
    });
  });

  describe('analyzeCustomerSatisfaction', () => {
    it('should predict CSAT score', async () => {
      const callData = {
        transcription: {
          segments: [
            { text: 'Thank you so much for your help!' }
          ]
        },
        duration: 180,
        wasTransferred: false,
        waitTime: 30,
        resolution: 'resolved'
      };

      const result = await SentimentAnalysis.analyzeCustomerSatisfaction(callData);

      expect(result.csatPrediction).toBeDefined();
      expect(result.csatPrediction).toBeGreaterThanOrEqual(0);
      expect(result.csatPrediction).toBeLessThanOrEqual(100);
      expect(result.indicators).toBeDefined();
    });

    it('should generate recommendations for negative calls', async () => {
      const callData = {
        transcription: {
          segments: [
            { text: 'This is terrible! I am so angry!' },
            { text: 'Worst service ever!' }
          ]
        },
        duration: 600,
        wasTransferred: true,
        waitTime: 300,
        resolution: 'unresolved'
      };

      const result = await SentimentAnalysis.analyzeCustomerSatisfaction(callData);

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations[0].priority).toBeDefined();
    });
  });

  describe('calculateEfficiency', () => {
    it('should give high score for efficient calls', () => {
      const score = SentimentAnalysis.calculateEfficiency(120, false, 30);

      expect(score).toBeGreaterThan(0.8);
    });

    it('should penalize long calls', () => {
      const score = SentimentAnalysis.calculateEfficiency(1200, false, 30);

      expect(score).toBeLessThan(0.8);
    });

    it('should penalize transfers', () => {
      const score = SentimentAnalysis.calculateEfficiency(180, true, 30);

      expect(score).toBeLessThan(1);
    });

    it('should penalize long wait times', () => {
      const score = SentimentAnalysis.calculateEfficiency(180, false, 300);

      expect(score).toBeLessThan(1);
    });
  });

  describe('batchAnalyze', () => {
    it('should analyze multiple texts', async () => {
      const texts = [
        'Great service!',
        'Terrible experience!',
        'It was okay.'
      ];

      const result = await SentimentAnalysis.batchAnalyze(texts, {
        provider: 'local'
      });

      expect(result.results).toHaveLength(3);
      expect(result.summary).toBeDefined();
      expect(result.summary.total).toBe(3);
    });

    it('should summarize batch results', async () => {
      const texts = [
        'Thank you! Great!',
        'Excellent service!',
        'Terrible!'
      ];

      const result = await SentimentAnalysis.batchAnalyze(texts, {
        provider: 'local'
      });

      expect(result.summary.distribution.positive).toBe(2);
      expect(result.summary.distribution.negative).toBe(1);
    });
  });

  describe('generateRecommendations', () => {
    it('should recommend follow-up for negative sentiment', () => {
      const indicators = { sentimentScore: -0.5, resolutionSuccess: 0.5 };
      const sentimentResult = { criticalMoments: [] };

      const recommendations = SentimentAnalysis.generateRecommendations(
        indicators,
        sentimentResult
      );

      expect(recommendations.some(r => r.category === 'customer_experience')).toBe(true);
    });

    it('should recommend training for multiple critical moments', () => {
      const indicators = { sentimentScore: 0, resolutionSuccess: 1 };
      const sentimentResult = {
        criticalMoments: [1, 2, 3],
        trends: { direction: 'stable' }
      };

      const recommendations = SentimentAnalysis.generateRecommendations(
        indicators,
        sentimentResult
      );

      expect(recommendations.some(r => r.category === 'training')).toBe(true);
    });
  });
});
