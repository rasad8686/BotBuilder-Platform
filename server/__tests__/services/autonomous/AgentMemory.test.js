/**
 * AgentMemory Tests
 * Tests for the memory system for autonomous agents
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
  });

  describe('storeProcedure', () => {
    it('should store procedural memory', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, memory_type: 'procedural', tags: '["procedure","deploy"]', metadata: '{}' }]
      });

      const result = await memory.storeProcedure('deploy', ['build', 'test', 'deploy']);

      expect(result.memory_type).toBe('procedural');
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
  });

  describe('storeFact', () => {
    it('should store semantic fact', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, memory_type: 'semantic', tags: '["fact","user"]', metadata: '{}' }]
      });

      const result = await memory.storeFact('user', 'prefers', 'dark mode');

      expect(result.memory_type).toBe('semantic');
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
  });
});
