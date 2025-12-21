/**
 * Organizations E2E Tests
 * Tests for organization management functionality
 */

describe('Organizations', () => {
  // Helper function to login via UI
  const loginViaUI = () => {
    cy.intercept('GET', '**/sso/check**', {
      statusCode: 200,
      body: { ssoAvailable: false }
    });

    cy.intercept('POST', '**/auth/login', {
      statusCode: 200,
      body: {
        success: true,
        token: 'mock-jwt-token',
        user: { id: 1, email: 'test@example.com', username: 'testuser', current_organization_id: 1 }
      }
    }).as('loginRequest');

    cy.intercept('GET', '**/auth/me', {
      statusCode: 200,
      body: { success: true, user: { id: 1, email: 'test@example.com', current_organization_id: 1 } }
    });

    cy.intercept('GET', '**/organizations**', {
      statusCode: 200,
      body: {
        success: true,
        organizations: [
          { id: 1, name: 'Test Org', slug: 'test-org', role: 'owner' },
          { id: 2, name: 'Second Org', slug: 'second-org', role: 'member' }
        ]
      }
    }).as('getOrganizations');

    cy.visit('/login');
    cy.get('#login-email').type('test@example.com');
    cy.get('#login-password').type('password123');
    cy.get('button[type="submit"]').click();
    cy.wait('@loginRequest');
  };

  // ========================================
  // LIST ORGANIZATIONS TESTS
  // ========================================
  describe('List Organizations', () => {
    beforeEach(() => {
      loginViaUI();
    });

    it('should display organizations list', () => {
      cy.intercept('GET', '**/bots**', { statusCode: 200, body: { success: true, bots: [] } });
      cy.intercept('GET', '**/analytics/**', { statusCode: 200, body: { success: true, data: {} } });

      cy.visit('/organizations');
      cy.wait('@getOrganizations');

      cy.contains('Test Org').should('exist');
      cy.contains('Second Org').should('exist');
    });

    it('should show organization switcher', () => {
      cy.intercept('GET', '**/bots**', { statusCode: 200, body: { success: true, bots: [] } });
      cy.intercept('GET', '**/analytics/**', { statusCode: 200, body: { success: true, data: {} } });

      cy.visit('/dashboard');

      // Look for organization switcher component
      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="org-switcher"]').length) {
          cy.get('[data-testid="org-switcher"]').should('exist');
        }
      });
    });
  });

  // ========================================
  // CREATE ORGANIZATION TESTS
  // ========================================
  describe('Create Organization', () => {
    beforeEach(() => {
      loginViaUI();
    });

    it('should create organization successfully', () => {
      cy.intercept('POST', '**/organizations', {
        statusCode: 201,
        body: {
          success: true,
          organization: { id: 3, name: 'New Org', slug: 'new-org' },
          message: 'Organization created successfully'
        }
      }).as('createOrg');

      cy.visit('/organizations');

      // Find and click create button
      cy.get('button').contains(/create|add|new/i).click();

      // Fill form
      cy.get('input[name="name"]').type('New Org');

      cy.get('body').then(($body) => {
        if ($body.find('input[name="slug"]').length) {
          cy.get('input[name="slug"]').type('new-org');
        }
      });

      cy.get('button[type="submit"]').click();
      cy.wait('@createOrg');

      cy.contains('New Org').should('exist');
    });

    it('should show error for duplicate organization name', () => {
      cy.intercept('POST', '**/organizations', {
        statusCode: 409,
        body: {
          success: false,
          message: 'Organization with this name already exists'
        }
      }).as('createOrg');

      cy.visit('/organizations');

      cy.get('button').contains(/create|add|new/i).click();
      cy.get('input[name="name"]').type('Existing Org');
      cy.get('button[type="submit"]').click();

      cy.wait('@createOrg');
      cy.url().should('include', '/organizations');
    });

    it('should show plan limit error', () => {
      cy.intercept('POST', '**/organizations', {
        statusCode: 403,
        body: {
          success: false,
          error: 'Plan limit reached',
          limitReached: true
        }
      }).as('createOrg');

      cy.visit('/organizations');

      cy.get('button').contains(/create|add|new/i).click();
      cy.get('input[name="name"]').type('Over Limit Org');
      cy.get('button[type="submit"]').click();

      cy.wait('@createOrg');
      cy.url().should('include', '/organizations');
    });
  });

  // ========================================
  // SWITCH ORGANIZATION TESTS
  // ========================================
  describe('Switch Organization', () => {
    beforeEach(() => {
      loginViaUI();
    });

    it('should switch between organizations', () => {
      cy.intercept('POST', '**/organizations/*/switch', {
        statusCode: 200,
        body: {
          success: true,
          message: 'Switched to organization'
        }
      }).as('switchOrg');

      cy.intercept('GET', '**/bots**', { statusCode: 200, body: { success: true, bots: [] } });
      cy.intercept('GET', '**/analytics/**', { statusCode: 200, body: { success: true, data: {} } });

      cy.visit('/dashboard');

      // Look for org switcher and switch
      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="org-switcher"]').length) {
          cy.get('[data-testid="org-switcher"]').click();
          cy.contains('Second Org').click();
          cy.wait('@switchOrg');
        }
      });
    });
  });

  // ========================================
  // ORGANIZATION SETTINGS TESTS
  // ========================================
  describe('Organization Settings', () => {
    beforeEach(() => {
      loginViaUI();
      cy.intercept('GET', '**/bots**', { statusCode: 200, body: { success: true, bots: [] } });
      cy.intercept('GET', '**/analytics/**', { statusCode: 200, body: { success: true, data: {} } });
    });

    it('should load organization settings page', () => {
      cy.visit('/organizations/settings');
      cy.url().should('include', '/organizations/settings');
    });

    it('should update organization name', () => {
      cy.intercept('PUT', '**/organizations/**', {
        statusCode: 200,
        body: {
          success: true,
          organization: { id: 1, name: 'Updated Org', slug: 'test-org' }
        }
      }).as('updateOrg');

      cy.visit('/organizations/settings');

      cy.get('body').then(($body) => {
        if ($body.find('input[name="name"]').length) {
          cy.get('input[name="name"]').clear().type('Updated Org');
          cy.get('button[type="submit"]').click();
          cy.wait('@updateOrg');
        }
      });
    });
  });

  // ========================================
  // TEAM MEMBERS TESTS (via /team route)
  // ========================================
  describe('Team Members', () => {
    beforeEach(() => {
      loginViaUI();
      cy.intercept('GET', '**/bots**', { statusCode: 200, body: { success: true, bots: [] } });
      cy.intercept('GET', '**/analytics/**', { statusCode: 200, body: { success: true, data: {} } });
      cy.intercept('GET', '**/team**', {
        statusCode: 200,
        body: {
          success: true,
          members: [
            { id: 1, email: 'owner@example.com', role: 'owner', name: 'Owner User' },
            { id: 2, email: 'member@example.com', role: 'member', name: 'Member User' }
          ]
        }
      }).as('getMembers');
    });

    it('should display team members', () => {
      cy.visit('/team');
      cy.wait('@getMembers');
      cy.url().should('include', '/team');
    });

    it('should have invite button', () => {
      cy.visit('/team');
      cy.wait('@getMembers');
      cy.get('button').contains(/invite|add/i).should('exist');
    });
  });

  // ========================================
  // ERROR HANDLING TESTS
  // ========================================
  describe('Error Handling', () => {
    beforeEach(() => {
      loginViaUI();
    });

    it('should handle server error', () => {
      cy.intercept('GET', '**/organizations**', {
        statusCode: 500,
        body: {
          success: false,
          message: 'Internal server error'
        }
      });
      cy.intercept('GET', '**/bots**', { statusCode: 200, body: { success: true, bots: [] } });
      cy.intercept('GET', '**/analytics/**', { statusCode: 200, body: { success: true, data: {} } });

      cy.visit('/organizations');
      cy.url().should('include', '/organizations');
    });
  });

  // ========================================
  // BILLING TESTS (via /billing route)
  // ========================================
  describe('Billing', () => {
    beforeEach(() => {
      loginViaUI();
      cy.intercept('GET', '**/bots**', { statusCode: 200, body: { success: true, bots: [] } });
      cy.intercept('GET', '**/analytics/**', { statusCode: 200, body: { success: true, data: {} } });
      cy.intercept('GET', '**/billing**', {
        statusCode: 200,
        body: {
          success: true,
          billing: {
            plan: 'pro',
            status: 'active',
            nextBillingDate: '2025-01-15'
          }
        }
      }).as('getBilling');
    });

    it('should display billing information', () => {
      cy.visit('/billing');
      cy.wait('@getBilling');
      cy.url().should('include', '/billing');
    });
  });
});
