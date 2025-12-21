/**
 * Cypress E2E Support File
 * Global commands and configurations
 */

// Import commands
import './commands';

// Prevent Cypress from failing tests when the app throws errors
Cypress.on('uncaught:exception', (err, runnable) => {
  // Returning false here prevents Cypress from failing the test
  // You may want to handle specific errors differently
  console.log('Uncaught exception:', err.message);
  return false;
});

// Log test information
beforeEach(() => {
  cy.log(`Running: ${Cypress.currentTest.title}`);
});

// Clear local storage before each test
beforeEach(() => {
  cy.clearLocalStorage();
});

// Take screenshot on failure (configured in cypress.config.js)
afterEach(function () {
  if (this.currentTest.state === 'failed') {
    cy.log('Test failed, screenshot will be captured');
  }
});
