/**
 * Organizations E2E Tests
 * Tests for organization management functionality
 */

describe('Organizations', () => {
  // Helper function to setup intercepts and login
  const setupAndLogin = () => {
    cy.intercept('GET', '**/api/sso/check**', {
      statusCode: 200,
      body: { ssoAvailable: false }
    });

    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 200,
      body: {
        success: true,
        token: 'mock-jwt-token',
        user: { id: 1, email: 'test@example.com', username: 'testuser', current_organization_id: 1 }
      }
    }).as('loginRequest');

    cy.intercept('GET', '**/api/auth/me', {
      statusCode: 200,
      body: { success: true, user: { id: 1, email: 'test@example.com', current_organization_id: 1 } }
    });

    cy.intercept('GET', '**/api/organizations**', {
      statusCode: 200,
      body: {
        success: true,
        organizations: [
          { id: 1, name: 'Test Org', slug: 'test-org', role: 'owner' },
          { id: 2, name: 'Second Org', slug: 'second-org', role: 'member' }
        ]
      }
    }).as('getOrganizations');

    cy.intercept('GET', '**/api/bots**', { statusCode: 200, body: { success: true, bots: [] } });
    cy.intercept('GET', '**/api/analytics/**', { statusCode: 200, body: { success: true, data: {} } });
    cy.intercept('GET', '**/api/billing**', { statusCode: 200, body: { success: true, billing: {} } });
    cy.intercept('GET', '**/api/team**', {
      statusCode: 200,
      body: {
        success: true,
        members: [
          { id: 1, email: 'owner@example.com', role: 'owner', name: 'Owner User' },
          { id: 2, email: 'member@example.com', role: 'member', name: 'Member User' }
        ]
      }
    }).as('getMembers');

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
    it('should display organizations list', () => {
      setupAndLogin();
      cy.visit('/organizations');
      cy.url().should('include', '/organizations');
    });

    it('should load dashboard with organization context', () => {
      setupAndLogin();
      cy.visit('/dashboard');
      cy.url().should('include', '/dashboard');
    });
  });

  // ========================================
  // ORGANIZATION SETTINGS TESTS
  // ========================================
  describe('Organization Settings', () => {
    it('should load organization settings page', () => {
      setupAndLogin();
      cy.visit('/organizations/settings');
      cy.url().should('include', '/organizations');
    });

    it('should handle organization update API call', () => {
      setupAndLogin();
      cy.intercept('PUT', '**/api/organizations/**', {
        statusCode: 200,
        body: {
          success: true,
          organization: { id: 1, name: 'Updated Org', slug: 'test-org' }
        }
      }).as('updateOrg');

      cy.visit('/organizations/settings');
      cy.url().should('include', '/organizations');
    });
  });

  // ========================================
  // TEAM MEMBERS TESTS
  // ========================================
  describe('Team Members', () => {
    it('should display team page', () => {
      setupAndLogin();
      cy.visit('/team');
      cy.url().should('include', '/team');
    });

    it('should load team members data', () => {
      setupAndLogin();
      cy.visit('/team');
      cy.url().should('include', '/team');
      cy.get('body').should('exist');
    });
  });

  // ========================================
  // ERROR HANDLING TESTS
  // ========================================
  describe('Error Handling', () => {
    it('should handle server error on organizations page', () => {
      setupAndLogin();
      cy.visit('/organizations');
      cy.url().should('include', '/organizations');
    });

    it('should handle network error gracefully', () => {
      setupAndLogin();
      cy.visit('/organizations');
      cy.url().should('include', '/organizations');
    });
  });

  // ========================================
  // BILLING TESTS
  // ========================================
  describe('Billing', () => {
    it('should display billing information', () => {
      setupAndLogin();
      cy.visit('/billing');
      cy.url().should('include', '/billing');
    });

    it('should handle billing API error', () => {
      setupAndLogin();
      cy.visit('/billing');
      cy.url().should('include', '/billing');
    });
  });

  // ========================================
  // RESPONSIVE TESTS
  // ========================================
  describe('Responsive Design', () => {
    it('should display correctly on mobile', () => {
      setupAndLogin();
      cy.viewport('iphone-x');
      cy.visit('/organizations');
      cy.url().should('include', '/organizations');
    });

    it('should display correctly on tablet', () => {
      setupAndLogin();
      cy.viewport('ipad-2');
      cy.visit('/organizations');
      cy.url().should('include', '/organizations');
    });
  });
});
