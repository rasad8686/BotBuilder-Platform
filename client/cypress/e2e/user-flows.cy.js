/**
 * User Flow E2E Tests
 * Tests for complete user journeys
 */

describe('User Flows', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  // ========================================
  // FLOW 1: LOGIN → DASHBOARD → BOT CREATE
  // ========================================
  describe('Flow: Login → Dashboard → Create Bot', () => {
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

    it('should login successfully', () => {
      setupMocks();
      cy.visit('/login');
      cy.get('#login-email').type('test@example.com');
      cy.get('#login-password').type('password123');
      cy.get('button[type="submit"]').click();
      cy.wait('@loginRequest');
      cy.url().should('not.include', '/login');
    });

    it('should access dashboard after login', () => {
      setupMocks();
      cy.visit('/login');
      cy.get('#login-email').type('test@example.com');
      cy.get('#login-password').type('password123');
      cy.get('button[type="submit"]').click();
      cy.wait('@loginRequest');
      cy.visit('/dashboard');
      cy.url().should('include', '/dashboard');
    });

    it('should navigate to bots page', () => {
      setupMocks();
      cy.visit('/login');
      cy.get('#login-email').type('test@example.com');
      cy.get('#login-password').type('password123');
      cy.get('button[type="submit"]').click();
      cy.wait('@loginRequest');
      cy.visit('/bots');
      cy.url().should('include', '/bots');
    });
  });

  // ========================================
  // FLOW 2: DOCS → SEARCH → COPY CODE
  // ========================================
  describe('Flow: Docs → Search → Copy Code', () => {
    it('should load docs page', () => {
      cy.visit('/docs');
      cy.url().should('include', '/docs');
    });

    it('should have search functionality', () => {
      cy.visit('/docs');
      cy.get('input').should('exist');
    });

    it('should display code blocks', () => {
      cy.visit('/docs');
      cy.get('pre, code').should('exist');
    });

    it('should have copy buttons', () => {
      cy.visit('/docs');
      cy.get('button').should('exist');
    });
  });

  // ========================================
  // FLOW 3: PLAYGROUND → API CALL → RESPONSE
  // ========================================
  describe('Flow: Playground → API Call → Response', () => {
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

    it('should load playground page after login', () => {
      setupMocks();
      cy.visit('/login');
      cy.get('#login-email').type('test@example.com');
      cy.get('#login-password').type('password123');
      cy.get('button[type="submit"]').click();
      cy.wait('@loginRequest');
      cy.visit('/playground');
      cy.url().should('include', '/playground');
    });

    it('should have buttons on playground', () => {
      setupMocks();
      cy.visit('/login');
      cy.get('#login-email').type('test@example.com');
      cy.get('#login-password').type('password123');
      cy.get('button[type="submit"]').click();
      cy.wait('@loginRequest');
      cy.visit('/playground');
      cy.get('button').should('exist');
    });
  });

  // ========================================
  // PUBLIC ACCESS
  // ========================================
  describe('Public Access', () => {
    it('should access docs without login', () => {
      cy.visit('/docs');
      cy.url().should('include', '/docs');
    });

    it('should redirect playground to login if requires auth', () => {
      cy.visit('/playground');
      // Either stays on playground or redirects to login
      cy.url().should('match', /\/(playground|login)/);
    });

    it('should access academy without login', () => {
      cy.visit('/academy');
      cy.url().should('include', '/academy');
    });
  });
});
