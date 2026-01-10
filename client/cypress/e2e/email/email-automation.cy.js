describe('Email Automation', () => {
  beforeEach(() => {
    cy.login();
    cy.intercept('GET', '/api/email/automations*', { fixture: 'email/automations.json' }).as('getAutomations');
  });

  describe('Automations List Page', () => {
    beforeEach(() => {
      cy.visit('/email/automations');
      cy.wait('@getAutomations');
    });

    it('should display automations list', () => {
      cy.get('[data-testid="automation-card"]').should('have.length.at.least', 1);
    });

    it('should filter automations by status', () => {
      cy.get('[data-testid="status-tab-active"]').click();
      cy.get('[data-testid="automation-card"]').each(($card) => {
        cy.wrap($card).find('[data-testid="status-badge"]').should('contain', 'Active');
      });
    });

    it('should search automations by name', () => {
      cy.get('[data-testid="search-input"]').type('Welcome');
      cy.get('[data-testid="automation-card"]').should('have.length', 1);
      cy.get('[data-testid="automation-card"]').first().should('contain', 'Welcome');
    });

    it('should navigate to create new automation', () => {
      cy.get('[data-testid="create-automation-btn"]').click();
      cy.url().should('include', '/email/automations/new');
    });

    it('should display quick stats', () => {
      cy.get('[data-testid="stats-total"]').should('exist');
      cy.get('[data-testid="stats-active"]').should('exist');
      cy.get('[data-testid="stats-enrolled"]').should('exist');
    });

    it('should show automation actions menu', () => {
      cy.get('[data-testid="automation-card"]').first()
        .find('[data-testid="actions-menu"]').click();
      cy.get('[data-testid="action-edit"]').should('be.visible');
      cy.get('[data-testid="action-duplicate"]').should('be.visible');
      cy.get('[data-testid="action-delete"]').should('be.visible');
    });
  });

  describe('Automation Builder Page', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/email/automations/*', { fixture: 'email/automation-detail.json' }).as('getAutomation');
      cy.intercept('GET', '/api/email/templates*', { fixture: 'email/templates.json' }).as('getTemplates');
      cy.visit('/email/automations/automation-1');
      cy.wait(['@getAutomation', '@getTemplates']);
    });

    it('should display workflow builder', () => {
      cy.get('[data-testid="workflow-canvas"]').should('exist');
      cy.get('[data-testid="steps-palette"]').should('exist');
      cy.get('[data-testid="settings-panel"]').should('exist');
    });

    it('should show automation name in header', () => {
      cy.get('[data-testid="automation-name"]').should('contain', 'Welcome Series');
    });

    it('should display trigger node', () => {
      cy.get('[data-testid="trigger-node"]').should('exist');
      cy.get('[data-testid="trigger-node"]').should('contain', 'List Subscribed');
    });

    it('should display workflow steps', () => {
      cy.get('[data-testid="workflow-node"]').should('have.length.at.least', 2);
    });

    describe('Step Palette', () => {
      it('should display available step types', () => {
        cy.get('[data-testid="step-palette-item"]').should('have.length.at.least', 5);
      });

      it('should show step categories', () => {
        cy.get('[data-testid="category-triggers"]').should('exist');
        cy.get('[data-testid="category-actions"]').should('exist');
        cy.get('[data-testid="category-flow"]').should('exist');
      });

      it('should drag step to canvas', () => {
        const dataTransfer = new DataTransfer();

        cy.get('[data-testid="step-send-email"]')
          .trigger('dragstart', { dataTransfer });

        cy.get('[data-testid="workflow-canvas"]')
          .trigger('drop', { dataTransfer });

        cy.get('[data-testid="workflow-node"]').should('have.length.at.least', 3);
      });
    });

    describe('Node Selection and Settings', () => {
      it('should select node on click', () => {
        cy.get('[data-testid="workflow-node"]').first().click();
        cy.get('[data-testid="workflow-node"]').first().should('have.class', 'selected');
      });

      it('should show settings panel when node is selected', () => {
        cy.get('[data-testid="workflow-node"]').first().click();
        cy.get('[data-testid="settings-panel"]').should('be.visible');
        cy.get('[data-testid="node-settings-form"]').should('exist');
      });

      it('should update node settings', () => {
        cy.get('[data-testid="workflow-node"][data-type="send_email"]').first().click();
        cy.get('[data-testid="subject-input"]').clear().type('New Subject');
        cy.get('[data-testid="save-settings-btn"]').click();
        cy.get('[data-testid="workflow-node"]').first().should('contain', 'New Subject');
      });
    });

    describe('Trigger Configuration', () => {
      it('should configure list subscribed trigger', () => {
        cy.get('[data-testid="trigger-node"]').click();
        cy.get('[data-testid="trigger-type-select"]').select('list_subscribed');
        cy.get('[data-testid="list-select"]').should('be.visible');
      });

      it('should configure tag added trigger', () => {
        cy.get('[data-testid="trigger-node"]').click();
        cy.get('[data-testid="trigger-type-select"]').select('tag_added');
        cy.get('[data-testid="tag-input"]').should('be.visible');
      });
    });

    describe('Save and Activate', () => {
      it('should save automation as draft', () => {
        cy.intercept('PUT', '/api/email/automations/*', { success: true }).as('saveAutomation');

        cy.get('[data-testid="save-btn"]').click();
        cy.wait('@saveAutomation');
        cy.get('[data-testid="toast-success"]').should('contain', 'saved');
      });

      it('should activate automation', () => {
        cy.intercept('POST', '/api/email/automations/*/activate', { success: true }).as('activateAutomation');

        cy.get('[data-testid="activate-btn"]').click();
        cy.get('[data-testid="confirm-modal"]').should('be.visible');
        cy.get('[data-testid="confirm-btn"]').click();
        cy.wait('@activateAutomation');
        cy.get('[data-testid="status-badge"]').should('contain', 'Active');
      });

      it('should validate before activation', () => {
        // Remove trigger to make automation invalid
        cy.get('[data-testid="trigger-node"]').find('[data-testid="delete-btn"]').click();
        cy.get('[data-testid="activate-btn"]').click();
        cy.get('[data-testid="validation-error"]').should('contain', 'trigger is required');
      });
    });
  });

  describe('Automation Report Page', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/email/automations/*/report', { fixture: 'email/automation-report.json' }).as('getReport');
      cy.visit('/email/automations/automation-1/report');
      cy.wait('@getReport');
    });

    it('should display report header', () => {
      cy.get('[data-testid="report-header"]').should('contain', 'Welcome Series');
      cy.get('[data-testid="status-badge"]').should('exist');
    });

    it('should display enrollment stats', () => {
      cy.get('[data-testid="stat-enrolled"]').should('exist');
      cy.get('[data-testid="stat-active"]').should('exist');
      cy.get('[data-testid="stat-completed"]').should('exist');
      cy.get('[data-testid="stat-exited"]').should('exist');
    });

    it('should display completion rate', () => {
      cy.get('[data-testid="completion-rate"]').should('exist');
      cy.get('[data-testid="completion-rate"]').should('contain', '%');
    });

    it('should display step performance', () => {
      cy.get('[data-testid="step-stats-table"]').should('exist');
      cy.get('[data-testid="step-row"]').should('have.length.at.least', 1);
    });

    it('should display recent activity', () => {
      cy.get('[data-testid="activity-list"]').should('exist');
      cy.get('[data-testid="activity-item"]').should('have.length.at.least', 1);
    });

    it('should switch between tabs', () => {
      cy.get('[data-testid="tab-overview"]').should('have.class', 'active');

      cy.get('[data-testid="tab-enrollments"]').click();
      cy.get('[data-testid="enrollments-table"]').should('be.visible');

      cy.get('[data-testid="tab-activity"]').click();
      cy.get('[data-testid="activity-timeline"]').should('be.visible');
    });

    describe('Enrollments Tab', () => {
      beforeEach(() => {
        cy.intercept('GET', '/api/email/automations/*/enrollments*', { fixture: 'email/automation-enrollments.json' }).as('getEnrollments');
        cy.get('[data-testid="tab-enrollments"]').click();
        cy.wait('@getEnrollments');
      });

      it('should display enrollments list', () => {
        cy.get('[data-testid="enrollment-row"]').should('have.length.at.least', 1);
      });

      it('should filter enrollments by status', () => {
        cy.get('[data-testid="enrollment-filter"]').select('active');
        cy.get('[data-testid="enrollment-row"]').each(($row) => {
          cy.wrap($row).find('[data-testid="enrollment-status"]').should('contain', 'Active');
        });
      });

      it('should remove enrollment', () => {
        cy.intercept('DELETE', '/api/email/automations/*/enrollments/*', { success: true }).as('removeEnrollment');

        cy.get('[data-testid="enrollment-row"]').first()
          .find('[data-testid="remove-enrollment-btn"]').click();
        cy.get('[data-testid="confirm-modal"]').should('be.visible');
        cy.get('[data-testid="confirm-btn"]').click();
        cy.wait('@removeEnrollment');
      });
    });
  });

  describe('Create New Automation', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/email/templates*', { fixture: 'email/templates.json' }).as('getTemplates');
      cy.intercept('GET', '/api/email/lists*', { fixture: 'email/lists.json' }).as('getLists');
      cy.visit('/email/automations/new');
      cy.wait(['@getTemplates', '@getLists']);
    });

    it('should show empty canvas with trigger placeholder', () => {
      cy.get('[data-testid="workflow-canvas"]').should('exist');
      cy.get('[data-testid="trigger-placeholder"]').should('exist');
    });

    it('should prompt for automation name', () => {
      cy.get('[data-testid="automation-name-input"]').should('be.visible');
    });

    it('should add trigger', () => {
      cy.get('[data-testid="trigger-placeholder"]').click();
      cy.get('[data-testid="trigger-type-select"]').select('list_subscribed');
      cy.get('[data-testid="list-select"]').select('list-1');
      cy.get('[data-testid="save-trigger-btn"]').click();
      cy.get('[data-testid="trigger-node"]').should('contain', 'List Subscribed');
    });

    it('should build complete workflow', () => {
      // Set name
      cy.get('[data-testid="automation-name-input"]').type('Test Automation');

      // Add trigger
      cy.get('[data-testid="trigger-placeholder"]').click();
      cy.get('[data-testid="trigger-type-select"]').select('list_subscribed');
      cy.get('[data-testid="list-select"]').select('list-1');
      cy.get('[data-testid="save-trigger-btn"]').click();

      // Add wait step
      cy.get('[data-testid="step-wait"]').drag('[data-testid="workflow-canvas"]');
      cy.get('[data-testid="workflow-node"][data-type="wait"]').click();
      cy.get('[data-testid="wait-duration"]').type('1');
      cy.get('[data-testid="wait-unit"]').select('days');
      cy.get('[data-testid="save-settings-btn"]').click();

      // Add send email step
      cy.get('[data-testid="step-send-email"]').drag('[data-testid="workflow-canvas"]');
      cy.get('[data-testid="workflow-node"][data-type="send_email"]').click();
      cy.get('[data-testid="template-select"]').select('template-1');
      cy.get('[data-testid="save-settings-btn"]').click();

      // Verify workflow
      cy.get('[data-testid="workflow-node"]').should('have.length', 3);
    });

    it('should save new automation', () => {
      cy.intercept('POST', '/api/email/automations', {
        id: 'new-automation-1',
        name: 'Test Automation',
        status: 'draft'
      }).as('createAutomation');

      cy.get('[data-testid="automation-name-input"]').type('Test Automation');
      cy.get('[data-testid="save-btn"]').click();
      cy.wait('@createAutomation');
      cy.url().should('include', '/email/automations/new-automation-1');
    });
  });

  describe('Automation Templates', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/email/automation-templates*', { fixture: 'email/automation-templates.json' }).as('getTemplates');
      cy.visit('/email/automations/new');
      cy.get('[data-testid="use-template-btn"]').click();
      cy.wait('@getTemplates');
    });

    it('should display available templates', () => {
      cy.get('[data-testid="template-modal"]').should('be.visible');
      cy.get('[data-testid="automation-template-card"]').should('have.length.at.least', 3);
    });

    it('should preview template', () => {
      cy.get('[data-testid="automation-template-card"]').first()
        .find('[data-testid="preview-btn"]').click();
      cy.get('[data-testid="template-preview"]').should('be.visible');
    });

    it('should use template', () => {
      cy.get('[data-testid="automation-template-card"]').first()
        .find('[data-testid="use-template-btn"]').click();
      cy.get('[data-testid="workflow-node"]').should('have.length.at.least', 2);
    });
  });
});
