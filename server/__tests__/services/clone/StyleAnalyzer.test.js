/**
 * StyleAnalyzer Service Tests
 */

const StyleAnalyzer = require('../../../services/clone/StyleAnalyzer');

describe('StyleAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new StyleAnalyzer();
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      expect(analyzer).toBeDefined();
      expect(analyzer.config).toEqual({});
    });

    it('should accept custom config', () => {
      const customAnalyzer = new StyleAnalyzer({ customOption: true });
      expect(customAnalyzer.config.customOption).toBe(true);
    });
  });

  describe('analyzeStyle', () => {
    it('should analyze basic text', async () => {
      const text = 'Hello world. This is a test. How are you?';
      const result = await analyzer.analyzeStyle(text);

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(result.analysis.wordCount).toBe(9);
      expect(result.analysis.sentenceCount).toBe(3);
    });

    it('should calculate avgWordsPerSentence', async () => {
      const text = 'Short sentence. Another short one. And one more here.';
      const result = await analyzer.analyzeStyle(text);

      expect(result.success).toBe(true);
      expect(result.analysis.avgWordsPerSentence).toBeGreaterThan(0);
    });

    it('should handle empty text', async () => {
      const result = await analyzer.analyzeStyle('');
      expect(result.success).toBe(true);
      expect(result.analysis.wordCount).toBe(0);
    });

    it('should analyze vocabulary', async () => {
      const text = 'The quick brown fox jumps over the lazy dog.';
      const result = await analyzer.analyzeStyle(text);

      expect(result.analysis.vocabulary).toBeDefined();
      expect(result.analysis.vocabulary.totalWords).toBeGreaterThan(0);
      expect(result.analysis.vocabulary.uniqueWords).toBeGreaterThan(0);
    });

    it('should analyze punctuation', async () => {
      const text = 'Hello! How are you? I am fine, thank you.';
      const result = await analyzer.analyzeStyle(text);

      expect(result.analysis.punctuation.exclamations).toBe(1);
      expect(result.analysis.punctuation.questions).toBe(1);
      expect(result.analysis.punctuation.commas).toBe(1);
    });

    it('should analyze formality', async () => {
      const text = 'Therefore, we must consider the implications furthermore.';
      const result = await analyzer.analyzeStyle(text);

      expect(result.analysis.formality).toBeDefined();
      expect(result.analysis.formality.level).toBeDefined();
    });

    it('should analyze tone', async () => {
      const text = 'I am so happy and excited about this wonderful opportunity!';
      const result = await analyzer.analyzeStyle(text);

      expect(result.analysis.tone).toBeDefined();
      expect(result.analysis.tone.isPositive).toBe(true);
    });
  });

  describe('countWords', () => {
    it('should count words correctly', () => {
      expect(analyzer.countWords('one two three')).toBe(3);
      expect(analyzer.countWords('hello')).toBe(1);
      expect(analyzer.countWords('')).toBe(0);
    });

    it('should handle multiple spaces', () => {
      expect(analyzer.countWords('one   two    three')).toBe(3);
    });

    it('should handle newlines', () => {
      expect(analyzer.countWords('one\ntwo\nthree')).toBe(3);
    });
  });

  describe('countSentences', () => {
    it('should count sentences by punctuation', () => {
      expect(analyzer.countSentences('Hello. World.')).toBe(2);
      expect(analyzer.countSentences('Hello! World?')).toBe(2);
      expect(analyzer.countSentences('Hello')).toBe(1);
    });

    it('should handle multiple punctuation', () => {
      expect(analyzer.countSentences('What?!')).toBe(1);
      expect(analyzer.countSentences('Really...')).toBe(1);
    });
  });

  describe('countParagraphs', () => {
    it('should count paragraphs', () => {
      expect(analyzer.countParagraphs('Para 1\n\nPara 2')).toBe(2);
      expect(analyzer.countParagraphs('Single para')).toBe(1);
    });

    it('should handle multiple newlines', () => {
      expect(analyzer.countParagraphs('Para 1\n\n\n\nPara 2')).toBe(2);
    });
  });

  describe('analyzeVocabulary', () => {
    it('should calculate vocabulary richness', () => {
      const result = analyzer.analyzeVocabulary('the the the cat sat');
      expect(result.vocabularyRichness).toBeLessThan(1);
      expect(result.totalWords).toBe(5);
      expect(result.uniqueWords).toBe(3);
    });

    it('should find top words', () => {
      const result = analyzer.analyzeVocabulary('hello hello hello world');
      expect(result.topWords[0].word).toBe('hello');
      expect(result.topWords[0].count).toBe(3);
    });

    it('should calculate average word length', () => {
      const result = analyzer.analyzeVocabulary('a bb ccc');
      expect(result.avgWordLength).toBe(2);
    });
  });

  describe('analyzePunctuation', () => {
    it('should count all punctuation types', () => {
      const result = analyzer.analyzePunctuation('Hello, world! How are you? I am fine; yes: really—truly...');

      expect(result.commas).toBe(1);
      expect(result.exclamations).toBe(1);
      expect(result.questions).toBe(1);
      expect(result.semicolons).toBe(1);
      expect(result.colons).toBe(1);
      expect(result.dashes).toBeGreaterThan(0);
      expect(result.ellipses).toBe(1);
    });

    it('should count quotations', () => {
      const result = analyzer.analyzePunctuation('"Hello" said John');
      expect(result.quotations).toBe(2);
    });
  });

  describe('analyzeCapitalization', () => {
    it('should detect capitalized words', () => {
      const result = analyzer.analyzeCapitalization('Hello World');
      expect(result.capitalizedRatio).toBeGreaterThan(0);
    });

    it('should detect all caps words', () => {
      const result = analyzer.analyzeCapitalization('This is VERY important');
      expect(result.allCapsCount).toBe(1);
      expect(result.usesAllCaps).toBe(true);
    });

    it('should handle no all caps', () => {
      const result = analyzer.analyzeCapitalization('This is normal text');
      expect(result.usesAllCaps).toBe(false);
    });
  });

  describe('analyzeFormality', () => {
    it('should detect formal text', () => {
      const result = analyzer.analyzeFormality('Therefore, we must consider the implications. Furthermore, the evidence suggests otherwise. Consequently, we need to act accordingly. Nevertheless, the situation is complex. Moreover, hereby we declare our position.');
      expect(result.level).toBe('formal');
      expect(result.formalWordCount).toBeGreaterThan(0);
    });

    it('should detect informal text', () => {
      const result = analyzer.analyzeFormality("Hey! That's gonna be awesome. Wanna come? Yeah!");
      expect(result.level).toBe('informal');
      expect(result.informalWordCount).toBeGreaterThan(0);
    });

    it('should detect neutral text', () => {
      const result = analyzer.analyzeFormality('The cat sat on the mat.');
      expect(result.level).toBe('neutral');
    });

    it('should count contractions', () => {
      const result = analyzer.analyzeFormality("I'm not sure what you're saying");
      expect(result.contractionCount).toBe(2);
    });
  });

  describe('analyzeTone', () => {
    it('should detect positive tone', () => {
      const result = analyzer.analyzeTone('I love this! It is excellent and wonderful!');
      expect(result.isPositive).toBe(true);
      expect(result.scores.positive).toBeGreaterThan(0);
    });

    it('should detect negative tone', () => {
      const result = analyzer.analyzeTone('Unfortunately there is a problem. I am disappointed.');
      expect(result.isPositive).toBe(false);
      expect(result.scores.negative).toBeGreaterThan(0);
    });

    it('should detect confident tone', () => {
      const result = analyzer.analyzeTone('I am absolutely certain and confident about this.');
      expect(result.isConfident).toBe(true);
      expect(result.scores.confident).toBeGreaterThan(0);
    });

    it('should detect tentative tone', () => {
      const result = analyzer.analyzeTone('Maybe this could possibly work. I think it might.');
      expect(result.isConfident).toBe(false);
      expect(result.scores.tentative).toBeGreaterThan(0);
    });

    it('should detect urgent tone', () => {
      const result = analyzer.analyzeTone('This is urgent and critical! We need it immediately!');
      expect(result.isUrgent).toBe(true);
    });

    it('should detect friendly tone', () => {
      const result = analyzer.analyzeTone('Thank you so much! I hope you enjoy it. Looking forward to hearing from you!');
      expect(result.isFriendly).toBe(true);
    });

    it('should return dominant tone', () => {
      const result = analyzer.analyzeTone('This is great, excellent, wonderful, amazing!');
      expect(result.dominant).toBe('positive');
    });
  });

  describe('extractPatterns', () => {
    it('should extract greetings', () => {
      const result = analyzer.extractPatterns('Hello everyone. How are you today?');
      expect(result.greetings).toContain('Hello everyone');
    });

    it('should extract closings', () => {
      const result = analyzer.extractPatterns('Thank you for your time. Best regards.');
      expect(result.closings.length).toBeGreaterThan(0);
    });

    it('should extract transitions', () => {
      const result = analyzer.extractPatterns('However, this is different. Furthermore, we should consider.');
      expect(result.transitions).toContain('however');
      expect(result.transitions).toContain('furthermore');
    });
  });

  describe('generateStyleProfile', () => {
    it('should generate profile from multiple samples', async () => {
      const samples = [
        { content: 'Hello! This is great! I am so happy!' },
        { content: 'Hi there! This is wonderful! Excellent work!' },
        { content: 'Hey! Amazing job! Thank you so much!' }
      ];

      const result = await analyzer.generateStyleProfile(samples);

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();
      expect(result.profile.sampleCount).toBe(3);
      expect(result.profile.tone).toBeDefined();
    });

    it('should fail with no valid samples', async () => {
      const result = await analyzer.generateStyleProfile([]);
      expect(result.success).toBe(false);
    });

    it('should calculate average values', async () => {
      const samples = [
        { content: 'Short one.' },
        { content: 'Another short sentence here.' },
        { content: 'Third sample text here now.' }
      ];

      const result = await analyzer.generateStyleProfile(samples);
      expect(result.profile.avgWordsPerSentence).toBeGreaterThan(0);
    });

    it('should merge patterns from all samples', async () => {
      const samples = [
        { content: 'Hello friend. Best regards.' },
        { content: 'Hi there. Thanks!' }
      ];

      const result = await analyzer.generateStyleProfile(samples);
      expect(result.profile.commonPatterns).toBeDefined();
    });
  });

  describe('average', () => {
    it('should calculate average', () => {
      expect(analyzer.average([1, 2, 3])).toBe(2);
      expect(analyzer.average([10, 20])).toBe(15);
    });

    it('should handle empty array', () => {
      expect(analyzer.average([])).toBe(0);
    });

    it('should round to 2 decimal places', () => {
      expect(analyzer.average([1, 2, 3, 4])).toBe(2.5);
    });
  });

  describe('mode', () => {
    it('should find most common value', () => {
      expect(analyzer.mode(['a', 'b', 'a', 'a'])).toBe('a');
      expect(analyzer.mode(['x', 'y', 'y'])).toBe('y');
    });

    it('should handle empty array', () => {
      expect(analyzer.mode([])).toBeNull();
    });
  });

  describe('mergePatterns', () => {
    it('should merge patterns from multiple analyses', () => {
      const patterns = [
        { greetings: ['Hello'], closings: ['Best'], transitions: ['however'] },
        { greetings: ['Hi'], closings: ['Thanks'], transitions: ['therefore'] }
      ];

      const result = analyzer.mergePatterns(patterns);
      expect(result.greetings).toContain('Hello');
      expect(result.greetings).toContain('Hi');
      expect(result.transitions).toContain('however');
      expect(result.transitions).toContain('therefore');
    });

    it('should remove duplicates', () => {
      const patterns = [
        { greetings: ['Hello'], closings: [], transitions: [] },
        { greetings: ['Hello'], closings: [], transitions: [] }
      ];

      const result = analyzer.mergePatterns(patterns);
      expect(result.greetings.length).toBe(1);
    });

    it('should limit results', () => {
      const patterns = Array(10).fill({
        greetings: ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'],
        closings: [],
        transitions: []
      });

      const result = analyzer.mergePatterns(patterns);
      expect(result.greetings.length).toBeLessThanOrEqual(5);
    });
  });
});
