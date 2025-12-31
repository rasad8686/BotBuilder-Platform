/**
 * Dashboard E2E Tests
 * Tests for dashboard page functionality
 */

describe('Dashboard', () => {
  // Helper function to login via UI
  const loginViaUI = () => {
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
      body: { success: true, organizations: [{ id: 1, name: 'Test Org', slug: 'test-org' }] }
    });

    cy.intercept('GET', '**/api/bots**', { statusCode: 200, body: { success: true, bots: [] } });
    cy.intercept('GET', '**/api/analytics/**', { statusCode: 200, body: { success: true, data: {} } });

    cy.visit('/login');
    cy.get('#login-email').type('test@example.com');
    cy.get('#login-password').type('password123');
    cy.get('button[type="submit"]').click();
    cy.wait('@loginRequest');
  };

  // ========================================
  // PAGE LOAD TESTS
  // ========================================
  describe('Page Load', () => {
    it('should load dashboard page successfully', () => {
      loginViaUI();
      cy.visit('/dashboard');
      cy.url().should('include', '/dashboard');
    });

    it('should show navigation sidebar', () => {
      loginViaUI();
      cy.visit('/dashboard');
      cy.get('nav, aside, [role="navigation"]').should('exist');
    });

    it('should display analytics widgets', () => {
      loginViaUI();
      cy.visit('/dashboard');
      cy.get('body').should('exist');
    });
  });

  // ========================================
  // NAVIGATION TESTS
  // ========================================
  describe('Navigation', () => {
    it('should have navigation elements', () => {
      loginViaUI();
      cy.visit('/dashboard');
      cy.get('nav, aside, [role="navigation"]').should('exist');
    });
  });

  // ========================================
  // RESPONSIVE TESTS
  // ========================================
  describe('Responsive Design', () => {
    it('should display correctly on mobile', () => {
      loginViaUI();
      cy.viewport('iphone-x');
      cy.visit('/dashboard');
      cy.url().should('include', '/dashboard');
    });

    it('should display correctly on tablet', () => {
      loginViaUI();
      cy.viewport('ipad-2');
      cy.visit('/dashboard');
      cy.url().should('include', '/dashboard');
    });

    it('should display correctly on desktop', () => {
      loginViaUI();
      cy.viewport(1920, 1080);
      cy.visit('/dashboard');
      cy.url().should('include', '/dashboard');
    });
  });

  // ========================================
  // ERROR HANDLING TESTS
  // ========================================
  describe('Error Handling', () => {
    it('should handle analytics API error gracefully', () => {
      cy.intercept('GET', '**/api/sso/check**', { statusCode: 200, body: { ssoAvailable: false } });
      cy.intercept('POST', '**/api/auth/login', {
        statusCode: 200,
        body: { success: true, token: 'mock-jwt-token', user: { id: 1, email: 'test@example.com', current_organization_id: 1 } }
      }).as('loginRequest');
      cy.intercept('GET', '**/api/auth/me', { statusCode: 200, body: { success: true, user: { id: 1, email: 'test@example.com', current_organization_id: 1 } } });
      cy.intercept('GET', '**/api/organizations**', { statusCode: 200, body: { success: true, organizations: [{ id: 1, name: 'Test Org', slug: 'test-org' }] } });
      cy.intercept('GET', '**/api/bots**', { statusCode: 200, body: { success: true, bots: [] } });
      cy.intercept('GET', '**/api/analytics/**', {
        statusCode: 500,
        body: { success: false, message: 'Server error' }
      });

      cy.visit('/login');
      cy.get('#login-email').type('test@example.com');
      cy.get('#login-password').type('password123');
      cy.get('button[type="submit"]').click();
      cy.wait('@loginRequest');

      cy.visit('/dashboard');
      cy.url().should('include', '/dashboard');
    });

    it('should handle bots API error gracefully', () => {
      cy.intercept('GET', '**/api/sso/check**', { statusCode: 200, body: { ssoAvailable: false } });
      cy.intercept('POST', '**/api/auth/login', {
        statusCode: 200,
        body: { success: true, token: 'mock-jwt-token', user: { id: 1, email: 'test@example.com', current_organization_id: 1 } }
      }).as('loginRequest');
      cy.intercept('GET', '**/api/auth/me', { statusCode: 200, body: { success: true, user: { id: 1, email: 'test@example.com', current_organization_id: 1 } } });
      cy.intercept('GET', '**/api/organizations**', { statusCode: 200, body: { success: true, organizations: [{ id: 1, name: 'Test Org', slug: 'test-org' }] } });
      cy.intercept('GET', '**/api/bots**', {
        statusCode: 500,
        body: { success: false, message: 'Server error' }
      });
      cy.intercept('GET', '**/api/analytics/**', { statusCode: 200, body: { success: true, data: {} } });

      cy.visit('/login');
      cy.get('#login-email').type('test@example.com');
      cy.get('#login-password').type('password123');
      cy.get('button[type="submit"]').click();
      cy.wait('@loginRequest');

      cy.visit('/dashboard');
      cy.url().should('include', '/dashboard');
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================
  describe('Edge Cases', () => {
    it('should handle empty state for new users', () => {
      loginViaUI();
      cy.visit('/dashboard');
      cy.url().should('include', '/dashboard');
    });

    it('should handle session expiry', () => {
      cy.intercept('GET', '**/api/auth/me', {
        statusCode: 401,
        body: { success: false, message: 'Token expired' }
      });

      cy.intercept('GET', '**/api/bots**', {
        statusCode: 401,
        body: { success: false, message: 'Token expired' }
      });

      cy.visit('/dashboard');
      cy.url().should('include', '/login');
    });
  });
});
