/**
 * Ticket Routes Unit Tests
 */

const request = require('supertest');
const express = require('express');

// Mock services before requiring routes
jest.mock('../../../services/ticket.service', () => ({
  getTickets: jest.fn(),
  getTicketById: jest.fn(),
  getTicketByNumber: jest.fn(),
  createTicket: jest.fn(),
  updateTicket: jest.fn(),
  deleteTicket: jest.fn(),
  resolveTicket: jest.fn(),
  closeTicket: jest.fn(),
  reopenTicket: jest.fn(),
  assignTicket: jest.fn(),
  unassignTicket: jest.fn(),
  autoAssign: jest.fn(),
  getComments: jest.fn(),
  addComment: jest.fn(),
  updateComment: jest.fn(),
  deleteComment: jest.fn(),
  getActivities: jest.fn(),
  mergeTickets: jest.fn(),
  getCategories: jest.fn(),
  createCategory: jest.fn(),
  updateCategory: jest.fn(),
  deleteCategory: jest.fn(),
  getSLAPolicies: jest.fn(),
  createSLAPolicy: jest.fn(),
  updateSLAPolicy: jest.fn(),
  deleteSLAPolicy: jest.fn(),
  getCannedResponses: jest.fn(),
  createCannedResponse: jest.fn(),
  updateCannedResponse: jest.fn(),
  deleteCannedResponse: jest.fn(),
  incrementUsage: jest.fn(),
  getTicketStats: jest.fn(),
  getAgentStats: jest.fn(),
  getSLAPerformance: jest.fn(),
  getSatisfactionStats: jest.fn()
}));

jest.mock('../../../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 1, name: 'Test User', email: 'test@example.com', workspace_id: 1 };
    next();
  }
}));

const ticketService = require('../../../services/ticket.service');
const ticketRoutes = require('../../../routes/ticket.routes');

