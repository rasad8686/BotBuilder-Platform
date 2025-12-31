/**
 * PersonalityEngine Tests
 * Tests for bot personality cloning, trait analysis, and response generation
 */

jest.mock('node-fetch', () => jest.fn(), { virtual: true });

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const PersonalityEngine = require('../../../services/clone/PersonalityEngine');

describe('PersonalityEngine', () => {
  let engine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new PersonalityEngine();
  });

  describe('constructor', () => {
    it('should initialize with default traits', () => {
      expect(engine.traitDefaults.friendliness).toBe(5);
      expect(engine.traitDefaults.formality).toBe(5);
      expect(engine.traitDefaults.enthusiasm).toBe(5);
    });

    it('should accept custom config', () => {
      const customEngine = new PersonalityEngine({
        openaiApiKey: 'test-key',
        anthropicApiKey: 'anthropic-key'
      });
      expect(customEngine.openaiApiKey).toBe('test-key');
      expect(customEngine.anthropicApiKey).toBe('anthropic-key');
    });
  });

  describe('initializeClone', () => {
    it('should initialize clone job successfully', async () => {
      const result = await engine.initializeClone('job-123', { name: 'Test' });

      expect(result.success).toBe(true);
      expect(result.jobId).toBe('job-123');
      expect(result.status).toBe('initialized');
      expect(result.availableTraits).toContain('friendliness');
      expect(result.traitScale.min).toBe(1);
      expect(result.traitScale.max).toBe(10);
    });
  });

  describe('analyzeConversations', () => {
    it('should analyze conversations successfully', async () => {
      const samples = [
        { content: 'Hello! I am happy to help you today. That sounds wonderful!' },
        { original_content: 'I understand your concern. Let me explain step by step.' }
      ];

      const result = await engine.analyzeConversations(samples);

      expect(result.success).toBe(true);
      expect(result.traits).toBeDefined();
      expect(result.patterns).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.samplesAnalyzed).toBe(2);
    });

    it('should fail with no samples', async () => {
      const result = await engine.analyzeConversations([]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No samples');
    });

    it('should fail with null samples', async () => {
      const result = await engine.analyzeConversations(null);

      expect(result.success).toBe(false);
    });

    it('should handle samples without content', async () => {
      const samples = [
        { content: 'Valid content' },
        { noContent: true }
      ];

      const result = await engine.analyzeConversations(samples);

      expect(result.success).toBe(true);
      expect(result.samplesAnalyzed).toBe(1);
    });
  });

  describe('Trait Analysis', () => {
    describe('analyzeFriendliness', () => {
      it('should detect friendly text', () => {
        const friendlyText = 'I am so happy to help you! This is wonderful and I love working with you.';
        const score = engine.analyzeFriendliness(friendlyText.toLowerCase());

        expect(score).toBeGreaterThan(5);
      });

      it('should detect unfriendly text', () => {
        const unfriendlyText = 'Unfortunately, this is impossible. Sorry, but I cannot help with that.';
        const score = engine.analyzeFriendliness(unfriendlyText.toLowerCase());

        expect(score).toBeLessThanOrEqual(5);
      });
    });

    describe('analyzeFormality', () => {
      it('should detect formal text', () => {
        const formalText = 'Therefore, I must respectfully decline. Furthermore, regarding your inquiry.';
        const score = engine.analyzeFormality(formalText.toLowerCase());

        expect(score).toBeGreaterThan(5);
      });

      it('should detect informal text', () => {
        const informalText = "Hey yeah I'm gonna wanna help you with that lol btw";
        const score = engine.analyzeFormality(informalText.toLowerCase());

        expect(score).toBeLessThan(5);
      });

      it('should penalize contractions', () => {
        const textWithContractions = "I've been there. We're going to fix it. That's great!";
        const textWithout = "I have been there. We are going to fix it. That is great!";

        const scoreWith = engine.analyzeFormality(textWithContractions.toLowerCase());
        const scoreWithout = engine.analyzeFormality(textWithout.toLowerCase());

        expect(scoreWithout).toBeGreaterThanOrEqual(scoreWith);
      });
    });

    describe('analyzeEnthusiasm', () => {
      it('should detect enthusiastic text', () => {
        const enthusiasticText = 'This is AMAZING! I am so excited! Fantastic work!!!!';
        const score = engine.analyzeEnthusiasm(enthusiasticText.toLowerCase());

        expect(score).toBeGreaterThan(5);
      });

      it('should detect calm text', () => {
        const calmText = 'Here is the information you requested.';
        const score = engine.analyzeEnthusiasm(calmText.toLowerCase());

        expect(score).toBeLessThanOrEqual(6);
      });
    });

    describe('analyzeDirectness', () => {
      it('should detect direct text', () => {
        const directText = 'You must do this immediately. You need to fix this now.';
        const score = engine.analyzeDirectness(directText.toLowerCase());

        expect(score).toBeGreaterThan(5);
      });

      it('should detect indirect text', () => {
        const indirectText = 'Perhaps you might consider maybe looking into this possibility.';
        const score = engine.analyzeDirectness(indirectText.toLowerCase());

        expect(score).toBeLessThan(5);
      });
    });

    describe('analyzeEmpathy', () => {
      it('should detect empathetic text', () => {
        const empatheticText = 'I understand how you feel. Sorry to hear that. I appreciate your concern.';
        const score = engine.analyzeEmpathy(empatheticText.toLowerCase());

        expect(score).toBeGreaterThan(5);
      });
    });

    describe('analyzeHumor', () => {
      it('should detect humorous text', () => {
        const humorousText = 'Haha that is so funny! lol just kidding :)';
        const score = engine.analyzeHumor(humorousText.toLowerCase());

        expect(score).toBeGreaterThan(3);
      });
    });

    describe('analyzePatience', () => {
      it('should detect patient text', () => {
        const patientText = 'Take your time. No rush. Let me explain step by step. No worries!';
        const score = engine.analyzePatience(patientText.toLowerCase());

        expect(score).toBeGreaterThan(5);
      });

      it('should detect impatient text', () => {
        const impatientText = 'We need this immediately! Hurry up! ASAP!';
        const score = engine.analyzePatience(impatientText.toLowerCase());

        expect(score).toBeLessThan(5);
      });
    });

    describe('analyzeCreativity', () => {
      it('should detect creative text', () => {
        const creativeText = 'Imagine a unique and innovative approach. This is a creative idea!';
        const score = engine.analyzeCreativity(creativeText.toLowerCase());

        expect(score).toBeGreaterThan(5);
      });
    });
  });

  describe('Pattern Extraction', () => {
    describe('extractResponsePatterns', () => {
      it('should extract response patterns', () => {
        const text = 'Hello there! I understand. Got it. Take care. Goodbye!';
        const patterns = engine.extractResponsePatterns(text);

        expect(patterns.greetings).toBeDefined();
        expect(patterns.farewells).toBeDefined();
        expect(patterns.acknowledgments).toBeDefined();
        expect(patterns.fillerWords).toBeDefined();
        expect(patterns.emphasisPatterns).toBeDefined();
      });
    });

    describe('extractGreetings', () => {
      it('should extract greeting patterns', () => {
        const sentences = [
          'Hello and welcome',
          'Good morning everyone',
          'This is a statement'
        ];

        const greetings = engine.extractGreetings(sentences);

        expect(greetings).toContain('Hello and welcome');
        expect(greetings).toContain('Good morning everyone');
        expect(greetings).not.toContain('This is a statement');
      });
    });

    describe('extractFarewells', () => {
      it('should extract farewell patterns', () => {
        const sentences = [
          'Some content here',
          'Take care everyone',
          'Goodbye and best wishes'
        ];

        const farewells = engine.extractFarewells(sentences);

        expect(farewells.length).toBeGreaterThan(0);
      });
    });

    describe('extractAcknowledgments', () => {
      it('should extract acknowledgments', () => {
        const text = 'I understand. Got it. Of course! Certainly.';
        const acks = engine.extractAcknowledgments(text);

        expect(acks).toContain('I understand');
        expect(acks).toContain('Of course');
      });
    });

    describe('extractFillerWords', () => {
      it('should extract filler words', () => {
        const text = 'Well, actually I think basically this is how it works, you know?';
        const fillers = engine.extractFillerWords(text);

        expect(fillers).toContain('well');
        expect(fillers).toContain('actually');
        expect(fillers).toContain('basically');
      });
    });

    describe('extractEmphasisPatterns', () => {
      it('should detect emphasis patterns', () => {
        const text = 'This is VERY important! **Bold text** is really great!';
        const patterns = engine.extractEmphasisPatterns(text);

        expect(patterns.usesCapitalization).toBe(true);
        expect(patterns.usesExclamations).toBe(true);
        expect(patterns.usesEmphasisWords).toBe(true);
        expect(patterns.usesBoldText).toBe(true);
      });
    });
  });

  describe('countRepetitivePatterns', () => {
    it('should count repetitive patterns', () => {
      const text = 'I will help you. I will assist you. I will guide you. Different start.';
      const count = engine.countRepetitivePatterns(text);

      expect(count).toBeGreaterThan(0);
    });
  });

  describe('aggregatePersonalityAnalyses', () => {
    it('should aggregate multiple analyses', () => {
      const analyses = [
        { traits: { friendliness: 8, formality: 6 }, patterns: { greetings: ['Hi'] }, textLength: 100 },
        { traits: { friendliness: 6, formality: 8 }, patterns: { greetings: ['Hello'] }, textLength: 150 }
      ];

      const aggregated = engine.aggregatePersonalityAnalyses(analyses);

      expect(aggregated.traits.friendliness).toBe(7);
      expect(aggregated.traits.formality).toBe(7);
      expect(aggregated.patterns.greetings).toContain('Hi');
      expect(aggregated.patterns.greetings).toContain('Hello');
    });

    it('should use defaults for missing traits', () => {
      const analyses = [
        { traits: {}, patterns: { greetings: [] }, textLength: 100 }
      ];

      const aggregated = engine.aggregatePersonalityAnalyses(analyses);

      expect(aggregated.traits.friendliness).toBe(5);
    });
  });

  describe('calculateConfidence', () => {
    it('should return lower confidence for few samples', () => {
      const lowConfidence = engine.calculateConfidence([{}, {}]);
      const midConfidence = engine.calculateConfidence([{}, {}, {}, {}]);
      const highConfidence = engine.calculateConfidence([{}, {}, {}, {}, {}, {}, {}, {}, {}, {}]);

      expect(lowConfidence).toBeLessThan(midConfidence);
      expect(midConfidence).toBeLessThan(highConfidence);
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

  describe('createPersonalityProfile', () => {
    it('should create profile with defaults', () => {
      const profile = engine.createPersonalityProfile({ name: 'Test Bot' });

      expect(profile.id).toBeDefined();
      expect(profile.name).toBe('Test Bot');
      expect(profile.traits.friendliness).toBe(5);
      expect(profile.toneSettings.primaryTone).toBe('professional');
      expect(profile.systemPrompt).toBeDefined();
    });

    it('should create profile with custom traits', () => {
      const profile = engine.createPersonalityProfile({
        name: 'Friendly Bot',
        traits: { friendliness: 9, humor: 7 }
      });

      expect(profile.traits.friendliness).toBe(9);
      expect(profile.traits.humor).toBe(7);
      expect(profile.traits.formality).toBe(5); // Default
    });

    it('should set custom tone settings', () => {
      const profile = engine.createPersonalityProfile({
        primaryTone: 'casual',
        secondaryTone: 'humorous',
        avoidTones: ['sarcastic']
      });

      expect(profile.toneSettings.primaryTone).toBe('casual');
      expect(profile.toneSettings.secondaryTone).toBe('humorous');
      expect(profile.toneSettings.avoidTones).toContain('sarcastic');
    });

    it('should set custom response patterns', () => {
      const profile = engine.createPersonalityProfile({
        greetings: ['Howdy!', 'Welcome!'],
        farewells: ['See ya!']
      });

      expect(profile.responsePatterns.greetings).toContain('Howdy!');
      expect(profile.responsePatterns.farewells).toContain('See ya!');
    });
  });

  describe('generateSystemPrompt', () => {
    it('should generate system prompt from profile', () => {
      const profile = {
        traits: { friendliness: 8, humor: 7, empathy: 8, directness: 7, formality: 3 },
        toneSettings: { primaryTone: 'casual', secondaryTone: 'friendly', avoidTones: ['harsh'] },
        responsePatterns: { greetings: ['Hi!'], acknowledgments: ['Got it'] }
      };

      const prompt = engine.generateSystemPrompt(profile);

      expect(prompt).toContain('Personality Traits');
      expect(prompt).toContain('casual');
      expect(prompt).toContain('friendly');
      expect(prompt).toContain('warm and welcoming');
      expect(prompt).toContain('light humor');
      expect(prompt).toContain('casual, conversational language');
    });

    it('should add formal guidelines for high formality', () => {
      const profile = {
        traits: { formality: 9 },
        toneSettings: {},
        responsePatterns: {}
      };

      const prompt = engine.generateSystemPrompt(profile);

      expect(prompt).toContain('professional language');
    });
  });

  describe('getTraitLevel', () => {
    it('should return correct level descriptions', () => {
      expect(engine.getTraitLevel(1)).toBe('Very Low');
      expect(engine.getTraitLevel(3)).toBe('Low');
      expect(engine.getTraitLevel(5)).toBe('Moderate');
      expect(engine.getTraitLevel(7)).toBe('High');
      expect(engine.getTraitLevel(9)).toBe('Very High');
    });
  });

  describe('capitalizeFirst', () => {
    it('should capitalize first letter', () => {
      expect(engine.capitalizeFirst('friendliness')).toBe('Friendliness');
      expect(engine.capitalizeFirst('a')).toBe('A');
    });
  });

  describe('applyToBot', () => {
    it('should apply personality to bot', async () => {
      const mockDb = {
        query: jest.fn().mockResolvedValue({ rows: [] })
      };

      const profile = engine.createPersonalityProfile({ name: 'Test' });

      const result = await engine.applyToBot('bot-123', profile, mockDb);

      expect(result.success).toBe(true);
      expect(result.botId).toBe('bot-123');
      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const mockDb = {
        query: jest.fn().mockRejectedValue(new Error('DB Error'))
      };

      const profile = engine.createPersonalityProfile({ name: 'Test' });

      const result = await engine.applyToBot('bot-123', profile, mockDb);

      expect(result.success).toBe(false);
      expect(result.error).toContain('DB Error');
    });
  });

  describe('generateResponse', () => {
    it('should fail without AI provider', async () => {
      const profile = engine.createPersonalityProfile({ name: 'Test' });

      const result = await engine.generateResponse(profile, 'Hello');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No AI provider');
    });
  });

  describe('calculateTemperature', () => {
    it('should increase temperature for creative profiles', () => {
      const creative = engine.calculateTemperature({ traits: { creativity: 9 } });
      const standard = engine.calculateTemperature({ traits: { creativity: 5 } });

      expect(creative).toBeGreaterThan(standard);
    });

    it('should decrease temperature for formal profiles', () => {
      const formal = engine.calculateTemperature({ traits: { formality: 9 } });
      const standard = engine.calculateTemperature({ traits: { formality: 5 } });

      expect(formal).toBeLessThan(standard);
    });

    it('should stay within bounds', () => {
      const temp = engine.calculateTemperature({ traits: { creativity: 10, humor: 10 } });

      expect(temp).toBeLessThanOrEqual(1.0);
      expect(temp).toBeGreaterThanOrEqual(0.3);
    });
  });

  describe('scoreConsistency', () => {
    it('should score formal response for formal profile high', () => {
      const profile = { traits: { formality: 9, enthusiasm: 5, empathy: 5 } };
      const response = 'Therefore, I must respectfully advise regarding this matter.';

      const score = engine.scoreConsistency(response, profile);

      expect(score).toBeGreaterThan(70);
    });

    it('should score informal response for formal profile low', () => {
      const profile = { traits: { formality: 9, enthusiasm: 5, empathy: 5 } };
      const response = 'Hey yeah gonna help you with that!';

      const score = engine.scoreConsistency(response, profile);

      expect(score).toBeLessThan(70);
    });

    it('should score empathetic response for empathetic profile high', () => {
      const profile = { traits: { formality: 5, enthusiasm: 5, empathy: 9 } };
      const response = 'I understand how you feel. I really appreciate your patience.';

      const score = engine.scoreConsistency(response, profile);

      expect(score).toBeGreaterThan(70);
    });
  });

  describe('comparePersonalities', () => {
    it('should compare two profiles', () => {
      const profile1 = {
        traits: { friendliness: 8, formality: 3, enthusiasm: 7 }
      };
      const profile2 = {
        traits: { friendliness: 4, formality: 8, enthusiasm: 3 }
      };

      const comparison = engine.comparePersonalities(profile1, profile2);

      expect(comparison.similarity).toBeLessThan(70);
      expect(comparison.differences.friendliness.difference).toBe(4);
      expect(comparison.mostDifferent).toHaveLength(3);
    });

    it('should handle identical profiles', () => {
      const profile = {
        traits: { friendliness: 7, formality: 7 }
      };

      const comparison = engine.comparePersonalities(profile, profile);

      expect(comparison.similarity).toBe(100);
    });

    it('should handle missing traits', () => {
      const profile1 = { traits: { friendliness: 8 } };
      const profile2 = { traits: {} };

      const comparison = engine.comparePersonalities(profile1, profile2);

      expect(comparison.differences.friendliness.profile2).toBe(5); // Default
    });
  });

  describe('aggregateEmphasisPatterns', () => {
    it('should aggregate emphasis patterns', () => {
      const patterns = [
        { usesCapitalization: true, usesExclamations: true },
        { usesCapitalization: true, usesExclamations: false },
        { usesCapitalization: false, usesExclamations: false }
      ];

      const result = engine.aggregateEmphasisPatterns(patterns);

      expect(result.usesCapitalization).toBe(true); // 2/3
      expect(result.usesExclamations).toBe(false); // 1/3
    });

    it('should handle empty patterns', () => {
      const result = engine.aggregateEmphasisPatterns([]);
      expect(result).toEqual({});
    });
  });
});
