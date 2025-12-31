/**
 * Sentiment Analysis Service Tests
 * Tests for call sentiment and emotion analysis
 */

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// Mock node-fetch for API calls
jest.mock('node-fetch', () => jest.fn(), { virtual: true });

const sentimentAnalysis = require('../../services/voice/SentimentAnalysis');

describe('SentimentAnalysis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should have providers defined', () => {
      expect(sentimentAnalysis.providers).toContain('openai');
      expect(sentimentAnalysis.providers).toContain('azure');
      expect(sentimentAnalysis.providers).toContain('aws');
      expect(sentimentAnalysis.providers).toContain('local');
    });

    it('should have sentiment keywords', () => {
      expect(sentimentAnalysis.sentimentKeywords.positive).toContain('thank');
      expect(sentimentAnalysis.sentimentKeywords.negative).toContain('angry');
      expect(sentimentAnalysis.sentimentKeywords.neutral).toContain('okay');
    });

    it('should have emotion patterns', () => {
      expect(sentimentAnalysis.emotionPatterns.anger).toBeDefined();
      expect(sentimentAnalysis.emotionPatterns.joy).toBeDefined();
      expect(sentimentAnalysis.emotionPatterns.sadness).toBeDefined();
    });
  });

  describe('analyzeSentiment', () => {
    it('should return neutral for empty text', async () => {
      const result = await sentimentAnalysis.analyzeSentiment('');

      expect(result.sentiment).toBe('neutral');
      expect(result.score).toBe(0);
      expect(result.error).toBe('Empty text provided');
    });

    it('should return neutral for whitespace only', async () => {
      const result = await sentimentAnalysis.analyzeSentiment('   ');

      expect(result.sentiment).toBe('neutral');
    });

    it('should analyze positive text locally', async () => {
      const result = await sentimentAnalysis.analyzeSentiment(
        'Thank you so much! You are great and helpful!',
        { provider: 'local' }
      );

      expect(result.sentiment).toBe('positive');
      expect(result.score).toBeGreaterThan(0);
      expect(result.provider).toBe('local');
    });

    it('should analyze negative text locally', async () => {
      const result = await sentimentAnalysis.analyzeSentiment(
        'I am angry and frustrated. This is terrible!',
        { provider: 'local' }
      );

      expect(result.sentiment).toBe('negative');
      expect(result.score).toBeLessThan(0);
    });

    it('should include detailed analysis when requested', async () => {
      const result = await sentimentAnalysis.analyzeSentiment(
        'Thank you for your help!',
        { provider: 'local', detailed: true }
      );

      expect(result.key_phrases).toBeDefined();
      expect(result.wordCount).toBeDefined();
    });

    it('should include emotions when requested', async () => {
      const result = await sentimentAnalysis.analyzeSentiment(
        'I am so happy and excited about this!',
        { provider: 'local', includeEmotions: true }
      );

      expect(result.emotions).toBeDefined();
      expect(result.emotions.joy).toBeGreaterThan(0);
    });
  });

  describe('analyzeLocal', () => {
    it('should detect positive sentiment', () => {
      const result = sentimentAnalysis.analyzeLocal(
        'Great work! This is excellent and I love it!',
        { detailed: false, includeEmotions: false }
      );

      expect(result.sentiment).toBe('positive');
      expect(result.provider).toBe('local');
    });

    it('should detect negative sentiment', () => {
      const result = sentimentAnalysis.analyzeLocal(
        'This is terrible and I hate it. Very poor service.',
        { detailed: false, includeEmotions: false }
      );

      expect(result.sentiment).toBe('negative');
    });

    it('should detect neutral sentiment', () => {
      const result = sentimentAnalysis.analyzeLocal(
        'The package arrived today.',
        { detailed: false, includeEmotions: false }
      );

      expect(result.sentiment).toBe('neutral');
    });

    it('should return matched phrases when detailed', () => {
      const result = sentimentAnalysis.analyzeLocal(
        'Thank you, this is great!',
        { detailed: true, includeEmotions: false }
      );

      expect(result.key_phrases).toBeDefined();
      expect(result.key_phrases.length).toBeGreaterThan(0);
    });
  });

  describe('detectEmotions', () => {
    it('should detect anger', () => {
      const emotions = sentimentAnalysis.detectEmotions('I am angry and furious about this!');

      expect(emotions.anger).toBeGreaterThan(0);
    });

    it('should detect joy', () => {
      const emotions = sentimentAnalysis.detectEmotions('I am happy and delighted!');

      expect(emotions.joy).toBeGreaterThan(0);
    });

    it('should detect sadness', () => {
      const emotions = sentimentAnalysis.detectEmotions('This makes me sad and disappointed.');

      expect(emotions.sadness).toBeGreaterThan(0);
    });

    it('should detect surprise', () => {
      const emotions = sentimentAnalysis.detectEmotions('Wow! I am so surprised and amazed!');

      expect(emotions.surprise).toBeGreaterThan(0);
    });

    it('should return empty object for neutral text', () => {
      const emotions = sentimentAnalysis.detectEmotions('The package was delivered.');

      expect(Object.keys(emotions).length).toBe(0);
    });
  });

  describe('analyzeCallSentiment', () => {
    it('should handle empty segments', async () => {
      const result = await sentimentAnalysis.analyzeCallSentiment([]);

      expect(result.overall.sentiment).toBe('neutral');
      expect(result.timeline).toEqual([]);
      expect(result.summary).toBe('No segments to analyze');
    });

    it('should analyze call segments', async () => {
      const segments = [
        { text: 'Hello, how can I help?', start: 0, end: 2, speaker: 'agent' },
        { text: 'I have a problem with my order.', start: 2, end: 5, speaker: 'customer' },
        { text: 'I understand, let me help you.', start: 5, end: 8, speaker: 'agent' },
        { text: 'Thank you so much!', start: 8, end: 10, speaker: 'customer' }
      ];

      const result = await sentimentAnalysis.analyzeCallSentiment(segments, { provider: 'local' });

      expect(result.overall).toBeDefined();
      expect(result.timeline.length).toBe(4);
      expect(result.trends).toBeDefined();
    });

    it('should identify critical moments', async () => {
      const segments = [
        { text: 'This is terrible! I am so angry!', start: 0, end: 3 }
      ];

      const result = await sentimentAnalysis.analyzeCallSentiment(segments, { provider: 'local' });

      // The result may or may not have critical moments based on score
      expect(result.criticalMoments).toBeDefined();
    });

    it('should identify positive highlights', async () => {
      const segments = [
        { text: 'Thank you so much! This is excellent!', start: 0, end: 3 }
      ];

      const result = await sentimentAnalysis.analyzeCallSentiment(segments, { provider: 'local' });

      expect(result.highlights).toBeDefined();
    });
  });

  describe('identifyTrends', () => {
    it('should return stable for single segment', () => {
      const timeline = [{ score: 0.5 }];

      const trends = sentimentAnalysis.identifyTrends(timeline);

      expect(trends.direction).toBe('stable');
    });

    it('should detect improving trend', () => {
      const timeline = [
        { score: -0.5 },
        { score: -0.3 },
        { score: 0.2 },
        { score: 0.6 }
      ];

      const trends = sentimentAnalysis.identifyTrends(timeline);

      expect(trends.direction).toBe('improving');
    });

    it('should detect declining trend', () => {
      const timeline = [
        { score: 0.6 },
        { score: 0.3 },
        { score: -0.2 },
        { score: -0.5 }
      ];

      const trends = sentimentAnalysis.identifyTrends(timeline);

      expect(trends.direction).toBe('declining');
    });

    it('should detect stable trend', () => {
      const timeline = [
        { score: 0.1 },
        { score: 0.15 },
        { score: 0.05 },
        { score: 0.1 }
      ];

      const trends = sentimentAnalysis.identifyTrends(timeline);

      expect(trends.direction).toBe('stable');
    });
  });

  describe('generateSummary', () => {
    it('should generate summary for positive sentiment', () => {
      const summary = sentimentAnalysis.generateSummary(
        'positive',
        { direction: 'stable' },
        [],
        [{ score: 0.8 }]
      );

      expect(summary).toContain('positive');
    });

    it('should include improving trend in summary', () => {
      const summary = sentimentAnalysis.generateSummary(
        'neutral',
        { direction: 'improving' },
        [],
        []
      );

      expect(summary).toContain('improved');
    });

    it('should mention critical moments', () => {
      const summary = sentimentAnalysis.generateSummary(
        'negative',
        { direction: 'stable' },
        [{ score: -0.8 }, { score: -0.7 }],
        []
      );

      expect(summary).toContain('critical moment');
    });
  });

  describe('analyzeCustomerSatisfaction', () => {
    it('should analyze empty call data', async () => {
      const result = await sentimentAnalysis.analyzeCustomerSatisfaction({
        transcription: { segments: [] }
      });

      expect(result.indicators).toBeDefined();
      expect(result.csatPrediction).toBeDefined();
    });

    it('should include all indicators', async () => {
      const result = await sentimentAnalysis.analyzeCustomerSatisfaction({
        transcription: { segments: [{ text: 'Hello' }] },
        duration: 300,
        wasTransferred: false,
        waitTime: 30,
        resolution: 'resolved'
      });

      expect(result.indicators.sentimentScore).toBeDefined();
      expect(result.indicators.emotionalTone).toBeDefined();
      expect(result.indicators.callEfficiency).toBeDefined();
      expect(result.indicators.resolutionSuccess).toBe(1);
    });
  });

  describe('calculateEmotionalTone', () => {
    it('should return 0.5 for empty timeline', () => {
      const tone = sentimentAnalysis.calculateEmotionalTone([]);
      expect(tone).toBe(0.5);
    });

    it('should calculate positive tone', () => {
      const timeline = [
        { emotions: { joy: 0.8 } },
        { emotions: { joy: 0.6 } }
      ];

      const tone = sentimentAnalysis.calculateEmotionalTone(timeline);
      expect(tone).toBeGreaterThan(0.5);
    });

    it('should calculate negative tone', () => {
      const timeline = [
        { emotions: { anger: 0.8 } },
        { emotions: { sadness: 0.6 } }
      ];

      const tone = sentimentAnalysis.calculateEmotionalTone(timeline);
      expect(tone).toBeLessThan(0.5);
    });
  });

  describe('calculateEfficiency', () => {
    it('should return 1 for short call without issues', () => {
      const efficiency = sentimentAnalysis.calculateEfficiency(180, false, 30);
      expect(efficiency).toBe(1);
    });

    it('should penalize long calls', () => {
      const efficiency = sentimentAnalysis.calculateEfficiency(900, false, 30);
      expect(efficiency).toBeLessThan(1);
    });

    it('should penalize transfers', () => {
      const efficiency = sentimentAnalysis.calculateEfficiency(180, true, 30);
      expect(efficiency).toBe(0.8);
    });

    it('should penalize long wait times', () => {
      const efficiency = sentimentAnalysis.calculateEfficiency(180, false, 300);
      expect(efficiency).toBeLessThan(1);
    });
  });

  describe('predictCSAT', () => {
    it('should predict high CSAT for positive indicators', () => {
      const csat = sentimentAnalysis.predictCSAT({
        sentimentScore: 0.8,
        emotionalTone: 0.9,
        callEfficiency: 1,
        resolutionSuccess: 1
      });

      expect(csat).toBeGreaterThan(80);
    });

    it('should predict low CSAT for negative indicators', () => {
      const csat = sentimentAnalysis.predictCSAT({
        sentimentScore: -0.8,
        emotionalTone: 0.1,
        callEfficiency: 0.3,
        resolutionSuccess: 0
      });

      expect(csat).toBeLessThan(30);
    });
  });

  describe('generateRecommendations', () => {
    it('should recommend follow-up for negative sentiment', () => {
      const recommendations = sentimentAnalysis.generateRecommendations(
        { sentimentScore: -0.5, callEfficiency: 0.8, resolutionSuccess: 1 },
        { criticalMoments: [], trends: { direction: 'stable' } }
      );

      const followUp = recommendations.find(r => r.category === 'customer_experience');
      expect(followUp).toBeDefined();
    });

    it('should recommend training for multiple critical moments', () => {
      const recommendations = sentimentAnalysis.generateRecommendations(
        { sentimentScore: 0, callEfficiency: 0.8, resolutionSuccess: 1 },
        { criticalMoments: [{}, {}, {}], trends: { direction: 'stable' } }
      );

      const training = recommendations.find(r => r.category === 'training');
      expect(training).toBeDefined();
    });

    it('should recommend process review for declining trend', () => {
      const recommendations = sentimentAnalysis.generateRecommendations(
        { sentimentScore: 0, callEfficiency: 0.8, resolutionSuccess: 1 },
        { criticalMoments: [], trends: { direction: 'declining' } }
      );

      const process = recommendations.find(r => r.category === 'process');
      expect(process).toBeDefined();
    });
  });

  describe('batchAnalyze', () => {
    it('should analyze multiple texts', async () => {
      const texts = [
        'Thank you so much!',
        'This is terrible!',
        'The weather is nice.'
      ];

      const result = await sentimentAnalysis.batchAnalyze(texts, { provider: 'local' });

      expect(result.results.length).toBe(3);
      expect(result.summary).toBeDefined();
      expect(result.summary.total).toBe(3);
    });
  });

  describe('summarizeBatch', () => {
    it('should summarize batch results', () => {
      const results = [
        { sentiment: 'positive', score: 0.5 },
        { sentiment: 'negative', score: -0.5 },
        { sentiment: 'neutral', score: 0 }
      ];

      const summary = sentimentAnalysis.summarizeBatch(results);

      expect(summary.total).toBe(3);
      expect(summary.distribution.positive).toBe(1);
      expect(summary.distribution.negative).toBe(1);
      expect(summary.distribution.neutral).toBe(1);
      expect(summary.averageScore).toBe(0);
    });
  });
});
