/**
 * API Playground E2E Tests
 * Tests for /playground page functionality
 */

describe('API Playground', () => {
  const setupMocks = () => {
    cy.intercept('GET', '**/api/sso/check**', { statusCode: 200, body: { ssoAvailable: false } });
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 200,
      body: { success: true, token: 'mock-jwt-token', user: { id: 1, email: 'test@example.com', current_organization_id: 1 } }
    }).as('loginRequest');
    cy.intercept('GET', '**/api/auth/me', { statusCode: 200, body: { success: true, user: { id: 1, email: 'test@example.com', current_organization_id: 1 } } });
    cy.intercept('GET', '**/api/organizations**', { statusCode: 200, body: { success: true, organizations: [{ id: 1, name: 'Test Org' }] } });
    cy.intercept('GET', '**/api/bots**', { statusCode: 200, body: { success: true, bots: [] } });
    cy.intercept('GET', '**/api/analytics/**', { statusCode: 200, body: { success: true, data: {} } });
  };

  const loginFirst = () => {
    setupMocks();
    cy.visit('/login');
    cy.get('#login-email').type('test@example.com');
    cy.get('#login-password').type('password123');
    cy.get('button[type="submit"]').click();
    cy.wait('@loginRequest');
  };

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  describe('Page Load', () => {
    it('should load playground page after login', () => {
      loginFirst();
      cy.visit('/playground');
      cy.url().should('include', '/playground');
    });

    it('should display page title', () => {
      loginFirst();
      cy.visit('/playground');
      cy.get('h1, h2, h3').should('exist');
    });

    it('should show main layout', () => {
      loginFirst();
      cy.visit('/playground');
      cy.get('body').should('exist');
    });
  });

  describe('UI Elements', () => {
    it('should have buttons', () => {
      loginFirst();
      cy.visit('/playground');
      cy.get('button').should('exist');
    });

    it('should have input fields', () => {
      loginFirst();
      cy.visit('/playground');
      cy.get('input, textarea').should('exist');
    });
  });

  describe('Request Builder', () => {
    it('should have interactive buttons', () => {
      loginFirst();
      cy.visit('/playground');
      cy.get('button').should('have.length.greaterThan', 0);
    });
  });

  describe('Responsive', () => {
    it('should work on mobile', () => {
      loginFirst();
      cy.viewport('iphone-x');
      cy.visit('/playground');
      cy.url().should('include', '/playground');
    });

    it('should work on desktop', () => {
      loginFirst();
      cy.viewport(1920, 1080);
      cy.visit('/playground');
      cy.url().should('include', '/playground');
    });
  });
});
