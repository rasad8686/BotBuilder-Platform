/**
 * Orchestration Manager Tests
 * Tests for server/services/OrchestrationManager.js
 */

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
  });
});
