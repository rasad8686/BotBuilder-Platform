/**
 * AgentWorkflow Model Tests
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

const db = require('../../db');
const AgentWorkflow = require('../../models/AgentWorkflow');

describe('AgentWorkflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a workflow', async () => {
      const workflowData = {
        bot_id: 1,
        name: 'Test Workflow',
        workflow_type: 'sequential',
        agents_config: [{ id: 1 }],
        flow_config: { test: true },
        entry_agent_id: 1
      };

      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          ...workflowData,
          agents_config: JSON.stringify(workflowData.agents_config),
          flow_config: JSON.stringify(workflowData.flow_config),
          is_default: false,
          is_active: true
        }]
      });

      const result = await AgentWorkflow.create(workflowData);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agent_workflows'),
        expect.any(Array)
      );
      expect(result.name).toBe('Test Workflow');
    });

    it('should use default values', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          bot_id: 1,
          name: 'Test',
          workflow_type: 'sequential',
          agents_config: '[]',
          flow_config: '{}',
          is_default: false,
          is_active: true
        }]
      });

      await AgentWorkflow.create({ bot_id: 1, name: 'Test' });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([1, 'Test', 'sequential', '[]', '{}', null, false, true])
      );
    });
  });

  describe('findById', () => {
    it('should return workflow by id', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          name: 'Test',
          agents_config: '[]',
          flow_config: '{}'
        }]
      });

      const result = await AgentWorkflow.findById(1);

      expect(result.id).toBe(1);
      expect(result.agents_config).toEqual([]);
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await AgentWorkflow.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('findByBotId', () => {
    it('should return all workflows for bot', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, name: 'Workflow 1', agents_config: '[]', flow_config: '{}' },
          { id: 2, name: 'Workflow 2', agents_config: '[]', flow_config: '{}' }
        ]
      });

      const results = await AgentWorkflow.findByBotId(1);

      expect(results).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE bot_id = $1'),
        [1]
      );
    });
  });

  describe('findActiveByBotId', () => {
    it('should return only active workflows', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Active', agents_config: '[]', flow_config: '{}' }]
      });

      const results = await AgentWorkflow.findActiveByBotId(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('is_active = true'),
        [1]
      );
      expect(results).toHaveLength(1);
    });
  });

  describe('findDefaultByBotId', () => {
    it('should return default workflow', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Default', is_default: true, agents_config: '[]', flow_config: '{}' }]
      });

      const result = await AgentWorkflow.findDefaultByBotId(1);

      expect(result.is_default).toBe(true);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('is_default = true'),
        [1]
      );
    });

    it('should return null if no default', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await AgentWorkflow.findDefaultByBotId(1);

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update workflow fields', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: 'Updated', agents_config: '[]', flow_config: '{}' }]
        });

      const result = await AgentWorkflow.update(1, { name: 'Updated' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE agent_workflows'),
        expect.arrayContaining(['Updated', 1])
      );
    });

    it('should update multiple fields', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: 'New', workflow_type: 'parallel', agents_config: '[]', flow_config: '{}' }]
        });

      await AgentWorkflow.update(1, {
        name: 'New',
        workflow_type: 'parallel',
        agents_config: [{ id: 1 }],
        flow_config: { test: true },
        entry_agent_id: 2,
        is_default: true,
        is_active: false
      });

      expect(db.query).toHaveBeenCalled();
    });
  });

  describe('setAsDefault', () => {
    it('should unset other defaults and set new default', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 1, is_default: true, agents_config: '[]', flow_config: '{}' }]
        });

      const result = await AgentWorkflow.setAsDefault(1, 10);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('is_default = false'),
        [10]
      );
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('is_default = true'),
        [1]
      );
    });
  });

  describe('delete', () => {
    it('should delete workflow and return true', async () => {
      db.query.mockResolvedValue({ rowCount: 1 });

      const result = await AgentWorkflow.delete(1);

      expect(result).toBe(true);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM agent_workflows'),
        [1]
      );
    });

    it('should return false if not found', async () => {
      db.query.mockResolvedValue({ rowCount: 0 });

      const result = await AgentWorkflow.delete(999);

      expect(result).toBe(false);
    });
  });

  describe('parseWorkflow', () => {
    it('should parse JSON string fields', () => {
      const workflow = {
        id: 1,
        name: 'Test',
        agents_config: '[{"id":1}]',
        flow_config: '{"test":true}'
      };

      const result = AgentWorkflow.parseWorkflow(workflow);

      expect(result.agents_config).toEqual([{ id: 1 }]);
      expect(result.flow_config).toEqual({ test: true });
    });

    it('should handle already parsed fields', () => {
      const workflow = {
        id: 1,
        name: 'Test',
        agents_config: [{ id: 1 }],
        flow_config: { test: true }
      };

      const result = AgentWorkflow.parseWorkflow(workflow);

      expect(result.agents_config).toEqual([{ id: 1 }]);
      expect(result.flow_config).toEqual({ test: true });
    });

    it('should handle null/undefined fields', () => {
      const workflow = {
        id: 1,
        name: 'Test',
        agents_config: null,
        flow_config: undefined
      };

      const result = AgentWorkflow.parseWorkflow(workflow);

      expect(result.agents_config).toEqual([]);
      expect(result.flow_config).toEqual({});
    });
  });
});
