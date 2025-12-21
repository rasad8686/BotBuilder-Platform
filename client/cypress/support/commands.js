/**
 * Cypress Custom Commands
 * Reusable commands for E2E tests
 */

// Login command - uses correct form selectors
Cypress.Commands.add('login', (email, password) => {
  const userEmail = email || Cypress.env('TEST_USER_EMAIL') || 'test@example.com';
  const userPassword = password || Cypress.env('TEST_USER_PASSWORD') || 'password123';

  // Mock SSO check
  cy.intercept('GET', '**/sso/check**', {
    statusCode: 200,
    body: { ssoAvailable: false }
  });

  cy.visit('/login');
  cy.get('#login-email').clear().type(userEmail);
  cy.get('#login-password').clear().type(userPassword);
  cy.get('button[type="submit"]').click();

  // Wait for redirect to dashboard
  cy.url().should('not.include', '/login');
});

// API Login command (faster, without UI)
Cypress.Commands.add('apiLogin', (email, password) => {
  const userEmail = email || Cypress.env('TEST_USER_EMAIL') || 'test@example.com';
  const userPassword = password || Cypress.env('TEST_USER_PASSWORD') || 'password123';

  cy.request({
    method: 'POST',
    url: `${Cypress.env('API_URL')}/auth/login`,
    body: {
      email: userEmail,
      password: userPassword
    },
    failOnStatusCode: false
  }).then((response) => {
    if (response.status === 200) {
      window.localStorage.setItem('token', response.body.token);
      window.localStorage.setItem('user', JSON.stringify(response.body.user));
    }
  });
});

// Logout command
Cypress.Commands.add('logout', () => {
  cy.clearLocalStorage();
  cy.visit('/login');
});

// Register command - uses correct form selectors
Cypress.Commands.add('register', (name, email, password) => {
  cy.visit('/register');
  cy.get('#register-name').clear().type(name);
  cy.get('#register-email').clear().type(email);
  cy.get('#register-password').clear().type(password);
  cy.get('#register-confirm-password').clear().type(password);
  cy.get('button[type="submit"]').click();
});

// Create bot command
Cypress.Commands.add('createBot', (name, platform = 'telegram') => {
  cy.visit('/bots');
  cy.get('button').contains(/create|add|new/i).click();
  cy.get('input[name="name"]').clear().type(name);

  cy.get('body').then(($body) => {
    if ($body.find('select[name="platform"]').length) {
      cy.get('select[name="platform"]').select(platform);
    }
  });

  cy.get('button[type="submit"]').click();
});

// Wait for API response
Cypress.Commands.add('waitForApi', (alias, timeout = 10000) => {
  cy.wait(alias, { timeout });
});

// Check toast notification
Cypress.Commands.add('checkToast', (message) => {
  cy.get('.toast, [role="alert"], .notification')
    .should('be.visible')
    .and('contain', message);
});

// Get by data-testid
Cypress.Commands.add('getByTestId', (testId) => {
  return cy.get(`[data-testid="${testId}"]`);
});

// Fill form fields
Cypress.Commands.add('fillForm', (formData) => {
  Object.entries(formData).forEach(([name, value]) => {
    cy.get(`input[name="${name}"], textarea[name="${name}"], select[name="${name}"], #${name}`)
      .first()
      .then(($el) => {
        if ($el.is('select')) {
          cy.wrap($el).select(value);
        } else if ($el.is('input[type="checkbox"]')) {
          if (value) cy.wrap($el).check();
          else cy.wrap($el).uncheck();
        } else {
          cy.wrap($el).clear().type(value);
        }
      });
  });
});

// Intercept API calls
Cypress.Commands.add('interceptApi', (method, endpoint, alias, response) => {
  const apiUrl = Cypress.env('API_URL') || 'http://localhost:5000/api';
  if (response) {
    cy.intercept(method, `${apiUrl}${endpoint}`, response).as(alias);
  } else {
    cy.intercept(method, `${apiUrl}${endpoint}`).as(alias);
  }
});

// Set authentication token
Cypress.Commands.add('setAuthToken', (token) => {
  window.localStorage.setItem('token', token);
});

// Clear authentication
Cypress.Commands.add('clearAuth', () => {
  window.localStorage.removeItem('token');
  window.localStorage.removeItem('user');
});
