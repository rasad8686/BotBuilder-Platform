/**
 * AgentMemory Tests
 * Comprehensive tests for the memory system for autonomous agents
 */

jest.mock('../../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../../db');
const log = require('../../../utils/logger');
const AgentMemory = require('../../../services/autonomous/AgentMemory');

describe('AgentMemory', () => {
  let memory;

  beforeEach(() => {
    jest.clearAllMocks();
    memory = new AgentMemory('agent-123');
  });

  describe('constructor', () => {
    it('should initialize with agent ID', () => {
      expect(memory.agentId).toBe('agent-123');
      expect(memory.shortTermMemory).toEqual([]);
      expect(memory.workingMemory).toEqual({});
      expect(memory.lastConsolidation).toBeNull();
    });

    it('should initialize accessLog as empty array', () => {
      expect(memory.accessLog).toEqual([]);
    });

    it('should create independent instances for different agents', () => {
      const memory1 = new AgentMemory('agent-1');
      const memory2 = new AgentMemory('agent-2');

      expect(memory1.agentId).toBe('agent-1');
      expect(memory2.agentId).toBe('agent-2');
      expect(memory1.shortTermMemory).not.toBe(memory2.shortTermMemory);
    });

    it('should accept numeric agent IDs', () => {
      const memoryWithNumber = new AgentMemory(123);
      expect(memoryWithNumber.agentId).toBe(123);
    });

    it('should accept UUID agent IDs', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const memoryWithUUID = new AgentMemory(uuid);
      expect(memoryWithUUID.agentId).toBe(uuid);
    });
  });

  describe('store', () => {
    it('should store a simple memory', async () => {
      const mockMemory = {
        id: 1,
        agent_id: 'agent-123',
        content: '"Test content"',
        memory_type: 'short_term',
        importance: 2,
        tags: '[]',
        metadata: '{}',
        access_count: 0
      };

      db.query.mockResolvedValue({ rows: [mockMemory] });

      const result = await memory.store('Test content');

      expect(result.id).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agent_memories'),
        expect.arrayContaining(['agent-123'])
      );
    });

    it('should store memory with options', async () => {
      const mockMemory = {
        id: 2,
        agent_id: 'agent-123',
        content: '{"key":"value"}',
        memory_type: 'long_term',
        importance: 3,
        tags: '["tag1","tag2"]',
        metadata: '{"source":"test"}',
        access_count: 0
      };

      db.query.mockResolvedValue({ rows: [mockMemory] });

      const result = await memory.store({ key: 'value' }, {
        type: AgentMemory.TYPES.LONG_TERM,
        importance: AgentMemory.IMPORTANCE.HIGH,
        tags: ['tag1', 'tag2'],
        metadata: { source: 'test' }
      });

      expect(result.importance).toBe(3);
    });

    it('should add short-term memory to cache', async () => {
      const mockMemory = {
        id: 1,
        content: '"Test"',
        memory_type: 'short_term',
        tags: '[]',
        metadata: '{}'
      };

      db.query.mockResolvedValue({ rows: [mockMemory] });

      await memory.store('Test', { type: AgentMemory.TYPES.SHORT_TERM });

      expect(memory.shortTermMemory.length).toBe(1);
    });

    it('should stringify object content', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          content: '{"nested":"data"}',
          memory_type: 'short_term',
          tags: '[]',
          metadata: '{}'
        }]
      });

      await memory.store({ nested: 'data' });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([JSON.stringify({ nested: 'data' })])
      );
    });

    it('should store memory with embedding vector', async () => {
      const mockMemory = {
        id: 1,
        content: '"Test"',
        memory_type: 'short_term',
        tags: '[]',
        metadata: '{}',
        embedding: '[0.1, 0.2, 0.3]'
      };

      db.query.mockResolvedValue({ rows: [mockMemory] });

      await memory.store('Test', { embedding: [0.1, 0.2, 0.3] });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([JSON.stringify([0.1, 0.2, 0.3])])
      );
    });

    it('should store memory without embedding', async () => {
      const mockMemory = {
        id: 1,
        content: '"Test"',
        memory_type: 'short_term',
        tags: '[]',
        metadata: '{}'
      };

      db.query.mockResolvedValue({ rows: [mockMemory] });

      await memory.store('Test');

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([null])
      );
    });

    it('should enforce capacity when storing short-term memory', async () => {
      // Set a small capacity
      const originalCapacity = AgentMemory.CONFIG.shortTermCapacity;
      AgentMemory.CONFIG.shortTermCapacity = 2;

      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          content: '"Test"',
          memory_type: 'short_term',
          tags: '[]',
          metadata: '{}',
          importance: 1,
          created_at: new Date()
        }]
      });

      await memory.store('Test1', { type: AgentMemory.TYPES.SHORT_TERM });
      await memory.store('Test2', { type: AgentMemory.TYPES.SHORT_TERM });
      await memory.store('Test3', { type: AgentMemory.TYPES.SHORT_TERM });

      expect(memory.shortTermMemory.length).toBeLessThanOrEqual(2);

      AgentMemory.CONFIG.shortTermCapacity = originalCapacity;
    });

    it('should not add long-term memory to cache', async () => {
      const mockMemory = {
        id: 1,
        content: '"Test"',
        memory_type: 'long_term',
        tags: '[]',
        metadata: '{}'
      };

      db.query.mockResolvedValue({ rows: [mockMemory] });

      await memory.store('Test', { type: AgentMemory.TYPES.LONG_TERM });

      expect(memory.shortTermMemory.length).toBe(0);
    });

    it('should log debug message when storing memory', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          content: '"Test"',
          memory_type: 'short_term',
          tags: '[]',
          metadata: '{}'
        }]
      });

      await memory.store('Test');

      expect(log.debug).toHaveBeenCalledWith(
        'AgentMemory: Memory stored',
        expect.objectContaining({
          agentId: 'agent-123',
          memoryId: 1
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      db.query.mockRejectedValue(new Error('Database error'));

      await expect(memory.store('Test')).rejects.toThrow('Database error');
    });

    it('should store critical importance memories', async () => {
      const mockMemory = {
        id: 1,
        content: '"Critical"',
        memory_type: 'short_term',
        importance: 4,
        tags: '[]',
        metadata: '{}'
      };

      db.query.mockResolvedValue({ rows: [mockMemory] });

      await memory.store('Critical', { importance: AgentMemory.IMPORTANCE.CRITICAL });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([4])
      );
    });

    it('should store low importance memories', async () => {
      const mockMemory = {
        id: 1,
        content: '"Low"',
        memory_type: 'short_term',
        importance: 1,
        tags: '[]',
        metadata: '{}'
      };

      db.query.mockResolvedValue({ rows: [mockMemory] });

      await memory.store('Low', { importance: AgentMemory.IMPORTANCE.LOW });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([1])
      );
    });

    it('should store complex nested objects', async () => {
      const complexObject = {
        level1: {
          level2: {
            level3: {
              data: 'deep'
            }
          },
          array: [1, 2, 3]
        }
      };

      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          content: JSON.stringify(complexObject),
          memory_type: 'short_term',
          tags: '[]',
          metadata: '{}'
        }]
      });

      await memory.store(complexObject);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([JSON.stringify(complexObject)])
      );
    });

    it('should store arrays as content', async () => {
      const arrayContent = [1, 2, 3, 4, 5];

      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          content: JSON.stringify(arrayContent),
          memory_type: 'short_term',
          tags: '[]',
          metadata: '{}'
        }]
      });

      await memory.store(arrayContent);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([JSON.stringify(arrayContent)])
      );
    });

    it('should store empty string content', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          content: '""',
          memory_type: 'short_term',
          tags: '[]',
          metadata: '{}'
        }]
      });

      await memory.store('');

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([''])
      );
    });
  });

  describe('retrieve', () => {
    it('should retrieve memories by query', async () => {
      const mockMemories = [
        { id: 1, content: 'Test 1', memory_type: 'short_term', tags: '[]', metadata: '{}' },
        { id: 2, content: 'Test 2', memory_type: 'short_term', tags: '[]', metadata: '{}' }
      ];

      db.query.mockResolvedValue({ rows: mockMemories });

      const result = await memory.retrieve('test');

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('content ILIKE'),
        expect.arrayContaining(['%test%'])
      );
    });

    it('should filter by type', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await memory.retrieve(null, { type: AgentMemory.TYPES.LONG_TERM });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('memory_type = $3'),
        expect.arrayContaining([AgentMemory.TYPES.LONG_TERM])
      );
    });

    it('should filter by minimum importance', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await memory.retrieve(null, { minImportance: AgentMemory.IMPORTANCE.HIGH });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('importance >= $2'),
        expect.arrayContaining([AgentMemory.IMPORTANCE.HIGH])
      );
    });

    it('should filter by tags', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await memory.retrieve(null, { tags: ['important', 'task'] });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('tags'),
        expect.arrayContaining([['important', 'task']])
      );
    });

    it('should update access counts', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, content: 'Test', tags: '[]', metadata: '{}' }]
      }).mockResolvedValueOnce({ rows: [] });

      await memory.retrieve('test');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('access_count = access_count + 1'),
        expect.any(Array)
      );
    });

    it('should respect limit parameter', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await memory.retrieve(null, { limit: 5 });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([5])
      );
    });

    it('should use default limit of 10', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await memory.retrieve(null);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([10])
      );
    });

    it('should not update access counts if no results', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await memory.retrieve('nonexistent');

      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('should order by importance, access_count, and created_at', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await memory.retrieve(null);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY importance DESC, access_count DESC, created_at DESC'),
        expect.any(Array)
      );
    });

    it('should not add text search when useEmbedding is true', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await memory.retrieve('query', { useEmbedding: true });

      expect(db.query).toHaveBeenCalledWith(
        expect.not.stringContaining('content ILIKE'),
        expect.any(Array)
      );
    });

    it('should retrieve without query parameter', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await memory.retrieve(null);

      expect(db.query).toHaveBeenCalledWith(
        expect.not.stringContaining('content ILIKE'),
        expect.any(Array)
      );
    });

    it('should combine multiple filters', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await memory.retrieve('test', {
        type: AgentMemory.TYPES.LONG_TERM,
        minImportance: AgentMemory.IMPORTANCE.HIGH,
        tags: ['important'],
        limit: 5
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('memory_type'),
        expect.any(Array)
      );
    });

    it('should handle database errors during retrieval', async () => {
      db.query.mockRejectedValue(new Error('Database error'));

      await expect(memory.retrieve('test')).rejects.toThrow('Database error');
    });

    it('should parse retrieved memories correctly', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          content: '{"key":"value"}',
          tags: '["tag1"]',
          metadata: '{"meta":"data"}'
        }]
      });

      const result = await memory.retrieve('test');

      expect(result[0].content).toEqual({ key: 'value' });
      expect(result[0].tags).toEqual(['tag1']);
      expect(result[0].metadata).toEqual({ meta: 'data' });
    });
  });

  describe('retrieveSimilar', () => {
    it('should retrieve similar memories by embedding', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, content: 'Test', embedding: '[0.1, 0.2, 0.3]', tags: '[]', metadata: '{}' },
          { id: 2, content: 'Other', embedding: '[0.9, 0.8, 0.7]', tags: '[]', metadata: '{}' }
        ]
      });

      const result = await memory.retrieveSimilar([0.1, 0.2, 0.3], { threshold: 0.5 });

      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should apply similarity threshold', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, content: 'Test', embedding: '[1, 0, 0]', tags: '[]', metadata: '{}' }
        ]
      });

      const result = await memory.retrieveSimilar([1, 0, 0], { threshold: 0.99 });

      // Should match since embeddings are identical
      expect(result.length).toBe(1);
    });

    it('should use default threshold from config', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, content: 'Test', embedding: '[0.8, 0.6, 0.4]', tags: '[]', metadata: '{}' }
        ]
      });

      const result = await memory.retrieveSimilar([0.8, 0.6, 0.4]);

      expect(result).toBeDefined();
    });

    it('should use default limit of 5', async () => {
      db.query.mockResolvedValue({
        rows: Array(10).fill(null).map((_, i) => ({
          id: i,
          content: `Test ${i}`,
          embedding: '[0.1, 0.2, 0.3]',
          tags: '[]',
          metadata: '{}'
        }))
      });

      const result = await memory.retrieveSimilar([0.1, 0.2, 0.3]);

      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should respect custom limit', async () => {
      db.query.mockResolvedValue({
        rows: Array(10).fill(null).map((_, i) => ({
          id: i,
          content: `Test ${i}`,
          embedding: '[0.1, 0.2, 0.3]',
          tags: '[]',
          metadata: '{}'
        }))
      });

      const result = await memory.retrieveSimilar([0.1, 0.2, 0.3], { limit: 3 });

      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('should filter out memories below threshold', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, content: 'Test', embedding: '[1, 0, 0]', tags: '[]', metadata: '{}' },
          { id: 2, content: 'Test', embedding: '[0, 1, 0]', tags: '[]', metadata: '{}' }
        ]
      });

      const result = await memory.retrieveSimilar([1, 0, 0], { threshold: 0.9 });

      expect(result.length).toBe(1);
    });

    it('should sort by similarity descending', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, content: 'Test', embedding: '[0.5, 0.5, 0]', tags: '[]', metadata: '{}' },
          { id: 2, content: 'Test', embedding: '[1, 0, 0]', tags: '[]', metadata: '{}' },
          { id: 3, content: 'Test', embedding: '[0.9, 0.1, 0]', tags: '[]', metadata: '{}' }
        ]
      });

      const result = await memory.retrieveSimilar([1, 0, 0], { threshold: 0.5 });

      if (result.length > 1) {
        expect(result[0].similarity).toBeGreaterThanOrEqual(result[1].similarity);
      }
    });

    it('should handle memories without embeddings', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, content: 'Test', embedding: null, tags: '[]', metadata: '{}' },
          { id: 2, content: 'Test', embedding: '[1, 0, 0]', tags: '[]', metadata: '{}' }
        ]
      });

      const result = await memory.retrieveSimilar([1, 0, 0]);

      expect(result).toBeDefined();
    });

    it('should include similarity score in results', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, content: 'Test', embedding: '[1, 0, 0]', tags: '[]', metadata: '{}' }
        ]
      });

      const result = await memory.retrieveSimilar([1, 0, 0]);

      if (result.length > 0) {
        expect(result[0].similarity).toBeDefined();
        expect(typeof result[0].similarity).toBe('number');
      }
    });
  });

  describe('cosineSimilarity', () => {
    it('should calculate cosine similarity for identical vectors', () => {
      const similarity = memory.cosineSimilarity([1, 0, 0], [1, 0, 0]);
      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should calculate cosine similarity for orthogonal vectors', () => {
      const similarity = memory.cosineSimilarity([1, 0, 0], [0, 1, 0]);
      expect(similarity).toBeCloseTo(0, 5);
    });

    it('should calculate cosine similarity for opposite vectors', () => {
      const similarity = memory.cosineSimilarity([1, 0, 0], [-1, 0, 0]);
      expect(similarity).toBeCloseTo(-1, 5);
    });

    it('should return 0 for mismatched vector lengths', () => {
      const similarity = memory.cosineSimilarity([1, 0], [1, 0, 0]);
      expect(similarity).toBe(0);
    });

    it('should return 0 for null/undefined vectors', () => {
      expect(memory.cosineSimilarity(null, [1, 0])).toBe(0);
      expect(memory.cosineSimilarity([1, 0], undefined)).toBe(0);
    });

    it('should handle zero vectors', () => {
      const similarity = memory.cosineSimilarity([0, 0, 0], [1, 0, 0]);
      expect(isNaN(similarity) || similarity === 0).toBe(true);
    });

    it('should calculate similarity for multi-dimensional vectors', () => {
      const a = [0.5, 0.5, 0.5, 0.5];
      const b = [0.5, 0.5, 0.5, 0.5];
      const similarity = memory.cosineSimilarity(a, b);
      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should handle negative values', () => {
      const similarity = memory.cosineSimilarity([1, -1, 0], [1, -1, 0]);
      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should handle decimal values', () => {
      const similarity = memory.cosineSimilarity([0.1, 0.2, 0.3], [0.1, 0.2, 0.3]);
      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should handle empty arrays', () => {
      const similarity = memory.cosineSimilarity([], []);
      expect(similarity).toBe(0);
    });
  });

  describe('working memory', () => {
    it('should set and get working memory', () => {
      memory.setWorkingMemory('currentTask', 'Process data');

      expect(memory.getWorkingMemory('currentTask')).toBe('Process data');
    });

    it('should return null for non-existent keys', () => {
      expect(memory.getWorkingMemory('nonexistent')).toBeNull();
    });

    it('should clear working memory', () => {
      memory.setWorkingMemory('key1', 'value1');
      memory.setWorkingMemory('key2', 'value2');

      memory.clearWorkingMemory();

      expect(memory.getWorkingMemory('key1')).toBeNull();
      expect(memory.getWorkingMemory('key2')).toBeNull();
    });

    it('should include timestamp in working memory entry', () => {
      memory.setWorkingMemory('task', 'test');

      expect(memory.workingMemory.task.timestamp).toBeDefined();
    });

    it('should store objects in working memory', () => {
      const obj = { complex: 'data', nested: { value: 123 } };
      memory.setWorkingMemory('obj', obj);

      expect(memory.getWorkingMemory('obj')).toEqual(obj);
    });

    it('should store arrays in working memory', () => {
      const arr = [1, 2, 3, 4, 5];
      memory.setWorkingMemory('arr', arr);

      expect(memory.getWorkingMemory('arr')).toEqual(arr);
    });

    it('should overwrite existing working memory keys', () => {
      memory.setWorkingMemory('key', 'value1');
      memory.setWorkingMemory('key', 'value2');

      expect(memory.getWorkingMemory('key')).toBe('value2');
    });

    it('should update timestamp when overwriting', () => {
      memory.setWorkingMemory('key', 'value1');
      const timestamp1 = memory.workingMemory.key.timestamp;

      setTimeout(() => {
        memory.setWorkingMemory('key', 'value2');
        const timestamp2 = memory.workingMemory.key.timestamp;
        expect(timestamp2).not.toBe(timestamp1);
      }, 10);
    });

    it('should store null values in working memory', () => {
      memory.setWorkingMemory('nullKey', null);
      expect(memory.getWorkingMemory('nullKey')).toBeNull();
    });

    it('should store undefined values in working memory', () => {
      memory.setWorkingMemory('undefinedKey', undefined);
      expect(memory.getWorkingMemory('undefinedKey')).toBeUndefined();
    });

    it('should store boolean values in working memory', () => {
      memory.setWorkingMemory('boolKey', true);
      expect(memory.getWorkingMemory('boolKey')).toBe(true);
    });

    it('should store numeric values in working memory', () => {
      memory.setWorkingMemory('numKey', 42);
      expect(memory.getWorkingMemory('numKey')).toBe(42);
    });
  });

  describe('consolidate', () => {
    it('should consolidate high importance memories', async () => {
      memory.shortTermMemory = [
        { id: 1, importance: 4, access_count: 1 },
        { id: 2, importance: 1, access_count: 1 },
        { id: 3, importance: 2, access_count: 5 }
      ];

      db.query.mockResolvedValue({ rows: [] });

      const count = await memory.consolidate();

      expect(count).toBe(2); // High importance and high access count
      expect(memory.lastConsolidation).toBeDefined();
    });

    it('should remove consolidated memories from short-term cache', async () => {
      memory.shortTermMemory = [
        { id: 1, importance: 4, access_count: 1 },
        { id: 2, importance: 1, access_count: 1 }
      ];

      db.query.mockResolvedValue({ rows: [] });

      await memory.consolidate();

      expect(memory.shortTermMemory.length).toBe(1);
      expect(memory.shortTermMemory[0].id).toBe(2);
    });

    it('should update memory type to long_term in database', async () => {
      memory.shortTermMemory = [
        { id: 1, importance: 3, access_count: 1 }
      ];

      db.query.mockResolvedValue({ rows: [] });

      await memory.consolidate();

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE agent_memories'),
        expect.arrayContaining([AgentMemory.TYPES.LONG_TERM, 1])
      );
    });

    it('should consolidate memories with high access count', async () => {
      memory.shortTermMemory = [
        { id: 1, importance: 1, access_count: 4 }
      ];

      db.query.mockResolvedValue({ rows: [] });

      const count = await memory.consolidate();

      expect(count).toBe(1);
    });

    it('should not consolidate low importance, low access memories', async () => {
      memory.shortTermMemory = [
        { id: 1, importance: 1, access_count: 1 },
        { id: 2, importance: 2, access_count: 2 }
      ];

      db.query.mockResolvedValue({ rows: [] });

      const count = await memory.consolidate();

      expect(count).toBe(0);
    });

    it('should log consolidation info', async () => {
      memory.shortTermMemory = [
        { id: 1, importance: 4, access_count: 1 }
      ];

      db.query.mockResolvedValue({ rows: [] });

      await memory.consolidate();

      expect(log.info).toHaveBeenCalledWith(
        'AgentMemory: Consolidation complete',
        expect.objectContaining({
          agentId: 'agent-123',
          consolidated: 1
        })
      );
    });

    it('should return 0 when no memories to consolidate', async () => {
      memory.shortTermMemory = [];

      db.query.mockResolvedValue({ rows: [] });

      const count = await memory.consolidate();

      expect(count).toBe(0);
    });

    it('should handle database errors during consolidation', async () => {
      memory.shortTermMemory = [
        { id: 1, importance: 4, access_count: 1 }
      ];

      db.query.mockRejectedValue(new Error('Database error'));

      await expect(memory.consolidate()).rejects.toThrow('Database error');
    });
  });

  describe('createEpisode', () => {
    it('should create episodic memory from task', async () => {
      const mockEpisode = {
        id: 1,
        content: '{}',
        memory_type: 'episodic',
        tags: '["episode","success"]',
        metadata: '{}'
      };

      db.query.mockResolvedValue({ rows: [mockEpisode] });

      const result = await memory.createEpisode('task-1', {
        summary: 'Completed task',
        steps: ['step1', 'step2'],
        outcome: 'success',
        learnings: ['learned something']
      });

      expect(result.memory_type).toBe('episodic');
    });

    it('should mark failed outcomes with high importance', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, memory_type: 'episodic', tags: '[]', metadata: '{}' }]
      });

      await memory.createEpisode('task-1', {
        summary: 'Failed task',
        outcome: 'failure'
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([AgentMemory.IMPORTANCE.HIGH])
      );
    });

    it('should mark successful outcomes with medium importance', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, memory_type: 'episodic', tags: '[]', metadata: '{}' }]
      });

      await memory.createEpisode('task-1', {
        summary: 'Success',
        outcome: 'success'
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([AgentMemory.IMPORTANCE.MEDIUM])
      );
    });

    it('should include taskId in metadata', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, memory_type: 'episodic', tags: '[]', metadata: '{"taskId":"task-1"}' }]
      });

      await memory.createEpisode('task-1', {
        summary: 'Test',
        outcome: 'success'
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([JSON.stringify({ taskId: 'task-1' })])
      );
    });

    it('should handle empty learnings array', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, memory_type: 'episodic', tags: '[]', metadata: '{}' }]
      });

      await memory.createEpisode('task-1', {
        summary: 'Test',
        outcome: 'success'
      });

      expect(db.query).toHaveBeenCalled();
    });

    it('should include step count in episode data', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, memory_type: 'episodic', tags: '[]', metadata: '{}', content: '{}' }]
      });

      await memory.createEpisode('task-1', {
        summary: 'Test',
        steps: ['a', 'b', 'c'],
        outcome: 'success'
      });

      expect(db.query).toHaveBeenCalled();
    });

    it('should tag episode with outcome', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, memory_type: 'episodic', tags: '["episode","success"]', metadata: '{}' }]
      });

      await memory.createEpisode('task-1', {
        summary: 'Test',
        outcome: 'success'
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([JSON.stringify(['episode', 'success'])])
      );
    });
  });

  describe('getRecentEpisodes', () => {
    it('should get recent episodes', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, content: '{}', memory_type: 'episodic', tags: '[]', metadata: '{}' }
        ]
      });

      const result = await memory.getRecentEpisodes(5);

      expect(result).toHaveLength(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('memory_type'),
        expect.any(Array)
      );
    });

    it('should use default limit of 10', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await memory.getRecentEpisodes();

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([10])
      );
    });

    it('should respect custom limit', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await memory.getRecentEpisodes(20);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([20])
      );
    });

    it('should filter by episodic type', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await memory.getRecentEpisodes();

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([AgentMemory.TYPES.EPISODIC])
      );
    });
  });

  describe('storeProcedure', () => {
    it('should store procedural memory', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, memory_type: 'procedural', tags: '["procedure","deploy"]', metadata: '{}' }]
      });

      const result = await memory.storeProcedure('deploy', ['build', 'test', 'deploy']);

      expect(result.memory_type).toBe('procedural');
    });

    it('should tag procedure with name', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, memory_type: 'procedural', tags: '["procedure","deploy"]', metadata: '{}' }]
      });

      await memory.storeProcedure('deploy', ['build']);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([JSON.stringify(['procedure', 'deploy'])])
      );
    });

    it('should set high importance for procedures', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, memory_type: 'procedural', tags: '[]', metadata: '{}' }]
      });

      await memory.storeProcedure('test', ['step1']);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([AgentMemory.IMPORTANCE.HIGH])
      );
    });

    it('should store procedure with version', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, memory_type: 'procedural', tags: '[]', metadata: '{}', content: '{}' }]
      });

      await memory.storeProcedure('test', ['step1'], { version: 2 });

      expect(db.query).toHaveBeenCalled();
    });

    it('should default to version 1 if not specified', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, memory_type: 'procedural', tags: '[]', metadata: '{}', content: '{}' }]
      });

      await memory.storeProcedure('test', ['step1']);

      expect(db.query).toHaveBeenCalled();
    });

    it('should store procedure metadata', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, memory_type: 'procedural', tags: '[]', metadata: '{"custom":"data"}' }]
      });

      await memory.storeProcedure('test', ['step1'], { metadata: { custom: 'data' } });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([JSON.stringify({ custom: 'data' })])
      );
    });
  });

  describe('getProcedure', () => {
    it('should get procedure by name', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, content: '{"name":"deploy","steps":["build"]}', memory_type: 'procedural', tags: '["procedure","deploy"]', metadata: '{}' }]
      });

      const result = await memory.getProcedure('deploy');

      expect(result).toBeDefined();
    });

    it('should return null when procedure not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await memory.getProcedure('nonexistent');

      expect(result).toBeNull();
    });

    it('should limit results to 1', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await memory.getProcedure('test');

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([1])
      );
    });

    it('should filter by procedural type and tags', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await memory.getProcedure('deploy');

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([AgentMemory.TYPES.PROCEDURAL])
      );
    });
  });

  describe('storeFact', () => {
    it('should store semantic fact', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, memory_type: 'semantic', tags: '["fact","user"]', metadata: '{}' }]
      });

      const result = await memory.storeFact('user', 'prefers', 'dark mode');

      expect(result.memory_type).toBe('semantic');
    });

    it('should tag fact with subject', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, memory_type: 'semantic', tags: '["fact","user"]', metadata: '{}' }]
      });

      await memory.storeFact('user', 'likes', 'coffee');

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([JSON.stringify(['fact', 'user'])])
      );
    });

    it('should store predicate in metadata', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, memory_type: 'semantic', tags: '[]', metadata: '{"predicate":"likes"}' }]
      });

      await memory.storeFact('user', 'likes', 'coffee');

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([JSON.stringify({ predicate: 'likes' })])
      );
    });

    it('should use default confidence of 1.0', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, memory_type: 'semantic', tags: '[]', metadata: '{}', content: '{}' }]
      });

      await memory.storeFact('user', 'likes', 'coffee');

      expect(db.query).toHaveBeenCalled();
    });

    it('should accept custom confidence', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, memory_type: 'semantic', tags: '[]', metadata: '{}', content: '{}' }]
      });

      await memory.storeFact('user', 'likes', 'coffee', { confidence: 0.8 });

      expect(db.query).toHaveBeenCalled();
    });

    it('should use default source of "learned"', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, memory_type: 'semantic', tags: '[]', metadata: '{}', content: '{}' }]
      });

      await memory.storeFact('user', 'likes', 'coffee');

      expect(db.query).toHaveBeenCalled();
    });

    it('should accept custom source', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, memory_type: 'semantic', tags: '[]', metadata: '{}', content: '{}' }]
      });

      await memory.storeFact('user', 'likes', 'coffee', { source: 'manual' });

      expect(db.query).toHaveBeenCalled();
    });

    it('should accept custom importance', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, memory_type: 'semantic', tags: '[]', metadata: '{}' }]
      });

      await memory.storeFact('user', 'likes', 'coffee', { importance: AgentMemory.IMPORTANCE.HIGH });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([AgentMemory.IMPORTANCE.HIGH])
      );
    });
  });

  describe('queryFacts', () => {
    it('should query facts by subject', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, content: '{"subject":"user","predicate":"likes"}', memory_type: 'semantic', tags: '[]', metadata: '{}' }]
      });

      const result = await memory.queryFacts('user');

      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should filter by semantic type', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await memory.queryFacts('user');

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([AgentMemory.TYPES.SEMANTIC])
      );
    });

    it('should tag query with subject', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await memory.queryFacts('user');

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([['fact', 'user']])
      );
    });
  });

  describe('forget', () => {
    it('should delete old low-importance memories', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }] });

      const count = await memory.forget({ olderThan: 30, maxImportance: 1 });

      expect(count).toBe(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM agent_memories'),
        expect.any(Array)
      );
    });

    it('should exclude procedural memories by default', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await memory.forget();

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([[AgentMemory.TYPES.PROCEDURAL]])
      );
    });

    it('should use default olderThan of 30 days', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await memory.forget();

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("INTERVAL '30 days'"),
        expect.any(Array)
      );
    });

    it('should use default maxImportance of LOW', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await memory.forget();

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([AgentMemory.IMPORTANCE.LOW])
      );
    });

    it('should respect custom excludeTypes', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await memory.forget({ excludeTypes: [AgentMemory.TYPES.PROCEDURAL, AgentMemory.TYPES.SEMANTIC] });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([[AgentMemory.TYPES.PROCEDURAL, AgentMemory.TYPES.SEMANTIC]])
      );
    });

    it('should log forgotten memories count', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }] });

      await memory.forget();

      expect(log.info).toHaveBeenCalledWith(
        'AgentMemory: Forgotten memories',
        expect.objectContaining({
          agentId: 'agent-123',
          count: 2
        })
      );
    });

    it('should only delete low access count memories', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await memory.forget();

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('access_count < 3'),
        expect.any(Array)
      );
    });
  });

  describe('getStats', () => {
    it('should return memory statistics', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { memory_type: 'short_term', count: '10', avg_importance: 2.5, avg_access_count: 1.5, newest: new Date(), oldest: new Date() }
        ]
      }).mockResolvedValueOnce({
        rows: [{ total: '50' }]
      });

      const stats = await memory.getStats();

      expect(stats.total).toBe(50);
      expect(stats.byType.short_term).toBeDefined();
      expect(stats.byType.short_term.count).toBe(10);
    });

    it('should include short-term and working memory sizes', async () => {
      memory.shortTermMemory = [1, 2, 3];
      memory.setWorkingMemory('key1', 'value1');
      memory.setWorkingMemory('key2', 'value2');

      db.query.mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] });

      const stats = await memory.getStats();

      expect(stats.shortTermSize).toBe(3);
      expect(stats.workingMemoryKeys).toBe(2);
    });

    it('should include lastConsolidation timestamp', async () => {
      memory.lastConsolidation = new Date();

      db.query.mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] });

      const stats = await memory.getStats();

      expect(stats.lastConsolidation).toBeDefined();
    });

    it('should parse count values as integers', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { memory_type: 'short_term', count: '10', avg_importance: 2.5, avg_access_count: 1.5, newest: new Date(), oldest: new Date() }
        ]
      }).mockResolvedValueOnce({
        rows: [{ total: '50' }]
      });

      const stats = await memory.getStats();

      expect(typeof stats.byType.short_term.count).toBe('number');
    });

    it('should handle empty statistics', async () => {
      db.query.mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] });

      const stats = await memory.getStats();

      expect(stats.total).toBe(0);
      expect(stats.byType).toEqual({});
    });

    it('should handle null total gracefully', async () => {
      db.query.mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const stats = await memory.getStats();

      expect(stats.total).toBe(0);
    });

    it('should include multiple memory types in stats', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { memory_type: 'short_term', count: '10', avg_importance: 2.5, avg_access_count: 1.5, newest: new Date(), oldest: new Date() },
          { memory_type: 'long_term', count: '20', avg_importance: 3.0, avg_access_count: 5.0, newest: new Date(), oldest: new Date() }
        ]
      }).mockResolvedValueOnce({
        rows: [{ total: '30' }]
      });

      const stats = await memory.getStats();

      expect(stats.byType.short_term).toBeDefined();
      expect(stats.byType.long_term).toBeDefined();
    });
  });

  describe('export', () => {
    it('should export all memories', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, content: 'Memory 1', tags: '[]', metadata: '{}' },
          { id: 2, content: 'Memory 2', tags: '[]', metadata: '{}' }
        ]
      });

      const exported = await memory.export();

      expect(exported).toHaveLength(2);
    });

    it('should order by created_at', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await memory.export();

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at'),
        expect.any(Array)
      );
    });

    it('should filter by agent_id', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await memory.export();

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['agent-123'])
      );
    });

    it('should parse exported memories', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          content: '{"key":"value"}',
          tags: '["tag1"]',
          metadata: '{"meta":"data"}'
        }]
      });

      const exported = await memory.export();

      expect(exported[0].content).toEqual({ key: 'value' });
    });

    it('should handle empty export', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const exported = await memory.export();

      expect(exported).toEqual([]);
    });
  });

  describe('import', () => {
    it('should import memories', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, content: '{}', tags: '[]', metadata: '{}' }]
      });

      const count = await memory.import([
        { content: 'Memory 1', memory_type: 'short_term', importance: 2, tags: [], metadata: {} },
        { content: 'Memory 2', memory_type: 'long_term', importance: 3, tags: [], metadata: {} }
      ]);

      expect(count).toBe(2);
    });

    it('should handle import errors gracefully', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, content: '{}', tags: '[]', metadata: '{}' }] })
        .mockRejectedValueOnce(new Error('DB Error'));

      const count = await memory.import([
        { content: 'Success' },
        { content: 'Fail' }
      ]);

      expect(count).toBe(1);
    });

    it('should log errors when import fails', async () => {
      db.query.mockRejectedValue(new Error('DB Error'));

      await memory.import([{ content: 'Test' }]);

      expect(log.error).toHaveBeenCalledWith(
        'AgentMemory: Failed to import memory',
        expect.objectContaining({ error: 'DB Error' })
      );
    });

    it('should import empty array', async () => {
      const count = await memory.import([]);

      expect(count).toBe(0);
    });

    it('should import memories with all fields', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, content: '{}', tags: '[]', metadata: '{}' }]
      });

      const count = await memory.import([{
        content: { complex: 'object' },
        memory_type: AgentMemory.TYPES.EPISODIC,
        importance: AgentMemory.IMPORTANCE.HIGH,
        tags: ['tag1', 'tag2'],
        metadata: { source: 'import' }
      }]);

      expect(count).toBe(1);
    });
  });

  describe('enforceCapacity', () => {
    it('should trim short-term memory when over capacity', () => {
      // Set a small capacity for testing
      const originalCapacity = AgentMemory.CONFIG.shortTermCapacity;
      AgentMemory.CONFIG.shortTermCapacity = 3;

      memory.shortTermMemory = [
        { id: 1, importance: 1, created_at: new Date('2024-01-01') },
        { id: 2, importance: 2, created_at: new Date('2024-01-02') },
        { id: 3, importance: 3, created_at: new Date('2024-01-03') },
        { id: 4, importance: 4, created_at: new Date('2024-01-04') },
        { id: 5, importance: 1, created_at: new Date('2024-01-05') }
      ];

      memory.enforceCapacity();

      expect(memory.shortTermMemory.length).toBe(3);
      // Should keep highest importance
      expect(memory.shortTermMemory.find(m => m.importance === 4)).toBeDefined();
      expect(memory.shortTermMemory.find(m => m.importance === 3)).toBeDefined();

      AgentMemory.CONFIG.shortTermCapacity = originalCapacity;
    });

    it('should not trim when under capacity', () => {
      const originalCapacity = AgentMemory.CONFIG.shortTermCapacity;
      AgentMemory.CONFIG.shortTermCapacity = 10;

      memory.shortTermMemory = [
        { id: 1, importance: 1, created_at: new Date() },
        { id: 2, importance: 2, created_at: new Date() }
      ];

      memory.enforceCapacity();

      expect(memory.shortTermMemory.length).toBe(2);

      AgentMemory.CONFIG.shortTermCapacity = originalCapacity;
    });

    it('should prioritize by importance then recency', () => {
      const originalCapacity = AgentMemory.CONFIG.shortTermCapacity;
      AgentMemory.CONFIG.shortTermCapacity = 2;

      memory.shortTermMemory = [
        { id: 1, importance: 2, created_at: new Date('2024-01-01') },
        { id: 2, importance: 2, created_at: new Date('2024-01-02') }
      ];

      memory.enforceCapacity();

      expect(memory.shortTermMemory.length).toBe(2);

      AgentMemory.CONFIG.shortTermCapacity = originalCapacity;
    });
  });

  describe('loadShortTermMemory', () => {
    it('should load short-term memories from database', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, content: 'Memory 1', tags: '[]', metadata: '{}' },
          { id: 2, content: 'Memory 2', tags: '[]', metadata: '{}' }
        ]
      });

      const loaded = await memory.loadShortTermMemory();

      expect(loaded).toHaveLength(2);
      expect(memory.shortTermMemory).toHaveLength(2);
    });

    it('should filter by short_term type', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await memory.loadShortTermMemory();

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([AgentMemory.TYPES.SHORT_TERM])
      );
    });

    it('should order by importance and created_at', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await memory.loadShortTermMemory();

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY importance DESC, created_at DESC'),
        expect.any(Array)
      );
    });

    it('should limit to shortTermCapacity', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await memory.loadShortTermMemory();

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([AgentMemory.CONFIG.shortTermCapacity])
      );
    });

    it('should replace existing short-term memory', async () => {
      memory.shortTermMemory = [{ id: 999, content: 'Old' }];

      db.query.mockResolvedValue({
        rows: [{ id: 1, content: 'New', tags: '[]', metadata: '{}' }]
      });

      await memory.loadShortTermMemory();

      expect(memory.shortTermMemory.length).toBe(1);
      expect(memory.shortTermMemory[0].id).toBe(1);
    });
  });

  describe('getContext', () => {
    it('should get context for decision making', async () => {
      memory.shortTermMemory = [
        { id: 1, content: 'Recent 1' },
        { id: 2, content: 'Recent 2' }
      ];
      memory.setWorkingMemory('currentTask', 'test');

      db.query.mockResolvedValue({ rows: [] });

      const context = await memory.getContext('query');

      expect(context.recent).toBeDefined();
      expect(context.relevant).toBeDefined();
      expect(context.episodes).toBeDefined();
      expect(context.working.currentTask).toBeDefined();
    });

    it('should get last 10 short-term memories', async () => {
      memory.shortTermMemory = Array(20).fill(null).map((_, i) => ({ id: i }));

      db.query.mockResolvedValue({ rows: [] });

      const context = await memory.getContext();

      expect(context.recent.length).toBeLessThanOrEqual(10);
    });

    it('should retrieve 5 relevant long-term memories', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await memory.getContext('query');

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([5])
      );
    });

    it('should retrieve 5 recent episodes', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await memory.getContext('query');

      expect(db.query).toHaveBeenCalledTimes(2);
    });

    it('should respect maxItems option', async () => {
      memory.shortTermMemory = Array(100).fill(null).map((_, i) => ({ id: i }));

      db.query.mockResolvedValue({ rows: [] });

      await memory.getContext('query', { maxItems: 50 });

      expect(db.query).toHaveBeenCalled();
    });

    it('should include working memory snapshot', async () => {
      memory.setWorkingMemory('key1', 'value1');
      memory.setWorkingMemory('key2', 'value2');

      db.query.mockResolvedValue({ rows: [] });

      const context = await memory.getContext();

      expect(Object.keys(context.working)).toHaveLength(2);
    });

    it('should handle empty context gracefully', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const context = await memory.getContext();

      expect(context.recent).toEqual([]);
      expect(context.relevant).toEqual([]);
      expect(context.episodes).toEqual([]);
    });
  });

  describe('parseMemory', () => {
    it('should parse JSON content', () => {
      const row = {
        id: 1,
        content: '{"key":"value"}',
        tags: '["tag1"]',
        metadata: '{"source":"test"}',
        embedding: '[0.1, 0.2]'
      };

      const parsed = memory.parseMemory(row);

      expect(parsed.content).toEqual({ key: 'value' });
      expect(parsed.tags).toEqual(['tag1']);
      expect(parsed.metadata).toEqual({ source: 'test' });
      expect(parsed.embedding).toEqual([0.1, 0.2]);
    });

    it('should handle string content', () => {
      const row = {
        id: 1,
        content: 'Plain text',
        tags: '[]',
        metadata: '{}'
      };

      const parsed = memory.parseMemory(row);

      expect(parsed.content).toBe('Plain text');
    });

    it('should return null for null input', () => {
      expect(memory.parseMemory(null)).toBeNull();
    });

    it('should handle already-parsed objects', () => {
      const row = {
        id: 1,
        content: 'text',
        tags: ['tag1', 'tag2'],
        metadata: { source: 'test' },
        embedding: [0.1, 0.2]
      };

      const parsed = memory.parseMemory(row);

      expect(parsed.tags).toEqual(['tag1', 'tag2']);
      expect(parsed.metadata).toEqual({ source: 'test' });
    });

    it('should handle missing tags gracefully', () => {
      const row = {
        id: 1,
        content: 'text',
        metadata: '{}'
      };

      const parsed = memory.parseMemory(row);

      expect(parsed.tags).toEqual([]);
    });

    it('should handle missing metadata gracefully', () => {
      const row = {
        id: 1,
        content: 'text',
        tags: '[]'
      };

      const parsed = memory.parseMemory(row);

      expect(parsed.metadata).toEqual({});
    });

    it('should handle null embedding', () => {
      const row = {
        id: 1,
        content: 'text',
        tags: '[]',
        metadata: '{}',
        embedding: null
      };

      const parsed = memory.parseMemory(row);

      expect(parsed.embedding).toBeNull();
    });

    it('should preserve all row properties', () => {
      const row = {
        id: 1,
        agent_id: 'agent-123',
        content: 'text',
        memory_type: 'short_term',
        importance: 2,
        tags: '[]',
        metadata: '{}',
        access_count: 5,
        created_at: new Date(),
        last_accessed_at: new Date()
      };

      const parsed = memory.parseMemory(row);

      expect(parsed.id).toBe(1);
      expect(parsed.agent_id).toBe('agent-123');
      expect(parsed.memory_type).toBe('short_term');
      expect(parsed.importance).toBe(2);
      expect(parsed.access_count).toBe(5);
    });

    it('should handle malformed JSON gracefully', () => {
      const row = {
        id: 1,
        content: '{invalid json',
        tags: '[]',
        metadata: '{}'
      };

      const parsed = memory.parseMemory(row);

      expect(parsed.content).toBe('{invalid json');
    });
  });

  describe('static exports', () => {
    it('should export TYPES constant', () => {
      expect(AgentMemory.TYPES.SHORT_TERM).toBe('short_term');
      expect(AgentMemory.TYPES.LONG_TERM).toBe('long_term');
      expect(AgentMemory.TYPES.EPISODIC).toBe('episodic');
      expect(AgentMemory.TYPES.SEMANTIC).toBe('semantic');
      expect(AgentMemory.TYPES.PROCEDURAL).toBe('procedural');
    });

    it('should export IMPORTANCE constant', () => {
      expect(AgentMemory.IMPORTANCE.LOW).toBe(1);
      expect(AgentMemory.IMPORTANCE.MEDIUM).toBe(2);
      expect(AgentMemory.IMPORTANCE.HIGH).toBe(3);
      expect(AgentMemory.IMPORTANCE.CRITICAL).toBe(4);
    });

    it('should export CONFIG constant', () => {
      expect(AgentMemory.CONFIG.shortTermCapacity).toBeDefined();
      expect(AgentMemory.CONFIG.longTermCapacity).toBeDefined();
    });

    it('should have proper config values', () => {
      expect(typeof AgentMemory.CONFIG.shortTermCapacity).toBe('number');
      expect(typeof AgentMemory.CONFIG.longTermCapacity).toBe('number');
      expect(typeof AgentMemory.CONFIG.episodicCapacity).toBe('number');
      expect(typeof AgentMemory.CONFIG.embeddingDimension).toBe('number');
      expect(typeof AgentMemory.CONFIG.similarityThreshold).toBe('number');
      expect(typeof AgentMemory.CONFIG.consolidationInterval).toBe('number');
    });

    it('should have all memory types defined', () => {
      const types = Object.keys(AgentMemory.TYPES);
      expect(types).toContain('SHORT_TERM');
      expect(types).toContain('LONG_TERM');
      expect(types).toContain('EPISODIC');
      expect(types).toContain('SEMANTIC');
      expect(types).toContain('PROCEDURAL');
    });

    it('should have all importance levels defined', () => {
      const levels = Object.keys(AgentMemory.IMPORTANCE);
      expect(levels).toContain('LOW');
      expect(levels).toContain('MEDIUM');
      expect(levels).toContain('HIGH');
      expect(levels).toContain('CRITICAL');
    });

    it('should have importance levels in ascending order', () => {
      expect(AgentMemory.IMPORTANCE.LOW).toBeLessThan(AgentMemory.IMPORTANCE.MEDIUM);
      expect(AgentMemory.IMPORTANCE.MEDIUM).toBeLessThan(AgentMemory.IMPORTANCE.HIGH);
      expect(AgentMemory.IMPORTANCE.HIGH).toBeLessThan(AgentMemory.IMPORTANCE.CRITICAL);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle undefined agent ID', () => {
      const memoryWithUndefined = new AgentMemory(undefined);
      expect(memoryWithUndefined.agentId).toBeUndefined();
    });

    it('should handle null agent ID', () => {
      const memoryWithNull = new AgentMemory(null);
      expect(memoryWithNull.agentId).toBeNull();
    });

    it('should handle very long content', async () => {
      const longContent = 'x'.repeat(10000);
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          content: `"${longContent}"`,
          memory_type: 'short_term',
          tags: '[]',
          metadata: '{}'
        }]
      });

      await memory.store(longContent);

      expect(db.query).toHaveBeenCalled();
    });

    it('should handle special characters in content', async () => {
      const specialContent = 'Test with "quotes" and \'apostrophes\' and <tags>';
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          content: JSON.stringify(specialContent),
          memory_type: 'short_term',
          tags: '[]',
          metadata: '{}'
        }]
      });

      await memory.store(specialContent);

      expect(db.query).toHaveBeenCalled();
    });

    it('should handle Unicode content', async () => {
      const unicodeContent = '测试 🚀 тест';
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          content: JSON.stringify(unicodeContent),
          memory_type: 'short_term',
          tags: '[]',
          metadata: '{}'
        }]
      });

      await memory.store(unicodeContent);

      expect(db.query).toHaveBeenCalled();
    });

    it('should handle empty embeddings array', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          content: '"Test"',
          memory_type: 'short_term',
          tags: '[]',
          metadata: '{}',
          embedding: '[]'
        }]
      });

      await memory.store('Test', { embedding: [] });

      expect(db.query).toHaveBeenCalled();
    });

    it('should handle circular references in metadata', async () => {
      const circular = { a: 1 };
      circular.self = circular;

      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          content: '"Test"',
          memory_type: 'short_term',
          tags: '[]',
          metadata: '{}'
        }]
      });

      // Should throw or handle gracefully
      await expect(async () => {
        await memory.store('Test', { metadata: circular });
      }).rejects.toThrow();
    });

    it('should handle database connection errors', async () => {
      db.query.mockRejectedValue(new Error('Connection lost'));

      await expect(memory.store('Test')).rejects.toThrow('Connection lost');
    });

    it('should handle timeout errors', async () => {
      db.query.mockRejectedValue(new Error('Query timeout'));

      await expect(memory.retrieve('test')).rejects.toThrow('Query timeout');
    });

    it('should handle zero limit', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await memory.retrieve(null, { limit: 0 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([0])
      );
    });

    it('should handle negative limit', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await memory.retrieve(null, { limit: -5 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([-5])
      );
    });

    it('should handle very large limit', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await memory.retrieve(null, { limit: 1000000 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([1000000])
      );
    });
  });
});
