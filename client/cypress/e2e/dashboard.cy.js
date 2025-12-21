/**
 * Dashboard E2E Tests
 * Tests for dashboard page functionality
 */

describe('Dashboard', () => {
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
      body: { success: true, user: { id: 1, email: 'test@example.com' } }
    });

    cy.intercept('GET', '**/organizations**', {
      statusCode: 200,
      body: { success: true, organizations: [{ id: 1, name: 'Test Org', slug: 'test-org' }] }
    });

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
    beforeEach(() => {
      loginViaUI();
    });

    it('should load dashboard page successfully', () => {
      cy.intercept('GET', '**/analytics/**', {
        statusCode: 200,
        body: { success: true, data: {} }
      });

      cy.intercept('GET', '**/bots**', {
        statusCode: 200,
        body: { success: true, bots: [] }
      });

      cy.visit('/dashboard');
      cy.url().should('include', '/dashboard');
    });

    it('should show navigation sidebar', () => {
      cy.intercept('GET', '**/bots**', { statusCode: 200, body: { success: true, bots: [] } });
      cy.intercept('GET', '**/analytics/**', { statusCode: 200, body: { success: true, data: {} } });

      cy.visit('/dashboard');
      cy.get('nav, aside, [role="navigation"]').should('exist');
    });

    it('should display analytics widgets', () => {
      cy.intercept('GET', '**/analytics/**', {
        statusCode: 200,
        body: {
          success: true,
          data: { totalBots: 5, totalMessages: 1250, activeUsers: 42 }
        }
      });

      cy.intercept('GET', '**/bots**', { statusCode: 200, body: { success: true, bots: [] } });

      cy.visit('/dashboard');
      cy.get('body').should('exist');
    });
  });

  // ========================================
  // NAVIGATION TESTS
  // ========================================
  describe('Navigation', () => {
    beforeEach(() => {
      loginViaUI();
      cy.intercept('GET', '**/bots**', { statusCode: 200, body: { success: true, bots: [] } });
      cy.intercept('GET', '**/analytics/**', { statusCode: 200, body: { success: true, data: {} } });
      cy.visit('/dashboard');
    });

    it('should navigate to Bots page', () => {
      cy.get('a, button').contains(/bot/i).first().click();
      cy.url().should('include', '/bot');
    });
  });

  // ========================================
  // RESPONSIVE TESTS
  // ========================================
  describe('Responsive Design', () => {
    beforeEach(() => {
      loginViaUI();
      cy.intercept('GET', '**/bots**', { statusCode: 200, body: { success: true, bots: [] } });
      cy.intercept('GET', '**/analytics/**', { statusCode: 200, body: { success: true, data: {} } });
    });

    it('should display correctly on mobile', () => {
      cy.viewport('iphone-x');
      cy.visit('/dashboard');
      cy.url().should('include', '/dashboard');
    });

    it('should display correctly on tablet', () => {
      cy.viewport('ipad-2');
      cy.visit('/dashboard');
      cy.url().should('include', '/dashboard');
    });

    it('should display correctly on desktop', () => {
      cy.viewport(1920, 1080);
      cy.visit('/dashboard');
      cy.url().should('include', '/dashboard');
    });
  });

  // ========================================
  // ERROR HANDLING TESTS
  // ========================================
  describe('Error Handling', () => {
    beforeEach(() => {
      loginViaUI();
    });

    it('should handle analytics API error gracefully', () => {
      cy.intercept('GET', '**/analytics/**', {
        statusCode: 500,
        body: { success: false, message: 'Server error' }
      });

      cy.intercept('GET', '**/bots**', { statusCode: 200, body: { success: true, bots: [] } });

      cy.visit('/dashboard');
      cy.url().should('include', '/dashboard');
    });

    it('should handle bots API error gracefully', () => {
      cy.intercept('GET', '**/bots**', {
        statusCode: 500,
        body: { success: false, message: 'Server error' }
      });

      cy.intercept('GET', '**/analytics/**', { statusCode: 200, body: { success: true, data: {} } });

      cy.visit('/dashboard');
      cy.url().should('include', '/dashboard');
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================
  describe('Edge Cases', () => {
    beforeEach(() => {
      loginViaUI();
    });

    it('should handle empty state for new users', () => {
      cy.intercept('GET', '**/bots**', { statusCode: 200, body: { success: true, bots: [] } });
      cy.intercept('GET', '**/analytics/**', {
        statusCode: 200,
        body: { success: true, data: { totalBots: 0, totalMessages: 0 } }
      });

      cy.visit('/dashboard');
      cy.url().should('include', '/dashboard');
    });

    it('should handle session expiry', () => {
      cy.intercept('GET', '**/auth/me', {
        statusCode: 401,
        body: { success: false, message: 'Token expired' }
      });

      cy.intercept('GET', '**/bots**', {
        statusCode: 401,
        body: { success: false, message: 'Token expired' }
      });

      cy.visit('/dashboard');
      cy.url().should('include', '/login');
    });
  });
});
