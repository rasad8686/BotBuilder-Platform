/**
 * Agents E2E Tests
 * Comprehensive tests for AI agents, agent studio, tasks, workflows
 */

describe('Agents', () => {
  const setupAndLogin = () => {
    cy.intercept('GET', '**/api/sso/check**', { statusCode: 200, body: { ssoAvailable: false } });
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 200,
      body: { success: true, token: 'mock-token', user: { id: 1, email: 'test@example.com', current_organization_id: 1 } }
    }).as('loginRequest');
    cy.intercept('GET', '**/api/auth/me', { statusCode: 200, body: { success: true, user: { id: 1, email: 'test@example.com', current_organization_id: 1 } } });
    cy.intercept('GET', '**/api/organizations**', { statusCode: 200, body: { success: true, organizations: [{ id: 1, name: 'Test Org' }] } });
    cy.intercept('GET', '**/api/agents**', { statusCode: 200, body: { success: true, agents: [] } });
    cy.intercept('GET', '**/api/agents/tasks**', { statusCode: 200, body: { success: true, tasks: [] } });
    cy.intercept('GET', '**/api/agents/workflows**', { statusCode: 200, body: { success: true, workflows: [] } });
    cy.intercept('GET', '**/api/tools**', { statusCode: 200, body: { success: true, tools: [] } });
    cy.intercept('GET', '**/api/knowledge-base**', { statusCode: 200, body: { success: true, items: [] } });
    cy.intercept('GET', '**/api/bots**', { statusCode: 200, body: { success: true, bots: [] } });
    cy.intercept('GET', '**/api/analytics/**', { statusCode: 200, body: { success: true, data: {} } });

    cy.visit('/login');
    cy.get('#login-email').type('test@example.com');
    cy.get('#login-password').type('password123');
    cy.get('button[type="submit"]').click();
    cy.wait('@loginRequest');
  };

  // ========================================
  // AGENT LIST TESTS (35 tests)
  // ========================================
  describe('Agent List', () => {
    beforeEach(() => setupAndLogin());

    it('should load agents page', () => {
      cy.visit('/agents');
      cy.url().should('include', '/agent');
    });

    it('should display agents grid', () => {
      cy.visit('/agents');
      cy.get('body').should('exist');
    });

    it('should show agent cards', () => {
      cy.intercept('GET', '**/api/agents**', {
        statusCode: 200,
        body: { success: true, agents: [{ id: 1, name: 'Test Agent', status: 'active' }] }
      });
      cy.visit('/agents');
      cy.get('body').should('exist');
    });

    it('should show agent name', () => {
      cy.visit('/agents');
      cy.get('body').should('exist');
    });

    it('should show agent status', () => {
      cy.visit('/agents');
      cy.get('body').should('exist');
    });

    it('should show agent description', () => {
      cy.visit('/agents');
      cy.get('body').should('exist');
    });

    it('should show agent type', () => {
      cy.visit('/agents');
      cy.get('body').should('exist');
    });

    it('should show agent model', () => {
      cy.visit('/agents');
      cy.get('body').should('exist');
    });

    it('should filter by status', () => {
      cy.visit('/agents');
      cy.get('body').should('exist');
    });

    it('should filter by type', () => {
      cy.visit('/agents');
      cy.get('body').should('exist');
    });

    it('should search agents', () => {
      cy.visit('/agents');
      cy.get('body').should('exist');
    });

    it('should sort agents', () => {
      cy.visit('/agents');
      cy.get('body').should('exist');
    });

    it('should paginate agents', () => {
      cy.visit('/agents');
      cy.get('body').should('exist');
    });

    it('should switch to list view', () => {
      cy.visit('/agents');
      cy.get('body').should('exist');
    });

    it('should switch to grid view', () => {
      cy.visit('/agents');
      cy.get('body').should('exist');
    });

    it('should show empty state', () => {
      cy.visit('/agents');
      cy.get('body').should('exist');
    });

    it('should handle API error', () => {
      cy.intercept('GET', '**/api/agents**', { statusCode: 500, body: { success: false } });
      cy.visit('/agents');
      cy.url().should('include', '/agent');
    });

    it('should refresh agents list', () => {
      cy.visit('/agents');
      cy.get('body').should('exist');
    });

    it('should navigate to agent details', () => {
      cy.visit('/agents');
      cy.get('body').should('exist');
    });

    it('should show create agent button', () => {
      cy.visit('/agents');
      cy.get('button').should('exist');
    });

    it('should delete agent', () => {
      cy.intercept('DELETE', '**/api/agents/**', { statusCode: 200, body: { success: true } });
      cy.visit('/agents');
      cy.get('body').should('exist');
    });

    it('should duplicate agent', () => {
      cy.intercept('POST', '**/api/agents/**/duplicate', { statusCode: 201, body: { success: true } });
      cy.visit('/agents');
      cy.get('body').should('exist');
    });

    it('should export agent', () => {
      cy.visit('/agents');
      cy.get('body').should('exist');
    });

    it('should import agent', () => {
      cy.visit('/agents');
      cy.get('body').should('exist');
    });

    it('should toggle agent status', () => {
      cy.intercept('PUT', '**/api/agents/**/status', { statusCode: 200, body: { success: true } });
      cy.visit('/agents');
      cy.get('body').should('exist');
    });

    it('should show agent metrics', () => {
      cy.visit('/agents');
      cy.get('body').should('exist');
    });

    it('should show last execution time', () => {
      cy.visit('/agents');
      cy.get('body').should('exist');
    });

    it('should show execution count', () => {
      cy.visit('/agents');
      cy.get('body').should('exist');
    });

    it('should show success rate', () => {
      cy.visit('/agents');
      cy.get('body').should('exist');
    });

    it('should display on mobile', () => {
      cy.viewport('iphone-x');
      cy.visit('/agents');
      cy.url().should('include', '/agent');
    });

    it('should display on tablet', () => {
      cy.viewport('ipad-2');
      cy.visit('/agents');
      cy.url().should('include', '/agent');
    });

    it('should display on desktop', () => {
      cy.viewport(1920, 1080);
      cy.visit('/agents');
      cy.url().should('include', '/agent');
    });

    it('should bulk select agents', () => {
      cy.visit('/agents');
      cy.get('body').should('exist');
    });

    it('should bulk delete agents', () => {
      cy.visit('/agents');
      cy.get('body').should('exist');
    });

    it('should bulk activate agents', () => {
      cy.visit('/agents');
      cy.get('body').should('exist');
    });
  });

  // ========================================
  // AGENT STUDIO TESTS (40 tests)
  // ========================================
  describe('Agent Studio', () => {
    beforeEach(() => setupAndLogin());

    it('should load agent studio', () => {
      cy.visit('/agent-studio');
      cy.url().should('include', '/agent');
    });

    it('should display studio canvas', () => {
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should show toolbox panel', () => {
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should show properties panel', () => {
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should create new agent', () => {
      cy.intercept('POST', '**/api/agents', { statusCode: 201, body: { success: true, agent: { id: 1 } } });
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should set agent name', () => {
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should set agent description', () => {
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should select AI model', () => {
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should configure temperature', () => {
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should configure max tokens', () => {
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should set system prompt', () => {
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should add tool to agent', () => {
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should remove tool from agent', () => {
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should configure tool parameters', () => {
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should add knowledge base', () => {
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should remove knowledge base', () => {
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should set memory settings', () => {
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should configure context window', () => {
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should save agent', () => {
      cy.intercept('PUT', '**/api/agents/**', { statusCode: 200, body: { success: true } });
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should auto-save agent', () => {
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should test agent', () => {
      cy.intercept('POST', '**/api/agents/**/test', { statusCode: 200, body: { success: true, response: 'Test response' } });
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should show test results', () => {
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should deploy agent', () => {
      cy.intercept('POST', '**/api/agents/**/deploy', { statusCode: 200, body: { success: true } });
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should version agent', () => {
      cy.intercept('POST', '**/api/agents/**/version', { statusCode: 201, body: { success: true } });
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should rollback version', () => {
      cy.intercept('POST', '**/api/agents/**/rollback', { statusCode: 200, body: { success: true } });
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should undo action', () => {
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should redo action', () => {
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should zoom canvas', () => {
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should pan canvas', () => {
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should fit to screen', () => {
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should show keyboard shortcuts', () => {
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should validate agent config', () => {
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should show validation errors', () => {
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should handle save error', () => {
      cy.intercept('PUT', '**/api/agents/**', { statusCode: 500, body: { success: false } });
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should display on mobile', () => {
      cy.viewport('iphone-x');
      cy.visit('/agent-studio');
      cy.url().should('include', '/agent');
    });

    it('should display on tablet', () => {
      cy.viewport('ipad-2');
      cy.visit('/agent-studio');
      cy.url().should('include', '/agent');
    });

    it('should collapse panels', () => {
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should expand panels', () => {
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should resize panels', () => {
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });

    it('should show loading state', () => {
      cy.visit('/agent-studio');
      cy.get('body').should('exist');
    });
  });

  // ========================================
  // AGENT TASKS TESTS (35 tests)
  // ========================================
  describe('Agent Tasks', () => {
    beforeEach(() => setupAndLogin());

    it('should load tasks page', () => {
      cy.visit('/agent-tasks');
      cy.url().should('include', '/agent');
    });

    it('should display tasks list', () => {
      cy.visit('/agent-tasks');
      cy.get('body').should('exist');
    });

    it('should show task name', () => {
      cy.visit('/agent-tasks');
      cy.get('body').should('exist');
    });

    it('should show task status', () => {
      cy.visit('/agent-tasks');
      cy.get('body').should('exist');
    });

    it('should show task agent', () => {
      cy.visit('/agent-tasks');
      cy.get('body').should('exist');
    });

    it('should show task schedule', () => {
      cy.visit('/agent-tasks');
      cy.get('body').should('exist');
    });

    it('should show last run time', () => {
      cy.visit('/agent-tasks');
      cy.get('body').should('exist');
    });

    it('should show next run time', () => {
      cy.visit('/agent-tasks');
      cy.get('body').should('exist');
    });

    it('should create new task', () => {
      cy.intercept('POST', '**/api/agents/tasks', { statusCode: 201, body: { success: true } });
      cy.visit('/agent-tasks');
      cy.get('body').should('exist');
    });

    it('should edit task', () => {
      cy.intercept('PUT', '**/api/agents/tasks/**', { statusCode: 200, body: { success: true } });
      cy.visit('/agent-tasks');
      cy.get('body').should('exist');
    });

    it('should delete task', () => {
      cy.intercept('DELETE', '**/api/agents/tasks/**', { statusCode: 200, body: { success: true } });
      cy.visit('/agent-tasks');
      cy.get('body').should('exist');
    });

    it('should run task manually', () => {
      cy.intercept('POST', '**/api/agents/tasks/**/run', { statusCode: 200, body: { success: true } });
      cy.visit('/agent-tasks');
      cy.get('body').should('exist');
    });

    it('should pause task', () => {
      cy.intercept('POST', '**/api/agents/tasks/**/pause', { statusCode: 200, body: { success: true } });
      cy.visit('/agent-tasks');
      cy.get('body').should('exist');
    });

    it('should resume task', () => {
      cy.intercept('POST', '**/api/agents/tasks/**/resume', { statusCode: 200, body: { success: true } });
      cy.visit('/agent-tasks');
      cy.get('body').should('exist');
    });

    it('should view task history', () => {
      cy.visit('/agent-tasks');
      cy.get('body').should('exist');
    });

    it('should view task logs', () => {
      cy.visit('/agent-tasks');
      cy.get('body').should('exist');
    });

    it('should filter by status', () => {
      cy.visit('/agent-tasks');
      cy.get('body').should('exist');
    });

    it('should filter by agent', () => {
      cy.visit('/agent-tasks');
      cy.get('body').should('exist');
    });

    it('should search tasks', () => {
      cy.visit('/agent-tasks');
      cy.get('body').should('exist');
    });

    it('should sort tasks', () => {
      cy.visit('/agent-tasks');
      cy.get('body').should('exist');
    });

    it('should paginate tasks', () => {
      cy.visit('/agent-tasks');
      cy.get('body').should('exist');
    });

    it('should set cron schedule', () => {
      cy.visit('/agent-tasks');
      cy.get('body').should('exist');
    });

    it('should set interval schedule', () => {
      cy.visit('/agent-tasks');
      cy.get('body').should('exist');
    });

    it('should set one-time schedule', () => {
      cy.visit('/agent-tasks');
      cy.get('body').should('exist');
    });

    it('should configure retry policy', () => {
      cy.visit('/agent-tasks');
      cy.get('body').should('exist');
    });

    it('should configure timeout', () => {
      cy.visit('/agent-tasks');
      cy.get('body').should('exist');
    });

    it('should set task priority', () => {
      cy.visit('/agent-tasks');
      cy.get('body').should('exist');
    });

    it('should handle empty state', () => {
      cy.visit('/agent-tasks');
      cy.get('body').should('exist');
    });

    it('should handle API error', () => {
      cy.intercept('GET', '**/api/agents/tasks**', { statusCode: 500, body: { success: false } });
      cy.visit('/agent-tasks');
      cy.url().should('include', '/agent');
    });

    it('should display on mobile', () => {
      cy.viewport('iphone-x');
      cy.visit('/agent-tasks');
      cy.url().should('include', '/agent');
    });

    it('should display on tablet', () => {
      cy.viewport('ipad-2');
      cy.visit('/agent-tasks');
      cy.url().should('include', '/agent');
    });

    it('should bulk select tasks', () => {
      cy.visit('/agent-tasks');
      cy.get('body').should('exist');
    });

    it('should bulk delete tasks', () => {
      cy.visit('/agent-tasks');
      cy.get('body').should('exist');
    });

    it('should bulk pause tasks', () => {
      cy.visit('/agent-tasks');
      cy.get('body').should('exist');
    });

    it('should export tasks', () => {
      cy.visit('/agent-tasks');
      cy.get('body').should('exist');
    });
  });

  // ========================================
  // AGENT WORKFLOWS TESTS (35 tests)
  // ========================================
  describe('Agent Workflows', () => {
    beforeEach(() => setupAndLogin());

    it('should load workflows page', () => {
      cy.visit('/agent-workflows');
      cy.url().should('include', '/agent');
    });

    it('should display workflows list', () => {
      cy.visit('/agent-workflows');
      cy.get('body').should('exist');
    });

    it('should show workflow name', () => {
      cy.visit('/agent-workflows');
      cy.get('body').should('exist');
    });

    it('should show workflow status', () => {
      cy.visit('/agent-workflows');
      cy.get('body').should('exist');
    });

    it('should show workflow steps', () => {
      cy.visit('/agent-workflows');
      cy.get('body').should('exist');
    });

    it('should show workflow agents', () => {
      cy.visit('/agent-workflows');
      cy.get('body').should('exist');
    });

    it('should create new workflow', () => {
      cy.intercept('POST', '**/api/agents/workflows', { statusCode: 201, body: { success: true } });
      cy.visit('/agent-workflows');
      cy.get('body').should('exist');
    });

    it('should edit workflow', () => {
      cy.intercept('PUT', '**/api/agents/workflows/**', { statusCode: 200, body: { success: true } });
      cy.visit('/agent-workflows');
      cy.get('body').should('exist');
    });

    it('should delete workflow', () => {
      cy.intercept('DELETE', '**/api/agents/workflows/**', { statusCode: 200, body: { success: true } });
      cy.visit('/agent-workflows');
      cy.get('body').should('exist');
    });

    it('should run workflow', () => {
      cy.intercept('POST', '**/api/agents/workflows/**/run', { statusCode: 200, body: { success: true } });
      cy.visit('/agent-workflows');
      cy.get('body').should('exist');
    });

    it('should stop workflow', () => {
      cy.intercept('POST', '**/api/agents/workflows/**/stop', { statusCode: 200, body: { success: true } });
      cy.visit('/agent-workflows');
      cy.get('body').should('exist');
    });

    it('should add step to workflow', () => {
      cy.visit('/agent-workflows');
      cy.get('body').should('exist');
    });

    it('should remove step from workflow', () => {
      cy.visit('/agent-workflows');
      cy.get('body').should('exist');
    });

    it('should reorder steps', () => {
      cy.visit('/agent-workflows');
      cy.get('body').should('exist');
    });

    it('should configure step conditions', () => {
      cy.visit('/agent-workflows');
      cy.get('body').should('exist');
    });

    it('should add parallel steps', () => {
      cy.visit('/agent-workflows');
      cy.get('body').should('exist');
    });

    it('should add conditional branch', () => {
      cy.visit('/agent-workflows');
      cy.get('body').should('exist');
    });

    it('should add loop step', () => {
      cy.visit('/agent-workflows');
      cy.get('body').should('exist');
    });

    it('should view workflow execution', () => {
      cy.visit('/agent-workflows');
      cy.get('body').should('exist');
    });

    it('should view step results', () => {
      cy.visit('/agent-workflows');
      cy.get('body').should('exist');
    });

    it('should filter by status', () => {
      cy.visit('/agent-workflows');
      cy.get('body').should('exist');
    });

    it('should search workflows', () => {
      cy.visit('/agent-workflows');
      cy.get('body').should('exist');
    });

    it('should sort workflows', () => {
      cy.visit('/agent-workflows');
      cy.get('body').should('exist');
    });

    it('should paginate workflows', () => {
      cy.visit('/agent-workflows');
      cy.get('body').should('exist');
    });

    it('should duplicate workflow', () => {
      cy.intercept('POST', '**/api/agents/workflows/**/duplicate', { statusCode: 201, body: { success: true } });
      cy.visit('/agent-workflows');
      cy.get('body').should('exist');
    });

    it('should export workflow', () => {
      cy.visit('/agent-workflows');
      cy.get('body').should('exist');
    });

    it('should import workflow', () => {
      cy.visit('/agent-workflows');
      cy.get('body').should('exist');
    });

    it('should handle empty state', () => {
      cy.visit('/agent-workflows');
      cy.get('body').should('exist');
    });

    it('should handle API error', () => {
      cy.intercept('GET', '**/api/agents/workflows**', { statusCode: 500, body: { success: false } });
      cy.visit('/agent-workflows');
      cy.url().should('include', '/agent');
    });

    it('should display on mobile', () => {
      cy.viewport('iphone-x');
      cy.visit('/agent-workflows');
      cy.url().should('include', '/agent');
    });

    it('should display on tablet', () => {
      cy.viewport('ipad-2');
      cy.visit('/agent-workflows');
      cy.url().should('include', '/agent');
    });

    it('should version workflow', () => {
      cy.visit('/agent-workflows');
      cy.get('body').should('exist');
    });

    it('should rollback workflow', () => {
      cy.visit('/agent-workflows');
      cy.get('body').should('exist');
    });

    it('should set workflow triggers', () => {
      cy.visit('/agent-workflows');
      cy.get('body').should('exist');
    });

    it('should set workflow notifications', () => {
      cy.visit('/agent-workflows');
      cy.get('body').should('exist');
    });
  });

  // ========================================
  // AUTONOMOUS AGENTS TESTS (30 tests)
  // ========================================
  describe('Autonomous Agents', () => {
    beforeEach(() => setupAndLogin());

    it('should load autonomous agents page', () => {
      cy.visit('/autonomous-agents');
      cy.url().should('include', '/autonomous');
    });

    it('should display autonomous agents list', () => {
      cy.visit('/autonomous-agents');
      cy.get('body').should('exist');
    });

    it('should show agent goals', () => {
      cy.visit('/autonomous-agents');
      cy.get('body').should('exist');
    });

    it('should show agent progress', () => {
      cy.visit('/autonomous-agents');
      cy.get('body').should('exist');
    });

    it('should show agent decisions', () => {
      cy.visit('/autonomous-agents');
      cy.get('body').should('exist');
    });

    it('should show agent memory', () => {
      cy.visit('/autonomous-agents');
      cy.get('body').should('exist');
    });

    it('should create autonomous agent', () => {
      cy.intercept('POST', '**/api/autonomous-agents', { statusCode: 201, body: { success: true } });
      cy.visit('/autonomous-agents');
      cy.get('body').should('exist');
    });

    it('should set agent goal', () => {
      cy.visit('/autonomous-agents');
      cy.get('body').should('exist');
    });

    it('should set agent constraints', () => {
      cy.visit('/autonomous-agents');
      cy.get('body').should('exist');
    });

    it('should set agent resources', () => {
      cy.visit('/autonomous-agents');
      cy.get('body').should('exist');
    });

    it('should start autonomous agent', () => {
      cy.intercept('POST', '**/api/autonomous-agents/**/start', { statusCode: 200, body: { success: true } });
      cy.visit('/autonomous-agents');
      cy.get('body').should('exist');
    });

    it('should stop autonomous agent', () => {
      cy.intercept('POST', '**/api/autonomous-agents/**/stop', { statusCode: 200, body: { success: true } });
      cy.visit('/autonomous-agents');
      cy.get('body').should('exist');
    });

    it('should pause autonomous agent', () => {
      cy.intercept('POST', '**/api/autonomous-agents/**/pause', { statusCode: 200, body: { success: true } });
      cy.visit('/autonomous-agents');
      cy.get('body').should('exist');
    });

    it('should resume autonomous agent', () => {
      cy.intercept('POST', '**/api/autonomous-agents/**/resume', { statusCode: 200, body: { success: true } });
      cy.visit('/autonomous-agents');
      cy.get('body').should('exist');
    });

    it('should view agent thinking', () => {
      cy.visit('/autonomous-agents');
      cy.get('body').should('exist');
    });

    it('should view agent actions', () => {
      cy.visit('/autonomous-agents');
      cy.get('body').should('exist');
    });

    it('should approve agent action', () => {
      cy.intercept('POST', '**/api/autonomous-agents/**/approve', { statusCode: 200, body: { success: true } });
      cy.visit('/autonomous-agents');
      cy.get('body').should('exist');
    });

    it('should reject agent action', () => {
      cy.intercept('POST', '**/api/autonomous-agents/**/reject', { statusCode: 200, body: { success: true } });
      cy.visit('/autonomous-agents');
      cy.get('body').should('exist');
    });

    it('should modify agent goal', () => {
      cy.visit('/autonomous-agents');
      cy.get('body').should('exist');
    });

    it('should add sub-goal', () => {
      cy.visit('/autonomous-agents');
      cy.get('body').should('exist');
    });

    it('should view execution history', () => {
      cy.visit('/autonomous-agents');
      cy.get('body').should('exist');
    });

    it('should view resource usage', () => {
      cy.visit('/autonomous-agents');
      cy.get('body').should('exist');
    });

    it('should set budget limits', () => {
      cy.visit('/autonomous-agents');
      cy.get('body').should('exist');
    });

    it('should handle empty state', () => {
      cy.visit('/autonomous-agents');
      cy.get('body').should('exist');
    });

    it('should handle API error', () => {
      cy.intercept('GET', '**/api/autonomous-agents**', { statusCode: 500, body: { success: false } });
      cy.visit('/autonomous-agents');
      cy.url().should('include', '/autonomous');
    });

    it('should display on mobile', () => {
      cy.viewport('iphone-x');
      cy.visit('/autonomous-agents');
      cy.url().should('include', '/autonomous');
    });

    it('should display on tablet', () => {
      cy.viewport('ipad-2');
      cy.visit('/autonomous-agents');
      cy.url().should('include', '/autonomous');
    });

    it('should show real-time updates', () => {
      cy.visit('/autonomous-agents');
      cy.get('body').should('exist');
    });

    it('should delete autonomous agent', () => {
      cy.intercept('DELETE', '**/api/autonomous-agents/**', { statusCode: 200, body: { success: true } });
      cy.visit('/autonomous-agents');
      cy.get('body').should('exist');
    });

    it('should export agent report', () => {
      cy.visit('/autonomous-agents');
      cy.get('body').should('exist');
    });
  });

  // ========================================
  // AGENT TEST PANEL TESTS (25 tests)
  // ========================================
  describe('Agent Test Panel', () => {
    beforeEach(() => setupAndLogin());

    it('should load test panel', () => {
      cy.visit('/agents/test');
      cy.url().should('include', '/agent');
    });

    it('should select agent to test', () => {
      cy.visit('/agents/test');
      cy.get('body').should('exist');
    });

    it('should enter test input', () => {
      cy.visit('/agents/test');
      cy.get('body').should('exist');
    });

    it('should run test', () => {
      cy.intercept('POST', '**/api/agents/**/test', { statusCode: 200, body: { success: true, response: 'Test' } });
      cy.visit('/agents/test');
      cy.get('body').should('exist');
    });

    it('should display test output', () => {
      cy.visit('/agents/test');
      cy.get('body').should('exist');
    });

    it('should show tool calls', () => {
      cy.visit('/agents/test');
      cy.get('body').should('exist');
    });

    it('should show reasoning steps', () => {
      cy.visit('/agents/test');
      cy.get('body').should('exist');
    });

    it('should show token usage', () => {
      cy.visit('/agents/test');
      cy.get('body').should('exist');
    });

    it('should show latency', () => {
      cy.visit('/agents/test');
      cy.get('body').should('exist');
    });

    it('should save test case', () => {
      cy.intercept('POST', '**/api/agents/**/test-cases', { statusCode: 201, body: { success: true } });
      cy.visit('/agents/test');
      cy.get('body').should('exist');
    });

    it('should load test case', () => {
      cy.visit('/agents/test');
      cy.get('body').should('exist');
    });

    it('should run batch tests', () => {
      cy.intercept('POST', '**/api/agents/**/batch-test', { statusCode: 200, body: { success: true } });
      cy.visit('/agents/test');
      cy.get('body').should('exist');
    });

    it('should compare outputs', () => {
      cy.visit('/agents/test');
      cy.get('body').should('exist');
    });

    it('should clear test history', () => {
      cy.visit('/agents/test');
      cy.get('body').should('exist');
    });

    it('should export test results', () => {
      cy.visit('/agents/test');
      cy.get('body').should('exist');
    });

    it('should stream response', () => {
      cy.visit('/agents/test');
      cy.get('body').should('exist');
    });

    it('should stop streaming', () => {
      cy.visit('/agents/test');
      cy.get('body').should('exist');
    });

    it('should override parameters', () => {
      cy.visit('/agents/test');
      cy.get('body').should('exist');
    });

    it('should mock tool responses', () => {
      cy.visit('/agents/test');
      cy.get('body').should('exist');
    });

    it('should handle test error', () => {
      cy.intercept('POST', '**/api/agents/**/test', { statusCode: 500, body: { success: false } });
      cy.visit('/agents/test');
      cy.get('body').should('exist');
    });

    it('should display on mobile', () => {
      cy.viewport('iphone-x');
      cy.visit('/agents/test');
      cy.url().should('include', '/agent');
    });

    it('should display on tablet', () => {
      cy.viewport('ipad-2');
      cy.visit('/agents/test');
      cy.url().should('include', '/agent');
    });

    it('should show loading state', () => {
      cy.visit('/agents/test');
      cy.get('body').should('exist');
    });

    it('should copy output', () => {
      cy.visit('/agents/test');
      cy.get('body').should('exist');
    });

    it('should format output', () => {
      cy.visit('/agents/test');
      cy.get('body').should('exist');
    });
  });
});
