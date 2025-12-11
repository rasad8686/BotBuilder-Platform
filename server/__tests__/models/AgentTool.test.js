/**
 * AgentTool Model Tests
 * Tests for server/models/AgentTool.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

const db = require('../../db');
const AgentTool = require('../../models/AgentTool');

describe('AgentTool Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('should create agent-tool assignment', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, agent_id: 1, tool_id: 2 }] });

      const result = await AgentTool.create({
        agent_id: 1,
        tool_id: 2,
        is_enabled: true,
        priority: 5
      });

      expect(result.id).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agent_tools'),
        [1, 2, true, 5]
      );
    });

    it('should use default values', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await AgentTool.create({ agent_id: 1, tool_id: 2 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [1, 2, true, 0]
      );
    });

    it('should handle upsert on conflict', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await AgentTool.create({ agent_id: 1, tool_id: 2 });

      expect(db.query.mock.calls[0][0]).toContain('ON CONFLICT');
    });
  });

  describe('findById()', () => {
    it('should return assignment if found', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, agent_id: 1, tool_id: 2 }] });

      const result = await AgentTool.findById(1);

      expect(result.id).toBe(1);
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await AgentTool.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('findByAgentId()', () => {
    it('should return all tool assignments for agent', async () => {
      const mockAssignments = [
        { id: 1, agent_id: 1, tool_name: 'Tool 1' },
        { id: 2, agent_id: 1, tool_name: 'Tool 2' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockAssignments });

      const result = await AgentTool.findByAgentId(1);

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('agent_id = $1'),
        [1]
      );
    });

    it('should return empty array if no assignments', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await AgentTool.findByAgentId(999);

      expect(result).toEqual([]);
    });
  });

  describe('findEnabledByAgentId()', () => {
    it('should return only enabled tools', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, is_enabled: true }] });

      const result = await AgentTool.findEnabledByAgentId(1);

      expect(result).toHaveLength(1);
      expect(db.query.mock.calls[0][0]).toContain('is_enabled = true');
    });
  });

  describe('findByToolId()', () => {
    it('should return all agents assigned to tool', async () => {
      const mockAssignments = [
        { id: 1, tool_id: 1, agent_name: 'Agent 1' },
        { id: 2, tool_id: 1, agent_name: 'Agent 2' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockAssignments });

      const result = await AgentTool.findByToolId(1);

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('tool_id = $1'),
        [1]
      );
    });
  });

  describe('exists()', () => {
    it('should return true if assignment exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await AgentTool.exists(1, 2);

      expect(result).toBe(true);
    });

    it('should return false if assignment does not exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await AgentTool.exists(999, 999);

      expect(result).toBe(false);
    });
  });

  describe('update()', () => {
    it('should update is_enabled', async () => {
      db.query
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 1, is_enabled: false }] });

      const result = await AgentTool.update(1, { is_enabled: false });

      expect(result.is_enabled).toBe(false);
    });

    it('should update priority', async () => {
      db.query
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 1, priority: 10 }] });

      const result = await AgentTool.update(1, { priority: 10 });

      expect(result.priority).toBe(10);
    });

    it('should return current assignment if no updates', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await AgentTool.update(1, {});

      expect(result.id).toBe(1);
    });
  });

  describe('delete()', () => {
    it('should delete assignment', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });

      await AgentTool.delete(1);

      expect(db.query).toHaveBeenCalledWith(
        'DELETE FROM agent_tools WHERE id = $1',
        [1]
      );
    });
  });

  describe('deleteByAgentAndTool()', () => {
    it('should delete by agent and tool', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });

      await AgentTool.deleteByAgentAndTool(1, 2);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('agent_id = $1 AND tool_id = $2'),
        [1, 2]
      );
    });
  });

  describe('deleteByAgentId()', () => {
    it('should delete all assignments for agent', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 3 });

      await AgentTool.deleteByAgentId(1);

      expect(db.query).toHaveBeenCalledWith(
        'DELETE FROM agent_tools WHERE agent_id = $1',
        [1]
      );
    });
  });

  describe('deleteByToolId()', () => {
    it('should delete all assignments for tool', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 3 });

      await AgentTool.deleteByToolId(1);

      expect(db.query).toHaveBeenCalledWith(
        'DELETE FROM agent_tools WHERE tool_id = $1',
        [1]
      );
    });
  });

  describe('bulkAssign()', () => {
    it('should assign multiple tools to agent', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 2 }] })
        .mockResolvedValueOnce({ rows: [{ id: 3 }] });

      const result = await AgentTool.bulkAssign(1, [1, 2, 3]);

      expect(result).toHaveLength(3);
      expect(db.query).toHaveBeenCalledTimes(3);
    });

    it('should use custom options', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await AgentTool.bulkAssign(1, [1], { is_enabled: false, priority: 5 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [1, 1, false, 5]
      );
    });
  });
});
