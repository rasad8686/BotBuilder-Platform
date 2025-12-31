/**
 * StyleCloneEngine Tests
 * Tests for writing style analysis, pattern recognition, and style replication
 */

jest.mock('node-fetch', () => jest.fn(), { virtual: true });

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const StyleCloneEngine = require('../../../services/clone/StyleCloneEngine');

describe('StyleCloneEngine', () => {
  let engine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new StyleCloneEngine();
  });

  describe('constructor', () => {
    it('should initialize with default settings', () => {
      expect(engine.minSamplesRequired).toBe(5);
      expect(engine.minWordsPerSample).toBe(50);
      expect(engine.maxSamplesAllowed).toBe(100);
    });

    it('should accept custom config', () => {
      const customEngine = new StyleCloneEngine({
        openaiApiKey: 'test-key'
      });
      expect(customEngine.openaiApiKey).toBe('test-key');
    });
  });

  describe('initializeClone', () => {
    it('should initialize clone job', async () => {
      const result = await engine.initializeClone('job-123');

      expect(result.success).toBe(true);
      expect(result.jobId).toBe('job-123');
      expect(result.status).toBe('initialized');
      expect(result.requirements.minSamples).toBe(5);
    });
  });

  describe('processTextSample', () => {
    it('should process valid text sample', async () => {
      const content = 'This is a sample text that contains enough words to be processed properly. It has multiple sentences and demonstrates writing style patterns that can be analyzed.';

      const result = await engine.processTextSample('sample-1', content);

      expect(result.success).toBe(true);
      expect(result.sampleId).toBe('sample-1');
      expect(result.analysis).toBeDefined();
      expect(result.styleMarkers).toBeDefined();
      expect(result.qualityScore).toBeGreaterThan(0);
    });

    it('should reject empty content', async () => {
      const result = await engine.processTextSample('sample-1', '');

      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject short content', async () => {
      const result = await engine.processTextSample('sample-1', 'Too short.');

      expect(result.success).toBe(false);
      expect(result.error).toContain('short');
    });
  });

  describe('Text Analysis', () => {
    describe('analyzeText', () => {
      it('should analyze text comprehensively', async () => {
        const text = 'Hello there. This is a test text. It has multiple sentences. We can analyze it!';

        const analysis = await engine.analyzeText(text);

        expect(analysis.metrics).toBeDefined();
        expect(analysis.formality).toBeDefined();
        expect(analysis.tone).toBeDefined();
        expect(analysis.vocabulary).toBeDefined();
        expect(analysis.punctuation).toBeDefined();
        expect(analysis.emoji).toBeDefined();
        expect(analysis.structure).toBeDefined();
      });
    });

    describe('splitIntoSentences', () => {
      it('should split text into sentences', () => {
        const text = 'First sentence. Second sentence! Third sentence?';
        const sentences = engine.splitIntoSentences(text);

        expect(sentences.length).toBe(3);
      });
    });

    describe('analyzeFormality', () => {
      it('should detect formal text', () => {
        const formalText = 'Therefore, I must conclude that furthermore this is indeed the case. Consequently, we shall proceed.';
        const words = formalText.split(/\s+/);
        const result = engine.analyzeFormality(formalText, words);

        expect(result.level).toBe('formal');
        expect(result.formalWordsFound).toBeGreaterThan(0);
      });

      it('should detect informal text', () => {
        const informalText = "Hey, gonna wanna tell you something cool. Yeah, it's kinda awesome!";
        const words = informalText.split(/\s+/);
        const result = engine.analyzeFormality(informalText, words);

        expect(result.level).toBe('informal');
        expect(result.informalWordsFound).toBeGreaterThan(0);
      });

      it('should detect contractions', () => {
        const textWithContractions = "I've been here. We're going. That's great. Don't worry.";
        const words = textWithContractions.split(/\s+/);
        const result = engine.analyzeFormality(textWithContractions, words);

        expect(result.contractionRatio).toBeGreaterThan(0);
      });
    });

    describe('analyzeTone', () => {
      it('should detect professional tone', () => {
        const text = 'Thank you for the opportunity. I appreciate your time and regards.';
        const result = engine.analyzeTone(text);

        expect(result.scores.professional).toBeGreaterThan(0);
      });

      it('should detect friendly tone', () => {
        const text = 'This is great! I love it! Awesome work, fantastic results!';
        const result = engine.analyzeTone(text);

        expect(result.scores.friendly).toBeGreaterThan(0);
      });

      it('should identify dominant tone', () => {
        const text = 'Hey yeah cool nice okay sure!';
        const result = engine.analyzeTone(text);

        expect(result.dominant).toBe('casual');
      });
    });

    describe('analyzeVocabulary', () => {
      it('should analyze vocabulary complexity', () => {
        const words = ['the', 'quick', 'brown', 'fox', 'jumped', 'over', 'lazy', 'dog'];
        const result = engine.analyzeVocabulary(words);

        expect(result.complexity).toBeDefined();
        expect(result.lexicalDiversity).toBeGreaterThan(0);
        expect(result.uniqueWordCount).toBe(8);
      });

      it('should detect complex vocabulary', () => {
        const words = ['implementation', 'consequently', 'nevertheless', 'sophisticated', 'philosophical', 'extraordinary'];
        const result = engine.analyzeVocabulary(words);

        expect(result.complexity).toBe('complex');
        expect(result.longWordRatio).toBeGreaterThan(0);
      });

      it('should detect simple vocabulary', () => {
        const words = ['the', 'a', 'is', 'it', 'to', 'be', 'or', 'not'];
        const result = engine.analyzeVocabulary(words);

        expect(result.complexity).toBe('simple');
      });
    });

    describe('analyzePunctuation', () => {
      it('should analyze punctuation usage', () => {
        const text = 'Hello! How are you? Great... Well—done, indeed; yes.';
        const result = engine.analyzePunctuation(text);

        expect(result.exclamationRate).toBeGreaterThan(0);
        expect(result.questionRate).toBeGreaterThan(0);
        expect(result.ellipsisCount).toBe(1);
        expect(result.dashCount).toBeGreaterThan(0);
      });

      it('should detect expressive style', () => {
        const text = 'Wow! Amazing! Incredible! Fantastic!';
        const result = engine.analyzePunctuation(text);

        expect(result.style).toBe('expressive');
      });

      it('should detect inquisitive style', () => {
        const text = 'Why? How? When? Where?';
        const result = engine.analyzePunctuation(text);

        expect(result.style).toBe('inquisitive');
      });
    });

    describe('analyzeEmoji', () => {
      it('should detect emojis', () => {
        const text = 'Hello! Great job! Keep it up!';
        const result = engine.analyzeEmoji(text);

        expect(result.frequency).toBe('never');
      });

      it('should handle text without emojis', () => {
        const text = 'Plain text without emojis.';
        const result = engine.analyzeEmoji(text);

        expect(result.count).toBe(0);
        expect(result.frequency).toBe('never');
      });
    });

    describe('analyzeSentenceStructure', () => {
      it('should analyze sentence structure', () => {
        const sentences = [
          'I am testing this.',
          'This is a sentence.',
          'What is happening here?',
          'I think this works.'
        ];

        const result = engine.analyzeSentenceStructure(sentences);

        expect(result.sentenceLengths).toBeDefined();
        expect(result.firstPersonRatio).toBeGreaterThan(0);
        expect(result.questionStartRatio).toBeGreaterThan(0);
        expect(result.consistency).toBeDefined();
      });
    });
  });

  describe('calculateVariance', () => {
    it('should calculate variance', () => {
      const arr = [2, 4, 6, 8, 10];
      const variance = engine.calculateVariance(arr);

      expect(variance).toBe(8); // Variance of this array
    });

    it('should return 0 for empty array', () => {
      const variance = engine.calculateVariance([]);
      expect(variance).toBe(0);
    });
  });

  describe('Style Marker Extraction', () => {
    describe('extractStyleMarkers', () => {
      it('should extract style markers', () => {
        const text = 'Hello there. However, we must consider. Therefore, we proceed. Thank you.';
        const analysis = { formality: { contractionRatio: 0 }, emoji: { count: 0 }, punctuation: { exclamationRate: 0 }, metrics: { avgSentenceLength: 5 }, tone: { dominant: 'professional' } };

        const markers = engine.extractStyleMarkers(text, analysis);

        expect(markers.openingPhrases).toBeDefined();
        expect(markers.closingPhrases).toBeDefined();
        expect(markers.transitionPhrases).toBeDefined();
        expect(markers.commonPhrases).toBeDefined();
        expect(markers.signaturePatterns).toBeDefined();
      });
    });

    describe('extractOpeningPhrases', () => {
      it('should extract opening phrases', () => {
        const text = 'First sentence here. Second one follows. Third comes after.';
        const openings = engine.extractOpeningPhrases(text);

        expect(openings.length).toBeGreaterThan(0);
      });
    });

    describe('extractClosingPhrases', () => {
      it('should extract closing phrases', () => {
        const text = 'First sentence here. Second one follows. End of story.';
        const closings = engine.extractClosingPhrases(text);

        expect(closings.length).toBeGreaterThan(0);
      });
    });

    describe('extractTransitionPhrases', () => {
      it('should extract transition phrases', () => {
        const text = 'First point. However, consider this. Furthermore, we see. In addition, there is more.';
        const transitions = engine.extractTransitionPhrases(text);

        expect(transitions).toContain('however');
        expect(transitions).toContain('furthermore');
        expect(transitions).toContain('in addition');
      });
    });

    describe('extractCommonPhrases', () => {
      it('should extract common phrases', () => {
        const text = 'in the end in the end in the end. at the same time at the same time.';
        const common = engine.extractCommonPhrases(text);

        expect(common.length).toBeGreaterThan(0);
      });
    });
  });

  describe('calculateQualityScore', () => {
    it('should give high score for quality content', () => {
      const analysis = {
        metrics: { totalWords: 300, totalParagraphs: 3 },
        vocabulary: { lexicalDiversity: 0.6 }
      };

      const score = engine.calculateQualityScore('', analysis);

      expect(score).toBeGreaterThan(80);
    });

    it('should penalize short content', () => {
      const analysis = {
        metrics: { totalWords: 50, totalParagraphs: 1 },
        vocabulary: { lexicalDiversity: 0.3 }
      };

      const score = engine.calculateQualityScore('', analysis);

      expect(score).toBeLessThan(70);
    });
  });

  describe('trainStyleClone', () => {
    it('should reject training with too few samples', async () => {
      const samples = [{ wordCount: 100 }];

      const result = await engine.trainStyleClone('job-1', samples);

      expect(result.success).toBe(false);
      expect(result.error).toContain('samples required');
    });

    it('should train with sufficient samples', async () => {
      const samples = [];
      for (let i = 0; i < 5; i++) {
        samples.push({
          wordCount: 100,
          qualityScore: 80,
          analysis: {
            metrics: { avgSentenceLength: 15, avgWordLength: 5, avgParagraphLength: 5 },
            formality: { level: 'neutral', score: 50 },
            tone: { dominant: 'professional' },
            vocabulary: { complexity: 'medium', lexicalDiversity: 0.5 },
            punctuation: { exclamationRate: 0.1, questionRate: 0.1 },
            emoji: { frequency: 'never' }
          },
          styleMarkers: {
            openingPhrases: ['Hello'],
            closingPhrases: ['Goodbye'],
            transitionPhrases: ['however'],
            commonPhrases: ['the end']
          }
        });
      }

      const result = await engine.trainStyleClone('job-1', samples);

      expect(result.success).toBe(true);
      expect(result.styleProfile).toBeDefined();
      expect(result.stylePrompt).toBeDefined();
      expect(result.metrics.samplesUsed).toBe(5);
    });
  });

  describe('aggregateStyleAnalysis', () => {
    it('should aggregate analyses', async () => {
      const samples = [
        {
          analysis: {
            metrics: { avgSentenceLength: 10 },
            formality: { level: 'formal', score: 80 },
            tone: { dominant: 'professional' },
            vocabulary: { complexity: 'complex', lexicalDiversity: 0.6 },
            punctuation: { exclamationRate: 0.1, questionRate: 0.2 },
            emoji: { frequency: 'never' }
          },
          styleMarkers: { openingPhrases: ['Hi'] }
        },
        {
          analysis: {
            metrics: { avgSentenceLength: 12 },
            formality: { level: 'formal', score: 75 },
            tone: { dominant: 'professional' },
            vocabulary: { complexity: 'medium', lexicalDiversity: 0.5 },
            punctuation: { exclamationRate: 0.05, questionRate: 0.1 },
            emoji: { frequency: 'occasional' }
          },
          styleMarkers: { openingPhrases: ['Hello'] }
        }
      ];

      const result = await engine.aggregateStyleAnalysis(samples);

      expect(result.metrics.avgSentenceLength).toBe(11);
      expect(result.formality.level).toBe('formal');
      expect(result.tone.dominant).toBe('professional');
    });

    it('should return null for empty samples', async () => {
      const result = await engine.aggregateStyleAnalysis([]);

      expect(result).toBeNull();
    });
  });

  describe('averageProperty', () => {
    it('should average nested property', () => {
      const arr = [
        { metrics: { value: 10 } },
        { metrics: { value: 20 } },
        { metrics: { value: 30 } }
      ];

      const result = engine.averageProperty(arr, 'metrics.value');

      expect(result).toBe(20);
    });

    it('should handle missing values', () => {
      const arr = [
        { metrics: { value: 10 } },
        { other: {} },
        { metrics: { value: 20 } }
      ];

      const result = engine.averageProperty(arr, 'metrics.value');

      expect(result).toBe(15);
    });
  });

  describe('getMostCommon', () => {
    it('should return most common value', () => {
      const arr = ['a', 'b', 'a', 'c', 'a'];
      const result = engine.getMostCommon(arr);

      expect(result).toBe('a');
    });

    it('should return neutral for empty array', () => {
      const result = engine.getMostCommon([]);

      expect(result).toBe('neutral');
    });
  });

  describe('getMostFrequent', () => {
    it('should return most frequent items', () => {
      const arr = ['a', 'b', 'a', 'c', 'a', 'b'];
      const result = engine.getMostFrequent(arr, 2);

      expect(result[0]).toBe('a');
      expect(result[1]).toBe('b');
    });
  });

  describe('generateStyleProfile', () => {
    it('should generate profile from analysis', () => {
      const analysis = {
        metrics: { avgSentenceLength: 12, avgWordLength: 5 },
        formality: { level: 'formal', avgScore: 75 },
        tone: { dominant: 'professional' },
        vocabulary: { complexity: 'medium', avgLexicalDiversity: 0.5 },
        punctuation: { avgExclamationRate: 0.1, avgQuestionRate: 0.05 },
        emoji: { frequency: 'never' },
        markers: {
          openingPhrases: ['Hello'],
          closingPhrases: ['Goodbye'],
          transitionPhrases: ['however'],
          commonPhrases: ['in fact']
        }
      };

      const profile = engine.generateStyleProfile(analysis);

      expect(profile.formality.level).toBe('formal');
      expect(profile.tone).toBe('professional');
      expect(profile.vocabulary.complexity).toBe('medium');
    });

    it('should handle null analysis', () => {
      const profile = engine.generateStyleProfile(null);

      expect(profile.error).toBe('No analysis data');
    });
  });

  describe('generateStylePrompt', () => {
    it('should generate style prompt', () => {
      const profile = {
        formality: { level: 'formal' },
        tone: 'professional',
        vocabulary: { complexity: 'medium' },
        structure: { avgSentenceLength: 15 },
        punctuation: { exclamationRate: 0.2 },
        emoji: 'never',
        signaturePhrases: {
          common: ['in fact', 'however']
        }
      };

      const prompt = engine.generateStylePrompt(profile);

      expect(prompt).toContain('formal');
      expect(prompt).toContain('professional');
      expect(prompt).toContain('medium');
      expect(prompt).toContain('15');
      expect(prompt).toContain('in fact');
    });

    it('should handle profile with error', () => {
      const prompt = engine.generateStylePrompt({ error: 'No data' });

      expect(prompt).toContain('clear, natural style');
    });

    it('should handle emoji frequency', () => {
      const profileFrequent = { emoji: 'frequent', formality: {}, vocabulary: {}, punctuation: {} };
      const profileOccasional = { emoji: 'occasional', formality: {}, vocabulary: {}, punctuation: {} };
      const profileNever = { emoji: 'never', formality: {}, vocabulary: {}, punctuation: {} };

      expect(engine.generateStylePrompt(profileFrequent)).toContain('Include relevant emojis');
      expect(engine.generateStylePrompt(profileOccasional)).toContain('sparingly');
      expect(engine.generateStylePrompt(profileNever)).toContain('Avoid');
    });
  });

  describe('calculateStyleConsistency', () => {
    it('should return 100 for single sample', () => {
      const result = engine.calculateStyleConsistency([{}]);

      expect(result).toBe(100);
    });

    it('should calculate consistency for multiple samples', () => {
      const samples = [
        { analysis: { formality: { level: 'formal' }, tone: { dominant: 'professional' } } },
        { analysis: { formality: { level: 'formal' }, tone: { dominant: 'professional' } } },
        { analysis: { formality: { level: 'formal' }, tone: { dominant: 'friendly' } } }
      ];

      const result = engine.calculateStyleConsistency(samples);

      expect(result).toBeGreaterThan(50);
    });
  });

  describe('calculateConsistencyScore', () => {
    it('should calculate score for consistent values', () => {
      const values = ['a', 'a', 'a', 'a'];
      const score = engine.calculateConsistencyScore(values);

      expect(score).toBe(100);
    });

    it('should calculate score for varied values', () => {
      const values = ['a', 'b', 'c', 'd'];
      const score = engine.calculateConsistencyScore(values);

      expect(score).toBe(25);
    });

    it('should return 100 for empty array', () => {
      const score = engine.calculateConsistencyScore([]);

      expect(score).toBe(100);
    });
  });

  describe('generateInStyle', () => {
    it('should fail without AI provider', async () => {
      const profile = engine.generateStyleProfile({
        formality: { level: 'neutral' },
        tone: { dominant: 'neutral' },
        vocabulary: { complexity: 'medium' },
        punctuation: {},
        emoji: { frequency: 'never' },
        markers: {},
        metrics: {}
      });

      const result = await engine.generateInStyle(profile, 'Write a greeting');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No AI provider');
    });
  });
});
