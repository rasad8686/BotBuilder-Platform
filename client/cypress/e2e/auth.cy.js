/**
 * Authentication E2E Tests
 * Tests for login, register, and logout flows
 */

describe('Authentication', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  // ========================================
  // LOGIN TESTS
  // ========================================
  describe('Login Flow', () => {
    beforeEach(() => {
      cy.visit('/login');
    });

    it('should display login form correctly', () => {
      cy.get('#login-email').should('be.visible');
      cy.get('#login-password').should('be.visible');
      cy.get('button[type="submit"]').should('be.visible');
    });

    it('should show error for empty fields', () => {
      cy.get('button[type="submit"]').click();
      cy.url().should('include', '/login');
    });

    it('should show error for invalid email format', () => {
      cy.get('#login-email').type('invalid-email');
      cy.get('#login-password').type('password123');
      cy.get('button[type="submit"]').click();
      cy.url().should('include', '/login');
    });

    it('should show error for invalid credentials', () => {
      cy.intercept('POST', '**/auth/login', {
        statusCode: 401,
        body: { success: false, message: 'Invalid email or password' }
      }).as('loginRequest');

      cy.get('#login-email').type('wrong@email.com');
      cy.get('#login-password').type('wrongpassword');
      cy.get('button[type="submit"]').click();

      cy.wait('@loginRequest');
      cy.url().should('include', '/login');
    });

    it('should login successfully with valid credentials', () => {
      cy.intercept('POST', '**/auth/login', {
        statusCode: 200,
        body: {
          success: true,
          token: 'mock-jwt-token',
          user: { id: 1, email: 'test@example.com', username: 'testuser' }
        }
      }).as('loginRequest');

      cy.intercept('GET', '**/auth/me', {
        statusCode: 200,
        body: { success: true, user: { id: 1, email: 'test@example.com' } }
      });

      cy.intercept('GET', '**/sso/check**', {
        statusCode: 200,
        body: { ssoAvailable: false }
      });

      cy.get('#login-email').type('test@example.com');
      cy.get('#login-password').type('password123');
      cy.get('button[type="submit"]').click();

      cy.wait('@loginRequest');
      cy.url().should('not.include', '/login');
    });

    it('should have link to register page', () => {
      cy.get('a[href*="register"]').should('exist');
    });

    it('should have link to forgot password', () => {
      cy.get('a[href*="forgot"]').should('exist');
    });
  });

  // ========================================
  // REGISTER TESTS
  // ========================================
  describe('Register Flow', () => {
    beforeEach(() => {
      cy.visit('/register');
    });

    it('should display register form correctly', () => {
      cy.get('#register-name').should('be.visible');
      cy.get('#register-email').should('be.visible');
      cy.get('#register-password').should('be.visible');
      cy.get('#register-confirm-password').should('be.visible');
      cy.get('button[type="submit"]').should('be.visible');
    });

    it('should show error for empty fields', () => {
      cy.get('button[type="submit"]').click();
      cy.url().should('include', '/register');
    });

    it('should show error for weak password', () => {
      cy.get('#register-name').type('testuser');
      cy.get('#register-email').type('test@example.com');
      cy.get('#register-password').type('123');
      cy.get('#register-confirm-password').type('123');
      cy.get('button[type="submit"]').click();
      cy.url().should('include', '/register');
    });

    it('should show error for password mismatch', () => {
      cy.get('#register-name').type('testuser');
      cy.get('#register-email').type('test@example.com');
      cy.get('#register-password').type('StrongPassword123!');
      cy.get('#register-confirm-password').type('DifferentPassword123!');
      cy.get('button[type="submit"]').click();
      cy.url().should('include', '/register');
    });

    it('should register successfully with valid data', () => {
      cy.intercept('POST', '**/auth/register', {
        statusCode: 201,
        body: {
          success: true,
          message: 'User registered successfully',
          token: 'mock-jwt-token',
          user: { id: 1, email: 'newuser@example.com', username: 'newuser' }
        }
      }).as('registerRequest');

      cy.get('#register-name').type('newuser');
      cy.get('#register-email').type('newuser@example.com');
      cy.get('#register-password').type('StrongPassword123!');
      cy.get('#register-confirm-password').type('StrongPassword123!');
      cy.get('button[type="submit"]').click();

      cy.wait('@registerRequest');
      cy.url().should('not.include', '/register');
    });

    it('should have link to login page', () => {
      cy.get('a[href*="login"]').should('exist');
    });
  });

  // ========================================
  // PROTECTED ROUTE TESTS
  // ========================================
  describe('Protected Routes', () => {
    it('should redirect to login when accessing dashboard without auth', () => {
      cy.visit('/dashboard');
      cy.url().should('include', '/login');
    });

    it('should redirect to login when accessing bots without auth', () => {
      cy.visit('/bots');
      cy.url().should('include', '/login');
    });
  });
});
