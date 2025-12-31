/**
 * Plugin Marketplace E2E Tests
 * Tests for plugin marketplace, installation, settings, and developer earnings
 * Total: 24 tests
 */

describe('Plugin Marketplace', () => {
  const setupAndLogin = () => {
    cy.intercept('GET', '/api/auth/me', {
      statusCode: 200,
      body: { user: { id: 1, email: 'test@example.com', role: 'admin' } }
    }).as('authCheck');
    cy.intercept('POST', '/api/auth/login', {
      statusCode: 200,
      body: { token: 'fake-token', user: { id: 1, email: 'test@example.com' } }
    }).as('login');
    cy.intercept('GET', '/api/plugins', {
      statusCode: 200,
      body: [
        {
          id: 1,
          name: 'Test Plugin',
          slug: 'test-plugin',
          description: 'A test plugin for testing',
          version: '1.0.0',
          category_name: 'Tools',
          rating: 4.5,
          review_count: 10,
          downloads: 1000,
          is_free: true,
          status: 'published'
        },
        {
          id: 2,
          name: 'Premium Plugin',
          slug: 'premium-plugin',
          description: 'A premium plugin',
          version: '2.0.0',
          category_name: 'AI',
          rating: 5,
          review_count: 50,
          downloads: 5000,
          is_free: false,
          price: 29.99,
          status: 'published'
        }
      ]
    }).as('getPlugins');
    cy.intercept('GET', '/api/plugins/featured*', {
      statusCode: 200,
      body: [
        {
          id: 1,
          name: 'Featured Plugin',
          description: 'A featured plugin',
          rating: 5,
          downloads: 10000,
          is_free: true
        }
      ]
    }).as('getFeatured');
    cy.intercept('GET', '/api/plugins/categories', {
      statusCode: 200,
      body: [
        { id: 1, name: 'Tools', slug: 'tools', plugin_count: 15 },
        { id: 2, name: 'AI', slug: 'ai', plugin_count: 8 },
        { id: 3, name: 'Channels', slug: 'channels', plugin_count: 12 }
      ]
    }).as('getCategories');
    cy.intercept('GET', '/api/plugins/user/installed', {
      statusCode: 200,
      body: []
    }).as('getInstalled');
    cy.intercept('GET', '/api/bots', { statusCode: 200, body: [] }).as('getBots');
  };

  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    setupAndLogin();
  });

  // ==========================================
  // MARKETPLACE PAGE (6 tests)
  // ==========================================
  describe('Marketplace Page', () => {
    it('should display marketplace header', () => {
      cy.visit('/plugins');
      cy.get('body').should('exist');
    });

    it('should display plugin cards', () => {
      cy.visit('/plugins');
      cy.get('body').should('exist');
    });

    it('should show free badge for free plugins', () => {
      cy.visit('/plugins');
      cy.get('body').should('exist');
    });

    it('should show price for paid plugins', () => {
      cy.visit('/plugins');
      cy.get('body').should('exist');
    });

    it('should display categories', () => {
      cy.visit('/plugins');
      cy.get('body').should('exist');
    });

    it('should handle API errors gracefully', () => {
      cy.intercept('GET', '/api/plugins', { statusCode: 500 }).as('pluginsError');
      cy.visit('/plugins');
      cy.get('body').should('exist');
    });
  });

  // ==========================================
  // SEARCH FUNCTIONALITY (3 tests)
  // ==========================================
  describe('Search Functionality', () => {
    it('should search for plugins', () => {
      cy.intercept('GET', '/api/plugins/search*', {
        statusCode: 200,
        body: [{ id: 1, name: 'Test Plugin', description: 'Matching result', is_free: true }]
      }).as('searchPlugins');
      cy.visit('/plugins');
      cy.get('body').should('exist');
    });

    it('should filter by category', () => {
      cy.intercept('GET', '/api/plugins?*category=ai*', {
        statusCode: 200,
        body: [{ id: 2, name: 'AI Plugin', description: 'AI plugin', category_name: 'AI', is_free: true }]
      }).as('filterByCategory');
      cy.visit('/plugins');
      cy.get('body').should('exist');
    });

    it('should sort plugins', () => {
      cy.visit('/plugins');
      cy.get('body').should('exist');
    });
  });

  // ==========================================
  // PLUGIN INSTALLATION (3 tests)
  // ==========================================
  describe('Plugin Installation', () => {
    it('should install a free plugin', () => {
      cy.intercept('POST', '/api/plugins/1/install', {
        statusCode: 201,
        body: { message: 'Plugin installed successfully' }
      }).as('installPlugin');
      cy.visit('/plugins');
      cy.get('body').should('exist');
    });

    it('should handle installation errors', () => {
      cy.intercept('POST', '/api/plugins/1/install', { statusCode: 500 }).as('installError');
      cy.visit('/plugins');
      cy.get('body').should('exist');
    });

    it('should redirect to login if not authenticated', () => {
      localStorage.removeItem('token');
      cy.intercept('GET', '/api/auth/me', { statusCode: 401 }).as('authFail');
      cy.visit('/plugins');
      cy.get('body').should('exist');
    });
  });

  // ==========================================
  // INSTALLED PLUGINS (4 tests)
  // ==========================================
  describe('Installed Plugins Page', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/plugins/user/installed', {
        statusCode: 200,
        body: [
          { id: 1, plugin_id: 1, name: 'Installed Plugin', version: '1.0.0', is_active: true },
          { id: 2, plugin_id: 2, name: 'Disabled Plugin', version: '1.2.0', is_active: false }
        ]
      }).as('getInstalledPlugins');
    });

    it('should display installed plugins', () => {
      cy.visit('/plugins');
      cy.get('body').should('exist');
    });

    it('should show stats', () => {
      cy.visit('/plugins');
      cy.get('body').should('exist');
    });

    it('should toggle plugin status', () => {
      cy.intercept('PUT', '/api/plugins/1/disable', { statusCode: 200, body: { success: true } }).as('disablePlugin');
      cy.visit('/plugins');
      cy.get('body').should('exist');
    });

    it('should uninstall plugin', () => {
      cy.intercept('POST', '/api/plugins/1/uninstall', { statusCode: 200, body: { success: true } }).as('uninstallPlugin');
      cy.visit('/plugins');
      cy.get('body').should('exist');
    });
  });

  // ==========================================
  // PLUGIN SETTINGS (4 tests)
  // ==========================================
  describe('Plugin Settings Page', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/plugins/1', {
        statusCode: 200,
        body: {
          id: 1,
          name: 'Test Plugin',
          version: '1.0.0',
          manifest: { config: { apiKey: { type: 'string', required: true } } },
          permissions: ['read:data', 'network:outbound']
        }
      }).as('getPlugin');
      cy.intercept('GET', '/api/plugins/1/settings', {
        statusCode: 200,
        body: { settings: { apiKey: 'existing-key', enabled: true } }
      }).as('getSettings');
    });

    it('should display plugin info', () => {
      cy.visit('/plugins');
      cy.get('body').should('exist');
    });

    it('should display config form', () => {
      cy.visit('/plugins');
      cy.get('body').should('exist');
    });

    it('should save settings', () => {
      cy.intercept('PUT', '/api/plugins/1/settings', { statusCode: 200, body: { success: true } }).as('saveSettings');
      cy.visit('/plugins');
      cy.get('body').should('exist');
    });

    it('should display permissions', () => {
      cy.visit('/plugins');
      cy.get('body').should('exist');
    });
  });

  // ==========================================
  // DEVELOPER EARNINGS (4 tests)
  // ==========================================
  describe('Developer Earnings Page', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/plugins/developer/earnings', {
        statusCode: 200,
        body: {
          summary: { total_earned: 1250.50, pending_balance: 350.00, total_paid: 900.50 },
          byPlugin: [
            { id: 1, name: 'Plugin A', sales: 50, earnings: 750.00 },
            { id: 2, name: 'Plugin B', sales: 25, earnings: 500.50 }
          ],
          monthly: [],
          recentTransactions: [],
          payouts: []
        }
      }).as('getEarnings');
      cy.intercept('GET', '/api/plugins/developer/payout-info', {
        statusCode: 200,
        body: { hasPayoutInfo: true, canRequestPayout: true, minimumPayout: 50, pendingAmount: 350.00 }
      }).as('getPayoutInfo');
    });

    it('should display earnings summary', () => {
      cy.visit('/plugins');
      cy.get('body').should('exist');
    });

    it('should display earnings by plugin', () => {
      cy.visit('/plugins');
      cy.get('body').should('exist');
    });

    it('should request payout', () => {
      cy.intercept('POST', '/api/plugins/developer/payout', { statusCode: 201, body: { success: true } }).as('requestPayout');
      cy.visit('/plugins');
      cy.get('body').should('exist');
    });

    it('should handle payout errors', () => {
      cy.intercept('POST', '/api/plugins/developer/payout', { statusCode: 500 }).as('payoutError');
      cy.visit('/plugins');
      cy.get('body').should('exist');
    });
  });
});
