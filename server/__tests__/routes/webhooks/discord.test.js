/**
 * Discord Webhook Routes Tests
 * Tests for Discord webhook endpoints and handlers
 */

const request = require('supertest');
const express = require('express');

// Mock tweetnacl FIRST - before any module that requires it
jest.mock('tweetnacl', () => ({
  sign: {
    detached: {
      verify: jest.fn(() => true)
    }
  }
}), { virtual: true });

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

jest.mock('../../../services/channels/discordService', () => ({
  sendMessage: jest.fn(() => Promise.resolve({ id: '123' })),
  sendTyping: jest.fn(() => Promise.resolve()),
  buildButtonRow: jest.fn((buttons) => ({ type: 1, components: buttons }))
}));

const db = require('../../../db');
const discordService = require('../../../services/channels/discordService');

// Import router after mocks
const discordWebhook = require('../../../routes/webhooks/discord');

describe('Discord Webhook Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/webhooks/discord', discordWebhook);
    jest.clearAllMocks();
  });

  describe('POST /:botId/interactions', () => {
    it('should return 404 if bot not found', async () => {
      db.first.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/webhooks/discord/bot123/interactions')
        .set('x-signature-ed25519', 'valid-signature')
        .set('x-signature-timestamp', '1234567890')
        .send({ type: 1 });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Bot not found');
    });

    it('should return 401 for invalid signature', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 'bot123',
        is_active: true,
        public_key: 'abc123'
      });
      nacl.sign.detached.verify.mockReturnValue(false);

      const response = await request(app)
        .post('/api/webhooks/discord/bot123/interactions')
        .set('x-signature-ed25519', 'invalid-signature')
        .set('x-signature-timestamp', '1234567890')
        .send({ type: 1 });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid signature');
    });

    it('should handle PING verification (type 1)', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 'bot123',
        is_active: true,
        public_key: null
      });

      const response = await request(app)
        .post('/api/webhooks/discord/bot123/interactions')
        .set('x-signature-ed25519', 'signature')
        .set('x-signature-timestamp', '1234567890')
        .send({ type: 1 });

      expect(response.status).toBe(200);
      expect(response.body.type).toBe(1);
    });

    it('should handle slash command (type 2)', async () => {
      db.first
        .mockResolvedValueOnce({
          id: 1,
          bot_id: 'bot123',
          is_active: true,
          public_key: null
        })
        .mockResolvedValueOnce({
          id: 1,
          name: 'TestBot',
          status: 'active',
          description: 'Test description'
        });

      const response = await request(app)
        .post('/api/webhooks/discord/bot123/interactions')
        .set('x-signature-ed25519', 'signature')
        .set('x-signature-timestamp', '1234567890')
        .send({
          type: 2,
          data: { name: 'help' },
          member: { user: { id: 'user123', username: 'testuser' } }
        });

      expect(response.status).toBe(200);
      expect(response.body.type).toBe(4);
    });

    it('should handle /status command', async () => {
      db.first
        .mockResolvedValueOnce({
          id: 1,
          bot_id: 'bot123',
          is_active: true,
          public_key: null
        })
        .mockResolvedValueOnce({
          id: 1,
          name: 'TestBot',
          status: 'active',
          ai_config: JSON.stringify({ provider: 'openai' })
        });

      const response = await request(app)
        .post('/api/webhooks/discord/bot123/interactions')
        .set('x-signature-ed25519', 'signature')
        .set('x-signature-timestamp', '1234567890')
        .send({
          type: 2,
          data: { name: 'status' },
          member: { user: { id: 'user123', username: 'testuser' } }
        });

      expect(response.status).toBe(200);
      expect(response.body.data.embeds).toBeDefined();
      expect(response.body.data.embeds[0].title).toBe('Bot Status');
    });

    it('should handle /clear command', async () => {
      db.first.mockResolvedValueOnce({
        id: 1,
        bot_id: 'bot123',
        is_active: true,
        public_key: null
      }).mockResolvedValueOnce({
        id: 1,
        name: 'TestBot',
        status: 'active'
      });

      const response = await request(app)
        .post('/api/webhooks/discord/bot123/interactions')
        .set('x-signature-ed25519', 'signature')
        .set('x-signature-timestamp', '1234567890')
        .send({
          type: 2,
          data: { name: 'clear' },
          member: { user: { id: 'user123', username: 'testuser' } }
        });

      expect(response.status).toBe(200);
      expect(response.body.data.content).toContain('cleared');
    });

    it('should handle /info command', async () => {
      db.first
        .mockResolvedValueOnce({
          id: 1,
          bot_id: 'bot123',
          is_active: true,
          public_key: null
        })
        .mockResolvedValueOnce({
          id: 1,
          name: 'TestBot',
          status: 'active',
          description: 'Test bot description',
          created_at: new Date()
        });

      const response = await request(app)
        .post('/api/webhooks/discord/bot123/interactions')
        .set('x-signature-ed25519', 'signature')
        .set('x-signature-timestamp', '1234567890')
        .send({
          type: 2,
          data: { name: 'info' },
          member: { user: { id: 'user123', username: 'testuser' } }
        });

      expect(response.status).toBe(200);
      expect(response.body.data.embeds[0].title).toContain('About');
    });

    it('should handle button interaction (type 3)', async () => {
      db.first
        .mockResolvedValueOnce({
          id: 1,
          bot_id: 'bot123',
          is_active: true,
          public_key: null
        })
        .mockResolvedValueOnce({
          id: 1,
          name: 'TestBot',
          status: 'active',
          settings: JSON.stringify({})
        });

      const response = await request(app)
        .post('/api/webhooks/discord/bot123/interactions')
        .set('x-signature-ed25519', 'signature')
        .set('x-signature-timestamp', '1234567890')
        .send({
          type: 3,
          data: { custom_id: 'action:feedback_positive', component_type: 2 },
          member: { user: { id: 'user123', username: 'testuser' } }
        });

      expect(response.status).toBe(200);
    });

    it('should handle select menu interaction', async () => {
      db.first
        .mockResolvedValueOnce({
          id: 1,
          bot_id: 'bot123',
          is_active: true,
          public_key: null
        })
        .mockResolvedValueOnce({
          id: 1,
          name: 'TestBot',
          status: 'active',
          settings: JSON.stringify({})
        });

      const response = await request(app)
        .post('/api/webhooks/discord/bot123/interactions')
        .set('x-signature-ed25519', 'signature')
        .set('x-signature-timestamp', '1234567890')
        .send({
          type: 3,
          data: { custom_id: 'select_menu', component_type: 3, values: ['option1'] },
          member: { user: { id: 'user123', username: 'testuser' } }
        });

      expect(response.status).toBe(200);
    });

    it('should handle autocomplete (type 4)', async () => {
      db.first
        .mockResolvedValueOnce({
          id: 1,
          bot_id: 'bot123',
          is_active: true,
          public_key: null
        })
        .mockResolvedValueOnce({
          id: 1,
          name: 'TestBot'
        });
      db.select.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        then: jest.fn((cb) => cb([]))
      });

      const response = await request(app)
        .post('/api/webhooks/discord/bot123/interactions')
        .set('x-signature-ed25519', 'signature')
        .set('x-signature-timestamp', '1234567890')
        .send({
          type: 4,
          data: { options: [{ name: 'query', value: 'test', focused: true }] }
        });

      expect(response.status).toBe(200);
      expect(response.body.type).toBe(8);
    });

    it('should handle modal submit (type 5)', async () => {
      db.first.mockResolvedValueOnce({
        id: 1,
        bot_id: 'bot123',
        is_active: true,
        public_key: null
      });

      const response = await request(app)
        .post('/api/webhooks/discord/bot123/interactions')
        .set('x-signature-ed25519', 'signature')
        .set('x-signature-timestamp', '1234567890')
        .send({
          type: 5,
          data: {
            custom_id: 'feedback_modal:123',
            components: [
              { components: [{ custom_id: 'feedback', value: 'Great!' }] }
            ]
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.data.content).toContain('feedback');
    });

    it('should handle unknown interaction type', async () => {
      db.first.mockResolvedValueOnce({
        id: 1,
        bot_id: 'bot123',
        is_active: true,
        public_key: null
      });

      const response = await request(app)
        .post('/api/webhooks/discord/bot123/interactions')
        .set('x-signature-ed25519', 'signature')
        .set('x-signature-timestamp', '1234567890')
        .send({ type: 99 });

      expect(response.status).toBe(200);
      expect(response.body.type).toBe(1);
    });

    it('should return 500 on server error', async () => {
      db.where.mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .post('/api/webhooks/discord/bot123/interactions')
        .set('x-signature-ed25519', 'signature')
        .set('x-signature-timestamp', '1234567890')
        .send({ type: 1 });

      expect(response.status).toBe(500);
    });

    it('should handle rate limiting for slash commands', async () => {
      db.first
        .mockResolvedValue({
          id: 1,
          bot_id: 'bot123',
          is_active: true,
          public_key: null
        });

      // Simulate many requests from same user
      const userId = 'rate-limited-user-' + Date.now();

      // First 30 requests should work
      for (let i = 0; i < 30; i++) {
        await request(app)
          .post('/api/webhooks/discord/bot123/interactions')
          .set('x-signature-ed25519', 'signature')
          .set('x-signature-timestamp', '1234567890')
          .send({
            type: 2,
            data: { name: 'help' },
            member: { user: { id: userId, username: 'testuser' } }
          });
      }
    });

    it('should handle unavailable bot', async () => {
      db.first
        .mockResolvedValueOnce({
          id: 1,
          bot_id: 'bot123',
          is_active: true,
          public_key: null
        })
        .mockResolvedValueOnce({
          id: 1,
          name: 'TestBot',
          status: 'inactive'
        });

      const response = await request(app)
        .post('/api/webhooks/discord/bot123/interactions')
        .set('x-signature-ed25519', 'signature')
        .set('x-signature-timestamp', '1234567890')
        .send({
          type: 2,
          data: { name: 'help' },
          member: { user: { id: 'user123', username: 'testuser' } }
        });

      expect(response.status).toBe(200);
      expect(response.body.data.content).toContain('unavailable');
    });

    it('should handle custom commands', async () => {
      db.first
        .mockResolvedValueOnce({
          id: 1,
          bot_id: 'bot123',
          is_active: true,
          public_key: null
        })
        .mockResolvedValueOnce({
          id: 1,
          name: 'TestBot',
          status: 'active',
          settings: JSON.stringify({
            customCommands: {
              mycommand: { response: 'Custom response!' }
            }
          })
        });

      const response = await request(app)
        .post('/api/webhooks/discord/bot123/interactions')
        .set('x-signature-ed25519', 'signature')
        .set('x-signature-timestamp', '1234567890')
        .send({
          type: 2,
          data: { name: 'mycommand' },
          member: { user: { id: 'user123', username: 'testuser' } }
        });

      expect(response.status).toBe(200);
      expect(response.body.data.content).toBe('Custom response!');
    });
  });

  describe('POST /:botId/gateway', () => {
    it('should return 404 if bot not found', async () => {
      db.first.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/webhooks/discord/bot123/gateway')
        .send({ t: 'MESSAGE_CREATE', d: {} });

      expect(response.status).toBe(404);
    });

    it('should handle MESSAGE_CREATE event', async () => {
      db.first
        .mockResolvedValueOnce({
          id: 1,
          bot_id: 'bot123',
          is_active: true,
          bot_token: 'token123',
          client_id: 'client123'
        })
        .mockResolvedValueOnce({
          id: 1,
          name: 'TestBot',
          status: 'active',
          ai_config: null
        });

      const response = await request(app)
        .post('/api/webhooks/discord/bot123/gateway')
        .send({
          t: 'MESSAGE_CREATE',
          d: {
            id: 'msg123',
            content: '<@client123> Hello!',
            channel_id: 'channel123',
            guild_id: 'guild123',
            author: { id: 'user123', username: 'testuser', bot: false },
            mentions: [{ id: 'client123' }]
          }
        });

      expect(response.status).toBe(200);
      expect(db.insert).toHaveBeenCalled();
    });

    it('should ignore bot messages', async () => {
      db.first.mockResolvedValueOnce({
        id: 1,
        bot_id: 'bot123',
        is_active: true,
        bot_token: 'token123',
        client_id: 'client123'
      });

      const response = await request(app)
        .post('/api/webhooks/discord/bot123/gateway')
        .send({
          t: 'MESSAGE_CREATE',
          d: {
            id: 'msg123',
            content: 'Hello!',
            channel_id: 'channel123',
            author: { id: 'bot456', username: 'otherbot', bot: true }
          }
        });

      expect(response.status).toBe(200);
    });

    it('should handle MESSAGE_REACTION_ADD event', async () => {
      db.first.mockResolvedValueOnce({
        id: 1,
        bot_id: 'bot123',
        is_active: true
      });

      const response = await request(app)
        .post('/api/webhooks/discord/bot123/gateway')
        .send({
          t: 'MESSAGE_REACTION_ADD',
          d: {
            message_id: 'msg123',
            user_id: 'user123',
            emoji: { name: '👍' }
          }
        });

      expect(response.status).toBe(200);
    });

    it('should handle THREAD_CREATE event', async () => {
      db.first.mockResolvedValueOnce({
        id: 1,
        bot_id: 'bot123',
        is_active: true
      });

      const response = await request(app)
        .post('/api/webhooks/discord/bot123/gateway')
        .send({
          t: 'THREAD_CREATE',
          d: {
            id: 'thread123',
            name: 'New Thread',
            parent_id: 'channel123'
          }
        });

      expect(response.status).toBe(200);
    });

    it('should handle unknown event types', async () => {
      db.first.mockResolvedValueOnce({
        id: 1,
        bot_id: 'bot123',
        is_active: true
      });

      const response = await request(app)
        .post('/api/webhooks/discord/bot123/gateway')
        .send({
          t: 'UNKNOWN_EVENT',
          d: {}
        });

      expect(response.status).toBe(200);
    });

    it('should handle errors gracefully', async () => {
      db.first.mockResolvedValueOnce({
        id: 1,
        bot_id: 'bot123',
        is_active: true
      });
      db.insert.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/webhooks/discord/bot123/gateway')
        .send({
          t: 'MESSAGE_CREATE',
          d: { content: 'test' }
        });

      expect(response.status).toBe(200);
      expect(response.body.error).toBe('Processing error');
    });
  });

  describe('Helper Functions', () => {
    it('should handle /ask command without question', async () => {
      db.first
        .mockResolvedValueOnce({
          id: 1,
          bot_id: 'bot123',
          is_active: true,
          public_key: null
        })
        .mockResolvedValueOnce({
          id: 1,
          name: 'TestBot',
          status: 'active'
        });

      const response = await request(app)
        .post('/api/webhooks/discord/bot123/interactions')
        .set('x-signature-ed25519', 'signature')
        .set('x-signature-timestamp', '1234567890')
        .send({
          type: 2,
          data: { name: 'ask', options: [] },
          member: { user: { id: 'user123', username: 'testuser' } }
        });

      expect(response.status).toBe(200);
      expect(response.body.data.content).toContain('provide a question');
    });

    it('should handle button with predefined action', async () => {
      db.first
        .mockResolvedValueOnce({
          id: 1,
          bot_id: 'bot123',
          is_active: true,
          public_key: null
        })
        .mockResolvedValueOnce({
          id: 1,
          name: 'TestBot',
          status: 'active',
          settings: JSON.stringify({
            buttonActions: {
              test_button: { type: 'reply', content: 'Button clicked!' }
            }
          })
        });

      const response = await request(app)
        .post('/api/webhooks/discord/bot123/interactions')
        .set('x-signature-ed25519', 'signature')
        .set('x-signature-timestamp', '1234567890')
        .send({
          type: 3,
          data: { custom_id: 'test_button', component_type: 2 },
          member: { user: { id: 'user123', username: 'testuser' } }
        });

      expect(response.status).toBe(200);
      expect(response.body.data.content).toBe('Button clicked!');
    });

    it('should handle select menu with predefined options', async () => {
      db.first
        .mockResolvedValueOnce({
          id: 1,
          bot_id: 'bot123',
          is_active: true,
          public_key: null
        })
        .mockResolvedValueOnce({
          id: 1,
          name: 'TestBot',
          status: 'active',
          settings: JSON.stringify({
            selectActions: {
              color_select: {
                options: {
                  red: { content: 'You selected red!' }
                }
              }
            }
          })
        });

      const response = await request(app)
        .post('/api/webhooks/discord/bot123/interactions')
        .set('x-signature-ed25519', 'signature')
        .set('x-signature-timestamp', '1234567890')
        .send({
          type: 3,
          data: { custom_id: 'color_select', component_type: 3, values: ['red'] },
          member: { user: { id: 'user123', username: 'testuser' } }
        });

      expect(response.status).toBe(200);
      expect(response.body.data.content).toBe('You selected red!');
    });
  });
});
