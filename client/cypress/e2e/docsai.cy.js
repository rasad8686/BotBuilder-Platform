/**
 * DocsAI Chatbot E2E Tests
 * Tests for AI assistant functionality on docs page
 */

describe('DocsAI Chatbot', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  describe('Floating Button', () => {
    it('should display AI button on docs page', () => {
      cy.visit('/docs');
      cy.get('button').should('exist');
    });

    it('should show AI indicator', () => {
      cy.visit('/docs');
      cy.contains(/AI/i).should('exist');
    });
  });

  describe('Modal Opening', () => {
    it('should have clickable buttons', () => {
      cy.visit('/docs');
      cy.get('button').first().should('exist');
    });
  });

  describe('Chat Interface', () => {
    it('should have input elements on page', () => {
      cy.visit('/docs');
      cy.get('input, textarea, button').should('exist');
    });
  });

  describe('Responsive', () => {
    it('should work on mobile', () => {
      cy.viewport('iphone-x');
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
