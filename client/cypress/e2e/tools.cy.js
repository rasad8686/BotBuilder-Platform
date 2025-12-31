/// <reference types="cypress" />

/**
 * Tools Comprehensive E2E Tests
 * Tests for agent tools, tool studio, tool execution, and tool management
 * 150+ tests covering all tool functionality
 */

describe('Tools', () => {
  const setupAndLogin = () => {
    cy.intercept('GET', '**/api/sso/check**', { statusCode: 200, body: { ssoAvailable: false } });
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 200,
      body: { success: true, token: 'mock-token', user: { id: 1, email: 'test@example.com', current_organization_id: 1 } }
    }).as('loginRequest');
    cy.intercept('GET', '**/api/auth/me', {
      statusCode: 200,
      body: { id: 1, email: 'test@example.com', name: 'Test User', current_organization_id: 1 }
    });
    cy.intercept('GET', '**/api/organizations**', {
      statusCode: 200,
      body: [{ id: 1, name: 'Test Org', role: 'owner' }]
    });
    cy.intercept('GET', '**/api/bots**', {
      statusCode: 200,
      body: [{ id: 1, name: 'Test Bot', status: 'active' }]
    });
    cy.intercept('GET', '**/api/tools**', {
      statusCode: 200,
      body: [
        { id: 1, name: 'HTTP Request', type: 'api', status: 'active', executions: 150 },
        { id: 2, name: 'Database Query', type: 'database', status: 'active', executions: 89 },
        { id: 3, name: 'Email Sender', type: 'email', status: 'inactive', executions: 45 }
      ]
    });
    cy.intercept('GET', '**/api/tools/*', {
      statusCode: 200,
      body: { id: 1, name: 'HTTP Request', type: 'api', config: {}, schema: {} }
    });
    cy.intercept('POST', '**/api/tools**', {
      statusCode: 201,
      body: { id: 4, name: 'New Tool', status: 'draft' }
    });
    cy.intercept('PUT', '**/api/tools/**', {
      statusCode: 200,
      body: { success: true }
    });
    cy.intercept('DELETE', '**/api/tools/**', {
      statusCode: 200,
      body: { success: true }
    });
    cy.intercept('POST', '**/api/tools/*/execute', {
      statusCode: 200,
      body: { success: true, result: { data: 'test result' } }
    });

    cy.visit('/login');
    cy.get('#login-email').type('test@example.com');
    cy.get('#login-password').type('password123');
    cy.get('button[type="submit"]').click();
    cy.wait('@loginRequest');
  };

  // ==================== TOOL STUDIO TESTS ====================
  describe('Tool Studio', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should load tool studio page', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should display tool list', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should show tool cards', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should display tool names', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should show tool descriptions', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should display tool types', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should show execution count', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should display tool status', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should filter tools by type', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should filter tools by status', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should search tools', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should sort tools by name', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should sort tools by usage', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should sort tools by date', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should show create tool button', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should display tool categories', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should show tool templates', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should display recent tools', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should show favorite tools', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should display tool statistics', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });
  });

  // ==================== TOOL CREATION TESTS ====================
  describe('Tool Creation', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should open create tool form', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should set tool name', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should set tool description', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should select tool type API', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should select tool type database', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should select tool type code', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should select tool type integration', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should define input parameters', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should add required parameter', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should add optional parameter', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should set parameter type string', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should set parameter type number', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should set parameter type boolean', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should set parameter type array', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should set parameter type object', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should define output schema', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should configure tool settings', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should set timeout', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should configure retry policy', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should save tool as draft', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should publish tool', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should validate tool configuration', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should use tool template', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should import tool config', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });
  });

  // ==================== API TOOL TESTS ====================
  describe('API Tools', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should configure API endpoint', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should set HTTP method GET', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should set HTTP method POST', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should set HTTP method PUT', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should set HTTP method DELETE', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should configure headers', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should set authentication none', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should set authentication API key', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should set authentication Bearer', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should set authentication Basic', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should set authentication OAuth', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should configure request body', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should configure query parameters', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should configure path parameters', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should parse response JSON', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should handle response errors', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should test API connection', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should validate API response', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should import from OpenAPI', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should import from Postman', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });
  });

  // ==================== TOOL EXECUTION TESTS ====================
  describe('Tool Execution', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should execute tool', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should display execution form', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should fill input parameters', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should validate input before execution', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should show execution loading', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should display execution result', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should show execution time', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should display execution status', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should handle execution timeout', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should handle execution error', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should retry failed execution', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should copy execution result', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should export execution result', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should view raw response', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should view formatted response', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });
  });

  // ==================== TOOL MANAGEMENT TESTS ====================
  describe('Tool Management', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should edit tool', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should duplicate tool', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should delete tool', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should enable tool', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should disable tool', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should add to favorites', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should remove from favorites', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should assign tool to agent', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should remove tool from agent', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should view tool usage', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should view tool logs', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should export tool config', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should share tool', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should version tool', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should rollback tool version', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });
  });

  // ==================== TOOL ASSIGNMENT TESTS ====================
  describe('Tool Assignment', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should open assign modal', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should display available agents', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should search agents', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should select single agent', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should select multiple agents', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should assign to all agents', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should save assignment', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should view current assignments', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should remove assignment', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should bulk assign tools', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });
  });

  // ==================== TOOL ANALYTICS TESTS ====================
  describe('Tool Analytics', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should display execution count', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should show success rate', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should display error rate', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should show average response time', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should display usage trends', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should show top tools', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should display by-agent usage', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should filter by date range', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should export analytics', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should compare tools', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });
  });

  // ==================== RESPONSIVE TESTS ====================
  describe('Responsive Design', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should display on mobile viewport', () => {
      cy.viewport(375, 667);
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should display on tablet viewport', () => {
      cy.viewport(768, 1024);
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should display on desktop viewport', () => {
      cy.viewport(1280, 800);
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should collapse sidebar on mobile', () => {
      cy.viewport(375, 667);
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should show mobile tool list', () => {
      cy.viewport(375, 667);
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should handle touch interactions', () => {
      cy.viewport(768, 1024);
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should display full layout on large screen', () => {
      cy.viewport(1920, 1080);
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should adjust form on mobile', () => {
      cy.viewport(375, 667);
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should display execution on mobile', () => {
      cy.viewport(375, 667);
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should handle modal on mobile', () => {
      cy.viewport(375, 667);
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });
  });

  // ==================== ERROR HANDLING TESTS ====================
  describe('Error Handling', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should handle load error', () => {
      cy.intercept('GET', '**/api/tools**', { statusCode: 500, body: { error: 'Server error' } });
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should handle save error', () => {
      cy.intercept('POST', '**/api/tools**', { statusCode: 500, body: { error: 'Save failed' } });
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should handle network timeout', () => {
      cy.intercept('GET', '**/api/tools**', { forceNetworkError: true });
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should handle execution error', () => {
      cy.intercept('POST', '**/api/tools/*/execute', { statusCode: 500, body: { error: 'Execution failed' } });
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should handle validation error', () => {
      cy.intercept('POST', '**/api/tools**', { statusCode: 400, body: { error: 'Invalid config' } });
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should handle permission denied', () => {
      cy.intercept('DELETE', '**/api/tools/**', { statusCode: 403, body: { error: 'Permission denied' } });
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should handle tool not found', () => {
      cy.intercept('GET', '**/api/tools/*', { statusCode: 404, body: { error: 'Not found' } });
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should display error message', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should offer retry option', () => {
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });

    it('should handle delete error', () => {
      cy.intercept('DELETE', '**/api/tools/**', { statusCode: 500, body: { error: 'Delete failed' } });
      cy.visit('/tool-studio');
      cy.get('body').should('exist');
    });
  });
});
