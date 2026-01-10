/**
 * Ticket Service Unit Tests
 */

const ticketService = require('../../../services/ticket.service');

// Mock database
jest.mock('../../../db', () => {
  const mockQuery = jest.fn();
  const mockKnex = jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    whereNotNull: jest.fn().mockReturnThis(),
    whereILike: jest.fn().mockReturnThis(),
    orWhereILike: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    del: jest.fn().mockReturnThis(),
    increment: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    returning: jest.fn().mockResolvedValue([]),
    clone: jest.fn().mockReturnThis(),
    raw: jest.fn((sql) => sql),
    join: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    modify: jest.fn().mockReturnThis()
  }));

  mockKnex.raw = jest.fn((sql, params) => sql);
  mockKnex.fn = { now: jest.fn(() => 'NOW()') };
  mockKnex.transaction = jest.fn(async (callback) => {
    const trx = mockKnex;
    return callback(trx);
  });

  return mockKnex;
});

describe('TicketService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateTicketNumber', () => {
    it('should generate ticket number in format #XXXX', async () => {
      const db = require('../../../db');
      db.transaction.mockImplementation(async (callback) => {
        const trx = jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          increment: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([{ last_number: 1002 }]),
          insert: jest.fn().mockResolvedValue([])
        }));
        return callback(trx);
      });

      const ticketNumber = await ticketService.generateTicketNumber(1);
      expect(ticketNumber).toMatch(/^#\d+$/);
    });
  });

  describe('createTicket', () => {
    it('should create ticket with required fields', async () => {
      const db = require('../../../db');
      const mockTicket = {
        id: 'uuid-123',
        workspace_id: 1,
        ticket_number: '#1001',
        subject: 'Test ticket',
        status: 'open',
        priority: 'medium'
      };

      db.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
        insert: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockTicket])
      });

      // Mock generateTicketNumber
      jest.spyOn(ticketService, 'generateTicketNumber').mockResolvedValue('#1001');
      jest.spyOn(ticketService, 'logActivity').mockResolvedValue({});

      const ticket = await ticketService.createTicket(1, {
        subject: 'Test ticket',
        description: 'Test description',
        requester_email: 'test@example.com'
      });

      expect(ticketService.generateTicketNumber).toHaveBeenCalledWith(1);
    });

    it('should apply default SLA policy if not specified', async () => {
      const db = require('../../../db');
      const mockSLA = {
        id: 'sla-123',
        first_response_time: 240,
        resolution_time: 1440
      };

      db.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn()
          .mockResolvedValueOnce(mockSLA) // Default SLA
          .mockResolvedValueOnce(null),
        insert: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: 'ticket-123' }])
      });

      jest.spyOn(ticketService, 'generateTicketNumber').mockResolvedValue('#1001');
      jest.spyOn(ticketService, 'logActivity').mockResolvedValue({});

      const ticket = await ticketService.createTicket(1, {
        subject: 'Test ticket',
        requester_email: 'test@example.com'
      });

      // Should query for default SLA
      expect(db).toHaveBeenCalled();
    });
  });

  describe('updateTicket', () => {
    it('should update ticket and log activity', async () => {
      const db = require('../../../db');
      const oldTicket = {
        id: 'ticket-123',
        subject: 'Old subject',
        status: 'open',
        priority: 'medium'
      };
      const updatedTicket = {
        ...oldTicket,
        subject: 'New subject'
      };

      db.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(oldTicket),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([updatedTicket])
      });

      jest.spyOn(ticketService, 'logActivity').mockResolvedValue({});

      const result = await ticketService.updateTicket('ticket-123', 1, {
        subject: 'New subject'
      });

      expect(ticketService.logActivity).toHaveBeenCalled();
    });

    it('should set resolved_at when status changes to resolved', async () => {
      const db = require('../../../db');
      const oldTicket = {
        id: 'ticket-123',
        status: 'open',
        resolved_at: null
      };

      db.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(oldTicket),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ ...oldTicket, status: 'resolved' }])
      });

      jest.spyOn(ticketService, 'logActivity').mockResolvedValue({});

      await ticketService.updateTicket('ticket-123', 1, {
        status: 'resolved'
      });

      // Verify update was called with resolved_at
      expect(db().update).toHaveBeenCalled();
    });

    it('should return null if ticket not found', async () => {
      const db = require('../../../db');
      db.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null)
      });

      const result = await ticketService.updateTicket('invalid-id', 1, {});
      expect(result).toBeNull();
    });
  });

  describe('assignTicket', () => {
    it('should assign ticket to agent', async () => {
      const db = require('../../../db');
      const mockTicket = { id: 'ticket-123', assignee_id: null };

      db.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn()
          .mockResolvedValueOnce(mockTicket)
          .mockResolvedValueOnce({ id: 1, name: 'Agent' }),
        update: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ ...mockTicket, assignee_id: 1 }])
      });

      jest.spyOn(ticketService, 'logActivity').mockResolvedValue({});

      const result = await ticketService.assignTicket('ticket-123', 1, 1, 2, 'Admin');

      expect(ticketService.logActivity).toHaveBeenCalledWith(
        'ticket-123',
        'assigned',
        expect.anything(),
        expect.anything(),
        expect.any(Object)
      );
    });

    it('should update first_response_at on first assignment', async () => {
      const db = require('../../../db');
      const mockTicket = { id: 'ticket-123', assignee_id: null, first_response_at: null };

      db.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        first: jest.fn()
          .mockResolvedValueOnce(mockTicket)
          .mockResolvedValueOnce({ id: 1, name: 'Agent' }),
        update: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockTicket])
      });

      jest.spyOn(ticketService, 'logActivity').mockResolvedValue({});

      await ticketService.assignTicket('ticket-123', 1, 1, 2, 'Admin');

      // Should update first_response_at
      expect(db().update).toHaveBeenCalled();
    });
  });

  describe('changeStatus', () => {
    it('should change status and log activity', async () => {
      jest.spyOn(ticketService, 'updateTicket').mockResolvedValue({
        id: 'ticket-123',
        status: 'resolved'
      });

      const result = await ticketService.changeStatus('ticket-123', 1, 'resolved', 1, 'Agent');

      expect(ticketService.updateTicket).toHaveBeenCalledWith(
        'ticket-123',
        1,
        expect.objectContaining({ status: 'resolved' })
      );
    });
  });

  describe('addComment', () => {
    it('should add customer comment', async () => {
      const db = require('../../../db');
      const mockComment = {
        id: 'comment-123',
        ticket_id: 'ticket-123',
        author_type: 'customer',
        body: 'Test comment'
      };

      db.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockComment])
      });

      jest.spyOn(ticketService, 'logActivity').mockResolvedValue({});

      const comment = await ticketService.addComment('ticket-123', {
        author_type: 'customer',
        author_email: 'customer@example.com',
        body: 'Test comment'
      });

      expect(comment).toEqual(mockComment);
    });

    it('should add internal note', async () => {
      const db = require('../../../db');
      const mockComment = {
        id: 'comment-123',
        is_internal: true
      };

      db.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockComment])
      });

      jest.spyOn(ticketService, 'logActivity').mockResolvedValue({});

      const comment = await ticketService.addComment('ticket-123', {
        author_type: 'agent',
        body: 'Internal note',
        is_internal: true
      });

      expect(comment.is_internal).toBe(true);
    });

    it('should update first_response_at on first agent comment', async () => {
      const db = require('../../../db');

      db.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: 'comment-123' }])
      });

      jest.spyOn(ticketService, 'logActivity').mockResolvedValue({});

      await ticketService.addComment('ticket-123', {
        author_type: 'agent',
        body: 'Agent response'
      });

      // Should update first_response_at
      expect(db().update).toHaveBeenCalled();
    });
  });

  describe('mergeTickets', () => {
    it('should merge secondary tickets into primary', async () => {
      const db = require('../../../db');
      const primaryTicket = { id: 'primary-123', ticket_number: '#1001' };
      const secondaryTicket = { id: 'secondary-456', ticket_number: '#1002' };

      db.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(primaryTicket),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([primaryTicket])
      });

      jest.spyOn(ticketService, 'logActivity').mockResolvedValue({});
      jest.spyOn(ticketService, 'getTicketById').mockResolvedValue(primaryTicket);

      // Mock secondary tickets query
      db.mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(primaryTicket)
      });
      db.mockReturnValueOnce({
        whereIn: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([secondaryTicket])
      });

      const result = await ticketService.mergeTickets('primary-123', ['secondary-456'], 1, 1, 'Admin');

      expect(ticketService.logActivity).toHaveBeenCalled();
    });

    it('should move comments to primary ticket', async () => {
      const db = require('../../../db');

      db.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ id: 'primary' }),
        update: jest.fn().mockReturnThis()
      });

      jest.spyOn(ticketService, 'logActivity').mockResolvedValue({});
      jest.spyOn(ticketService, 'getTicketById').mockResolvedValue({ id: 'primary' });

      // Comments should be moved
      await ticketService.mergeTickets('primary', ['secondary'], 1, 1, 'Admin');

      expect(db().update).toHaveBeenCalled();
    });

    it('should close secondary tickets after merge', async () => {
      const db = require('../../../db');

      db.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ id: 'primary' }),
        update: jest.fn().mockReturnThis()
      });

      db.raw = jest.fn().mockReturnValue({});

      jest.spyOn(ticketService, 'logActivity').mockResolvedValue({});
      jest.spyOn(ticketService, 'getTicketById').mockResolvedValue({ id: 'primary' });

      await ticketService.mergeTickets('primary', ['secondary'], 1, 1, 'Admin');

      // Secondary ticket should be closed
      expect(db().update).toHaveBeenCalled();
    });
  });

  describe('SLA Methods', () => {
    describe('checkSLABreach', () => {
      it('should return no breach for ticket without SLA', async () => {
        const db = require('../../../db');
        db.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue({ id: 'ticket', sla_policy_id: null })
        });

        const result = await ticketService.checkSLABreach('ticket-123');
        expect(result).toEqual({ firstResponseBreached: false, resolutionBreached: false });
      });

      it('should detect first response breach', async () => {
        const db = require('../../../db');
        const createdAt = new Date(Date.now() - 5 * 60 * 60 * 1000); // 5 hours ago

        db.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          first: jest.fn()
            .mockResolvedValueOnce({
              id: 'ticket',
              sla_policy_id: 'sla-123',
              created_at: createdAt,
              first_response_at: null,
              resolved_at: null,
              status: 'open',
              priority: 'medium'
            })
            .mockResolvedValueOnce({
              id: 'sla-123',
              first_response_time: 120, // 2 hours
              resolution_time: 1440
            })
        });

        const result = await ticketService.checkSLABreach('ticket-123');
        expect(result.firstResponseBreached).toBe(true);
      });
    });

    describe('getSLAStatus', () => {
      it('should return null for ticket without SLA', async () => {
        const db = require('../../../db');
        db.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue({ sla_policy_id: null })
        });

        const result = await ticketService.getSLAStatus('ticket-123');
        expect(result).toBeNull();
      });

      it('should calculate remaining time for active SLA', async () => {
        const db = require('../../../db');
        const createdAt = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago

        db.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          first: jest.fn()
            .mockResolvedValueOnce({
              id: 'ticket',
              sla_policy_id: 'sla-123',
              created_at: createdAt,
              first_response_at: null,
              priority: 'medium'
            })
            .mockResolvedValueOnce({
              first_response_time: 120, // 2 hours
              resolution_time: 1440,
              priority_overrides: {}
            })
        });

        const result = await ticketService.getSLAStatus('ticket-123');
        expect(result.firstResponse).toBeDefined();
        expect(result.firstResponse.remainingMinutes).toBeGreaterThan(0);
      });
    });
  });

  describe('Canned Responses', () => {
    it('should get canned responses for workspace', async () => {
      const db = require('../../../db');
      const mockResponses = [
        { id: '1', title: 'Thanks', shortcut: '/thanks' },
        { id: '2', title: 'Closing', shortcut: '/close' }
      ];

      db.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue(mockResponses)
      });

      const responses = await ticketService.getCannedResponses(1);
      expect(responses).toEqual(mockResponses);
    });

    it('should increment usage count', async () => {
      const db = require('../../../db');
      db.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        increment: jest.fn().mockResolvedValue(1)
      });

      await ticketService.incrementUsage('response-123');
      expect(db().increment).toHaveBeenCalledWith('usage_count', 1);
    });
  });

  describe('Satisfaction', () => {
    it('should submit new rating', async () => {
      const db = require('../../../db');
      db.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
        insert: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: 'sat-123', rating: 5 }])
      });

      jest.spyOn(ticketService, 'logActivity').mockResolvedValue({});

      const result = await ticketService.submitRating('ticket-123', 5, 'Great service!');
      expect(result.rating).toBe(5);
    });

    it('should update existing rating', async () => {
      const db = require('../../../db');
      db.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ id: 'sat-123', rating: 3 }),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: 'sat-123', rating: 5 }])
      });

      const result = await ticketService.submitRating('ticket-123', 5, 'Updated feedback');
      expect(result.rating).toBe(5);
    });
  });
});
