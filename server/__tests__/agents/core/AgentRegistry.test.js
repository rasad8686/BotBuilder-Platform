/**
 * AgentRegistry Tests
 * Tests for server/agents/core/AgentRegistry.js
 */

const AgentRegistry = require('../../../agents/core/AgentRegistry');

describe('AgentRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  describe('register', () => {
    it('should register an agent', () => {
      const agent = { id: 1, name: 'TestAgent', role: 'worker' };
      const result = registry.register(agent);

      expect(result).toBe(true);
      expect(registry.has(1)).toBe(true);
    });

    it('should throw error if agent has no id', () => {
      expect(() => registry.register({ name: 'NoId' })).toThrow('Agent must have an id');
    });

    it('should throw error if agent is null', () => {
      expect(() => registry.register(null)).toThrow('Agent must have an id');
    });

    it('should index agent by role', () => {
      const agent = { id: 1, role: 'analyzer' };
      registry.register(agent);

      const agents = registry.getByRole('analyzer');
      expect(agents).toHaveLength(1);
      expect(agents[0].id).toBe(1);
    });

    it('should handle agents without role', () => {
      const agent = { id: 1, name: 'NoRole' };
      registry.register(agent);

      expect(registry.has(1)).toBe(true);
    });
  });

  describe('get', () => {
    it('should get agent by id', () => {
      const agent = { id: 1, name: 'TestAgent' };
      registry.register(agent);

      const result = registry.get(1);
      expect(result).toBe(agent);
    });

    it('should return null for non-existent id', () => {
      expect(registry.get(999)).toBeNull();
    });
  });

  describe('getAll', () => {
    it('should return all agents', () => {
      registry.register({ id: 1, name: 'Agent1' });
      registry.register({ id: 2, name: 'Agent2' });

      const agents = registry.getAll();
      expect(agents).toHaveLength(2);
    });

    it('should return empty array when no agents', () => {
      expect(registry.getAll()).toEqual([]);
    });
  });

  describe('getByRole', () => {
    it('should return agents with matching role', () => {
      registry.register({ id: 1, role: 'worker' });
      registry.register({ id: 2, role: 'worker' });
      registry.register({ id: 3, role: 'manager' });

      const workers = registry.getByRole('worker');
      expect(workers).toHaveLength(2);
    });

    it('should return empty array for non-existent role', () => {
      expect(registry.getByRole('nonexistent')).toEqual([]);
    });
  });

  describe('remove', () => {
    it('should remove agent by id', () => {
      registry.register({ id: 1, name: 'TestAgent', role: 'worker' });

      const result = registry.remove(1);

      expect(result).toBe(true);
      expect(registry.has(1)).toBe(false);
    });

    it('should return false for non-existent id', () => {
      expect(registry.remove(999)).toBe(false);
    });

    it('should remove agent from role index', () => {
      registry.register({ id: 1, role: 'worker' });
      registry.remove(1);

      expect(registry.getByRole('worker')).toEqual([]);
    });

    it('should clean up empty role index', () => {
      registry.register({ id: 1, role: 'worker' });
      registry.remove(1);

      expect(registry.getRoles()).not.toContain('worker');
    });
  });

  describe('clear', () => {
    it('should remove all agents', () => {
      registry.register({ id: 1, role: 'worker' });
      registry.register({ id: 2, role: 'manager' });

      registry.clear();

      expect(registry.count()).toBe(0);
      expect(registry.getRoles()).toEqual([]);
    });
  });

  describe('has', () => {
    it('should return true for existing agent', () => {
      registry.register({ id: 1 });
      expect(registry.has(1)).toBe(true);
    });

    it('should return false for non-existent agent', () => {
      expect(registry.has(999)).toBe(false);
    });
  });

  describe('count', () => {
    it('should return correct count', () => {
      registry.register({ id: 1 });
      registry.register({ id: 2 });

      expect(registry.count()).toBe(2);
    });

    it('should return 0 for empty registry', () => {
      expect(registry.count()).toBe(0);
    });
  });

  describe('getRoles', () => {
    it('should return unique roles', () => {
      registry.register({ id: 1, role: 'worker' });
      registry.register({ id: 2, role: 'manager' });
      registry.register({ id: 3, role: 'worker' });

      const roles = registry.getRoles();
      expect(roles).toContain('worker');
      expect(roles).toContain('manager');
      expect(roles).toHaveLength(2);
    });
  });

  describe('find', () => {
    it('should find agents matching predicate', () => {
      registry.register({ id: 1, name: 'Agent1', active: true });
      registry.register({ id: 2, name: 'Agent2', active: false });
      registry.register({ id: 3, name: 'Agent3', active: true });

      const active = registry.find(agent => agent.active);
      expect(active).toHaveLength(2);
    });

    it('should return empty array when no matches', () => {
      registry.register({ id: 1, active: false });

      const active = registry.find(agent => agent.active);
      expect(active).toEqual([]);
    });
  });

  describe('toJSON', () => {
    it('should convert registry to JSON', () => {
      registry.register({ id: 1, name: 'Agent1' });
      registry.register({ id: 2, name: 'Agent2' });

      const json = registry.toJSON();
      expect(json).toHaveLength(2);
    });

    it('should call toJSON on agents if available', () => {
      const agent = {
        id: 1,
        name: 'Agent1',
        toJSON: () => ({ id: 1, serialized: true })
      };
      registry.register(agent);

      const json = registry.toJSON();
      expect(json[0].serialized).toBe(true);
    });
  });
});
