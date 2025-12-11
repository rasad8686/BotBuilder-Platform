/**
 * TrainingService Tests
 */

const TrainingService = require('../../../services/clone/TrainingService');

// Mock StyleAnalyzer
jest.mock('../../../services/clone/StyleAnalyzer', () => {
  return jest.fn().mockImplementation(() => ({
    analyzeStyle: jest.fn().mockResolvedValue({
      success: true,
      analysis: {
        wordCount: 10,
        sentenceCount: 2,
        avgWordsPerSentence: 5,
        vocabulary: { vocabularyRichness: 0.6 },
        punctuation: { exclamations: 1 },
        formality: { level: 'neutral', score: 0 },
        tone: { dominant: 'positive', isPositive: true }
      }
    }),
    generateStyleProfile: jest.fn().mockResolvedValue({
      success: true,
      profile: {
        avgWordsPerSentence: 12,
        formality: { level: 'neutral' },
        tone: { dominant: 'positive' },
        sampleCount: 3
      }
    })
  }));
});

describe('TrainingService', () => {
  let trainingService;

  beforeEach(() => {
    jest.clearAllMocks();
    trainingService = new TrainingService();
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      expect(trainingService).toBeDefined();
      expect(trainingService.config).toEqual({});
    });

    it('should create StyleAnalyzer instance', () => {
      expect(trainingService.styleAnalyzer).toBeDefined();
    });
  });

  describe('cleanContent', () => {
    it('should normalize whitespace', () => {
      const result = trainingService.cleanContent('hello   world');
      expect(result).toBe('hello world');
    });

    it('should normalize line endings', () => {
      const result = trainingService.cleanContent('hello\r\nworld');
      expect(result).toBe('hello\nworld');
    });

    it('should remove excessive newlines', () => {
      const result = trainingService.cleanContent('hello\n\n\n\n\nworld');
      expect(result).toBe('hello\n\nworld');
    });

    it('should trim lines', () => {
      const result = trainingService.cleanContent('  hello  \n  world  ');
      expect(result).toBe('hello\nworld');
    });

    it('should convert tabs to spaces', () => {
      const result = trainingService.cleanContent('hello\tworld');
      expect(result).toBe('hello world');
    });

    it('should handle empty content', () => {
      expect(trainingService.cleanContent('')).toBe('');
      expect(trainingService.cleanContent(null)).toBe('');
      expect(trainingService.cleanContent(undefined)).toBe('');
    });
  });

  describe('extractFeatures', () => {
    it('should extract base features', () => {
      const content = 'Hello world, how are you today?';
      const result = trainingService.extractFeatures(content, 'chat');

      expect(result.length).toBe(content.length);
      expect(result.wordCount).toBe(6);
      expect(result.lineCount).toBe(1);
    });

    it('should detect greetings', () => {
      const result = trainingService.extractFeatures('Hello everyone!', 'chat');
      expect(result.hasGreeting).toBe(true);
    });

    it('should detect closings', () => {
      const result = trainingService.extractFeatures('Thank you, best regards', 'email');
      expect(result.hasClosing).toBe(true);
    });

    describe('email features', () => {
      it('should detect subject', () => {
        const result = trainingService.extractFeatures('Subject: Test\nHello', 'email');
        expect(result.hasSubject).toBe(true);
      });

      it('should detect salutation', () => {
        const result = trainingService.extractFeatures('Dear John,\nContent here', 'email');
        expect(result.hasSalutation).toBe(true);
      });

      it('should detect attachment references', () => {
        const result = trainingService.extractFeatures('Please see attached document', 'email');
        expect(result.hasAttachmentRef).toBe(true);
      });

      it('should detect reply', () => {
        const result = trainingService.extractFeatures('Re: Previous email', 'email');
        expect(result.isReply).toBe(true);
      });
    });

    describe('document features', () => {
      it('should detect title', () => {
        const result = trainingService.extractFeatures('# Main Title\n\nContent', 'document');
        expect(result.hasTitle).toBe(true);
      });

      it('should count sections', () => {
        const result = trainingService.extractFeatures('# Section 1\n## Section 2\n1. Item', 'document');
        expect(result.hasSections).toBeGreaterThan(0);
      });

      it('should count bullet points', () => {
        const result = trainingService.extractFeatures('- Item 1\n- Item 2\n* Item 3', 'document');
        expect(result.hasBulletPoints).toBe(3);
      });

      it('should detect code blocks', () => {
        const result = trainingService.extractFeatures('```\ncode here\n```', 'document');
        expect(result.hasCodeBlocks).toBe(true);
      });
    });

    describe('chat features', () => {
      it('should detect short messages', () => {
        const result = trainingService.extractFeatures('Hi!', 'chat');
        expect(result.isShortMessage).toBe(true);
      });

      it('should detect URLs', () => {
        const result = trainingService.extractFeatures('Check this https://example.com', 'chat');
        expect(result.hasUrl).toBe(true);
      });

      it('should detect questions', () => {
        const result = trainingService.extractFeatures('How are you?', 'chat');
        expect(result.isQuestion).toBe(true);
      });
    });

    describe('social features', () => {
      it('should detect hashtags', () => {
        const result = trainingService.extractFeatures('Great post! #awesome #cool', 'social');
        expect(result.hasHashtag).toBe(true);
      });

      it('should detect mentions', () => {
        const result = trainingService.extractFeatures('Hey @john check this', 'social');
        expect(result.hasMention).toBe(true);
      });

      it('should track character count', () => {
        const content = 'Short tweet';
        const result = trainingService.extractFeatures(content, 'social');
        expect(result.characterCount).toBe(content.length);
      });
    });
  });

  describe('calculateQualityScore', () => {
    it('should give base score of 50', () => {
      const score = trainingService.calculateQualityScore('word', {});
      expect(score).toBeGreaterThanOrEqual(30);
    });

    it('should add points for ideal word count', () => {
      const content = Array(100).fill('word').join(' ');
      const score = trainingService.calculateQualityScore(content, {});
      expect(score).toBeGreaterThan(50);
    });

    it('should subtract points for very short content', () => {
      const score = trainingService.calculateQualityScore('hi', {});
      expect(score).toBeLessThan(50);
    });

    it('should add points for vocabulary richness', () => {
      const analysis = { vocabulary: { vocabularyRichness: 0.7 } };
      const content = Array(50).fill('word').join(' ');
      const score = trainingService.calculateQualityScore(content, analysis);
      expect(score).toBeGreaterThan(50);
    });

    it('should add points for proper sentence structure', () => {
      const analysis = { avgWordsPerSentence: 15 };
      const content = Array(50).fill('word').join(' ');
      const score = trainingService.calculateQualityScore(content, analysis);
      expect(score).toBeGreaterThan(50);
    });

    it('should subtract points for too many exclamations', () => {
      const analysis = { punctuation: { exclamations: 10 } };
      const content = Array(50).fill('word').join(' ');
      const score = trainingService.calculateQualityScore(content, analysis);
      expect(score).toBeLessThan(75);
    });

    it('should add points for proper ending', () => {
      const score = trainingService.calculateQualityScore('This is a proper sentence.', {});
      expect(score).toBeGreaterThan(50);
    });

    it('should subtract points for excessive caps', () => {
      const content = 'THIS IS ALL CAPS TEXT HERE';
      const score = trainingService.calculateQualityScore(content, {});
      expect(score).toBeLessThan(60);
    });

    it('should clamp score between 0 and 100', () => {
      const score1 = trainingService.calculateQualityScore('a', {});
      const score2 = trainingService.calculateQualityScore(Array(200).fill('goodword').join(' '), { vocabulary: { vocabularyRichness: 1 }, avgWordsPerSentence: 15 });

      expect(score1).toBeGreaterThanOrEqual(0);
      expect(score2).toBeLessThanOrEqual(100);
    });
  });

  describe('processItem', () => {
    it('should process item successfully', async () => {
      const item = {
        id: 1,
        original_content: 'Hello world. This is a test.',
        data_type: 'chat'
      };

      const result = await trainingService.processItem(item);

      expect(result.success).toBe(true);
      expect(result.data.processed_content).toBeDefined();
      expect(result.data.extracted_features).toBeDefined();
      expect(result.data.quality_score).toBeDefined();
      expect(result.data.is_processed).toBe(true);
      expect(result.data.processed_at).toBeDefined();
    });

    it('should preserve original item properties', async () => {
      const item = {
        id: 123,
        clone_id: 456,
        original_content: 'Test content',
        data_type: 'email'
      };

      const result = await trainingService.processItem(item);

      expect(result.data.id).toBe(123);
      expect(result.data.clone_id).toBe(456);
    });
  });

  describe('processTrainingData', () => {
    it('should process multiple items', async () => {
      const data = [
        { id: 1, original_content: 'Content one here.', data_type: 'chat' },
        { id: 2, original_content: 'Content two here.', data_type: 'chat' }
      ];

      const result = await trainingService.processTrainingData(data);

      expect(result.success).toBe(true);
      expect(result.processed.length).toBe(2);
      expect(result.count).toBe(2);
      expect(result.skipped).toBe(0);
    });

    it('should handle empty array', async () => {
      const result = await trainingService.processTrainingData([]);

      expect(result.success).toBe(true);
      expect(result.processed.length).toBe(0);
      expect(result.count).toBe(0);
    });
  });

  describe('validateTrainingData', () => {
    it('should pass valid data', () => {
      const result = trainingService.validateTrainingData({
        original_content: 'This is valid content with enough characters.',
        data_type: 'email'
      });

      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should fail for too short content', () => {
      const result = trainingService.validateTrainingData({
        original_content: 'Hi',
        data_type: 'email'
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Content too short (minimum 10 characters)');
    });

    it('should fail for too long content', () => {
      const result = trainingService.validateTrainingData({
        original_content: 'x'.repeat(50001),
        data_type: 'email'
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Content too long (maximum 50000 characters)');
    });

    it('should fail for missing data_type', () => {
      const result = trainingService.validateTrainingData({
        original_content: 'Valid content here'
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Data type is required');
    });

    it('should fail for invalid data_type', () => {
      const result = trainingService.validateTrainingData({
        original_content: 'Valid content here',
        data_type: 'invalid_type'
      });

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid data type');
    });

    it('should accept all valid types', () => {
      const validTypes = ['email', 'document', 'chat', 'social', 'custom'];

      validTypes.forEach(type => {
        const result = trainingService.validateTrainingData({
          original_content: 'Valid content here',
          data_type: type
        });
        expect(result.isValid).toBe(true);
      });
    });

    it('should fail for missing content', () => {
      const result = trainingService.validateTrainingData({
        data_type: 'email'
      });

      expect(result.isValid).toBe(false);
    });

    it('should fail for whitespace-only content', () => {
      const result = trainingService.validateTrainingData({
        original_content: '     ',
        data_type: 'email'
      });

      expect(result.isValid).toBe(false);
    });
  });

  describe('generateTrainingPrompt', () => {
    it('should generate prompt with style profile', () => {
      const profile = {
        avgWordsPerSentence: 15,
        formality: { level: 'formal' },
        tone: { dominant: 'positive', isPositive: true, isFriendly: true, isConfident: true },
        vocabularyRichness: 0.6,
        punctuationStyle: { usesExclamations: true, usesEllipses: false },
        commonPatterns: {
          greetings: ['Hello', 'Dear'],
          closings: ['Best regards', 'Sincerely']
        }
      };

      const samples = [
        { processed_content: 'Sample 1 content' },
        { original_content: 'Sample 2 content' }
      ];

      const prompt = trainingService.generateTrainingPrompt(profile, samples);

      expect(prompt).toContain('Writing Style Profile');
      expect(prompt).toContain('15');
      expect(prompt).toContain('formal');
      expect(prompt).toContain('positive');
      expect(prompt).toContain('Sample 1 content');
      expect(prompt).toContain('Sample 2 content');
    });

    it('should include greetings and closings', () => {
      const profile = {
        avgWordsPerSentence: 10,
        formality: { level: 'neutral' },
        tone: { dominant: 'neutral' },
        commonPatterns: {
          greetings: ['Hi there'],
          closings: ['Thanks']
        }
      };

      const prompt = trainingService.generateTrainingPrompt(profile, []);

      expect(prompt).toContain('Common Greetings');
      expect(prompt).toContain('Hi there');
      expect(prompt).toContain('Common Closings');
      expect(prompt).toContain('Thanks');
    });

    it('should limit to 5 example samples', () => {
      const profile = {
        avgWordsPerSentence: 10,
        formality: { level: 'neutral' },
        tone: { dominant: 'neutral' },
        commonPatterns: {}
      };

      const samples = Array(10).fill({ processed_content: 'Sample' });
      const prompt = trainingService.generateTrainingPrompt(profile, samples);

      const exampleMatches = prompt.match(/### Example/g);
      expect(exampleMatches.length).toBe(5);
    });
  });

  describe('trainClone', () => {
    it('should train clone successfully', async () => {
      const clone = { id: 1, name: 'Test Clone' };
      const processedData = [
        { processed_content: 'Sample 1', quality_score: 80 },
        { processed_content: 'Sample 2', quality_score: 70 },
        { processed_content: 'Sample 3', quality_score: 90 }
      ];

      const result = await trainingService.trainClone(clone, processedData);

      expect(result.success).toBe(true);
      expect(result.styleProfile).toBeDefined();
      expect(result.trainingPrompt).toBeDefined();
      expect(result.trainingScore).toBeDefined();
      expect(result.samplesUsed).toBe(3);
    });

    it('should calculate training score based on quality', async () => {
      const clone = { id: 1 };
      const processedData = [
        { processed_content: 'Sample 1', quality_score: 100 },
        { processed_content: 'Sample 2', quality_score: 100 }
      ];

      const result = await trainingService.trainClone(clone, processedData);

      expect(result.trainingScore).toBeGreaterThan(0);
      expect(result.trainingScore).toBeLessThanOrEqual(100);
    });

    it('should fail if style profile generation fails', async () => {
      trainingService.styleAnalyzer.generateStyleProfile = jest.fn().mockResolvedValue({
        success: false,
        error: 'Failed'
      });

      const result = await trainingService.trainClone({}, [{ processed_content: 'Test' }]);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to generate style profile');
    });
  });
});
