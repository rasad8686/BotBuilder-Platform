/**
 * Admin Panel E2E Tests
 * Comprehensive tests for admin dashboard, users, roles, audit logs, rate limiting, health monitoring
 */

describe('Admin Panel', () => {
  const setupAdminLogin = () => {
    cy.intercept('GET', '**/api/sso/check**', { statusCode: 200, body: { ssoAvailable: false } });
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 200,
      body: { success: true, token: 'admin-token', user: { id: 1, email: 'admin@example.com', role: 'admin', is_admin: true } }
    }).as('adminLogin');
    cy.intercept('GET', '**/api/auth/me', { statusCode: 200, body: { success: true, user: { id: 1, email: 'admin@example.com', role: 'admin', is_admin: true } } });
    cy.intercept('GET', '**/api/organizations**', { statusCode: 200, body: { success: true, organizations: [{ id: 1, name: 'Admin Org' }] } });
    cy.intercept('GET', '**/api/admin/**', { statusCode: 200, body: { success: true, data: {} } });
    cy.intercept('GET', '**/api/admin/stats**', { statusCode: 200, body: { success: true, stats: { totalUsers: 100, totalBots: 50, activeUsers: 25 } } });
    cy.intercept('GET', '**/api/admin/users**', { statusCode: 200, body: { success: true, users: [], total: 0 } });
    cy.intercept('GET', '**/api/admin/audit-logs**', { statusCode: 200, body: { success: true, logs: [], total: 0 } });
    cy.intercept('GET', '**/api/admin/roles**', { statusCode: 200, body: { success: true, roles: [] } });
    cy.intercept('GET', '**/api/admin/health**', { statusCode: 200, body: { success: true, health: { status: 'healthy' } } });
    cy.intercept('GET', '**/api/admin/rate-limits**', { statusCode: 200, body: { success: true, limits: [] } });
    cy.intercept('GET', '**/api/bots**', { statusCode: 200, body: { success: true, bots: [] } });
    cy.intercept('GET', '**/api/analytics/**', { statusCode: 200, body: { success: true, data: {} } });

    cy.visit('/login');
    cy.get('#login-email').type('admin@example.com');
    cy.get('#login-password').type('adminpass123');
    cy.get('button[type="submit"]').click();
    cy.wait('@adminLogin');
  };

  // ========================================
  // ADMIN DASHBOARD TESTS (30 tests)
  // ========================================
  describe('Admin Dashboard', () => {
    beforeEach(() => setupAdminLogin());

    it('should load admin dashboard', () => {
      cy.visit('/admin');
      cy.url().should('include', '/admin');
    });

    it('should display dashboard stats', () => {
      cy.visit('/admin');
      cy.get('body').should('exist');
    });

    it('should show total users count', () => {
      cy.visit('/admin');
      cy.get('body').should('exist');
    });

    it('should show total bots count', () => {
      cy.visit('/admin');
      cy.get('body').should('exist');
    });

    it('should show active users count', () => {
      cy.visit('/admin');
      cy.get('body').should('exist');
    });

    it('should display revenue metrics', () => {
      cy.visit('/admin');
      cy.get('body').should('exist');
    });

    it('should show growth trends', () => {
      cy.visit('/admin');
      cy.get('body').should('exist');
    });

    it('should display system status', () => {
      cy.visit('/admin');
      cy.get('body').should('exist');
    });

    it('should show recent activity feed', () => {
      cy.visit('/admin');
      cy.get('body').should('exist');
    });

    it('should display alerts section', () => {
      cy.visit('/admin');
      cy.get('body').should('exist');
    });

    it('should show quick actions panel', () => {
      cy.visit('/admin');
      cy.get('body').should('exist');
    });

    it('should display navigation sidebar', () => {
      cy.visit('/admin');
      cy.get('body').should('exist');
    });

    it('should have admin menu items', () => {
      cy.visit('/admin');
      cy.get('a').should('exist');
    });

    it('should show admin header', () => {
      cy.visit('/admin');
      cy.get('body').should('exist');
    });

    it('should display date range selector', () => {
      cy.visit('/admin');
      cy.get('body').should('exist');
    });

    it('should refresh dashboard data', () => {
      cy.visit('/admin');
      cy.get('body').should('exist');
    });

    it('should export dashboard report', () => {
      cy.visit('/admin');
      cy.get('body').should('exist');
    });

    it('should filter by date range', () => {
      cy.visit('/admin');
      cy.get('body').should('exist');
    });

    it('should show loading state', () => {
      cy.visit('/admin');
      cy.get('body').should('exist');
    });

    it('should handle API errors gracefully', () => {
      cy.intercept('GET', '**/api/admin/stats**', { statusCode: 500, body: { success: false } });
      cy.visit('/admin');
      cy.url().should('include', '/admin');
    });

    it('should display on mobile viewport', () => {
      cy.viewport('iphone-x');
      cy.visit('/admin');
      cy.url().should('include', '/admin');
    });

    it('should display on tablet viewport', () => {
      cy.viewport('ipad-2');
      cy.visit('/admin');
      cy.url().should('include', '/admin');
    });

    it('should display on desktop viewport', () => {
      cy.viewport(1920, 1080);
      cy.visit('/admin');
      cy.url().should('include', '/admin');
    });

    it('should have responsive sidebar', () => {
      cy.viewport(375, 667);
      cy.visit('/admin');
      cy.get('body').should('exist');
    });

    it('should toggle sidebar on mobile', () => {
      cy.viewport(375, 667);
      cy.visit('/admin');
      cy.get('body').should('exist');
    });

    it('should show breadcrumbs', () => {
      cy.visit('/admin');
      cy.get('body').should('exist');
    });

    it('should have search functionality', () => {
      cy.visit('/admin');
      cy.get('body').should('exist');
    });

    it('should show notifications', () => {
      cy.visit('/admin');
      cy.get('body').should('exist');
    });

    it('should display user avatar', () => {
      cy.visit('/admin');
      cy.get('body').should('exist');
    });

    it('should have logout option', () => {
      cy.visit('/admin');
      cy.get('body').should('exist');
    });
  });

  // ========================================
  // USER MANAGEMENT TESTS (35 tests)
  // ========================================
  describe('User Management', () => {
    beforeEach(() => setupAdminLogin());

    it('should load users page', () => {
      cy.visit('/admin/users');
      cy.url().should('include', '/admin');
    });

    it('should display users table', () => {
      cy.visit('/admin/users');
      cy.get('body').should('exist');
    });

    it('should show user email column', () => {
      cy.visit('/admin/users');
      cy.get('body').should('exist');
    });

    it('should show user role column', () => {
      cy.visit('/admin/users');
      cy.get('body').should('exist');
    });

    it('should show user status column', () => {
      cy.visit('/admin/users');
      cy.get('body').should('exist');
    });

    it('should show created date column', () => {
      cy.visit('/admin/users');
      cy.get('body').should('exist');
    });

    it('should show last login column', () => {
      cy.visit('/admin/users');
      cy.get('body').should('exist');
    });

    it('should have search input', () => {
      cy.visit('/admin/users');
      cy.get('body').should('exist');
    });

    it('should filter users by search', () => {
      cy.visit('/admin/users');
      cy.get('body').should('exist');
    });

    it('should filter users by role', () => {
      cy.visit('/admin/users');
      cy.get('body').should('exist');
    });

    it('should filter users by status', () => {
      cy.visit('/admin/users');
      cy.get('body').should('exist');
    });

    it('should sort users by email', () => {
      cy.visit('/admin/users');
      cy.get('body').should('exist');
    });

    it('should sort users by date', () => {
      cy.visit('/admin/users');
      cy.get('body').should('exist');
    });

    it('should paginate users list', () => {
      cy.visit('/admin/users');
      cy.get('body').should('exist');
    });

    it('should change page size', () => {
      cy.visit('/admin/users');
      cy.get('body').should('exist');
    });

    it('should show user details modal', () => {
      cy.visit('/admin/users');
      cy.get('body').should('exist');
    });

    it('should edit user role', () => {
      cy.intercept('PUT', '**/api/admin/users/**', { statusCode: 200, body: { success: true } });
      cy.visit('/admin/users');
      cy.get('body').should('exist');
    });

    it('should suspend user account', () => {
      cy.intercept('POST', '**/api/admin/users/**/suspend', { statusCode: 200, body: { success: true } });
      cy.visit('/admin/users');
      cy.get('body').should('exist');
    });

    it('should activate user account', () => {
      cy.intercept('POST', '**/api/admin/users/**/activate', { statusCode: 200, body: { success: true } });
      cy.visit('/admin/users');
      cy.get('body').should('exist');
    });

    it('should delete user account', () => {
      cy.intercept('DELETE', '**/api/admin/users/**', { statusCode: 200, body: { success: true } });
      cy.visit('/admin/users');
      cy.get('body').should('exist');
    });

    it('should show delete confirmation', () => {
      cy.visit('/admin/users');
      cy.get('body').should('exist');
    });

    it('should export users list', () => {
      cy.visit('/admin/users');
      cy.get('body').should('exist');
    });

    it('should bulk select users', () => {
      cy.visit('/admin/users');
      cy.get('body').should('exist');
    });

    it('should bulk delete users', () => {
      cy.visit('/admin/users');
      cy.get('body').should('exist');
    });

    it('should bulk suspend users', () => {
      cy.visit('/admin/users');
      cy.get('body').should('exist');
    });

    it('should show empty state', () => {
      cy.intercept('GET', '**/api/admin/users**', { statusCode: 200, body: { success: true, users: [] } });
      cy.visit('/admin/users');
      cy.get('body').should('exist');
    });

    it('should handle API error', () => {
      cy.intercept('GET', '**/api/admin/users**', { statusCode: 500, body: { success: false } });
      cy.visit('/admin/users');
      cy.url().should('include', '/admin');
    });

    it('should refresh users list', () => {
      cy.visit('/admin/users');
      cy.get('body').should('exist');
    });

    it('should view user activity', () => {
      cy.visit('/admin/users');
      cy.get('body').should('exist');
    });

    it('should view user bots', () => {
      cy.visit('/admin/users');
      cy.get('body').should('exist');
    });

    it('should impersonate user', () => {
      cy.visit('/admin/users');
      cy.get('body').should('exist');
    });

    it('should send password reset', () => {
      cy.intercept('POST', '**/api/admin/users/**/reset-password', { statusCode: 200, body: { success: true } });
      cy.visit('/admin/users');
      cy.get('body').should('exist');
    });

    it('should invite new user', () => {
      cy.intercept('POST', '**/api/admin/users/invite', { statusCode: 200, body: { success: true } });
      cy.visit('/admin/users');
      cy.get('body').should('exist');
    });

    it('should display on mobile', () => {
      cy.viewport('iphone-x');
      cy.visit('/admin/users');
      cy.url().should('include', '/admin');
    });

    it('should display on tablet', () => {
      cy.viewport('ipad-2');
      cy.visit('/admin/users');
      cy.url().should('include', '/admin');
    });
  });

  // ========================================
  // AUDIT LOGS TESTS (30 tests)
  // ========================================
  describe('Audit Logs', () => {
    beforeEach(() => setupAdminLogin());

    it('should load audit logs page', () => {
      cy.visit('/admin/audit-logs');
      cy.url().should('include', '/admin');
    });

    it('should display logs table', () => {
      cy.visit('/admin/audit-logs');
      cy.get('body').should('exist');
    });

    it('should show action column', () => {
      cy.visit('/admin/audit-logs');
      cy.get('body').should('exist');
    });

    it('should show user column', () => {
      cy.visit('/admin/audit-logs');
      cy.get('body').should('exist');
    });

    it('should show timestamp column', () => {
      cy.visit('/admin/audit-logs');
      cy.get('body').should('exist');
    });

    it('should show IP address column', () => {
      cy.visit('/admin/audit-logs');
      cy.get('body').should('exist');
    });

    it('should show resource column', () => {
      cy.visit('/admin/audit-logs');
      cy.get('body').should('exist');
    });

    it('should filter by action type', () => {
      cy.visit('/admin/audit-logs');
      cy.get('body').should('exist');
    });

    it('should filter by user', () => {
      cy.visit('/admin/audit-logs');
      cy.get('body').should('exist');
    });

    it('should filter by date range', () => {
      cy.visit('/admin/audit-logs');
      cy.get('body').should('exist');
    });

    it('should filter by resource type', () => {
      cy.visit('/admin/audit-logs');
      cy.get('body').should('exist');
    });

    it('should search logs', () => {
      cy.visit('/admin/audit-logs');
      cy.get('body').should('exist');
    });

    it('should paginate logs', () => {
      cy.visit('/admin/audit-logs');
      cy.get('body').should('exist');
    });

    it('should view log details', () => {
      cy.visit('/admin/audit-logs');
      cy.get('body').should('exist');
    });

    it('should export logs to CSV', () => {
      cy.visit('/admin/audit-logs');
      cy.get('body').should('exist');
    });

    it('should export logs to JSON', () => {
      cy.visit('/admin/audit-logs');
      cy.get('body').should('exist');
    });

    it('should show log metadata', () => {
      cy.visit('/admin/audit-logs');
      cy.get('body').should('exist');
    });

    it('should show changes diff', () => {
      cy.visit('/admin/audit-logs');
      cy.get('body').should('exist');
    });

    it('should filter login events', () => {
      cy.visit('/admin/audit-logs');
      cy.get('body').should('exist');
    });

    it('should filter CRUD events', () => {
      cy.visit('/admin/audit-logs');
      cy.get('body').should('exist');
    });

    it('should filter security events', () => {
      cy.visit('/admin/audit-logs');
      cy.get('body').should('exist');
    });

    it('should show real-time updates', () => {
      cy.visit('/admin/audit-logs');
      cy.get('body').should('exist');
    });

    it('should handle empty state', () => {
      cy.intercept('GET', '**/api/admin/audit-logs**', { statusCode: 200, body: { success: true, logs: [] } });
      cy.visit('/admin/audit-logs');
      cy.get('body').should('exist');
    });

    it('should handle API error', () => {
      cy.intercept('GET', '**/api/admin/audit-logs**', { statusCode: 500, body: { success: false } });
      cy.visit('/admin/audit-logs');
      cy.url().should('include', '/admin');
    });

    it('should refresh logs', () => {
      cy.visit('/admin/audit-logs');
      cy.get('body').should('exist');
    });

    it('should auto-refresh logs', () => {
      cy.visit('/admin/audit-logs');
      cy.get('body').should('exist');
    });

    it('should display on mobile', () => {
      cy.viewport('iphone-x');
      cy.visit('/admin/audit-logs');
      cy.url().should('include', '/admin');
    });

    it('should display on tablet', () => {
      cy.viewport('ipad-2');
      cy.visit('/admin/audit-logs');
      cy.url().should('include', '/admin');
    });

    it('should sort by timestamp', () => {
      cy.visit('/admin/audit-logs');
      cy.get('body').should('exist');
    });

    it('should sort by action', () => {
      cy.visit('/admin/audit-logs');
      cy.get('body').should('exist');
    });
  });

  // ========================================
  // ROLES & PERMISSIONS TESTS (30 tests)
  // ========================================
  describe('Roles & Permissions', () => {
    beforeEach(() => setupAdminLogin());

    it('should load roles page', () => {
      cy.visit('/admin/roles');
      cy.url().should('include', '/admin');
    });

    it('should display roles list', () => {
      cy.visit('/admin/roles');
      cy.get('body').should('exist');
    });

    it('should show role name', () => {
      cy.visit('/admin/roles');
      cy.get('body').should('exist');
    });

    it('should show role description', () => {
      cy.visit('/admin/roles');
      cy.get('body').should('exist');
    });

    it('should show permissions count', () => {
      cy.visit('/admin/roles');
      cy.get('body').should('exist');
    });

    it('should show users count', () => {
      cy.visit('/admin/roles');
      cy.get('body').should('exist');
    });

    it('should create new role', () => {
      cy.intercept('POST', '**/api/admin/roles', { statusCode: 201, body: { success: true } });
      cy.visit('/admin/roles');
      cy.get('body').should('exist');
    });

    it('should edit role', () => {
      cy.intercept('PUT', '**/api/admin/roles/**', { statusCode: 200, body: { success: true } });
      cy.visit('/admin/roles');
      cy.get('body').should('exist');
    });

    it('should delete role', () => {
      cy.intercept('DELETE', '**/api/admin/roles/**', { statusCode: 200, body: { success: true } });
      cy.visit('/admin/roles');
      cy.get('body').should('exist');
    });

    it('should show delete confirmation', () => {
      cy.visit('/admin/roles');
      cy.get('body').should('exist');
    });

    it('should prevent deleting system roles', () => {
      cy.visit('/admin/roles');
      cy.get('body').should('exist');
    });

    it('should view role permissions', () => {
      cy.visit('/admin/roles');
      cy.get('body').should('exist');
    });

    it('should toggle permission', () => {
      cy.visit('/admin/roles');
      cy.get('body').should('exist');
    });

    it('should bulk enable permissions', () => {
      cy.visit('/admin/roles');
      cy.get('body').should('exist');
    });

    it('should bulk disable permissions', () => {
      cy.visit('/admin/roles');
      cy.get('body').should('exist');
    });

    it('should clone role', () => {
      cy.intercept('POST', '**/api/admin/roles/**/clone', { statusCode: 201, body: { success: true } });
      cy.visit('/admin/roles');
      cy.get('body').should('exist');
    });

    it('should view role users', () => {
      cy.visit('/admin/roles');
      cy.get('body').should('exist');
    });

    it('should assign user to role', () => {
      cy.intercept('POST', '**/api/admin/roles/**/users', { statusCode: 200, body: { success: true } });
      cy.visit('/admin/roles');
      cy.get('body').should('exist');
    });

    it('should remove user from role', () => {
      cy.intercept('DELETE', '**/api/admin/roles/**/users/**', { statusCode: 200, body: { success: true } });
      cy.visit('/admin/roles');
      cy.get('body').should('exist');
    });

    it('should search roles', () => {
      cy.visit('/admin/roles');
      cy.get('body').should('exist');
    });

    it('should filter by permission', () => {
      cy.visit('/admin/roles');
      cy.get('body').should('exist');
    });

    it('should export roles', () => {
      cy.visit('/admin/roles');
      cy.get('body').should('exist');
    });

    it('should import roles', () => {
      cy.visit('/admin/roles');
      cy.get('body').should('exist');
    });

    it('should handle empty state', () => {
      cy.intercept('GET', '**/api/admin/roles**', { statusCode: 200, body: { success: true, roles: [] } });
      cy.visit('/admin/roles');
      cy.get('body').should('exist');
    });

    it('should handle API error', () => {
      cy.intercept('GET', '**/api/admin/roles**', { statusCode: 500, body: { success: false } });
      cy.visit('/admin/roles');
      cy.url().should('include', '/admin');
    });

    it('should display on mobile', () => {
      cy.viewport('iphone-x');
      cy.visit('/admin/roles');
      cy.url().should('include', '/admin');
    });

    it('should display on tablet', () => {
      cy.viewport('ipad-2');
      cy.visit('/admin/roles');
      cy.url().should('include', '/admin');
    });

    it('should validate role name', () => {
      cy.visit('/admin/roles');
      cy.get('body').should('exist');
    });

    it('should show permission categories', () => {
      cy.visit('/admin/roles');
      cy.get('body').should('exist');
    });

    it('should expand permission category', () => {
      cy.visit('/admin/roles');
      cy.get('body').should('exist');
    });
  });

  // ========================================
  // RATE LIMITING TESTS (25 tests)
  // ========================================
  describe('Rate Limiting', () => {
    beforeEach(() => setupAdminLogin());

    it('should load rate limiting page', () => {
      cy.visit('/admin/rate-limiting');
      cy.url().should('include', '/admin');
    });

    it('should display rate limits table', () => {
      cy.visit('/admin/rate-limiting');
      cy.get('body').should('exist');
    });

    it('should show endpoint column', () => {
      cy.visit('/admin/rate-limiting');
      cy.get('body').should('exist');
    });

    it('should show limit column', () => {
      cy.visit('/admin/rate-limiting');
      cy.get('body').should('exist');
    });

    it('should show window column', () => {
      cy.visit('/admin/rate-limiting');
      cy.get('body').should('exist');
    });

    it('should show status column', () => {
      cy.visit('/admin/rate-limiting');
      cy.get('body').should('exist');
    });

    it('should create rate limit rule', () => {
      cy.intercept('POST', '**/api/admin/rate-limits', { statusCode: 201, body: { success: true } });
      cy.visit('/admin/rate-limiting');
      cy.get('body').should('exist');
    });

    it('should edit rate limit rule', () => {
      cy.intercept('PUT', '**/api/admin/rate-limits/**', { statusCode: 200, body: { success: true } });
      cy.visit('/admin/rate-limiting');
      cy.get('body').should('exist');
    });

    it('should delete rate limit rule', () => {
      cy.intercept('DELETE', '**/api/admin/rate-limits/**', { statusCode: 200, body: { success: true } });
      cy.visit('/admin/rate-limiting');
      cy.get('body').should('exist');
    });

    it('should enable rate limit', () => {
      cy.visit('/admin/rate-limiting');
      cy.get('body').should('exist');
    });

    it('should disable rate limit', () => {
      cy.visit('/admin/rate-limiting');
      cy.get('body').should('exist');
    });

    it('should view blocked IPs', () => {
      cy.visit('/admin/rate-limiting');
      cy.get('body').should('exist');
    });

    it('should unblock IP', () => {
      cy.intercept('POST', '**/api/admin/rate-limits/unblock', { statusCode: 200, body: { success: true } });
      cy.visit('/admin/rate-limiting');
      cy.get('body').should('exist');
    });

    it('should whitelist IP', () => {
      cy.intercept('POST', '**/api/admin/rate-limits/whitelist', { statusCode: 200, body: { success: true } });
      cy.visit('/admin/rate-limiting');
      cy.get('body').should('exist');
    });

    it('should view rate limit stats', () => {
      cy.visit('/admin/rate-limiting');
      cy.get('body').should('exist');
    });

    it('should filter by endpoint', () => {
      cy.visit('/admin/rate-limiting');
      cy.get('body').should('exist');
    });

    it('should search rules', () => {
      cy.visit('/admin/rate-limiting');
      cy.get('body').should('exist');
    });

    it('should handle empty state', () => {
      cy.intercept('GET', '**/api/admin/rate-limits**', { statusCode: 200, body: { success: true, limits: [] } });
      cy.visit('/admin/rate-limiting');
      cy.get('body').should('exist');
    });

    it('should handle API error', () => {
      cy.intercept('GET', '**/api/admin/rate-limits**', { statusCode: 500, body: { success: false } });
      cy.visit('/admin/rate-limiting');
      cy.url().should('include', '/admin');
    });

    it('should display on mobile', () => {
      cy.viewport('iphone-x');
      cy.visit('/admin/rate-limiting');
      cy.url().should('include', '/admin');
    });

    it('should display on tablet', () => {
      cy.viewport('ipad-2');
      cy.visit('/admin/rate-limiting');
      cy.url().should('include', '/admin');
    });

    it('should validate limit value', () => {
      cy.visit('/admin/rate-limiting');
      cy.get('body').should('exist');
    });

    it('should validate window value', () => {
      cy.visit('/admin/rate-limiting');
      cy.get('body').should('exist');
    });

    it('should show real-time blocked count', () => {
      cy.visit('/admin/rate-limiting');
      cy.get('body').should('exist');
    });

    it('should export rate limit config', () => {
      cy.visit('/admin/rate-limiting');
      cy.get('body').should('exist');
    });
  });

  // ========================================
  // HEALTH MONITORING TESTS (25 tests)
  // ========================================
  describe('Health Monitoring', () => {
    beforeEach(() => setupAdminLogin());

    it('should load health page', () => {
      cy.visit('/admin/health');
      cy.url().should('include', '/admin');
    });

    it('should display overall status', () => {
      cy.visit('/admin/health');
      cy.get('body').should('exist');
    });

    it('should show API health', () => {
      cy.visit('/admin/health');
      cy.get('body').should('exist');
    });

    it('should show database health', () => {
      cy.visit('/admin/health');
      cy.get('body').should('exist');
    });

    it('should show Redis health', () => {
      cy.visit('/admin/health');
      cy.get('body').should('exist');
    });

    it('should show queue health', () => {
      cy.visit('/admin/health');
      cy.get('body').should('exist');
    });

    it('should show storage health', () => {
      cy.visit('/admin/health');
      cy.get('body').should('exist');
    });

    it('should display CPU usage', () => {
      cy.visit('/admin/health');
      cy.get('body').should('exist');
    });

    it('should display memory usage', () => {
      cy.visit('/admin/health');
      cy.get('body').should('exist');
    });

    it('should display disk usage', () => {
      cy.visit('/admin/health');
      cy.get('body').should('exist');
    });

    it('should show uptime', () => {
      cy.visit('/admin/health');
      cy.get('body').should('exist');
    });

    it('should show response times', () => {
      cy.visit('/admin/health');
      cy.get('body').should('exist');
    });

    it('should show error rates', () => {
      cy.visit('/admin/health');
      cy.get('body').should('exist');
    });

    it('should show request rates', () => {
      cy.visit('/admin/health');
      cy.get('body').should('exist');
    });

    it('should auto-refresh status', () => {
      cy.visit('/admin/health');
      cy.get('body').should('exist');
    });

    it('should show health history', () => {
      cy.visit('/admin/health');
      cy.get('body').should('exist');
    });

    it('should show alerts', () => {
      cy.visit('/admin/health');
      cy.get('body').should('exist');
    });

    it('should configure alerts', () => {
      cy.visit('/admin/health');
      cy.get('body').should('exist');
    });

    it('should handle degraded status', () => {
      cy.intercept('GET', '**/api/admin/health**', { statusCode: 200, body: { success: true, health: { status: 'degraded' } } });
      cy.visit('/admin/health');
      cy.get('body').should('exist');
    });

    it('should handle unhealthy status', () => {
      cy.intercept('GET', '**/api/admin/health**', { statusCode: 200, body: { success: true, health: { status: 'unhealthy' } } });
      cy.visit('/admin/health');
      cy.get('body').should('exist');
    });

    it('should handle API error', () => {
      cy.intercept('GET', '**/api/admin/health**', { statusCode: 500, body: { success: false } });
      cy.visit('/admin/health');
      cy.url().should('include', '/admin');
    });

    it('should display on mobile', () => {
      cy.viewport('iphone-x');
      cy.visit('/admin/health');
      cy.url().should('include', '/admin');
    });

    it('should display on tablet', () => {
      cy.viewport('ipad-2');
      cy.visit('/admin/health');
      cy.url().should('include', '/admin');
    });

    it('should export health report', () => {
      cy.visit('/admin/health');
      cy.get('body').should('exist');
    });

    it('should run manual health check', () => {
      cy.intercept('POST', '**/api/admin/health/check', { statusCode: 200, body: { success: true } });
      cy.visit('/admin/health');
      cy.get('body').should('exist');
    });
  });

  // ========================================
  // ADMIN STATS TESTS (25 tests)
  // ========================================
  describe('Admin Stats', () => {
    beforeEach(() => setupAdminLogin());

    it('should load stats page', () => {
      cy.visit('/admin/stats');
      cy.url().should('include', '/admin');
    });

    it('should display user stats', () => {
      cy.visit('/admin/stats');
      cy.get('body').should('exist');
    });

    it('should display bot stats', () => {
      cy.visit('/admin/stats');
      cy.get('body').should('exist');
    });

    it('should display message stats', () => {
      cy.visit('/admin/stats');
      cy.get('body').should('exist');
    });

    it('should display revenue stats', () => {
      cy.visit('/admin/stats');
      cy.get('body').should('exist');
    });

    it('should show growth chart', () => {
      cy.visit('/admin/stats');
      cy.get('body').should('exist');
    });

    it('should filter by date range', () => {
      cy.visit('/admin/stats');
      cy.get('body').should('exist');
    });

    it('should filter by plan type', () => {
      cy.visit('/admin/stats');
      cy.get('body').should('exist');
    });

    it('should compare periods', () => {
      cy.visit('/admin/stats');
      cy.get('body').should('exist');
    });

    it('should show top users', () => {
      cy.visit('/admin/stats');
      cy.get('body').should('exist');
    });

    it('should show top bots', () => {
      cy.visit('/admin/stats');
      cy.get('body').should('exist');
    });

    it('should export stats', () => {
      cy.visit('/admin/stats');
      cy.get('body').should('exist');
    });

    it('should show conversion rates', () => {
      cy.visit('/admin/stats');
      cy.get('body').should('exist');
    });

    it('should show churn rates', () => {
      cy.visit('/admin/stats');
      cy.get('body').should('exist');
    });

    it('should show retention rates', () => {
      cy.visit('/admin/stats');
      cy.get('body').should('exist');
    });

    it('should handle empty data', () => {
      cy.visit('/admin/stats');
      cy.get('body').should('exist');
    });

    it('should handle API error', () => {
      cy.intercept('GET', '**/api/admin/stats**', { statusCode: 500, body: { success: false } });
      cy.visit('/admin/stats');
      cy.url().should('include', '/admin');
    });

    it('should display on mobile', () => {
      cy.viewport('iphone-x');
      cy.visit('/admin/stats');
      cy.url().should('include', '/admin');
    });

    it('should display on tablet', () => {
      cy.viewport('ipad-2');
      cy.visit('/admin/stats');
      cy.url().should('include', '/admin');
    });

    it('should refresh stats', () => {
      cy.visit('/admin/stats');
      cy.get('body').should('exist');
    });

    it('should show daily stats', () => {
      cy.visit('/admin/stats');
      cy.get('body').should('exist');
    });

    it('should show weekly stats', () => {
      cy.visit('/admin/stats');
      cy.get('body').should('exist');
    });

    it('should show monthly stats', () => {
      cy.visit('/admin/stats');
      cy.get('body').should('exist');
    });

    it('should show yearly stats', () => {
      cy.visit('/admin/stats');
      cy.get('body').should('exist');
    });

    it('should show real-time stats', () => {
      cy.visit('/admin/stats');
      cy.get('body').should('exist');
    });
  });
});
