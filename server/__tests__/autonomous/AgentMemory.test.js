/**
 * AgentMemory Test Suite
 */

const AgentMemory = require('../../services/autonomous/AgentMemory');

// Mock dependencies
jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../db');

describe('AgentMemory', () => {
  let memory;
  const testAgentId = 1;

  beforeEach(() => {
    memory = new AgentMemory(testAgentId);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct agentId', () => {
      expect(memory.agentId).toBe(testAgentId);
    });

    it('should initialize empty short-term memory', () => {
      expect(memory.shortTermMemory).toEqual([]);
    });

    it('should initialize empty working memory', () => {
      expect(memory.workingMemory).toEqual({});
    });
  });

  describe('store', () => {
    it('should store a memory successfully', async () => {
      const mockResult = {
        rows: [{
          id: 1,
          agent_id: testAgentId,
          content: 'Test content',
          memory_type: 'short_term',
          importance: 2,
          tags: '[]',
          metadata: '{}',
          access_count: 0
        }]
      };

      db.query.mockResolvedValueOnce(mockResult);

      const stored = await memory.store('Test content');

      expect(db.query).toHaveBeenCalled();
      expect(stored.content).toBe('Test content');
    });

    it('should add to short-term cache for short_term type', async () => {
      const mockResult = {
        rows: [{
          id: 1,
          content: 'Test',
          memory_type: 'short_term',
          tags: '[]',
          metadata: '{}'
        }]
      };

      db.query.mockResolvedValueOnce(mockResult);

      await memory.store('Test', { type: 'short_term' });

      expect(memory.shortTermMemory.length).toBe(1);
    });

    it('should accept custom options', async () => {
      const mockResult = {
        rows: [{
          id: 1,
          content: 'Important',
          memory_type: 'long_term',
          importance: 4,
          tags: '["important"]',
          metadata: '{"source": "test"}'
        }]
      };

      db.query.mockResolvedValueOnce(mockResult);

      const stored = await memory.store('Important', {
        type: 'long_term',
        importance: 4,
        tags: ['important'],
        metadata: { source: 'test' }
      });

      expect(stored.memory_type).toBe('long_term');
    });
  });

  describe('retrieve', () => {
    it('should retrieve memories matching query', async () => {
      const mockResult = {
        rows: [
          { id: 1, content: 'Test 1', tags: '[]', metadata: '{}' },
          { id: 2, content: 'Test 2', tags: '[]', metadata: '{}' }
        ]
      };

      db.query
        .mockResolvedValueOnce(mockResult)
        .mockResolvedValueOnce({ rows: [] }); // For access count update

      const memories = await memory.retrieve('Test');

      expect(memories.length).toBe(2);
    });

    it('should filter by type', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await memory.retrieve(null, { type: 'long_term' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('memory_type'),
        expect.arrayContaining(['long_term'])
      );
    });

    it('should respect limit option', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await memory.retrieve(null, { limit: 5 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([5])
      );
    });
  });

  describe('working memory', () => {
    it('should set and get working memory', () => {
      memory.setWorkingMemory('key1', 'value1');

      expect(memory.getWorkingMemory('key1')).toBe('value1');
    });

    it('should return null for non-existent key', () => {
      expect(memory.getWorkingMemory('nonexistent')).toBeNull();
    });

    it('should clear working memory', () => {
      memory.setWorkingMemory('key1', 'value1');
      memory.setWorkingMemory('key2', 'value2');

      memory.clearWorkingMemory();

      expect(memory.workingMemory).toEqual({});
    });
  });

  describe('consolidate', () => {
    it('should consolidate high importance memories', async () => {
      memory.shortTermMemory = [
        { id: 1, importance: 4, access_count: 1 },
        { id: 2, importance: 2, access_count: 1 },
        { id: 3, importance: 2, access_count: 5 }
      ];

      db.query.mockResolvedValue({ rows: [] });

      const consolidated = await memory.consolidate();

      expect(consolidated).toBe(2); // id 1 (high importance) and id 3 (high access count)
    });
  });

  describe('createEpisode', () => {
    it('should create episode memory', async () => {
      const mockResult = {
        rows: [{
          id: 1,
          content: '{}',
          memory_type: 'episodic',
          tags: '["episode", "success"]',
          metadata: '{"taskId": 123}'
        }]
      };

      db.query.mockResolvedValueOnce(mockResult);

      const episode = await memory.createEpisode(123, {
        summary: 'Task completed',
        steps: [1, 2, 3],
        outcome: 'success'
      });

      expect(episode).toBeTruthy();
    });
  });

  describe('storeProcedure', () => {
    it('should store procedural memory', async () => {
      const mockResult = {
        rows: [{
          id: 1,
          content: '{"name": "test", "steps": []}',
          memory_type: 'procedural',
          tags: '["procedure", "test"]',
          metadata: '{}'
        }]
      };

      db.query.mockResolvedValueOnce(mockResult);

      const procedure = await memory.storeProcedure('test', [
        { action: 'step1' },
        { action: 'step2' }
      ]);

      expect(procedure).toBeTruthy();
    });
  });

  describe('storeFact', () => {
    it('should store semantic memory', async () => {
      const mockResult = {
        rows: [{
          id: 1,
          content: '{"subject": "AI", "predicate": "is", "object": "intelligent"}',
          memory_type: 'semantic',
          tags: '["fact", "AI"]',
          metadata: '{"predicate": "is"}'
        }]
      };

      db.query.mockResolvedValueOnce(mockResult);

      const fact = await memory.storeFact('AI', 'is', 'intelligent');

      expect(fact).toBeTruthy();
    });
  });

  describe('forget', () => {
    it('should delete old low-importance memories', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });

      const forgotten = await memory.forget({ olderThan: 30 });

      expect(forgotten).toBe(2);
    });
  });

  describe('getStats', () => {
    it('should return memory statistics', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [
            { memory_type: 'short_term', count: '10', avg_importance: '2', avg_access_count: '3' },
            { memory_type: 'long_term', count: '5', avg_importance: '3', avg_access_count: '5' }
          ]
        })
        .mockResolvedValueOnce({
          rows: [{ total: '15' }]
        });

      const stats = await memory.getStats();

      expect(stats.total).toBe(15);
      expect(stats.byType).toBeDefined();
    });
  });

  describe('cosineSimilarity', () => {
    it('should calculate similarity between identical vectors', () => {
      const a = [1, 0, 0];
      const b = [1, 0, 0];

      const similarity = memory.cosineSimilarity(a, b);

      expect(similarity).toBeCloseTo(1);
    });

    it('should calculate similarity between orthogonal vectors', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];

      const similarity = memory.cosineSimilarity(a, b);

      expect(similarity).toBeCloseTo(0);
    });

    it('should return 0 for null vectors', () => {
      expect(memory.cosineSimilarity(null, [1, 2])).toBe(0);
      expect(memory.cosineSimilarity([1, 2], null)).toBe(0);
    });

    it('should return 0 for different length vectors', () => {
      expect(memory.cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    });
  });

  describe('enforceCapacity', () => {
    it('should remove excess memories based on importance', () => {
      // Add more than capacity
      for (let i = 0; i < 150; i++) {
        memory.shortTermMemory.push({
          id: i,
          importance: i % 4,
          created_at: new Date()
        });
      }

      memory.enforceCapacity();

      expect(memory.shortTermMemory.length).toBeLessThanOrEqual(AgentMemory.CONFIG.shortTermCapacity);
    });
  });

  describe('getContext', () => {
    it('should return context for decision making', async () => {
      memory.shortTermMemory = [
        { id: 1, content: 'Recent 1' },
        { id: 2, content: 'Recent 2' }
      ];

      memory.workingMemory = { current_task: 'test' };

      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const context = await memory.getContext('test query');

      expect(context.recent).toBeDefined();
      expect(context.working).toBeDefined();
    });
  });

  describe('parseMemory', () => {
    it('should parse JSON content', () => {
      const row = {
        id: 1,
        content: '{"key": "value"}',
        tags: '["tag1"]',
        metadata: '{"meta": true}',
        embedding: null
      };

      const parsed = memory.parseMemory(row);

      expect(parsed.content).toEqual({ key: 'value' });
      expect(parsed.tags).toEqual(['tag1']);
    });

    it('should handle string content that is not JSON', () => {
      const row = {
        id: 1,
        content: 'Plain text content',
        tags: '[]',
        metadata: '{}',
        embedding: null
      };

      const parsed = memory.parseMemory(row);

      expect(parsed.content).toBe('Plain text content');
    });

    it('should return null for null input', () => {
      expect(memory.parseMemory(null)).toBeNull();
    });
  });

  describe('static properties', () => {
    it('should have TYPES constant', () => {
      expect(AgentMemory.TYPES).toBeDefined();
      expect(AgentMemory.TYPES.SHORT_TERM).toBe('short_term');
      expect(AgentMemory.TYPES.LONG_TERM).toBe('long_term');
    });

    it('should have IMPORTANCE constant', () => {
      expect(AgentMemory.IMPORTANCE).toBeDefined();
      expect(AgentMemory.IMPORTANCE.LOW).toBe(1);
      expect(AgentMemory.IMPORTANCE.HIGH).toBe(3);
    });

    it('should have CONFIG constant', () => {
      expect(AgentMemory.CONFIG).toBeDefined();
      expect(AgentMemory.CONFIG.shortTermCapacity).toBeDefined();
    });
  });
});
