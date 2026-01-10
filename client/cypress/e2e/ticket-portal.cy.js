/**
 * Customer Portal E2E Tests
 */

describe('Customer Portal', () => {
  describe('Submit Ticket', () => {
    it('should submit ticket without login', () => {
      cy.visit('/portal/submit-ticket');

      // Fill form
      cy.get('[name="subject"]').type('I need help');
      cy.get('[name="description"]').type('Please help me with my issue');
      cy.get('[name="email"]').type('customer@example.com');
      cy.get('[name="name"]').type('John Customer');

      // Submit
      cy.get('[data-testid="submit-ticket"]').click();

      // Verify success
      cy.contains('Ticket submitted successfully').should('be.visible');
      cy.contains('#').should('be.visible'); // Ticket number
    });

    it('should validate email format', () => {
      cy.visit('/portal/submit-ticket');

      cy.get('[name="subject"]').type('Test');
      cy.get('[name="email"]').type('invalid-email');
      cy.get('[data-testid="submit-ticket"]').click();

      cy.contains('Invalid email format').should('be.visible');
    });

    it('should show ticket confirmation', () => {
      cy.visit('/portal/submit-ticket');

      cy.get('[name="subject"]').type('Test ticket');
      cy.get('[name="email"]').type('test@example.com');
      cy.get('[data-testid="submit-ticket"]').click();

      // Verify confirmation page
      cy.contains('Your ticket has been created').should('be.visible');
      cy.contains('Track your ticket').should('be.visible');
    });
  });

  describe('Lookup Tickets', () => {
    beforeEach(() => {
      // Create some tickets first
      cy.request('POST', '/api/public/tickets', {
        workspace_id: 1,
        subject: 'Test ticket 1',
        requester_email: 'lookup@example.com'
      });
      cy.request('POST', '/api/public/tickets', {
        workspace_id: 1,
        subject: 'Test ticket 2',
        requester_email: 'lookup@example.com'
      });
    });

    it('should lookup tickets by email', () => {
      cy.visit('/portal/lookup');

      cy.get('[name="email"]').type('lookup@example.com');
      cy.get('[data-testid="lookup-button"]').click();

      // Verify tickets are displayed
      cy.contains('Test ticket 1').should('be.visible');
      cy.contains('Test ticket 2').should('be.visible');
    });

    it('should show message for no tickets found', () => {
      cy.visit('/portal/lookup');

      cy.get('[name="email"]').type('nonexistent@example.com');
      cy.get('[data-testid="lookup-button"]').click();

      cy.contains('No tickets found').should('be.visible');
    });
  });

  describe('View Ticket', () => {
    let ticketId;
    let accessToken;

    beforeEach(() => {
      // Create a ticket and get access token
      cy.request('POST', '/api/public/tickets', {
        workspace_id: 1,
        subject: 'Test ticket for viewing',
        description: 'This is the description',
        requester_email: 'viewer@example.com'
      }).then((response) => {
        ticketId = response.body.ticket.id;
        accessToken = response.body.accessToken;
      });
    });

    it('should view ticket with access token', () => {
      cy.visit(`/portal/tickets/${ticketId}?token=${accessToken}`);

      cy.contains('Test ticket for viewing').should('be.visible');
      cy.contains('This is the description').should('be.visible');
    });

    it('should deny access without token', () => {
      cy.visit(`/portal/tickets/${ticketId}`);

      cy.contains('Access denied').should('be.visible');
    });

    it('should deny access with invalid token', () => {
      cy.visit(`/portal/tickets/${ticketId}?token=invalid-token`);

      cy.contains('Invalid access token').should('be.visible');
    });
  });

  describe('Add Reply', () => {
    let ticketId;
    let accessToken;

    beforeEach(() => {
      cy.request('POST', '/api/public/tickets', {
        workspace_id: 1,
        subject: 'Test ticket for reply',
        requester_email: 'reply@example.com'
      }).then((response) => {
        ticketId = response.body.ticket.id;
        accessToken = response.body.accessToken;
        cy.visit(`/portal/tickets/${ticketId}?token=${accessToken}`);
      });
    });

    it('should add reply to ticket', () => {
      cy.get('[data-testid="reply-input"]').type('This is my reply');
      cy.get('[data-testid="submit-reply"]').click();

      cy.contains('Reply added successfully').should('be.visible');
      cy.contains('This is my reply').should('be.visible');
    });

    it('should show reply in conversation', () => {
      // Add first reply
      cy.get('[data-testid="reply-input"]').type('First reply');
      cy.get('[data-testid="submit-reply"]').click();

      // Add second reply
      cy.get('[data-testid="reply-input"]').type('Second reply');
      cy.get('[data-testid="submit-reply"]').click();

      // Verify both are visible
      cy.contains('First reply').should('be.visible');
      cy.contains('Second reply').should('be.visible');
    });
  });

  describe('Satisfaction Rating', () => {
    let ticketId;
    let accessToken;

    beforeEach(() => {
      cy.request('POST', '/api/public/tickets', {
        workspace_id: 1,
        subject: 'Test ticket for rating',
        requester_email: 'rating@example.com'
      }).then((response) => {
        ticketId = response.body.ticket.id;
        accessToken = response.body.accessToken;

        // Resolve the ticket (to enable rating)
        cy.request({
          method: 'POST',
          url: `/api/tickets/${ticketId}/resolve`,
          headers: { Authorization: 'Bearer test-token' }
        });

        cy.visit(`/portal/tickets/${ticketId}?token=${accessToken}`);
      });
    });

    it('should submit satisfaction rating', () => {
      // Click on 5 stars
      cy.get('[data-testid="star-5"]').click();

      // Add feedback
      cy.get('[data-testid="feedback-input"]').type('Great support!');

      // Submit
      cy.get('[data-testid="submit-rating"]').click();

      cy.contains('Thank you for your feedback').should('be.visible');
    });

    it('should show rating confirmation', () => {
      cy.get('[data-testid="star-4"]').click();
      cy.get('[data-testid="submit-rating"]').click();

      // Verify rating is shown
      cy.contains('You rated this ticket').should('be.visible');
      cy.get('[data-testid="submitted-rating"]').should('contain', '4');
    });

    it('should allow updating rating', () => {
      // Submit first rating
      cy.get('[data-testid="star-3"]').click();
      cy.get('[data-testid="submit-rating"]').click();

      // Update rating
      cy.get('[data-testid="update-rating"]').click();
      cy.get('[data-testid="star-5"]').click();
      cy.get('[data-testid="submit-rating"]').click();

      // Verify updated
      cy.get('[data-testid="submitted-rating"]').should('contain', '5');
    });
  });

  describe('Ticket Status Display', () => {
    it('should show appropriate status badges', () => {
      // Create tickets with different statuses
      const statuses = ['open', 'pending', 'resolved', 'closed'];

      statuses.forEach(status => {
        cy.request('POST', '/api/public/tickets', {
          workspace_id: 1,
          subject: `${status} ticket`,
          requester_email: 'status@example.com'
        }).then((response) => {
          // Update status via API
          if (status !== 'open') {
            cy.request({
              method: 'PUT',
              url: `/api/tickets/${response.body.ticket.id}`,
              headers: { Authorization: 'Bearer test-token' },
              body: { status }
            });
          }
        });
      });

      // Lookup tickets
      cy.visit('/portal/lookup');
      cy.get('[name="email"]').type('status@example.com');
      cy.get('[data-testid="lookup-button"]').click();

      // Verify status badges
      cy.get('[data-testid="status-open"]').should('exist');
      cy.get('[data-testid="status-pending"]').should('exist');
      cy.get('[data-testid="status-resolved"]').should('exist');
      cy.get('[data-testid="status-closed"]').should('exist');
    });
  });

  describe('Mobile Responsiveness', () => {
    beforeEach(() => {
      cy.viewport('iphone-x');
    });

    it('should display submit form correctly on mobile', () => {
      cy.visit('/portal/submit-ticket');

      cy.get('[name="subject"]').should('be.visible');
      cy.get('[data-testid="submit-ticket"]').should('be.visible');
    });

    it('should display ticket list correctly on mobile', () => {
      cy.visit('/portal/lookup');

      cy.get('[name="email"]').type('test@example.com');
      cy.get('[data-testid="lookup-button"]').should('be.visible');
    });
  });
});
