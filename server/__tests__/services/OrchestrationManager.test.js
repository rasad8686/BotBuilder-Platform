/**
 * Orchestration Manager Tests
 * Tests for server/services/OrchestrationManager.js
 */

// Use fake timers to prevent setInterval from running
jest.useFakeTimers();

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../models/WorkflowExecution', () => ({
  create: jest.fn(),
  update: jest.fn(),
  findById: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../db');
const manager = require('../../services/OrchestrationManager');

describe('OrchestrationManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Orchestration CRUD', () => {
    describe('createOrchestration', () => {
      it('should create orchestration', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{ id: 1, name: 'Test Orchestration', bot_id: 1, entry_flow_id: 1 }]
        });

        const result = await manager.createOrchestration(1, 'Test Orchestration', 1, 'Description');

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO flow_orchestrations'),
          [1, 'Test Orchestration', 'Description', 1]
        );
        expect(result.name).toBe('Test Orchestration');
      });
    });

    describe('getOrchestration', () => {
      it('should get orchestration by ID', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{ id: 1, name: 'Test' }]
        });

        const result = await manager.getOrchestration(1);

        expect(result.id).toBe(1);
      });

      it('should return null if not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const result = await manager.getOrchestration(999);

        expect(result).toBeNull();
      });
    });

    describe('listOrchestrations', () => {
      it('should list orchestrations for bot', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{ id: 1 }, { id: 2 }]
        });

        const result = await manager.listOrchestrations(1);

        expect(result.length).toBe(2);
      });
    });

    describe('updateOrchestration', () => {
      it('should update orchestration', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{ id: 1, name: 'Updated' }]
        });

        const result = await manager.updateOrchestration(1, { name: 'Updated' });

        expect(result.name).toBe('Updated');
      });

      it('should return null if not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const result = await manager.updateOrchestration(999, { name: 'Test' });

        expect(result).toBeNull();
      });
    });

    describe('deleteOrchestration', () => {
      it('should delete orchestration', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 1 });

        const result = await manager.deleteOrchestration(1);

        expect(result).toBe(true);
      });

      it('should return false if not found', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 0 });

        const result = await manager.deleteOrchestration(999);

        expect(result).toBe(false);
      });
    });
  });

  describe('Transitions', () => {
    describe('addTransition', () => {
      it('should add transition', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{ id: 1, orchestration_id: 1, from_flow_id: 1, to_flow_id: 2 }]
        });

        const result = await manager.addTransition(1, 1, 2, 'intent', { intent: 'greeting' });

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO flow_transitions'),
          [1, 1, 2, 'intent', expect.any(String), 0]
        );
      });
    });

    describe('removeTransition', () => {
      it('should remove transition', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 1 });

        const result = await manager.removeTransition(1);

        expect(result).toBe(true);
      });
    });

    describe('getTransitions', () => {
      it('should get transitions for orchestration', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{ id: 1 }, { id: 2 }]
        });

        const result = await manager.getTransitions(1);

        expect(result.length).toBe(2);
      });
    });
  });

  describe('Variables', () => {
    describe('addVariable', () => {
      it('should add variable', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{ id: 1, name: 'test_var', type: 'string' }]
        });

        const result = await manager.addVariable(1, 'test_var', 'string', 'default');

        expect(result.name).toBe('test_var');
      });
    });

    describe('getVariables', () => {
      it('should get variables for orchestration', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{ id: 1, name: 'var1' }, { id: 2, name: 'var2' }]
        });

        const result = await manager.getVariables(1);

        expect(result.length).toBe(2);
      });
    });
  });

  describe('Session Variables', () => {
    it('should set session variable', () => {
      manager.setVariableValue('test-session-1', 'key1', 'value1');
      const value = manager.getVariableValue('test-session-1', 'key1');
      expect(value).toBe('value1');
    });

    it('should return undefined for missing variable', () => {
      const value = manager.getVariableValue('test-session-999', 'missing');
      expect(value).toBeUndefined();
    });

    it('should get all session variables', () => {
      manager.setVariableValue('test-session-2', 'key1', 'value1');
      manager.setVariableValue('test-session-2', 'key2', 'value2');
      const vars = manager.getAllSessionVariables('test-session-2');
      expect(vars.key1).toBe('value1');
      expect(vars.key2).toBe('value2');
    });

    it('should clear session', () => {
      manager.setVariableValue('test-session-3', 'key', 'value');
      manager.clearSessionVariables('test-session-3');
      const value = manager.getVariableValue('test-session-3', 'key');
      expect(value).toBeUndefined();
    });

    it('should return empty object for non-existent session', () => {
      const vars = manager.getAllSessionVariables('non-existent-session');
      expect(vars).toEqual({});
    });
  });

  describe('evaluateCondition', () => {
    it('should evaluate equals condition', () => {
      const context = { variables: { status: 'active' } };
      expect(manager.evaluateCondition({ variable: 'status', operator: 'equals', value: 'active' }, context)).toBe(true);
      expect(manager.evaluateCondition({ variable: 'status', operator: 'equals', value: 'inactive' }, context)).toBe(false);
    });

    it('should evaluate not_equals condition', () => {
      const context = { variables: { status: 'active' } };
      expect(manager.evaluateCondition({ variable: 'status', operator: 'not_equals', value: 'inactive' }, context)).toBe(true);
      expect(manager.evaluateCondition({ variable: 'status', operator: 'not_equals', value: 'active' }, context)).toBe(false);
    });

    it('should evaluate contains condition', () => {
      const context = { variables: { message: 'Hello World' } };
      expect(manager.evaluateCondition({ variable: 'message', operator: 'contains', value: 'World' }, context)).toBe(true);
      expect(manager.evaluateCondition({ variable: 'message', operator: 'contains', value: 'Goodbye' }, context)).toBe(false);
    });

    it('should evaluate greater_than condition', () => {
      const context = { variables: { count: 10 } };
      expect(manager.evaluateCondition({ variable: 'count', operator: 'greater_than', value: 5 }, context)).toBe(true);
      expect(manager.evaluateCondition({ variable: 'count', operator: 'greater_than', value: 15 }, context)).toBe(false);
    });

    it('should evaluate less_than condition', () => {
      const context = { variables: { count: 10 } };
      expect(manager.evaluateCondition({ variable: 'count', operator: 'less_than', value: 15 }, context)).toBe(true);
      expect(manager.evaluateCondition({ variable: 'count', operator: 'less_than', value: 5 }, context)).toBe(false);
    });

    it('should evaluate is_empty condition', () => {
      expect(manager.evaluateCondition({ variable: 'empty', operator: 'is_empty', value: null }, { variables: { empty: '' } })).toBe(true);
      expect(manager.evaluateCondition({ variable: 'full', operator: 'is_empty', value: null }, { variables: { full: 'data' } })).toBe(false);
    });

    it('should evaluate is_not_empty condition', () => {
      expect(manager.evaluateCondition({ variable: 'full', operator: 'is_not_empty', value: null }, { variables: { full: 'data' } })).toBe(true);
      expect(manager.evaluateCondition({ variable: 'empty', operator: 'is_not_empty', value: null }, { variables: { empty: '' } })).toBeFalsy();
    });

    it('should return false for unknown operator', () => {
      const context = { variables: { status: 'active' } };
      expect(manager.evaluateCondition({ variable: 'status', operator: 'unknown', value: 'active' }, context)).toBe(false);
    });
  });

  describe('evaluateTransition', () => {
    it('should evaluate on_complete trigger', async () => {
      const transition = { trigger_type: 'on_complete', trigger_value: '{}' };
      expect(await manager.evaluateTransition(transition, { flowCompleted: true })).toBe(true);
      expect(await manager.evaluateTransition(transition, { flowCompleted: false })).toBe(false);
    });

    it('should evaluate on_condition trigger', async () => {
      const transition = {
        trigger_type: 'on_condition',
        trigger_value: JSON.stringify({ variable: 'status', operator: 'equals', value: 'done' })
      };
      expect(await manager.evaluateTransition(transition, { variables: { status: 'done' } })).toBe(true);
      expect(await manager.evaluateTransition(transition, { variables: { status: 'pending' } })).toBe(false);
    });

    it('should evaluate on_intent trigger', async () => {
      const transition = {
        trigger_type: 'on_intent',
        trigger_value: JSON.stringify({ intent: 'greeting' })
      };
      expect(await manager.evaluateTransition(transition, { detectedIntent: 'greeting' })).toBe(true);
      expect(await manager.evaluateTransition(transition, { detectedIntent: 'goodbye' })).toBe(false);
    });

    it('should evaluate on_keyword trigger', async () => {
      const transition = {
        trigger_type: 'on_keyword',
        trigger_value: JSON.stringify({ keywords: ['help', 'support'] })
      };
      expect(await manager.evaluateTransition(transition, { input: 'I need help' })).toBe(true);
      expect(await manager.evaluateTransition(transition, { input: 'I need SUPPORT' })).toBe(true);
      expect(await manager.evaluateTransition(transition, { input: 'Hello there' })).toBe(false);
    });

    it('should return false for unknown trigger type', async () => {
      const transition = { trigger_type: 'unknown', trigger_value: '{}' };
      expect(await manager.evaluateTransition(transition, {})).toBe(false);
    });

    it('should handle already parsed trigger_value', async () => {
      const transition = {
        trigger_type: 'on_intent',
        trigger_value: { intent: 'greeting' }
      };
      expect(await manager.evaluateTransition(transition, { detectedIntent: 'greeting' })).toBe(true);
    });
  });

  describe('determineNextFlow', () => {
    it('should find matching transition', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          to_flow_id: 2,
          trigger_type: 'on_complete',
          trigger_value: '{}'
        }]
      });

      const result = await manager.determineNextFlow(1, 1, {
        sessionId: 'test-session',
        flowCompleted: true
      });

      expect(result.shouldTransition).toBe(true);
      expect(result.nextFlowId).toBe(2);
    });

    it('should return no transition when no match', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          to_flow_id: 2,
          trigger_type: 'on_complete',
          trigger_value: '{}'
        }]
      });

      const result = await manager.determineNextFlow(1, 1, {
        sessionId: 'test-session',
        flowCompleted: false
      });

      expect(result.shouldTransition).toBe(false);
      expect(result.nextFlowId).toBeNull();
    });

    it('should check transitions in priority order', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, to_flow_id: 3, trigger_type: 'on_intent', trigger_value: '{"intent":"help"}', priority: 10 },
          { id: 2, to_flow_id: 2, trigger_type: 'on_complete', trigger_value: '{}', priority: 5 }
        ]
      });

      const result = await manager.determineNextFlow(1, 1, {
        sessionId: 'test-session',
        flowCompleted: true,
        detectedIntent: 'greeting'
      });

      expect(result.nextFlowId).toBe(2);
    });
  });

  describe('executeOrchestration', () => {
    const WorkflowExecution = require('../../models/WorkflowExecution');

    beforeEach(() => {
      WorkflowExecution.create.mockResolvedValue({ id: 100 });
      WorkflowExecution.complete = jest.fn().mockResolvedValue({});
    });

    it('should throw error if orchestration not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(manager.executeOrchestration(999, 'session-1', {}))
        .rejects.toThrow('Orchestration not found');
    });

    it('should execute orchestration successfully', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: 'Test', bot_id: 1, entry_flow_id: 1, is_active: true }]
        })
        .mockResolvedValueOnce({ rows: [] }); // getVariables

      const result = await manager.executeOrchestration(1, 'session-exec-1', { message: 'hello' });

      expect(result.success).toBe(true);
      expect(result.orchestration.name).toBe('Test');
      expect(result.currentFlowId).toBe(1);
    });

    it('should auto-activate inactive orchestration', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: 'Test', bot_id: 1, entry_flow_id: 1, is_active: false }]
        })
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: 'Test', is_active: true }]
        })
        .mockResolvedValueOnce({ rows: [] }); // getVariables

      const result = await manager.executeOrchestration(1, 'session-exec-2', {});

      expect(result.success).toBe(true);
    });

    it('should load default variable values', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: 'Test', bot_id: 1, entry_flow_id: 1, is_active: true }]
        })
        .mockResolvedValueOnce({
          rows: [
            { name: 'var1', default_value: 'default1' },
            { name: 'var2', default_value: null }
          ]
        });

      await manager.executeOrchestration(1, 'session-exec-3', {});

      const value = manager.getVariableValue('session-exec-3', 'var1');
      expect(value).toBe('default1');
    });

    it('should continue from current flow if set', async () => {
      // First set current flow in session
      manager.setVariableValue('session-exec-4', '_current_flow_id', 5);

      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: 'Test', bot_id: 1, entry_flow_id: 1, is_active: true }]
        });

      const result = await manager.executeOrchestration(1, 'session-exec-4', {});

      expect(result.currentFlowId).toBe(5);
    });
  });
});
