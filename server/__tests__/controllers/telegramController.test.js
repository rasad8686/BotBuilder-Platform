/**
 * Telegram Controller Tests
 * Tests for server/controllers/telegramController.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../services/channels/telegramService', () => ({
  testConnection: jest.fn(),
  setWebhook: jest.fn(),
  deleteWebhook: jest.fn(),
  removeBot: jest.fn(),
  sendMessage: jest.fn(),
  getWebhookInfo: jest.fn()
}));

jest.mock('../../models/TelegramChannel', () => ({
  findByBotToken: jest.fn(),
  findById: jest.fn(),
  findByOrganization: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  getStats: jest.fn()
}));

jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => ({
    toString: jest.fn(() => 'mock-webhook-secret-12345')
  }))
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../db');
const telegramService = require('../../services/channels/telegramService');
const TelegramChannel = require('../../models/TelegramChannel');
const {
  connectTelegram,
  disconnectTelegram,
  getChannelStats,
  testConnection,
  getChannels,
  getChannel,
  updateChannel,
  sendTestMessage,
  refreshWebhook
} = require('../../controllers/telegramController');

describe('Telegram Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      user: { id: 1, organizationId: 1 },
      params: {},
      body: {},
      query: {},
      protocol: 'https',
      get: jest.fn(() => 'localhost:3000')
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  describe('connectTelegram', () => {
    it('should return 400 if botToken is missing', async () => {
      mockReq.body = {};

      await connectTelegram(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Bot token is required'
      });
    });

    it('should return 400 if bot token already in use', async () => {
      mockReq.body = { botToken: 'existing-token' };
      TelegramChannel.findByBotToken.mockResolvedValue({ id: 1 });

      await connectTelegram(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'This bot token is already connected'
      });
    });

    it('should return 400 if bot token is invalid', async () => {
      mockReq.body = { botToken: 'invalid-token' };
      TelegramChannel.findByBotToken.mockResolvedValue(null);
      telegramService.testConnection.mockResolvedValue({
        success: false,
        error: 'Invalid token'
      });

      await connectTelegram(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid bot token: Invalid token'
      });
    });

    it('should create channel successfully', async () => {
      mockReq.body = { botToken: 'valid-token', botId: 123 };
      TelegramChannel.findByBotToken.mockResolvedValue(null);
      telegramService.testConnection.mockResolvedValue({
        success: true,
        botId: 'bot123',
        botUsername: 'testbot',
        canJoinGroups: true,
        canReadAllGroupMessages: false,
        supportsInlineQueries: true
      });
      TelegramChannel.create.mockResolvedValue({
        id: 1,
        botUsername: 'testbot',
        webhookUrl: 'https://localhost:3000/api/webhooks/telegram/bot123',
        isActive: true,
        settings: {},
        createdAt: new Date()
      });
      telegramService.setWebhook.mockResolvedValue({});

      await connectTelegram(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true
      }));
    });

    it('should handle errors gracefully', async () => {
      mockReq.body = { botToken: 'token' };
      TelegramChannel.findByBotToken.mockRejectedValue(new Error('DB error'));

      await connectTelegram(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to connect Telegram bot'
      });
    });
  });

  describe('disconnectTelegram', () => {
    it('should return 404 if channel not found', async () => {
      mockReq.params = { id: '999' };
      TelegramChannel.findById.mockResolvedValue(null);

      await disconnectTelegram(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Telegram channel not found'
      });
    });

    it('should return 403 if not authorized', async () => {
      mockReq.params = { id: '1' };
      TelegramChannel.findById.mockResolvedValue({
        id: 1,
        organizationId: 999, // Different org
        botToken: 'token',
        botUsername: 'testbot'
      });

      await disconnectTelegram(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not authorized to disconnect this channel'
      });
    });

    it('should disconnect successfully', async () => {
      mockReq.params = { id: '1' };
      TelegramChannel.findById.mockResolvedValue({
        id: 1,
        organizationId: 1,
        botToken: 'token',
        botUsername: 'testbot'
      });
      telegramService.deleteWebhook.mockResolvedValue({});
      TelegramChannel.delete.mockResolvedValue({});

      await disconnectTelegram(mockReq, mockRes);

      expect(telegramService.removeBot).toHaveBeenCalledWith('token');
      expect(TelegramChannel.delete).toHaveBeenCalledWith('1');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Telegram bot @testbot disconnected successfully'
      });
    });
  });

  describe('getChannels', () => {
    it('should return all channels', async () => {
      TelegramChannel.findByOrganization.mockResolvedValue([
        { id: 1, botUsername: 'bot1', isActive: true },
        { id: 2, botUsername: 'bot2', isActive: false }
      ]);

      await getChannels(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Array)
      });
    });

    it('should return empty array if no channels', async () => {
      TelegramChannel.findByOrganization.mockResolvedValue([]);

      await getChannels(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: []
      });
    });

    it('should handle errors', async () => {
      TelegramChannel.findByOrganization.mockRejectedValue(new Error('DB error'));

      await getChannels(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getChannel', () => {
    it('should return 404 if not found', async () => {
      mockReq.params = { id: '999' };
      TelegramChannel.findById.mockResolvedValue(null);

      await getChannel(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 if not authorized', async () => {
      mockReq.params = { id: '1' };
      TelegramChannel.findById.mockResolvedValue({
        id: 1,
        organizationId: 999
      });

      await getChannel(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should return channel', async () => {
      mockReq.params = { id: '1' };
      TelegramChannel.findById.mockResolvedValue({
        id: 1,
        organizationId: 1,
        botUsername: 'testbot',
        isActive: true
      });

      await getChannel(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true
      }));
    });
  });

  describe('updateChannel', () => {
    it('should return 404 if not found', async () => {
      mockReq.params = { id: '999' };
      mockReq.body = { isActive: true };
      TelegramChannel.findById.mockResolvedValue(null);

      await updateChannel(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should update channel', async () => {
      mockReq.params = { id: '1' };
      mockReq.body = { isActive: false };
      TelegramChannel.findById.mockResolvedValue({
        id: 1,
        organizationId: 1,
        settings: {}
      });
      TelegramChannel.update.mockResolvedValue({
        id: 1,
        botUsername: 'testbot',
        isActive: false,
        settings: {},
        updatedAt: new Date()
      });

      await updateChannel(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: 'Channel updated successfully'
      }));
    });
  });

  describe('testConnection', () => {
    it('should return 400 if no token or channelId', async () => {
      mockReq.body = {};

      await testConnection(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should test with direct token', async () => {
      mockReq.body = { botToken: 'token' };
      telegramService.testConnection.mockResolvedValue({
        success: true,
        botId: 'bot123',
        botUsername: 'testbot',
        firstName: 'Test Bot',
        canJoinGroups: true,
        canReadAllGroupMessages: false,
        supportsInlineQueries: false
      });
      telegramService.getWebhookInfo.mockResolvedValue({
        url: 'https://example.com/webhook',
        pending_update_count: 0
      });

      await testConnection(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true
      }));
    });

    it('should return 400 if test fails', async () => {
      mockReq.body = { botToken: 'bad-token' };
      telegramService.testConnection.mockResolvedValue({
        success: false,
        error: 'Invalid token'
      });

      await testConnection(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('sendTestMessage', () => {
    it('should return 400 if chatId or message missing', async () => {
      mockReq.params = { id: '1' };
      mockReq.body = { chatId: '123' }; // missing message

      await sendTestMessage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should send message successfully', async () => {
      mockReq.params = { id: '1' };
      mockReq.body = { chatId: '123', message: 'Hello' };
      TelegramChannel.findById.mockResolvedValue({
        id: 1,
        organizationId: 1,
        botToken: 'token'
      });
      telegramService.sendMessage.mockResolvedValue({
        message_id: 456,
        chat: { id: 123 },
        date: 1234567890
      });

      await sendTestMessage(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: 'Test message sent successfully'
      }));
    });
  });

  describe('refreshWebhook', () => {
    it('should return 404 if channel not found', async () => {
      mockReq.params = { id: '999' };
      TelegramChannel.findById.mockResolvedValue(null);

      await refreshWebhook(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should refresh webhook successfully', async () => {
      mockReq.params = { id: '1' };
      TelegramChannel.findById.mockResolvedValue({
        id: 1,
        organizationId: 1,
        botToken: 'token',
        webhookUrl: 'https://example.com/webhook'
      });
      telegramService.setWebhook.mockResolvedValue({});
      TelegramChannel.update.mockResolvedValue({});
      telegramService.getWebhookInfo.mockResolvedValue({
        url: 'https://example.com/webhook',
        pending_update_count: 0
      });

      await refreshWebhook(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: 'Webhook refreshed successfully'
      }));
    });
  });

  describe('getChannelStats', () => {
    it('should return stats for specific channel', async () => {
      mockReq.query = { channelId: '1' };
      TelegramChannel.findByOrganization.mockResolvedValue([
        { id: 1, botUsername: 'testbot', isActive: true }
      ]);
      TelegramChannel.getStats.mockResolvedValue({
        totalMessages: 100,
        uniqueUsers: 25
      });

      await getChannelStats(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true
      }));
    });

    it('should return 404 if channel not found', async () => {
      mockReq.query = { channelId: '999' };
      TelegramChannel.findByOrganization.mockResolvedValue([
        { id: 1, botUsername: 'testbot', isActive: true }
      ]);

      await getChannelStats(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return aggregated stats', async () => {
      mockReq.query = {};
      TelegramChannel.findByOrganization.mockResolvedValue([]);
      db.query.mockResolvedValue({
        rows: [
          { channel_id: 1, bot_username: 'bot1', is_active: true, total_messages: '50', unique_users: '10' }
        ]
      });

      await getChannelStats(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true
      }));
    });
  });
});
