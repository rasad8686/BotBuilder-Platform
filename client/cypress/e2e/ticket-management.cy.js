/**
 * Ticket Management E2E Tests
 */

describe('Ticket Management', () => {
  beforeEach(() => {
    // Login before each test
    cy.login();
  });

  describe('Ticket List', () => {
    it('should display ticket list page', () => {
      cy.visit('/tickets');
      cy.contains('Tickets').should('be.visible');
    });

    it('should filter tickets by status', () => {
      cy.visit('/tickets');

      // Open status filter
      cy.get('[data-testid="status-filter"]').click();
      cy.contains('Open').click();

      // Verify URL contains filter
      cy.url().should('include', 'status=open');
    });

    it('should search tickets', () => {
      cy.visit('/tickets');

      cy.get('[data-testid="search-input"]').type('billing issue');

      // Wait for search results
      cy.wait(500);

      // Verify search is applied
      cy.url().should('include', 'search=billing');
    });

    it('should paginate through tickets', () => {
      cy.visit('/tickets');

      // Go to next page
      cy.get('[data-testid="next-page"]').click();

      cy.url().should('include', 'page=2');
    });
  });

  describe('Create Ticket', () => {
    it('should create new ticket', () => {
      cy.visit('/tickets/new');

      // Fill form
      cy.get('[name="subject"]').type('Test ticket from E2E');
      cy.get('[name="description"]').type('This is a test ticket created by Cypress');
      cy.get('[name="requester_email"]').type('test@example.com');
      cy.get('[name="requester_name"]').type('Test User');

      // Select priority
      cy.get('[data-testid="priority-select"]').click();
      cy.contains('High').click();

      // Submit
      cy.get('[data-testid="submit-ticket"]').click();

      // Verify success
      cy.contains('Ticket created successfully').should('be.visible');

      // Verify redirect to ticket detail
      cy.url().should('match', /\/tickets\/[a-z0-9-]+$/);
    });

    it('should validate required fields', () => {
      cy.visit('/tickets/new');

      // Submit without filling
      cy.get('[data-testid="submit-ticket"]').click();

      // Verify validation errors
      cy.contains('Subject is required').should('be.visible');
    });
  });

  describe('Ticket Detail', () => {
    beforeEach(() => {
      // Create a ticket first
      cy.createTicket({
        subject: 'E2E Test Ticket',
        description: 'Test description',
        requester_email: 'customer@example.com'
      }).then((ticket) => {
        cy.visit(`/tickets/${ticket.id}`);
      });
    });

    it('should display ticket details', () => {
      cy.contains('E2E Test Ticket').should('be.visible');
      cy.contains('Open').should('be.visible');
    });

    it('should add comment', () => {
      cy.get('[data-testid="comment-input"]').type('This is a test comment');
      cy.get('[data-testid="submit-comment"]').click();

      cy.contains('This is a test comment').should('be.visible');
    });

    it('should add internal note', () => {
      cy.get('[data-testid="internal-note-tab"]').click();
      cy.get('[data-testid="comment-input"]').type('Internal note for team only');
      cy.get('[data-testid="submit-comment"]').click();

      cy.contains('Internal note for team only').should('be.visible');
      cy.get('[data-testid="internal-badge"]').should('be.visible');
    });
  });

  describe('Ticket Assignment', () => {
    beforeEach(() => {
      cy.createTicket({
        subject: 'Assignment Test Ticket',
        requester_email: 'test@example.com'
      }).then((ticket) => {
        cy.visit(`/tickets/${ticket.id}`);
      });
    });

    it('should assign ticket to agent', () => {
      cy.get('[data-testid="assign-button"]').click();

      // Select agent from dropdown
      cy.get('[data-testid="agent-select"]').click();
      cy.contains('Test Agent').click();

      cy.get('[data-testid="confirm-assign"]').click();

      // Verify assignment
      cy.contains('Assigned to Test Agent').should('be.visible');
    });

    it('should unassign ticket', () => {
      // First assign
      cy.get('[data-testid="assign-button"]').click();
      cy.get('[data-testid="agent-select"]').click();
      cy.contains('Test Agent').click();
      cy.get('[data-testid="confirm-assign"]').click();

      // Then unassign
      cy.get('[data-testid="unassign-button"]').click();
      cy.get('[data-testid="confirm-unassign"]').click();

      cy.contains('Unassigned').should('be.visible');
    });
  });

  describe('Ticket Status Changes', () => {
    beforeEach(() => {
      cy.createTicket({
        subject: 'Status Test Ticket',
        requester_email: 'test@example.com'
      }).then((ticket) => {
        cy.visit(`/tickets/${ticket.id}`);
      });
    });

    it('should resolve ticket', () => {
      cy.get('[data-testid="status-dropdown"]').click();
      cy.contains('Resolve').click();

      cy.contains('Resolved').should('be.visible');
      cy.contains('Resolved at').should('be.visible');
    });

    it('should close ticket', () => {
      // First resolve
      cy.get('[data-testid="status-dropdown"]').click();
      cy.contains('Resolve').click();

      // Then close
      cy.get('[data-testid="status-dropdown"]').click();
      cy.contains('Close').click();

      cy.contains('Closed').should('be.visible');
    });

    it('should reopen closed ticket', () => {
      // Resolve and close first
      cy.get('[data-testid="status-dropdown"]').click();
      cy.contains('Close').click();

      // Reopen
      cy.get('[data-testid="reopen-button"]').click();

      cy.contains('Open').should('be.visible');
    });
  });

  describe('Canned Responses', () => {
    beforeEach(() => {
      cy.createTicket({
        subject: 'Canned Response Test',
        requester_email: 'test@example.com'
      }).then((ticket) => {
        cy.visit(`/tickets/${ticket.id}`);
      });
    });

    it('should insert canned response', () => {
      cy.get('[data-testid="canned-responses-button"]').click();

      // Select a canned response
      cy.contains('Thank you for contacting us').click();

      // Verify text is inserted
      cy.get('[data-testid="comment-input"]')
        .should('contain.value', 'Thank you for contacting us');
    });

    it('should use shortcut to insert canned response', () => {
      cy.get('[data-testid="comment-input"]').type('/thanks');

      // Wait for autocomplete
      cy.wait(300);

      // Select from autocomplete
      cy.get('[data-testid="autocomplete-option"]').first().click();

      cy.get('[data-testid="comment-input"]')
        .should('not.contain.value', '/thanks');
    });
  });

  describe('Ticket Analytics', () => {
    it('should display analytics dashboard', () => {
      cy.visit('/tickets/analytics');

      // Verify key metrics are visible
      cy.contains('Total Tickets').should('be.visible');
      cy.contains('Open Tickets').should('be.visible');
      cy.contains('Avg First Response').should('be.visible');
    });

    it('should change date range', () => {
      cy.visit('/tickets/analytics');

      cy.get('[data-testid="date-range-select"]').click();
      cy.contains('Last 7 days').click();

      // Verify data refreshes
      cy.get('[data-testid="loading-indicator"]').should('not.exist');
    });

    it('should export analytics', () => {
      cy.visit('/tickets/analytics');

      cy.get('[data-testid="export-button"]').click();

      // Verify download started
      cy.readFile('cypress/downloads/ticket-analytics.csv').should('exist');
    });

    it('should navigate between analytics tabs', () => {
      cy.visit('/tickets/analytics');

      // Click Agents tab
      cy.contains('Agents').click();
      cy.contains('Agent Performance').should('be.visible');

      // Click SLA tab
      cy.contains('SLA').click();
      cy.contains('SLA Compliance').should('be.visible');

      // Click Satisfaction tab
      cy.contains('Satisfaction').click();
      cy.contains('CSAT Score').should('be.visible');
    });
  });
});

// Custom commands
Cypress.Commands.add('login', () => {
  cy.request('POST', '/api/auth/login', {
    email: 'agent@example.com',
    password: 'password123'
  }).then((response) => {
    window.localStorage.setItem('token', response.body.token);
  });
});

Cypress.Commands.add('createTicket', (data) => {
  return cy.request({
    method: 'POST',
    url: '/api/tickets',
    headers: {
      Authorization: `Bearer ${window.localStorage.getItem('token')}`
    },
    body: data
  }).then((response) => response.body);
});
