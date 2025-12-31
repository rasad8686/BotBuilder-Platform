/**
 * BotGenerator Tests
 * Tests for bot generation from extracted intents
 */

jest.mock('../../../db', () => ({
  query: jest.fn(),
  pool: {
    connect: jest.fn()
  }
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../../db');
const BotGenerator = require('../../../services/voiceToBot/BotGenerator');

describe('BotGenerator', () => {
  let botGenerator;
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    botGenerator = new BotGenerator();

    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };

    db.pool.connect.mockResolvedValue(mockClient);
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const generator = new BotGenerator();
      expect(generator.config).toEqual({});
    });

    it('should initialize with custom config', () => {
      const config = { customOption: true };
      const generator = new BotGenerator(config);
      expect(generator.config).toEqual(config);
    });
  });

  describe('generateBot', () => {
    const extractedData = {
      name: 'Support Bot',
      description: 'Customer support bot',
      category: 'support',
      language: 'en',
      intents: [
        { name: 'greeting', examples: ['hi'], responses: ['Hello!'] }
      ],
      entities: [{ name: 'product', type: 'text' }]
    };

    it('should generate bot successfully', async () => {
      const mockBot = { id: 'bot-1', name: 'Support Bot' };

      mockClient.query.mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [mockBot] }) // INSERT bot
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await botGenerator.generateBot(extractedData, 'user-1', 1);

      expect(result.success).toBe(true);
      expect(result.bot).toBeDefined();
      expect(result.processingTimeMs).toBeDefined();
    });

    it('should return error for invalid extracted data', async () => {
      const result = await botGenerator.generateBot(null, 'user-1', 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid extracted data');
    });

    it('should return error for missing name', async () => {
      const result = await botGenerator.generateBot({}, 'user-1', 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid extracted data');
    });

    it('should rollback on database error', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('DB error'));

      const result = await botGenerator.generateBot(extractedData, 'user-1', 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('DB error');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should use options language if provided', async () => {
      const mockBot = { id: 'bot-1', name: 'Test' };
      mockClient.query.mockResolvedValue({ rows: [mockBot] });

      await botGenerator.generateBot(
        { name: 'Test' },
        'user-1',
        1,
        { language: 'fr' }
      );

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO bots'),
        expect.arrayContaining(['fr'])
      );
    });

    it('should include intents and entities in response', async () => {
      const mockBot = { id: 'bot-1' };
      mockClient.query.mockResolvedValue({ rows: [mockBot] });

      const result = await botGenerator.generateBot(extractedData, 'user-1', 1);

      expect(result.intents).toEqual(extractedData.intents);
      expect(result.entities).toEqual(extractedData.entities);
    });

    it('should release client on success', async () => {
      mockClient.query.mockResolvedValue({ rows: [{ id: 'bot-1' }] });

      await botGenerator.generateBot(extractedData, 'user-1', 1);

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should release client on error', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] })
        .mockRejectedValueOnce(new Error('Error'));

      await botGenerator.generateBot(extractedData, 'user-1', 1);

      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('generateBotSettings', () => {
    it('should generate settings with defaults', () => {
      const settings = botGenerator.generateBotSettings({});

      expect(settings.language).toBe('en');
      expect(settings.timezone).toBe('UTC');
      expect(settings.fallbackMessage).toBeDefined();
      expect(settings.features.nlu).toBe(true);
    });

    it('should use extracted data language', () => {
      const settings = botGenerator.generateBotSettings({ language: 'es' });

      expect(settings.language).toBe('es');
    });

    it('should enable entity extraction if entities exist', () => {
      const settings = botGenerator.generateBotSettings({
        entities: [{ name: 'email' }]
      });

      expect(settings.features.entityExtraction).toBe(true);
    });

    it('should disable entity extraction if no entities', () => {
      const settings = botGenerator.generateBotSettings({
        entities: []
      });

      expect(settings.features.entityExtraction).toBe(false);
    });

    it('should include suggested features', () => {
      const settings = botGenerator.generateBotSettings({
        suggestedFeatures: ['live chat', 'analytics']
      });

      expect(settings.suggestedFeatures).toEqual(['live chat', 'analytics']);
    });
  });

  describe('generateWelcomeMessage', () => {
    it('should generate support message', () => {
      const message = botGenerator.generateWelcomeMessage({
        name: 'Helper',
        category: 'support'
      });

      expect(message).toContain('Helper');
      expect(message).toContain('support');
    });

    it('should generate sales message', () => {
      const message = botGenerator.generateWelcomeMessage({
        name: 'Sales Bot',
        category: 'sales'
      });

      expect(message).toContain('Sales Bot');
      expect(message).toContain('looking for');
    });

    it('should generate faq message', () => {
      const message = botGenerator.generateWelcomeMessage({
        name: 'FAQ Bot',
        category: 'faq'
      });

      expect(message).toContain('FAQ Bot');
      expect(message).toContain('questions');
    });

    it('should generate booking message', () => {
      const message = botGenerator.generateWelcomeMessage({
        name: 'Booking Bot',
        category: 'booking'
      });

      expect(message).toContain('Booking Bot');
      expect(message).toContain('schedule');
    });

    it('should generate custom message for unknown category', () => {
      const message = botGenerator.generateWelcomeMessage({
        name: 'Custom Bot',
        category: 'unknown'
      });

      expect(message).toContain('Custom Bot');
      expect(message).toContain('assist');
    });

    it('should use custom category if no category specified', () => {
      const message = botGenerator.generateWelcomeMessage({
        name: 'Bot'
      });

      expect(message).toContain('Bot');
    });
  });

  describe('generateFlowNodes', () => {
    it('should generate basic nodes structure', () => {
      const nodes = botGenerator.generateFlowNodes({
        intents: []
      });

      expect(nodes.length).toBeGreaterThan(0);
      expect(nodes.find(n => n.id === 'start')).toBeDefined();
      expect(nodes.find(n => n.id === 'welcome')).toBeDefined();
      expect(nodes.find(n => n.id === 'router')).toBeDefined();
      expect(nodes.find(n => n.id === 'fallback')).toBeDefined();
      expect(nodes.find(n => n.id === 'end')).toBeDefined();
    });

    it('should generate intent handler nodes', () => {
      const nodes = botGenerator.generateFlowNodes({
        intents: [
          { name: 'help', displayName: 'Help', responses: ['How can I help?'] },
          { name: 'goodbye', displayName: 'Goodbye', responses: ['Bye!'] }
        ]
      });

      expect(nodes.find(n => n.id === 'handler_help')).toBeDefined();
      expect(nodes.find(n => n.id === 'handler_goodbye')).toBeDefined();
    });

    it('should skip fallback intent handler', () => {
      const nodes = botGenerator.generateFlowNodes({
        intents: [
          { name: 'fallback', displayName: 'Fallback' }
        ]
      });

      expect(nodes.find(n => n.id === 'handler_fallback')).toBeUndefined();
    });

    it('should position nodes correctly', () => {
      const nodes = botGenerator.generateFlowNodes({
        intents: []
      });

      const start = nodes.find(n => n.id === 'start');
      const welcome = nodes.find(n => n.id === 'welcome');

      expect(start.position.y).toBeLessThan(welcome.position.y);
    });

    it('should include intent names in router', () => {
      const nodes = botGenerator.generateFlowNodes({
        intents: [
          { name: 'help' },
          { name: 'info' }
        ]
      });

      const router = nodes.find(n => n.id === 'router');
      expect(router.data.intents).toContain('help');
      expect(router.data.intents).toContain('info');
    });
  });

  describe('generateFlowEdges', () => {
    it('should generate basic edges structure', () => {
      const edges = botGenerator.generateFlowEdges({
        intents: []
      });

      expect(edges.find(e => e.source === 'start' && e.target === 'welcome')).toBeDefined();
      expect(edges.find(e => e.source === 'welcome' && e.target === 'router')).toBeDefined();
      expect(edges.find(e => e.source === 'router' && e.target === 'fallback')).toBeDefined();
      expect(edges.find(e => e.source === 'fallback' && e.target === 'router')).toBeDefined();
    });

    it('should generate edges for intents', () => {
      const edges = botGenerator.generateFlowEdges({
        intents: [
          { name: 'help' },
          { name: 'info' }
        ]
      });

      expect(edges.find(e => e.source === 'router' && e.target === 'handler_help')).toBeDefined();
      expect(edges.find(e => e.source === 'handler_help' && e.target === 'end')).toBeDefined();
      expect(edges.find(e => e.source === 'router' && e.target === 'handler_info')).toBeDefined();
    });

    it('should skip fallback intent edges', () => {
      const edges = botGenerator.generateFlowEdges({
        intents: [
          { name: 'fallback' }
        ]
      });

      expect(edges.find(e => e.target === 'handler_fallback')).toBeUndefined();
    });

    it('should label intent edges', () => {
      const edges = botGenerator.generateFlowEdges({
        intents: [{ name: 'help' }]
      });

      const helpEdge = edges.find(e => e.target === 'handler_help');
      expect(helpEdge.label).toBe('help');
      expect(helpEdge.type).toBe('intent');
    });
  });

  describe('previewBot', () => {
    it('should generate preview without saving', () => {
      const preview = botGenerator.previewBot({
        name: 'Preview Bot',
        description: 'Test',
        category: 'support',
        intents: [
          { name: 'help', displayName: 'Help', examples: ['help me'], responses: ['Sure!'] }
        ],
        entities: [{ name: 'email', type: 'email' }]
      });

      expect(preview.name).toBe('Preview Bot');
      expect(preview.settings).toBeDefined();
      expect(preview.intents[0].exampleCount).toBe(1);
      expect(preview.intents[0].responseCount).toBe(1);
      expect(preview.entities[0].name).toBe('email');
      expect(preview.flowPreview.nodeCount).toBeGreaterThan(0);
    });

    it('should handle missing data gracefully', () => {
      const preview = botGenerator.previewBot({
        name: 'Minimal Bot'
      });

      expect(preview.name).toBe('Minimal Bot');
      expect(preview.intents).toBeUndefined();
      expect(preview.entities).toBeUndefined();
    });
  });

  describe('updateBot', () => {
    it('should update bot successfully', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'bot-1' }] }) // Verify ownership
        .mockResolvedValue({ rows: [] });

      const result = await botGenerator.updateBot('bot-1', { name: 'Updated' }, 'user-1');

      expect(result.success).toBe(true);
      expect(result.botId).toBe('bot-1');
    });

    it('should return error if bot not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await botGenerator.updateBot('nonexistent', { name: 'Test' }, 'user-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Bot not found or access denied');
    });

    it('should update name if option set', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'bot-1' }] })
        .mockResolvedValue({ rows: [] });

      await botGenerator.updateBot(
        'bot-1',
        { name: 'New Name' },
        'user-1',
        { updateName: true }
      );

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE bots'),
        expect.arrayContaining(['New Name'])
      );
    });

    it('should add new intents if option set', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'bot-1' }] }) // Ownership check
        .mockResolvedValueOnce({ rows: [] }) // Update bots
        .mockResolvedValueOnce({ rows: [] }) // Check existing intent
        .mockResolvedValue({ rows: [] }); // Insert intent

      await botGenerator.updateBot(
        'bot-1',
        {
          intents: [{ name: 'new_intent', examples: ['test'], responses: ['ok'] }]
        },
        'user-1',
        { addIntents: true }
      );

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO intents'),
        expect.any(Array)
      );
    });

    it('should skip existing intents', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'bot-1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'existing-intent' }] }); // Intent exists

      await botGenerator.updateBot(
        'bot-1',
        { intents: [{ name: 'existing' }] },
        'user-1',
        { addIntents: true }
      );

      // Should not call INSERT for existing intent
      expect(db.query).not.toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO intents'),
        expect.any(Array)
      );
    });

    it('should add new entities if option set', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'bot-1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }) // Entity check
        .mockResolvedValue({ rows: [] });

      await botGenerator.updateBot(
        'bot-1',
        { entities: [{ name: 'new_entity', type: 'text' }] },
        'user-1',
        { addEntities: true }
      );

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO entities'),
        expect.any(Array)
      );
    });

    it('should handle update error', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'bot-1' }] })
        .mockRejectedValueOnce(new Error('Update failed'));

      const result = await botGenerator.updateBot('bot-1', { name: 'Test' }, 'user-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });

  describe('getTemplates', () => {
    it('should return templates successfully', async () => {
      const mockTemplates = [
        { id: 1, name: 'Support' },
        { id: 2, name: 'Sales' }
      ];
      db.query.mockResolvedValue({ rows: mockTemplates });

      const result = await botGenerator.getTemplates();

      expect(result.success).toBe(true);
      expect(result.templates).toEqual(mockTemplates);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      const result = await botGenerator.getTemplates();

      expect(result.success).toBe(false);
      expect(result.error).toBe('DB error');
    });
  });

  describe('getTemplate', () => {
    it('should return template and increment usage', async () => {
      const mockTemplate = { id: 1, name: 'Support Template' };
      db.query.mockResolvedValueOnce({ rows: [mockTemplate] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await botGenerator.getTemplate(1);

      expect(result.success).toBe(true);
      expect(result.template).toEqual(mockTemplate);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('usage_count = usage_count + 1'),
        [1]
      );
    });

    it('should return error if template not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await botGenerator.getTemplate(999);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Template not found');
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      const result = await botGenerator.getTemplate(1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('DB error');
    });
  });
});
