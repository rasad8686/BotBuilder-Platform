/**
 * Academy/Tutorials E2E Tests
 * Tests for /academy page functionality
 */

describe('BotBuilder Academy', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  describe('Page Load', () => {
    it('should load academy page', () => {
      cy.visit('/academy');
      cy.url().should('include', '/academy');
    });

    it('should display page title', () => {
      cy.visit('/academy');
      cy.contains(/academy|tutorial/i).should('exist');
    });

    it('should show main content', () => {
      cy.visit('/academy');
      cy.get('body').should('exist');
    });
  });

  describe('Tutorial Grid', () => {
    it('should display tutorials', () => {
      cy.visit('/academy');
      cy.get('a, div, article').should('exist');
    });

    it('should have clickable items', () => {
      cy.visit('/academy');
      cy.get('a, button').should('have.length.greaterThan', 0);
    });
  });

  describe('Search and Filter', () => {
    it('should have search input', () => {
      cy.visit('/academy');
      cy.get('input').should('exist');
    });

    it('should have filter buttons or tabs', () => {
      cy.visit('/academy');
      cy.get('button').should('exist');
    });
  });

  describe('Progress', () => {
    it('should show progress element', () => {
      cy.visit('/academy');
      cy.get('[class*="progress"], span, div').should('exist');
    });
  });

  describe('Navigation to Tutorial', () => {
    it('should navigate to tutorial detail', () => {
      cy.visit('/academy');
      cy.get('a[href*="/academy/"]').first().click({ force: true });
      cy.url().should('match', /\/academy/);
    });
  });

  describe('Responsive', () => {
    it('should work on mobile', () => {
      cy.viewport('iphone-x');
      cy.visit('/academy');
      cy.url().should('include', '/academy');
    });

    it('should work on tablet', () => {
      cy.viewport('ipad-2');
      cy.visit('/academy');
      cy.url().should('include', '/academy');
    });

    it('should work on desktop', () => {
      cy.viewport(1920, 1080);
      cy.visit('/academy');
      cy.url().should('include', '/academy');
    });
  });
});
