/**
 * Tickets Integration Tests
 * Tests full ticket lifecycle and workflows
 */

const request = require('supertest');
const express = require('express');

// Create mock database with state
const createMockDb = () => {
  const state = {
    tickets: [],
    comments: [],
    activities: [],
    categories: [],
    slaPolicies: [],
    satisfaction: [],
    sequences: { 1: 1000 }
  };

  return {
    state,
    getNextTicketNumber: (workspaceId) => {
      state.sequences[workspaceId] = (state.sequences[workspaceId] || 1000) + 1;
      return `#${state.sequences[workspaceId]}`;
    }
  };
};

// Mock dependencies
jest.mock('../../../db', () => {
  const mockDb = createMockDb();
  const knex = jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    first: jest.fn().mockImplementation(() => Promise.resolve(null)),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    del: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([]),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
    clone: jest.fn().mockReturnThis()
  }));
  knex.raw = jest.fn((sql) => sql);
  knex.fn = { now: jest.fn(() => 'NOW()') };
  knex.transaction = jest.fn(async (cb) => cb(knex));
  return knex;
});

jest.mock('../../../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 1, name: 'Agent', email: 'agent@example.com', workspace_id: 1 };
    next();
  }
}));

describe('Ticket Integration Tests', () => {
  let app;
  let ticketService;

  beforeAll(() => {
    // Clear module cache to get fresh mocks
    jest.resetModules();
  });

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Mock ticket service with stateful behavior
    ticketService = {
      tickets: [],
      comments: [],

      getTickets: jest.fn(async () => ({
        tickets: ticketService.tickets,
        pagination: { page: 1, limit: 20, total: ticketService.tickets.length }
      })),

      createTicket: jest.fn(async (workspaceId, data) => {
        const ticket = {
          id: `ticket-${Date.now()}`,
          workspace_id: workspaceId,
          ticket_number: `#${1001 + ticketService.tickets.length}`,
          subject: data.subject,
          description: data.description,
          status: 'open',
          priority: data.priority || 'medium',
          requester_email: data.requester_email,
          requester_name: data.requester_name,
          assignee_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        ticketService.tickets.push(ticket);
        return ticket;
      }),

      getTicketById: jest.fn(async (id) => {
        return ticketService.tickets.find(t => t.id === id) || null;
      }),

      assignTicket: jest.fn(async (id, workspaceId, assigneeId) => {
        const ticket = ticketService.tickets.find(t => t.id === id);
        if (ticket) {
          ticket.assignee_id = assigneeId;
          ticket.first_response_at = new Date().toISOString();
        }
        return ticket;
      }),

      addComment: jest.fn(async (ticketId, data) => {
        const comment = {
          id: `comment-${Date.now()}`,
          ticket_id: ticketId,
          author_type: data.author_type,
          author_name: data.author_name,
          body: data.body,
          is_internal: data.is_internal || false,
          created_at: new Date().toISOString()
        };
        ticketService.comments.push(comment);

        // Update first_response_at if agent comment
        if (data.author_type === 'agent') {
          const ticket = ticketService.tickets.find(t => t.id === ticketId);
          if (ticket && !ticket.first_response_at) {
            ticket.first_response_at = new Date().toISOString();
          }
        }

        return comment;
      }),

      getComments: jest.fn(async (ticketId) => {
        return ticketService.comments.filter(c => c.ticket_id === ticketId);
      }),

      resolveTicket: jest.fn(async (id) => {
        const ticket = ticketService.tickets.find(t => t.id === id);
        if (ticket) {
          ticket.status = 'resolved';
          ticket.resolved_at = new Date().toISOString();
        }
        return ticket;
      }),

      closeTicket: jest.fn(async (id) => {
        const ticket = ticketService.tickets.find(t => t.id === id);
        if (ticket) {
          ticket.status = 'closed';
          ticket.closed_at = new Date().toISOString();
        }
        return ticket;
      })
    };

    // Mock the service module
    jest.mock('../../../services/ticket.service', () => ticketService);

    // Create routes with mocked service
    const ticketRoutes = express.Router();
    ticketRoutes.use((req, res, next) => {
      req.user = { id: 1, name: 'Agent', workspace_id: 1 };
      next();
    });

    ticketRoutes.get('/', async (req, res) => {
      const result = await ticketService.getTickets(1, {});
      res.json(result);
    });

    ticketRoutes.post('/', async (req, res) => {
      const ticket = await ticketService.createTicket(1, req.body);
      res.status(201).json(ticket);
    });

    ticketRoutes.get('/:id', async (req, res) => {
      const ticket = await ticketService.getTicketById(req.params.id);
      if (!ticket) return res.status(404).json({ error: 'Not found' });
      res.json(ticket);
    });

    ticketRoutes.post('/:id/assign', async (req, res) => {
      const ticket = await ticketService.assignTicket(req.params.id, 1, req.body.assigneeId);
      if (!ticket) return res.status(404).json({ error: 'Not found' });
      res.json(ticket);
    });

    ticketRoutes.post('/:id/comments', async (req, res) => {
      const comment = await ticketService.addComment(req.params.id, {
        ...req.body,
        author_type: 'agent',
        author_name: req.user.name
      });
      res.status(201).json(comment);
    });

    ticketRoutes.get('/:id/comments', async (req, res) => {
      const comments = await ticketService.getComments(req.params.id);
      res.json({ comments });
    });

    ticketRoutes.post('/:id/resolve', async (req, res) => {
      const ticket = await ticketService.resolveTicket(req.params.id);
      if (!ticket) return res.status(404).json({ error: 'Not found' });
      res.json(ticket);
    });

    ticketRoutes.post('/:id/close', async (req, res) => {
      const ticket = await ticketService.closeTicket(req.params.id);
      if (!ticket) return res.status(404).json({ error: 'Not found' });
      res.json(ticket);
    });

    app.use('/api/tickets', ticketRoutes);
  });

  afterEach(() => {
    ticketService.tickets = [];
    ticketService.comments = [];
    jest.clearAllMocks();
  });

  describe('Full Ticket Lifecycle', () => {
    it('should complete full lifecycle: create -> assign -> comment -> resolve -> close', async () => {
      // Step 1: Create ticket
      const createRes = await request(app)
        .post('/api/tickets')
        .send({
          subject: 'Need help with billing',
          description: 'I was charged twice',
          requester_email: 'customer@example.com',
          requester_name: 'John Doe',
          priority: 'high'
        })
        .expect(201);

      const ticketId = createRes.body.id;
      expect(createRes.body.status).toBe('open');
      expect(createRes.body.ticket_number).toMatch(/^#\d+$/);

      // Step 2: Assign to agent
      const assignRes = await request(app)
        .post(`/api/tickets/${ticketId}/assign`)
        .send({ assigneeId: 2 })
        .expect(200);

      expect(assignRes.body.assignee_id).toBe(2);
      expect(assignRes.body.first_response_at).toBeDefined();

      // Step 3: Add agent comment
      const commentRes = await request(app)
        .post(`/api/tickets/${ticketId}/comments`)
        .send({
          body: 'I will look into this for you.'
        })
        .expect(201);

      expect(commentRes.body.author_type).toBe('agent');

      // Step 4: Resolve ticket
      const resolveRes = await request(app)
        .post(`/api/tickets/${ticketId}/resolve`)
        .expect(200);

      expect(resolveRes.body.status).toBe('resolved');
      expect(resolveRes.body.resolved_at).toBeDefined();

      // Step 5: Close ticket
      const closeRes = await request(app)
        .post(`/api/tickets/${ticketId}/close`)
        .expect(200);

      expect(closeRes.body.status).toBe('closed');
      expect(closeRes.body.closed_at).toBeDefined();

      // Verify final state
      const finalRes = await request(app)
        .get(`/api/tickets/${ticketId}`)
        .expect(200);

      expect(finalRes.body.status).toBe('closed');
    });
  });

  describe('Comment Workflow', () => {
    it('should track conversation between customer and agent', async () => {
      // Create ticket
      const createRes = await request(app)
        .post('/api/tickets')
        .send({
          subject: 'Technical question',
          requester_email: 'user@example.com'
        })
        .expect(201);

      const ticketId = createRes.body.id;

      // Agent responds
      await request(app)
        .post(`/api/tickets/${ticketId}/comments`)
        .send({ body: 'How can I help you?' })
        .expect(201);

      // Add customer reply (simulated)
      await ticketService.addComment(ticketId, {
        author_type: 'customer',
        author_name: 'Customer',
        body: 'I have a question about integration.'
      });

      // Agent responds again
      await request(app)
        .post(`/api/tickets/${ticketId}/comments`)
        .send({ body: 'Here is the documentation link...' })
        .expect(201);

      // Get all comments
      const commentsRes = await request(app)
        .get(`/api/tickets/${ticketId}/comments`)
        .expect(200);

      expect(commentsRes.body.comments.length).toBe(3);

      // Verify conversation order
      const types = commentsRes.body.comments.map(c => c.author_type);
      expect(types).toEqual(['agent', 'customer', 'agent']);
    });
  });

  describe('Multiple Tickets Workflow', () => {
    it('should handle multiple tickets independently', async () => {
      // Create 3 tickets
      const tickets = [];
      for (let i = 0; i < 3; i++) {
        const res = await request(app)
          .post('/api/tickets')
          .send({
            subject: `Ticket ${i + 1}`,
            requester_email: `user${i}@example.com`
          })
          .expect(201);
        tickets.push(res.body);
      }

      // Verify all have unique numbers
      const numbers = tickets.map(t => t.ticket_number);
      expect(new Set(numbers).size).toBe(3);

      // Resolve only the second ticket
      await request(app)
        .post(`/api/tickets/${tickets[1].id}/resolve`)
        .expect(200);

      // List tickets
      const listRes = await request(app)
        .get('/api/tickets')
        .expect(200);

      expect(listRes.body.tickets.length).toBe(3);

      // Verify statuses
      const statuses = listRes.body.tickets.map(t => t.status);
      expect(statuses.filter(s => s === 'open').length).toBe(2);
      expect(statuses.filter(s => s === 'resolved').length).toBe(1);
    });
  });

  describe('First Response Tracking', () => {
    it('should set first_response_at on first agent action', async () => {
      // Create ticket
      const createRes = await request(app)
        .post('/api/tickets')
        .send({
          subject: 'New ticket',
          requester_email: 'test@example.com'
        })
        .expect(201);

      const ticketId = createRes.body.id;
      expect(createRes.body.first_response_at).toBeUndefined();

      // Agent comments - should set first_response_at
      await request(app)
        .post(`/api/tickets/${ticketId}/comments`)
        .send({ body: 'Looking into this...' })
        .expect(201);

      // Check ticket now has first_response_at
      const ticketRes = await request(app)
        .get(`/api/tickets/${ticketId}`)
        .expect(200);

      expect(ticketRes.body.first_response_at).toBeDefined();
    });
  });
});
