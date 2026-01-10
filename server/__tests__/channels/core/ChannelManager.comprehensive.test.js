/**
 * Comprehensive ChannelManager Tests
 * Tests for server/channels/core/ChannelManager.js
 *
 * Coverage includes:
 * - Handler registration and retrieval
 * - Channel registration and initialization
 * - Message sending and receiving
 * - Webhook processing
 * - Contact management
 * - Message history and conversations
 * - Error handling and recovery
 * - Channel statistics
 * - Webhook signature verification
 */

// Mock all dependencies BEFORE importing ChannelManager
jest.mock('../../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../../models/Channel', () => ({
  create: jest.fn(),
  findById: jest.fn(),
  findByTenant: jest.fn(),
  update: jest.fn()
}));

jest.mock('../../../models/ChannelMessage', () => ({
  create: jest.fn(),
  findByExternalId: jest.fn(),
  updateStatus: jest.fn(),
  findByChannel: jest.fn(),
  getConversation: jest.fn()
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const crypto = require('crypto');

// Mock crypto.timingSafeEquals for tests
if (!crypto.timingSafeEquals) {
  crypto.timingSafeEquals = jest.fn((a, b) => {
    if (a.length !== b.length) return false;
    return a.toString('hex') === b.toString('hex');
  });
}

const pool = require('../../../db');
const Channel = require('../../../models/Channel');
const ChannelMessage = require('../../../models/ChannelMessage');
const log = require('../../../utils/logger');

// Import ChannelManager after mocks
const ChannelManager = require('../../../channels/core/ChannelManager');

describe('ChannelManager', () => {
  let channelManager;

  beforeEach(() => {
    jest.clearAllMocks();
    // Create a fresh instance for each test
    const ChannelManagerClass = require('../../../channels/core/ChannelManager').constructor;
    channelManager = new ChannelManagerClass();
  });

  // ========================================
  // Constructor
  // ========================================
  describe('Constructor', () => {
    it('should initialize with empty handlers map', () => {
      expect(channelManager.handlers).toBeInstanceOf(Map);
      expect(channelManager.handlers.size).toBe(0);
    });

    it('should initialize with empty webhook processors map', () => {
      expect(channelManager.webhookProcessors).toBeInstanceOf(Map);
      expect(channelManager.webhookProcessors.size).toBe(0);
    });
  });

  // ========================================
  // Handler Registration - registerHandler()
  // ========================================
  describe('registerHandler()', () => {
    it('should register a handler for a channel type', () => {
      const mockHandler = { initialize: jest.fn(), sendMessage: jest.fn() };

      channelManager.registerHandler('whatsapp', mockHandler);

      expect(channelManager.handlers.has('whatsapp')).toBe(true);
      expect(channelManager.handlers.get('whatsapp')).toBe(mockHandler);
      expect(log.info).toHaveBeenCalledWith('Channel handler registered for: whatsapp');
    });

    it('should register handler for telegram', () => {
      const mockHandler = { initialize: jest.fn() };

      channelManager.registerHandler('telegram', mockHandler);

      expect(channelManager.handlers.has('telegram')).toBe(true);
    });

    it('should register handler for instagram', () => {
      const mockHandler = { sendMessage: jest.fn() };

      channelManager.registerHandler('instagram', mockHandler);

      expect(channelManager.handlers.get('instagram')).toBe(mockHandler);
    });

    it('should allow overwriting existing handler', () => {
      const handler1 = { version: 1 };
      const handler2 = { version: 2 };

      channelManager.registerHandler('whatsapp', handler1);
      channelManager.registerHandler('whatsapp', handler2);

      expect(channelManager.handlers.get('whatsapp')).toBe(handler2);
      expect(log.info).toHaveBeenCalledTimes(2);
    });

    it('should handle handler registration with empty object', () => {
      const mockHandler = {};

      channelManager.registerHandler('custom', mockHandler);

      expect(channelManager.handlers.get('custom')).toBe(mockHandler);
    });
  });

  // ========================================
  // Handler Retrieval - getHandler()
  // ========================================
  describe('getHandler()', () => {
    it('should return registered handler', () => {
      const mockHandler = { initialize: jest.fn() };
      channelManager.registerHandler('whatsapp', mockHandler);

      const result = channelManager.getHandler('whatsapp');

      expect(result).toBe(mockHandler);
    });

    it('should return undefined for unregistered handler', () => {
      const result = channelManager.getHandler('nonexistent');

      expect(result).toBeUndefined();
    });

    it('should return different handlers for different types', () => {
      const whatsappHandler = { type: 'whatsapp' };
      const telegramHandler = { type: 'telegram' };

      channelManager.registerHandler('whatsapp', whatsappHandler);
      channelManager.registerHandler('telegram', telegramHandler);

      expect(channelManager.getHandler('whatsapp')).toBe(whatsappHandler);
      expect(channelManager.getHandler('telegram')).toBe(telegramHandler);
    });
  });

  // ========================================
  // Channel Registration - registerChannel()
  // ========================================
  describe('registerChannel()', () => {
    it('should register a new channel with all fields', async () => {
      const channelData = {
        type: 'whatsapp',
        name: 'My WhatsApp',
        credentials: { apiKey: 'test-key' },
        phone_number: '+1234567890',
        username: 'mybot',
        settings: { autoReply: true }
      };

      const mockChannel = {
        id: 1,
        ...channelData,
        webhook_secret: expect.any(String),
        status: 'pending'
      };

      Channel.create.mockResolvedValue(mockChannel);

      const result = await channelManager.registerChannel(123, channelData);

      expect(Channel.create).toHaveBeenCalledWith({
        tenant_id: 123,
        type: 'whatsapp',
        name: 'My WhatsApp',
        credentials: { apiKey: 'test-key' },
        phone_number: '+1234567890',
        username: 'mybot',
        webhook_secret: expect.any(String),
        settings: { autoReply: true },
        status: 'pending'
      });
      expect(result).toEqual(mockChannel);
    });

    it('should generate webhook secret', async () => {
      const channelData = {
        type: 'telegram',
        name: 'Telegram Bot'
      };

      const mockChannel = { id: 1, status: 'pending' };
      Channel.create.mockResolvedValue(mockChannel);

      await channelManager.registerChannel(123, channelData);

      const createCall = Channel.create.mock.calls[0][0];
      expect(createCall.webhook_secret).toBeDefined();
      expect(createCall.webhook_secret).toHaveLength(64); // 32 bytes = 64 hex chars
    });

    it('should use empty objects for missing credentials and settings', async () => {
      const channelData = {
        type: 'whatsapp',
        name: 'Test Channel'
      };

      Channel.create.mockResolvedValue({ id: 1, status: 'pending' });

      await channelManager.registerChannel(123, channelData);

      expect(Channel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          credentials: {},
          settings: {}
        })
      );
    });

    it('should initialize channel with handler if available', async () => {
      const mockHandler = {
        initialize: jest.fn().mockResolvedValue(undefined)
      };
      channelManager.registerHandler('whatsapp', mockHandler);

      const channelData = { type: 'whatsapp', name: 'Test' };
      const mockChannel = { id: 1, status: 'pending' };

      Channel.create.mockResolvedValue(mockChannel);
      Channel.update.mockResolvedValue({ ...mockChannel, status: 'active' });

      const result = await channelManager.registerChannel(123, channelData);

      expect(mockHandler.initialize).toHaveBeenCalledWith(mockChannel);
      expect(Channel.update).toHaveBeenCalledWith(1, { status: 'active' });
      expect(result.status).toBe('active');
    });

    it('should not initialize if no handler registered', async () => {
      const channelData = { type: 'unknown', name: 'Test' };
      const mockChannel = { id: 1, status: 'pending' };

      Channel.create.mockResolvedValue(mockChannel);

      const result = await channelManager.registerChannel(123, channelData);

      expect(Channel.update).not.toHaveBeenCalled();
      expect(result.status).toBe('pending');
    });

    it('should set error status if initialization fails', async () => {
      const mockHandler = {
        initialize: jest.fn().mockRejectedValue(new Error('API key invalid'))
      };
      channelManager.registerHandler('whatsapp', mockHandler);

      const channelData = { type: 'whatsapp', name: 'Test' };
      const mockChannel = { id: 1, status: 'pending' };

      Channel.create.mockResolvedValue(mockChannel);
      Channel.update.mockResolvedValue({ ...mockChannel, status: 'error', error_message: 'API key invalid' });

      const result = await channelManager.registerChannel(123, channelData);

      expect(Channel.update).toHaveBeenCalledWith(1, {
        status: 'error',
        error_message: 'API key invalid'
      });
      expect(result.status).toBe('error');
      expect(result.error_message).toBe('API key invalid');
    });

    it('should not initialize if handler has no initialize method', async () => {
      const mockHandler = { sendMessage: jest.fn() };
      channelManager.registerHandler('telegram', mockHandler);

      const channelData = { type: 'telegram', name: 'Test' };
      const mockChannel = { id: 1, status: 'pending' };

      Channel.create.mockResolvedValue(mockChannel);

      const result = await channelManager.registerChannel(123, channelData);

      expect(Channel.update).not.toHaveBeenCalled();
      expect(result.status).toBe('pending');
    });

    it('should handle initialization with complex error', async () => {
      const complexError = new Error('Network timeout');
      complexError.code = 'ETIMEDOUT';

      const mockHandler = {
        initialize: jest.fn().mockRejectedValue(complexError)
      };
      channelManager.registerHandler('whatsapp', mockHandler);

      const channelData = { type: 'whatsapp', name: 'Test' };
      Channel.create.mockResolvedValue({ id: 1, status: 'pending' });
      Channel.update.mockResolvedValue({ id: 1, status: 'error', error_message: 'Network timeout' });

      const result = await channelManager.registerChannel(123, channelData);

      expect(result.error_message).toBe('Network timeout');
    });
  });

  // ========================================
  // Channel Retrieval - getChannel()
  // ========================================
  describe('getChannel()', () => {
    it('should get channel by id', async () => {
      const mockChannel = { id: 1, type: 'whatsapp', name: 'Test' };
      Channel.findById.mockResolvedValue(mockChannel);

      const result = await channelManager.getChannel(1);

      expect(Channel.findById).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockChannel);
    });

    it('should return null if channel not found', async () => {
      Channel.findById.mockResolvedValue(null);

      const result = await channelManager.getChannel(999);

      expect(result).toBeNull();
    });
  });

  // ========================================
  // Tenant Channels - getChannelsByTenant()
  // ========================================
  describe('getChannelsByTenant()', () => {
    it('should get all channels for tenant', async () => {
      const mockChannels = [
        { id: 1, type: 'whatsapp' },
        { id: 2, type: 'telegram' }
      ];
      Channel.findByTenant.mockResolvedValue(mockChannels);

      const result = await channelManager.getChannelsByTenant(123);

      expect(Channel.findByTenant).toHaveBeenCalledWith(123, null);
      expect(result).toEqual(mockChannels);
    });

    it('should filter by type when provided', async () => {
      const mockChannels = [{ id: 1, type: 'whatsapp' }];
      Channel.findByTenant.mockResolvedValue(mockChannels);

      const result = await channelManager.getChannelsByTenant(123, 'whatsapp');

      expect(Channel.findByTenant).toHaveBeenCalledWith(123, 'whatsapp');
      expect(result).toEqual(mockChannels);
    });
  });

  // ========================================
  // Message Sending - sendMessage()
  // ========================================
  describe('sendMessage()', () => {
    it('should send a text message successfully', async () => {
      const mockChannel = {
        id: 1,
        type: 'whatsapp',
        status: 'active',
        phone_number: '+9876543210'
      };
      const mockMessage = { id: 100, status: 'pending' };
      const mockHandler = {
        sendMessage: jest.fn().mockResolvedValue({ messageId: 'ext-123' })
      };

      Channel.findById.mockResolvedValue(mockChannel);
      ChannelMessage.create.mockResolvedValue(mockMessage);
      ChannelMessage.updateStatus.mockResolvedValue({ ...mockMessage, status: 'sent' });
      channelManager.registerHandler('whatsapp', mockHandler);

      const messageData = {
        to: '+1234567890',
        content: 'Hello world'
      };

      const result = await channelManager.sendMessage(1, messageData);

      expect(Channel.findById).toHaveBeenCalledWith(1);
      expect(ChannelMessage.create).toHaveBeenCalledWith({
        channel_id: 1,
        direction: 'outbound',
        to_number: '+1234567890',
        from_number: '+9876543210',
        message_type: 'text',
        content: 'Hello world',
        media_url: undefined,
        caption: undefined,
        reply_to_id: undefined,
        metadata: {},
        status: 'pending'
      });
      expect(mockHandler.sendMessage).toHaveBeenCalledWith(mockChannel, {
        ...messageData,
        messageId: 100
      });
      expect(ChannelMessage.updateStatus).toHaveBeenCalledWith(100, 'sent', null, {
        external_id: 'ext-123',
        sent_at: expect.any(Date)
      });
      expect(result).toEqual({
        success: true,
        messageId: 100,
        externalId: 'ext-123'
      });
    });

    it('should send message with media', async () => {
      const mockChannel = { id: 1, type: 'whatsapp', status: 'active', phone_number: '+9876543210' };
      const mockMessage = { id: 100, status: 'pending' };
      const mockHandler = {
        sendMessage: jest.fn().mockResolvedValue({ messageId: 'ext-456' })
      };

      Channel.findById.mockResolvedValue(mockChannel);
      ChannelMessage.create.mockResolvedValue(mockMessage);
      ChannelMessage.updateStatus.mockResolvedValue({ ...mockMessage, status: 'sent' });
      channelManager.registerHandler('whatsapp', mockHandler);

      const messageData = {
        to: '+1234567890',
        type: 'image',
        mediaUrl: 'https://example.com/image.jpg',
        caption: 'Check this out'
      };

      await channelManager.sendMessage(1, messageData);

      expect(ChannelMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          message_type: 'image',
          media_url: 'https://example.com/image.jpg',
          caption: 'Check this out'
        })
      );
    });

    it('should use username if no phone_number', async () => {
      const mockChannel = { id: 1, type: 'telegram', status: 'active', username: '@testbot' };
      const mockMessage = { id: 100, status: 'pending' };
      const mockHandler = {
        sendMessage: jest.fn().mockResolvedValue({ messageId: 'ext-789' })
      };

      Channel.findById.mockResolvedValue(mockChannel);
      ChannelMessage.create.mockResolvedValue(mockMessage);
      ChannelMessage.updateStatus.mockResolvedValue({ ...mockMessage, status: 'sent' });
      channelManager.registerHandler('telegram', mockHandler);

      await channelManager.sendMessage(1, { to: '12345', content: 'Hi' });

      expect(ChannelMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          from_number: '@testbot'
        })
      );
    });

    it('should include metadata in message', async () => {
      const mockChannel = { id: 1, type: 'whatsapp', status: 'active', phone_number: '+9876543210' };
      const mockMessage = { id: 100, status: 'pending' };
      const mockHandler = {
        sendMessage: jest.fn().mockResolvedValue({ messageId: 'ext-123' })
      };

      Channel.findById.mockResolvedValue(mockChannel);
      ChannelMessage.create.mockResolvedValue(mockMessage);
      ChannelMessage.updateStatus.mockResolvedValue({ ...mockMessage, status: 'sent' });
      channelManager.registerHandler('whatsapp', mockHandler);

      const messageData = {
        to: '+1234567890',
        content: 'Hello',
        metadata: { source: 'bot', campaignId: 'abc123' }
      };

      await channelManager.sendMessage(1, messageData);

      expect(ChannelMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { source: 'bot', campaignId: 'abc123' }
        })
      );
    });

    it('should include replyToId', async () => {
      const mockChannel = { id: 1, type: 'whatsapp', status: 'active', phone_number: '+9876543210' };
      const mockMessage = { id: 100, status: 'pending' };
      const mockHandler = {
        sendMessage: jest.fn().mockResolvedValue({ messageId: 'ext-123' })
      };

      Channel.findById.mockResolvedValue(mockChannel);
      ChannelMessage.create.mockResolvedValue(mockMessage);
      ChannelMessage.updateStatus.mockResolvedValue({ ...mockMessage, status: 'sent' });
      channelManager.registerHandler('whatsapp', mockHandler);

      const messageData = {
        to: '+1234567890',
        content: 'Reply',
        replyToId: 'msg-999'
      };

      await channelManager.sendMessage(1, messageData);

      expect(ChannelMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          reply_to_id: 'msg-999'
        })
      );
    });

    it('should throw error if channel not found', async () => {
      Channel.findById.mockResolvedValue(null);

      await expect(
        channelManager.sendMessage(999, { to: '+1234567890', content: 'Hi' })
      ).rejects.toThrow('Channel not found');
    });

    it('should throw error if channel is not active', async () => {
      const mockChannel = { id: 1, type: 'whatsapp', status: 'pending' };
      Channel.findById.mockResolvedValue(mockChannel);

      await expect(
        channelManager.sendMessage(1, { to: '+1234567890', content: 'Hi' })
      ).rejects.toThrow('Channel is not active: pending');
    });

    it('should throw error if channel is in error state', async () => {
      const mockChannel = { id: 1, type: 'whatsapp', status: 'error' };
      Channel.findById.mockResolvedValue(mockChannel);

      await expect(
        channelManager.sendMessage(1, { to: '+1234567890', content: 'Hi' })
      ).rejects.toThrow('Channel is not active: error');
    });

    it('should throw error if no handler registered', async () => {
      const mockChannel = { id: 1, type: 'unknown', status: 'active' };
      const mockMessage = { id: 100, status: 'pending' };

      Channel.findById.mockResolvedValue(mockChannel);
      ChannelMessage.create.mockResolvedValue(mockMessage);
      ChannelMessage.updateStatus.mockResolvedValue({ ...mockMessage, status: 'failed' });

      await expect(
        channelManager.sendMessage(1, { to: '+1234567890', content: 'Hi' })
      ).rejects.toThrow('No handler registered for channel type: unknown');

      expect(ChannelMessage.updateStatus).toHaveBeenCalledWith(
        100,
        'failed',
        'No handler for channel type'
      );
    });

    it('should handle send failure and update message status', async () => {
      const mockChannel = { id: 1, type: 'whatsapp', status: 'active', phone_number: '+9876543210' };
      const mockMessage = { id: 100, status: 'pending' };
      const sendError = new Error('API rate limit exceeded');
      const mockHandler = {
        sendMessage: jest.fn().mockRejectedValue(sendError)
      };

      Channel.findById.mockResolvedValue(mockChannel);
      ChannelMessage.create.mockResolvedValue(mockMessage);
      ChannelMessage.updateStatus.mockResolvedValue({ ...mockMessage, status: 'failed' });
      channelManager.registerHandler('whatsapp', mockHandler);

      await expect(
        channelManager.sendMessage(1, { to: '+1234567890', content: 'Hi' })
      ).rejects.toThrow('API rate limit exceeded');

      expect(ChannelMessage.updateStatus).toHaveBeenCalledWith(
        100,
        'failed',
        'API rate limit exceeded'
      );
    });

    it('should send message with template', async () => {
      const mockChannel = { id: 1, type: 'whatsapp', status: 'active', phone_number: '+9876543210' };
      const mockMessage = { id: 100, status: 'pending' };
      const mockHandler = {
        sendMessage: jest.fn().mockResolvedValue({ messageId: 'ext-template' })
      };

      Channel.findById.mockResolvedValue(mockChannel);
      ChannelMessage.create.mockResolvedValue(mockMessage);
      ChannelMessage.updateStatus.mockResolvedValue({ ...mockMessage, status: 'sent' });
      channelManager.registerHandler('whatsapp', mockHandler);

      const messageData = {
        to: '+1234567890',
        type: 'template',
        templateName: 'welcome_message',
        templateVariables: ['John', 'Doe']
      };

      await channelManager.sendMessage(1, messageData);

      expect(mockHandler.sendMessage).toHaveBeenCalledWith(
        mockChannel,
        expect.objectContaining({
          templateName: 'welcome_message',
          templateVariables: ['John', 'Doe'],
          messageId: 100
        })
      );
    });
  });

  // ========================================
  // Message Receiving - receiveMessage()
  // ========================================
  describe('receiveMessage()', () => {
    it('should receive and store incoming message', async () => {
      const mockChannel = {
        id: 1,
        type: 'whatsapp',
        phone_number: '+9876543210'
      };
      const mockMessage = { id: 200, status: 'received' };
      const mockContact = { id: 1, external_id: '+1234567890' };

      Channel.findById.mockResolvedValue(mockChannel);
      ChannelMessage.findByExternalId.mockResolvedValue(null);
      ChannelMessage.create.mockResolvedValue(mockMessage);
      pool.query.mockResolvedValue({ rows: [mockContact] });

      const incomingData = {
        from: '+1234567890',
        fromName: 'John Doe',
        content: 'Hello from user',
        externalId: 'ext-incoming-123',
        timestamp: '2024-01-01T12:00:00Z'
      };

      const result = await channelManager.receiveMessage(1, incomingData);

      expect(Channel.findById).toHaveBeenCalledWith(1);
      expect(ChannelMessage.findByExternalId).toHaveBeenCalledWith('ext-incoming-123');
      expect(ChannelMessage.create).toHaveBeenCalledWith({
        channel_id: 1,
        direction: 'inbound',
        from_number: '+1234567890',
        from_name: 'John Doe',
        to_number: '+9876543210',
        message_type: 'text',
        content: 'Hello from user',
        media_url: undefined,
        media_mime_type: undefined,
        external_id: 'ext-incoming-123',
        reply_to_id: undefined,
        metadata: {},
        status: 'received',
        created_at: new Date('2024-01-01T12:00:00Z')
      });
      expect(result).toEqual(mockMessage);
    });

    it('should return existing message if duplicate', async () => {
      const mockChannel = { id: 1, type: 'whatsapp' };
      const existingMessage = { id: 200, external_id: 'ext-123', status: 'received' };

      Channel.findById.mockResolvedValue(mockChannel);
      ChannelMessage.findByExternalId.mockResolvedValue(existingMessage);

      const result = await channelManager.receiveMessage(1, {
        from: '+1234567890',
        content: 'Duplicate',
        externalId: 'ext-123'
      });

      expect(result).toEqual(existingMessage);
      expect(ChannelMessage.create).not.toHaveBeenCalled();
    });

    it('should handle message with media', async () => {
      const mockChannel = { id: 1, type: 'whatsapp', phone_number: '+9876543210' };
      const mockMessage = { id: 200, status: 'received' };

      Channel.findById.mockResolvedValue(mockChannel);
      ChannelMessage.findByExternalId.mockResolvedValue(null);
      ChannelMessage.create.mockResolvedValue(mockMessage);
      pool.query.mockResolvedValue({ rows: [{}] });

      const incomingData = {
        from: '+1234567890',
        messageType: 'image',
        content: null,
        mediaUrl: 'https://example.com/photo.jpg',
        mediaMimeType: 'image/jpeg',
        externalId: 'ext-image-123'
      };

      await channelManager.receiveMessage(1, incomingData);

      expect(ChannelMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          message_type: 'image',
          media_url: 'https://example.com/photo.jpg',
          media_mime_type: 'image/jpeg'
        })
      );
    });

    it('should use username if channel has no phone_number', async () => {
      const mockChannel = { id: 1, type: 'telegram', username: '@mybot' };
      const mockMessage = { id: 200, status: 'received' };

      Channel.findById.mockResolvedValue(mockChannel);
      ChannelMessage.findByExternalId.mockResolvedValue(null);
      ChannelMessage.create.mockResolvedValue(mockMessage);
      pool.query.mockResolvedValue({ rows: [{}] });

      await channelManager.receiveMessage(1, {
        from: '12345',
        content: 'Hi bot',
        externalId: 'ext-telegram-1'
      });

      expect(ChannelMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          to_number: '@mybot'
        })
      );
    });

    it('should throw error if channel not found', async () => {
      Channel.findById.mockResolvedValue(null);

      await expect(
        channelManager.receiveMessage(999, {
          from: '+1234567890',
          content: 'Hi',
          externalId: 'ext-123'
        })
      ).rejects.toThrow('Channel not found');
    });

    it('should update contact when receiving message', async () => {
      const mockChannel = { id: 1, type: 'whatsapp', phone_number: '+9876543210' };
      const mockMessage = { id: 200, status: 'received' };
      const mockContact = { id: 1, external_id: '+1234567890' };

      Channel.findById.mockResolvedValue(mockChannel);
      ChannelMessage.findByExternalId.mockResolvedValue(null);
      ChannelMessage.create.mockResolvedValue(mockMessage);
      pool.query.mockResolvedValue({ rows: [mockContact] });

      await channelManager.receiveMessage(1, {
        from: '+1234567890',
        fromName: 'Jane Smith',
        content: 'Hello',
        externalId: 'ext-123'
      });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO channel_contacts'),
        expect.arrayContaining([
          1, // channel_id
          '+1234567890', // external_id
          '+1234567890', // phone_number
          undefined, // username
          'Jane Smith', // display_name
          undefined, // profile_picture_url
          {} // metadata
        ])
      );
    });

    it('should emit message received event', async () => {
      const mockChannel = { id: 1, type: 'whatsapp', phone_number: '+9876543210' };
      const mockMessage = { id: 200, from_number: '+1234567890', message_type: 'text', content: 'Hi' };

      Channel.findById.mockResolvedValue(mockChannel);
      ChannelMessage.findByExternalId.mockResolvedValue(null);
      ChannelMessage.create.mockResolvedValue(mockMessage);
      pool.query.mockResolvedValue({ rows: [{}] });

      const emitSpy = jest.spyOn(channelManager, 'emitMessageReceived');

      await channelManager.receiveMessage(1, {
        from: '+1234567890',
        content: 'Hi',
        externalId: 'ext-123'
      });

      expect(emitSpy).toHaveBeenCalledWith(mockChannel, mockMessage);
    });

    it('should use current timestamp if none provided', async () => {
      const mockChannel = { id: 1, type: 'whatsapp', phone_number: '+9876543210' };
      const mockMessage = { id: 200, status: 'received' };

      Channel.findById.mockResolvedValue(mockChannel);
      ChannelMessage.findByExternalId.mockResolvedValue(null);
      ChannelMessage.create.mockResolvedValue(mockMessage);
      pool.query.mockResolvedValue({ rows: [{}] });

      await channelManager.receiveMessage(1, {
        from: '+1234567890',
        content: 'Hi',
        externalId: 'ext-123'
      });

      expect(ChannelMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          created_at: expect.any(Date)
        })
      );
    });

    it('should handle metadata in incoming message', async () => {
      const mockChannel = { id: 1, type: 'whatsapp', phone_number: '+9876543210' };
      const mockMessage = { id: 200, status: 'received' };

      Channel.findById.mockResolvedValue(mockChannel);
      ChannelMessage.findByExternalId.mockResolvedValue(null);
      ChannelMessage.create.mockResolvedValue(mockMessage);
      pool.query.mockResolvedValue({ rows: [{}] });

      await channelManager.receiveMessage(1, {
        from: '+1234567890',
        content: 'Hi',
        externalId: 'ext-123',
        metadata: { platform: 'ios', appVersion: '1.2.3' }
      });

      expect(ChannelMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { platform: 'ios', appVersion: '1.2.3' }
        })
      );
    });

    it('should handle replyToId in incoming message', async () => {
      const mockChannel = { id: 1, type: 'whatsapp', phone_number: '+9876543210' };
      const mockMessage = { id: 200, status: 'received' };

      Channel.findById.mockResolvedValue(mockChannel);
      ChannelMessage.findByExternalId.mockResolvedValue(null);
      ChannelMessage.create.mockResolvedValue(mockMessage);
      pool.query.mockResolvedValue({ rows: [{}] });

      await channelManager.receiveMessage(1, {
        from: '+1234567890',
        content: 'Reply',
        externalId: 'ext-123',
        replyToId: 'ext-original-msg'
      });

      expect(ChannelMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          reply_to_id: 'ext-original-msg'
        })
      );
    });
  });

  // ========================================
  // Message History - getMessageHistory()
  // ========================================
  describe('getMessageHistory()', () => {
    it('should get message history with default options', async () => {
      const mockMessages = [
        { id: 1, content: 'Message 1' },
        { id: 2, content: 'Message 2' }
      ];
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
      expect(result).toEqual(mockMessages);
    });

    it('should get message history with custom limit and offset', async () => {
      const mockMessages = [{ id: 1, content: 'Message 1' }];
      ChannelMessage.findByChannel.mockResolvedValue(mockMessages);

      await channelManager.getMessageHistory(1, { limit: 20, offset: 10 });

      expect(ChannelMessage.findByChannel).toHaveBeenCalledWith(1, {
        conversationId: undefined,
        limit: 20,
        offset: 10,
        direction: undefined,
        startDate: undefined,
        endDate: undefined
      });
    });

    it('should filter by conversation ID', async () => {
      const mockMessages = [{ id: 1, conversation_id: 'conv-123' }];
      ChannelMessage.findByChannel.mockResolvedValue(mockMessages);

      await channelManager.getMessageHistory(1, { conversationId: 'conv-123' });

      expect(ChannelMessage.findByChannel).toHaveBeenCalledWith(1, {
        conversationId: 'conv-123',
        limit: 50,
        offset: 0,
        direction: undefined,
        startDate: undefined,
        endDate: undefined
      });
    });

    it('should filter by direction', async () => {
      const mockMessages = [{ id: 1, direction: 'inbound' }];
      ChannelMessage.findByChannel.mockResolvedValue(mockMessages);

      await channelManager.getMessageHistory(1, { direction: 'inbound' });

      expect(ChannelMessage.findByChannel).toHaveBeenCalledWith(1,
        expect.objectContaining({ direction: 'inbound' })
      );
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const mockMessages = [{ id: 1, created_at: '2024-01-15' }];
      ChannelMessage.findByChannel.mockResolvedValue(mockMessages);

      await channelManager.getMessageHistory(1, { startDate, endDate });

      expect(ChannelMessage.findByChannel).toHaveBeenCalledWith(1, {
        conversationId: undefined,
        limit: 50,
        offset: 0,
        direction: undefined,
        startDate,
        endDate
      });
    });
  });

  // ========================================
  // Conversation - getConversation()
  // ========================================
  describe('getConversation()', () => {
    it('should get conversation with default limit', async () => {
      const mockMessages = [
        { id: 1, from_number: '+1234567890' },
        { id: 2, to_number: '+1234567890' }
      ];
      ChannelMessage.getConversation.mockResolvedValue(mockMessages);

      const result = await channelManager.getConversation(1, '+1234567890');

      expect(ChannelMessage.getConversation).toHaveBeenCalledWith(1, '+1234567890', 50);
      expect(result).toEqual(mockMessages);
    });

    it('should get conversation with custom limit', async () => {
      const mockMessages = [{ id: 1, from_number: '+1234567890' }];
      ChannelMessage.getConversation.mockResolvedValue(mockMessages);

      await channelManager.getConversation(1, '+1234567890', 100);

      expect(ChannelMessage.getConversation).toHaveBeenCalledWith(1, '+1234567890', 100);
    });
  });

  // ========================================
  // Message Status - updateMessageStatus()
  // ========================================
  describe('updateMessageStatus()', () => {
    it('should update message status to delivered', async () => {
      const mockMessage = { id: 100, external_id: 'ext-123', status: 'sent' };
      const updatedMessage = { ...mockMessage, status: 'delivered', delivered_at: new Date() };

      ChannelMessage.findByExternalId.mockResolvedValue(mockMessage);
      ChannelMessage.updateStatus.mockResolvedValue(updatedMessage);

      const result = await channelManager.updateMessageStatus('ext-123', 'delivered', '2024-01-01T12:00:00Z');

      expect(ChannelMessage.findByExternalId).toHaveBeenCalledWith('ext-123');
      expect(ChannelMessage.updateStatus).toHaveBeenCalledWith(100, 'delivered', null, {
        status: 'delivered',
        delivered_at: new Date('2024-01-01T12:00:00Z')
      });
      expect(result).toEqual(updatedMessage);
    });

    it('should update message status to read', async () => {
      const mockMessage = { id: 100, external_id: 'ext-123', status: 'delivered' };
      const updatedMessage = { ...mockMessage, status: 'read', read_at: new Date() };

      ChannelMessage.findByExternalId.mockResolvedValue(mockMessage);
      ChannelMessage.updateStatus.mockResolvedValue(updatedMessage);

      const result = await channelManager.updateMessageStatus('ext-123', 'read', '2024-01-01T13:00:00Z');

      expect(ChannelMessage.updateStatus).toHaveBeenCalledWith(100, 'read', null, {
        status: 'read',
        read_at: new Date('2024-01-01T13:00:00Z')
      });
      expect(result).toEqual(updatedMessage);
    });

    it('should update status without timestamp', async () => {
      const mockMessage = { id: 100, external_id: 'ext-123' };

      ChannelMessage.findByExternalId.mockResolvedValue(mockMessage);
      ChannelMessage.updateStatus.mockResolvedValue({ ...mockMessage, status: 'sent' });

      await channelManager.updateMessageStatus('ext-123', 'sent');

      expect(ChannelMessage.updateStatus).toHaveBeenCalledWith(100, 'sent', null, {
        status: 'sent'
      });
    });

    it('should return null if message not found', async () => {
      ChannelMessage.findByExternalId.mockResolvedValue(null);

      const result = await channelManager.updateMessageStatus('ext-nonexistent', 'delivered');

      expect(result).toBeNull();
      expect(ChannelMessage.updateStatus).not.toHaveBeenCalled();
    });

    it('should update status to failed', async () => {
      const mockMessage = { id: 100, external_id: 'ext-123' };

      ChannelMessage.findByExternalId.mockResolvedValue(mockMessage);
      ChannelMessage.updateStatus.mockResolvedValue({ ...mockMessage, status: 'failed' });

      await channelManager.updateMessageStatus('ext-123', 'failed');

      expect(ChannelMessage.updateStatus).toHaveBeenCalledWith(100, 'failed', null, {
        status: 'failed'
      });
    });

    it('should not add timestamp for non-delivery statuses', async () => {
      const mockMessage = { id: 100, external_id: 'ext-123' };

      ChannelMessage.findByExternalId.mockResolvedValue(mockMessage);
      ChannelMessage.updateStatus.mockResolvedValue({ ...mockMessage, status: 'sent' });

      await channelManager.updateMessageStatus('ext-123', 'sent', '2024-01-01T12:00:00Z');

      const callArgs = ChannelMessage.updateStatus.mock.calls[0][3];
      expect(callArgs).toEqual({ status: 'sent' });
      expect(callArgs.delivered_at).toBeUndefined();
      expect(callArgs.read_at).toBeUndefined();
    });
  });

  // ========================================
  // Webhook Processing - processWebhook()
  // ========================================
  describe('processWebhook()', () => {
    it('should store and process webhook successfully', async () => {
      const mockWebhook = { id: 1, channel_type: 'whatsapp', processed: false };
      const mockHandler = {
        processWebhook: jest.fn().mockResolvedValue(undefined)
      };

      pool.query
        .mockResolvedValueOnce({ rows: [mockWebhook] }) // INSERT webhook
        .mockResolvedValueOnce({ rows: [{ ...mockWebhook, processed: true }] }); // UPDATE webhook

      channelManager.registerHandler('whatsapp', mockHandler);

      const payload = { event: 'message.received', data: { content: 'Hi' } };
      const headers = { 'x-signature': 'abc123' };

      const result = await channelManager.processWebhook('whatsapp', payload, headers);

      expect(pool.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('INSERT INTO channel_webhooks'),
        ['whatsapp', 'message.received', payload, headers]
      );
      expect(mockHandler.processWebhook).toHaveBeenCalledWith(channelManager, payload, headers);
      expect(pool.query).toHaveBeenNthCalledWith(2,
        expect.stringContaining('UPDATE channel_webhooks SET processed = true'),
        [1]
      );
      expect(result).toEqual(mockWebhook);
    });

    it('should use "unknown" event type if not provided', async () => {
      const mockWebhook = { id: 1, event_type: 'unknown' };

      pool.query.mockResolvedValueOnce({ rows: [mockWebhook] });

      await channelManager.processWebhook('telegram', { data: 'test' });

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['telegram', 'unknown', { data: 'test' }, {}]
      );
    });

    it('should not process if no handler registered', async () => {
      const mockWebhook = { id: 1, channel_type: 'unknown' };

      pool.query.mockResolvedValueOnce({ rows: [mockWebhook] });

      const result = await channelManager.processWebhook('unknown', { event: 'test' });

      expect(result).toEqual(mockWebhook);
      // Should only call INSERT, not UPDATE
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    it('should not process if handler has no processWebhook method', async () => {
      const mockWebhook = { id: 1 };
      const mockHandler = { sendMessage: jest.fn() };

      pool.query.mockResolvedValueOnce({ rows: [mockWebhook] });
      channelManager.registerHandler('whatsapp', mockHandler);

      await channelManager.processWebhook('whatsapp', { event: 'test' });

      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    it('should handle webhook processing error', async () => {
      const mockWebhook = { id: 1, retry_count: 0 };
      const processingError = new Error('Invalid webhook signature');
      const mockHandler = {
        processWebhook: jest.fn().mockRejectedValue(processingError)
      };

      pool.query
        .mockResolvedValueOnce({ rows: [mockWebhook] }) // INSERT
        .mockResolvedValueOnce({ rows: [{ ...mockWebhook, retry_count: 1 }] }); // UPDATE error

      channelManager.registerHandler('whatsapp', mockHandler);

      await expect(
        channelManager.processWebhook('whatsapp', { event: 'test' })
      ).rejects.toThrow('Invalid webhook signature');

      expect(pool.query).toHaveBeenNthCalledWith(2,
        expect.stringContaining('UPDATE channel_webhooks SET error_message'),
        ['Invalid webhook signature', 1]
      );
    });

    it('should process webhook with empty headers', async () => {
      const mockWebhook = { id: 1 };
      const mockHandler = {
        processWebhook: jest.fn().mockResolvedValue(undefined)
      };

      pool.query
        .mockResolvedValueOnce({ rows: [mockWebhook] })
        .mockResolvedValueOnce({ rows: [mockWebhook] });

      channelManager.registerHandler('telegram', mockHandler);

      await channelManager.processWebhook('telegram', { event: 'message' });

      expect(pool.query).toHaveBeenNthCalledWith(1,
        expect.any(String),
        ['telegram', 'message', { event: 'message' }, {}]
      );
    });
  });

  // ========================================
  // Webhook Signature - verifyWebhookSignature()
  // ========================================
  describe('verifyWebhookSignature()', () => {
    it('should verify valid webhook signature', () => {
      const payload = { event: 'test', data: { id: 123 } };
      const secret = 'my-secret-key';
      const validSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      const result = channelManager.verifyWebhookSignature(1, payload, validSignature, secret);

      expect(result).toBe(true);
    });

    it('should reject invalid webhook signature', () => {
      const payload = { event: 'test', data: { id: 123 } };
      const secret = 'my-secret-key';
      const invalidSignature = 'invalid-signature-12345678901234567890123456789012';

      const result = channelManager.verifyWebhookSignature(1, payload, invalidSignature, secret);

      expect(result).toBe(false);
    });

    it('should reject signature with wrong secret', () => {
      const payload = { event: 'test' };
      const correctSecret = 'correct-secret';
      const wrongSecret = 'wrong-secret';
      const signature = crypto
        .createHmac('sha256', wrongSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

      const result = channelManager.verifyWebhookSignature(1, payload, signature, correctSecret);

      expect(result).toBe(false);
    });

    it('should verify signature for complex payload', () => {
      const payload = {
        event: 'message.received',
        data: {
          id: 123,
          from: '+1234567890',
          content: 'Hello world',
          metadata: { platform: 'ios' }
        }
      };
      const secret = 'complex-secret-key';
      const validSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      const result = channelManager.verifyWebhookSignature(1, payload, validSignature, secret);

      expect(result).toBe(true);
    });
  });

  // ========================================
  // Contact Management - updateContact()
  // ========================================
  describe('updateContact()', () => {
    it('should create new contact', async () => {
      const mockContact = {
        id: 1,
        channel_id: 1,
        external_id: '+1234567890',
        display_name: 'John Doe',
        message_count: 1
      };

      pool.query.mockResolvedValue({ rows: [mockContact] });

      const contactData = {
        externalId: '+1234567890',
        phoneNumber: '+1234567890',
        displayName: 'John Doe'
      };

      const result = await channelManager.updateContact(1, contactData);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO channel_contacts'),
        [1, '+1234567890', '+1234567890', undefined, 'John Doe', undefined, {}]
      );
      expect(result).toEqual(mockContact);
    });

    it('should update existing contact', async () => {
      const mockContact = {
        id: 1,
        external_id: '+1234567890',
        display_name: 'Jane Doe',
        message_count: 5
      };

      pool.query.mockResolvedValue({ rows: [mockContact] });

      const contactData = {
        externalId: '+1234567890',
        displayName: 'Jane Doe',
        profilePictureUrl: 'https://example.com/avatar.jpg'
      };

      await channelManager.updateContact(1, contactData);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        [1, '+1234567890', undefined, undefined, 'Jane Doe', 'https://example.com/avatar.jpg', {}]
      );
    });

    it('should include username in contact data', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 1 }] });

      const contactData = {
        externalId: '12345',
        username: '@johndoe',
        displayName: 'John Doe'
      };

      await channelManager.updateContact(1, contactData);

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        [1, '12345', undefined, '@johndoe', 'John Doe', undefined, {}]
      );
    });

    it('should include metadata', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 1 }] });

      const contactData = {
        externalId: '+1234567890',
        phoneNumber: '+1234567890',
        metadata: { source: 'facebook', verified: true }
      };

      await channelManager.updateContact(1, contactData);

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([{ source: 'facebook', verified: true }])
      );
    });

    it('should use empty object for missing metadata', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 1 }] });

      const contactData = {
        externalId: '+1234567890',
        phoneNumber: '+1234567890'
      };

      await channelManager.updateContact(1, contactData);

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([{}])
      );
    });
  });

  // ========================================
  // Contact Retrieval - getContacts()
  // ========================================
  describe('getContacts()', () => {
    it('should get contacts with default options', async () => {
      const mockContacts = [
        { id: 1, display_name: 'John Doe' },
        { id: 2, display_name: 'Jane Smith' }
      ];

      pool.query.mockResolvedValue({ rows: mockContacts });

      const result = await channelManager.getContacts(1);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM channel_contacts'),
        [1, 50, 0]
      );
      expect(result).toEqual(mockContacts);
    });

    it('should get contacts with custom limit and offset', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await channelManager.getContacts(1, { limit: 20, offset: 10 });

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        [1, 20, 10]
      );
    });

    it('should search contacts by name', async () => {
      const mockContacts = [{ id: 1, display_name: 'John Doe' }];
      pool.query.mockResolvedValue({ rows: mockContacts });

      await channelManager.getContacts(1, { search: 'John' });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('display_name ILIKE'),
        [1, '%John%', 50, 0]
      );
    });

    it('should search contacts by phone number', async () => {
      const mockContacts = [{ id: 1, phone_number: '+1234567890' }];
      pool.query.mockResolvedValue({ rows: mockContacts });

      await channelManager.getContacts(1, { search: '+123' });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('phone_number ILIKE'),
        [1, '%+123%', 50, 0]
      );
    });

    it('should order contacts by last_message_at', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await channelManager.getContacts(1);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY last_message_at DESC'),
        expect.any(Array)
      );
    });
  });

  // ========================================
  // Event Emission - emitMessageReceived()
  // ========================================
  describe('emitMessageReceived()', () => {
    it('should log message received event', () => {
      const channel = { id: 1, type: 'whatsapp' };
      const message = {
        from_number: '+1234567890',
        message_type: 'text',
        content: 'This is a test message that is longer than fifty characters for truncation'
      };

      channelManager.emitMessageReceived(channel, message);

      expect(log.info).toHaveBeenCalledWith(
        'Message received on channel 1:',
        {
          from: '+1234567890',
          type: 'text',
          content: 'This is a test message that is longer than fifty c'
        }
      );
    });

    it('should handle message with no content', () => {
      const channel = { id: 2, type: 'telegram' };
      const message = {
        from_number: '12345',
        message_type: 'image'
      };

      channelManager.emitMessageReceived(channel, message);

      expect(log.info).toHaveBeenCalledWith(
        'Message received on channel 2:',
        expect.objectContaining({
          from: '12345',
          type: 'image'
        })
      );
    });

    it('should handle short content without truncation', () => {
      const channel = { id: 1, type: 'whatsapp' };
      const message = {
        from_number: '+1234567890',
        message_type: 'text',
        content: 'Short message'
      };

      channelManager.emitMessageReceived(channel, message);

      expect(log.info).toHaveBeenCalledWith(
        'Message received on channel 1:',
        expect.objectContaining({
          content: 'Short message'
        })
      );
    });
  });

  // ========================================
  // Channel Statistics - getChannelStats()
  // ========================================
  describe('getChannelStats()', () => {
    it('should get stats for 30 day period', async () => {
      const mockStats = {
        inbound_count: '150',
        outbound_count: '200',
        delivered_count: '180',
        read_count: '120',
        failed_count: '5',
        unique_contacts: '45'
      };

      pool.query.mockResolvedValue({ rows: [mockStats] });

      const result = await channelManager.getChannelStats(1, '30d');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM channel_messages'),
        [1, 30]
      );
      expect(result).toEqual(mockStats);
    });

    it('should get stats for 7 day period', async () => {
      const mockStats = {
        inbound_count: '50',
        outbound_count: '60',
        delivered_count: '55',
        read_count: '40',
        failed_count: '2',
        unique_contacts: '15'
      };

      pool.query.mockResolvedValue({ rows: [mockStats] });

      await channelManager.getChannelStats(1, '7d');

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        [1, 7]
      );
    });

    it('should get stats for 90 day period', async () => {
      const mockStats = {
        inbound_count: '500',
        outbound_count: '600',
        delivered_count: '580',
        read_count: '450',
        failed_count: '15',
        unique_contacts: '120'
      };

      pool.query.mockResolvedValue({ rows: [mockStats] });

      await channelManager.getChannelStats(1, '90d');

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        [1, 90]
      );
    });

    it('should default to 90 days for invalid period', async () => {
      pool.query.mockResolvedValue({ rows: [{}] });

      await channelManager.getChannelStats(1, 'invalid');

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        [1, 90]
      );
    });

    it('should use FILTER clause for counts', async () => {
      pool.query.mockResolvedValue({ rows: [{}] });

      await channelManager.getChannelStats(1);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringMatching(/COUNT\(\*\) FILTER \(WHERE direction = 'inbound'\)/),
        expect.any(Array)
      );
    });

    it('should count unique contacts', async () => {
      pool.query.mockResolvedValue({ rows: [{}] });

      await channelManager.getChannelStats(1);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringMatching(/COUNT\(DISTINCT from_number\)/),
        expect.any(Array)
      );
    });

    it('should filter by date range using parameterized interval', async () => {
      pool.query.mockResolvedValue({ rows: [{}] });

      await channelManager.getChannelStats(1, '30d');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringMatching(/created_at >= NOW\(\) - INTERVAL '1 day' \* \$2/),
        [1, 30]
      );
    });
  });

  // ========================================
  // Edge Cases and Error Scenarios
  // ========================================
  describe('Edge Cases and Error Handling', () => {
    it('should handle null values in channel data gracefully', async () => {
      const channelData = {
        type: 'whatsapp',
        name: null,
        credentials: null,
        settings: null
      };

      Channel.create.mockResolvedValue({ id: 1, status: 'pending' });

      await channelManager.registerChannel(123, channelData);

      expect(Channel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: null,
          credentials: {},
          settings: {}
        })
      );
    });

    it('should handle database errors in channel creation', async () => {
      const dbError = new Error('Database connection failed');
      Channel.create.mockRejectedValue(dbError);

      await expect(
        channelManager.registerChannel(123, { type: 'whatsapp', name: 'Test' })
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle database errors in message sending', async () => {
      const mockChannel = { id: 1, type: 'whatsapp', status: 'active', phone_number: '+9876543210' };
      const dbError = new Error('Insert failed');

      Channel.findById.mockResolvedValue(mockChannel);
      ChannelMessage.create.mockRejectedValue(dbError);

      await expect(
        channelManager.sendMessage(1, { to: '+1234567890', content: 'Hi' })
      ).rejects.toThrow('Insert failed');
    });

    it('should handle database errors in webhook processing', async () => {
      const dbError = new Error('Insert failed');
      pool.query.mockRejectedValue(dbError);

      await expect(
        channelManager.processWebhook('whatsapp', { event: 'test' })
      ).rejects.toThrow('Insert failed');
    });

    it('should handle contact update errors', async () => {
      const dbError = new Error('Constraint violation');
      pool.query.mockRejectedValue(dbError);

      await expect(
        channelManager.updateContact(1, { externalId: '+1234567890' })
      ).rejects.toThrow('Constraint violation');
    });

    it('should handle stats query errors', async () => {
      const dbError = new Error('Query timeout');
      pool.query.mockRejectedValue(dbError);

      await expect(
        channelManager.getChannelStats(1)
      ).rejects.toThrow('Query timeout');
    });
  });

  // ========================================
  // Integration Scenarios
  // ========================================
  describe('Integration Scenarios', () => {
    it('should handle complete message flow', async () => {
      // Setup
      const mockHandler = {
        initialize: jest.fn().mockResolvedValue(undefined),
        sendMessage: jest.fn().mockResolvedValue({ messageId: 'ext-123' })
      };
      channelManager.registerHandler('whatsapp', mockHandler);

      // Register channel
      const channelData = { type: 'whatsapp', name: 'Test WhatsApp' };
      const mockChannel = { id: 1, type: 'whatsapp', status: 'pending', phone_number: '+9876543210' };

      Channel.create.mockResolvedValue(mockChannel);
      Channel.update.mockResolvedValue({ ...mockChannel, status: 'active' });
      Channel.findById.mockResolvedValue({ ...mockChannel, status: 'active' });

      await channelManager.registerChannel(123, channelData);

      // Send message
      const mockMessage = { id: 100, status: 'pending' };
      ChannelMessage.create.mockResolvedValue(mockMessage);
      ChannelMessage.updateStatus.mockResolvedValue({ ...mockMessage, status: 'sent' });

      await channelManager.sendMessage(1, { to: '+1234567890', content: 'Hello' });

      // Verify flow
      expect(mockHandler.initialize).toHaveBeenCalled();
      expect(Channel.update).toHaveBeenCalledWith(1, { status: 'active' });
      expect(mockHandler.sendMessage).toHaveBeenCalled();
      expect(ChannelMessage.updateStatus).toHaveBeenCalledWith(100, 'sent', null, expect.any(Object));
    });

    it('should handle incoming webhook to message flow', async () => {
      const mockHandler = {
        processWebhook: jest.fn().mockResolvedValue(undefined)
      };
      channelManager.registerHandler('telegram', mockHandler);

      // Process webhook
      const webhookPayload = {
        event: 'message',
        data: {
          from: '12345',
          content: 'Hello bot'
        }
      };

      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1, event_type: 'message' }] }) // INSERT webhook
        .mockResolvedValueOnce({ rows: [{ id: 1, processed: true }] }); // UPDATE webhook

      await channelManager.processWebhook('telegram', webhookPayload);

      expect(mockHandler.processWebhook).toHaveBeenCalledWith(
        channelManager,
        webhookPayload,
        {}
      );
    });

    it('should handle message status update flow', async () => {
      // Send message
      const mockChannel = { id: 1, type: 'whatsapp', status: 'active', phone_number: '+9876543210' };
      const mockMessage = { id: 100, status: 'pending', external_id: null };
      const mockHandler = {
        sendMessage: jest.fn().mockResolvedValue({ messageId: 'ext-abc' })
      };

      Channel.findById.mockResolvedValue(mockChannel);
      ChannelMessage.create.mockResolvedValue(mockMessage);
      ChannelMessage.updateStatus.mockResolvedValue({ ...mockMessage, status: 'sent', external_id: 'ext-abc' });
      channelManager.registerHandler('whatsapp', mockHandler);

      await channelManager.sendMessage(1, { to: '+1234567890', content: 'Hi' });

      // Update status to delivered
      ChannelMessage.findByExternalId.mockResolvedValue({ ...mockMessage, external_id: 'ext-abc', status: 'sent' });
      ChannelMessage.updateStatus.mockResolvedValue({ ...mockMessage, status: 'delivered' });

      await channelManager.updateMessageStatus('ext-abc', 'delivered');

      expect(ChannelMessage.updateStatus).toHaveBeenLastCalledWith(
        100,
        'delivered',
        null,
        expect.objectContaining({ status: 'delivered' })
      );
    });
  });
});
