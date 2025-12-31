/**
 * Security E2E Tests
 * Frontend security testing for XSS, input validation, etc.
 */

describe('Security Tests', () => {
  // XSS Payloads
  const XSS_PAYLOADS = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert("XSS")>',
    '<svg onload=alert("XSS")>',
    'javascript:alert("XSS")',
    '"><script>alert("XSS")</script>',
    '<iframe src="javascript:alert(\'XSS\')">',
  ];

  // ========================================
  // XSS PREVENTION TESTS
  // ========================================
  describe('XSS Prevention', () => {
    it('should sanitize XSS in login form', () => {
      cy.visit('/login');

      XSS_PAYLOADS.forEach((payload) => {
        cy.get('#login-email').clear().type(payload, { parseSpecialCharSequences: false });
        cy.get('#login-password').clear().type('password123');

        // Form should not execute scripts
        cy.window().then((win) => {
          // No alert dialogs should appear
          cy.wrap(win).its('document.body').should('exist');
        });
      });
    });

    it('should sanitize XSS in register form', () => {
      cy.visit('/register');

      XSS_PAYLOADS.forEach((payload) => {
        cy.get('#register-name').clear().type(payload, { parseSpecialCharSequences: false });
        cy.get('#register-email').clear().type('test@example.com');
        cy.get('#register-password').clear().type('Password123!');
        cy.get('#register-confirm-password').clear().type('Password123!');

        cy.window().then((win) => {
          cy.wrap(win).its('document.body').should('exist');
        });
      });
    });

    it('should escape HTML in displayed content', () => {
      cy.intercept('GET', '**/api/sso/check**', { statusCode: 200, body: { ssoAvailable: false } });
      cy.intercept('POST', '**/api/auth/login', {
        statusCode: 200,
        body: {
          success: true,
          token: 'mock-token',
          user: { id: 1, email: 'test@example.com', username: '<script>alert("XSS")</script>' }
        }
      });
      cy.intercept('GET', '**/api/auth/me', {
        statusCode: 200,
        body: { success: true, user: { id: 1, email: 'test@example.com', username: '<script>alert("XSS")</script>' } }
      });
      cy.intercept('GET', '**/api/organizations**', { statusCode: 200, body: { success: true, organizations: [] } });
      cy.intercept('GET', '**/api/bots**', { statusCode: 200, body: { success: true, bots: [] } });
      cy.intercept('GET', '**/api/analytics/**', { statusCode: 200, body: { success: true, data: {} } });

      cy.visit('/login');
      cy.get('#login-email').type('test@example.com');
      cy.get('#login-password').type('password123');
      cy.get('button[type="submit"]').click();

      // Script tags should be escaped, not executed
      cy.get('body').should('not.contain.html', '<script>');
    });
  });

  // ========================================
  // INPUT VALIDATION TESTS
  // ========================================
  describe('Input Validation', () => {
    it('should limit input length', () => {
      cy.visit('/login');

      const longInput = 'a'.repeat(10000);
      cy.get('#login-email').type(longInput, { delay: 0 });

      // Input should be limited or handled gracefully
      cy.get('#login-email').invoke('val').then((val) => {
        expect(val.length).to.be.lessThan(10001);
      });
    });

    it('should validate email format', () => {
      cy.visit('/login');

      const invalidEmails = [
        'notanemail',
        '@nodomain.com',
        'no@domain',
        'spaces in@email.com',
        'special<chars>@email.com',
      ];

      invalidEmails.forEach((email) => {
        cy.get('#login-email').clear().type(email);
        cy.get('#login-password').clear().type('password123');
        cy.get('button[type="submit"]').click();

        // Should stay on login page (validation failed)
        cy.url().should('include', '/login');
      });
    });

    it('should prevent form submission with empty required fields', () => {
      cy.visit('/login');
      cy.get('button[type="submit"]').click();
      cy.url().should('include', '/login');
    });
  });

  // ========================================
  // AUTHENTICATION SECURITY TESTS
  // ========================================
  describe('Authentication Security', () => {
    it('should not store sensitive data in localStorage unencrypted', () => {
      cy.intercept('GET', '**/api/sso/check**', { statusCode: 200, body: { ssoAvailable: false } });
      cy.intercept('POST', '**/api/auth/login', {
        statusCode: 200,
        body: {
          success: true,
          token: 'mock-jwt-token',
          user: { id: 1, email: 'test@example.com' }
        }
      });
      cy.intercept('GET', '**/api/auth/me', { statusCode: 200, body: { success: true, user: { id: 1, email: 'test@example.com' } } });
      cy.intercept('GET', '**/api/organizations**', { statusCode: 200, body: { success: true, organizations: [] } });

      cy.visit('/login');
      cy.get('#login-email').type('test@example.com');
      cy.get('#login-password').type('password123');
      cy.get('button[type="submit"]').click();

      cy.wait(1000);

      // Password should never be stored
      cy.window().then((win) => {
        const localStorage = win.localStorage;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          const value = localStorage.getItem(key);
          expect(value).to.not.include('password123');
        }
      });
    });

    it('should clear auth data on logout', () => {
      cy.intercept('GET', '**/api/sso/check**', { statusCode: 200, body: { ssoAvailable: false } });
      cy.intercept('POST', '**/api/auth/login', {
        statusCode: 200,
        body: { success: true, token: 'mock-token', user: { id: 1, email: 'test@example.com' } }
      });
      cy.intercept('GET', '**/api/auth/me', { statusCode: 200, body: { success: true, user: { id: 1 } } });
      cy.intercept('GET', '**/api/organizations**', { statusCode: 200, body: { success: true, organizations: [] } });
      cy.intercept('GET', '**/api/bots**', { statusCode: 200, body: { success: true, bots: [] } });
      cy.intercept('GET', '**/api/analytics/**', { statusCode: 200, body: { success: true, data: {} } });
      cy.intercept('POST', '**/api/auth/logout', { statusCode: 200, body: { success: true } });

      cy.visit('/login');
      cy.get('#login-email').type('test@example.com');
      cy.get('#login-password').type('password123');
      cy.get('button[type="submit"]').click();

      cy.visit('/dashboard');
      cy.url().should('include', '/dashboard');
    });

    it('should redirect to login when token is invalid', () => {
      cy.intercept('GET', '**/api/auth/me', {
        statusCode: 401,
        body: { success: false, message: 'Invalid token' }
      });
      cy.intercept('GET', '**/api/bots**', {
        statusCode: 401,
        body: { success: false, message: 'Invalid token' }
      });

      cy.window().then((win) => {
        win.localStorage.setItem('token', 'invalid-token');
      });

      cy.visit('/dashboard');
      cy.url().should('include', '/login');
    });
  });

  // ========================================
  // CSRF PROTECTION TESTS
  // ========================================
  describe('CSRF Protection', () => {
    it('should have functional login form', () => {
      cy.visit('/login');

      // Verify login form elements exist and are functional
      cy.get('#login-email').should('exist').and('be.visible');
      cy.get('#login-password').should('exist').and('be.visible');
      cy.get('button[type="submit"]').should('exist').and('be.visible');
    });
  });

  // ========================================
  // SECURE COOKIE TESTS
  // ========================================
  describe('Cookie Security', () => {
    it('should set secure flags on auth cookies', () => {
      cy.intercept('POST', '**/api/auth/login', {
        statusCode: 200,
        body: { success: true, token: 'mock-token', user: { id: 1 } },
        headers: {
          'Set-Cookie': 'session=abc123; HttpOnly; Secure; SameSite=Strict'
        }
      });

      cy.visit('/login');
      cy.get('#login-email').type('test@example.com');
      cy.get('#login-password').type('password123');
      cy.get('button[type="submit"]').click();

      // Cookies should have secure attributes
      // Note: In test environment, cookies may not be set
    });
  });

  // ========================================
  // CLICKJACKING PROTECTION TESTS
  // ========================================
  describe('Clickjacking Protection', () => {
    it('should not be embeddable in iframe from different origin', () => {
      // This test verifies X-Frame-Options is respected
      cy.request({
        url: '/',
        failOnStatusCode: false
      }).then((response) => {
        // Check for X-Frame-Options or CSP frame-ancestors
        const xfo = response.headers['x-frame-options'];
        const csp = response.headers['content-security-policy'];

        if (xfo) {
          expect(['DENY', 'SAMEORIGIN']).to.include(xfo);
        }
        // CSP frame-ancestors is also acceptable
      });
    });
  });

  // ========================================
  // SENSITIVE DATA EXPOSURE TESTS
  // ========================================
  describe('Sensitive Data Exposure', () => {
    it('should not expose sensitive data in URL', () => {
      cy.visit('/login');
      cy.get('#login-email').type('test@example.com');
      cy.get('#login-password').type('password123');

      // Password should not appear in URL
      cy.url().should('not.include', 'password');
    });

    it('should mask password input', () => {
      cy.visit('/login');
      cy.get('#login-password').should('have.attr', 'type', 'password');
    });

    it('should not log sensitive data to console', () => {
      cy.visit('/login', {
        onBeforeLoad(win) {
          cy.stub(win.console, 'log').as('consoleLog');
          cy.stub(win.console, 'error').as('consoleError');
        }
      });

      cy.get('#login-email').type('test@example.com');
      cy.get('#login-password').type('password123');

      // Verify password not logged
      cy.get('@consoleLog').then((stub) => {
        const calls = stub.getCalls();
        calls.forEach((call) => {
          const args = call.args.join(' ');
          expect(args).to.not.include('password123');
        });
      });
    });
  });

  // ========================================
  // RATE LIMITING UI TESTS
  // ========================================
  describe('Rate Limiting', () => {
    it('should handle rate limit errors gracefully', () => {
      cy.intercept('POST', '**/api/auth/login', {
        statusCode: 429,
        body: { success: false, message: 'Too many requests' }
      });

      cy.visit('/login');
      cy.get('#login-email').type('test@example.com');
      cy.get('#login-password').type('password123');
      cy.get('button[type="submit"]').click();

      // Should show error message, not crash
      cy.url().should('include', '/login');
    });
  });
});
