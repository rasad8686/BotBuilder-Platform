/**
 * Channels API Tests - Real Route Coverage
 * Tests for /api/channels endpoints: WhatsApp, Instagram, Telegram
 * Uses actual route handlers for code coverage
 */

const request = require('supertest');
const express = require('express');

// ========================================
// MOCKS - Must be defined BEFORE imports
// ========================================

// Mock the database
jest.mock('../db', () => ({
  query: jest.fn(),
  pool: { query: jest.fn() }
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  http: jest.fn()
}));

// Mock Channel model
jest.mock('../models/Channel', () => ({
  findByTenant: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
}));

// Mock ChannelMessage model
jest.mock('../models/ChannelMessage', () => ({
  countByChannel: jest.fn().mockResolvedValue({ total: 100, inbound: 60, outbound: 40 }),
  findByChannel: jest.fn(),
  create: jest.fn()
}));

// Mock channelManager
jest.mock('../channels/core/ChannelManager', () => ({
  registerChannel: jest.fn(),
  sendMessage: jest.fn(),
  getChannelStats: jest.fn().mockResolvedValue({ total: 100, today: 10 }),
  updateChannel: jest.fn(),
  deactivateChannel: jest.fn()
}));

// Mock authentication middleware
jest.mock('../middleware/auth', () => {
  return jest.fn((req, res, next) => {
    req.user = {
      id: 1,
      email: 'test@example.com',
      username: 'testuser',
      current_organization_id: 1,
      organization_id: 1
    };
    next();
  });
});

// ========================================
// NOW import the actual routes
// ========================================
const db = require('../db');
const Channel = require('../models/Channel');
const ChannelMessage = require('../models/ChannelMessage');
const channelManager = require('../channels/core/ChannelManager');
const channelsRouter = require('../routes/channels');

// Create test app with REAL routes
const app = express();
app.use(express.json());
app.use('/api/channels', channelsRouter);

// ========================================
// TEST SUITES
// ========================================

