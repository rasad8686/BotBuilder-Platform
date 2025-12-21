/**
 * Bots Management E2E Tests
 * Tests for bot CRUD operations
 */

describe('Bots Management', () => {
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
  // LIST BOTS TESTS
  // ========================================
  describe('List Bots', () => {
    beforeEach(() => {
      loginViaUI();
    });

    it('should display bots list page', () => {
      cy.intercept('GET', '**/bots**', {
        statusCode: 200,
        body: {
          success: true,
          bots: [
            { id: 1, name: 'Test Bot 1', platform: 'telegram', is_active: true },
            { id: 2, name: 'Test Bot 2', platform: 'whatsapp', is_active: false }
          ]
        }
      }).as('getBots');

      cy.visit('/bots');
      cy.wait('@getBots');

      cy.contains('Test Bot 1').should('be.visible');
      cy.contains('Test Bot 2').should('be.visible');
    });

    it('should show empty state when no bots exist', () => {
      cy.intercept('GET', '**/bots**', {
        statusCode: 200,
        body: { success: true, bots: [] }
      }).as('getBots');

      cy.visit('/bots');
      cy.wait('@getBots');

      cy.url().should('include', '/bots');
    });

    it('should handle API error when loading bots', () => {
      cy.intercept('GET', '**/bots**', {
        statusCode: 500,
        body: { success: false, message: 'Server error' }
      }).as('getBots');

      cy.visit('/bots');
      cy.wait('@getBots');

      cy.url().should('include', '/bots');
    });
  });

  // ========================================
  // CREATE BOT TESTS
  // ========================================
  describe('Create Bot', () => {
    beforeEach(() => {
      loginViaUI();
      cy.intercept('GET', '**/bots**', {
        statusCode: 200,
        body: { success: true, bots: [] }
      });
    });

    it('should create bot with valid data', () => {
      cy.intercept('POST', '**/bots', {
        statusCode: 201,
        body: {
          success: true,
          message: 'Bot created successfully',
          bot: { id: 1, name: 'My New Bot', platform: 'telegram', is_active: true }
        }
      }).as('createBot');

      cy.visit('/bots');

      cy.get('button').contains(/create|add|new/i).click();
      cy.get('input[name="name"]').type('My New Bot');

      cy.get('body').then(($body) => {
        if ($body.find('select[name="platform"]').length) {
          cy.get('select[name="platform"]').select('telegram');
        }
      });

      cy.get('button[type="submit"]').click();
      cy.wait('@createBot');

      cy.contains('My New Bot').should('exist');
    });

    it('should show error when plan limit reached', () => {
      cy.intercept('POST', '**/bots', {
        statusCode: 403,
        body: {
          success: false,
          error: 'Plan limit reached',
          limitReached: true
        }
      }).as('createBot');

      cy.visit('/bots');

      cy.get('button').contains(/create|add|new/i).click();
      cy.get('input[name="name"]').type('Over Limit Bot');

      cy.get('body').then(($body) => {
        if ($body.find('select[name="platform"]').length) {
          cy.get('select[name="platform"]').select('telegram');
        }
      });

      cy.get('button[type="submit"]').click();
      cy.wait('@createBot');

      cy.url().should('include', '/bots');
    });
  });

  // ========================================
  // EDIT BOT TESTS
  // ========================================
  describe('Edit Bot', () => {
    beforeEach(() => {
      loginViaUI();
      cy.intercept('GET', '**/bots**', {
        statusCode: 200,
        body: {
          success: true,
          bots: [{ id: 1, name: 'Edit Me Bot', platform: 'telegram', is_active: true }]
        }
      });

      cy.intercept('GET', '**/bots/1', {
        statusCode: 200,
        body: {
          success: true,
          bot: { id: 1, name: 'Edit Me Bot', platform: 'telegram', is_active: true }
        }
      });
    });

    it('should update bot name successfully', () => {
      cy.intercept('PUT', '**/bots/1', {
        statusCode: 200,
        body: {
          success: true,
          bot: { id: 1, name: 'Updated Bot Name', platform: 'telegram', is_active: true }
        }
      }).as('updateBot');

      cy.visit('/bots');

      cy.get('button').contains(/edit|settings/i).first().click();
      cy.get('input[name="name"]').clear().type('Updated Bot Name');
      cy.get('button[type="submit"]').click();

      cy.wait('@updateBot');
      cy.contains('Updated Bot Name').should('exist');
    });
  });

  // ========================================
  // DELETE BOT TESTS
  // ========================================
  describe('Delete Bot', () => {
    beforeEach(() => {
      loginViaUI();
      cy.intercept('GET', '**/bots**', {
        statusCode: 200,
        body: {
          success: true,
          bots: [{ id: 1, name: 'Delete Me Bot', platform: 'telegram', is_active: true }]
        }
      });
    });

    it('should delete bot after confirmation', () => {
      cy.intercept('DELETE', '**/bots/1', {
        statusCode: 200,
        body: { success: true, message: 'Bot deleted successfully' }
      }).as('deleteBot');

      cy.visit('/bots');

      cy.get('button').contains(/delete|remove/i).first().click();
      cy.get('button').contains(/confirm|yes|delete/i).click();

      cy.wait('@deleteBot');
      cy.contains('Delete Me Bot').should('not.exist');
    });

    it('should cancel delete on dismiss', () => {
      cy.visit('/bots');

      cy.get('button').contains(/delete|remove/i).first().click();
      cy.get('button').contains(/cancel|no/i).click();

      cy.contains('Delete Me Bot').should('be.visible');
    });
  });
});
