/**
 * Documentation Page E2E Tests
 * Tests for /docs page functionality
 */

describe('Documentation Page', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  describe('Page Load', () => {
    it('should load docs page successfully', () => {
      cy.visit('/docs');
      cy.url().should('include', '/docs');
    });

    it('should display page content', () => {
      cy.visit('/docs');
      cy.get('body').should('exist');
      cy.get('h1, h2, h3').should('exist');
    });

    it('should show navigation elements', () => {
      cy.visit('/docs');
      cy.get('nav, aside, a').should('exist');
    });
  });

  describe('Navigation', () => {
    it('should have navigation links', () => {
      cy.visit('/docs');
      cy.get('a').should('have.length.greaterThan', 0);
    });

    it('should stay on docs after clicking nav', () => {
      cy.visit('/docs');
      cy.get('nav a, aside a').first().click({ force: true });
      cy.url().should('include', '/docs');
    });
  });

  describe('Content', () => {
    it('should display code examples', () => {
      cy.visit('/docs');
      cy.get('pre, code').should('exist');
    });

    it('should have interactive elements', () => {
      cy.visit('/docs');
      cy.get('button').should('exist');
    });
  });

  describe('Responsive', () => {
    it('should work on mobile', () => {
      cy.viewport('iphone-x');
      cy.visit('/docs');
      cy.url().should('include', '/docs');
    });

    it('should work on tablet', () => {
      cy.viewport('ipad-2');
      cy.visit('/docs');
      cy.url().should('include', '/docs');
    });

    it('should work on desktop', () => {
      cy.viewport(1920, 1080);
      cy.visit('/docs');
      cy.url().should('include', '/docs');
    });
  });
});
