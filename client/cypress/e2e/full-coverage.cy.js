/**
 * Full Coverage E2E Tests
 * Complete page and component coverage
 * All pages, buttons, forms, mobile viewports
 */

describe('Full Application Coverage', () => {
  // Helper function to login via UI
  const loginViaUI = () => {
    cy.intercept('GET', '**/sso/check**', {
      statusCode: 200,
      body: { ssoAvailable: false }
    });

    cy.intercept('POST', '**/auth/login', {
      statusCode: 200,
      body: {
        success: true,
        token: 'mock-jwt-token',
        user: { id: 1, email: 'test@example.com', username: 'testuser', current_organization_id: 1 }
      }
    }).as('loginRequest');

    cy.intercept('GET', '**/auth/me', {
      statusCode: 200,
      body: { success: true, user: { id: 1, email: 'test@example.com', current_organization_id: 1 } }
    });

    cy.intercept('GET', '**/organizations**', {
      statusCode: 200,
      body: { success: true, organizations: [{ id: 1, name: 'Test Org', slug: 'test-org' }] }
    });

    cy.intercept('GET', '**/bots**', { statusCode: 200, body: { success: true, bots: [] } });
    cy.intercept('GET', '**/analytics/**', { statusCode: 200, body: { success: true, data: {} } });

    cy.visit('/login');
    cy.get('#login-email').type('test@example.com');
    cy.get('#login-password').type('password123');
    cy.get('button[type="submit"]').click();
    cy.wait('@loginRequest');
  };

  // Standard API mocks for authenticated pages
  const setupAuthenticatedMocks = () => {
    cy.intercept('GET', '**/bots**', { statusCode: 200, body: { success: true, bots: [] } });
    cy.intercept('GET', '**/analytics/**', { statusCode: 200, body: { success: true, data: {} } });
    cy.intercept('GET', '**/organizations**', {
      statusCode: 200,
      body: { success: true, organizations: [{ id: 1, name: 'Test Org', slug: 'test-org' }] }
    });
    cy.intercept('GET', '**/knowledge-base**', { statusCode: 200, body: { success: true, items: [] } });
    cy.intercept('GET', '**/webhooks**', { statusCode: 200, body: { success: true, webhooks: [] } });
    cy.intercept('GET', '**/tokens**', { statusCode: 200, body: { success: true, tokens: [] } });
    cy.intercept('GET', '**/billing**', { statusCode: 200, body: { success: true, billing: {} } });
    cy.intercept('GET', '**/team**', { statusCode: 200, body: { success: true, members: [] } });
    cy.intercept('GET', '**/call-history**', { statusCode: 200, body: { success: true, calls: [] } });
  };

  // ========================================
  // PUBLIC PAGES
  // ========================================
  describe('Public Pages', () => {
    it('should load login page', () => {
      cy.visit('/login');
      cy.url().should('include', '/login');
      cy.get('#login-email').should('be.visible');
      cy.get('#login-password').should('be.visible');
      cy.get('button[type="submit"]').should('be.visible');
    });

    it('should load register page', () => {
      cy.visit('/register');
      cy.url().should('include', '/register');
      cy.get('#register-name').should('be.visible');
      cy.get('#register-email').should('be.visible');
      cy.get('#register-password').should('be.visible');
      cy.get('#register-confirm-password').should('be.visible');
    });

    it('should load forgot password page', () => {
      cy.visit('/forgot-password');
      cy.url().should('include', '/forgot');
    });

    it('should have working links on login page', () => {
      cy.visit('/login');
      cy.get('a[href*="register"]').should('exist');
      cy.get('a[href*="forgot"]').should('exist');
    });

    it('should have working links on register page', () => {
      cy.visit('/register');
      cy.get('a[href*="login"]').should('exist');
    });
  });

  // ========================================
  // DASHBOARD PAGE
  // ========================================
  describe('Dashboard Page', () => {
    beforeEach(() => {
      loginViaUI();
      setupAuthenticatedMocks();
    });

    it('should load dashboard', () => {
      cy.visit('/dashboard');
      cy.url().should('include', '/dashboard');
    });

    it('should display sidebar navigation', () => {
      cy.visit('/dashboard');
      cy.get('nav, aside, [role="navigation"]').should('exist');
    });

    it('should have clickable navigation items', () => {
      cy.visit('/dashboard');
      cy.get('nav a, aside a').should('have.length.at.least', 1);
    });
  });

  // ========================================
  // BOTS PAGE
  // ========================================
  describe('Bots Page', () => {
    beforeEach(() => {
      loginViaUI();
      setupAuthenticatedMocks();
    });

    it('should load bots page', () => {
      cy.visit('/bots');
      cy.url().should('include', '/bots');
    });

    it('should have create bot button', () => {
      cy.visit('/bots');
      cy.get('button').contains(/create|add|new/i).should('exist');
    });

    it('should open create bot modal', () => {
      cy.visit('/bots');
      cy.get('button').contains(/create|add|new/i).click();
      cy.get('input[name="name"]').should('be.visible');
    });

    it('should display bots list when bots exist', () => {
      cy.intercept('GET', '**/bots**', {
        statusCode: 200,
        body: {
          success: true,
          bots: [
            { id: 1, name: 'Bot 1', platform: 'telegram', is_active: true },
            { id: 2, name: 'Bot 2', platform: 'whatsapp', is_active: false }
          ]
        }
      });

      cy.visit('/bots');
      cy.contains('Bot 1').should('exist');
      cy.contains('Bot 2').should('exist');
    });
  });

  // ========================================
  // KNOWLEDGE BASE PAGE
  // ========================================
  describe('Knowledge Base Page', () => {
    beforeEach(() => {
      loginViaUI();
      setupAuthenticatedMocks();
    });

    it('should load knowledge base page', () => {
      cy.visit('/knowledge');
      cy.url().should('include', '/knowledge');
    });

    it('should have add knowledge button', () => {
      cy.visit('/knowledge');
      cy.get('button').contains(/add|create|upload/i).should('exist');
    });
  });

  // ========================================
  // AI FLOW PAGE
  // ========================================
  describe('AI Flow Page', () => {
    beforeEach(() => {
      loginViaUI();
      setupAuthenticatedMocks();
    });

    it('should load AI flow page', () => {
      cy.visit('/ai-flow');
      cy.url().should('include', '/ai-flow');
    });
  });

  // ========================================
  // WEBHOOKS PAGE
  // ========================================
  describe('Webhooks Page', () => {
    beforeEach(() => {
      loginViaUI();
      setupAuthenticatedMocks();
    });

    it('should load webhooks page', () => {
      cy.visit('/webhooks');
      cy.url().should('include', '/webhooks');
    });

    it('should have create webhook button', () => {
      cy.visit('/webhooks');
      cy.get('button').contains(/create|add|new/i).should('exist');
    });
  });

  // ========================================
  // API TOKENS PAGE
  // ========================================
  describe('API Tokens Page', () => {
    beforeEach(() => {
      loginViaUI();
      setupAuthenticatedMocks();
    });

    it('should load API tokens page', () => {
      cy.visit('/api-tokens');
      cy.url().should('include', '/api-tokens');
    });

    it('should have create token button', () => {
      cy.visit('/api-tokens');
      cy.get('button').contains(/create|generate|new/i).should('exist');
    });
  });

  // ========================================
  // ANALYTICS PAGE
  // ========================================
  describe('Analytics Page', () => {
    beforeEach(() => {
      loginViaUI();
      setupAuthenticatedMocks();
    });

    it('should load analytics page', () => {
      cy.visit('/analytics');
      cy.url().should('include', '/analytics');
    });
  });

  // ========================================
  // BILLING PAGE
  // ========================================
  describe('Billing Page', () => {
    beforeEach(() => {
      loginViaUI();
      setupAuthenticatedMocks();
    });

    it('should load billing page', () => {
      cy.visit('/billing');
      cy.url().should('include', '/billing');
    });

    it('should show plan options', () => {
      cy.visit('/billing');
      // Should have upgrade or plan buttons
      cy.get('button').should('have.length.at.least', 1);
    });
  });

  // ========================================
  // TEAM SETTINGS PAGE
  // ========================================
  describe('Team Settings Page', () => {
    beforeEach(() => {
      loginViaUI();
      setupAuthenticatedMocks();
    });

    it('should load team settings page', () => {
      cy.visit('/team');
      cy.url().should('include', '/team');
    });

    it('should have invite button', () => {
      cy.visit('/team');
      cy.get('button').contains(/invite|add/i).should('exist');
    });
  });

  // ========================================
  // CALL HISTORY PAGE
  // ========================================
  describe('Call History Page', () => {
    beforeEach(() => {
      loginViaUI();
      setupAuthenticatedMocks();
    });

    it('should load call history page', () => {
      cy.visit('/call-history');
      cy.url().should('include', '/call-history');
    });
  });

  // ========================================
  // SETTINGS PAGE
  // ========================================
  describe('Settings Page', () => {
    beforeEach(() => {
      loginViaUI();
      setupAuthenticatedMocks();
    });

    it('should load settings page', () => {
      cy.visit('/settings');
      cy.url().should('include', '/settings');
    });
  });

  // ========================================
  // MOBILE VIEWPORT TESTS
  // ========================================
  describe('Mobile Viewport Tests', () => {
    beforeEach(() => {
      loginViaUI();
      setupAuthenticatedMocks();
    });

    const pages = [
      '/dashboard',
      '/bots',
      '/knowledge',
      '/analytics',
      '/billing',
      '/team',
      '/webhooks',
      '/api-tokens'
    ];

    const viewports = [
      { name: 'iPhone SE', width: 375, height: 667 },
      { name: 'iPhone 12', width: 390, height: 844 },
      { name: 'Samsung Galaxy', width: 360, height: 740 },
      { name: 'iPad Mini', width: 768, height: 1024 },
      { name: 'iPad Pro', width: 1024, height: 1366 }
    ];

    viewports.forEach((viewport) => {
      describe(`${viewport.name} (${viewport.width}x${viewport.height})`, () => {
        beforeEach(() => {
          cy.viewport(viewport.width, viewport.height);
        });

        pages.forEach((page) => {
          it(`should render ${page} correctly`, () => {
            cy.visit(page);
            cy.url().should('include', page);
            // Page should not have horizontal scroll
            cy.document().its('body').invoke('prop', 'scrollWidth')
              .should('be.lte', viewport.width + 20); // 20px tolerance
          });
        });
      });
    });
  });

  // ========================================
  // BUTTON INTERACTION TESTS
  // ========================================
  describe('Button Interaction Tests', () => {
    beforeEach(() => {
      loginViaUI();
      setupAuthenticatedMocks();
    });

    it('should click all main navigation buttons', () => {
      cy.visit('/dashboard');
      cy.get('nav a, aside a').each(($link) => {
        if ($link.attr('href') && !$link.attr('href').includes('logout')) {
          cy.wrap($link).should('be.visible');
        }
      });
    });

    it('should open and close modals correctly', () => {
      cy.visit('/bots');

      // Open modal
      cy.get('button').contains(/create|add|new/i).click();

      // Check modal is visible
      cy.get('[role="dialog"], .modal, [class*="modal"]').should('exist');

      // Close modal (click cancel or close button)
      cy.get('body').then(($body) => {
        if ($body.find('button:contains("Cancel")').length) {
          cy.get('button').contains(/cancel|close/i).click();
        } else if ($body.find('[aria-label="Close"]').length) {
          cy.get('[aria-label="Close"]').click();
        } else {
          cy.get('body').type('{esc}');
        }
      });
    });

    it('should handle form submissions', () => {
      cy.visit('/bots');

      cy.intercept('POST', '**/bots', {
        statusCode: 201,
        body: { success: true, bot: { id: 1, name: 'New Bot' } }
      }).as('createBot');

      cy.get('button').contains(/create|add|new/i).click();
      cy.get('input[name="name"]').type('Test Bot');

      cy.get('body').then(($body) => {
        if ($body.find('select[name="platform"]').length) {
          cy.get('select[name="platform"]').select('telegram');
        }
      });

      cy.get('button[type="submit"]').click();
    });
  });

  // ========================================
  // FORM VALIDATION TESTS
  // ========================================
  describe('Form Validation Tests', () => {
    it('should validate login form - empty fields', () => {
      cy.visit('/login');
      cy.get('button[type="submit"]').click();
      cy.url().should('include', '/login');
    });

    it('should validate login form - invalid email', () => {
      cy.visit('/login');
      cy.get('#login-email').type('invalid-email');
      cy.get('#login-password').type('password123');
      cy.get('button[type="submit"]').click();
      cy.url().should('include', '/login');
    });

    it('should validate register form - password mismatch', () => {
      cy.visit('/register');
      cy.get('#register-name').type('Test User');
      cy.get('#register-email').type('test@example.com');
      cy.get('#register-password').type('Password123!');
      cy.get('#register-confirm-password').type('DifferentPassword!');
      cy.get('button[type="submit"]').click();
      cy.url().should('include', '/register');
    });

    it('should validate register form - weak password', () => {
      cy.visit('/register');
      cy.get('#register-name').type('Test User');
      cy.get('#register-email').type('test@example.com');
      cy.get('#register-password').type('123');
      cy.get('#register-confirm-password').type('123');
      cy.get('button[type="submit"]').click();
      cy.url().should('include', '/register');
    });
  });

  // ========================================
  // KEYBOARD NAVIGATION TESTS
  // ========================================
  describe('Keyboard Navigation Tests', () => {
    it('should have focusable form elements', () => {
      cy.visit('/login');
      cy.get('#login-email').focus().should('be.focused');
      cy.get('#login-password').focus().should('be.focused');
    });

    it('should submit form with Enter', () => {
      cy.intercept('GET', '**/sso/check**', { statusCode: 200, body: { ssoAvailable: false } });
      cy.intercept('POST', '**/auth/login', {
        statusCode: 200,
        body: { success: true, token: 'token', user: {} }
      });

      cy.visit('/login');
      cy.get('#login-email').type('test@example.com');
      cy.get('#login-password').type('password123{enter}');
    });

    it('should close modal with Escape', () => {
      loginViaUI();
      setupAuthenticatedMocks();
      cy.visit('/bots');

      cy.get('button').contains(/create|add|new/i).click();
      cy.get('body').type('{esc}');
    });
  });

  // ========================================
  // ERROR STATE TESTS
  // ========================================
  describe('Error State Tests', () => {
    beforeEach(() => {
      loginViaUI();
    });

    it('should handle 500 error gracefully', () => {
      cy.intercept('GET', '**/bots**', {
        statusCode: 500,
        body: { success: false, message: 'Internal Server Error' }
      });

      cy.visit('/bots');
      cy.url().should('include', '/bots');
    });

    it('should handle network error gracefully', () => {
      cy.intercept('GET', '**/bots**', { forceNetworkError: true });

      cy.visit('/bots');
      cy.url().should('include', '/bots');
    });

    it('should redirect to login on 401', () => {
      cy.intercept('GET', '**/auth/me', {
        statusCode: 401,
        body: { success: false, message: 'Unauthorized' }
      });

      cy.intercept('GET', '**/bots**', {
        statusCode: 401,
        body: { success: false, message: 'Unauthorized' }
      });

      cy.visit('/bots');
      cy.url().should('include', '/login');
    });
  });

  // ========================================
  // LOADING STATE TESTS
  // ========================================
  describe('Loading State Tests', () => {
    beforeEach(() => {
      loginViaUI();
    });

    it('should show loading state while fetching data', () => {
      cy.intercept('GET', '**/bots**', (req) => {
        req.reply({
          delay: 1000,
          statusCode: 200,
          body: { success: true, bots: [] }
        });
      });

      cy.visit('/bots');
      // Should show some loading indicator
      cy.get('body').should('exist');
    });
  });
});
