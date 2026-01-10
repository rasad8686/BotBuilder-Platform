/**
 * Tour Builder E2E Tests
 * Tests for tour creation and management flow
 */

describe('Tour Builder', () => {
  beforeEach(() => {
    // Login and navigate to tours
    cy.login('test@example.com', 'password123');
    cy.visit('/tours');
    cy.intercept('GET', '/api/tours*').as('getTours');
    cy.wait('@getTours');
  });

  // ==================== TOUR CREATION ====================
  describe('Tour Creation Flow', () => {
    it('should create a new tour', () => {
      // Click create button
      cy.get('[data-testid="create-tour-btn"]').click();

      // Fill tour details
      cy.get('[data-testid="tour-name-input"]').type('Welcome Tour');
      cy.get('[data-testid="tour-description-input"]').type('Onboarding tour for new users');

      // Select trigger type
      cy.get('[data-testid="trigger-type-select"]').click();
      cy.get('[data-testid="trigger-option-auto"]').click();

      // Submit
      cy.intercept('POST', '/api/tours').as('createTour');
      cy.get('[data-testid="save-tour-btn"]').click();
      cy.wait('@createTour');

      // Verify redirect to editor
      cy.url().should('include', '/tours/');
      cy.get('[data-testid="tour-editor"]').should('be.visible');
    });

    it('should show validation error for empty name', () => {
      cy.get('[data-testid="create-tour-btn"]').click();
      cy.get('[data-testid="save-tour-btn"]').click();

      cy.get('[data-testid="name-error"]').should('contain', 'Tour name is required');
    });
  });

  // ==================== STEP MANAGEMENT ====================
  describe('Step Management', () => {
    beforeEach(() => {
      // Navigate to existing tour
      cy.intercept('GET', '/api/tours/*').as('getTour');
      cy.get('[data-testid="tour-card"]').first().click();
      cy.wait('@getTour');
    });

    it('should add a new tooltip step', () => {
      cy.get('[data-testid="add-step-btn"]').click();

      // Select step type
      cy.get('[data-testid="step-type-tooltip"]').click();

      // Fill step details
      cy.get('[data-testid="step-title-input"]').type('Welcome!');
      cy.get('[data-testid="step-content-input"]').type('This is your dashboard');
      cy.get('[data-testid="target-selector-input"]').type('#dashboard-header');

      // Select position
      cy.get('[data-testid="position-select"]').click();
      cy.get('[data-testid="position-bottom"]').click();

      // Save step
      cy.intercept('POST', '/api/tours/*/steps').as('createStep');
      cy.get('[data-testid="save-step-btn"]').click();
      cy.wait('@createStep');

      // Verify step appears in list
      cy.get('[data-testid="step-list"]').should('contain', 'Welcome!');
    });

    it('should add a modal step', () => {
      cy.get('[data-testid="add-step-btn"]').click();
      cy.get('[data-testid="step-type-modal"]').click();

      cy.get('[data-testid="step-title-input"]').type('Feature Overview');
      cy.get('[data-testid="step-content-input"]').type('Check out these amazing features');

      cy.intercept('POST', '/api/tours/*/steps').as('createStep');
      cy.get('[data-testid="save-step-btn"]').click();
      cy.wait('@createStep');

      cy.get('[data-testid="step-list"]').should('contain', 'Feature Overview');
    });

    it('should edit an existing step', () => {
      cy.get('[data-testid="step-item"]').first().click();
      cy.get('[data-testid="step-title-input"]').clear().type('Updated Title');

      cy.intercept('PUT', '/api/tours/*/steps/*').as('updateStep');
      cy.get('[data-testid="save-step-btn"]').click();
      cy.wait('@updateStep');

      cy.get('[data-testid="step-list"]').should('contain', 'Updated Title');
    });

    it('should delete a step with confirmation', () => {
      const stepsCount = Cypress.$('[data-testid="step-item"]').length;

      cy.get('[data-testid="step-item"]').first().find('[data-testid="delete-step-btn"]').click();

      // Confirm deletion
      cy.get('[data-testid="confirm-delete-modal"]').should('be.visible');
      cy.intercept('DELETE', '/api/tours/*/steps/*').as('deleteStep');
      cy.get('[data-testid="confirm-delete-btn"]').click();
      cy.wait('@deleteStep');

      cy.get('[data-testid="step-item"]').should('have.length', stepsCount - 1);
    });
  });

  // ==================== DRAG-DROP REORDER ====================
  describe('Drag-Drop Reorder', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/tours/*').as('getTour');
      cy.get('[data-testid="tour-card"]').first().click();
      cy.wait('@getTour');
    });

    it('should reorder steps via drag and drop', () => {
      // Get initial order
      cy.get('[data-testid="step-item"]').first().invoke('text').as('firstStepText');

      // Drag first step to third position
      cy.get('[data-testid="step-item"]').first()
        .trigger('dragstart', { dataTransfer: new DataTransfer() });

      cy.get('[data-testid="step-item"]').eq(2)
        .trigger('drop', { dataTransfer: new DataTransfer() });

      cy.intercept('POST', '/api/tours/*/steps/reorder').as('reorderSteps');

      // Verify reorder API was called
      cy.wait('@reorderSteps');

      // Verify first step is now different
      cy.get('@firstStepText').then((originalText) => {
        cy.get('[data-testid="step-item"]').first().should('not.contain', originalText);
      });
    });

    it('should show visual feedback during drag', () => {
      cy.get('[data-testid="step-item"]').first()
        .trigger('dragstart', { dataTransfer: new DataTransfer() });

      cy.get('[data-testid="step-item"]').first()
        .should('have.class', 'dragging');

      cy.get('[data-testid="step-item"]').eq(1)
        .trigger('dragover', { dataTransfer: new DataTransfer() });

      cy.get('[data-testid="step-item"]').eq(1)
        .should('have.class', 'drag-over');
    });
  });

  // ==================== SETTINGS ====================
  describe('Tour Settings', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/tours/*').as('getTour');
      cy.get('[data-testid="tour-card"]').first().click();
      cy.wait('@getTour');
      cy.get('[data-testid="settings-tab"]').click();
    });

    it('should update tour settings', () => {
      // Toggle dismissible
      cy.get('[data-testid="setting-dismissible"]').click();

      // Toggle progress bar
      cy.get('[data-testid="setting-progress-bar"]').click();

      // Change overlay opacity
      cy.get('[data-testid="overlay-opacity-slider"]').invoke('val', 0.7).trigger('change');

      // Save settings
      cy.intercept('PUT', '/api/tours/*').as('updateTour');
      cy.get('[data-testid="save-settings-btn"]').click();
      cy.wait('@updateTour');

      cy.get('[data-testid="toast-success"]').should('contain', 'Settings saved');
    });

    it('should update theme settings', () => {
      cy.get('[data-testid="theme-section"]').click();

      // Change primary color
      cy.get('[data-testid="primary-color-input"]').clear().type('#FF5733');

      // Change border radius
      cy.get('[data-testid="border-radius-input"]').clear().type('12');

      cy.intercept('PUT', '/api/tours/*').as('updateTour');
      cy.get('[data-testid="save-settings-btn"]').click();
      cy.wait('@updateTour');

      cy.get('[data-testid="toast-success"]').should('be.visible');
    });
  });

  // ==================== PUBLISH/PAUSE ====================
  describe('Publish and Pause', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/tours/*').as('getTour');
      cy.get('[data-testid="tour-card"]').first().click();
      cy.wait('@getTour');
    });

    it('should publish a draft tour', () => {
      cy.get('[data-testid="tour-status"]').should('contain', 'Draft');

      cy.intercept('POST', '/api/tours/*/publish').as('publishTour');
      cy.get('[data-testid="publish-btn"]').click();
      cy.wait('@publishTour');

      cy.get('[data-testid="tour-status"]').should('contain', 'Active');
      cy.get('[data-testid="toast-success"]').should('contain', 'Tour published');
    });

    it('should pause an active tour', () => {
      // First publish
      cy.intercept('POST', '/api/tours/*/publish').as('publishTour');
      cy.get('[data-testid="publish-btn"]').click();
      cy.wait('@publishTour');

      // Then pause
      cy.intercept('POST', '/api/tours/*/pause').as('pauseTour');
      cy.get('[data-testid="pause-btn"]').click();
      cy.wait('@pauseTour');

      cy.get('[data-testid="tour-status"]').should('contain', 'Paused');
    });

    it('should archive a tour', () => {
      cy.get('[data-testid="more-actions-btn"]').click();
      cy.get('[data-testid="archive-option"]').click();

      cy.get('[data-testid="confirm-archive-modal"]').should('be.visible');
      cy.intercept('POST', '/api/tours/*/archive').as('archiveTour');
      cy.get('[data-testid="confirm-archive-btn"]').click();
      cy.wait('@archiveTour');

      cy.get('[data-testid="tour-status"]').should('contain', 'Archived');
    });
  });

  // ==================== DELETE CONFIRMATION ====================
  describe('Delete Confirmation', () => {
    it('should delete tour with confirmation', () => {
      const initialCount = Cypress.$('[data-testid="tour-card"]').length;

      cy.get('[data-testid="tour-card"]').first().find('[data-testid="delete-tour-btn"]').click();

      cy.get('[data-testid="delete-confirmation-modal"]').should('be.visible');
      cy.get('[data-testid="delete-confirmation-modal"]')
        .should('contain', 'Are you sure you want to delete this tour?');

      cy.intercept('DELETE', '/api/tours/*').as('deleteTour');
      cy.get('[data-testid="confirm-delete-btn"]').click();
      cy.wait('@deleteTour');

      cy.get('[data-testid="tour-card"]').should('have.length', initialCount - 1);
      cy.get('[data-testid="toast-success"]').should('contain', 'Tour deleted');
    });

    it('should cancel deletion', () => {
      const initialCount = Cypress.$('[data-testid="tour-card"]').length;

      cy.get('[data-testid="tour-card"]').first().find('[data-testid="delete-tour-btn"]').click();
      cy.get('[data-testid="cancel-delete-btn"]').click();

      cy.get('[data-testid="delete-confirmation-modal"]').should('not.exist');
      cy.get('[data-testid="tour-card"]').should('have.length', initialCount);
    });
  });

  // ==================== DUPLICATE TOUR ====================
  describe('Duplicate Tour', () => {
    it('should duplicate a tour', () => {
      cy.get('[data-testid="tour-card"]').first().find('[data-testid="duplicate-tour-btn"]').click();

      cy.intercept('POST', '/api/tours/*/duplicate').as('duplicateTour');
      cy.wait('@duplicateTour');

      cy.get('[data-testid="toast-success"]').should('contain', 'Tour duplicated');

      // Verify new tour with "(Copy)" suffix
      cy.get('[data-testid="tour-card"]').should('contain', '(Copy)');
    });
  });

  // ==================== TARGETING ====================
  describe('Targeting Rules', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/tours/*').as('getTour');
      cy.get('[data-testid="tour-card"]').first().click();
      cy.wait('@getTour');
      cy.get('[data-testid="targeting-tab"]').click();
    });

    it('should add URL targeting rule', () => {
      cy.get('[data-testid="add-rule-btn"]').click();

      cy.get('[data-testid="rule-type-select"]').click();
      cy.get('[data-testid="rule-type-url"]').click();

      cy.get('[data-testid="rule-operator-select"]').click();
      cy.get('[data-testid="operator-contains"]').click();

      cy.get('[data-testid="rule-value-input"]').type('/dashboard');

      cy.intercept('PUT', '/api/tours/*/targeting').as('updateTargeting');
      cy.get('[data-testid="save-targeting-btn"]').click();
      cy.wait('@updateTargeting');

      cy.get('[data-testid="targeting-rule"]').should('contain', '/dashboard');
    });

    it('should add user property targeting rule', () => {
      cy.get('[data-testid="add-rule-btn"]').click();

      cy.get('[data-testid="rule-type-select"]').click();
      cy.get('[data-testid="rule-type-user-property"]').click();

      cy.get('[data-testid="rule-property-input"]').type('plan');
      cy.get('[data-testid="rule-operator-select"]').click();
      cy.get('[data-testid="operator-equals"]').click();
      cy.get('[data-testid="rule-value-input"]').type('pro');

      cy.intercept('PUT', '/api/tours/*/targeting').as('updateTargeting');
      cy.get('[data-testid="save-targeting-btn"]').click();
      cy.wait('@updateTargeting');

      cy.get('[data-testid="targeting-rule"]').should('contain', 'plan');
    });

    it('should delete targeting rule', () => {
      cy.get('[data-testid="targeting-rule"]').first()
        .find('[data-testid="delete-rule-btn"]').click();

      cy.intercept('PUT', '/api/tours/*/targeting').as('updateTargeting');
      cy.get('[data-testid="save-targeting-btn"]').click();
      cy.wait('@updateTargeting');

      cy.get('[data-testid="toast-success"]').should('be.visible');
    });
  });
});

// Custom command for login
Cypress.Commands.add('login', (email, password) => {
  cy.session([email, password], () => {
    cy.visit('/login');
    cy.get('[data-testid="email-input"]').type(email);
    cy.get('[data-testid="password-input"]').type(password);
    cy.get('[data-testid="login-btn"]').click();
    cy.url().should('include', '/dashboard');
  });
});
