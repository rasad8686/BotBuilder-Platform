/**
 * AgentExecutionStep Model Tests
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

const db = require('../../db');
const AgentExecutionStep = require('../../models/AgentExecutionStep');

describe('AgentExecutionStep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create an execution step', async () => {
      const stepData = {
        execution_id: 1,
        agent_id: 2,
        step_order: 0,
        status: 'running',
        input: { message: 'test' }
      };

      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          ...stepData,
          input: JSON.stringify(stepData.input),
          output: '{}'
        }]
      });

      const result = await AgentExecutionStep.create(stepData);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agent_execution_steps'),
        expect.any(Array)
      );
      expect(result.execution_id).toBe(1);
    });

    it('should use default values', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          execution_id: 1,
          agent_id: 2,
          step_order: 0,
          status: 'pending',
          input: '{}',
          output: '{}'
        }]
      });

      await AgentExecutionStep.create({ execution_id: 1, agent_id: 2 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([1, 2, 0, 'pending', '{}', '{}', null, 0, 0])
      );
    });
  });

  describe('findById', () => {
    it('should return step by id', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          execution_id: 1,
          input: '{"test":true}',
          output: '{}'
        }]
      });

      const result = await AgentExecutionStep.findById(1);

      expect(result.id).toBe(1);
      expect(result.input).toEqual({ test: true });
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await AgentExecutionStep.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('findByExecutionId', () => {
    it('should return steps for execution ordered by step_order', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, execution_id: 1, step_order: 0, input: '{}', output: '{}' },
          { id: 2, execution_id: 1, step_order: 1, input: '{}', output: '{}' }
        ]
      });

      const results = await AgentExecutionStep.findByExecutionId(1);

      expect(results).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY step_order ASC'),
        [1]
      );
    });
  });

  describe('findByAgentId', () => {
    it('should return steps for agent', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, agent_id: 2, input: '{}', output: '{}' }]
      });

      const results = await AgentExecutionStep.findByAgentId(2);

      expect(results).toHaveLength(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [2, 50]
      );
    });

    it('should respect limit parameter', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await AgentExecutionStep.findByAgentId(2, 10);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [2, 10]
      );
    });
  });

  describe('update', () => {
    it('should update step fields', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 1, status: 'completed', input: '{}', output: '{}' }]
        });

      await AgentExecutionStep.update(1, { status: 'completed' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE agent_execution_steps'),
        expect.arrayContaining(['completed', 1])
      );
    });

    it('should update multiple fields', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 1, input: '{}', output: '{}' }]
        });

      await AgentExecutionStep.update(1, {
        status: 'completed',
        output: { result: 'done' },
        reasoning: 'Agent completed task',
        tokens_used: 100,
        duration_ms: 1000
      });

      expect(db.query).toHaveBeenCalled();
    });
  });

  describe('complete', () => {
    it('should mark step as completed', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 1, status: 'completed', input: '{}', output: '{}' }]
        });

      await AgentExecutionStep.complete(1, { result: 'done' }, 'Task completed', 100, 5000);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('status'),
        expect.arrayContaining(['completed'])
      );
    });
  });

  describe('fail', () => {
    it('should mark step as failed', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 1, status: 'failed', input: '{}', output: '{}' }]
        });

      await AgentExecutionStep.fail(1, 'Error occurred', 1000);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        expect.arrayContaining(['failed'])
      );
    });
  });

  describe('delete', () => {
    it('should delete step and return true', async () => {
      db.query.mockResolvedValue({ rowCount: 1 });

      const result = await AgentExecutionStep.delete(1);

      expect(result).toBe(true);
    });

    it('should return false if not found', async () => {
      db.query.mockResolvedValue({ rowCount: 0 });

      const result = await AgentExecutionStep.delete(999);

      expect(result).toBe(false);
    });
  });

  describe('deleteByExecutionId', () => {
    it('should delete all steps for execution', async () => {
      db.query.mockResolvedValue({ rowCount: 5 });

      const result = await AgentExecutionStep.deleteByExecutionId(1);

      expect(result).toBe(5);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE execution_id = $1'),
        [1]
      );
    });
  });

  describe('parseStep', () => {
    it('should parse JSON string fields', () => {
      const step = {
        id: 1,
        input: '{"message":"test"}',
        output: '{"result":"success"}'
      };

      const result = AgentExecutionStep.parseStep(step);

      expect(result.input).toEqual({ message: 'test' });
      expect(result.output).toEqual({ result: 'success' });
    });

    it('should handle already parsed fields', () => {
      const step = {
        id: 1,
        input: { message: 'test' },
        output: { result: 'success' }
      };

      const result = AgentExecutionStep.parseStep(step);

      expect(result.input).toEqual({ message: 'test' });
      expect(result.output).toEqual({ result: 'success' });
    });

    it('should handle null/undefined fields', () => {
      const step = {
        id: 1,
        input: null,
        output: undefined
      };

      const result = AgentExecutionStep.parseStep(step);

      expect(result.input).toEqual({});
      expect(result.output).toEqual({});
    });
  });
});
