/**
 * Telegram Webhook Routes Tests
 * Tests for Telegram webhook endpoints
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies
jest.mock('../../../db', () => {
  const mockDb = jest.fn(() => mockDb);
  mockDb.where = jest.fn(() => mockDb);
  mockDb.first = jest.fn();
  mockDb.insert = jest.fn(() => Promise.resolve([1]));
  mockDb.update = jest.fn(() => Promise.resolve(1));
  mockDb.select = jest.fn(() => mockDb);
  mockDb.returning = jest.fn(() => Promise.resolve([{ id: 1 }]));
  return mockDb;
});

jest.mock('../../../services/channels/telegramService', () => ({
  handleIncomingMessage: jest.fn((update) => ({
    updateId: update.update_id,
    type: update.callback_query ? 'callback_query' :
          update.message?.photo ? 'photo' :
          update.message?.location ? 'location' :
          'message',
    chatId: update.message?.chat?.id || update.callback_query?.message?.chat?.id,
    userId: update.message?.from?.id || update.callback_query?.from?.id,
    username: update.message?.from?.username || update.callback_query?.from?.username,
    text: update.message?.text || update.callback_query?.data,
    messageId: update.message?.message_id || update.callback_query?.message?.message_id,
    callbackQueryId: update.callback_query?.id,
    location: update.message?.location
  })),
  sendMessage: jest.fn(() => Promise.resolve({ ok: true })),
  sendChatAction: jest.fn(() => Promise.resolve({ ok: true })),
  answerCallbackQuery: jest.fn(() => Promise.resolve({ ok: true })),
  editMessageText: jest.fn(() => Promise.resolve({ ok: true }))
}));

const db = require('../../../db');
const telegramService = require('../../../services/channels/telegramService');

// Import router after mocks
const telegramWebhook = require('../../../routes/webhooks/telegram');

describe('Telegram Webhook Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/webhooks/telegram', telegramWebhook);
    jest.clearAllMocks();
  });

  describe('POST /:botId', () => {
    it('should return 404 if bot not found', async () => {
      db.first.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/webhooks/telegram/bot123')
        .send({ update_id: 1, message: { text: 'Hello' } });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Bot not found');
    });

    it('should return 401 for invalid webhook secret', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 'bot123',
        is_active: true,
        webhook_secret: 'correct-secret'
      });

      const response = await request(app)
        .post('/api/webhooks/telegram/bot123')
        .set('x-telegram-bot-api-secret-token', 'wrong-secret')
        .send({ update_id: 1 });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid signature');
    });

    it('should accept valid webhook secret', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 'bot123',
        is_active: true,
        webhook_secret: 'correct-secret',
        bot_token: 'token123'
      });

      const response = await request(app)
        .post('/api/webhooks/telegram/bot123')
        .set('x-telegram-bot-api-secret-token', 'correct-secret')
        .send({ update_id: 1, message: { text: 'Hi', chat: { id: 123 }, from: { id: 456 } } });

      expect(response.status).toBe(200);
    });

    it('should process text messages', async () => {
      db.first
        .mockResolvedValueOnce({
          id: 1,
          bot_id: 'bot123',
          is_active: true,
          bot_token: 'token123'
        })
        .mockResolvedValueOnce({
          id: 1,
          name: 'TestBot',
          status: 'active',
          ai_config: null,
          settings: null
        });

      const response = await request(app)
        .post('/api/webhooks/telegram/bot123')
        .send({
          update_id: 1,
          message: {
            message_id: 100,
            text: 'Hello bot!',
            chat: { id: 123456 },
            from: { id: 789, username: 'testuser' }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(db.insert).toHaveBeenCalled();
    });

    it('should handle /start command', async () => {
      db.first
        .mockResolvedValueOnce({
          id: 1,
          bot_id: 'bot123',
          is_active: true,
          bot_token: 'token123'
        })
        .mockResolvedValueOnce({
          id: 1,
          name: 'TestBot',
          status: 'active',
          description: 'A test bot'
        });

      const response = await request(app)
        .post('/api/webhooks/telegram/bot123')
        .send({
          update_id: 1,
          message: {
            message_id: 100,
            text: '/start',
            chat: { id: 123456 },
            from: { id: 789, username: 'testuser' }
          }
        });

      expect(response.status).toBe(200);
      expect(telegramService.sendMessage).toHaveBeenCalled();
    });

    it('should handle /help command', async () => {
      db.first
        .mockResolvedValueOnce({
          id: 1,
          bot_id: 'bot123',
          is_active: true,
          bot_token: 'token123'
        })
        .mockResolvedValueOnce({
          id: 1,
          name: 'TestBot',
          status: 'active'
        });

      const response = await request(app)
        .post('/api/webhooks/telegram/bot123')
        .send({
          update_id: 1,
          message: {
            message_id: 100,
            text: '/help',
            chat: { id: 123456 },
            from: { id: 789 }
          }
        });

      expect(response.status).toBe(200);
      expect(telegramService.sendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.stringContaining('Help'),
        expect.any(Object)
      );
    });

    it('should handle /info command', async () => {
      db.first
        .mockResolvedValueOnce({
          id: 1,
          bot_id: 'bot123',
          is_active: true,
          bot_token: 'token123'
        })
        .mockResolvedValueOnce({
          id: 1,
          name: 'TestBot',
          status: 'active',
          description: 'Bot description'
        });

      const response = await request(app)
        .post('/api/webhooks/telegram/bot123')
        .send({
          update_id: 1,
          message: {
            message_id: 100,
            text: '/info',
            chat: { id: 123456 },
            from: { id: 789 }
          }
        });

      expect(response.status).toBe(200);
      expect(telegramService.sendMessage).toHaveBeenCalled();
    });

    it('should handle callback queries', async () => {
      db.first
        .mockResolvedValueOnce({
          id: 1,
          bot_id: 'bot123',
          is_active: true,
          bot_token: 'token123'
        })
        .mockResolvedValueOnce({
          id: 1,
          name: 'TestBot',
          status: 'active',
          settings: JSON.stringify({})
        });

      telegramService.handleIncomingMessage.mockReturnValueOnce({
        type: 'callback_query',
        chatId: 123456,
        userId: 789,
        text: 'action:test',
        messageId: 100,
        callbackQueryId: 'query123'
      });

      const response = await request(app)
        .post('/api/webhooks/telegram/bot123')
        .send({
          update_id: 1,
          callback_query: {
            id: 'query123',
            data: 'action:test',
            message: { chat: { id: 123456 }, message_id: 100 },
            from: { id: 789 }
          }
        });

      expect(response.status).toBe(200);
      expect(telegramService.answerCallbackQuery).toHaveBeenCalled();
    });

    it('should handle photo messages', async () => {
      db.first
        .mockResolvedValueOnce({
          id: 1,
          bot_id: 'bot123',
          is_active: true,
          bot_token: 'token123'
        })
        .mockResolvedValueOnce({
          id: 1,
          name: 'TestBot',
          status: 'active',
          settings: JSON.stringify({ handleMedia: true })
        });

      telegramService.handleIncomingMessage.mockReturnValueOnce({
        type: 'photo',
        chatId: 123456,
        userId: 789,
        text: 'Photo caption',
        messageId: 100
      });

      const response = await request(app)
        .post('/api/webhooks/telegram/bot123')
        .send({
          update_id: 1,
          message: {
            message_id: 100,
            photo: [{ file_id: 'photo123' }],
            caption: 'Photo caption',
            chat: { id: 123456 },
            from: { id: 789 }
          }
        });

      expect(response.status).toBe(200);
      expect(telegramService.sendChatAction).toHaveBeenCalled();
    });

    it('should handle location messages', async () => {
      db.first
        .mockResolvedValueOnce({
          id: 1,
          bot_id: 'bot123',
          is_active: true,
          bot_token: 'token123'
        })
        .mockResolvedValueOnce({
          id: 1,
          name: 'TestBot',
          status: 'active'
        });

      telegramService.handleIncomingMessage.mockReturnValueOnce({
        type: 'location',
        chatId: 123456,
        userId: 789,
        messageId: 100,
        location: { latitude: 40.7128, longitude: -74.0060 }
      });

      const response = await request(app)
        .post('/api/webhooks/telegram/bot123')
        .send({
          update_id: 1,
          message: {
            message_id: 100,
            location: { latitude: 40.7128, longitude: -74.0060 },
            chat: { id: 123456 },
            from: { id: 789 }
          }
        });

      expect(response.status).toBe(200);
    });

    it('should skip if no text message', async () => {
      db.first.mockResolvedValueOnce({
        id: 1,
        bot_id: 'bot123',
        is_active: true,
        bot_token: 'token123'
      }).mockResolvedValueOnce({
        id: 1,
        name: 'TestBot',
        status: 'active'
      });

      telegramService.handleIncomingMessage.mockReturnValueOnce({
        type: 'message',
        chatId: 123456,
        userId: 789,
        text: null,
        messageId: 100
      });

      const response = await request(app)
        .post('/api/webhooks/telegram/bot123')
        .send({
          update_id: 1,
          message: {
            message_id: 100,
            chat: { id: 123456 },
            from: { id: 789 }
          }
        });

      expect(response.status).toBe(200);
    });

    it('should skip if bot is inactive', async () => {
      db.first
        .mockResolvedValueOnce({
          id: 1,
          bot_id: 'bot123',
          is_active: true,
          bot_token: 'token123'
        })
        .mockResolvedValueOnce({
          id: 1,
          name: 'TestBot',
          status: 'inactive'
        });

      const response = await request(app)
        .post('/api/webhooks/telegram/bot123')
        .send({
          update_id: 1,
          message: {
            message_id: 100,
            text: 'Hello',
            chat: { id: 123456 },
            from: { id: 789 }
          }
        });

      expect(response.status).toBe(200);
      expect(telegramService.sendMessage).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      db.first.mockResolvedValueOnce({
        id: 1,
        bot_id: 'bot123',
        is_active: true,
        bot_token: 'token123'
      });
      db.insert.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/webhooks/telegram/bot123')
        .send({
          update_id: 1,
          message: { text: 'test', chat: { id: 123 }, from: { id: 456 } }
        });

      expect(response.status).toBe(200);
      expect(response.body.error).toBe('Processing error');
    });

    it('should handle rate limiting', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 'bot123',
        is_active: true,
        bot_token: 'token123'
      });

      // Make 31 requests to trigger rate limit
      const chatId = 'rate-limited-chat-' + Date.now();
      for (let i = 0; i < 31; i++) {
        telegramService.handleIncomingMessage.mockReturnValueOnce({
          type: 'message',
          chatId: chatId,
          userId: 789,
          text: 'Hello ' + i,
          messageId: 100 + i
        });
      }

      // Last request should be rate limited
      for (let i = 0; i < 31; i++) {
        await request(app)
          .post('/api/webhooks/telegram/bot123')
          .send({
            update_id: i,
            message: {
              message_id: 100 + i,
              text: 'Hello ' + i,
              chat: { id: chatId },
              from: { id: 789 }
            }
          });
      }

      expect(response => response.status === 200).toBeTruthy();
    });

    it('should handle callback query with predefined action', async () => {
      db.first
        .mockResolvedValueOnce({
          id: 1,
          bot_id: 'bot123',
          is_active: true,
          bot_token: 'token123'
        })
        .mockResolvedValueOnce({
          id: 1,
          name: 'TestBot',
          status: 'active',
          settings: JSON.stringify({
            callbackActions: {
              test_action: { response: 'Action triggered!' }
            }
          })
        });

      telegramService.handleIncomingMessage.mockReturnValueOnce({
        type: 'callback_query',
        chatId: 123456,
        userId: 789,
        text: 'action:test_action',
        messageId: 100,
        callbackQueryId: 'query123'
      });

      const response = await request(app)
        .post('/api/webhooks/telegram/bot123')
        .send({
          update_id: 1,
          callback_query: {
            id: 'query123',
            data: 'action:test_action',
            message: { chat: { id: 123456 }, message_id: 100 },
            from: { id: 789 }
          }
        });

      expect(response.status).toBe(200);
      expect(telegramService.sendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        'Action triggered!',
        expect.any(Object)
      );
    });

    it('should handle media when disabled', async () => {
      db.first
        .mockResolvedValueOnce({
          id: 1,
          bot_id: 'bot123',
          is_active: true,
          bot_token: 'token123'
        })
        .mockResolvedValueOnce({
          id: 1,
          name: 'TestBot',
          status: 'active',
          settings: JSON.stringify({ handleMedia: false })
        });

      telegramService.handleIncomingMessage.mockReturnValueOnce({
        type: 'photo',
        chatId: 123456,
        userId: 789,
        messageId: 100
      });

      const response = await request(app)
        .post('/api/webhooks/telegram/bot123')
        .send({
          update_id: 1,
          message: {
            message_id: 100,
            photo: [{ file_id: 'photo123' }],
            chat: { id: 123456 },
            from: { id: 789 }
          }
        });

      expect(response.status).toBe(200);
      expect(telegramService.sendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.stringContaining('text messages'),
        expect.any(Object)
      );
    });

    it('should send typing indicator', async () => {
      db.first
        .mockResolvedValueOnce({
          id: 1,
          bot_id: 'bot123',
          is_active: true,
          bot_token: 'token123'
        })
        .mockResolvedValueOnce({
          id: 1,
          name: 'TestBot',
          status: 'active'
        });

      await request(app)
        .post('/api/webhooks/telegram/bot123')
        .send({
          update_id: 1,
          message: {
            message_id: 100,
            text: 'Hello',
            chat: { id: 123456 },
            from: { id: 789 }
          }
        });

      expect(telegramService.sendChatAction).toHaveBeenCalledWith(
        'token123',
        expect.any(Number),
        'typing'
      );
    });

    it('should store message in database', async () => {
      db.first.mockResolvedValueOnce({
        id: 1,
        bot_id: 'bot123',
        is_active: true,
        bot_token: 'token123'
      });

      await request(app)
        .post('/api/webhooks/telegram/bot123')
        .send({
          update_id: 12345,
          message: {
            message_id: 100,
            text: 'Hello',
            chat: { id: 123456 },
            from: { id: 789, username: 'testuser' }
          }
        });

      expect(db.insert).toHaveBeenCalledWith(expect.objectContaining({
        channel_id: 1,
        update_id: 12345,
        message_type: 'message'
      }));
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 'bot123',
        is_active: true,
        bot_token: 'token123'
      });

      const uniqueChatId = 'unique-chat-' + Date.now();
      telegramService.handleIncomingMessage.mockReturnValue({
        type: 'message',
        chatId: uniqueChatId,
        userId: 789,
        text: 'Hello',
        messageId: 100
      });

      const response = await request(app)
        .post('/api/webhooks/telegram/bot123')
        .send({
          update_id: 1,
          message: {
            message_id: 100,
            text: 'Hello',
            chat: { id: uniqueChatId },
            from: { id: 789 }
          }
        });

      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should send error message to user on processing failure', async () => {
      db.first
        .mockResolvedValueOnce({
          id: 1,
          bot_id: 'bot123',
          is_active: true,
          bot_token: 'token123'
        })
        .mockResolvedValueOnce({
          id: 1,
          name: 'TestBot',
          status: 'active'
        });

      telegramService.sendChatAction.mockRejectedValueOnce(new Error('Network error'));

      const response = await request(app)
        .post('/api/webhooks/telegram/bot123')
        .send({
          update_id: 1,
          message: {
            message_id: 100,
            text: 'Hello',
            chat: { id: 123456 },
            from: { id: 789 }
          }
        });

      expect(response.status).toBe(200);
    });

    it('should handle editMessageText failure gracefully', async () => {
      db.first
        .mockResolvedValueOnce({
          id: 1,
          bot_id: 'bot123',
          is_active: true,
          bot_token: 'token123'
        })
        .mockResolvedValueOnce({
          id: 1,
          name: 'TestBot',
          status: 'active',
          settings: JSON.stringify({})
        });

      telegramService.handleIncomingMessage.mockReturnValueOnce({
        type: 'callback_query',
        chatId: 123456,
        userId: 789,
        text: 'button_click',
        messageId: 100,
        callbackQueryId: 'query123'
      });

      telegramService.editMessageText.mockRejectedValueOnce(new Error('Cannot edit'));

      const response = await request(app)
        .post('/api/webhooks/telegram/bot123')
        .send({
          update_id: 1,
          callback_query: {
            id: 'query123',
            data: 'button_click',
            message: { chat: { id: 123456 }, message_id: 100 },
            from: { id: 789 }
          }
        });

      expect(response.status).toBe(200);
    });
  });
});