describe('Channels API - Real Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // GET /api/channels - List all channels
  // ========================================
  describe('GET /api/channels', () => {
    it('should return all channels for tenant', async () => {
      const mockChannels = [
        { id: 1, type: 'whatsapp', name: 'WhatsApp 1' },
        { id: 2, type: 'instagram', name: 'Instagram 1' }
      ];
      Channel.findByTenant.mockResolvedValueOnce(mockChannels);

      const res = await request(app).get('/api/channels');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].messageCount).toBe(100);
    });

    it('should filter by type', async () => {
      const mockChannels = [{ id: 1, type: 'whatsapp', name: 'WhatsApp 1' }];
      Channel.findByTenant.mockResolvedValueOnce(mockChannels);

      const res = await request(app).get('/api/channels?type=whatsapp');

      expect(res.status).toBe(200);
      expect(Channel.findByTenant).toHaveBeenCalledWith(1, 'whatsapp');
    });

    it('should return empty array if no channels', async () => {
      Channel.findByTenant.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/channels');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it('should handle database error', async () => {
      Channel.findByTenant.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/channels');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to fetch channels');
    });
  });

  // ========================================
  // POST /api/channels - Create channel
  // ========================================
  describe('POST /api/channels', () => {
    it('should create channel successfully', async () => {
      const newChannel = { id: 1, type: 'whatsapp', name: 'New WhatsApp' };
      channelManager.registerChannel.mockResolvedValueOnce(newChannel);

      const res = await request(app)
        .post('/api/channels')
        .send({ type: 'whatsapp', name: 'New WhatsApp', credentials: { token: 'abc' } });

      expect(res.status).toBe(201);
      expect(res.body.type).toBe('whatsapp');
    });

    it('should return 400 if type is missing', async () => {
      const res = await request(app)
        .post('/api/channels')
        .send({ name: 'Test Channel' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });

    it('should return 400 if name is missing', async () => {
      const res = await request(app)
        .post('/api/channels')
        .send({ type: 'whatsapp' });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid channel type', async () => {
      const res = await request(app)
        .post('/api/channels')
        .send({ type: 'invalid_type', name: 'Test' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid channel type');
    });

    it('should accept valid types (instagram)', async () => {
      channelManager.registerChannel.mockResolvedValueOnce({ id: 1, type: 'instagram' });

      const res = await request(app)
        .post('/api/channels')
        .send({ type: 'instagram', name: 'Instagram Channel' });

      expect(res.status).toBe(201);
    });

    it('should accept valid types (telegram)', async () => {
      channelManager.registerChannel.mockResolvedValueOnce({ id: 1, type: 'telegram' });

      const res = await request(app)
        .post('/api/channels')
        .send({ type: 'telegram', name: 'Telegram Channel' });

      expect(res.status).toBe(201);
    });

    it('should accept valid types (messenger)', async () => {
      channelManager.registerChannel.mockResolvedValueOnce({ id: 1, type: 'messenger' });

      const res = await request(app)
        .post('/api/channels')
        .send({ type: 'messenger', name: 'Messenger Channel' });

      expect(res.status).toBe(201);
    });

    it('should accept valid types (sms)', async () => {
      channelManager.registerChannel.mockResolvedValueOnce({ id: 1, type: 'sms' });

      const res = await request(app)
        .post('/api/channels')
        .send({ type: 'sms', name: 'SMS Channel' });

      expect(res.status).toBe(201);
    });

    it('should handle registration error', async () => {
      channelManager.registerChannel.mockRejectedValueOnce(new Error('Registration failed'));

      const res = await request(app)
        .post('/api/channels')
        .send({ type: 'whatsapp', name: 'Test' });

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // GET /api/channels/:id - Get single channel
  // ========================================
  describe('GET /api/channels/:id', () => {
    it('should return channel by ID', async () => {
      const mockChannel = { id: 1, type: 'whatsapp', name: 'WhatsApp 1', tenant_id: 1 };
      Channel.findById.mockResolvedValueOnce(mockChannel);

      const res = await request(app).get('/api/channels/1');

      expect(res.status).toBe(200);
      expect(res.body.type).toBe('whatsapp');
      expect(res.body.stats).toBeDefined();
    });

    it('should return 404 if channel not found', async () => {
      Channel.findById.mockResolvedValueOnce(null);

      const res = await request(app).get('/api/channels/999');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Channel not found');
    });

    it('should return 403 if channel belongs to different tenant', async () => {
      const mockChannel = { id: 1, type: 'whatsapp', tenant_id: 999 }; // Different tenant
      Channel.findById.mockResolvedValueOnce(mockChannel);

      const res = await request(app).get('/api/channels/1');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Access denied');
    });

    it('should handle database error', async () => {
      Channel.findById.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/channels/1');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to fetch channel');
    });
  });

  // ========================================
  // PUT /api/channels/:id - Update channel
  // ========================================
  describe('PUT /api/channels/:id', () => {
    it('should update channel successfully', async () => {
      const existingChannel = { id: 1, type: 'whatsapp', tenant_id: 1 };
      const updatedChannel = { id: 1, type: 'whatsapp', name: 'Updated Name' };

      Channel.findById.mockResolvedValueOnce(existingChannel);
      Channel.update.mockResolvedValueOnce(updatedChannel);

      const res = await request(app)
        .put('/api/channels/1')
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Name');
    });

    it('should return 404 if channel not found', async () => {
      Channel.findById.mockResolvedValueOnce(null);

      const res = await request(app)
        .put('/api/channels/999')
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
    });

    it('should return 403 if channel belongs to different tenant', async () => {
      const mockChannel = { id: 1, tenant_id: 999 };
      Channel.findById.mockResolvedValueOnce(mockChannel);

      const res = await request(app)
        .put('/api/channels/1')
        .send({ name: 'Updated' });

      expect(res.status).toBe(403);
    });

    it('should handle database error', async () => {
      Channel.findById.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .put('/api/channels/1')
        .send({ name: 'Updated' });

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // DELETE /api/channels/:id - Delete channel
  // ========================================
  describe('DELETE /api/channels/:id', () => {
    it('should delete channel successfully', async () => {
      const existingChannel = { id: 1, type: 'whatsapp', tenant_id: 1 };
      Channel.findById.mockResolvedValueOnce(existingChannel);
      Channel.delete.mockResolvedValueOnce(true);

      const res = await request(app).delete('/api/channels/1');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Channel deleted successfully');
    });

    it('should return 404 if channel not found', async () => {
      Channel.findById.mockResolvedValueOnce(null);

      const res = await request(app).delete('/api/channels/999');

      expect(res.status).toBe(404);
    });

    it('should return 403 if channel belongs to different tenant', async () => {
      const mockChannel = { id: 1, tenant_id: 999 };
      Channel.findById.mockResolvedValueOnce(mockChannel);

      const res = await request(app).delete('/api/channels/1');

      expect(res.status).toBe(403);
    });

    it('should handle database error', async () => {
      Channel.findById.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).delete('/api/channels/1');

      expect(res.status).toBe(500);
    });
  });
});

// ========================================
// EDGE CASES
// ========================================
describe('Channels Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Channel Creation', () => {
    it('should accept credentials object', async () => {
      channelManager.registerChannel.mockResolvedValueOnce({ id: 1, type: 'whatsapp' });

      const res = await request(app)
        .post('/api/channels')
        .send({
          type: 'whatsapp',
          name: 'WhatsApp',
          credentials: { token: 'test-token', phone: '+1234567890' }
        });

      expect(res.status).toBe(201);
    });

    it('should accept settings object', async () => {
      channelManager.registerChannel.mockResolvedValueOnce({ id: 1, type: 'whatsapp' });

      const res = await request(app)
        .post('/api/channels')
        .send({
          type: 'whatsapp',
          name: 'WhatsApp',
          settings: { autoReply: true, greetingMessage: 'Hello!' }
        });

      expect(res.status).toBe(201);
    });

    it('should accept phone_number', async () => {
      channelManager.registerChannel.mockResolvedValueOnce({ id: 1, type: 'whatsapp' });

      const res = await request(app)
        .post('/api/channels')
        .send({
          type: 'whatsapp',
          name: 'WhatsApp',
          phone_number: '+1234567890'
        });

      expect(res.status).toBe(201);
    });

    it('should accept username', async () => {
      channelManager.registerChannel.mockResolvedValueOnce({ id: 1, type: 'telegram' });

      const res = await request(app)
        .post('/api/channels')
        .send({
          type: 'telegram',
          name: 'Telegram',
          username: '@testbot'
        });

      expect(res.status).toBe(201);
    });
  });

  describe('Message Stats', () => {
    it('should include message stats in channel list', async () => {
      const mockChannels = [{ id: 1, type: 'whatsapp', name: 'WhatsApp' }];
      Channel.findByTenant.mockResolvedValueOnce(mockChannels);
      ChannelMessage.countByChannel.mockResolvedValueOnce({ total: 50, inbound: 30, outbound: 20 });

      const res = await request(app).get('/api/channels');

      expect(res.status).toBe(200);
      expect(res.body[0].messageCount).toBe(50);
      expect(res.body[0].inboundCount).toBe(30);
      expect(res.body[0].outboundCount).toBe(20);
    });
  });
});
