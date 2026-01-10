jest.mock('../../db', () => ({ query: jest.fn() }));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../db');
const logger = require('../../utils/logger');
const WorkflowEngine = require('../../agents/workflows/WorkflowEngine');

describe('WorkflowEngine - Comprehensive Tests', () => {
  let workflowEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    workflowEngine = new WorkflowEngine();
  });

  // ============================================================================
  // CREATE WORKFLOW TESTS
  // ============================================================================
  describe('createWorkflow', () => {
    test('should create a new workflow with valid config', async () => {
      const organizationId = 'org-123';
      const config = {
        name: 'Test Workflow',
        description: 'A test workflow',
        steps: []
      };

      db.query.mockResolvedValueOnce({ id: 'workflow-1' });

      const result = await workflowEngine.createWorkflow(organizationId, config);

      expect(db.query).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalled();
      expect(result.id).toBe('workflow-1');
    });

    test('should create workflow with complex step structure', async () => {
      const organizationId = 'org-123';
      const config = {
        name: 'Complex Workflow',
        steps: [
          { type: 'condition', condition: 'x > 5' },
          { type: 'action', action: 'sendMessage' },
          { type: 'delay', duration: 5000 }
        ]
      };

      db.query.mockResolvedValueOnce({ id: 'workflow-2' });

      const result = await workflowEngine.createWorkflow(organizationId, config);

      expect(result).toBeDefined();
      expect(db.query).toHaveBeenCalled();
    });

    test('should set default status to active', async () => {
      const organizationId = 'org-123';
      const config = { name: 'Test' };

      db.query.mockResolvedValueOnce({ id: 'workflow-3', status: 'active' });

      const result = await workflowEngine.createWorkflow(organizationId, config);

      expect(result.status).toBe('active');
    });

    test('should include organization ID in workflow', async () => {
      const organizationId = 'org-456';
      const config = { name: 'Test' };

      db.query.mockResolvedValueOnce({ id: 'workflow-4', organizationId });

      const result = await workflowEngine.createWorkflow(organizationId, config);

      expect(result.organizationId).toBe(organizationId);
    });

    test('should throw error when config is invalid', async () => {
      const organizationId = 'org-123';
      const config = null;

      await expect(
        workflowEngine.createWorkflow(organizationId, config)
      ).rejects.toThrow();
    });

    test('should set created timestamp', async () => {
      const organizationId = 'org-123';
      const config = { name: 'Test' };

      db.query.mockResolvedValueOnce({
        id: 'workflow-5',
        createdAt: expect.any(String)
      });

      const result = await workflowEngine.createWorkflow(organizationId, config);

      expect(result.createdAt).toBeDefined();
    });

    test('should log workflow creation', async () => {
      const organizationId = 'org-123';
      const config = { name: 'Test' };

      db.query.mockResolvedValueOnce({ id: 'workflow-6' });

      await workflowEngine.createWorkflow(organizationId, config);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('workflow')
      );
    });
  });

  // ============================================================================
  // UPDATE WORKFLOW TESTS
  // ============================================================================
  describe('updateWorkflow', () => {
    test('should update workflow with new config', async () => {
      const workflowId = 'workflow-1';
      const config = { name: 'Updated Workflow' };

      db.query.mockResolvedValueOnce({ id: workflowId, ...config });

      const result = await workflowEngine.updateWorkflow(workflowId, config);

      expect(result.name).toBe('Updated Workflow');
      expect(db.query).toHaveBeenCalled();
    });

    test('should update workflow steps', async () => {
      const workflowId = 'workflow-1';
      const config = {
        steps: [
          { type: 'action', action: 'sendEmail' },
          { type: 'delay', duration: 1000 }
        ]
      };

      db.query.mockResolvedValueOnce({ id: workflowId, ...config });

      const result = await workflowEngine.updateWorkflow(workflowId, config);

      expect(result.steps).toHaveLength(2);
    });

    test('should update workflow triggers', async () => {
      const workflowId = 'workflow-1';
      const config = {
        triggers: [
          { type: 'message', source: 'slack' },
          { type: 'scheduled', cron: '0 0 * * *' }
        ]
      };

      db.query.mockResolvedValueOnce({ id: workflowId, ...config });

      const result = await workflowEngine.updateWorkflow(workflowId, config);

      expect(result.triggers).toHaveLength(2);
    });

    test('should preserve non-updated fields', async () => {
      const workflowId = 'workflow-1';
      const config = { name: 'Updated' };

      db.query.mockResolvedValueOnce({
        id: workflowId,
        name: 'Updated',
        organizationId: 'org-123',
        createdAt: '2024-01-01'
      });

      const result = await workflowEngine.updateWorkflow(workflowId, config);

      expect(result.organizationId).toBe('org-123');
      expect(result.createdAt).toBe('2024-01-01');
    });

    test('should set updatedAt timestamp', async () => {
      const workflowId = 'workflow-1';
      const config = { name: 'Updated' };

      db.query.mockResolvedValueOnce({
        id: workflowId,
        updatedAt: expect.any(String)
      });

      const result = await workflowEngine.updateWorkflow(workflowId, config);

      expect(result.updatedAt).toBeDefined();
    });

    test('should throw error when workflow not found', async () => {
      const workflowId = 'non-existent';
      const config = { name: 'Updated' };

      db.query.mockResolvedValueOnce(null);

      await expect(
        workflowEngine.updateWorkflow(workflowId, config)
      ).rejects.toThrow('not found');
    });

    test('should validate config before update', async () => {
      const workflowId = 'workflow-1';
      const config = { steps: 'invalid' }; // should be array

      await expect(
        workflowEngine.updateWorkflow(workflowId, config)
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // DELETE WORKFLOW TESTS
  // ============================================================================
  describe('deleteWorkflow', () => {
    test('should delete workflow successfully', async () => {
      const workflowId = 'workflow-1';

      db.query.mockResolvedValueOnce({ success: true });

      const result = await workflowEngine.deleteWorkflow(workflowId);

      expect(result.success).toBe(true);
      expect(db.query).toHaveBeenCalled();
    });

    test('should throw error when workflow not found', async () => {
      const workflowId = 'non-existent';

      db.query.mockResolvedValueOnce(null);

      await expect(
        workflowEngine.deleteWorkflow(workflowId)
      ).rejects.toThrow('not found');
    });

    test('should clean up associated data', async () => {
      const workflowId = 'workflow-1';

      db.query.mockResolvedValueOnce({ success: true });
      db.query.mockResolvedValueOnce({ success: true }); // cleanup call

      await workflowEngine.deleteWorkflow(workflowId);

      expect(db.query).toHaveBeenCalledTimes(2);
    });

    test('should log deletion', async () => {
      const workflowId = 'workflow-1';

      db.query.mockResolvedValueOnce({ success: true });

      await workflowEngine.deleteWorkflow(workflowId);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('deleted')
      );
    });

    test('should not allow deleting active running workflow', async () => {
      const workflowId = 'workflow-1';

      db.query.mockResolvedValueOnce({ status: 'running' });

      await expect(
        workflowEngine.deleteWorkflow(workflowId)
      ).rejects.toThrow();
    });

    test('should warn when deleting workflow with executions', async () => {
      const workflowId = 'workflow-1';

      db.query.mockResolvedValueOnce({ success: true });
      db.query.mockResolvedValueOnce([{ id: 'exec-1' }, { id: 'exec-2' }]); // executions found

      await workflowEngine.deleteWorkflow(workflowId);

      expect(logger.warn).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // GET WORKFLOW TESTS
  // ============================================================================
  describe('getWorkflow', () => {
    test('should retrieve workflow by ID', async () => {
      const workflowId = 'workflow-1';
      const workflow = {
        id: workflowId,
        name: 'Test Workflow',
        organizationId: 'org-123'
      };

      db.query.mockResolvedValueOnce(workflow);

      const result = await workflowEngine.getWorkflow(workflowId);

      expect(result).toEqual(workflow);
      expect(db.query).toHaveBeenCalled();
    });

    test('should return null for non-existent workflow', async () => {
      const workflowId = 'non-existent';

      db.query.mockResolvedValueOnce(null);

      const result = await workflowEngine.getWorkflow(workflowId);

      expect(result).toBeNull();
    });

    test('should include workflow steps', async () => {
      const workflowId = 'workflow-1';
      const workflow = {
        id: workflowId,
        steps: [
          { type: 'condition', id: 'step-1' },
          { type: 'action', id: 'step-2' }
        ]
      };

      db.query.mockResolvedValueOnce(workflow);

      const result = await workflowEngine.getWorkflow(workflowId);

      expect(result.steps).toHaveLength(2);
    });

    test('should include workflow triggers', async () => {
      const workflowId = 'workflow-1';
      const workflow = {
        id: workflowId,
        triggers: [{ type: 'message', source: 'slack' }]
      };

      db.query.mockResolvedValueOnce(workflow);

      const result = await workflowEngine.getWorkflow(workflowId);

      expect(result.triggers).toBeDefined();
    });

    test('should include workflow metadata', async () => {
      const workflowId = 'workflow-1';
      const workflow = {
        id: workflowId,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-02',
        createdBy: 'user-123'
      };

      db.query.mockResolvedValueOnce(workflow);

      const result = await workflowEngine.getWorkflow(workflowId);

      expect(result.createdAt).toBeDefined();
      expect(result.createdBy).toBeDefined();
    });
  });

  // ============================================================================
  // LIST WORKFLOWS TESTS
  // ============================================================================
  describe('listWorkflows', () => {
    test('should list all workflows for organization', async () => {
      const organizationId = 'org-123';
      const workflows = [
        { id: 'workflow-1', name: 'Workflow 1' },
        { id: 'workflow-2', name: 'Workflow 2' }
      ];

      db.query.mockResolvedValueOnce(workflows);

      const result = await workflowEngine.listWorkflows(organizationId);

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalled();
    });

    test('should return empty array when no workflows exist', async () => {
      const organizationId = 'org-123';

      db.query.mockResolvedValueOnce([]);

      const result = await workflowEngine.listWorkflows(organizationId);

      expect(result).toEqual([]);
    });

    test('should support pagination', async () => {
      const organizationId = 'org-123';
      const workflows = Array.from({ length: 10 }, (_, i) => ({
        id: `workflow-${i}`,
        name: `Workflow ${i}`
      }));

      db.query.mockResolvedValueOnce(workflows);

      const result = await workflowEngine.listWorkflows(organizationId, {
        page: 0,
        limit: 10
      });

      expect(result).toHaveLength(10);
    });

    test('should support filtering by status', async () => {
      const organizationId = 'org-123';
      const workflows = [
        { id: 'workflow-1', status: 'active' },
        { id: 'workflow-2', status: 'paused' }
      ];

      db.query.mockResolvedValueOnce([workflows[0]]);

      const result = await workflowEngine.listWorkflows(organizationId, {
        status: 'active'
      });

      expect(result[0].status).toBe('active');
    });

    test('should support sorting', async () => {
      const organizationId = 'org-123';
      const workflows = [
        { id: 'workflow-1', createdAt: '2024-01-02' },
        { id: 'workflow-2', createdAt: '2024-01-01' }
      ];

      db.query.mockResolvedValueOnce(workflows);

      const result = await workflowEngine.listWorkflows(organizationId, {
        sort: 'createdAt',
        order: 'desc'
      });

      expect(result[0].createdAt).toBe('2024-01-02');
    });

    test('should include workflow summaries', async () => {
      const organizationId = 'org-123';
      const workflows = [
        {
          id: 'workflow-1',
          name: 'Workflow 1',
          stepCount: 3,
          executionCount: 5
        }
      ];

      db.query.mockResolvedValueOnce(workflows);

      const result = await workflowEngine.listWorkflows(organizationId);

      expect(result[0].stepCount).toBeDefined();
      expect(result[0].executionCount).toBeDefined();
    });
  });

  // ============================================================================
  // VALIDATE WORKFLOW CONFIG TESTS
  // ============================================================================
  describe('validateWorkflowConfig', () => {
    test('should validate valid config', async () => {
      const config = {
        name: 'Test Workflow',
        description: 'A test workflow',
        steps: [
          { type: 'condition', condition: 'x > 5' },
          { type: 'action', action: 'sendMessage' }
        ]
      };

      const result = await workflowEngine.validateWorkflowConfig(config);

      expect(result.valid).toBe(true);
    });

    test('should reject config missing name', async () => {
      const config = {
        description: 'A test workflow',
        steps: []
      };

      const result = await workflowEngine.validateWorkflowConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('name'));
    });

    test('should reject config with invalid steps', async () => {
      const config = {
        name: 'Test',
        steps: [{ type: 'invalid_type' }]
      };

      const result = await workflowEngine.validateWorkflowConfig(config);

      expect(result.valid).toBe(false);
    });

    test('should validate condition steps', async () => {
      const config = {
        name: 'Test',
        steps: [
          { type: 'condition', condition: 'x > 5' }
        ]
      };

      const result = await workflowEngine.validateWorkflowConfig(config);

      expect(result.valid).toBe(true);
    });

    test('should validate action steps', async () => {
      const config = {
        name: 'Test',
        steps: [
          { type: 'action', action: 'sendMessage', message: 'Hello' }
        ]
      };

      const result = await workflowEngine.validateWorkflowConfig(config);

      expect(result.valid).toBe(true);
    });

    test('should validate delay steps', async () => {
      const config = {
        name: 'Test',
        steps: [
          { type: 'delay', duration: 5000 }
        ]
      };

      const result = await workflowEngine.validateWorkflowConfig(config);

      expect(result.valid).toBe(true);
    });

    test('should validate loop steps', async () => {
      const config = {
        name: 'Test',
        steps: [
          {
            type: 'loop',
            condition: 'i < 10',
            body: [
              { type: 'action', action: 'sendMessage' }
            ]
          }
        ]
      };

      const result = await workflowEngine.validateWorkflowConfig(config);

      expect(result.valid).toBe(true);
    });

    test('should validate variable assignment steps', async () => {
      const config = {
        name: 'Test',
        steps: [
          { type: 'variable', name: 'count', value: 0 }
        ]
      };

      const result = await workflowEngine.validateWorkflowConfig(config);

      expect(result.valid).toBe(true);
    });

    test('should reject invalid condition syntax', async () => {
      const config = {
        name: 'Test',
        steps: [
          { type: 'condition', condition: '>>><<<<' }
        ]
      };

      const result = await workflowEngine.validateWorkflowConfig(config);

      expect(result.valid).toBe(false);
    });

    test('should reject delay with invalid duration', async () => {
      const config = {
        name: 'Test',
        steps: [
          { type: 'delay', duration: -1000 }
        ]
      };

      const result = await workflowEngine.validateWorkflowConfig(config);

      expect(result.valid).toBe(false);
    });
  });

  // ============================================================================
  // EXECUTE WORKFLOW TESTS
  // ============================================================================
  describe('executeWorkflow', () => {
    test('should execute workflow successfully', async () => {
      const workflowId = 'workflow-1';
      const context = { userId: 'user-123' };

      db.query.mockResolvedValueOnce({
        id: workflowId,
        steps: [{ type: 'action', action: 'log' }]
      });

      const result = await workflowEngine.executeWorkflow(workflowId, context);

      expect(result).toBeDefined();
      expect(result.status).toBe('success');
    });

    test('should create execution record', async () => {
      const workflowId = 'workflow-1';
      const context = { userId: 'user-123' };

      db.query.mockResolvedValueOnce({
        id: workflowId,
        steps: []
      });
      db.query.mockResolvedValueOnce({ id: 'execution-1' });

      await workflowEngine.executeWorkflow(workflowId, context);

      expect(db.query).toHaveBeenCalledTimes(2);
    });

    test('should pass context through workflow steps', async () => {
      const workflowId = 'workflow-1';
      const context = { message: 'Hello', count: 5 };

      db.query.mockResolvedValueOnce({
        id: workflowId,
        steps: [
          { type: 'action', action: 'sendMessage' },
          { type: 'variable', name: 'count', value: 'count + 1' }
        ]
      });

      const result = await workflowEngine.executeWorkflow(workflowId, context);

      expect(result.context).toBeDefined();
    });

    test('should handle workflow with multiple steps', async () => {
      const workflowId = 'workflow-1';
      const context = {};

      db.query.mockResolvedValueOnce({
        id: workflowId,
        steps: [
          { type: 'condition', condition: 'true' },
          { type: 'action', action: 'sendMessage' },
          { type: 'delay', duration: 100 },
          { type: 'action', action: 'log' }
        ]
      });

      const result = await workflowEngine.executeWorkflow(workflowId, context);

      expect(result.stepsExecuted).toBe(4);
    });

    test('should handle workflow with conditional branching', async () => {
      const workflowId = 'workflow-1';
      const context = { value: 10 };

      db.query.mockResolvedValueOnce({
        id: workflowId,
        steps: [
          {
            type: 'condition',
            condition: 'value > 5',
            thenSteps: [{ type: 'action', action: 'sendMessage' }],
            elseSteps: [{ type: 'action', action: 'log' }]
          }
        ]
      });

      const result = await workflowEngine.executeWorkflow(workflowId, context);

      expect(result.status).toBe('success');
    });

    test('should stop execution on error', async () => {
      const workflowId = 'workflow-1';
      const context = {};

      db.query.mockResolvedValueOnce({
        id: workflowId,
        steps: [
          { type: 'action', action: 'throwError' }
        ]
      });

      const result = await workflowEngine.executeWorkflow(workflowId, context);

      expect(result.status).toBe('error');
    });

    test('should log execution events', async () => {
      const workflowId = 'workflow-1';
      const context = {};

      db.query.mockResolvedValueOnce({
        id: workflowId,
        steps: []
      });

      await workflowEngine.executeWorkflow(workflowId, context);

      expect(logger.info).toHaveBeenCalled();
    });

    test('should track execution duration', async () => {
      const workflowId = 'workflow-1';
      const context = {};

      db.query.mockResolvedValueOnce({
        id: workflowId,
        steps: [{ type: 'delay', duration: 100 }]
      });

      const result = await workflowEngine.executeWorkflow(workflowId, context);

      expect(result.duration).toBeGreaterThanOrEqual(100);
    });

    test('should throw error for non-existent workflow', async () => {
      const workflowId = 'non-existent';
      const context = {};

      db.query.mockResolvedValueOnce(null);

      await expect(
        workflowEngine.executeWorkflow(workflowId, context)
      ).rejects.toThrow('not found');
    });
  });

  // ============================================================================
  // EXECUTE STEP TESTS
  // ============================================================================
  describe('executeStep', () => {
    test('should execute action step', async () => {
      const step = { type: 'action', action: 'sendMessage', message: 'Hello' };
      const context = {};

      const result = await workflowEngine.executeStep(step, context);

      expect(result.executed).toBe(true);
    });

    test('should execute condition step', async () => {
      const step = { type: 'condition', condition: '5 > 3' };
      const context = {};

      const result = await workflowEngine.executeStep(step, context);

      expect(result.result).toBe(true);
    });

    test('should execute delay step', async () => {
      const step = { type: 'delay', duration: 100 };
      const context = {};

      const start = Date.now();
      await workflowEngine.executeStep(step, context);
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(100);
    });

    test('should execute loop step', async () => {
      const step = {
        type: 'loop',
        condition: 'i < 3',
        body: [{ type: 'action', action: 'log' }]
      };
      const context = {};

      const result = await workflowEngine.executeStep(step, context);

      expect(result.iterations).toBe(3);
    });

    test('should execute variable assignment step', async () => {
      const step = { type: 'variable', name: 'count', value: 10 };
      const context = {};

      const result = await workflowEngine.executeStep(step, context);

      expect(result.context.count).toBe(10);
    });

    test('should pass context to step execution', async () => {
      const step = { type: 'action', action: 'sendMessage' };
      const context = { userId: 'user-123', message: 'Hello' };

      const result = await workflowEngine.executeStep(step, context);

      expect(result.context.userId).toBe('user-123');
    });

    test('should handle step errors gracefully', async () => {
      const step = { type: 'action', action: 'invalid' };
      const context = {};

      const result = await workflowEngine.executeStep(step, context);

      expect(result.error).toBeDefined();
    });

    test('should update context after step execution', async () => {
      const step = { type: 'variable', name: 'newVar', value: 'test' };
      const context = { existingVar: 'value' };

      const result = await workflowEngine.executeStep(step, context);

      expect(result.context.newVar).toBe('test');
      expect(result.context.existingVar).toBe('value');
    });
  });

  // ============================================================================
  // EVALUATE CONDITION TESTS
  // ============================================================================
  describe('evaluateCondition', () => {
    test('should evaluate simple numeric comparison', async () => {
      const condition = '5 > 3';
      const context = {};

      const result = await workflowEngine.evaluateCondition(condition, context);

      expect(result).toBe(true);
    });

    test('should evaluate condition with context variables', async () => {
      const condition = 'age >= 18';
      const context = { age: 25 };

      const result = await workflowEngine.evaluateCondition(condition, context);

      expect(result).toBe(true);
    });

    test('should evaluate boolean expressions', async () => {
      const condition = 'active && verified';
      const context = { active: true, verified: true };

      const result = await workflowEngine.evaluateCondition(condition, context);

      expect(result).toBe(true);
    });

    test('should evaluate OR expressions', async () => {
      const condition = 'admin || moderator';
      const context = { admin: false, moderator: true };

      const result = await workflowEngine.evaluateCondition(condition, context);

      expect(result).toBe(true);
    });

    test('should evaluate string comparisons', async () => {
      const condition = 'status === "active"';
      const context = { status: 'active' };

      const result = await workflowEngine.evaluateCondition(condition, context);

      expect(result).toBe(true);
    });

    test('should evaluate negation', async () => {
      const condition = '!isDeleted';
      const context = { isDeleted: false };

      const result = await workflowEngine.evaluateCondition(condition, context);

      expect(result).toBe(true);
    });

    test('should evaluate complex expressions', async () => {
      const condition = '(age > 18 && status === "active") || admin';
      const context = { age: 25, status: 'active', admin: false };

      const result = await workflowEngine.evaluateCondition(condition, context);

      expect(result).toBe(true);
    });

    test('should handle missing context variables', async () => {
      const condition = 'unknownVar > 5';
      const context = {};

      await expect(
        workflowEngine.evaluateCondition(condition, context)
      ).rejects.toThrow();
    });

    test('should evaluate with functions in context', async () => {
      const condition = 'count > 0 && name.length > 0';
      const context = { count: 5, name: 'test' };

      const result = await workflowEngine.evaluateCondition(condition, context);

      expect(result).toBe(true);
    });
  });

  // ============================================================================
  // EXECUTE ACTION TESTS
  // ============================================================================
  describe('executeAction', () => {
    test('should execute sendMessage action', async () => {
      const action = { type: 'sendMessage', message: 'Hello', channel: 'slack' };
      const context = {};

      const result = await workflowEngine.executeAction(action, context);

      expect(result.executed).toBe(true);
    });

    test('should execute API call action', async () => {
      const action = {
        type: 'apiCall',
        url: 'https://api.example.com/data',
        method: 'POST',
        body: { key: 'value' }
      };
      const context = {};

      const result = await workflowEngine.executeAction(action, context);

      expect(result).toBeDefined();
    });

    test('should execute log action', async () => {
      const action = { type: 'log', message: 'Workflow executed' };
      const context = {};

      await workflowEngine.executeAction(action, context);

      expect(logger.info).toHaveBeenCalled();
    });

    test('should execute variable assignment action', async () => {
      const action = { type: 'setVariable', name: 'count', value: 10 };
      const context = {};

      const result = await workflowEngine.executeAction(action, context);

      expect(result.context.count).toBe(10);
    });

    test('should pass context to action', async () => {
      const action = { type: 'sendMessage', message: 'Hello {name}' };
      const context = { name: 'John' };

      const result = await workflowEngine.executeAction(action, context);

      expect(result.context.name).toBe('John');
    });

    test('should support action with conditional execution', async () => {
      const action = {
        type: 'sendMessage',
        message: 'Hello',
        condition: 'enabled'
      };
      const context = { enabled: true };

      const result = await workflowEngine.executeAction(action, context);

      expect(result.executed).toBe(true);
    });

    test('should skip action if condition fails', async () => {
      const action = {
        type: 'sendMessage',
        message: 'Hello',
        condition: 'enabled'
      };
      const context = { enabled: false };

      const result = await workflowEngine.executeAction(action, context);

      expect(result.skipped).toBe(true);
    });

    test('should handle action errors', async () => {
      const action = { type: 'apiCall', url: 'invalid-url' };
      const context = {};

      const result = await workflowEngine.executeAction(action, context);

      expect(result.error).toBeDefined();
    });

    test('should return action response', async () => {
      const action = { type: 'apiCall', url: 'https://api.example.com/data' };
      const context = {};

      const result = await workflowEngine.executeAction(action, context);

      expect(result.response).toBeDefined();
    });
  });

  // ============================================================================
  // HANDLE TRIGGER TESTS
  // ============================================================================
  describe('handleTrigger', () => {
    test('should handle message trigger', async () => {
      const trigger = { type: 'message', source: 'slack', pattern: 'hello' };
      const event = { text: 'hello world', source: 'slack' };

      const result = await workflowEngine.handleTrigger(trigger, event);

      expect(result.triggered).toBe(true);
    });

    test('should handle scheduled trigger', async () => {
      const trigger = { type: 'scheduled', cron: '0 0 * * *' };
      const event = { timestamp: Date.now() };

      const result = await workflowEngine.handleTrigger(trigger, event);

      expect(result).toBeDefined();
    });

    test('should handle webhook trigger', async () => {
      const trigger = { type: 'webhook', path: '/webhook/test' };
      const event = { body: { key: 'value' }, path: '/webhook/test' };

      const result = await workflowEngine.handleTrigger(trigger, event);

      expect(result.triggered).toBe(true);
    });

    test('should match pattern in message trigger', async () => {
      const trigger = { type: 'message', pattern: 'test.*' };
      const event = { text: 'test123' };

      const result = await workflowEngine.handleTrigger(trigger, event);

      expect(result.triggered).toBe(true);
    });

    test('should not trigger on non-matching pattern', async () => {
      const trigger = { type: 'message', pattern: 'hello' };
      const event = { text: 'goodbye' };

      const result = await workflowEngine.handleTrigger(trigger, event);

      expect(result.triggered).toBe(false);
    });

    test('should extract trigger data from event', async () => {
      const trigger = { type: 'message', source: 'slack' };
      const event = { text: 'hello', userId: 'user-123', source: 'slack' };

      const result = await workflowEngine.handleTrigger(trigger, event);

      expect(result.data).toBeDefined();
    });

    test('should support multiple trigger sources', async () => {
      const trigger = { type: 'message', sources: ['slack', 'telegram'] };
      const event = { text: 'hello', source: 'telegram' };

      const result = await workflowEngine.handleTrigger(trigger, event);

      expect(result.triggered).toBe(true);
    });
  });

  // ============================================================================
  // PAUSE WORKFLOW TESTS
  // ============================================================================
  describe('pauseWorkflow', () => {
    test('should pause active workflow', async () => {
      const workflowId = 'workflow-1';

      db.query.mockResolvedValueOnce({ id: workflowId, status: 'paused' });

      const result = await workflowEngine.pauseWorkflow(workflowId);

      expect(result.status).toBe('paused');
    });

    test('should throw error if workflow not found', async () => {
      const workflowId = 'non-existent';

      db.query.mockResolvedValueOnce(null);

      await expect(
        workflowEngine.pauseWorkflow(workflowId)
      ).rejects.toThrow('not found');
    });

    test('should log pause event', async () => {
      const workflowId = 'workflow-1';

      db.query.mockResolvedValueOnce({ id: workflowId, status: 'paused' });

      await workflowEngine.pauseWorkflow(workflowId);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('paused')
      );
    });

    test('should not pause already paused workflow', async () => {
      const workflowId = 'workflow-1';

      db.query.mockResolvedValueOnce({ id: workflowId, status: 'paused' });

      await expect(
        workflowEngine.pauseWorkflow(workflowId)
      ).rejects.toThrow();
    });

    test('should update pausedAt timestamp', async () => {
      const workflowId = 'workflow-1';

      db.query.mockResolvedValueOnce({
        id: workflowId,
        status: 'paused',
        pausedAt: expect.any(String)
      });

      const result = await workflowEngine.pauseWorkflow(workflowId);

      expect(result.pausedAt).toBeDefined();
    });
  });

  // ============================================================================
  // RESUME WORKFLOW TESTS
  // ============================================================================
  describe('resumeWorkflow', () => {
    test('should resume paused workflow', async () => {
      const workflowId = 'workflow-1';

      db.query.mockResolvedValueOnce({ id: workflowId, status: 'active' });

      const result = await workflowEngine.resumeWorkflow(workflowId);

      expect(result.status).toBe('active');
    });

    test('should throw error if workflow not found', async () => {
      const workflowId = 'non-existent';

      db.query.mockResolvedValueOnce(null);

      await expect(
        workflowEngine.resumeWorkflow(workflowId)
      ).rejects.toThrow('not found');
    });

    test('should log resume event', async () => {
      const workflowId = 'workflow-1';

      db.query.mockResolvedValueOnce({ id: workflowId, status: 'active' });

      await workflowEngine.resumeWorkflow(workflowId);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('resumed')
      );
    });

    test('should clear pausedAt timestamp', async () => {
      const workflowId = 'workflow-1';

      db.query.mockResolvedValueOnce({
        id: workflowId,
        status: 'active',
        pausedAt: null
      });

      const result = await workflowEngine.resumeWorkflow(workflowId);

      expect(result.pausedAt).toBeNull();
    });

    test('should not resume active workflow', async () => {
      const workflowId = 'workflow-1';

      db.query.mockResolvedValueOnce({ id: workflowId, status: 'active' });

      await expect(
        workflowEngine.resumeWorkflow(workflowId)
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // CLONE WORKFLOW TESTS
  // ============================================================================
  describe('cloneWorkflow', () => {
    test('should clone workflow successfully', async () => {
      const sourceWorkflowId = 'workflow-1';
      const cloneName = 'Cloned Workflow';

      db.query.mockResolvedValueOnce({
        id: sourceWorkflowId,
        name: 'Original',
        steps: [{ type: 'action' }]
      });
      db.query.mockResolvedValueOnce({
        id: 'workflow-clone-1',
        name: cloneName
      });

      const result = await workflowEngine.cloneWorkflow(
        sourceWorkflowId,
        cloneName
      );

      expect(result.id).not.toBe(sourceWorkflowId);
      expect(result.name).toBe(cloneName);
    });

    test('should clone workflow steps', async () => {
      const sourceWorkflowId = 'workflow-1';
      const steps = [
        { type: 'condition', condition: 'x > 5' },
        { type: 'action', action: 'sendMessage' }
      ];

      db.query.mockResolvedValueOnce({
        id: sourceWorkflowId,
        steps
      });
      db.query.mockResolvedValueOnce({
        id: 'workflow-clone-1',
        steps
      });

      const result = await workflowEngine.cloneWorkflow(sourceWorkflowId);

      expect(result.steps).toEqual(steps);
    });

    test('should clone workflow triggers', async () => {
      const sourceWorkflowId = 'workflow-1';
      const triggers = [{ type: 'message', source: 'slack' }];

      db.query.mockResolvedValueOnce({
        id: sourceWorkflowId,
        triggers
      });
      db.query.mockResolvedValueOnce({
        id: 'workflow-clone-1',
        triggers
      });

      const result = await workflowEngine.cloneWorkflow(sourceWorkflowId);

      expect(result.triggers).toEqual(triggers);
    });

    test('should throw error if source workflow not found', async () => {
      const sourceWorkflowId = 'non-existent';

      db.query.mockResolvedValueOnce(null);

      await expect(
        workflowEngine.cloneWorkflow(sourceWorkflowId)
      ).rejects.toThrow('not found');
    });

    test('should generate unique ID for clone', async () => {
      const sourceWorkflowId = 'workflow-1';

      db.query.mockResolvedValueOnce({
        id: sourceWorkflowId,
        name: 'Original'
      });
      db.query.mockResolvedValueOnce({
        id: 'workflow-clone-1',
        name: 'Original Copy'
      });

      const result = await workflowEngine.cloneWorkflow(sourceWorkflowId);

      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^workflow-/);
    });

    test('should set default clone name if not provided', async () => {
      const sourceWorkflowId = 'workflow-1';

      db.query.mockResolvedValueOnce({
        id: sourceWorkflowId,
        name: 'Original'
      });
      db.query.mockResolvedValueOnce({
        id: 'workflow-clone-1',
        name: 'Original Copy'
      });

      const result = await workflowEngine.cloneWorkflow(sourceWorkflowId);

      expect(result.name).toMatch(/Copy/);
    });

    test('should reset execution metadata on clone', async () => {
      const sourceWorkflowId = 'workflow-1';

      db.query.mockResolvedValueOnce({
        id: sourceWorkflowId,
        executionCount: 100,
        lastExecuted: '2024-01-01'
      });
      db.query.mockResolvedValueOnce({
        id: 'workflow-clone-1',
        executionCount: 0
      });

      const result = await workflowEngine.cloneWorkflow(sourceWorkflowId);

      expect(result.executionCount).toBe(0);
    });

    test('should preserve organization', async () => {
      const sourceWorkflowId = 'workflow-1';

      db.query.mockResolvedValueOnce({
        id: sourceWorkflowId,
        organizationId: 'org-123'
      });
      db.query.mockResolvedValueOnce({
        id: 'workflow-clone-1',
        organizationId: 'org-123'
      });

      const result = await workflowEngine.cloneWorkflow(sourceWorkflowId);

      expect(result.organizationId).toBe('org-123');
    });
  });

  // ============================================================================
  // GET WORKFLOW LOGS TESTS
  // ============================================================================
  describe('getWorkflowLogs', () => {
    test('should retrieve workflow execution logs', async () => {
      const workflowId = 'workflow-1';
      const logs = [
        { id: 'log-1', message: 'Workflow started', timestamp: '2024-01-01' },
        { id: 'log-2', message: 'Step executed', timestamp: '2024-01-02' }
      ];

      db.query.mockResolvedValueOnce(logs);

      const result = await workflowEngine.getWorkflowLogs(workflowId);

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalled();
    });

    test('should return empty array if no logs exist', async () => {
      const workflowId = 'workflow-1';

      db.query.mockResolvedValueOnce([]);

      const result = await workflowEngine.getWorkflowLogs(workflowId);

      expect(result).toEqual([]);
    });

    test('should support pagination', async () => {
      const workflowId = 'workflow-1';
      const logs = Array.from({ length: 10 }, (_, i) => ({
        id: `log-${i}`,
        message: `Message ${i}`
      }));

      db.query.mockResolvedValueOnce(logs);

      const result = await workflowEngine.getWorkflowLogs(workflowId, {
        page: 0,
        limit: 10
      });

      expect(result).toHaveLength(10);
    });

    test('should support filtering by log level', async () => {
      const workflowId = 'workflow-1';
      const logs = [
        { id: 'log-1', level: 'error', message: 'Error occurred' }
      ];

      db.query.mockResolvedValueOnce(logs);

      const result = await workflowEngine.getWorkflowLogs(workflowId, {
        level: 'error'
      });

      expect(result[0].level).toBe('error');
    });

    test('should support filtering by date range', async () => {
      const workflowId = 'workflow-1';
      const logs = [
        { id: 'log-1', timestamp: '2024-01-15T10:00:00Z' }
      ];

      db.query.mockResolvedValueOnce(logs);

      const result = await workflowEngine.getWorkflowLogs(workflowId, {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      });

      expect(result).toBeDefined();
    });

    test('should include step execution details in logs', async () => {
      const workflowId = 'workflow-1';
      const logs = [
        {
          id: 'log-1',
          stepId: 'step-1',
          stepType: 'action',
          status: 'success'
        }
      ];

      db.query.mockResolvedValueOnce(logs);

      const result = await workflowEngine.getWorkflowLogs(workflowId);

      expect(result[0].stepId).toBeDefined();
      expect(result[0].status).toBeDefined();
    });
  });

  // ============================================================================
  // COMPREHENSIVE INTEGRATION TESTS
  // ============================================================================
  describe('Comprehensive Integration Tests', () => {
    test('should execute complete workflow lifecycle', async () => {
      const organizationId = 'org-123';
      const config = {
        name: 'Lifecycle Test',
        steps: [
          { type: 'condition', condition: 'true' },
          { type: 'action', action: 'log' },
          { type: 'variable', name: 'result', value: 'success' }
        ]
      };

      // Create
      db.query.mockResolvedValueOnce({ id: 'workflow-1', ...config });

      // Execute
      db.query.mockResolvedValueOnce({ id: 'workflow-1', ...config });
      db.query.mockResolvedValueOnce({ id: 'execution-1' });

      // Get logs
      db.query.mockResolvedValueOnce([
        { id: 'log-1', message: 'Executed' }
      ]);

      const created = await workflowEngine.createWorkflow(
        organizationId,
        config
      );
      const executed = await workflowEngine.executeWorkflow(created.id, {});
      const logs = await workflowEngine.getWorkflowLogs(created.id);

      expect(created.id).toBeDefined();
      expect(executed.status).toBe('success');
      expect(logs).toBeDefined();
    });

    test('should handle workflow with all step types', async () => {
      const workflowId = 'workflow-1';
      const context = { count: 0, enabled: true };

      db.query.mockResolvedValueOnce({
        id: workflowId,
        steps: [
          { type: 'condition', condition: 'enabled', id: 'step-1' },
          { type: 'variable', name: 'count', value: 1, id: 'step-2' },
          { type: 'action', action: 'log', message: 'Count: 1', id: 'step-3' },
          { type: 'delay', duration: 100, id: 'step-4' },
          {
            type: 'loop',
            condition: 'i < 2',
            body: [{ type: 'action', action: 'log' }],
            id: 'step-5'
          }
        ]
      });

      const result = await workflowEngine.executeWorkflow(workflowId, context);

      expect(result.stepsExecuted).toBeGreaterThan(0);
      expect(result.status).toBe('success');
    });
  });
});