describe('Ticket Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/tickets', ticketRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/tickets', () => {
    it('should return list of tickets', async () => {
      const mockResult = {
        tickets: [
          { id: '1', ticket_number: '#1001', subject: 'Test' }
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
      };

      ticketService.getTickets.mockResolvedValue(mockResult);

      const res = await request(app)
        .get('/api/tickets')
        .expect(200);

      expect(res.body).toEqual(mockResult);
      expect(ticketService.getTickets).toHaveBeenCalled();
    });

    it('should pass filters to service', async () => {
      ticketService.getTickets.mockResolvedValue({ tickets: [], pagination: {} });

      await request(app)
        .get('/api/tickets?status=open,pending&priority=high')
        .expect(200);

      expect(ticketService.getTickets).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          status: ['open', 'pending'],
          priority: ['high']
        })
      );
    });
  });

  describe('POST /api/tickets', () => {
    it('should create ticket', async () => {
      const mockTicket = { id: '123', ticket_number: '#1001', subject: 'New ticket' };
      ticketService.createTicket.mockResolvedValue(mockTicket);

      const res = await request(app)
        .post('/api/tickets')
        .send({
          subject: 'New ticket',
          description: 'Test description',
          requester_email: 'customer@example.com'
        })
        .expect(201);

      expect(res.body).toEqual(mockTicket);
    });
  });

  describe('GET /api/tickets/:id', () => {
    it('should return ticket with details', async () => {
      const mockTicket = {
        id: '123',
        ticket_number: '#1001',
        subject: 'Test',
        comments: []
      };
      ticketService.getTicketById.mockResolvedValue(mockTicket);

      const res = await request(app)
        .get('/api/tickets/123')
        .expect(200);

      expect(res.body).toEqual(mockTicket);
    });

    it('should return 404 if not found', async () => {
      ticketService.getTicketById.mockResolvedValue(null);

      await request(app)
        .get('/api/tickets/invalid')
        .expect(404);
    });
  });

  describe('PUT /api/tickets/:id', () => {
    it('should update ticket', async () => {
      const mockTicket = { id: '123', subject: 'Updated' };
      ticketService.updateTicket.mockResolvedValue(mockTicket);

      const res = await request(app)
        .put('/api/tickets/123')
        .send({ subject: 'Updated' })
        .expect(200);

      expect(res.body).toEqual(mockTicket);
    });

    it('should return 404 if not found', async () => {
      ticketService.updateTicket.mockResolvedValue(null);

      await request(app)
        .put('/api/tickets/invalid')
        .send({ subject: 'Updated' })
        .expect(404);
    });
  });

  describe('DELETE /api/tickets/:id', () => {
    it('should delete ticket', async () => {
      ticketService.deleteTicket.mockResolvedValue(true);

      const res = await request(app)
        .delete('/api/tickets/123')
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should return 404 if not found', async () => {
      ticketService.deleteTicket.mockResolvedValue(false);

      await request(app)
        .delete('/api/tickets/invalid')
        .expect(404);
    });
  });

  describe('Status Endpoints', () => {
    describe('POST /api/tickets/:id/resolve', () => {
      it('should resolve ticket', async () => {
        const mockTicket = { id: '123', status: 'resolved' };
        ticketService.resolveTicket.mockResolvedValue(mockTicket);

        const res = await request(app)
          .post('/api/tickets/123/resolve')
          .expect(200);

        expect(res.body.status).toBe('resolved');
      });
    });

    describe('POST /api/tickets/:id/close', () => {
      it('should close ticket', async () => {
        const mockTicket = { id: '123', status: 'closed' };
        ticketService.closeTicket.mockResolvedValue(mockTicket);

        const res = await request(app)
          .post('/api/tickets/123/close')
          .expect(200);

        expect(res.body.status).toBe('closed');
      });
    });

    describe('POST /api/tickets/:id/reopen', () => {
      it('should reopen ticket', async () => {
        const mockTicket = { id: '123', status: 'open' };
        ticketService.reopenTicket.mockResolvedValue(mockTicket);

        const res = await request(app)
          .post('/api/tickets/123/reopen')
          .expect(200);

        expect(res.body.status).toBe('open');
      });
    });
  });

  describe('Assignment Endpoints', () => {
    describe('POST /api/tickets/:id/assign', () => {
      it('should assign ticket', async () => {
        const mockTicket = { id: '123', assignee_id: 2 };
        ticketService.assignTicket.mockResolvedValue(mockTicket);

        const res = await request(app)
          .post('/api/tickets/123/assign')
          .send({ assigneeId: 2 })
          .expect(200);

        expect(res.body.assignee_id).toBe(2);
      });

      it('should return 400 if assigneeId not provided', async () => {
        await request(app)
          .post('/api/tickets/123/assign')
          .send({})
          .expect(400);
      });
    });

    describe('POST /api/tickets/:id/unassign', () => {
      it('should unassign ticket', async () => {
        const mockTicket = { id: '123', assignee_id: null };
        ticketService.unassignTicket.mockResolvedValue(mockTicket);

        const res = await request(app)
          .post('/api/tickets/123/unassign')
          .expect(200);

        expect(res.body.assignee_id).toBeNull();
      });
    });
  });

  describe('Comments Endpoints', () => {
    describe('GET /api/tickets/:id/comments', () => {
      it('should return comments', async () => {
        const mockComments = [
          { id: '1', body: 'Comment 1' },
          { id: '2', body: 'Comment 2' }
        ];
        ticketService.getComments.mockResolvedValue(mockComments);

        const res = await request(app)
          .get('/api/tickets/123/comments')
          .expect(200);

        expect(res.body.comments).toEqual(mockComments);
      });
    });

    describe('POST /api/tickets/:id/comments', () => {
      it('should add comment', async () => {
        const mockComment = { id: '1', body: 'New comment' };
        ticketService.addComment.mockResolvedValue(mockComment);

        const res = await request(app)
          .post('/api/tickets/123/comments')
          .send({ body: 'New comment' })
          .expect(201);

        expect(res.body).toEqual(mockComment);
      });
    });
  });

  describe('Merge Endpoint', () => {
    describe('POST /api/tickets/:id/merge', () => {
      it('should merge tickets', async () => {
        const mockTicket = { id: '123', ticket_number: '#1001' };
        ticketService.mergeTickets.mockResolvedValue(mockTicket);

        const res = await request(app)
          .post('/api/tickets/123/merge')
          .send({ ticketIds: ['456', '789'] })
          .expect(200);

        expect(res.body).toEqual(mockTicket);
      });

      it('should return 400 if ticketIds not provided', async () => {
        await request(app)
          .post('/api/tickets/123/merge')
          .send({})
          .expect(400);
      });
    });
  });

  describe('Categories Endpoints', () => {
    describe('GET /api/tickets/categories', () => {
      it('should return categories', async () => {
        const mockCategories = [{ id: '1', name: 'Billing' }];
        ticketService.getCategories.mockResolvedValue(mockCategories);

        const res = await request(app)
          .get('/api/tickets/categories')
          .expect(200);

        expect(res.body.categories).toEqual(mockCategories);
      });
    });

    describe('POST /api/tickets/categories', () => {
      it('should create category', async () => {
        const mockCategory = { id: '1', name: 'New Category' };
        ticketService.createCategory.mockResolvedValue(mockCategory);

        const res = await request(app)
          .post('/api/tickets/categories')
          .send({ name: 'New Category' })
          .expect(201);

        expect(res.body).toEqual(mockCategory);
      });
    });
  });

  describe('SLA Policies Endpoints', () => {
    describe('GET /api/tickets/sla-policies', () => {
      it('should return SLA policies', async () => {
        const mockPolicies = [{ id: '1', name: 'Standard SLA' }];
        ticketService.getSLAPolicies.mockResolvedValue(mockPolicies);

        const res = await request(app)
          .get('/api/tickets/sla-policies')
          .expect(200);

        expect(res.body.policies).toEqual(mockPolicies);
      });
    });
  });

  describe('Canned Responses Endpoints', () => {
    describe('GET /api/tickets/canned-responses', () => {
      it('should return canned responses', async () => {
        const mockResponses = [{ id: '1', title: 'Thanks' }];
        ticketService.getCannedResponses.mockResolvedValue(mockResponses);

        const res = await request(app)
          .get('/api/tickets/canned-responses')
          .expect(200);

        expect(res.body.responses).toEqual(mockResponses);
      });
    });

    describe('POST /api/tickets/canned-responses/:id/use', () => {
      it('should increment usage count', async () => {
        ticketService.incrementUsage.mockResolvedValue();

        const res = await request(app)
          .post('/api/tickets/canned-responses/123/use')
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(ticketService.incrementUsage).toHaveBeenCalledWith('123');
      });
    });
  });

  describe('Analytics Endpoints', () => {
    describe('GET /api/tickets/analytics/overview', () => {
      it('should return overview stats', async () => {
        const mockStats = { total: 100, open: 10, resolved: 80 };
        ticketService.getTicketStats.mockResolvedValue(mockStats);

        const res = await request(app)
          .get('/api/tickets/analytics/overview')
          .expect(200);

        expect(res.body).toEqual(mockStats);
      });
    });

    describe('GET /api/tickets/analytics/sla', () => {
      it('should return SLA performance', async () => {
        const mockPerformance = { overall: 94, firstResponse: 96 };
        ticketService.getSLAPerformance.mockResolvedValue(mockPerformance);

        const res = await request(app)
          .get('/api/tickets/analytics/sla')
          .expect(200);

        expect(res.body).toEqual(mockPerformance);
      });
    });

    describe('GET /api/tickets/analytics/satisfaction', () => {
      it('should return satisfaction stats', async () => {
        const mockStats = { averageRating: 4.2, totalRatings: 50 };
        ticketService.getSatisfactionStats.mockResolvedValue(mockStats);

        const res = await request(app)
          .get('/api/tickets/analytics/satisfaction')
          .expect(200);

        expect(res.body).toEqual(mockStats);
      });
    });
  });
});
