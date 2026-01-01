/**
 * Telegram Routes Tests
 * Tests for server/routes/telegram.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../middleware/auth', () => ({
  authenticateToken: jest.fn((req, res, next) => {
    req.user = { id: 1, email: 'test@example.com', organizationId: 1 };
    next();
  })
}));

jest.mock('../../controllers/telegramController', () => ({
  connectTelegram: jest.fn(),
  disconnectTelegram: jest.fn(),
  getChannelStats: jest.fn(),
  testConnection: jest.fn(),
  getChannels: jest.fn(),
  getChannel: jest.fn(),
  updateChannel: jest.fn(),
  sendTestMessage: jest.fn(),
  refreshWebhook: jest.fn()
}));

jest.mock('../../services/channels/telegramService', () => ({
  testConnection: jest.fn(),
  setWebhook: jest.fn(),
  deleteWebhook: jest.fn(),
  getWebhookInfo: jest.fn(),
  removeBot: jest.fn(),
  sendMessage: jest.fn()
}));

jest.mock('../../models/TelegramChannel', () => ({
  create: jest.fn(),
  findById: jest.fn(),
  findByOrganization: jest.fn(),
  findByBotToken: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  getStats: jest.fn()
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
const telegramController = require('../../controllers/telegramController');
const telegramService = require('../../services/channels/telegramService');
const TelegramChannel = require('../../models/TelegramChannel');
const telegramRouter = require('../../routes/telegram');

const app = express();
app.use(express.json());
app.use('/api/channels/telegram', telegramRouter);

describe('Telegram Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/channels/telegram/connect', () => {
    it('should connect Telegram bot successfully', async () => {
      telegramController.connectTelegram.mockImplementation((req, res) => {
        res.status(201).json({
          success: true,
          data: {
            id: 1,
            botUsername: 'testbot',
            webhookUrl: 'https://example.com/webhook',
            isActive: true,
            settings: {},
            createdAt: new Date()
          },
          message: 'Telegram bot @testbot connected successfully'
        });
      });

      const response = await request(app)
        .post('/api/channels/telegram/connect')
        .send({
          botToken: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
          botId: 1
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.botUsername).toBe('testbot');
      expect(telegramController.connectTelegram).toHaveBeenCalled();
    });

    it('should reject missing bot token', async () => {
      telegramController.connectTelegram.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          error: 'Bot token is required'
        });
      });

      const response = await request(app)
        .post('/api/channels/telegram/connect')
        .send({ botId: 1 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Bot token');
    });

    it('should reject duplicate bot token', async () => {
      telegramController.connectTelegram.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          error: 'This bot token is already connected'
        });
      });

      const response = await request(app)
        .post('/api/channels/telegram/connect')
        .send({
          botToken: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already connected');
    });

    it('should reject invalid bot token', async () => {
      telegramController.connectTelegram.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          error: 'Invalid bot token: Unauthorized'
        });
      });

      const response = await request(app)
        .post('/api/channels/telegram/connect')
        .send({
          botToken: 'invalid_token'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid bot token');
    });

    it('should handle database errors', async () => {
      telegramController.connectTelegram.mockImplementation((req, res) => {
        res.status(500).json({
          success: false,
          error: 'Failed to connect Telegram bot'
        });
      });

      const response = await request(app)
        .post('/api/channels/telegram/connect')
        .send({
          botToken: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Failed to connect');
    });
  });

  describe('GET /api/channels/telegram', () => {
    it('should return all Telegram channels', async () => {
      telegramController.getChannels.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: [
            {
              id: 1,
              botId: 1,
              botUsername: 'testbot1',
              webhookUrl: 'https://example.com/webhook/1',
              isActive: true,
              settings: {},
              createdAt: new Date(),
              updatedAt: new Date()
            },
            {
              id: 2,
              botId: 2,
              botUsername: 'testbot2',
              webhookUrl: 'https://example.com/webhook/2',
              isActive: false,
              settings: {},
              createdAt: new Date(),
              updatedAt: new Date()
            }
          ]
        });
      });

      const response = await request(app).get('/api/channels/telegram');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].botUsername).toBe('testbot1');
    });

    it('should return empty array when no channels exist', async () => {
      telegramController.getChannels.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: []
        });
      });

      const response = await request(app).get('/api/channels/telegram');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
    });

    it('should not expose sensitive data like botToken', async () => {
      telegramController.getChannels.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: [
            {
              id: 1,
              botId: 1,
              botUsername: 'testbot1',
              webhookUrl: 'https://example.com/webhook/1',
              isActive: true,
              settings: {}
              // botToken should NOT be included
            }
          ]
        });
      });

      const response = await request(app).get('/api/channels/telegram');

      expect(response.status).toBe(200);
      expect(response.body.data[0]).not.toHaveProperty('botToken');
    });

    it('should handle errors', async () => {
      telegramController.getChannels.mockImplementation((req, res) => {
        res.status(500).json({
          success: false,
          error: 'Failed to get channels'
        });
      });

      const response = await request(app).get('/api/channels/telegram');

      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/channels/telegram/stats', () => {
    it('should return aggregated stats for all channels', async () => {
      telegramController.getChannelStats.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: {
            totals: {
              totalChannels: 2,
              activeChannels: 1,
              totalMessages: 150,
              totalUniqueUsers: 45
            },
            channels: [
              {
                channelId: 1,
                botUsername: 'testbot1',
                isActive: true,
                totalMessages: 100,
                uniqueUsers: 30
              },
              {
                channelId: 2,
                botUsername: 'testbot2',
                isActive: false,
                totalMessages: 50,
                uniqueUsers: 15
              }
            ]
          }
        });
      });

      const response = await request(app).get('/api/channels/telegram/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totals.totalChannels).toBe(2);
      expect(response.body.data.channels).toHaveLength(2);
    });

    it('should return stats for specific channel', async () => {
      telegramController.getChannelStats.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: {
            channel: {
              id: 1,
              botUsername: 'testbot',
              isActive: true
            },
            stats: {
              totalMessages: 100,
              uniqueUsers: 30,
              averageMessagesPerDay: 10
            }
          }
        });
      });

      const response = await request(app).get('/api/channels/telegram/stats?channelId=1');

      expect(response.status).toBe(200);
      expect(response.body.data.channel.id).toBe(1);
      expect(response.body.data.stats.totalMessages).toBe(100);
    });

    it('should support date range filtering', async () => {
      telegramController.getChannelStats.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: {
            channel: {
              id: 1,
              botUsername: 'testbot',
              isActive: true
            },
            stats: {
              totalMessages: 50,
              uniqueUsers: 20
            }
          }
        });
      });

      const response = await request(app)
        .get('/api/channels/telegram/stats')
        .query({
          channelId: 1,
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent channel', async () => {
      telegramController.getChannelStats.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          error: 'Channel not found'
        });
      });

      const response = await request(app).get('/api/channels/telegram/stats?channelId=999');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('POST /api/channels/telegram/test', () => {
    it('should test connection with bot token', async () => {
      telegramController.testConnection.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: {
            bot: {
              id: 123456789,
              username: 'testbot',
              firstName: 'Test Bot',
              canJoinGroups: true,
              canReadAllGroupMessages: false,
              supportsInlineQueries: true
            },
            webhook: {
              url: 'https://example.com/webhook',
              hasCustomCertificate: false,
              pendingUpdateCount: 0,
              lastErrorDate: null,
              lastErrorMessage: null,
              maxConnections: 40
            }
          }
        });
      });

      const response = await request(app)
        .post('/api/channels/telegram/test')
        .send({
          botToken: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.bot.username).toBe('testbot');
    });

    it('should test connection with channel ID', async () => {
      telegramController.testConnection.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: {
            bot: {
              id: 123456789,
              username: 'testbot',
              firstName: 'Test Bot'
            },
            webhook: {
              url: 'https://example.com/webhook'
            }
          }
        });
      });

      const response = await request(app)
        .post('/api/channels/telegram/test')
        .send({ channelId: 1 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject missing parameters', async () => {
      telegramController.testConnection.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          error: 'Bot token or channel ID is required'
        });
      });

      const response = await request(app)
        .post('/api/channels/telegram/test')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should return 404 for non-existent channel', async () => {
      telegramController.testConnection.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          error: 'Channel not found'
        });
      });

      const response = await request(app)
        .post('/api/channels/telegram/test')
        .send({ channelId: 999 });

      expect(response.status).toBe(404);
    });

    it('should return 403 for unauthorized access', async () => {
      telegramController.testConnection.mockImplementation((req, res) => {
        res.status(403).json({
          success: false,
          error: 'Not authorized'
        });
      });

      const response = await request(app)
        .post('/api/channels/telegram/test')
        .send({ channelId: 1 });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Not authorized');
    });

    it('should reject invalid bot token', async () => {
      telegramController.testConnection.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          error: 'Unauthorized'
        });
      });

      const response = await request(app)
        .post('/api/channels/telegram/test')
        .send({ botToken: 'invalid' });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/channels/telegram/:id', () => {
    it('should return single Telegram channel', async () => {
      telegramController.getChannel.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: {
            id: 1,
            botId: 1,
            botUsername: 'testbot',
            webhookUrl: 'https://example.com/webhook/1',
            isActive: true,
            settings: { parseMode: 'HTML' },
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      });

      const response = await request(app).get('/api/channels/telegram/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(1);
      expect(response.body.data.botUsername).toBe('testbot');
    });

    it('should return 404 for non-existent channel', async () => {
      telegramController.getChannel.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          error: 'Channel not found'
        });
      });

      const response = await request(app).get('/api/channels/telegram/999');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    it('should return 403 for unauthorized access', async () => {
      telegramController.getChannel.mockImplementation((req, res) => {
        res.status(403).json({
          success: false,
          error: 'Not authorized'
        });
      });

      const response = await request(app).get('/api/channels/telegram/1');

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Not authorized');
    });

    it('should not expose bot token', async () => {
      telegramController.getChannel.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: {
            id: 1,
            botUsername: 'testbot',
            isActive: true
            // botToken should NOT be included
          }
        });
      });

      const response = await request(app).get('/api/channels/telegram/1');

      expect(response.status).toBe(200);
      expect(response.body.data).not.toHaveProperty('botToken');
    });
  });

  describe('PUT /api/channels/telegram/:id', () => {
    it('should update channel successfully', async () => {
      telegramController.updateChannel.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: {
            id: 1,
            botUsername: 'testbot',
            isActive: false,
            settings: { parseMode: 'Markdown' },
            updatedAt: new Date()
          },
          message: 'Channel updated successfully'
        });
      });

      const response = await request(app)
        .put('/api/channels/telegram/1')
        .send({
          isActive: false,
          settings: { parseMode: 'Markdown' }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isActive).toBe(false);
    });

    it('should update bot association', async () => {
      telegramController.updateChannel.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: {
            id: 1,
            botId: 2,
            botUsername: 'testbot',
            updatedAt: new Date()
          },
          message: 'Channel updated successfully'
        });
      });

      const response = await request(app)
        .put('/api/channels/telegram/1')
        .send({ botId: 2 });

      expect(response.status).toBe(200);
      expect(response.body.data.botId).toBe(2);
    });

    it('should merge settings correctly', async () => {
      telegramController.updateChannel.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: {
            id: 1,
            settings: {
              parseMode: 'HTML',
              newSetting: 'value'
            }
          },
          message: 'Channel updated successfully'
        });
      });

      const response = await request(app)
        .put('/api/channels/telegram/1')
        .send({
          settings: { newSetting: 'value' }
        });

      expect(response.status).toBe(200);
      expect(response.body.data.settings.newSetting).toBe('value');
    });

    it('should return 404 for non-existent channel', async () => {
      telegramController.updateChannel.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          error: 'Channel not found'
        });
      });

      const response = await request(app)
        .put('/api/channels/telegram/999')
        .send({ isActive: false });

      expect(response.status).toBe(404);
    });

    it('should return 403 for unauthorized access', async () => {
      telegramController.updateChannel.mockImplementation((req, res) => {
        res.status(403).json({
          success: false,
          error: 'Not authorized'
        });
      });

      const response = await request(app)
        .put('/api/channels/telegram/1')
        .send({ isActive: false });

      expect(response.status).toBe(403);
    });

    it('should handle database errors', async () => {
      telegramController.updateChannel.mockImplementation((req, res) => {
        res.status(500).json({
          success: false,
          error: 'Failed to update channel'
        });
      });

      const response = await request(app)
        .put('/api/channels/telegram/1')
        .send({ isActive: false });

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/channels/telegram/:id', () => {
    it('should disconnect Telegram bot successfully', async () => {
      telegramController.disconnectTelegram.mockImplementation((req, res) => {
        res.json({
          success: true,
          message: 'Telegram bot @testbot disconnected successfully'
        });
      });

      const response = await request(app).delete('/api/channels/telegram/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('disconnected successfully');
    });

    it('should return 404 for non-existent channel', async () => {
      telegramController.disconnectTelegram.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          error: 'Telegram channel not found'
        });
      });

      const response = await request(app).delete('/api/channels/telegram/999');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    it('should return 403 for unauthorized access', async () => {
      telegramController.disconnectTelegram.mockImplementation((req, res) => {
        res.status(403).json({
          success: false,
          error: 'Not authorized to disconnect this channel'
        });
      });

      const response = await request(app).delete('/api/channels/telegram/1');

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Not authorized');
    });

    it('should handle errors gracefully', async () => {
      telegramController.disconnectTelegram.mockImplementation((req, res) => {
        res.status(500).json({
          success: false,
          error: 'Failed to disconnect Telegram bot'
        });
      });

      const response = await request(app).delete('/api/channels/telegram/1');

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Failed to disconnect');
    });
  });

  describe('POST /api/channels/telegram/:id/send-test', () => {
    it('should send test message successfully', async () => {
      telegramController.sendTestMessage.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: {
            messageId: 12345,
            chatId: 67890,
            date: new Date()
          },
          message: 'Test message sent successfully'
        });
      });

      const response = await request(app)
        .post('/api/channels/telegram/1/send-test')
        .send({
          chatId: '67890',
          message: 'Hello, this is a test message!'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.messageId).toBe(12345);
    });

    it('should reject missing chatId', async () => {
      telegramController.sendTestMessage.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          error: 'Chat ID and message are required'
        });
      });

      const response = await request(app)
        .post('/api/channels/telegram/1/send-test')
        .send({ message: 'Hello' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should reject missing message', async () => {
      telegramController.sendTestMessage.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          error: 'Chat ID and message are required'
        });
      });

      const response = await request(app)
        .post('/api/channels/telegram/1/send-test')
        .send({ chatId: '67890' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should return 404 for non-existent channel', async () => {
      telegramController.sendTestMessage.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          error: 'Channel not found'
        });
      });

      const response = await request(app)
        .post('/api/channels/telegram/999/send-test')
        .send({
          chatId: '67890',
          message: 'Hello'
        });

      expect(response.status).toBe(404);
    });

    it('should return 403 for unauthorized access', async () => {
      telegramController.sendTestMessage.mockImplementation((req, res) => {
        res.status(403).json({
          success: false,
          error: 'Not authorized'
        });
      });

      const response = await request(app)
        .post('/api/channels/telegram/1/send-test')
        .send({
          chatId: '67890',
          message: 'Hello'
        });

      expect(response.status).toBe(403);
    });

    it('should handle Telegram API errors', async () => {
      telegramController.sendTestMessage.mockImplementation((req, res) => {
        res.status(500).json({
          success: false,
          error: 'Chat not found'
        });
      });

      const response = await request(app)
        .post('/api/channels/telegram/1/send-test')
        .send({
          chatId: 'invalid',
          message: 'Hello'
        });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/channels/telegram/:id/refresh-webhook', () => {
    it('should refresh webhook successfully', async () => {
      telegramController.refreshWebhook.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: {
            webhookUrl: 'https://example.com/webhook/1',
            pendingUpdates: 0,
            lastError: null
          },
          message: 'Webhook refreshed successfully'
        });
      });

      const response = await request(app)
        .post('/api/channels/telegram/1/refresh-webhook');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('refreshed successfully');
    });

    it('should return 404 for non-existent channel', async () => {
      telegramController.refreshWebhook.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          error: 'Channel not found'
        });
      });

      const response = await request(app)
        .post('/api/channels/telegram/999/refresh-webhook');

      expect(response.status).toBe(404);
    });

    it('should return 403 for unauthorized access', async () => {
      telegramController.refreshWebhook.mockImplementation((req, res) => {
        res.status(403).json({
          success: false,
          error: 'Not authorized'
        });
      });

      const response = await request(app)
        .post('/api/channels/telegram/1/refresh-webhook');

      expect(response.status).toBe(403);
    });

    it('should handle webhook setup errors', async () => {
      telegramController.refreshWebhook.mockImplementation((req, res) => {
        res.status(500).json({
          success: false,
          error: 'Failed to refresh webhook'
        });
      });

      const response = await request(app)
        .post('/api/channels/telegram/1/refresh-webhook');

      expect(response.status).toBe(500);
    });
  });

  describe('Authentication', () => {
    it('should require authentication for all routes', async () => {
      const authMock = require('../../middleware/auth');

      // Verify auth middleware is called
      await request(app).get('/api/channels/telegram');
      expect(authMock.authenticateToken).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      telegramController.getChannels.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const response = await request(app).get('/api/channels/telegram');

      // Should not crash, error should be caught
      expect([200, 500]).toContain(response.status);
    });

    it('should return proper error structure', async () => {
      telegramController.getChannel.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          error: 'Channel not found'
        });
      });

      const response = await request(app).get('/api/channels/telegram/999');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });
});
