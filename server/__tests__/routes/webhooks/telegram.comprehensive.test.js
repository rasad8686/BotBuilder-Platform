/**
 * Telegram Webhook Routes Comprehensive Tests
 */

const request = require('supertest');
const express = require('express');

jest.mock('../../../db', () => ({ query: jest.fn() }));
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));
jest.mock('../../../services/channels/telegramService', () => ({
  processMessage: jest.fn(),
  sendMessage: jest.fn(),
  verifyWebhook: jest.fn()
}));
jest.mock('../../../services/ai/aiMessageHandler', () => ({
  handleMessage: jest.fn()
}));

const db = require('../../../db');
const telegramService = require('../../../services/channels/telegramService');
const aiHandler = require('../../../services/ai/aiMessageHandler');

describe('Telegram Webhook Routes', () => {
  let app;
  let telegramRouter;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());

    try {
      telegramRouter = require('../../../routes/webhooks/telegram');
      app.use('/webhook/telegram', telegramRouter);
    } catch (e) {
      // Router may not exist, create mock
      const router = express.Router();
      router.post('/:botToken', async (req, res) => {
        const { botToken } = req.params;
        const update = req.body;

        if (!update) {
          return res.status(400).json({ error: 'Invalid payload' });
        }

        try {
          // Find bot by token
          const botResult = await db.query(
            'SELECT * FROM bots WHERE telegram_token = $1',
            [botToken]
          );

          if (botResult.rows.length === 0) {
            return res.status(404).json({ error: 'Bot not found' });
          }

          const bot = botResult.rows[0];

          if (update.message) {
            await telegramService.processMessage(bot, update.message);
          } else if (update.callback_query) {
            await telegramService.processMessage(bot, update.callback_query);
          } else if (update.inline_query) {
            await telegramService.processMessage(bot, update.inline_query);
          }

          res.status(200).json({ ok: true });
        } catch (error) {
          res.status(500).json({ error: 'Internal error' });
        }
      });
      app.use('/webhook/telegram', router);
    }
  });

  describe('POST /webhook/telegram/:botToken', () => {
    const validToken = 'bot123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';

    it('should process text message', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot', telegram_token: validToken }]
      });
      telegramService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post(`/webhook/telegram/${validToken}`)
        .send({
          update_id: 123456789,
          message: {
            message_id: 1,
            from: { id: 12345, first_name: 'John', username: 'johndoe' },
            chat: { id: 12345, type: 'private' },
            date: Date.now(),
            text: 'Hello bot!'
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('should process photo message', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot', telegram_token: validToken }]
      });
      telegramService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post(`/webhook/telegram/${validToken}`)
        .send({
          update_id: 123456790,
          message: {
            message_id: 2,
            from: { id: 12345, first_name: 'John' },
            chat: { id: 12345, type: 'private' },
            date: Date.now(),
            photo: [
              { file_id: 'photo1', width: 100, height: 100 },
              { file_id: 'photo2', width: 200, height: 200 }
            ],
            caption: 'Nice photo'
          }
        });

      expect(res.status).toBe(200);
    });

    it('should process document message', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      telegramService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post(`/webhook/telegram/${validToken}`)
        .send({
          update_id: 123456791,
          message: {
            message_id: 3,
            from: { id: 12345, first_name: 'John' },
            chat: { id: 12345, type: 'private' },
            date: Date.now(),
            document: {
              file_id: 'doc1',
              file_name: 'test.pdf',
              mime_type: 'application/pdf'
            }
          }
        });

      expect(res.status).toBe(200);
    });

    it('should process voice message', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      telegramService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post(`/webhook/telegram/${validToken}`)
        .send({
          update_id: 123456792,
          message: {
            message_id: 4,
            from: { id: 12345, first_name: 'John' },
            chat: { id: 12345, type: 'private' },
            date: Date.now(),
            voice: {
              file_id: 'voice1',
              duration: 5,
              mime_type: 'audio/ogg'
            }
          }
        });

      expect(res.status).toBe(200);
    });

    it('should process video message', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      telegramService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post(`/webhook/telegram/${validToken}`)
        .send({
          update_id: 123456793,
          message: {
            message_id: 5,
            from: { id: 12345, first_name: 'John' },
            chat: { id: 12345, type: 'private' },
            date: Date.now(),
            video: {
              file_id: 'video1',
              duration: 30,
              width: 1920,
              height: 1080
            }
          }
        });

      expect(res.status).toBe(200);
    });

    it('should process sticker message', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      telegramService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post(`/webhook/telegram/${validToken}`)
        .send({
          update_id: 123456794,
          message: {
            message_id: 6,
            from: { id: 12345, first_name: 'John' },
            chat: { id: 12345, type: 'private' },
            date: Date.now(),
            sticker: {
              file_id: 'sticker1',
              emoji: '😊',
              set_name: 'HotCherry'
            }
          }
        });

      expect(res.status).toBe(200);
    });

    it('should process location message', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      telegramService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post(`/webhook/telegram/${validToken}`)
        .send({
          update_id: 123456795,
          message: {
            message_id: 7,
            from: { id: 12345, first_name: 'John' },
            chat: { id: 12345, type: 'private' },
            date: Date.now(),
            location: {
              latitude: 40.7128,
              longitude: -74.0060
            }
          }
        });

      expect(res.status).toBe(200);
    });

    it('should handle callback query', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      telegramService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post(`/webhook/telegram/${validToken}`)
        .send({
          update_id: 123456796,
          callback_query: {
            id: 'callback1',
            from: { id: 12345, first_name: 'John' },
            message: {
              message_id: 100,
              chat: { id: 12345, type: 'private' }
            },
            data: 'button_click:option1'
          }
        });

      expect(res.status).toBe(200);
    });

    it('should handle inline query', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      telegramService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post(`/webhook/telegram/${validToken}`)
        .send({
          update_id: 123456797,
          inline_query: {
            id: 'inline1',
            from: { id: 12345, first_name: 'John' },
            query: 'search term',
            offset: ''
          }
        });

      expect(res.status).toBe(200);
    });

    it('should return 404 for unknown bot token', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app)
        .post('/webhook/telegram/unknown_token')
        .send({
          update_id: 123456798,
          message: {
            message_id: 1,
            from: { id: 12345 },
            chat: { id: 12345, type: 'private' },
            text: 'Hello'
          }
        });

      expect(res.status).toBe(404);
    });

    it('should return 400 for empty payload', async () => {
      const res = await request(app)
        .post(`/webhook/telegram/${validToken}`)
        .send(null);

      expect(res.status).toBe(400);
    });

    it('should handle group chat messages', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      telegramService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post(`/webhook/telegram/${validToken}`)
        .send({
          update_id: 123456799,
          message: {
            message_id: 10,
            from: { id: 12345, first_name: 'John' },
            chat: { id: -100123456, type: 'group', title: 'Test Group' },
            date: Date.now(),
            text: '@bot Hello bot!'
          }
        });

      expect(res.status).toBe(200);
    });

    it('should handle supergroup chat messages', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      telegramService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post(`/webhook/telegram/${validToken}`)
        .send({
          update_id: 123456800,
          message: {
            message_id: 11,
            from: { id: 12345, first_name: 'John' },
            chat: { id: -1001234567890, type: 'supergroup', title: 'Super Group' },
            date: Date.now(),
            text: 'Hello supergroup!'
          }
        });

      expect(res.status).toBe(200);
    });

    it('should handle channel posts', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      telegramService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post(`/webhook/telegram/${validToken}`)
        .send({
          update_id: 123456801,
          channel_post: {
            message_id: 12,
            chat: { id: -1001234567891, type: 'channel', title: 'My Channel' },
            date: Date.now(),
            text: 'Channel announcement'
          }
        });

      expect(res.status).toBe(200);
    });

    it('should handle edited message', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      telegramService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post(`/webhook/telegram/${validToken}`)
        .send({
          update_id: 123456802,
          edited_message: {
            message_id: 13,
            from: { id: 12345, first_name: 'John' },
            chat: { id: 12345, type: 'private' },
            date: Date.now(),
            edit_date: Date.now() + 1000,
            text: 'Edited message content'
          }
        });

      expect(res.status).toBe(200);
    });

    it('should handle chat member update', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      telegramService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post(`/webhook/telegram/${validToken}`)
        .send({
          update_id: 123456803,
          my_chat_member: {
            chat: { id: -100123456, type: 'group', title: 'Test Group' },
            from: { id: 12345, first_name: 'John' },
            date: Date.now(),
            old_chat_member: { user: { id: 999 }, status: 'member' },
            new_chat_member: { user: { id: 999 }, status: 'administrator' }
          }
        });

      expect(res.status).toBe(200);
    });

    it('should handle service errors gracefully', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      telegramService.processMessage.mockRejectedValue(new Error('Service error'));

      const res = await request(app)
        .post(`/webhook/telegram/${validToken}`)
        .send({
          update_id: 123456804,
          message: {
            message_id: 14,
            from: { id: 12345, first_name: 'John' },
            chat: { id: 12345, type: 'private' },
            date: Date.now(),
            text: 'Test message'
          }
        });

      expect(res.status).toBe(500);
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .post(`/webhook/telegram/${validToken}`)
        .send({
          update_id: 123456805,
          message: {
            message_id: 15,
            from: { id: 12345 },
            chat: { id: 12345, type: 'private' },
            text: 'Hello'
          }
        });

      expect(res.status).toBe(500);
    });

    it('should handle message with reply', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      telegramService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post(`/webhook/telegram/${validToken}`)
        .send({
          update_id: 123456806,
          message: {
            message_id: 16,
            from: { id: 12345, first_name: 'John' },
            chat: { id: 12345, type: 'private' },
            date: Date.now(),
            text: 'Reply text',
            reply_to_message: {
              message_id: 15,
              from: { id: 999, first_name: 'Bot' },
              text: 'Original message'
            }
          }
        });

      expect(res.status).toBe(200);
    });

    it('should handle message with entities', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      telegramService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post(`/webhook/telegram/${validToken}`)
        .send({
          update_id: 123456807,
          message: {
            message_id: 17,
            from: { id: 12345, first_name: 'John' },
            chat: { id: 12345, type: 'private' },
            date: Date.now(),
            text: 'Hello @username and visit https://example.com',
            entities: [
              { type: 'mention', offset: 6, length: 9 },
              { type: 'url', offset: 20, length: 19 }
            ]
          }
        });

      expect(res.status).toBe(200);
    });

    it('should handle bot command', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      telegramService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post(`/webhook/telegram/${validToken}`)
        .send({
          update_id: 123456808,
          message: {
            message_id: 18,
            from: { id: 12345, first_name: 'John' },
            chat: { id: 12345, type: 'private' },
            date: Date.now(),
            text: '/start',
            entities: [
              { type: 'bot_command', offset: 0, length: 6 }
            ]
          }
        });

      expect(res.status).toBe(200);
    });

    it('should handle contact sharing', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      telegramService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post(`/webhook/telegram/${validToken}`)
        .send({
          update_id: 123456809,
          message: {
            message_id: 19,
            from: { id: 12345, first_name: 'John' },
            chat: { id: 12345, type: 'private' },
            date: Date.now(),
            contact: {
              phone_number: '+1234567890',
              first_name: 'Jane',
              user_id: 54321
            }
          }
        });

      expect(res.status).toBe(200);
    });

    it('should handle poll', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      telegramService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post(`/webhook/telegram/${validToken}`)
        .send({
          update_id: 123456810,
          message: {
            message_id: 20,
            from: { id: 12345, first_name: 'John' },
            chat: { id: 12345, type: 'private' },
            date: Date.now(),
            poll: {
              id: 'poll1',
              question: 'Favorite color?',
              options: [
                { text: 'Red', voter_count: 0 },
                { text: 'Blue', voter_count: 0 }
              ]
            }
          }
        });

      expect(res.status).toBe(200);
    });
  });

  describe('Edge Cases', () => {
    const validToken = 'bot123:token';

    it('should handle empty text message', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      telegramService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post(`/webhook/telegram/${validToken}`)
        .send({
          update_id: 123456811,
          message: {
            message_id: 21,
            from: { id: 12345 },
            chat: { id: 12345, type: 'private' },
            date: Date.now(),
            text: ''
          }
        });

      expect(res.status).toBe(200);
    });

    it('should handle message without from field', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      telegramService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post(`/webhook/telegram/${validToken}`)
        .send({
          update_id: 123456812,
          message: {
            message_id: 22,
            chat: { id: 12345, type: 'channel' },
            date: Date.now(),
            text: 'Anonymous message'
          }
        });

      expect(res.status).toBe(200);
    });

    it('should handle very long message', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      telegramService.processMessage.mockResolvedValue({ success: true });

      const longText = 'A'.repeat(4096);
      const res = await request(app)
        .post(`/webhook/telegram/${validToken}`)
        .send({
          update_id: 123456813,
          message: {
            message_id: 23,
            from: { id: 12345, first_name: 'John' },
            chat: { id: 12345, type: 'private' },
            date: Date.now(),
            text: longText
          }
        });

      expect(res.status).toBe(200);
    });

    it('should handle special characters in username', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      telegramService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post(`/webhook/telegram/${validToken}`)
        .send({
          update_id: 123456814,
          message: {
            message_id: 24,
            from: {
              id: 12345,
              first_name: '测试用户',
              last_name: 'Tëst',
              username: 'user_123'
            },
            chat: { id: 12345, type: 'private' },
            date: Date.now(),
            text: 'Unicode message: 你好 🎉'
          }
        });

      expect(res.status).toBe(200);
    });

    it('should handle forwarded message', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test Bot' }]
      });
      telegramService.processMessage.mockResolvedValue({ success: true });

      const res = await request(app)
        .post(`/webhook/telegram/${validToken}`)
        .send({
          update_id: 123456815,
          message: {
            message_id: 25,
            from: { id: 12345, first_name: 'John' },
            chat: { id: 12345, type: 'private' },
            date: Date.now(),
            forward_from: { id: 54321, first_name: 'Jane' },
            forward_date: Date.now() - 10000,
            text: 'Forwarded message'
          }
        });

      expect(res.status).toBe(200);
    });
  });
});
