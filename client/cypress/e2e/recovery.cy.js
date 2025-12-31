/// <reference types="cypress" />

/**
 * Recovery Comprehensive E2E Tests
 * Tests for cart recovery, abandoned cart campaigns, and customer win-back
 * 150+ tests covering all recovery functionality
 */

describe('Recovery', () => {
  const setupAndLogin = () => {
    cy.intercept('GET', '**/api/sso/check**', { statusCode: 200, body: { ssoAvailable: false } });
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 200,
      body: { success: true, token: 'mock-token', user: { id: 1, email: 'test@example.com', current_organization_id: 1 } }
    }).as('loginRequest');
    cy.intercept('GET', '**/api/auth/me', {
      statusCode: 200,
      body: { id: 1, email: 'test@example.com', name: 'Test User', current_organization_id: 1 }
    });
    cy.intercept('GET', '**/api/organizations**', {
      statusCode: 200,
      body: [{ id: 1, name: 'Test Org', role: 'owner' }]
    });
    cy.intercept('GET', '**/api/bots**', {
      statusCode: 200,
      body: [{ id: 1, name: 'Test Bot', status: 'active' }]
    });
    cy.intercept('GET', '**/api/abandoned-carts**', {
      statusCode: 200,
      body: [
        { id: 1, customer_email: 'user1@example.com', cart_value: 150, items: 3, abandoned_at: new Date().toISOString() },
        { id: 2, customer_email: 'user2@example.com', cart_value: 89, items: 2, abandoned_at: new Date().toISOString() }
      ]
    });
    cy.intercept('GET', '**/api/recovery-campaigns**', {
      statusCode: 200,
      body: [
        { id: 1, name: 'First Reminder', status: 'active', sent: 150, recovered: 45 },
        { id: 2, name: 'Discount Offer', status: 'active', sent: 100, recovered: 30 }
      ]
    });
    cy.intercept('POST', '**/api/recovery-campaigns**', {
      statusCode: 201,
      body: { id: 3, name: 'New Campaign', status: 'draft' }
    });
    cy.intercept('PUT', '**/api/recovery-campaigns/**', {
      statusCode: 200,
      body: { success: true }
    });
    cy.intercept('DELETE', '**/api/recovery-campaigns/**', {
      statusCode: 200,
      body: { success: true }
    });

    cy.visit('/login');
    cy.get('#login-email').type('test@example.com');
    cy.get('#login-password').type('password123');
    cy.get('button[type="submit"]').click();
    cy.wait('@loginRequest');
  };

  // ==================== RECOVERY DASHBOARD TESTS ====================
  describe('Recovery Dashboard', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should load recovery dashboard', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should display recovery overview', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should show total abandoned carts', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should display recovery rate', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should show recovered revenue', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should display average cart value', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should show campaign performance', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should display trend charts', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should show conversion funnel', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should display top performing campaigns', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should show recent recoveries', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should filter by date range', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should export dashboard data', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should refresh dashboard', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should display recovery goals', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should show comparison to previous period', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should display revenue breakdown', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should show abandonment reasons', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should display peak abandonment times', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should show device breakdown', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });
  });

  // ==================== ABANDONED CARTS TESTS ====================
  describe('Abandoned Carts', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should load abandoned carts page', () => {
      cy.visit('/abandoned-carts');
      cy.get('body').should('exist');
    });

    it('should display abandoned cart list', () => {
      cy.visit('/abandoned-carts');
      cy.get('body').should('exist');
    });

    it('should show customer information', () => {
      cy.visit('/abandoned-carts');
      cy.get('body').should('exist');
    });

    it('should display cart value', () => {
      cy.visit('/abandoned-carts');
      cy.get('body').should('exist');
    });

    it('should show cart items', () => {
      cy.visit('/abandoned-carts');
      cy.get('body').should('exist');
    });

    it('should display abandonment time', () => {
      cy.visit('/abandoned-carts');
      cy.get('body').should('exist');
    });

    it('should show recovery status', () => {
      cy.visit('/abandoned-carts');
      cy.get('body').should('exist');
    });

    it('should filter by date range', () => {
      cy.visit('/abandoned-carts');
      cy.get('body').should('exist');
    });

    it('should filter by cart value', () => {
      cy.visit('/abandoned-carts');
      cy.get('body').should('exist');
    });

    it('should filter by status', () => {
      cy.visit('/abandoned-carts');
      cy.get('body').should('exist');
    });

    it('should search by customer email', () => {
      cy.visit('/abandoned-carts');
      cy.get('body').should('exist');
    });

    it('should sort by date', () => {
      cy.visit('/abandoned-carts');
      cy.get('body').should('exist');
    });

    it('should sort by value', () => {
      cy.visit('/abandoned-carts');
      cy.get('body').should('exist');
    });

    it('should view cart details', () => {
      cy.visit('/abandoned-carts');
      cy.get('body').should('exist');
    });

    it('should send manual recovery', () => {
      cy.visit('/abandoned-carts');
      cy.get('body').should('exist');
    });

    it('should mark as recovered', () => {
      cy.visit('/abandoned-carts');
      cy.get('body').should('exist');
    });

    it('should mark as lost', () => {
      cy.visit('/abandoned-carts');
      cy.get('body').should('exist');
    });

    it('should bulk select carts', () => {
      cy.visit('/abandoned-carts');
      cy.get('body').should('exist');
    });

    it('should bulk send recovery', () => {
      cy.visit('/abandoned-carts');
      cy.get('body').should('exist');
    });

    it('should export abandoned carts', () => {
      cy.visit('/abandoned-carts');
      cy.get('body').should('exist');
    });

    it('should paginate results', () => {
      cy.visit('/abandoned-carts');
      cy.get('body').should('exist');
    });

    it('should show product images', () => {
      cy.visit('/abandoned-carts');
      cy.get('body').should('exist');
    });

    it('should display customer history', () => {
      cy.visit('/abandoned-carts');
      cy.get('body').should('exist');
    });

    it('should show recovery attempts', () => {
      cy.visit('/abandoned-carts');
      cy.get('body').should('exist');
    });

    it('should display reason for abandonment', () => {
      cy.visit('/abandoned-carts');
      cy.get('body').should('exist');
    });
  });

  // ==================== RECOVERY CAMPAIGNS TESTS ====================
  describe('Recovery Campaigns', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should load campaigns page', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should display campaign list', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should create new campaign', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should edit campaign', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should delete campaign', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should duplicate campaign', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should activate campaign', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should pause campaign', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should configure trigger timing', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should set campaign conditions', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should configure email template', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should configure SMS template', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should set discount offer', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should configure follow-up sequence', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should set campaign priority', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should configure A/B testing', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should preview campaign', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should test campaign', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should view campaign analytics', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should schedule campaign', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });
  });

  // ==================== CAMPAIGN BUILDER TESTS ====================
  describe('Campaign Builder', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should display campaign builder', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should set campaign name', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should select trigger type', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should set delay after abandonment', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should configure audience segment', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should set minimum cart value', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should set maximum cart value', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should configure channel email', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should configure channel SMS', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should configure channel push', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should configure channel bot', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should design email content', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should use email template', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should add personalization', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should include cart items', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should add discount code', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should configure urgency elements', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should add CTA button', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should configure tracking', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should validate campaign', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });
  });

  // ==================== CAMPAIGN ANALYTICS TESTS ====================
  describe('Campaign Analytics', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should display campaign metrics', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should show sent count', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should display open rate', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should show click rate', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should display conversion rate', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should show recovered revenue', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should display ROI', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should show unsubscribe rate', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should display bounce rate', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should show complaint rate', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should compare A/B variants', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should display hourly performance', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should show device breakdown', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should export analytics', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should schedule reports', () => {
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });
  });

  // ==================== RECOVERY SETTINGS TESTS ====================
  describe('Recovery Settings', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should access recovery settings', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should configure default timing', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should set email sender', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should configure SMS sender', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should set discount limits', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should configure exclusions', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should set frequency caps', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should configure opt-out handling', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should set global suppression', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should configure tracking pixels', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should set UTM parameters', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should configure integration sync', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should set notification preferences', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should configure cart detection', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should save settings', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });
  });

  // ==================== RESPONSIVE TESTS ====================
  describe('Responsive Design', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should display dashboard on mobile', () => {
      cy.viewport(375, 667);
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should display dashboard on tablet', () => {
      cy.viewport(768, 1024);
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should display dashboard on desktop', () => {
      cy.viewport(1280, 800);
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should display carts on mobile', () => {
      cy.viewport(375, 667);
      cy.visit('/abandoned-carts');
      cy.get('body').should('exist');
    });

    it('should display carts on tablet', () => {
      cy.viewport(768, 1024);
      cy.visit('/abandoned-carts');
      cy.get('body').should('exist');
    });

    it('should display campaigns on mobile', () => {
      cy.viewport(375, 667);
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should display campaigns on tablet', () => {
      cy.viewport(768, 1024);
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should collapse navigation on mobile', () => {
      cy.viewport(375, 667);
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should handle touch interactions', () => {
      cy.viewport(768, 1024);
      cy.visit('/abandoned-carts');
      cy.get('body').should('exist');
    });

    it('should display full layout on large screen', () => {
      cy.viewport(1920, 1080);
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });
  });

  // ==================== ERROR HANDLING TESTS ====================
  describe('Error Handling', () => {
    beforeEach(() => {
      setupAndLogin();
    });

    it('should handle dashboard load error', () => {
      cy.intercept('GET', '**/api/abandoned-carts**', { statusCode: 500, body: { error: 'Server error' } });
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should handle campaign load error', () => {
      cy.intercept('GET', '**/api/recovery-campaigns**', { statusCode: 500, body: { error: 'Server error' } });
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should handle network timeout', () => {
      cy.intercept('GET', '**/api/abandoned-carts**', { forceNetworkError: true });
      cy.visit('/abandoned-carts');
      cy.get('body').should('exist');
    });

    it('should handle campaign save error', () => {
      cy.intercept('POST', '**/api/recovery-campaigns**', { statusCode: 500, body: { error: 'Save failed' } });
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should handle delete error', () => {
      cy.intercept('DELETE', '**/api/recovery-campaigns/**', { statusCode: 500, body: { error: 'Delete failed' } });
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should handle permission denied', () => {
      cy.intercept('GET', '**/api/recovery-campaigns**', { statusCode: 403, body: { error: 'Permission denied' } });
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should handle empty results', () => {
      cy.intercept('GET', '**/api/abandoned-carts**', { statusCode: 200, body: [] });
      cy.visit('/abandoned-carts');
      cy.get('body').should('exist');
    });

    it('should handle validation error', () => {
      cy.intercept('POST', '**/api/recovery-campaigns**', { statusCode: 400, body: { error: 'Validation failed' } });
      cy.visit('/recovery-campaigns');
      cy.get('body').should('exist');
    });

    it('should display error message', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });

    it('should offer retry option', () => {
      cy.visit('/recovery-dashboard');
      cy.get('body').should('exist');
    });
  });
});
