/**
 * Channels Routes Tests
 * Tests for server/routes/channels.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 1, email: 'test@example.com', current_organization_id: 1 };
  next();
}));

jest.mock('../../models/Channel', () => ({
  findByTenant: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  updateCredentials: jest.fn()
}));

jest.mock('../../models/ChannelMessage', () => ({
  countByChannel: jest.fn(),
  getConversations: jest.fn(),
  getStats: jest.fn()
}));

jest.mock('../../channels/core/ChannelManager', () => ({
  registerChannel: jest.fn(),
  sendMessage: jest.fn(),
  getChannelStats: jest.fn(),
  getMessageHistory: jest.fn(),
  getConversation: jest.fn(),
  getContacts: jest.fn()
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
const Channel = require('../../models/Channel');
const ChannelMessage = require('../../models/ChannelMessage');
const channelManager = require('../../channels/core/ChannelManager');
const channelsRouter = require('../../routes/channels');

const app = express();
app.use(express.json());
app.use('/api/channels', channelsRouter);

describe('Channels Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/channels', () => {
    it('should return all channels for tenant', async () => {
      // Route uses db.query directly with JOIN
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'WhatsApp', type: 'whatsapp', messageCount: '100', inboundCount: '60', outboundCount: '40' },
          { id: 2, name: 'Telegram', type: 'telegram', messageCount: '50', inboundCount: '30', outboundCount: '20' }
        ]
      });

      const response = await request(app).get('/api/channels');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].messageCount).toBe(100);
    });

    it('should filter by type', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'WhatsApp', type: 'whatsapp', messageCount: '100', inboundCount: '60', outboundCount: '40' }
        ]
      });

      const response = await request(app).get('/api/channels?type=whatsapp');

      expect(response.status).toBe(200);
      expect(db.query).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api/channels');

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Failed');
    });
  });

  describe('POST /api/channels', () => {
    it('should create channel', async () => {
      channelManager.registerChannel.mockResolvedValueOnce({
        id: 1,
        name: 'WhatsApp Business',
        type: 'whatsapp'
      });

      const response = await request(app)
        .post('/api/channels')
        .send({
          type: 'whatsapp',
          name: 'WhatsApp Business',
          credentials: { token: 'test' }
        });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('WhatsApp Business');
    });

    it('should reject missing type', async () => {
      const response = await request(app)
        .post('/api/channels')
        .send({ name: 'Test Channel' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Type and name');
    });

    it('should reject missing name', async () => {
      const response = await request(app)
        .post('/api/channels')
        .send({ type: 'whatsapp' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Type and name');
    });

    it('should reject invalid type', async () => {
      const response = await request(app)
        .post('/api/channels')
        .send({
          type: 'invalid',
          name: 'Test Channel'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid channel type');
    });
  });

  describe('GET /api/channels/:id', () => {
    it('should return channel details', async () => {
      Channel.findById.mockResolvedValueOnce({
        id: 1,
        name: 'WhatsApp',
        type: 'whatsapp',
        tenant_id: 1
      });
      channelManager.getChannelStats.mockResolvedValueOnce({ messages: 100 });

      const response = await request(app).get('/api/channels/1');

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('WhatsApp');
      expect(response.body.stats).toBeDefined();
    });

    it('should return 404 if not found', async () => {
      Channel.findById.mockResolvedValueOnce(null);

      const response = await request(app).get('/api/channels/999');

      expect(response.status).toBe(404);
    });

    it('should return 403 if different tenant', async () => {
      Channel.findById.mockResolvedValueOnce({
        id: 1,
        name: 'WhatsApp',
        tenant_id: 999 // Different tenant
      });

      const response = await request(app).get('/api/channels/1');

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Access denied');
    });
  });

  describe('PUT /api/channels/:id', () => {
    it('should update channel', async () => {
      Channel.findById.mockResolvedValueOnce({
        id: 1,
        name: 'Old Name',
        tenant_id: 1
      });
      Channel.update.mockResolvedValueOnce({
        id: 1,
        name: 'New Name'
      });

      const response = await request(app)
        .put('/api/channels/1')
        .send({ name: 'New Name' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('New Name');
    });

    it('should return 404 if not found', async () => {
      Channel.findById.mockResolvedValueOnce(null);

      const response = await request(app)
        .put('/api/channels/999')
        .send({ name: 'New Name' });

      expect(response.status).toBe(404);
    });

    it('should return 403 if different tenant', async () => {
      Channel.findById.mockResolvedValueOnce({
        id: 1,
        tenant_id: 999
      });

      const response = await request(app)
        .put('/api/channels/1')
        .send({ name: 'New Name' });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/channels/:id', () => {
    it('should delete channel', async () => {
      Channel.findById.mockResolvedValueOnce({
        id: 1,
        tenant_id: 1
      });
      Channel.delete.mockResolvedValueOnce(true);

      const response = await request(app).delete('/api/channels/1');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');
    });

    it('should return 404 if not found', async () => {
      Channel.findById.mockResolvedValueOnce(null);

      const response = await request(app).delete('/api/channels/999');

      expect(response.status).toBe(404);
    });

    it('should return 403 if different tenant', async () => {
      Channel.findById.mockResolvedValueOnce({
        id: 1,
        tenant_id: 999
      });

      const response = await request(app).delete('/api/channels/1');

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/channels/:id/send', () => {
    it('should send message', async () => {
      Channel.findById.mockResolvedValueOnce({
        id: 1,
        tenant_id: 1
      });
      channelManager.sendMessage.mockResolvedValueOnce({
        success: true,
        messageId: 'msg123'
      });

      const response = await request(app)
        .post('/api/channels/1/send')
        .send({
          to: '+1234567890',
          content: 'Hello!'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject missing recipient', async () => {
      Channel.findById.mockResolvedValueOnce({
        id: 1,
        tenant_id: 1
      });

      const response = await request(app)
        .post('/api/channels/1/send')
        .send({ content: 'Hello!' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Recipient');
    });

    it('should return 404 if channel not found', async () => {
      Channel.findById.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/channels/999/send')
        .send({ to: '+1234567890', content: 'Hello!' });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/channels/:id/messages', () => {
    it('should return message history', async () => {
      Channel.findById.mockResolvedValueOnce({
        id: 1,
        tenant_id: 1
      });
      channelManager.getMessageHistory.mockResolvedValueOnce([
        { id: 1, content: 'Hello' },
        { id: 2, content: 'Hi' }
      ]);

      const response = await request(app).get('/api/channels/1/messages');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('should return 404 if channel not found', async () => {
      Channel.findById.mockResolvedValueOnce(null);

      const response = await request(app).get('/api/channels/999/messages');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/channels/:id/conversations', () => {
    it('should return conversations', async () => {
      Channel.findById.mockResolvedValueOnce({
        id: 1,
        tenant_id: 1
      });
      ChannelMessage.getConversations.mockResolvedValueOnce([
        { contact: '+1234567890', lastMessage: 'Hello' }
      ]);

      const response = await request(app).get('/api/channels/1/conversations');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
    });
  });

  describe('GET /api/channels/:id/conversation/:contact', () => {
    it('should return conversation with contact', async () => {
      Channel.findById.mockResolvedValueOnce({
        id: 1,
        tenant_id: 1
      });
      channelManager.getConversation.mockResolvedValueOnce([
        { id: 1, content: 'Hello' }
      ]);

      const response = await request(app).get('/api/channels/1/conversation/1234567890');

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/channels/:id/templates', () => {
    it('should create template', async () => {
      Channel.findById.mockResolvedValueOnce({
        id: 1,
        tenant_id: 1
      });
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Welcome',
          content: 'Hello {{name}}'
        }]
      });

      const response = await request(app)
        .post('/api/channels/1/templates')
        .send({
          name: 'Welcome',
          content: 'Hello {{name}}'
        });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('Welcome');
    });

    it('should reject missing name or content', async () => {
      Channel.findById.mockResolvedValueOnce({
        id: 1,
        tenant_id: 1
      });

      const response = await request(app)
        .post('/api/channels/1/templates')
        .send({ name: 'Welcome' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Name and content');
    });
  });

  describe('GET /api/channels/:id/templates', () => {
    it('should return templates', async () => {
      Channel.findById.mockResolvedValueOnce({
        id: 1,
        tenant_id: 1
      });
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Welcome' },
          { id: 2, name: 'Goodbye' }
        ]
      });

      const response = await request(app).get('/api/channels/1/templates');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });
  });

  describe('GET /api/channels/:id/contacts', () => {
    it('should return contacts', async () => {
      Channel.findById.mockResolvedValueOnce({
        id: 1,
        tenant_id: 1
      });
      channelManager.getContacts.mockResolvedValueOnce([
        { phone: '+1234567890', name: 'John' }
      ]);

      const response = await request(app).get('/api/channels/1/contacts');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
    });
  });

  describe('GET /api/channels/:id/stats', () => {
    it('should return channel stats', async () => {
      Channel.findById.mockResolvedValueOnce({
        id: 1,
        tenant_id: 1
      });
      channelManager.getChannelStats.mockResolvedValueOnce({ messages: 100 });
      ChannelMessage.getStats.mockResolvedValueOnce([{ date: '2024-01-01', count: 50 }]);

      const response = await request(app).get('/api/channels/1/stats');

      expect(response.status).toBe(200);
      expect(response.body.summary).toBeDefined();
      expect(response.body.daily).toBeDefined();
    });
  });

  describe('POST /api/channels/test', () => {
    it('should reject missing type or credentials', async () => {
      const response = await request(app)
        .post('/api/channels/test')
        .send({ type: 'telegram' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Type and credentials');
    });

    it('should reject unsupported type', async () => {
      const response = await request(app)
        .post('/api/channels/test')
        .send({
          type: 'unknown',
          credentials: { token: 'test' }
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Unsupported');
    });

    it('should reject telegram without bot_token', async () => {
      const response = await request(app)
        .post('/api/channels/test')
        .send({
          type: 'telegram',
          credentials: {}
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Bot Token');
    });

    it('should reject whatsapp without required fields', async () => {
      const response = await request(app)
        .post('/api/channels/test')
        .send({
          type: 'whatsapp',
          credentials: {}
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Phone Number ID');
    });

    it('should reject instagram without required fields', async () => {
      const response = await request(app)
        .post('/api/channels/test')
        .send({
          type: 'instagram',
          credentials: {}
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Page ID');
    });

    it('should reject messenger without required fields', async () => {
      const response = await request(app)
        .post('/api/channels/test')
        .send({
          type: 'messenger',
          credentials: {}
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Page ID');
    });
  });

  describe('PUT /api/channels/:id/credentials', () => {
    it('should update credentials', async () => {
      Channel.findById.mockResolvedValueOnce({
        id: 1,
        tenant_id: 1
      });
      Channel.updateCredentials.mockResolvedValueOnce(true);

      const response = await request(app)
        .put('/api/channels/1/credentials')
        .send({ token: 'new_token' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('updated');
    });

    it('should return 404 if channel not found', async () => {
      Channel.findById.mockResolvedValueOnce(null);

      const response = await request(app)
        .put('/api/channels/999/credentials')
        .send({ token: 'new_token' });

      expect(response.status).toBe(404);
    });

    it('should return 403 if different tenant', async () => {
      Channel.findById.mockResolvedValueOnce({
        id: 1,
        tenant_id: 999
      });

      const response = await request(app)
        .put('/api/channels/1/credentials')
        .send({ token: 'new_token' });

      expect(response.status).toBe(403);
    });

    it('should handle errors', async () => {
      Channel.findById.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app)
        .put('/api/channels/1/credentials')
        .send({ token: 'new_token' });

      expect(response.status).toBe(500);
    });
  });

  describe('error handling', () => {
    it('should handle GET /api/channels/:id error', async () => {
      Channel.findById.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api/channels/1');

      expect(response.status).toBe(500);
    });

    it('should handle PUT /api/channels/:id error', async () => {
      Channel.findById.mockResolvedValueOnce({ id: 1, tenant_id: 1 });
      Channel.update.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app)
        .put('/api/channels/1')
        .send({ name: 'New Name' });

      expect(response.status).toBe(500);
    });

    it('should handle DELETE /api/channels/:id error', async () => {
      Channel.findById.mockResolvedValueOnce({ id: 1, tenant_id: 1 });
      Channel.delete.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).delete('/api/channels/1');

      expect(response.status).toBe(500);
    });

    it('should handle POST /api/channels error', async () => {
      channelManager.registerChannel.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app)
        .post('/api/channels')
        .send({ type: 'whatsapp', name: 'Test' });

      expect(response.status).toBe(500);
    });

    it('should handle POST /api/channels/:id/send error', async () => {
      Channel.findById.mockResolvedValueOnce({ id: 1, tenant_id: 1 });
      channelManager.sendMessage.mockRejectedValueOnce(new Error('Send failed'));

      const response = await request(app)
        .post('/api/channels/1/send')
        .send({ to: '+1234567890', content: 'Test' });

      expect(response.status).toBe(500);
    });

    it('should handle GET /api/channels/:id/messages error', async () => {
      Channel.findById.mockResolvedValueOnce({ id: 1, tenant_id: 1 });
      channelManager.getMessageHistory.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app).get('/api/channels/1/messages');

      expect(response.status).toBe(500);
    });

    it('should handle GET /api/channels/:id/conversations error', async () => {
      Channel.findById.mockResolvedValueOnce({ id: 1, tenant_id: 1 });
      ChannelMessage.getConversations.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app).get('/api/channels/1/conversations');

      expect(response.status).toBe(500);
    });

    it('should handle GET /api/channels/:id/conversation/:contact error', async () => {
      Channel.findById.mockResolvedValueOnce({ id: 1, tenant_id: 1 });
      channelManager.getConversation.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app).get('/api/channels/1/conversation/123');

      expect(response.status).toBe(500);
    });

    it('should handle POST /api/channels/:id/templates error', async () => {
      Channel.findById.mockResolvedValueOnce({ id: 1, tenant_id: 1 });
      db.query.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app)
        .post('/api/channels/1/templates')
        .send({ name: 'Test', content: 'Hello' });

      expect(response.status).toBe(500);
    });

    it('should handle GET /api/channels/:id/templates error', async () => {
      Channel.findById.mockResolvedValueOnce({ id: 1, tenant_id: 1 });
      db.query.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app).get('/api/channels/1/templates');

      expect(response.status).toBe(500);
    });

    it('should handle GET /api/channels/:id/contacts error', async () => {
      Channel.findById.mockResolvedValueOnce({ id: 1, tenant_id: 1 });
      channelManager.getContacts.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app).get('/api/channels/1/contacts');

      expect(response.status).toBe(500);
    });

    it('should handle GET /api/channels/:id/stats error', async () => {
      Channel.findById.mockResolvedValueOnce({ id: 1, tenant_id: 1 });
      channelManager.getChannelStats.mockRejectedValueOnce(new Error('Error'));

      const response = await request(app).get('/api/channels/1/stats');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/channels/:id/send with options', () => {
    it('should send message with media', async () => {
      Channel.findById.mockResolvedValueOnce({ id: 1, tenant_id: 1 });
      channelManager.sendMessage.mockResolvedValueOnce({
        success: true,
        messageId: 'msg123'
      });

      const response = await request(app)
        .post('/api/channels/1/send')
        .send({
          to: '+1234567890',
          type: 'image',
          mediaUrl: 'https://example.com/image.jpg',
          caption: 'Test image'
        });

      expect(response.status).toBe(200);
      expect(channelManager.sendMessage).toHaveBeenCalledWith(1, expect.objectContaining({
        type: 'image',
        mediaUrl: 'https://example.com/image.jpg',
        caption: 'Test image'
      }));
    });

    it('should send message with template', async () => {
      Channel.findById.mockResolvedValueOnce({ id: 1, tenant_id: 1 });
      channelManager.sendMessage.mockResolvedValueOnce({
        success: true,
        messageId: 'msg123'
      });

      const response = await request(app)
        .post('/api/channels/1/send')
        .send({
          to: '+1234567890',
          templateName: 'welcome',
          templateLanguage: 'en',
          templateVariables: ['John']
        });

      expect(response.status).toBe(200);
    });

    it('should send message with replyToId', async () => {
      Channel.findById.mockResolvedValueOnce({ id: 1, tenant_id: 1 });
      channelManager.sendMessage.mockResolvedValueOnce({
        success: true,
        messageId: 'msg123'
      });

      const response = await request(app)
        .post('/api/channels/1/send')
        .send({
          to: '+1234567890',
          content: 'Reply message',
          replyToId: 'original_msg_id'
        });

      expect(response.status).toBe(200);
    });

    it('should return 403 if different tenant', async () => {
      Channel.findById.mockResolvedValueOnce({ id: 1, tenant_id: 999 });

      const response = await request(app)
        .post('/api/channels/1/send')
        .send({ to: '+1234567890', content: 'Test' });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/channels/:id/messages with filters', () => {
    it('should filter messages by conversation_id', async () => {
      Channel.findById.mockResolvedValueOnce({ id: 1, tenant_id: 1 });
      channelManager.getMessageHistory.mockResolvedValueOnce([]);

      await request(app).get('/api/channels/1/messages?conversation_id=conv123');

      expect(channelManager.getMessageHistory).toHaveBeenCalledWith(1, expect.objectContaining({
        conversationId: 'conv123'
      }));
    });

    it('should filter messages by direction', async () => {
      Channel.findById.mockResolvedValueOnce({ id: 1, tenant_id: 1 });
      channelManager.getMessageHistory.mockResolvedValueOnce([]);

      await request(app).get('/api/channels/1/messages?direction=inbound');

      expect(channelManager.getMessageHistory).toHaveBeenCalledWith(1, expect.objectContaining({
        direction: 'inbound'
      }));
    });

    it('should filter messages by date range', async () => {
      Channel.findById.mockResolvedValueOnce({ id: 1, tenant_id: 1 });
      channelManager.getMessageHistory.mockResolvedValueOnce([]);

      await request(app).get('/api/channels/1/messages?start_date=2024-01-01&end_date=2024-12-31');

      expect(channelManager.getMessageHistory).toHaveBeenCalledWith(1, expect.objectContaining({
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      }));
    });

    it('should return 403 if different tenant', async () => {
      Channel.findById.mockResolvedValueOnce({ id: 1, tenant_id: 999 });

      const response = await request(app).get('/api/channels/1/messages');

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/channels/:id/conversations pagination', () => {
    it('should pass limit and offset', async () => {
      Channel.findById.mockResolvedValueOnce({ id: 1, tenant_id: 1 });
      ChannelMessage.getConversations.mockResolvedValueOnce([]);

      await request(app).get('/api/channels/1/conversations?limit=20&offset=10');

      expect(ChannelMessage.getConversations).toHaveBeenCalledWith(1, 20, 10);
    });

    it('should return 404 if channel not found', async () => {
      Channel.findById.mockResolvedValueOnce(null);

      const response = await request(app).get('/api/channels/999/conversations');

      expect(response.status).toBe(404);
    });

    it('should return 403 if different tenant', async () => {
      Channel.findById.mockResolvedValueOnce({ id: 1, tenant_id: 999 });

      const response = await request(app).get('/api/channels/1/conversations');

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/channels/:id/conversation/:contact edge cases', () => {
    it('should pass custom limit', async () => {
      Channel.findById.mockResolvedValueOnce({ id: 1, tenant_id: 1 });
      channelManager.getConversation.mockResolvedValueOnce([]);

      await request(app).get('/api/channels/1/conversation/123456?limit=100');

      expect(channelManager.getConversation).toHaveBeenCalledWith(1, '123456', 100);
    });

    it('should return 404 if channel not found', async () => {
      Channel.findById.mockResolvedValueOnce(null);

      const response = await request(app).get('/api/channels/999/conversation/123');

      expect(response.status).toBe(404);
    });

    it('should return 403 if different tenant', async () => {
      Channel.findById.mockResolvedValueOnce({ id: 1, tenant_id: 999 });

      const response = await request(app).get('/api/channels/1/conversation/123');

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/channels/:id/templates edge cases', () => {
    it('should create template with all fields', async () => {
      Channel.findById.mockResolvedValueOnce({ id: 1, tenant_id: 1 });
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Welcome',
          language: 'en',
          category: 'marketing',
          content: 'Hello {{name}}',
          header_type: 'text',
          header_content: 'Header',
          footer: 'Footer text',
          buttons: [{ type: 'quick_reply', text: 'Yes' }],
          variables: ['name']
        }]
      });

      const response = await request(app)
        .post('/api/channels/1/templates')
        .send({
          name: 'Welcome',
          language: 'en',
          category: 'marketing',
          content: 'Hello {{name}}',
          header_type: 'text',
          header_content: 'Header',
          footer: 'Footer text',
          buttons: [{ type: 'quick_reply', text: 'Yes' }],
          variables: ['name']
        });

      expect(response.status).toBe(201);
    });

    it('should return 404 if channel not found', async () => {
      Channel.findById.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/channels/999/templates')
        .send({ name: 'Test', content: 'Hello' });

      expect(response.status).toBe(404);
    });

    it('should return 403 if different tenant', async () => {
      Channel.findById.mockResolvedValueOnce({ id: 1, tenant_id: 999 });

      const response = await request(app)
        .post('/api/channels/1/templates')
        .send({ name: 'Test', content: 'Hello' });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/channels/:id/templates edge cases', () => {
    it('should return 404 if channel not found', async () => {
      Channel.findById.mockResolvedValueOnce(null);

      const response = await request(app).get('/api/channels/999/templates');

      expect(response.status).toBe(404);
    });

    it('should return 403 if different tenant', async () => {
      Channel.findById.mockResolvedValueOnce({ id: 1, tenant_id: 999 });

      const response = await request(app).get('/api/channels/1/templates');

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/channels/:id/contacts with search', () => {
    it('should pass search parameter', async () => {
      Channel.findById.mockResolvedValueOnce({ id: 1, tenant_id: 1 });
      channelManager.getContacts.mockResolvedValueOnce([]);

      await request(app).get('/api/channels/1/contacts?search=john&limit=10&offset=5');

      expect(channelManager.getContacts).toHaveBeenCalledWith(1, expect.objectContaining({
        search: 'john',
        limit: 10,
        offset: 5
      }));
    });

    it('should return 404 if channel not found', async () => {
      Channel.findById.mockResolvedValueOnce(null);

      const response = await request(app).get('/api/channels/999/contacts');

      expect(response.status).toBe(404);
    });

    it('should return 403 if different tenant', async () => {
      Channel.findById.mockResolvedValueOnce({ id: 1, tenant_id: 999 });

      const response = await request(app).get('/api/channels/1/contacts');

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/channels/:id/stats with period', () => {
    it('should pass period parameter', async () => {
      Channel.findById.mockResolvedValueOnce({ id: 1, tenant_id: 1 });
      channelManager.getChannelStats.mockResolvedValueOnce({ messages: 100 });
      ChannelMessage.getStats.mockResolvedValueOnce([]);

      await request(app).get('/api/channels/1/stats?period=7d');

      expect(channelManager.getChannelStats).toHaveBeenCalledWith(1, '7d');
    });

    it('should return 404 if channel not found', async () => {
      Channel.findById.mockResolvedValueOnce(null);

      const response = await request(app).get('/api/channels/999/stats');

      expect(response.status).toBe(404);
    });

    it('should return 403 if different tenant', async () => {
      Channel.findById.mockResolvedValueOnce({ id: 1, tenant_id: 999 });

      const response = await request(app).get('/api/channels/1/stats');

      expect(response.status).toBe(403);
    });
  });

  describe('channel types', () => {
    it('should create instagram channel', async () => {
      channelManager.registerChannel.mockResolvedValueOnce({
        id: 1,
        name: 'Instagram Business',
        type: 'instagram'
      });

      const response = await request(app)
        .post('/api/channels')
        .send({
          type: 'instagram',
          name: 'Instagram Business',
          credentials: { page_id: '123', access_token: 'token' }
        });

      expect(response.status).toBe(201);
    });

    it('should create telegram channel', async () => {
      channelManager.registerChannel.mockResolvedValueOnce({
        id: 1,
        name: 'Telegram Bot',
        type: 'telegram'
      });

      const response = await request(app)
        .post('/api/channels')
        .send({
          type: 'telegram',
          name: 'Telegram Bot',
          credentials: { bot_token: 'token' }
        });

      expect(response.status).toBe(201);
    });

    it('should create messenger channel', async () => {
      channelManager.registerChannel.mockResolvedValueOnce({
        id: 1,
        name: 'Messenger',
        type: 'messenger'
      });

      const response = await request(app)
        .post('/api/channels')
        .send({
          type: 'messenger',
          name: 'Messenger',
          credentials: { page_id: '123', access_token: 'token' }
        });

      expect(response.status).toBe(201);
    });

    it('should create sms channel', async () => {
      channelManager.registerChannel.mockResolvedValueOnce({
        id: 1,
        name: 'SMS',
        type: 'sms'
      });

      const response = await request(app)
        .post('/api/channels')
        .send({
          type: 'sms',
          name: 'SMS',
          credentials: { account_sid: 'sid', auth_token: 'token' }
        });

      expect(response.status).toBe(201);
    });
  });
});
