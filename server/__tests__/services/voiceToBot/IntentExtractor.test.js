/**
 * IntentExtractor Tests
 * Tests for intent extraction from natural language
 */

// Mock dependencies
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

jest.mock('node-fetch', () => jest.fn());

const log = require('../../../utils/logger');
const fetch = require('node-fetch');

describe('IntentExtractor', () => {
  let IntentExtractor;
  let extractor;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    delete process.env.OPENAI_API_KEY;

    IntentExtractor = require('../../../services/voiceToBot/IntentExtractor');
    extractor = new IntentExtractor();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      expect(extractor.config).toEqual({});
      expect(extractor.openaiApiKey).toBeNull();
    });

    it('should accept custom config', () => {
      const customExtractor = new IntentExtractor({
        openaiApiKey: 'custom-key'
      });

      expect(customExtractor.openaiApiKey).toBe('custom-key');
    });

    it('should use environment variable for API key', () => {
      process.env.OPENAI_API_KEY = 'env-key';

      const envExtractor = new IntentExtractor();
      expect(envExtractor.openaiApiKey).toBe('env-key');
    });
  });

  describe('extractFromText', () => {
    it('should return mock extraction without API key', async () => {
      const result = await extractor.extractFromText('Create a customer support bot');

      expect(result.success).toBe(true);
      expect(result.isDemo).toBe(true);
      expect(result.name).toBe('Customer Support Bot');
    });

    it('should return mock extraction for short text', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      jest.resetModules();
      IntentExtractor = require('../../../services/voiceToBot/IntentExtractor');
      extractor = new IntentExtractor();

      const result = await extractor.extractFromText('Hi');

      expect(result.success).toBe(true);
      expect(result.isDemo).toBe(true);
    });

    it('should return mock extraction for empty text', async () => {
      const result = await extractor.extractFromText('');

      expect(result.success).toBe(true);
      expect(result.isDemo).toBe(true);
    });

    it('should return mock extraction for null text', async () => {
      const result = await extractor.extractFromText(null);

      expect(result.success).toBe(true);
      expect(result.isDemo).toBe(true);
    });

    it('should call OpenAI API with valid text and API key', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      jest.resetModules();
      IntentExtractor = require('../../../services/voiceToBot/IntentExtractor');
      extractor = new IntentExtractor();

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: JSON.stringify({
                name: 'Support Bot',
                description: 'A helpful bot',
                category: 'support',
                intents: [],
                entities: [],
                flows: [],
                suggestedFeatures: []
              })
            }
          }],
          usage: { total_tokens: 100 }
        })
      });

      const result = await extractor.extractFromText('Create a detailed support bot for handling customer inquiries');

      expect(result.success).toBe(true);
      expect(result.name).toBe('Support Bot');
      expect(result.tokensUsed).toBe(100);
    });

    it('should include processing time in result', async () => {
      const result = await extractor.extractFromText('Create a bot');

      expect(result.processingTimeMs).toBeDefined();
      expect(typeof result.processingTimeMs).toBe('number');
    });

    it('should handle API error response', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      jest.resetModules();
      IntentExtractor = require('../../../services/voiceToBot/IntentExtractor');
      extractor = new IntentExtractor();

      fetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('API Error')
      });

      const result = await extractor.extractFromText('Create a detailed bot for customer service');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle empty API response', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      jest.resetModules();
      IntentExtractor = require('../../../services/voiceToBot/IntentExtractor');
      extractor = new IntentExtractor();

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: null } }]
        })
      });

      const result = await extractor.extractFromText('Create a detailed bot');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No response from AI');
    });

    it('should handle network error', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      jest.resetModules();
      IntentExtractor = require('../../../services/voiceToBot/IntentExtractor');
      extractor = new IntentExtractor();

      fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await extractor.extractFromText('Create a detailed bot');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      expect(log.error).toHaveBeenCalled();
    });

    it('should use custom model when specified', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      jest.resetModules();
      IntentExtractor = require('../../../services/voiceToBot/IntentExtractor');
      extractor = new IntentExtractor();

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: JSON.stringify({
                name: 'Bot',
                intents: [],
                entities: [],
                flows: []
              })
            }
          }]
        })
      });

      await extractor.extractFromText('Create a bot for testing', { model: 'gpt-3.5-turbo' });

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('gpt-3.5-turbo')
        })
      );
    });

    it('should pass language to extraction prompt', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      jest.resetModules();
      IntentExtractor = require('../../../services/voiceToBot/IntentExtractor');
      extractor = new IntentExtractor();

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: JSON.stringify({
                name: 'Bot',
                intents: [],
                entities: [],
                flows: []
              })
            }
          }]
        })
      });

      await extractor.extractFromText('Create a bot', { language: 'tr' });

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"tr"')
        })
      );
    });
  });

  describe('buildExtractionPrompt', () => {
    it('should return a prompt string', () => {
      const prompt = extractor.buildExtractionPrompt();

      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(100);
    });

    it('should include required sections', () => {
      const prompt = extractor.buildExtractionPrompt();

      expect(prompt).toContain('Bot name');
      expect(prompt).toContain('Intents');
      expect(prompt).toContain('Entities');
      expect(prompt).toContain('Flows');
      expect(prompt).toContain('JSON');
    });

    it('should include language in prompt', () => {
      const prompt = extractor.buildExtractionPrompt('tr');

      expect(prompt).toContain('"tr"');
    });

    it('should default to English', () => {
      const prompt = extractor.buildExtractionPrompt();

      expect(prompt).toContain('"en"');
    });
  });

  describe('validateExtraction', () => {
    it('should add greeting intent if missing', () => {
      const result = extractor.validateExtraction({
        intents: []
      });

      expect(result.intents.some(i => i.name === 'greeting')).toBe(true);
    });

    it('should add fallback intent if missing', () => {
      const result = extractor.validateExtraction({
        intents: []
      });

      expect(result.intents.some(i => i.name === 'fallback')).toBe(true);
    });

    it('should not duplicate greeting intent', () => {
      const result = extractor.validateExtraction({
        intents: [{
          name: 'greeting',
          displayName: 'Hello',
          examples: ['hi']
        }]
      });

      const greetingIntents = result.intents.filter(i => i.name === 'greeting');
      expect(greetingIntents.length).toBe(1);
    });

    it('should not duplicate fallback intent', () => {
      const result = extractor.validateExtraction({
        intents: [{
          name: 'fallback',
          displayName: 'Unknown',
          examples: []
        }]
      });

      const fallbackIntents = result.intents.filter(i => i.name === 'fallback');
      expect(fallbackIntents.length).toBe(1);
    });

    it('should recognize greeting variants', () => {
      const result = extractor.validateExtraction({
        intents: [{
          name: 'hello',
          displayName: 'Hello',
          examples: ['hi']
        }]
      });

      // Should not add another greeting since 'hello' is recognized as greeting
      const greetingCount = result.intents.filter(i =>
        i.name.includes('greeting') || i.name.includes('hello')
      ).length;
      expect(greetingCount).toBe(1);
    });

    it('should set default name', () => {
      const result = extractor.validateExtraction({});

      expect(result.name).toBe('My Bot');
    });

    it('should set default category', () => {
      const result = extractor.validateExtraction({});

      expect(result.category).toBe('custom');
    });

    it('should process intents correctly', () => {
      const result = extractor.validateExtraction({
        intents: [{
          name: 'Order Status',
          description: 'Check order status',
          examples: ['where is my order?'],
          responses: ['Let me check that for you.']
        }]
      });

      const orderIntent = result.intents.find(i => i.name === 'order_status');
      expect(orderIntent).toBeDefined();
      expect(orderIntent.displayName).toBe('Order Status');
    });

    it('should process entities correctly', () => {
      const result = extractor.validateExtraction({
        entities: [{
          name: 'Order ID',
          type: 'text',
          description: 'Order identifier',
          examples: ['ORD-123']
        }]
      });

      const entity = result.entities.find(e => e.name === 'order_id');
      expect(entity).toBeDefined();
      expect(entity.type).toBe('text');
    });

    it('should handle entities with missing type', () => {
      const result = extractor.validateExtraction({
        entities: [{
          name: 'test_entity'
        }]
      });

      expect(result.entities[0].type).toBe('text');
    });

    it('should process flows correctly', () => {
      const result = extractor.validateExtraction({
        flows: [{
          name: 'Main Flow',
          trigger: 'start',
          steps: ['Step 1', 'Step 2']
        }]
      });

      expect(result.flows.length).toBe(1);
      expect(result.flows[0].name).toBe('Main Flow');
      expect(result.flows[0].steps.length).toBe(2);
    });

    it('should handle flows with missing trigger', () => {
      const result = extractor.validateExtraction({
        flows: [{
          name: 'Flow',
          steps: ['Step 1']
        }]
      });

      expect(result.flows[0].trigger).toBe('');
    });

    it('should handle intents without name', () => {
      const result = extractor.validateExtraction({
        intents: [
          { name: 'valid_intent', examples: [] },
          { examples: ['no name'] }
        ]
      });

      // Should only include valid intent plus greeting and fallback
      expect(result.intents.some(i => i.name === 'valid_intent')).toBe(true);
    });

    it('should handle entities without name', () => {
      const result = extractor.validateExtraction({
        entities: [
          { name: 'valid_entity' },
          { type: 'text' }
        ]
      });

      expect(result.entities.length).toBe(1);
      expect(result.entities[0].name).toBe('valid_entity');
    });

    it('should handle flows without name', () => {
      const result = extractor.validateExtraction({
        flows: [
          { name: 'valid_flow', steps: [] },
          { steps: ['no name'] }
        ]
      });

      expect(result.flows.length).toBe(1);
      expect(result.flows[0].name).toBe('valid_flow');
    });

    it('should preserve suggested features', () => {
      const result = extractor.validateExtraction({
        suggestedFeatures: ['Feature 1', 'Feature 2']
      });

      expect(result.suggestedFeatures).toEqual(['Feature 1', 'Feature 2']);
    });

    it('should handle non-array examples', () => {
      const result = extractor.validateExtraction({
        intents: [{
          name: 'test',
          examples: 'not an array',
          responses: 'also not array'
        }]
      });

      const testIntent = result.intents.find(i => i.name === 'test');
      expect(testIntent.examples).toEqual([]);
      expect(testIntent.responses).toEqual([]);
    });

    it('should handle non-array entity examples', () => {
      const result = extractor.validateExtraction({
        entities: [{
          name: 'test_entity',
          examples: 'not array'
        }]
      });

      expect(result.entities[0].examples).toEqual([]);
    });

    it('should handle non-array flow steps', () => {
      const result = extractor.validateExtraction({
        flows: [{
          name: 'test_flow',
          steps: 'not array'
        }]
      });

      expect(result.flows[0].steps).toEqual([]);
    });
  });

  describe('normalizeIdentifier', () => {
    it('should convert to lowercase', () => {
      expect(extractor.normalizeIdentifier('Hello World')).toBe('hello_world');
    });

    it('should replace spaces with underscores', () => {
      expect(extractor.normalizeIdentifier('order status')).toBe('order_status');
    });

    it('should remove special characters', () => {
      expect(extractor.normalizeIdentifier('order-status!')).toBe('order_status');
    });

    it('should remove leading/trailing underscores', () => {
      expect(extractor.normalizeIdentifier('_hello_')).toBe('hello');
    });

    it('should truncate to 50 characters', () => {
      const longString = 'a'.repeat(100);
      expect(extractor.normalizeIdentifier(longString).length).toBe(50);
    });

    it('should handle multiple consecutive special characters', () => {
      expect(extractor.normalizeIdentifier('hello---world')).toBe('hello_world');
    });
  });

  describe('toDisplayName', () => {
    it('should convert snake_case to Title Case', () => {
      expect(extractor.toDisplayName('order_status')).toBe('Order Status');
    });

    it('should handle single word', () => {
      expect(extractor.toDisplayName('greeting')).toBe('Greeting');
    });

    it('should capitalize each word', () => {
      expect(extractor.toDisplayName('check_order_status')).toBe('Check Order Status');
    });
  });

  describe('extractFromKeywords', () => {
    it('should extract help intent from keywords', () => {
      const intents = extractor.extractFromKeywords(['help', 'support']);

      expect(intents.some(i => i.name === 'help')).toBe(true);
    });

    it('should extract purchase intent from keywords', () => {
      const intents = extractor.extractFromKeywords(['buy', 'price']);

      expect(intents.some(i => i.name === 'purchase')).toBe(true);
    });

    it('should extract booking intent from keywords', () => {
      const intents = extractor.extractFromKeywords(['book', 'appointment']);

      expect(intents.some(i => i.name === 'booking')).toBe(true);
    });

    it('should extract info intent from keywords', () => {
      const intents = extractor.extractFromKeywords(['information', 'about']);

      expect(intents.some(i => i.name === 'info')).toBe(true);
    });

    it('should extract cancel intent from keywords', () => {
      const intents = extractor.extractFromKeywords(['cancel', 'refund']);

      expect(intents.some(i => i.name === 'cancel')).toBe(true);
    });

    it('should extract contact intent from keywords', () => {
      const intents = extractor.extractFromKeywords(['contact', 'email']);

      expect(intents.some(i => i.name === 'contact')).toBe(true);
    });

    it('should extract status intent from keywords', () => {
      const intents = extractor.extractFromKeywords(['status', 'track']);

      expect(intents.some(i => i.name === 'status')).toBe(true);
    });

    it('should return empty array for no matches', () => {
      const intents = extractor.extractFromKeywords(['random', 'words']);

      expect(intents).toEqual([]);
    });

    it('should calculate confidence based on matches', () => {
      const intents = extractor.extractFromKeywords(['help', 'support', 'assist', 'problem', 'issue']);

      const helpIntent = intents.find(i => i.name === 'help');
      expect(helpIntent.confidence).toBe(1);
    });

    it('should include matched keywords', () => {
      const intents = extractor.extractFromKeywords(['help', 'support']);

      const helpIntent = intents.find(i => i.name === 'help');
      expect(helpIntent.matchedKeywords).toContain('help');
      expect(helpIntent.matchedKeywords).toContain('support');
    });

    it('should sort by confidence descending', () => {
      const intents = extractor.extractFromKeywords(['help', 'support', 'buy']);

      expect(intents[0].confidence).toBeGreaterThanOrEqual(intents[intents.length - 1].confidence);
    });

    it('should be case-insensitive', () => {
      const intents = extractor.extractFromKeywords(['HELP', 'Support', 'ASSIST']);

      expect(intents.some(i => i.name === 'help')).toBe(true);
    });

    it('should match partial keywords', () => {
      const intents = extractor.extractFromKeywords(['helpful', 'supportive']);

      expect(intents.some(i => i.name === 'help')).toBe(true);
    });
  });

  describe('suggestEntities', () => {
    it('should suggest entities for purchase intent', () => {
      const entities = extractor.suggestEntities([{ name: 'purchase' }]);

      expect(entities.some(e => e.name === 'product_name')).toBe(true);
      expect(entities.some(e => e.name === 'quantity')).toBe(true);
      expect(entities.some(e => e.name === 'price')).toBe(true);
    });

    it('should suggest entities for booking intent', () => {
      const entities = extractor.suggestEntities([{ name: 'booking' }]);

      expect(entities.some(e => e.name === 'date')).toBe(true);
      expect(entities.some(e => e.name === 'time')).toBe(true);
      expect(entities.some(e => e.name === 'service')).toBe(true);
    });

    it('should suggest entities for contact intent', () => {
      const entities = extractor.suggestEntities([{ name: 'contact' }]);

      expect(entities.some(e => e.name === 'email')).toBe(true);
      expect(entities.some(e => e.name === 'phone')).toBe(true);
      expect(entities.some(e => e.name === 'name')).toBe(true);
    });

    it('should suggest entities for status intent', () => {
      const entities = extractor.suggestEntities([{ name: 'status' }]);

      expect(entities.some(e => e.name === 'order_id')).toBe(true);
      expect(entities.some(e => e.name === 'tracking_number')).toBe(true);
    });

    it('should not duplicate entities for multiple intents', () => {
      const entities = extractor.suggestEntities([
        { name: 'contact' },
        { name: 'contact' }
      ]);

      const emailEntities = entities.filter(e => e.name === 'email');
      expect(emailEntities.length).toBe(1);
    });

    it('should return empty array for unknown intents', () => {
      const entities = extractor.suggestEntities([{ name: 'unknown' }]);

      expect(entities).toEqual([]);
    });

    it('should include correct entity types', () => {
      const entities = extractor.suggestEntities([
        { name: 'booking' },
        { name: 'contact' }
      ]);

      const dateEntity = entities.find(e => e.name === 'date');
      expect(dateEntity.type).toBe('date');

      const emailEntity = entities.find(e => e.name === 'email');
      expect(emailEntity.type).toBe('email');
    });
  });

  describe('generateDefaultFlow', () => {
    it('should always include main flow', () => {
      const flows = extractor.generateDefaultFlow([], []);

      expect(flows.some(f => f.name === 'main_flow')).toBe(true);
    });

    it('should include steps in main flow', () => {
      const flows = extractor.generateDefaultFlow([], []);
      const mainFlow = flows.find(f => f.name === 'main_flow');

      expect(mainFlow.steps.length).toBeGreaterThan(0);
      expect(mainFlow.trigger).toBe('conversation_start');
    });

    it('should create flow for each non-system intent', () => {
      const intents = [
        { name: 'greeting', displayName: 'Greeting' },
        { name: 'order_status', displayName: 'Order Status' },
        { name: 'fallback', displayName: 'Fallback' }
      ];

      const flows = extractor.generateDefaultFlow(intents, []);

      expect(flows.some(f => f.name === 'order_status_flow')).toBe(true);
      expect(flows.some(f => f.name === 'greeting_flow')).toBe(false);
      expect(flows.some(f => f.name === 'fallback_flow')).toBe(false);
    });

    it('should set correct trigger for intent flows', () => {
      const intents = [{ name: 'purchase', displayName: 'Purchase' }];
      const flows = extractor.generateDefaultFlow(intents, []);

      const purchaseFlow = flows.find(f => f.name === 'purchase_flow');
      expect(purchaseFlow.trigger).toBe('intent:purchase');
    });

    it('should include display name in flow steps', () => {
      const intents = [{ name: 'order_check', displayName: 'Order Check' }];
      const flows = extractor.generateDefaultFlow(intents, []);

      const orderFlow = flows.find(f => f.name === 'order_check_flow');
      expect(orderFlow.steps[0]).toContain('Order Check');
    });
  });

  describe('getMockExtraction', () => {
    it('should return successful mock extraction', () => {
      const startTime = Date.now();
      const result = extractor.getMockExtraction('en', startTime);

      expect(result.success).toBe(true);
      expect(result.isDemo).toBe(true);
    });

    it('should include all required fields', () => {
      const result = extractor.getMockExtraction('en', Date.now());

      expect(result.name).toBeDefined();
      expect(result.description).toBeDefined();
      expect(result.category).toBeDefined();
      expect(result.intents).toBeDefined();
      expect(result.entities).toBeDefined();
      expect(result.flows).toBeDefined();
      expect(result.suggestedFeatures).toBeDefined();
    });

    it('should include greeting and fallback intents', () => {
      const result = extractor.getMockExtraction('en', Date.now());

      expect(result.intents.some(i => i.name === 'greeting')).toBe(true);
      expect(result.intents.some(i => i.name === 'fallback')).toBe(true);
    });

    it('should include processing time', () => {
      const startTime = Date.now() - 100;
      const result = extractor.getMockExtraction('en', startTime);

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should set tokensUsed to 0', () => {
      const result = extractor.getMockExtraction('en', Date.now());

      expect(result.tokensUsed).toBe(0);
    });

    it('should use provided language', () => {
      const result = extractor.getMockExtraction('tr', Date.now());

      expect(result.language).toBe('tr');
    });

    it('should default to en for undefined language', () => {
      const result = extractor.getMockExtraction(undefined, Date.now());

      expect(result.language).toBe('en');
    });

    it('should log demo mode usage', () => {
      extractor.getMockExtraction('en', Date.now());

      expect(log.info).toHaveBeenCalledWith(
        'Using mock extraction (demo mode)',
        expect.any(Object)
      );
    });

    it('should include sample entities', () => {
      const result = extractor.getMockExtraction('en', Date.now());

      expect(result.entities.length).toBeGreaterThan(0);
      expect(result.entities.some(e => e.name === 'order_id')).toBe(true);
    });

    it('should include sample flows', () => {
      const result = extractor.getMockExtraction('en', Date.now());

      expect(result.flows.length).toBeGreaterThan(0);
      expect(result.flows[0].name).toBe('main_flow');
    });

    it('should include practical intents', () => {
      const result = extractor.getMockExtraction('en', Date.now());

      expect(result.intents.some(i => i.name === 'faq')).toBe(true);
      expect(result.intents.some(i => i.name === 'order_status')).toBe(true);
      expect(result.intents.some(i => i.name === 'returns')).toBe(true);
    });

    it('should include example responses for intents', () => {
      const result = extractor.getMockExtraction('en', Date.now());

      const greeting = result.intents.find(i => i.name === 'greeting');
      expect(greeting.responses.length).toBeGreaterThan(0);
    });
  });
});
