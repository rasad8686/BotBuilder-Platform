/**
 * ContextManager Tests
 * Tests for server/agents/communication/ContextManager.js
 */

// Mock AgentContext
jest.mock('../../../agents/core/AgentContext');

const ContextManager = require('../../../agents/communication/ContextManager');
const AgentContext = require('../../../agents/core/AgentContext');

describe('ContextManager', () => {
  let manager;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup AgentContext mock
    AgentContext.mockImplementation((executionId) => ({
      executionId,
      sharedMemory: new Map(),
      set: jest.fn(function(key, value) { this.sharedMemory.set(key, value); }),
      get: jest.fn(function(key) { return this.sharedMemory.get(key) || null; }),
      toJSON: jest.fn(function() {
        return {
          executionId: this.executionId,
          sharedMemory: Object.fromEntries(this.sharedMemory)
        };
      })
    }));

    AgentContext.fromJSON = jest.fn((json) => {
      const ctx = new AgentContext(json.executionId);
      if (json.sharedMemory) {
        for (const [k, v] of Object.entries(json.sharedMemory)) {
          ctx.sharedMemory.set(k, v);
        }
      }
      return ctx;
    });

    manager = new ContextManager();
  });

  describe('create', () => {
    it('should create new context', () => {
      const context = manager.create('exec_123');

      expect(AgentContext).toHaveBeenCalledWith('exec_123');
      expect(context).toBeDefined();
    });

    it('should initialize with data', () => {
      const context = manager.create('exec_123', { key1: 'value1', key2: 'value2' });

      expect(context.set).toHaveBeenCalledWith('key1', 'value1');
      expect(context.set).toHaveBeenCalledWith('key2', 'value2');
    });

    it('should store context in map', () => {
      manager.create('exec_123');

      expect(manager.get('exec_123')).not.toBeNull();
    });
  });

  describe('get', () => {
    it('should return existing context', () => {
      const created = manager.create('exec_123');
      const retrieved = manager.get('exec_123');

      expect(retrieved).toBe(created);
    });

    it('should return null for non-existent context', () => {
      expect(manager.get('nonexistent')).toBeNull();
    });
  });

  describe('update', () => {
    it('should update existing context', () => {
      manager.create('exec_123');

      const updated = manager.update('exec_123', { newKey: 'newValue' });

      expect(updated.set).toHaveBeenCalledWith('newKey', 'newValue');
    });

    it('should create context if not exists', () => {
      const context = manager.update('exec_new', { key: 'value' });

      expect(context).toBeDefined();
      expect(context.set).toHaveBeenCalledWith('key', 'value');
    });
  });

  describe('merge', () => {
    it('should merge parallel outputs', () => {
      manager.create('exec_123');
      const parallelOutputs = [
        { data: { result1: 'a' } },
        { data: { result2: 'b' } }
      ];

      const context = manager.merge('exec_123', parallelOutputs);

      expect(context.set).toHaveBeenCalledWith('result1', 'a');
      expect(context.set).toHaveBeenCalledWith('result2', 'b');
    });

    it('should create context if not exists', () => {
      const parallelOutputs = [{ result: 'test' }];

      const context = manager.merge('exec_new', parallelOutputs);

      expect(context).toBeDefined();
    });

    it('should skip null outputs', () => {
      manager.create('exec_123');

      expect(() => {
        manager.merge('exec_123', [null, { key: 'value' }]);
      }).not.toThrow();
    });

    it('should store parallel outputs in context', () => {
      manager.create('exec_123');
      const outputs = [{ result: 'a' }];

      manager.merge('exec_123', outputs);

      expect(manager.contexts.get('exec_123').set).toHaveBeenCalledWith('_parallelOutputs', outputs);
    });
  });

  describe('mergeValues', () => {
    it('should concat arrays by default', () => {
      const result = manager.mergeValues([1, 2], [3, 4], { arrays: 'concat' });

      expect(result).toEqual([1, 2, 3, 4]);
    });

    it('should keep first array', () => {
      const result = manager.mergeValues([1, 2], [3, 4], { arrays: 'first' });

      expect(result).toEqual([1, 2]);
    });

    it('should keep last array', () => {
      const result = manager.mergeValues([1, 2], [3, 4], { arrays: 'last' });

      expect(result).toEqual([3, 4]);
    });

    it('should unique arrays', () => {
      const result = manager.mergeValues([1, 2], [2, 3], { arrays: 'unique' });

      expect(result).toEqual([1, 2, 3]);
    });

    it('should shallow merge objects', () => {
      const result = manager.mergeValues(
        { a: 1, b: 2 },
        { b: 3, c: 4 },
        { objects: 'shallow' }
      );

      expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should keep first object', () => {
      const result = manager.mergeValues(
        { a: 1 },
        { b: 2 },
        { objects: 'first' }
      );

      expect(result).toEqual({ a: 1 });
    });

    it('should keep last object', () => {
      const result = manager.mergeValues(
        { a: 1 },
        { b: 2 },
        { objects: 'last' }
      );

      expect(result).toEqual({ b: 2 });
    });

    it('should keep first primitive', () => {
      const result = manager.mergeValues('old', 'new', { primitives: 'first' });

      expect(result).toBe('old');
    });

    it('should keep last primitive by default', () => {
      const result = manager.mergeValues('old', 'new', { primitives: 'last' });

      expect(result).toBe('new');
    });
  });

  describe('deepMerge', () => {
    it('should deep merge nested objects', () => {
      const target = { a: { b: 1, c: 2 } };
      const source = { a: { c: 3, d: 4 } };

      const result = manager.deepMerge(target, source, {
        objects: 'deep',
        primitives: 'last'
      });

      expect(result.a.b).toBe(1);
      expect(result.a.c).toBe(3);
      expect(result.a.d).toBe(4);
    });
  });

  describe('save/load', () => {
    it('should save context to persistence', () => {
      manager.create('exec_123', { key: 'value' });

      const saved = manager.save('exec_123');

      expect(manager.persistedContexts.has('exec_123')).toBe(true);
    });

    it('should throw if context not found', () => {
      expect(() => {
        manager.save('nonexistent');
      }).toThrow('Context not found: nonexistent');
    });

    it('should load context from persistence', () => {
      manager.create('exec_123', { key: 'value' });
      manager.save('exec_123');
      manager.contexts.delete('exec_123');

      const loaded = manager.load('exec_123');

      expect(loaded).toBeDefined();
    });

    it('should return null if not persisted', () => {
      expect(manager.load('nonexistent')).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete context from both maps', () => {
      manager.create('exec_123');
      manager.save('exec_123');

      manager.delete('exec_123');

      expect(manager.get('exec_123')).toBeNull();
      expect(manager.persistedContexts.has('exec_123')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all contexts', () => {
      manager.create('exec_1');
      manager.create('exec_2');
      manager.save('exec_1');

      manager.clear();

      expect(manager.contexts.size).toBe(0);
      expect(manager.persistedContexts.size).toBe(0);
    });
  });

  describe('getSnapshot', () => {
    it('should return context JSON', () => {
      manager.create('exec_123', { key: 'value' });

      const snapshot = manager.getSnapshot('exec_123');

      expect(snapshot).toBeDefined();
      expect(snapshot.executionId).toBe('exec_123');
    });

    it('should return null for non-existent context', () => {
      expect(manager.getSnapshot('nonexistent')).toBeNull();
    });
  });

  describe('createChild', () => {
    it('should create child context with parent data', () => {
      const parent = manager.create('parent_123', { shared: 'data' });

      const child = manager.createChild('parent_123', 'child_456');

      expect(child.set).toHaveBeenCalledWith('_parentExecutionId', 'parent_123');
    });

    it('should throw if parent not found', () => {
      expect(() => {
        manager.createChild('nonexistent', 'child');
      }).toThrow('Parent context not found: nonexistent');
    });
  });

  describe('getActiveContexts', () => {
    it('should return all active execution IDs', () => {
      manager.create('exec_1');
      manager.create('exec_2');

      const active = manager.getActiveContexts();

      expect(active).toContain('exec_1');
      expect(active).toContain('exec_2');
    });
  });

  describe('getStats', () => {
    it('should return statistics', () => {
      manager.create('exec_1');
      manager.create('exec_2');
      manager.save('exec_1');

      const stats = manager.getStats();

      expect(stats.activeContexts).toBe(2);
      expect(stats.persistedContexts).toBe(1);
    });
  });
});
