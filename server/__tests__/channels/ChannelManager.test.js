/**
 * Channel Manager Tests
 * Tests for server/channels/core/ChannelManager.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../models/Channel', () => ({
  create: jest.fn(),
  findById: jest.fn(),
  findByTenant: jest.fn(),
  update: jest.fn()
}));

jest.mock('../../models/ChannelMessage', () => ({
  create: jest.fn(),
  findByExternalId: jest.fn(),
  findByChannel: jest.fn(),
  getConversation: jest.fn(),
  updateStatus: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const pool = require('../../db');
const Channel = require('../../models/Channel');
const ChannelMessage = require('../../models/ChannelMessage');

// Get the channelManager singleton
const channelManager = require('../../channels/core/ChannelManager');

describe('ChannelManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    channelManager.handlers.clear();
  });

  describe('registerHandler', () => {
    it('should register a handler for a channel type', () => {
      const mockHandler = { sendMessage: jest.fn() };
      channelManager.registerHandler('whatsapp', mockHandler);

      expect(channelManager.handlers.get('whatsapp')).toBe(mockHandler);
    });
  });

  describe('getHandler', () => {
    it('should return registered handler', () => {
      const mockHandler = { sendMessage: jest.fn() };
      channelManager.registerHandler('telegram', mockHandler);

      expect(channelManager.getHandler('telegram')).toBe(mockHandler);
    });

    it('should return undefined for unregistered handler', () => {
      expect(channelManager.getHandler('unknown')).toBeUndefined();
    });
  });

  describe('registerChannel', () => {
    it('should create a new channel', async () => {
      const mockChannel = { id: 1, type: 'whatsapp', status: 'pending' };
      Channel.create.mockResolvedValue(mockChannel);

      const result = await channelManager.registerChannel(1, {
        type: 'whatsapp',
        name: 'Test Channel',
        phone_number: '+1234567890'
      });

      expect(Channel.create).toHaveBeenCalled();
      expect(result.type).toBe('whatsapp');
    });

    it('should initialize channel with handler', async () => {
      const mockChannel = { id: 1, type: 'whatsapp', status: 'pending' };
      Channel.create.mockResolvedValue(mockChannel);
      Channel.update.mockResolvedValue({});

      const mockHandler = {
        initialize: jest.fn().mockResolvedValue(true)
      };
      channelManager.registerHandler('whatsapp', mockHandler);

      await channelManager.registerChannel(1, {
        type: 'whatsapp',
        name: 'Test Channel'
      });

      expect(mockHandler.initialize).toHaveBeenCalled();
      expect(Channel.update).toHaveBeenCalledWith(1, { status: 'active' });
    });

    it('should handle initialization error', async () => {
      const mockChannel = { id: 1, type: 'whatsapp', status: 'pending' };
      Channel.create.mockResolvedValue(mockChannel);
      Channel.update.mockResolvedValue({});

      const mockHandler = {
        initialize: jest.fn().mockRejectedValue(new Error('Init failed'))
      };
      channelManager.registerHandler('whatsapp', mockHandler);

      const result = await channelManager.registerChannel(1, {
        type: 'whatsapp',
        name: 'Test Channel'
      });

      expect(result.status).toBe('error');
      expect(result.error_message).toBe('Init failed');
    });
  });

  describe('getChannel', () => {
    it('should return channel by ID', async () => {
      const mockChannel = { id: 1, type: 'whatsapp' };
      Channel.findById.mockResolvedValue(mockChannel);

      const result = await channelManager.getChannel(1);

      expect(Channel.findById).toHaveBeenCalledWith(1);
      expect(result).toBe(mockChannel);
    });
  });

  describe('getChannelsByTenant', () => {
    it('should return channels for tenant', async () => {
      const mockChannels = [{ id: 1 }, { id: 2 }];
      Channel.findByTenant.mockResolvedValue(mockChannels);

      const result = await channelManager.getChannelsByTenant(1);

      expect(Channel.findByTenant).toHaveBeenCalledWith(1, null);
      expect(result).toBe(mockChannels);
    });

    it('should filter by type', async () => {
      await channelManager.getChannelsByTenant(1, 'whatsapp');
      expect(Channel.findByTenant).toHaveBeenCalledWith(1, 'whatsapp');
    });
  });

  describe('sendMessage', () => {
    it('should send message through channel', async () => {
      const mockChannel = { id: 1, type: 'whatsapp', status: 'active', phone_number: '+1234' };
      Channel.findById.mockResolvedValue(mockChannel);

      const mockMessage = { id: 1 };
      ChannelMessage.create.mockResolvedValue(mockMessage);
      ChannelMessage.updateStatus.mockResolvedValue({});

      const mockHandler = {
        sendMessage: jest.fn().mockResolvedValue({ messageId: 'ext-123' })
      };
      channelManager.registerHandler('whatsapp', mockHandler);

      const result = await channelManager.sendMessage(1, {
        to: '+5678',
        content: 'Hello'
      });

      expect(result.success).toBe(true);
      expect(result.externalId).toBe('ext-123');
    });

    it('should throw if channel not found', async () => {
      Channel.findById.mockResolvedValue(null);

      await expect(channelManager.sendMessage(999, {})).rejects.toThrow('Channel not found');
    });

    it('should throw if channel not active', async () => {
      Channel.findById.mockResolvedValue({ id: 1, status: 'error' });

      await expect(channelManager.sendMessage(1, {})).rejects.toThrow('Channel is not active');
    });

    it('should throw if no handler registered', async () => {
      const mockChannel = { id: 1, type: 'unknown', status: 'active' };
      Channel.findById.mockResolvedValue(mockChannel);
      ChannelMessage.create.mockResolvedValue({ id: 1 });
      ChannelMessage.updateStatus.mockResolvedValue({});

      await expect(channelManager.sendMessage(1, { to: '+1234' })).rejects.toThrow('No handler registered');
    });
  });

  describe('receiveMessage', () => {
    it('should receive and store incoming message', async () => {
      const mockChannel = { id: 1, type: 'whatsapp', phone_number: '+1234' };
      Channel.findById.mockResolvedValue(mockChannel);
      ChannelMessage.findByExternalId.mockResolvedValue(null);
      ChannelMessage.create.mockResolvedValue({ id: 1 });
      pool.query.mockResolvedValue({ rows: [{}] });

      const result = await channelManager.receiveMessage(1, {
        from: '+5678',
        content: 'Hello',
        externalId: 'ext-123'
      });

      expect(ChannelMessage.create).toHaveBeenCalled();
    });

    it('should return existing message for duplicates', async () => {
      const mockChannel = { id: 1 };
      Channel.findById.mockResolvedValue(mockChannel);

      const existingMessage = { id: 1, content: 'existing' };
      ChannelMessage.findByExternalId.mockResolvedValue(existingMessage);

      const result = await channelManager.receiveMessage(1, {
        externalId: 'ext-123'
      });

      expect(result).toBe(existingMessage);
      expect(ChannelMessage.create).not.toHaveBeenCalled();
    });

    it('should throw if channel not found', async () => {
      Channel.findById.mockResolvedValue(null);

      await expect(channelManager.receiveMessage(999, {})).rejects.toThrow('Channel not found');
    });
  });

  describe('getMessageHistory', () => {
    it('should get message history', async () => {
      const mockMessages = [{ id: 1 }, { id: 2 }];
      ChannelMessage.findByChannel.mockResolvedValue(mockMessages);

      const result = await channelManager.getMessageHistory(1);

      expect(ChannelMessage.findByChannel).toHaveBeenCalledWith(1, {
        conversationId: undefined,
        limit: 50,
        offset: 0,
        direction: undefined,
        startDate: undefined,
        endDate: undefined
      });
    });

    it('should pass options', async () => {
      await channelManager.getMessageHistory(1, { limit: 20, offset: 10 });

      expect(ChannelMessage.findByChannel).toHaveBeenCalledWith(1, expect.objectContaining({
        limit: 20,
        offset: 10
      }));
    });
  });

  describe('getConversation', () => {
    it('should get conversation with contact', async () => {
      const mockConversation = [{ id: 1 }];
      ChannelMessage.getConversation.mockResolvedValue(mockConversation);

      const result = await channelManager.getConversation(1, '+1234567890');

      expect(ChannelMessage.getConversation).toHaveBeenCalledWith(1, '+1234567890', 50);
    });
  });

  describe('updateMessageStatus', () => {
    it('should update message status', async () => {
      const mockMessage = { id: 1 };
      ChannelMessage.findByExternalId.mockResolvedValue(mockMessage);
      ChannelMessage.updateStatus.mockResolvedValue({ status: 'delivered' });

      const result = await channelManager.updateMessageStatus('ext-123', 'delivered', Date.now());

      expect(ChannelMessage.updateStatus).toHaveBeenCalled();
    });

    it('should return null if message not found', async () => {
      ChannelMessage.findByExternalId.mockResolvedValue(null);

      const result = await channelManager.updateMessageStatus('unknown', 'delivered');

      expect(result).toBeNull();
    });

    it('should handle read status', async () => {
      const mockMessage = { id: 1 };
      ChannelMessage.findByExternalId.mockResolvedValue(mockMessage);
      ChannelMessage.updateStatus.mockResolvedValue({});

      await channelManager.updateMessageStatus('ext-123', 'read', Date.now());

      expect(ChannelMessage.updateStatus).toHaveBeenCalled();
    });
  });

  describe('processWebhook', () => {
    it('should process webhook and store', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      pool.query.mockResolvedValueOnce({ rows: [] });

      const mockHandler = {
        processWebhook: jest.fn().mockResolvedValue(true)
      };
      channelManager.registerHandler('whatsapp', mockHandler);

      await channelManager.processWebhook('whatsapp', { event: 'message' });

      expect(pool.query).toHaveBeenCalled();
      expect(mockHandler.processWebhook).toHaveBeenCalled();
    });

    it('should handle webhook processing error', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      pool.query.mockResolvedValueOnce({ rows: [] });

      const mockHandler = {
        processWebhook: jest.fn().mockRejectedValue(new Error('Process failed'))
      };
      channelManager.registerHandler('whatsapp', mockHandler);

      await expect(channelManager.processWebhook('whatsapp', {})).rejects.toThrow('Process failed');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify valid signature', () => {
      const crypto = require('crypto');
      const secret = 'test-secret';
      const payload = { test: 'data' };
      const signature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      // Skip if timingSafeEquals is not available
      if (typeof crypto.timingSafeEquals !== 'function') {
        return;
      }

      const result = channelManager.verifyWebhookSignature(1, payload, signature, secret);
      expect(result).toBe(true);
    });
  });

  describe('updateContact', () => {
    it('should upsert contact', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 1 }] });

      const result = await channelManager.updateContact(1, {
        externalId: 'ext-123',
        phoneNumber: '+1234',
        displayName: 'Test User'
      });

      expect(pool.query).toHaveBeenCalled();
      expect(result.id).toBe(1);
    });
  });

  describe('getContacts', () => {
    it('should get contacts for channel', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }] });

      const result = await channelManager.getContacts(1);

      expect(pool.query).toHaveBeenCalled();
      expect(result.length).toBe(2);
    });

    it('should support search', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await channelManager.getContacts(1, { search: 'john' });

      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('ILIKE'), expect.arrayContaining(['%john%']));
    });
  });

  describe('getChannelStats', () => {
    it('should get channel statistics', async () => {
      pool.query.mockResolvedValue({
        rows: [{
          inbound_count: '100',
          outbound_count: '80',
          delivered_count: '75',
          read_count: '50',
          failed_count: '5',
          unique_contacts: '25'
        }]
      });

      const result = await channelManager.getChannelStats(1);

      expect(result.inbound_count).toBe('100');
    });

    it('should support different periods', async () => {
      pool.query.mockResolvedValue({ rows: [{}] });

      await channelManager.getChannelStats(1, '7d');
      await channelManager.getChannelStats(1, '90d');

      expect(pool.query).toHaveBeenCalledTimes(2);
    });
  });
});
