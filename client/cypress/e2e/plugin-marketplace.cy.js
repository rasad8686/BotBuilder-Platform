/**
 * Plugin Marketplace E2E Tests
 */

describe('Plugin Marketplace', () => {
  beforeEach(() => {
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
  });

  describe('Marketplace Page', () => {
    it('should display marketplace header', () => {
      cy.visit('/plugins/marketplace');
      cy.wait(['@getPlugins', '@getFeatured', '@getCategories']);

      cy.contains('Plugin Marketplace').should('be.visible');
      cy.contains('Developer Portal').should('be.visible');
    });

    it('should display plugin cards', () => {
      cy.visit('/plugins/marketplace');
      cy.wait('@getPlugins');

      cy.contains('Test Plugin').should('be.visible');
      cy.contains('Premium Plugin').should('be.visible');
    });

    it('should show free badge for free plugins', () => {
      cy.visit('/plugins/marketplace');
      cy.wait('@getPlugins');

      cy.contains('.plugin-card', 'Test Plugin')
        .find('.free-badge')
        .should('contain', 'Free');
    });

    it('should show price for paid plugins', () => {
      cy.visit('/plugins/marketplace');
      cy.wait('@getPlugins');

      cy.contains('.plugin-card', 'Premium Plugin')
        .find('.price')
        .should('contain', '$29.99');
    });

    it('should display categories', () => {
      cy.visit('/plugins/marketplace');
      cy.wait('@getCategories');

      cy.contains('Tools').should('be.visible');
      cy.contains('AI').should('be.visible');
      cy.contains('Channels').should('be.visible');
    });
  });

  describe('Search Functionality', () => {
    it('should search for plugins', () => {
      cy.intercept('GET', '/api/plugins/search*', {
        statusCode: 200,
        body: [
          {
            id: 1,
            name: 'Test Plugin',
            description: 'Matching result',
            is_free: true
          }
        ]
      }).as('searchPlugins');

      cy.visit('/plugins/marketplace');
      cy.wait('@getPlugins');

      cy.get('input[placeholder*="Search"]').type('test');
      cy.get('button').contains('Search').click();

      cy.wait('@searchPlugins');
      cy.contains('Test Plugin').should('be.visible');
    });

    it('should filter by category', () => {
      cy.intercept('GET', '/api/plugins?*category=ai*', {
        statusCode: 200,
        body: [
          {
            id: 2,
            name: 'AI Plugin',
            description: 'AI plugin',
            category_name: 'AI',
            is_free: true
          }
        ]
      }).as('filterByCategory');

      cy.visit('/plugins/marketplace');
      cy.wait('@getPlugins');

      cy.get('select').first().select('ai');
      cy.wait('@filterByCategory');
    });

    it('should sort plugins', () => {
      cy.visit('/plugins/marketplace');
      cy.wait('@getPlugins');

      cy.get('select').eq(1).select('rating');
      // Should trigger new request with orderBy=rating
    });
  });

  describe('Plugin Installation', () => {
    beforeEach(() => {
      localStorage.setItem('token', 'test-token');
    });

    it('should install a free plugin', () => {
      cy.intercept('POST', '/api/plugins/1/install', {
        statusCode: 201,
        body: { message: 'Plugin installed successfully' }
      }).as('installPlugin');

      cy.visit('/plugins/marketplace');
      cy.wait('@getPlugins');

      cy.contains('.plugin-card', 'Test Plugin')
        .find('.install-btn')
        .click();

      cy.wait('@installPlugin');
      cy.contains('Installed').should('be.visible');
    });

    it('should redirect to login if not authenticated', () => {
      localStorage.removeItem('token');

      cy.visit('/plugins/marketplace');
      cy.wait('@getPlugins');

      cy.contains('.plugin-card', 'Test Plugin')
        .find('.install-btn')
        .click();

      cy.url().should('include', '/login');
    });
  });

  describe('Plugin Details Navigation', () => {
    it('should navigate to plugin details on card click', () => {
      cy.visit('/plugins/marketplace');
      cy.wait('@getPlugins');

      cy.contains('.plugin-card', 'Test Plugin').click();
      cy.url().should('include', '/plugins/1');
    });
  });
});

