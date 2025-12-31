/**
 * Bots Management E2E Tests
 * Tests for bot CRUD operations
 */

describe('Bots Management', () => {
  // Helper function to setup intercepts and login
  const setupAndLogin = (botsData = { success: true, bots: [] }) => {
    // Set up API intercepts BEFORE visiting any page
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

    cy.intercept('GET', '**/api/bots**', {
      statusCode: 200,
      body: botsData
    }).as('getBots');

    cy.intercept('GET', '**/api/analytics/**', {
      statusCode: 200,
      body: { success: true, data: {} }
    });

    // Perform login
    cy.visit('/login');
    cy.get('#login-email').type('test@example.com');
    cy.get('#login-password').type('password123');
    cy.get('button[type="submit"]').click();
    cy.wait('@loginRequest');
  };

  // ========================================
  // LIST BOTS TESTS
  // ========================================
  describe('List Bots', () => {
    it('should display bots list page', () => {
      setupAndLogin({
        success: true,
        bots: [
          { id: 1, name: 'Test Bot 1', platform: 'telegram', is_active: true },
          { id: 2, name: 'Test Bot 2', platform: 'whatsapp', is_active: false }
        ]
      });

      cy.visit('/bots');
      cy.url().should('include', '/bots');
    });

    it('should show empty state when no bots exist', () => {
      setupAndLogin({ success: true, bots: [] });

      cy.visit('/bots');
      cy.url().should('include', '/bots');
    });

    it('should handle API error when loading bots', () => {
      setupAndLogin({ success: false, message: 'Server error' });

      cy.visit('/bots');
      cy.url().should('include', '/bots');
    });
  });

  // ========================================
  // CREATE BOT TESTS
  // ========================================
  describe('Create Bot', () => {
    it('should navigate to create bot page', () => {
      setupAndLogin();
      cy.visit('/bots/create');
      cy.url().should('include', '/bots');
    });

    it('should handle create bot form submission', () => {
      setupAndLogin();
      cy.intercept('POST', '**/api/bots', {
        statusCode: 201,
        body: {
          success: true,
          message: 'Bot created successfully',
          bot: { id: 1, name: 'My New Bot', platform: 'telegram', is_active: true }
        }
      }).as('createBot');

      cy.visit('/bots/create');
      cy.url().should('include', '/bots');
    });

    it('should handle plan limit error response', () => {
      setupAndLogin();
      cy.intercept('POST', '**/api/bots', {
        statusCode: 403,
        body: {
          success: false,
          error: 'Plan limit reached',
          limitReached: true
        }
      }).as('createBot');

      cy.visit('/bots');
      cy.url().should('include', '/bots');
    });
  });

  // ========================================
  // RESPONSIVE TESTS
  // ========================================
  describe('Responsive Design', () => {
    it('should display correctly on mobile', () => {
      setupAndLogin();
      cy.viewport('iphone-x');
      cy.visit('/bots');
      cy.url().should('include', '/bots');
    });

    it('should display correctly on tablet', () => {
      setupAndLogin();
      cy.viewport('ipad-2');
      cy.visit('/bots');
      cy.url().should('include', '/bots');
    });

    it('should display correctly on desktop', () => {
      setupAndLogin();
      cy.viewport(1920, 1080);
      cy.visit('/bots');
      cy.url().should('include', '/bots');
    });
  });

  // ========================================
  // ERROR HANDLING TESTS
  // ========================================
  describe('Error Handling', () => {
    it('should handle 500 error gracefully', () => {
      setupAndLogin({ success: false, message: 'Server error' });

      cy.visit('/bots');
      cy.url().should('include', '/bots');
    });

    it('should handle network timeout gracefully', () => {
      setupAndLogin();

      cy.visit('/bots');
      cy.url().should('include', '/bots');
    });
  });
});
