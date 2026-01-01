/**
 * Comprehensive Messages Routes Tests
 * Tests for server/routes/messages.js
 *
 * Coverage:
 * - POST /api/messages - create new message
 * - GET /api/messages/bot/:botId - list messages with pagination
 * - GET /api/messages/:id - get single message
 * - PUT /api/messages/:id - update message
 * - DELETE /api/messages/:id - delete message
 * - Error handling and validation
 * - Authorization checks
 * - Message limit enforcement
 * - Webhook triggers
 * - Usage tracking
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  next();
}));

jest.mock('../../middleware/organizationContext', () => ({
  organizationContext: jest.fn((req, res, next) => {
    req.organization = { id: 1, name: 'Test Org' };
    next();
  }),
  requireOrganization: jest.fn((req, res, next) => next())
}));

jest.mock('../../middleware/checkPermission', () => ({
  checkPermission: jest.fn(() => (req, res, next) => next())
}));

jest.mock('../../middleware/checkMessageLimit', () => ({
  checkMessageLimit: jest.fn((req, res, next) => {
    req.messageUsage = { used: 100, limit: 1000, remaining: 900 };
    next();
  })
}));

jest.mock('../../services/webhookService', () => ({
  trigger: jest.fn().mockResolvedValue({})
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const db = require('../../db');
const messagesRouter = require('../../routes/messages');
const webhookService = require('../../services/webhookService');
const log = require('../../utils/logger');

const app = express();
app.use(express.json());
app.use('/api/messages', messagesRouter);

describe('Messages Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/messages - Create Message', () => {
    describe('Successful Creation', () => {
      it('should create message successfully with all fields', async () => {
        const mockMessage = {
          id: 1,
          bot_id: 1,
          message_type: 'greeting',
          content: 'Hello! Welcome to our bot.',
          trigger_keywords: 'hi,hello,hey',
          organization_id: 1,
          created_at: new Date(),
          updated_at: new Date()
        };

        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Bot verification
          .mockResolvedValueOnce({ rows: [mockMessage] }) // Insert message
          .mockResolvedValueOnce({ rows: [] }); // Usage tracking

        const response = await request(app)
          .post('/api/messages')
          .send({
            bot_id: 1,
            message_type: 'greeting',
            content: 'Hello! Welcome to our bot.',
            trigger_keywords: 'hi,hello,hey'
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Message created successfully!');
        expect(response.body.data).toMatchObject({
          id: 1,
          bot_id: 1,
          message_type: 'greeting',
          content: 'Hello! Welcome to our bot.',
          trigger_keywords: 'hi,hello,hey'
        });
        expect(response.body.usage).toBeDefined();
      });

      it('should create message without trigger_keywords', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{
            id: 2,
            bot_id: 1,
            message_type: 'fallback',
            content: 'I did not understand that.',
            trigger_keywords: null,
            organization_id: 1
          }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .post('/api/messages')
          .send({
            bot_id: 1,
            message_type: 'fallback',
            content: 'I did not understand that.'
          });

        expect(response.status).toBe(201);
        expect(response.body.data.trigger_keywords).toBeNull();
      });

      it('should create greeting type message', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 3, message_type: 'greeting' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .post('/api/messages')
          .send({
            bot_id: 1,
            message_type: 'greeting',
            content: 'Hi there!'
          });

        expect(response.status).toBe(201);
        expect(response.body.data.message_type).toBe('greeting');
      });

      it('should create response type message', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 4, message_type: 'response' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .post('/api/messages')
          .send({
            bot_id: 1,
            message_type: 'response',
            content: 'Here is the information you requested.'
          });

        expect(response.status).toBe(201);
        expect(response.body.data.message_type).toBe('response');
      });

      it('should create command type message', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 5, message_type: 'command' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .post('/api/messages')
          .send({
            bot_id: 1,
            message_type: 'command',
            content: '/help - Show available commands'
          });

        expect(response.status).toBe(201);
        expect(response.body.data.message_type).toBe('command');
      });

      it('should create help type message', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 6, message_type: 'help' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .post('/api/messages')
          .send({
            bot_id: 1,
            message_type: 'help',
            content: 'Need help? Contact support.'
          });

        expect(response.status).toBe(201);
        expect(response.body.data.message_type).toBe('help');
      });

      it('should normalize message_type to lowercase', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 7, message_type: 'greeting' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .post('/api/messages')
          .send({
            bot_id: 1,
            message_type: 'GREETING',
            content: 'Hello!'
          });

        expect(response.status).toBe(201);
        expect(response.body.data.message_type).toBe('greeting');
      });

      it('should trim content and trigger_keywords', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{
            id: 8,
            content: 'Trimmed content',
            trigger_keywords: 'trimmed,keywords'
          }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .post('/api/messages')
          .send({
            bot_id: 1,
            message_type: 'greeting',
            content: '  Trimmed content  ',
            trigger_keywords: '  trimmed,keywords  '
          });

        expect(response.status).toBe(201);
      });

      it('should trigger webhook on message creation', async () => {
        const mockMessage = {
          id: 9,
          bot_id: 1,
          message_type: 'greeting',
          content: 'Test',
          trigger_keywords: null,
          created_at: new Date()
        };

        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [mockMessage] })
          .mockResolvedValueOnce({ rows: [] });

        await request(app)
          .post('/api/messages')
          .send({
            bot_id: 1,
            message_type: 'greeting',
            content: 'Test'
          });

        expect(webhookService.trigger).toHaveBeenCalledWith(
          1,
          'message.received',
          expect.objectContaining({
            message_id: 9,
            bot_id: 1,
            message_type: 'greeting',
            content: 'Test'
          })
        );
      });

      it('should increment message usage count', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 10 }] })
          .mockResolvedValueOnce({ rows: [] });

        await request(app)
          .post('/api/messages')
          .send({
            bot_id: 1,
            message_type: 'greeting',
            content: 'Test'
          });

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO message_usage'),
          [1]
        );
      });
    });

    describe('Validation Errors', () => {
      it('should reject missing bot_id', async () => {
        const response = await request(app)
          .post('/api/messages')
          .send({
            message_type: 'greeting',
            content: 'Hello!'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Bot ID is required');
      });

      it('should reject missing message_type', async () => {
        const response = await request(app)
          .post('/api/messages')
          .send({
            bot_id: 1,
            content: 'Hello!'
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Message type is required');
      });

      it('should reject empty message_type', async () => {
        const response = await request(app)
          .post('/api/messages')
          .send({
            bot_id: 1,
            message_type: '   ',
            content: 'Hello!'
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Message type is required');
      });

      it('should reject missing content', async () => {
        const response = await request(app)
          .post('/api/messages')
          .send({
            bot_id: 1,
            message_type: 'greeting'
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Message content is required');
      });

      it('should reject empty content', async () => {
        const response = await request(app)
          .post('/api/messages')
          .send({
            bot_id: 1,
            message_type: 'greeting',
            content: '   '
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Message content is required');
      });

      it('should reject invalid message_type', async () => {
        const response = await request(app)
          .post('/api/messages')
          .send({
            bot_id: 1,
            message_type: 'invalid_type',
            content: 'Hello!'
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid message type');
        expect(response.body.message).toContain('greeting, response, fallback, command, help');
      });

      it('should reject bot not in organization', async () => {
        db.query.mockResolvedValueOnce({ rows: [] }); // Bot not found

        const response = await request(app)
          .post('/api/messages')
          .send({
            bot_id: 999,
            message_type: 'greeting',
            content: 'Hello!'
          });

        expect(response.status).toBe(404);
        expect(response.body.message).toContain('Bot not found or not accessible in this organization');
      });
    });

    describe('Database Errors', () => {
      it('should handle foreign key constraint error', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockRejectedValueOnce({ code: '23503' });

        const response = await request(app)
          .post('/api/messages')
          .send({
            bot_id: 1,
            message_type: 'greeting',
            content: 'Hello!'
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Invalid bot_id');
      });

      it('should handle generic database error', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockRejectedValueOnce(new Error('Database connection failed'));

        const response = await request(app)
          .post('/api/messages')
          .send({
            bot_id: 1,
            message_type: 'greeting',
            content: 'Hello!'
          });

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to create message');
        expect(log.error).toHaveBeenCalled();
      });

      it('should continue on usage tracking error', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 11 }] })
          .mockRejectedValueOnce(new Error('Usage tracking failed'));

        const response = await request(app)
          .post('/api/messages')
          .send({
            bot_id: 1,
            message_type: 'greeting',
            content: 'Hello!'
          });

        expect(response.status).toBe(201);
        expect(log.error).toHaveBeenCalledWith(
          '[Message Usage] Failed to increment count:',
          expect.objectContaining({ error: 'Usage tracking failed' })
        );
      });
    });
  });

  describe('GET /api/messages/bot/:botId - List Messages', () => {
    describe('Without Pagination', () => {
      it('should return all messages for bot', async () => {
        const mockMessages = [
          { id: 1, message_type: 'greeting', content: 'Hello!', bot_id: 1 },
          { id: 2, message_type: 'response', content: 'OK', bot_id: 1 },
          { id: 3, message_type: 'fallback', content: 'Sorry?', bot_id: 1 }
        ];

        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Bot verification
          .mockResolvedValueOnce({ rows: mockMessages });

        const response = await request(app).get('/api/messages/bot/1');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Messages retrieved successfully');
        expect(response.body.data).toHaveLength(3);
        expect(response.body.total).toBe(3);
        expect(response.body.pagination).toBeUndefined();
      });

      it('should return empty array if no messages', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/messages/bot/1');

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(0);
        expect(response.body.total).toBe(0);
      });
    });

    describe('With Pagination', () => {
      it('should return paginated messages', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ count: '50' }] }) // Total count
          .mockResolvedValueOnce({ rows: [
            { id: 1, content: 'Message 1' },
            { id: 2, content: 'Message 2' }
          ] });

        const response = await request(app).get('/api/messages/bot/1?page=1&limit=10');

        expect(response.status).toBe(200);
        expect(response.body.pagination).toBeDefined();
        expect(response.body.pagination.page).toBe(1);
        expect(response.body.pagination.limit).toBe(10);
        expect(response.body.pagination.total).toBe(50);
        expect(response.body.pagination.totalPages).toBe(5);
        expect(response.body.pagination.hasNext).toBe(true);
        expect(response.body.pagination.hasPrev).toBe(false);
      });

      it('should handle page 2 correctly', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ count: '50' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/messages/bot/1?page=2&limit=10');

        expect(response.status).toBe(200);
        expect(response.body.pagination.page).toBe(2);
        expect(response.body.pagination.hasNext).toBe(true);
        expect(response.body.pagination.hasPrev).toBe(true);
      });

      it('should handle last page correctly', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ count: '50' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/messages/bot/1?page=5&limit=10');

        expect(response.status).toBe(200);
        expect(response.body.pagination.page).toBe(5);
        expect(response.body.pagination.hasNext).toBe(false);
        expect(response.body.pagination.hasPrev).toBe(true);
      });

      it('should default to page 1 if invalid page', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ count: '10' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/messages/bot/1?page=0&limit=10');

        expect(response.status).toBe(200);
        expect(response.body.pagination.page).toBe(1);
      });

      it('should default to limit 10 if invalid limit', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ count: '10' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/messages/bot/1?page=1&limit=0');

        expect(response.status).toBe(200);
        expect(response.body.pagination.limit).toBe(10);
      });

      it('should enforce maximum limit of 100', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ count: '200' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/messages/bot/1?page=1&limit=200');

        expect(response.status).toBe(200);
        expect(response.body.pagination.limit).toBe(100);
      });

      it('should calculate correct offset', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ count: '100' }] })
          .mockResolvedValueOnce({ rows: [] });

        await request(app).get('/api/messages/bot/1?page=3&limit=20');

        const queryCall = db.query.mock.calls[2];
        expect(queryCall[1]).toEqual([1, 20, 40]); // offset = (3-1) * 20 = 40
      });

      it('should trigger pagination with only page parameter', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ count: '10' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/messages/bot/1?page=1');

        expect(response.status).toBe(200);
        expect(response.body.pagination).toBeDefined();
        expect(response.body.pagination.limit).toBe(10);
      });

      it('should trigger pagination with only limit parameter', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ count: '10' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/messages/bot/1?limit=5');

        expect(response.status).toBe(200);
        expect(response.body.pagination).toBeDefined();
        expect(response.body.pagination.page).toBe(1);
      });
    });

    describe('Validation Errors', () => {
      it('should reject invalid botId', async () => {
        const response = await request(app).get('/api/messages/bot/abc');

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid bot ID');
      });

      it('should return 404 if bot not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/messages/bot/999');

        expect(response.status).toBe(404);
        expect(response.body.message).toContain('Bot not found or not accessible in this organization');
      });
    });

    describe('Database Errors', () => {
      it('should handle database error', async () => {
        db.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app).get('/api/messages/bot/1');

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to retrieve messages');
        expect(log.error).toHaveBeenCalled();
      });
    });
  });

  describe('GET /api/messages/:id - Get Single Message', () => {
    describe('Successful Retrieval', () => {
      it('should return message details', async () => {
        const mockMessage = {
          id: 1,
          bot_id: 1,
          message_type: 'greeting',
          content: 'Hello! Welcome to our bot.',
          trigger_keywords: 'hi,hello',
          created_at: new Date(),
          updated_at: new Date()
        };

        db.query.mockResolvedValueOnce({ rows: [mockMessage] });

        const response = await request(app).get('/api/messages/1');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          id: 1,
          message_type: 'greeting',
          content: 'Hello! Welcome to our bot.'
        });
      });

      it('should include all message fields', async () => {
        db.query.mockResolvedValueOnce({ rows: [{
          id: 2,
          bot_id: 1,
          message_type: 'response',
          content: 'Test content',
          trigger_keywords: 'test',
          created_at: new Date(),
          updated_at: new Date()
        }] });

        const response = await request(app).get('/api/messages/2');

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveProperty('id');
        expect(response.body.data).toHaveProperty('bot_id');
        expect(response.body.data).toHaveProperty('message_type');
        expect(response.body.data).toHaveProperty('content');
        expect(response.body.data).toHaveProperty('trigger_keywords');
        expect(response.body.data).toHaveProperty('created_at');
        expect(response.body.data).toHaveProperty('updated_at');
      });
    });

    describe('Validation Errors', () => {
      it('should reject invalid message ID', async () => {
        const response = await request(app).get('/api/messages/abc');

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid message ID');
      });

      it('should return 404 if message not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/messages/999');

        expect(response.status).toBe(404);
        expect(response.body.message).toContain('Message not found or not accessible in this organization');
      });
    });

    describe('Database Errors', () => {
      it('should handle database error', async () => {
        db.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app).get('/api/messages/1');

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to retrieve message');
        expect(log.error).toHaveBeenCalled();
      });
    });
  });

  describe('PUT /api/messages/:id - Update Message', () => {
    describe('Successful Updates', () => {
      it('should update message content', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Check exists
          .mockResolvedValueOnce({ rows: [{
            id: 1,
            bot_id: 1,
            message_type: 'greeting',
            content: 'Updated content',
            trigger_keywords: null
          }] });

        const response = await request(app)
          .put('/api/messages/1')
          .send({ content: 'Updated content' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Message updated successfully!');
        expect(response.body.data.content).toBe('Updated content');
      });

      it('should update message_type', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{
            id: 1,
            message_type: 'response'
          }] });

        const response = await request(app)
          .put('/api/messages/1')
          .send({ message_type: 'response' });

        expect(response.status).toBe(200);
        expect(response.body.data.message_type).toBe('response');
      });

      it('should update trigger_keywords', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{
            id: 1,
            trigger_keywords: 'new,keywords'
          }] });

        const response = await request(app)
          .put('/api/messages/1')
          .send({ trigger_keywords: 'new,keywords' });

        expect(response.status).toBe(200);
        expect(response.body.data.trigger_keywords).toBe('new,keywords');
      });

      it('should update multiple fields', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{
            id: 1,
            message_type: 'help',
            content: 'New content',
            trigger_keywords: 'help,support'
          }] });

        const response = await request(app)
          .put('/api/messages/1')
          .send({
            message_type: 'help',
            content: 'New content',
            trigger_keywords: 'help,support'
          });

        expect(response.status).toBe(200);
        expect(response.body.data.message_type).toBe('help');
        expect(response.body.data.content).toBe('New content');
        expect(response.body.data.trigger_keywords).toBe('help,support');
      });

      it('should clear trigger_keywords with null', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{
            id: 1,
            trigger_keywords: null
          }] });

        const response = await request(app)
          .put('/api/messages/1')
          .send({ trigger_keywords: null });

        expect(response.status).toBe(200);
        expect(response.body.data.trigger_keywords).toBeNull();
      });

      it('should normalize message_type to lowercase', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, message_type: 'command' }] });

        const response = await request(app)
          .put('/api/messages/1')
          .send({ message_type: 'COMMAND' });

        expect(response.status).toBe(200);
      });

      it('should trim content', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, content: 'Trimmed' }] });

        await request(app)
          .put('/api/messages/1')
          .send({ content: '  Trimmed  ' });

        const updateCall = db.query.mock.calls[1];
        expect(updateCall[1]).toContain('Trimmed');
      });

      it('should trim trigger_keywords', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, trigger_keywords: 'key' }] });

        await request(app)
          .put('/api/messages/1')
          .send({ trigger_keywords: '  key  ' });

        const updateCall = db.query.mock.calls[1];
        expect(updateCall[1]).toContain('key');
      });
    });

    describe('Validation Errors', () => {
      it('should reject invalid message ID', async () => {
        const response = await request(app)
          .put('/api/messages/abc')
          .send({ content: 'Test' });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid message ID');
      });

      it('should return 404 if message not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .put('/api/messages/999')
          .send({ content: 'Test' });

        expect(response.status).toBe(404);
        expect(response.body.message).toContain('Message not found or not accessible in this organization');
      });

      it('should reject empty update', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

        const response = await request(app)
          .put('/api/messages/1')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('At least one field must be provided for update');
      });

      it('should reject invalid message_type', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

        const response = await request(app)
          .put('/api/messages/1')
          .send({ message_type: 'invalid_type' });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid message type');
      });

      it('should reject empty content', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

        const response = await request(app)
          .put('/api/messages/1')
          .send({ content: '   ' });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Message content cannot be empty');
      });
    });

    describe('Database Errors', () => {
      it('should handle database error', async () => {
        db.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .put('/api/messages/1')
          .send({ content: 'Test' });

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to update message');
        expect(log.error).toHaveBeenCalled();
      });
    });
  });

  describe('DELETE /api/messages/:id - Delete Message', () => {
    describe('Successful Deletion', () => {
      it('should delete message successfully', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ message_type: 'greeting' }] }) // Check exists
          .mockResolvedValueOnce({ rows: [] }); // Delete

        const response = await request(app).delete('/api/messages/1');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('deleted successfully');
        expect(response.body.deletedId).toBe(1);
      });

      it('should include message type in response', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ message_type: 'response' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app).delete('/api/messages/5');

        expect(response.status).toBe(200);
        expect(response.body.message).toContain('response');
      });

      it('should execute DELETE query', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ message_type: 'help' }] })
          .mockResolvedValueOnce({ rows: [] });

        await request(app).delete('/api/messages/10');

        expect(db.query).toHaveBeenCalledWith(
          'DELETE FROM bot_messages WHERE id = $1',
          [10]
        );
      });
    });

    describe('Validation Errors', () => {
      it('should reject invalid message ID', async () => {
        const response = await request(app).delete('/api/messages/abc');

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid message ID');
      });

      it('should return 404 if message not found', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app).delete('/api/messages/999');

        expect(response.status).toBe(404);
        expect(response.body.message).toContain('Message not found or not accessible in this organization');
      });
    });

    describe('Database Errors', () => {
      it('should handle database error on check', async () => {
        db.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app).delete('/api/messages/1');

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to delete message');
        expect(log.error).toHaveBeenCalled();
      });

      it('should handle database error on delete', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ message_type: 'greeting' }] })
          .mockRejectedValueOnce(new Error('Delete failed'));

        const response = await request(app).delete('/api/messages/1');

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to delete message');
      });
    });
  });

  describe('Authorization and Organization Context', () => {
    it('should verify bot belongs to organization on create', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .post('/api/messages')
        .send({
          bot_id: 1,
          message_type: 'greeting',
          content: 'Test'
        });

      expect(db.query).toHaveBeenCalledWith(
        'SELECT id FROM bots WHERE id = $1 AND organization_id = $2',
        [1, 1]
      );
    });

    it('should verify bot belongs to organization on list', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app).get('/api/messages/bot/1');

      expect(db.query).toHaveBeenCalledWith(
        'SELECT id FROM bots WHERE id = $1 AND organization_id = $2',
        [1, 1]
      );
    });

    it('should join with bots table on get message', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app).get('/api/messages/1');

      const query = db.query.mock.calls[0][0];
      expect(query).toContain('JOIN bots b ON bm.bot_id = b.id');
      expect(query).toContain('b.organization_id = $2');
    });

    it('should join with bots table on update message', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .put('/api/messages/1')
        .send({ content: 'Test' });

      const query = db.query.mock.calls[0][0];
      expect(query).toContain('JOIN bots b ON bm.bot_id = b.id');
      expect(query).toContain('b.organization_id = $2');
    });

    it('should join with bots table on delete message', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app).delete('/api/messages/1');

      const query = db.query.mock.calls[0][0];
      expect(query).toContain('JOIN bots b ON bm.bot_id = b.id');
      expect(query).toContain('b.organization_id = $2');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long content', async () => {
      const longContent = 'a'.repeat(5000);

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, content: longContent }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/messages')
        .send({
          bot_id: 1,
          message_type: 'greeting',
          content: longContent
        });

      expect(response.status).toBe(201);
    });

    it('should handle special characters in content', async () => {
      const specialContent = "Test with 'quotes' and \"double\" and <tags> and & symbols";

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, content: specialContent }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/messages')
        .send({
          bot_id: 1,
          message_type: 'greeting',
          content: specialContent
        });

      expect(response.status).toBe(201);
    });

    it('should handle unicode characters', async () => {
      const unicodeContent = '你好 🌟 Hello مرحبا';

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, content: unicodeContent }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/messages')
        .send({
          bot_id: 1,
          message_type: 'greeting',
          content: unicodeContent
        });

      expect(response.status).toBe(201);
    });

    it('should handle negative page numbers', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/messages/bot/1?page=-5&limit=10');

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1); // Should default to 1
    });

    it('should handle float values for pagination', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/messages/bot/1?page=2.5&limit=10.7');

      expect(response.status).toBe(200);
      expect(Number.isInteger(response.body.pagination.page)).toBe(true);
      expect(Number.isInteger(response.body.pagination.limit)).toBe(true);
    });
  });
});