describe('Installed Plugins Page', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token');

    cy.intercept('GET', '/api/plugins/user/installed', {
      statusCode: 200,
      body: [
        {
          id: 1,
          plugin_id: 1,
          name: 'Installed Plugin',
          description: 'An installed plugin',
          version: '1.0.0',
          category_name: 'Tools',
          is_active: true,
          installed_at: new Date().toISOString()
        },
        {
          id: 2,
          plugin_id: 2,
          name: 'Disabled Plugin',
          description: 'A disabled plugin',
          version: '1.2.0',
          category_name: 'AI',
          is_active: false,
          installed_at: new Date().toISOString()
        }
      ]
    }).as('getInstalledPlugins');
  });

  it('should display installed plugins', () => {
    cy.visit('/plugins/installed');
    cy.wait('@getInstalledPlugins');

    cy.contains('Installed Plugin').should('be.visible');
    cy.contains('Disabled Plugin').should('be.visible');
  });

  it('should show stats', () => {
    cy.visit('/plugins/installed');
    cy.wait('@getInstalledPlugins');

    cy.contains('Total Plugins').should('be.visible');
    cy.contains('Active').should('be.visible');
    cy.contains('Inactive').should('be.visible');
  });

  it('should toggle plugin status', () => {
    cy.intercept('PUT', '/api/plugins/1/disable', {
      statusCode: 200,
      body: { success: true }
    }).as('disablePlugin');

    cy.visit('/plugins/installed');
    cy.wait('@getInstalledPlugins');

    cy.contains('.plugin-item', 'Installed Plugin')
      .find('.toggle-switch input')
      .click();

    cy.wait('@disablePlugin');
  });

  it('should uninstall plugin', () => {
    cy.intercept('POST', '/api/plugins/1/uninstall', {
      statusCode: 200,
      body: { success: true }
    }).as('uninstallPlugin');

    cy.visit('/plugins/installed');
    cy.wait('@getInstalledPlugins');

    cy.contains('.plugin-item', 'Installed Plugin')
      .find('.btn-uninstall')
      .click();

    cy.contains('Uninstall Plugin').should('be.visible');
    cy.contains('button', 'Uninstall').click();

    cy.wait('@uninstallPlugin');
  });

  it('should filter by status', () => {
    cy.visit('/plugins/installed');
    cy.wait('@getInstalledPlugins');

    cy.contains('button', 'Active').click();
    cy.contains('Installed Plugin').should('be.visible');
    cy.contains('Disabled Plugin').should('not.exist');

    cy.contains('button', 'Inactive').click();
    cy.contains('Disabled Plugin').should('be.visible');
    cy.contains('Installed Plugin').should('not.exist');
  });

  it('should navigate to settings', () => {
    cy.visit('/plugins/installed');
    cy.wait('@getInstalledPlugins');

    cy.contains('.plugin-item', 'Installed Plugin')
      .find('.btn-settings')
      .click();

    cy.url().should('include', '/plugins/1/settings');
  });
});

describe('Plugin Settings Page', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token');

    cy.intercept('GET', '/api/plugins/1', {
      statusCode: 200,
      body: {
        id: 1,
        name: 'Test Plugin',
        version: '1.0.0',
        manifest: {
          config: {
            apiKey: {
              type: 'string',
              label: 'API Key',
              required: true,
              description: 'Your API key'
            },
            enabled: {
              type: 'boolean',
              label: 'Enable Feature',
              default: true
            }
          }
        },
        permissions: ['read:data', 'network:outbound']
      }
    }).as('getPlugin');

    cy.intercept('GET', '/api/plugins/1/settings', {
      statusCode: 200,
      body: {
        settings: {
          apiKey: 'existing-key',
          enabled: true
        }
      }
    }).as('getSettings');
  });

  it('should display plugin info', () => {
    cy.visit('/plugins/1/settings');
    cy.wait(['@getPlugin', '@getSettings']);

    cy.contains('Test Plugin').should('be.visible');
    cy.contains('v1.0.0').should('be.visible');
  });

  it('should display config form', () => {
    cy.visit('/plugins/1/settings');
    cy.wait(['@getPlugin', '@getSettings']);

    cy.contains('API Key').should('be.visible');
    cy.contains('Enable Feature').should('be.visible');
  });

  it('should save settings', () => {
    cy.intercept('PUT', '/api/plugins/1/settings', {
      statusCode: 200,
      body: { success: true }
    }).as('saveSettings');

    cy.visit('/plugins/1/settings');
    cy.wait(['@getPlugin', '@getSettings']);

    cy.get('input[type="text"]').clear().type('new-api-key');
    cy.contains('button', 'Save Settings').click();

    cy.wait('@saveSettings');
    cy.contains('Settings saved').should('be.visible');
  });

  it('should display permissions', () => {
    cy.visit('/plugins/1/settings');
    cy.wait(['@getPlugin', '@getSettings']);

    cy.contains('button', 'Permissions').click();
    cy.contains('read:data').should('be.visible');
    cy.contains('network:outbound').should('be.visible');
  });
});

describe('Developer Earnings Page', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token');

    cy.intercept('GET', '/api/plugins/developer/earnings', {
      statusCode: 200,
      body: {
        summary: {
          total_earned: 1250.50,
          pending_balance: 350.00,
          total_paid: 900.50
        },
        byPlugin: [
          { id: 1, name: 'Plugin A', sales: 50, earnings: 750.00 },
          { id: 2, name: 'Plugin B', sales: 25, earnings: 500.50 }
        ],
        monthly: [
          { month: '2024-01-01', sales: 30, earnings: 450.00 },
          { month: '2024-02-01', sales: 45, earnings: 800.50 }
        ],
        recentTransactions: [],
        payouts: []
      }
    }).as('getEarnings');

    cy.intercept('GET', '/api/plugins/developer/payout-info', {
      statusCode: 200,
      body: {
        hasPayoutInfo: true,
        canRequestPayout: true,
        minimumPayout: 50,
        pendingAmount: 350.00,
        payoutInfo: {
          payout_method: 'paypal'
        }
      }
    }).as('getPayoutInfo');
  });

  it('should display earnings summary', () => {
    cy.visit('/plugins/earnings');
    cy.wait(['@getEarnings', '@getPayoutInfo']);

    cy.contains('$1,250.50').should('be.visible');
    cy.contains('$350.00').should('be.visible');
    cy.contains('$900.50').should('be.visible');
  });

  it('should display earnings by plugin', () => {
    cy.visit('/plugins/earnings');
    cy.wait('@getEarnings');

    cy.contains('Plugin A').should('be.visible');
    cy.contains('Plugin B').should('be.visible');
  });

  it('should request payout', () => {
    cy.intercept('POST', '/api/plugins/developer/payout', {
      statusCode: 201,
      body: { success: true }
    }).as('requestPayout');

    cy.visit('/plugins/earnings');
    cy.wait(['@getEarnings', '@getPayoutInfo']);

    cy.contains('button', 'Request Payout').click();
    cy.wait('@requestPayout');

    cy.contains('Payout requested').should('be.visible');
  });
});
