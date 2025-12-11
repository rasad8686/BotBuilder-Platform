/**
 * Agent Model Tests
 * Tests for server/models/Agent.js
 */

// Mock the database BEFORE importing the model
jest.mock('../../db', () => ({
  query: jest.fn()
}));

const db = require('../../db');
const Agent = require('../../models/Agent');

describe('Agent Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // create()
  // ========================================
  describe('create()', () => {
    it('should create a new agent with all fields', async () => {
      const mockAgentRow = {
        id: 1,
        bot_id: 5,
        name: 'Test Agent',
        role: 'assistant',
        system_prompt: 'You are helpful',
        model_provider: 'openai',
        model_name: 'gpt-4',
        temperature: 0.7,
        max_tokens: 2048,
        capabilities: '[]',
        tools: '[]',
        is_active: true
      };

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // INSERT
        .mockResolvedValueOnce({ rows: [mockAgentRow] }); // SELECT for findById

      const result = await Agent.create({
        bot_id: 5,
        name: 'Test Agent',
        role: 'assistant',
        system_prompt: 'You are helpful'
      });

      expect(result.id).toBe(1);
      expect(result.name).toBe('Test Agent');
      expect(db.query).toHaveBeenCalledTimes(2);
    });

    it('should use default values for optional fields', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, capabilities: '[]', tools: '[]' }] });

      await Agent.create({
        bot_id: 5,
        name: 'Test',
        role: 'assistant',
        system_prompt: 'Test'
      });

      // Check that defaults are used
      const insertCall = db.query.mock.calls[0];
      expect(insertCall[1]).toContain('openai'); // default model_provider
      expect(insertCall[1]).toContain('gpt-4'); // default model_name
      expect(insertCall[1]).toContain(0.7); // default temperature
      expect(insertCall[1]).toContain(2048); // default max_tokens
    });

    it('should allow custom model parameters', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, capabilities: '[]', tools: '[]' }] });

      await Agent.create({
        bot_id: 5,
        name: 'Test',
        role: 'assistant',
        system_prompt: 'Test',
        model_provider: 'anthropic',
        model_name: 'claude-3-sonnet',
        temperature: 0.5,
        max_tokens: 4000
      });

      const insertCall = db.query.mock.calls[0];
      expect(insertCall[1]).toContain('anthropic');
      expect(insertCall[1]).toContain('claude-3-sonnet');
      expect(insertCall[1]).toContain(0.5);
      expect(insertCall[1]).toContain(4000);
    });

    it('should stringify capabilities and tools arrays', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, capabilities: '["search","code"]', tools: '["calculator"]' }] });

      await Agent.create({
        bot_id: 5,
        name: 'Test',
        role: 'assistant',
        system_prompt: 'Test',
        capabilities: ['search', 'code'],
        tools: ['calculator']
      });

      const insertCall = db.query.mock.calls[0];
      expect(insertCall[1]).toContain('["search","code"]');
      expect(insertCall[1]).toContain('["calculator"]');
    });

    it('should set is_active to true by default', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, capabilities: '[]', tools: '[]' }] });

      await Agent.create({
        bot_id: 5,
        name: 'Test',
        role: 'assistant',
        system_prompt: 'Test'
      });

      const insertCall = db.query.mock.calls[0];
      expect(insertCall[1]).toContain(true); // is_active default
    });

    it('should allow is_active to be set to false', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, capabilities: '[]', tools: '[]', is_active: false }] });

      await Agent.create({
        bot_id: 5,
        name: 'Test',
        role: 'assistant',
        system_prompt: 'Test',
        is_active: false
      });

      const insertCall = db.query.mock.calls[0];
      expect(insertCall[1]).toContain(false);
    });
  });

  // ========================================
  // findById()
  // ========================================
  describe('findById()', () => {
    it('should return agent if found', async () => {
      const mockAgent = {
        id: 1,
        name: 'Test Agent',
        capabilities: '["search"]',
        tools: '["calculator"]'
      };
      db.query.mockResolvedValueOnce({ rows: [mockAgent] });

      const result = await Agent.findById(1);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Test Agent');
      expect(result.capabilities).toEqual(['search']);
      expect(result.tools).toEqual(['calculator']);
    });

    it('should return null if agent not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Agent.findById(999);

      expect(result).toBeNull();
    });

    it('should parse JSON capabilities and tools', async () => {
      const mockAgent = {
        id: 1,
        capabilities: '["a","b","c"]',
        tools: '["x","y"]'
      };
      db.query.mockResolvedValueOnce({ rows: [mockAgent] });

      const result = await Agent.findById(1);

      expect(Array.isArray(result.capabilities)).toBe(true);
      expect(Array.isArray(result.tools)).toBe(true);
      expect(result.capabilities).toHaveLength(3);
    });
  });

  // ========================================
  // findByBotId()
  // ========================================
  describe('findByBotId()', () => {
    it('should return all agents for a bot', async () => {
      const mockAgents = [
        { id: 1, bot_id: 5, name: 'Agent 1', capabilities: '[]', tools: '[]' },
        { id: 2, bot_id: 5, name: 'Agent 2', capabilities: '[]', tools: '[]' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockAgents });

      const result = await Agent.findByBotId(5);

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE bot_id = $1'),
        [5]
      );
    });

    it('should return empty array if no agents', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Agent.findByBotId(999);

      expect(result).toEqual([]);
    });
  });

  // ========================================
  // findByTenant()
  // ========================================
  describe('findByTenant()', () => {
    it('should return all agents for a tenant', async () => {
      const mockAgents = [
        { id: 1, name: 'Agent 1', capabilities: '[]', tools: '[]' },
        { id: 2, name: 'Agent 2', capabilities: '[]', tools: '[]' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockAgents });

      const result = await Agent.findByTenant(1);

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('organization_id = $1'),
        [1]
      );
    });

    it('should return empty array if no agents', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Agent.findByTenant(999);

      expect(result).toEqual([]);
    });
  });

  // ========================================
  // findActiveByBotId()
  // ========================================
  describe('findActiveByBotId()', () => {
    it('should return only active agents', async () => {
      const mockAgents = [
        { id: 1, name: 'Active Agent', is_active: true, capabilities: '[]', tools: '[]' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockAgents });

      const result = await Agent.findActiveByBotId(5);

      expect(result).toHaveLength(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('is_active = true'),
        [5]
      );
    });
  });

  // ========================================
  // findByRole()
  // ========================================
  describe('findByRole()', () => {
    it('should return agents by role', async () => {
      const mockAgents = [
        { id: 1, name: 'Assistant', role: 'assistant', capabilities: '[]', tools: '[]' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockAgents });

      const result = await Agent.findByRole(5, 'assistant');

      expect(result).toHaveLength(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('role = $2'),
        [5, 'assistant']
      );
    });
  });

  // ========================================
  // update()
  // ========================================
  describe('update()', () => {
    it('should update agent name', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Updated', capabilities: '[]', tools: '[]' }] }); // SELECT

      const result = await Agent.update(1, { name: 'Updated' });

      expect(result.name).toBe('Updated');
      expect(db.query.mock.calls[0][0]).toContain('name = $1');
    });

    it('should update multiple fields', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, capabilities: '[]', tools: '[]' }] });

      await Agent.update(1, {
        name: 'Updated',
        role: 'specialist',
        temperature: 0.5
      });

      const updateQuery = db.query.mock.calls[0][0];
      expect(updateQuery).toContain('name = $1');
      expect(updateQuery).toContain('role = $2');
      expect(updateQuery).toContain('temperature = $3');
    });

    it('should stringify capabilities on update', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, capabilities: '["new"]', tools: '[]' }] });

      await Agent.update(1, { capabilities: ['new'] });

      expect(db.query.mock.calls[0][1]).toContain('["new"]');
    });

    it('should stringify tools on update', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, capabilities: '[]', tools: '["newtool"]' }] });

      await Agent.update(1, { tools: ['newtool'] });

      expect(db.query.mock.calls[0][1]).toContain('["newtool"]');
    });

    it('should update is_active', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, is_active: false, capabilities: '[]', tools: '[]' }] });

      await Agent.update(1, { is_active: false });

      const updateValues = db.query.mock.calls[0][1];
      expect(updateValues).toContain(false);
    });
  });

  // ========================================
  // delete()
  // ========================================
  describe('delete()', () => {
    it('should delete agent by id', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });

      await Agent.delete(1);

      expect(db.query).toHaveBeenCalledWith(
        'DELETE FROM agents WHERE id = $1',
        [1]
      );
    });
  });

  // ========================================
  // parseAgent()
  // ========================================
  describe('parseAgent()', () => {
    it('should parse JSON string capabilities', () => {
      const raw = {
        id: 1,
        capabilities: '["a","b"]',
        tools: '["x"]'
      };

      const result = Agent.parseAgent(raw);

      expect(result.capabilities).toEqual(['a', 'b']);
      expect(result.tools).toEqual(['x']);
    });

    it('should handle already parsed capabilities', () => {
      const raw = {
        id: 1,
        capabilities: ['a', 'b'],
        tools: ['x']
      };

      const result = Agent.parseAgent(raw);

      expect(result.capabilities).toEqual(['a', 'b']);
      expect(result.tools).toEqual(['x']);
    });

    it('should default to empty arrays for null/undefined', () => {
      const raw = {
        id: 1,
        capabilities: null,
        tools: undefined
      };

      const result = Agent.parseAgent(raw);

      expect(result.capabilities).toEqual([]);
      expect(result.tools).toEqual([]);
    });

    it('should preserve other fields', () => {
      const raw = {
        id: 1,
        name: 'Test',
        role: 'assistant',
        capabilities: '[]',
        tools: '[]'
      };

      const result = Agent.parseAgent(raw);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Test');
      expect(result.role).toBe('assistant');
    });
  });
});
