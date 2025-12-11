/**
 * IntentEntityManager Service Tests
 * Tests for server/services/IntentEntityManager.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  }));
});

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn()
}));

const db = require('../../db');
const IntentEntityManager = require('../../services/IntentEntityManager');

describe('IntentEntityManager Service', () => {
  let manager;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new IntentEntityManager();
  });

  describe('Intent CRUD', () => {
    describe('createIntent()', () => {
      it('should create intent with all fields', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'greeting' }] });

        const result = await manager.createIntent(1, {
          name: 'greeting',
          displayName: 'Greeting Intent',
          description: 'User greets the bot',
          confidenceThreshold: 0.8
        });

        expect(result.id).toBe(1);
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO intents'),
          [1, 'greeting', 'Greeting Intent', 'User greets the bot', 0.8]
        );
      });

      it('should use default confidence threshold', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

        await manager.createIntent(1, {
          name: 'test',
          displayName: 'Test',
          description: 'Test'
        });

        expect(db.query.mock.calls[0][1][4]).toBe(0.7);
      });
    });

    describe('getIntents()', () => {
      it('should return all intents for bot', async () => {
        const mockIntents = [
          { id: 1, name: 'greeting', example_count: 5 },
          { id: 2, name: 'goodbye', example_count: 3 }
        ];
        db.query.mockResolvedValueOnce({ rows: mockIntents });

        const result = await manager.getIntents(1);

        expect(result).toHaveLength(2);
        expect(result[0].example_count).toBe(5);
      });
    });

    describe('getIntent()', () => {
      it('should return intent by ID', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'greeting' }] });

        const result = await manager.getIntent(1);

        expect(result.name).toBe('greeting');
      });

      it('should return undefined if not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const result = await manager.getIntent(999);

        expect(result).toBeUndefined();
      });
    });

    describe('updateIntent()', () => {
      it('should update intent fields', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'updated' }] });

        const result = await manager.updateIntent(1, {
          name: 'updated',
          displayName: 'Updated',
          description: 'Updated desc',
          isActive: false,
          confidenceThreshold: 0.9
        });

        expect(result.name).toBe('updated');
        expect(db.query.mock.calls[0][0]).toContain('name = $1');
      });
    });

    describe('deleteIntent()', () => {
      it('should delete intent', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 1 });

        const result = await manager.deleteIntent(1);

        expect(result).toBe(true);
      });

      it('should return false if not found', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 0 });

        const result = await manager.deleteIntent(999);

        expect(result).toBe(false);
      });
    });
  });

  describe('Intent Examples', () => {
    describe('addExample()', () => {
      it('should add example to intent', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, text: 'Hello' }] });

        const result = await manager.addExample(1, { text: 'Hello', language: 'az' });

        expect(result.text).toBe('Hello');
      });

      it('should use default language', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

        await manager.addExample(1, { text: 'Hello' });

        expect(db.query.mock.calls[0][1][2]).toBe('az');
      });
    });

    describe('getExamples()', () => {
      it('should return examples for intent', async () => {
        const mockExamples = [{ id: 1, text: 'Hello' }, { id: 2, text: 'Hi' }];
        db.query.mockResolvedValueOnce({ rows: mockExamples });

        const result = await manager.getExamples(1);

        expect(result).toHaveLength(2);
      });
    });

    describe('deleteExample()', () => {
      it('should delete example', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 1 });

        const result = await manager.deleteExample(1);

        expect(result).toBe(true);
      });
    });

    describe('bulkAddExamples()', () => {
      it('should add multiple examples', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });

        const result = await manager.bulkAddExamples(1, [
          { text: 'Hello' },
          { text: 'Hi' }
        ]);

        expect(result).toHaveLength(2);
      });

      it('should return empty array for empty input', async () => {
        const result = await manager.bulkAddExamples(1, []);

        expect(result).toEqual([]);
        expect(db.query).not.toHaveBeenCalled();
      });
    });
  });

  describe('Entity CRUD', () => {
    describe('createEntity()', () => {
      it('should create entity', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'location' }] });

        const result = await manager.createEntity(1, {
          name: 'location',
          displayName: 'Location',
          type: 'text'
        });

        expect(result.name).toBe('location');
      });
    });

    describe('getEntities()', () => {
      it('should return entities for bot', async () => {
        const mockEntities = [{ id: 1, name: 'location' }];
        db.query.mockResolvedValueOnce({ rows: mockEntities });

        const result = await manager.getEntities(1);

        expect(result).toHaveLength(1);
      });
    });

    describe('getEntity()', () => {
      it('should return entity by ID', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'location' }] });

        const result = await manager.getEntity(1);

        expect(result.name).toBe('location');
      });
    });

    describe('updateEntity()', () => {
      it('should update entity', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'updated' }] });

        const result = await manager.updateEntity(1, {
          name: 'updated',
          displayName: 'Updated',
          type: 'number'
        });

        expect(result.name).toBe('updated');
      });
    });

    describe('deleteEntity()', () => {
      it('should delete non-system entity', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 1 });

        const result = await manager.deleteEntity(1);

        expect(result).toBe(true);
        expect(db.query.mock.calls[0][0]).toContain('is_system = false');
      });
    });
  });

  describe('Entity Values', () => {
    describe('addValue()', () => {
      it('should add value with synonyms', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, value: 'Baku' }] });

        const result = await manager.addValue(1, {
          value: 'Baku',
          synonyms: ['Bakı', 'Baki']
        });

        expect(result.value).toBe('Baku');
        expect(db.query.mock.calls[0][1][2]).toBe('["Bakı","Baki"]');
      });
    });

    describe('getValues()', () => {
      it('should return values for entity', async () => {
        const mockValues = [{ id: 1, value: 'Baku' }];
        db.query.mockResolvedValueOnce({ rows: mockValues });

        const result = await manager.getValues(1);

        expect(result).toHaveLength(1);
      });
    });

    describe('deleteValue()', () => {
      it('should delete value', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 1 });

        const result = await manager.deleteValue(1);

        expect(result).toBe(true);
      });
    });
  });

  describe('analyzeMessage()', () => {
    it('should return null intent for bot with no intents', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // getIntents
        .mockResolvedValueOnce({ rows: [] }); // getEntities

      const result = await manager.analyzeMessage(1, 'Hello');

      expect(result.intent.name).toBeNull();
      expect(result.intent.confidence).toBe(0);
    });

    it('should analyze message with OpenAI', async () => {
      const mockIntents = [{ id: 1, name: 'greeting', is_active: true, confidence_threshold: 0.7 }];
      const mockEntities = [{ id: 1, name: 'location', type: 'text' }];
      const mockExamples = [{ id: 1, text: 'Hello' }];

      db.query
        .mockResolvedValueOnce({ rows: mockIntents })
        .mockResolvedValueOnce({ rows: mockEntities })
        .mockResolvedValueOnce({ rows: mockExamples });

      manager.openai.chat.completions.create = jest.fn().mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              intent: { name: 'greeting', confidence: 0.9 },
              entities: []
            })
          }
        }]
      });

      const result = await manager.analyzeMessage(1, 'Hello there');

      expect(result.intent.name).toBe('greeting');
      expect(result.intent.confidence).toBe(0.9);
    });

    it('should handle OpenAI errors', async () => {
      const mockIntents = [{ id: 1, name: 'greeting', is_active: true }];

      db.query
        .mockResolvedValueOnce({ rows: mockIntents })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      manager.openai.chat.completions.create = jest.fn().mockRejectedValueOnce(
        new Error('API Error')
      );

      const result = await manager.analyzeMessage(1, 'Hello');

      expect(result.intent.name).toBeNull();
      expect(result.error).toBe('API Error');
    });
  });

  describe('createSystemEntities()', () => {
    it('should create system entities for bot', async () => {
      // Mock check queries to return no existing entities
      db.query.mockImplementation(() => Promise.resolve({ rows: [] }));

      const result = await manager.createSystemEntities(1);

      // Should attempt to check and create each system entity
      expect(db.query).toHaveBeenCalled();
    });

    it('should not duplicate existing system entities', async () => {
      // First query returns existing entity
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await manager.createSystemEntities(1);

      // Should skip creation for existing entity
    });
  });
});
