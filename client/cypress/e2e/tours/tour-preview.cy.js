/**
 * Tour Preview E2E Tests
 * Tests for tour preview and step rendering
 */

describe('Tour Preview', () => {
  beforeEach(() => {
    cy.login('test@example.com', 'password123');
  });

  // ==================== PREVIEW MODE ====================
  describe('Preview Mode', () => {
    beforeEach(() => {
      cy.visit('/tours');
      cy.intercept('GET', '/api/tours/*').as('getTour');
      cy.get('[data-testid="tour-card"]').first().click();
      cy.wait('@getTour');
    });

    it('should open tour preview', () => {
      cy.get('[data-testid="preview-btn"]').click();

      cy.get('[data-testid="tour-preview-container"]').should('be.visible');
      cy.get('[data-testid="preview-overlay"]').should('exist');
    });

    it('should close preview on escape key', () => {
      cy.get('[data-testid="preview-btn"]').click();
      cy.get('[data-testid="tour-preview-container"]').should('be.visible');

      cy.get('body').type('{esc}');

      cy.get('[data-testid="tour-preview-container"]').should('not.exist');
    });

    it('should close preview on close button click', () => {
      cy.get('[data-testid="preview-btn"]').click();
      cy.get('[data-testid="preview-close-btn"]').click();

      cy.get('[data-testid="tour-preview-container"]').should('not.exist');
    });
  });

  // ==================== STEP TRANSITIONS ====================
  describe('Step Transitions', () => {
    beforeEach(() => {
      cy.visit('/tours');
      cy.intercept('GET', '/api/tours/*').as('getTour');
      cy.get('[data-testid="tour-card"]').first().click();
      cy.wait('@getTour');
      cy.get('[data-testid="preview-btn"]').click();
    });

    it('should navigate to next step', () => {
      cy.get('[data-testid="step-indicator"]').should('contain', 'Step 1');

      cy.get('[data-testid="next-step-btn"]').click();

      cy.get('[data-testid="step-indicator"]').should('contain', 'Step 2');
    });

    it('should navigate to previous step', () => {
      cy.get('[data-testid="next-step-btn"]').click();
      cy.get('[data-testid="step-indicator"]').should('contain', 'Step 2');

      cy.get('[data-testid="prev-step-btn"]').click();

      cy.get('[data-testid="step-indicator"]').should('contain', 'Step 1');
    });

    it('should disable prev button on first step', () => {
      cy.get('[data-testid="prev-step-btn"]').should('be.disabled');
    });

    it('should show "Finish" on last step', () => {
      // Navigate to last step
      cy.get('[data-testid="tour-preview-container"]').then(($container) => {
        const totalSteps = parseInt($container.attr('data-total-steps'));
        for (let i = 1; i < totalSteps; i++) {
          cy.get('[data-testid="next-step-btn"]').click();
        }
      });

      cy.get('[data-testid="next-step-btn"]').should('contain', 'Finish');
    });

    it('should complete tour on finish click', () => {
      // Navigate to last step and click finish
      cy.get('[data-testid="tour-preview-container"]').then(($container) => {
        const totalSteps = parseInt($container.attr('data-total-steps')) || 3;
        for (let i = 1; i < totalSteps; i++) {
          cy.get('[data-testid="next-step-btn"]').click();
        }
      });

      cy.get('[data-testid="next-step-btn"]').click();

      cy.get('[data-testid="tour-preview-container"]').should('not.exist');
      cy.get('[data-testid="toast-info"]').should('contain', 'Tour completed');
    });
  });

  // ==================== TOOLTIP POSITIONING ====================
  describe('Tooltip Positioning', () => {
    beforeEach(() => {
      // Visit a page with known elements for testing positioning
      cy.visit('/preview-test-page');
      cy.intercept('GET', '/api/tours/*').as('getTour');
    });

    it('should position tooltip at bottom of target element', () => {
      // Start tour with bottom-positioned tooltip
      cy.window().then((win) => {
        win.BotBuilderTours.startTour('tour-bottom-tooltip');
      });

      cy.get('[data-testid="tour-tooltip"]').then(($tooltip) => {
        cy.get('#target-element').then(($target) => {
          const tooltipRect = $tooltip[0].getBoundingClientRect();
          const targetRect = $target[0].getBoundingClientRect();

          // Tooltip should be below target
          expect(tooltipRect.top).to.be.greaterThan(targetRect.bottom);
        });
      });
    });

    it('should position tooltip at top of target element', () => {
      cy.window().then((win) => {
        win.BotBuilderTours.startTour('tour-top-tooltip');
      });

      cy.get('[data-testid="tour-tooltip"]').then(($tooltip) => {
        cy.get('#target-element-top').then(($target) => {
          const tooltipRect = $tooltip[0].getBoundingClientRect();
          const targetRect = $target[0].getBoundingClientRect();

          // Tooltip should be above target
          expect(tooltipRect.bottom).to.be.lessThan(targetRect.top);
        });
      });
    });

    it('should position tooltip at left of target element', () => {
      cy.window().then((win) => {
        win.BotBuilderTours.startTour('tour-left-tooltip');
      });

      cy.get('[data-testid="tour-tooltip"]').then(($tooltip) => {
        cy.get('#target-element-left').then(($target) => {
          const tooltipRect = $tooltip[0].getBoundingClientRect();
          const targetRect = $target[0].getBoundingClientRect();

          // Tooltip should be to the left of target
          expect(tooltipRect.right).to.be.lessThan(targetRect.left);
        });
      });
    });

    it('should position tooltip at right of target element', () => {
      cy.window().then((win) => {
        win.BotBuilderTours.startTour('tour-right-tooltip');
      });

      cy.get('[data-testid="tour-tooltip"]').then(($tooltip) => {
        cy.get('#target-element-right').then(($target) => {
          const tooltipRect = $tooltip[0].getBoundingClientRect();
          const targetRect = $target[0].getBoundingClientRect();

          // Tooltip should be to the right of target
          expect(tooltipRect.left).to.be.greaterThan(targetRect.right);
        });
      });
    });

    it('should auto-adjust position when element is near edge', () => {
      // Element near right edge
      cy.window().then((win) => {
        win.BotBuilderTours.startTour('tour-edge-tooltip');
      });

      cy.get('[data-testid="tour-tooltip"]').should('be.visible');

      // Tooltip should be fully visible (not cut off)
      cy.get('[data-testid="tour-tooltip"]').then(($tooltip) => {
        const tooltipRect = $tooltip[0].getBoundingClientRect();
        const viewportWidth = Cypress.config('viewportWidth');

        expect(tooltipRect.right).to.be.lessThan(viewportWidth);
        expect(tooltipRect.left).to.be.greaterThan(0);
      });
    });
  });

  // ==================== MODAL RENDERING ====================
  describe('Modal Rendering', () => {
    beforeEach(() => {
      cy.visit('/preview-test-page');
    });

    it('should render modal in center of screen', () => {
      cy.window().then((win) => {
        win.BotBuilderTours.startTour('tour-modal');
      });

      cy.get('[data-testid="tour-modal"]').should('be.visible');

      cy.get('[data-testid="tour-modal"]').then(($modal) => {
        const modalRect = $modal[0].getBoundingClientRect();
        const viewportWidth = Cypress.config('viewportWidth');
        const viewportHeight = Cypress.config('viewportHeight');

        // Check modal is roughly centered
        const modalCenterX = modalRect.left + modalRect.width / 2;
        const modalCenterY = modalRect.top + modalRect.height / 2;

        expect(modalCenterX).to.be.closeTo(viewportWidth / 2, 50);
        expect(modalCenterY).to.be.closeTo(viewportHeight / 2, 50);
      });
    });

    it('should show overlay behind modal', () => {
      cy.window().then((win) => {
        win.BotBuilderTours.startTour('tour-modal');
      });

      cy.get('[data-testid="tour-overlay"]').should('be.visible');
      cy.get('[data-testid="tour-overlay"]').should('have.css', 'opacity').and('not.equal', '0');
    });

    it('should close modal on overlay click if dismissible', () => {
      cy.window().then((win) => {
        win.BotBuilderTours.startTour('tour-modal-dismissible');
      });

      cy.get('[data-testid="tour-overlay"]').click({ force: true });

      cy.get('[data-testid="tour-modal"]').should('not.exist');
    });

    it('should not close modal on overlay click if not dismissible', () => {
      cy.window().then((win) => {
        win.BotBuilderTours.startTour('tour-modal-not-dismissible');
      });

      cy.get('[data-testid="tour-overlay"]').click({ force: true });

      cy.get('[data-testid="tour-modal"]').should('be.visible');
    });
  });

  // ==================== HOTSPOT RENDERING ====================
  describe('Hotspot Rendering', () => {
    beforeEach(() => {
      cy.visit('/preview-test-page');
    });

    it('should render hotspot at target position', () => {
      cy.window().then((win) => {
        win.BotBuilderTours.startTour('tour-hotspot');
      });

      cy.get('[data-testid="tour-hotspot"]').should('be.visible');

      cy.get('[data-testid="tour-hotspot"]').then(($hotspot) => {
        cy.get('#hotspot-target').then(($target) => {
          const hotspotRect = $hotspot[0].getBoundingClientRect();
          const targetRect = $target[0].getBoundingClientRect();

          // Hotspot should be near target
          const targetCenterX = targetRect.left + targetRect.width / 2;
          const targetCenterY = targetRect.top + targetRect.height / 2;

          expect(hotspotRect.left + hotspotRect.width / 2).to.be.closeTo(targetCenterX, 20);
          expect(hotspotRect.top + hotspotRect.height / 2).to.be.closeTo(targetCenterY, 20);
        });
      });
    });

    it('should show pulse animation on hotspot', () => {
      cy.window().then((win) => {
        win.BotBuilderTours.startTour('tour-hotspot');
      });

      cy.get('[data-testid="tour-hotspot"]')
        .should('have.class', 'pulse-animation');
    });

    it('should expand tooltip on hotspot click', () => {
      cy.window().then((win) => {
        win.BotBuilderTours.startTour('tour-hotspot');
      });

      cy.get('[data-testid="tour-hotspot"]').click();

      cy.get('[data-testid="tour-tooltip"]').should('be.visible');
    });
  });

  // ==================== PROGRESS INDICATOR ====================
  describe('Progress Indicator', () => {
    beforeEach(() => {
      cy.visit('/tours');
      cy.intercept('GET', '/api/tours/*').as('getTour');
      cy.get('[data-testid="tour-card"]').first().click();
      cy.wait('@getTour');
      cy.get('[data-testid="preview-btn"]').click();
    });

    it('should show progress bar', () => {
      cy.get('[data-testid="progress-bar"]').should('be.visible');
    });

    it('should update progress as steps advance', () => {
      // Get initial progress
      cy.get('[data-testid="progress-bar-fill"]')
        .invoke('attr', 'style')
        .then((initialStyle) => {
          const initialWidth = parseFloat(initialStyle.match(/width:\s*([\d.]+)%/)[1]);

          // Move to next step
          cy.get('[data-testid="next-step-btn"]').click();

          // Check progress increased
          cy.get('[data-testid="progress-bar-fill"]')
            .invoke('attr', 'style')
            .should((newStyle) => {
              const newWidth = parseFloat(newStyle.match(/width:\s*([\d.]+)%/)[1]);
              expect(newWidth).to.be.greaterThan(initialWidth);
            });
        });
    });

    it('should show step numbers when enabled', () => {
      cy.get('[data-testid="step-numbers"]').should('contain', '1 of');
    });
  });

  // ==================== ELEMENT HIGHLIGHT ====================
  describe('Element Highlighting', () => {
    beforeEach(() => {
      cy.visit('/preview-test-page');
    });

    it('should highlight target element', () => {
      cy.window().then((win) => {
        win.BotBuilderTours.startTour('tour-highlight');
      });

      cy.get('#target-element').should('have.class', 'bb-highlighted');
    });

    it('should remove highlight when moving to next step', () => {
      cy.window().then((win) => {
        win.BotBuilderTours.startTour('tour-highlight');
      });

      cy.get('#target-element').should('have.class', 'bb-highlighted');

      cy.get('[data-testid="next-step-btn"]').click();

      cy.get('#target-element').should('not.have.class', 'bb-highlighted');
    });
  });

  // ==================== SCROLL TO ELEMENT ====================
  describe('Scroll to Element', () => {
    beforeEach(() => {
      cy.visit('/preview-test-page-scrollable');
    });

    it('should scroll to target element', () => {
      cy.window().then((win) => {
        win.BotBuilderTours.startTour('tour-scroll');
      });

      // Element should be in viewport
      cy.get('#scroll-target').should('be.visible');

      cy.get('#scroll-target').then(($el) => {
        const rect = $el[0].getBoundingClientRect();
        const viewportHeight = Cypress.config('viewportHeight');

        expect(rect.top).to.be.greaterThan(0);
        expect(rect.bottom).to.be.lessThan(viewportHeight);
      });
    });
  });

  // ==================== KEYBOARD NAVIGATION ====================
  describe('Keyboard Navigation', () => {
    beforeEach(() => {
      cy.visit('/tours');
      cy.intercept('GET', '/api/tours/*').as('getTour');
      cy.get('[data-testid="tour-card"]').first().click();
      cy.wait('@getTour');
      cy.get('[data-testid="preview-btn"]').click();
    });

    it('should advance with Enter key', () => {
      cy.get('[data-testid="step-indicator"]').should('contain', 'Step 1');

      cy.get('body').type('{enter}');

      cy.get('[data-testid="step-indicator"]').should('contain', 'Step 2');
    });

    it('should go back with arrow left key', () => {
      cy.get('body').type('{enter}'); // Go to step 2
      cy.get('[data-testid="step-indicator"]').should('contain', 'Step 2');

      cy.get('body').type('{leftarrow}');

      cy.get('[data-testid="step-indicator"]').should('contain', 'Step 1');
    });

    it('should advance with arrow right key', () => {
      cy.get('body').type('{rightarrow}');

      cy.get('[data-testid="step-indicator"]').should('contain', 'Step 2');
    });

    it('should close with Escape key', () => {
      cy.get('body').type('{esc}');

      cy.get('[data-testid="tour-preview-container"]').should('not.exist');
    });
  });
});
