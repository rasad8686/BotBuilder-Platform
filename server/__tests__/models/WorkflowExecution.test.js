/**
 * WorkflowExecution Model Tests
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

const db = require('../../db');
const WorkflowExecution = require('../../models/WorkflowExecution');

describe('WorkflowExecution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create an execution', async () => {
      const execData = {
        workflow_id: 1,
        bot_id: 1,
        status: 'running',
        input: { message: 'test' }
      };

      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          ...execData,
          input: JSON.stringify(execData.input),
          output: '{}',
          total_tokens: 0,
          total_cost: 0,
          duration_ms: 0
        }]
      });

      const result = await WorkflowExecution.create(execData);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO workflow_executions'),
        expect.any(Array)
      );
      expect(result.workflow_id).toBe(1);
    });

    it('should use default values', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          workflow_id: 1,
          bot_id: 1,
          status: 'pending',
          input: '{}',
          output: '{}',
          total_tokens: 0,
          total_cost: 0,
          duration_ms: 0
        }]
      });

      await WorkflowExecution.create({ workflow_id: 1, bot_id: 1 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([1, 1, 'pending', '{}', '{}', 0, 0, 0, null])
      );
    });
  });

  describe('findById', () => {
    it('should return execution by id', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          workflow_id: 1,
          status: 'completed',
          input: '{"test":true}',
          output: '{"result":"success"}'
        }]
      });

      const result = await WorkflowExecution.findById(1);

      expect(result.id).toBe(1);
      expect(result.input).toEqual({ test: true });
      expect(result.output).toEqual({ result: 'success' });
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await WorkflowExecution.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('findByWorkflowId', () => {
    it('should return executions for workflow', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, workflow_id: 1, input: '{}', output: '{}' },
          { id: 2, workflow_id: 1, input: '{}', output: '{}' }
        ]
      });

      const results = await WorkflowExecution.findByWorkflowId(1);

      expect(results).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE workflow_id = $1'),
        [1, 50]
      );
    });

    it('should respect limit parameter', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await WorkflowExecution.findByWorkflowId(1, 10);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [1, 10]
      );
    });
  });

  describe('findByBotId', () => {
    it('should return executions for bot', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, bot_id: 1, input: '{}', output: '{}' }]
      });

      const results = await WorkflowExecution.findByBotId(1);

      expect(results).toHaveLength(1);
    });

    it('should apply all filters', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await WorkflowExecution.findByBotId(1, {
        workflow_id: 2,
        status: 'completed',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        limit: 20
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('workflow_id'),
        expect.arrayContaining([1, 2, 'completed', '2024-01-01', '2024-12-31', 20])
      );
    });
  });

  describe('update', () => {
    it('should update execution fields', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 1, status: 'completed', input: '{}', output: '{}' }]
        });

      await WorkflowExecution.update(1, { status: 'completed' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE workflow_executions'),
        expect.arrayContaining(['completed', 1])
      );
    });

    it('should update multiple fields', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 1, input: '{}', output: '{}' }]
        });

      await WorkflowExecution.update(1, {
        status: 'completed',
        output: { result: 'done' },
        total_tokens: 100,
        total_cost: 0.01,
        duration_ms: 1000,
        error: null
      });

      expect(db.query).toHaveBeenCalled();
    });
  });

  describe('complete', () => {
    it('should mark execution as completed', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 1, status: 'completed', input: '{}', output: '{}' }]
        });

      await WorkflowExecution.complete(1, { result: 'done' }, 100, 5000);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('status'),
        expect.arrayContaining(['completed'])
      );
    });

    it('should handle string output', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 1, status: 'completed', input: '{}', output: '{}' }]
        });

      await WorkflowExecution.complete(1, 'String result', 100, 5000);

      expect(db.query).toHaveBeenCalled();
    });
  });

  describe('fail', () => {
    it('should mark execution as failed', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 1, status: 'failed', input: '{}', output: '{}' }]
        });

      await WorkflowExecution.fail(1, 'Error occurred', 1000);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        expect.arrayContaining(['failed', 'Error occurred', 1000])
      );
    });
  });

  describe('delete', () => {
    it('should delete execution and return true', async () => {
      db.query.mockResolvedValue({ rowCount: 1 });

      const result = await WorkflowExecution.delete(1);

      expect(result).toBe(true);
    });

    it('should return false if not found', async () => {
      db.query.mockResolvedValue({ rowCount: 0 });

      const result = await WorkflowExecution.delete(999);

      expect(result).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return execution statistics', async () => {
      db.query.mockResolvedValue({
        rows: [{
          total_executions: '10',
          successful: '8',
          failed: '2',
          avg_duration: '1500',
          total_tokens: '5000',
          total_cost: '0.50'
        }]
      });

      const stats = await WorkflowExecution.getStats(1);

      expect(stats.total_executions).toBe('10');
      expect(stats.successful).toBe('8');
      expect(stats.failed).toBe('2');
    });
  });

  describe('parseExecution', () => {
    it('should parse JSON string fields', () => {
      const execution = {
        id: 1,
        input: '{"message":"test"}',
        output: '{"result":"success"}',
        duration_ms: 1000
      };

      const result = WorkflowExecution.parseExecution(execution);

      expect(result.input).toEqual({ message: 'test' });
      expect(result.output).toEqual({ result: 'success' });
      expect(result.duration).toBe(1000);
    });

    it('should handle already parsed fields', () => {
      const execution = {
        id: 1,
        input: { message: 'test' },
        output: { result: 'success' }
      };

      const result = WorkflowExecution.parseExecution(execution);

      expect(result.input).toEqual({ message: 'test' });
      expect(result.output).toEqual({ result: 'success' });
    });

    it('should handle invalid JSON', () => {
      const execution = {
        id: 1,
        input: 'invalid json {',
        output: 'not json either'
      };

      const result = WorkflowExecution.parseExecution(execution);

      expect(result.input).toEqual({ raw: 'invalid json {' });
      expect(result.output).toEqual({ raw: 'not json either' });
    });

    it('should handle null/undefined fields', () => {
      const execution = {
        id: 1,
        input: null,
        output: undefined
      };

      const result = WorkflowExecution.parseExecution(execution);

      expect(result.input).toEqual({});
      expect(result.output).toEqual({});
    });
  });
});
