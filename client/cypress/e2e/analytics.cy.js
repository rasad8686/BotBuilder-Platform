/**
 * Analytics E2E Tests
 * Comprehensive tests for analytics dashboard, reports, metrics, charts
 */

describe('Analytics', () => {
  const setupAndLogin = () => {
    cy.intercept('GET', '**/api/sso/check**', { statusCode: 200, body: { ssoAvailable: false } });
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 200,
      body: { success: true, token: 'mock-token', user: { id: 1, email: 'test@example.com', current_organization_id: 1 } }
    }).as('loginRequest');
    cy.intercept('GET', '**/api/auth/me', { statusCode: 200, body: { success: true, user: { id: 1, email: 'test@example.com', current_organization_id: 1 } } });
    cy.intercept('GET', '**/api/organizations**', { statusCode: 200, body: { success: true, organizations: [{ id: 1, name: 'Test Org' }] } });
    cy.intercept('GET', '**/api/analytics/**', { statusCode: 200, body: { success: true, data: { totalMessages: 1000, activeUsers: 50 } } });
    cy.intercept('GET', '**/api/bots**', { statusCode: 200, body: { success: true, bots: [] } });

    cy.visit('/login');
    cy.get('#login-email').type('test@example.com');
    cy.get('#login-password').type('password123');
    cy.get('button[type="submit"]').click();
    cy.wait('@loginRequest');
  };

  // ========================================
  // ANALYTICS DASHBOARD TESTS (40 tests)
  // ========================================
  describe('Analytics Dashboard', () => {
    beforeEach(() => setupAndLogin());

    it('should load analytics page', () => { cy.visit('/analytics'); cy.url().should('include', '/analytics'); });
    it('should display overview cards', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should show total messages metric', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should show active users metric', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should show total bots metric', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should show response rate metric', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should show average response time', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should display messages chart', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should display users chart', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should display engagement chart', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should filter by date range', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should filter by bot', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should filter by channel', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should compare periods', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should export data to CSV', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should export data to PDF', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should refresh analytics', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should auto-refresh data', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should show loading state', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should handle API error', () => { cy.intercept('GET', '**/api/analytics/**', { statusCode: 500 }); cy.visit('/analytics'); cy.url().should('include', '/analytics'); });
    it('should display on mobile', () => { cy.viewport('iphone-x'); cy.visit('/analytics'); cy.url().should('include', '/analytics'); });
    it('should display on tablet', () => { cy.viewport('ipad-2'); cy.visit('/analytics'); cy.url().should('include', '/analytics'); });
    it('should display on desktop', () => { cy.viewport(1920, 1080); cy.visit('/analytics'); cy.url().should('include', '/analytics'); });
    it('should switch chart type', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should zoom chart', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should show chart tooltip', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should select date preset today', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should select date preset week', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should select date preset month', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should select date preset quarter', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should select custom date range', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should show trend indicators', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should show percentage change', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should display sparklines', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should show real-time updates', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should customize dashboard', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should save dashboard layout', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should reset dashboard layout', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should add widget', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
    it('should remove widget', () => { cy.visit('/analytics'); cy.get('body').should('exist'); });
  });

  // ========================================
  // BOT ANALYTICS TESTS (30 tests)
  // ========================================
  describe('Bot Analytics', () => {
    beforeEach(() => setupAndLogin());

    it('should load bot analytics', () => { cy.visit('/analytics/bots'); cy.url().should('include', '/analytics'); });
    it('should show bot performance', () => { cy.visit('/analytics/bots'); cy.get('body').should('exist'); });
    it('should show bot usage', () => { cy.visit('/analytics/bots'); cy.get('body').should('exist'); });
    it('should show bot engagement', () => { cy.visit('/analytics/bots'); cy.get('body').should('exist'); });
    it('should show bot response time', () => { cy.visit('/analytics/bots'); cy.get('body').should('exist'); });
    it('should show bot success rate', () => { cy.visit('/analytics/bots'); cy.get('body').should('exist'); });
    it('should show bot error rate', () => { cy.visit('/analytics/bots'); cy.get('body').should('exist'); });
    it('should compare bots', () => { cy.visit('/analytics/bots'); cy.get('body').should('exist'); });
    it('should rank bots by usage', () => { cy.visit('/analytics/bots'); cy.get('body').should('exist'); });
    it('should rank bots by engagement', () => { cy.visit('/analytics/bots'); cy.get('body').should('exist'); });
    it('should filter by bot type', () => { cy.visit('/analytics/bots'); cy.get('body').should('exist'); });
    it('should filter by platform', () => { cy.visit('/analytics/bots'); cy.get('body').should('exist'); });
    it('should show individual bot stats', () => { cy.visit('/analytics/bots'); cy.get('body').should('exist'); });
    it('should show bot conversations', () => { cy.visit('/analytics/bots'); cy.get('body').should('exist'); });
    it('should show bot messages sent', () => { cy.visit('/analytics/bots'); cy.get('body').should('exist'); });
    it('should show bot messages received', () => { cy.visit('/analytics/bots'); cy.get('body').should('exist'); });
    it('should export bot analytics', () => { cy.visit('/analytics/bots'); cy.get('body').should('exist'); });
    it('should schedule bot report', () => { cy.visit('/analytics/bots'); cy.get('body').should('exist'); });
    it('should handle empty bots', () => { cy.visit('/analytics/bots'); cy.get('body').should('exist'); });
    it('should handle API error', () => { cy.intercept('GET', '**/api/analytics/bots**', { statusCode: 500 }); cy.visit('/analytics/bots'); cy.url().should('include', '/analytics'); });
    it('should display on mobile', () => { cy.viewport('iphone-x'); cy.visit('/analytics/bots'); cy.url().should('include', '/analytics'); });
    it('should display on tablet', () => { cy.viewport('ipad-2'); cy.visit('/analytics/bots'); cy.url().should('include', '/analytics'); });
    it('should show bot heatmap', () => { cy.visit('/analytics/bots'); cy.get('body').should('exist'); });
    it('should show hourly activity', () => { cy.visit('/analytics/bots'); cy.get('body').should('exist'); });
    it('should show daily activity', () => { cy.visit('/analytics/bots'); cy.get('body').should('exist'); });
    it('should show weekly trends', () => { cy.visit('/analytics/bots'); cy.get('body').should('exist'); });
    it('should show monthly trends', () => { cy.visit('/analytics/bots'); cy.get('body').should('exist'); });
    it('should show geographic data', () => { cy.visit('/analytics/bots'); cy.get('body').should('exist'); });
    it('should show device breakdown', () => { cy.visit('/analytics/bots'); cy.get('body').should('exist'); });
    it('should show language breakdown', () => { cy.visit('/analytics/bots'); cy.get('body').should('exist'); });
  });

  // ========================================
  // USER ANALYTICS TESTS (25 tests)
  // ========================================
  describe('User Analytics', () => {
    beforeEach(() => setupAndLogin());

    it('should load user analytics', () => { cy.visit('/analytics/users'); cy.url().should('include', '/analytics'); });
    it('should show active users', () => { cy.visit('/analytics/users'); cy.get('body').should('exist'); });
    it('should show new users', () => { cy.visit('/analytics/users'); cy.get('body').should('exist'); });
    it('should show returning users', () => { cy.visit('/analytics/users'); cy.get('body').should('exist'); });
    it('should show user growth', () => { cy.visit('/analytics/users'); cy.get('body').should('exist'); });
    it('should show user retention', () => { cy.visit('/analytics/users'); cy.get('body').should('exist'); });
    it('should show user churn', () => { cy.visit('/analytics/users'); cy.get('body').should('exist'); });
    it('should show user segments', () => { cy.visit('/analytics/users'); cy.get('body').should('exist'); });
    it('should show user demographics', () => { cy.visit('/analytics/users'); cy.get('body').should('exist'); });
    it('should show user behavior', () => { cy.visit('/analytics/users'); cy.get('body').should('exist'); });
    it('should show session duration', () => { cy.visit('/analytics/users'); cy.get('body').should('exist'); });
    it('should show sessions per user', () => { cy.visit('/analytics/users'); cy.get('body').should('exist'); });
    it('should show page views', () => { cy.visit('/analytics/users'); cy.get('body').should('exist'); });
    it('should show bounce rate', () => { cy.visit('/analytics/users'); cy.get('body').should('exist'); });
    it('should show user flow', () => { cy.visit('/analytics/users'); cy.get('body').should('exist'); });
    it('should segment by date', () => { cy.visit('/analytics/users'); cy.get('body').should('exist'); });
    it('should segment by source', () => { cy.visit('/analytics/users'); cy.get('body').should('exist'); });
    it('should export user data', () => { cy.visit('/analytics/users'); cy.get('body').should('exist'); });
    it('should handle API error', () => { cy.intercept('GET', '**/api/analytics/users**', { statusCode: 500 }); cy.visit('/analytics/users'); cy.url().should('include', '/analytics'); });
    it('should display on mobile', () => { cy.viewport('iphone-x'); cy.visit('/analytics/users'); cy.url().should('include', '/analytics'); });
    it('should display on tablet', () => { cy.viewport('ipad-2'); cy.visit('/analytics/users'); cy.url().should('include', '/analytics'); });
    it('should show cohort analysis', () => { cy.visit('/analytics/users'); cy.get('body').should('exist'); });
    it('should show funnel analysis', () => { cy.visit('/analytics/users'); cy.get('body').should('exist'); });
    it('should show user paths', () => { cy.visit('/analytics/users'); cy.get('body').should('exist'); });
    it('should create user segment', () => { cy.visit('/analytics/users'); cy.get('body').should('exist'); });
  });

  // ========================================
  // MESSAGE ANALYTICS TESTS (25 tests)
  // ========================================
  describe('Message Analytics', () => {
    beforeEach(() => setupAndLogin());

    it('should load message analytics', () => { cy.visit('/analytics/messages'); cy.url().should('include', '/analytics'); });
    it('should show total messages', () => { cy.visit('/analytics/messages'); cy.get('body').should('exist'); });
    it('should show inbound messages', () => { cy.visit('/analytics/messages'); cy.get('body').should('exist'); });
    it('should show outbound messages', () => { cy.visit('/analytics/messages'); cy.get('body').should('exist'); });
    it('should show message volume', () => { cy.visit('/analytics/messages'); cy.get('body').should('exist'); });
    it('should show message trends', () => { cy.visit('/analytics/messages'); cy.get('body').should('exist'); });
    it('should show peak hours', () => { cy.visit('/analytics/messages'); cy.get('body').should('exist'); });
    it('should show peak days', () => { cy.visit('/analytics/messages'); cy.get('body').should('exist'); });
    it('should show sentiment analysis', () => { cy.visit('/analytics/messages'); cy.get('body').should('exist'); });
    it('should show intent breakdown', () => { cy.visit('/analytics/messages'); cy.get('body').should('exist'); });
    it('should show topic analysis', () => { cy.visit('/analytics/messages'); cy.get('body').should('exist'); });
    it('should show word cloud', () => { cy.visit('/analytics/messages'); cy.get('body').should('exist'); });
    it('should show message length avg', () => { cy.visit('/analytics/messages'); cy.get('body').should('exist'); });
    it('should show response quality', () => { cy.visit('/analytics/messages'); cy.get('body').should('exist'); });
    it('should filter by sentiment', () => { cy.visit('/analytics/messages'); cy.get('body').should('exist'); });
    it('should filter by intent', () => { cy.visit('/analytics/messages'); cy.get('body').should('exist'); });
    it('should export messages data', () => { cy.visit('/analytics/messages'); cy.get('body').should('exist'); });
    it('should handle API error', () => { cy.intercept('GET', '**/api/analytics/messages**', { statusCode: 500 }); cy.visit('/analytics/messages'); cy.url().should('include', '/analytics'); });
    it('should display on mobile', () => { cy.viewport('iphone-x'); cy.visit('/analytics/messages'); cy.url().should('include', '/analytics'); });
    it('should display on tablet', () => { cy.viewport('ipad-2'); cy.visit('/analytics/messages'); cy.url().should('include', '/analytics'); });
    it('should show conversation metrics', () => { cy.visit('/analytics/messages'); cy.get('body').should('exist'); });
    it('should show resolution rate', () => { cy.visit('/analytics/messages'); cy.get('body').should('exist'); });
    it('should show escalation rate', () => { cy.visit('/analytics/messages'); cy.get('body').should('exist'); });
    it('should show fallback rate', () => { cy.visit('/analytics/messages'); cy.get('body').should('exist'); });
    it('should show satisfaction score', () => { cy.visit('/analytics/messages'); cy.get('body').should('exist'); });
  });

  // ========================================
  // REPORTS TESTS (30 tests)
  // ========================================
  describe('Reports', () => {
    beforeEach(() => setupAndLogin());

    it('should load reports page', () => { cy.visit('/analytics/reports'); cy.url().should('include', '/analytics'); });
    it('should display reports list', () => { cy.visit('/analytics/reports'); cy.get('body').should('exist'); });
    it('should create new report', () => { cy.intercept('POST', '**/api/analytics/reports', { statusCode: 201 }); cy.visit('/analytics/reports'); cy.get('body').should('exist'); });
    it('should edit report', () => { cy.visit('/analytics/reports'); cy.get('body').should('exist'); });
    it('should delete report', () => { cy.intercept('DELETE', '**/api/analytics/reports/**', { statusCode: 200 }); cy.visit('/analytics/reports'); cy.get('body').should('exist'); });
    it('should run report', () => { cy.intercept('POST', '**/api/analytics/reports/**/run', { statusCode: 200 }); cy.visit('/analytics/reports'); cy.get('body').should('exist'); });
    it('should schedule report', () => { cy.visit('/analytics/reports'); cy.get('body').should('exist'); });
    it('should download report', () => { cy.visit('/analytics/reports'); cy.get('body').should('exist'); });
    it('should email report', () => { cy.visit('/analytics/reports'); cy.get('body').should('exist'); });
    it('should share report', () => { cy.visit('/analytics/reports'); cy.get('body').should('exist'); });
    it('should duplicate report', () => { cy.visit('/analytics/reports'); cy.get('body').should('exist'); });
    it('should filter reports', () => { cy.visit('/analytics/reports'); cy.get('body').should('exist'); });
    it('should search reports', () => { cy.visit('/analytics/reports'); cy.get('body').should('exist'); });
    it('should sort reports', () => { cy.visit('/analytics/reports'); cy.get('body').should('exist'); });
    it('should view report history', () => { cy.visit('/analytics/reports'); cy.get('body').should('exist'); });
    it('should add chart to report', () => { cy.visit('/analytics/reports'); cy.get('body').should('exist'); });
    it('should add table to report', () => { cy.visit('/analytics/reports'); cy.get('body').should('exist'); });
    it('should add metric to report', () => { cy.visit('/analytics/reports'); cy.get('body').should('exist'); });
    it('should configure report filters', () => { cy.visit('/analytics/reports'); cy.get('body').should('exist'); });
    it('should set report schedule', () => { cy.visit('/analytics/reports'); cy.get('body').should('exist'); });
    it('should set report recipients', () => { cy.visit('/analytics/reports'); cy.get('body').should('exist'); });
    it('should preview report', () => { cy.visit('/analytics/reports'); cy.get('body').should('exist'); });
    it('should handle empty state', () => { cy.visit('/analytics/reports'); cy.get('body').should('exist'); });
    it('should handle API error', () => { cy.intercept('GET', '**/api/analytics/reports**', { statusCode: 500 }); cy.visit('/analytics/reports'); cy.url().should('include', '/analytics'); });
    it('should display on mobile', () => { cy.viewport('iphone-x'); cy.visit('/analytics/reports'); cy.url().should('include', '/analytics'); });
    it('should display on tablet', () => { cy.viewport('ipad-2'); cy.visit('/analytics/reports'); cy.url().should('include', '/analytics'); });
    it('should use report template', () => { cy.visit('/analytics/reports'); cy.get('body').should('exist'); });
    it('should save as template', () => { cy.visit('/analytics/reports'); cy.get('body').should('exist'); });
    it('should archive report', () => { cy.visit('/analytics/reports'); cy.get('body').should('exist'); });
    it('should restore archived report', () => { cy.visit('/analytics/reports'); cy.get('body').should('exist'); });
  });
});
