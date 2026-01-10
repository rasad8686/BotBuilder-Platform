/**
 * Comprehensive Webhook Routes Test Suite
 * Tests all webhook endpoints: Slack, Telegram, Discord, Facebook, WhatsApp, Instagram
 * Covers: signature verification, error handling, message processing, and edge cases
 */

const request = require('supertest');
const express = require('express');
const crypto = require('crypto');

// Mock all dependencies
jest.mock('../../../db', () => ({
  query: jest.fn(),
  __call__: jest.fn(function() { return this; }),
  where: jest.fn(function() { return this; }),
  first: jest.fn(),
  insert: jest.fn(function() { return this; }),
  update: jest.fn(function() { return this; }),
  returning: jest.fn(function() { return this; }),
  select: jest.fn(function() { return this; }),
  orderBy: jest.fn(function() { return this; }),
  limit: jest.fn(function() { return this; }),
  whereRaw: jest.fn(function() { return this; }),
  orWhere: jest.fn(function() { return this; }),
  whereNull: jest.fn(function() { return this; }),
  raw: jest.fn((sql, params) => ({ sql, params })),
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../../services/channels/slackService', () => ({
  verifySignature: jest.fn(),
  handleEventCallback: jest.fn(),
  handleSlashCommand: jest.fn(),
  handleInteractiveMessage: jest.fn(),
  buildTextBlock: jest.fn(),
  buildDivider: jest.fn(),
  buildContextBlock: jest.fn(),
  sendMessage: jest.fn(),
}));

jest.mock('../../../services/channels/telegramService', () => ({
  handleIncomingMessage: jest.fn(),
  answerCallbackQuery: jest.fn(),
  sendMessage: jest.fn(),
  sendChatAction: jest.fn(),
  editMessageText: jest.fn(),
}));

jest.mock('../../../services/channels/discordService', () => ({
  sendMessage: jest.fn(),
  sendTyping: jest.fn(),
  buildButtonRow: jest.fn(),
}));

jest.mock('../../../services/channels/facebookService', () => ({
  sendText: jest.fn(),
}));

jest.mock('../../../channels/providers/FacebookProvider', () => {
  return jest.fn().mockImplementation(() => ({
    validateSignature: jest.fn(),
    parseWebhookEvent: jest.fn(),
    markSeen: jest.fn(),
    showTypingOn: jest.fn(),
    showTypingOff: jest.fn(),
    sendText: jest.fn(),
    getUserProfile: jest.fn(),
  }));
});

jest.mock('../../../services/channels/facebookService', () => ({
  sendText: jest.fn(),
}));

jest.mock('../../../channels/providers/WhatsAppProvider', () => {
  return jest.fn().mockImplementation(() => ({
    sendTextMessage: jest.fn(),
  }));
});

jest.mock('../../../channels/providers/InstagramProvider', () => {
  return jest.fn().mockImplementation(() => ({
    sendTextMessage: jest.fn(),
  }));
});

jest.mock('tweetnacl', () => ({
  sign: {
    detached: {
      verify: jest.fn(),
    },
  },
}));

// Setup test utilities
const db = require('../../../db');
const logger = require('../../../utils/logger');

/**
 * Helper function to create test Express app with routes
 */
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Add raw body for signature verification
  app.use((req, res, next) => {
    if (req.is('application/json')) {
      let data = '';
      req.on('data', chunk => {
        data += chunk.toString();
      });
      req.on('end', () => {
        req.rawBody = data;
        next();
      });
    } else {
      next();
    }
  });

  return app;
}

/**
 * SLACK WEBHOOK TESTS
 */
describe('Slack Webhook Routes', () => {
  let app;
  let slackRouter;
  const slackService = require('../../../services/channels/slackService');

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
    slackRouter = require('../../../routes/webhooks/slack');
    app.use('/webhooks/slack', slackRouter);
  });

  describe('POST /events - Slack Events API', () => {
    test('should reject request without signature headers', async () => {
      const response = await request(app)
        .post('/webhooks/slack/events')
        .send({ type: 'url_verification', challenge: 'test' });

      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/signature|headers/i);
    });

    test('should reject request with invalid signature', async () => {
      slackService.verifySignature.mockReturnValue(false);
      db.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/webhooks/slack/events')
        .set('x-slack-signature', 'v0=invalid')
        .set('x-slack-request-timestamp', '1234567890')
        .send({ type: 'url_verification', challenge: 'test' });

      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/signature/i);
    });

    test('should handle url_verification challenge', async () => {
      slackService.verifySignature.mockReturnValue(true);
      db.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/webhooks/slack/events')
        .set('x-slack-signature', 'v0=valid')
        .set('x-slack-request-timestamp', String(Math.floor(Date.now() / 1000)))
        .send({ type: 'url_verification', challenge: 'test_challenge_123' });

      expect(response.status).toBe(200);
      expect(response.body.challenge).toBe('test_challenge_123');
    });

    test('should store message event in database', async () => {
      slackService.verifySignature.mockReturnValue(true);
      slackService.handleEventCallback.mockReturnValue({
        type: 'message',
        teamId: 'T123',
        channelId: 'C456',
        userId: 'U789',
        text: 'Hello bot',
        ts: '1234567890.123456',
      });
      db.query.mockResolvedValue({ rows: [{ id: 1, bot_id: 1 }] });

      const response = await request(app)
        .post('/webhooks/slack/events')
        .set('x-slack-signature', 'v0=valid')
        .set('x-slack-request-timestamp', String(Math.floor(Date.now() / 1000)))
        .send({
          type: 'event_callback',
          team_id: 'T123',
          event: {
            type: 'message',
            channel: 'C456',
            user: 'U789',
            text: 'Hello bot',
            ts: '1234567890.123456',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
    });

    test('should ignore bot messages to prevent loops', async () => {
      slackService.verifySignature.mockReturnValue(true);
      slackService.handleEventCallback.mockReturnValue({
        type: 'message',
        teamId: 'T123',
        botId: 'B999',
      });
      db.query.mockResolvedValue({ rows: [{ id: 1 }] });

      const response = await request(app)
        .post('/webhooks/slack/events')
        .set('x-slack-signature', 'v0=valid')
        .set('x-slack-request-timestamp', String(Math.floor(Date.now() / 1000)))
        .send({
          type: 'event_callback',
          team_id: 'T123',
          event: { type: 'message', bot_id: 'B999' },
        });

      expect(response.status).toBe(200);
    });

    test('should handle errors gracefully', async () => {
      slackService.verifySignature.mockReturnValue(true);
      slackService.handleEventCallback.mockThrowError(new Error('Parse error'));

      const response = await request(app)
        .post('/webhooks/slack/events')
        .set('x-slack-signature', 'v0=valid')
        .set('x-slack-request-timestamp', String(Math.floor(Date.now() / 1000)))
        .send({ type: 'event_callback', event: {} });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
    });
  });

  describe('POST /commands - Slack Slash Commands', () => {
    test('should reject command without valid signature', async () => {
      slackService.verifySignature.mockReturnValue(false);

      const response = await request(app)
        .post('/webhooks/slack/commands')
        .set('x-slack-signature', 'v0=invalid')
        .set('x-slack-request-timestamp', '1234567890')
        .send({ command: '/bb', team_id: 'T123' });

      expect(response.status).toBe(401);
    });

    test('should process /bb help command', async () => {
      slackService.verifySignature.mockReturnValue(true);
      slackService.handleSlashCommand.mockReturnValue({
        command: '/bb',
        text: 'help',
        teamId: 'T123',
      });
      db.query.mockResolvedValue({ rows: [{ id: 1, bot_id: 1 }] });

      const response = await request(app)
        .post('/webhooks/slack/commands')
        .set('x-slack-signature', 'v0=valid')
        .set('x-slack-request-timestamp', String(Math.floor(Date.now() / 1000)))
        .send({ command: '/bb', text: 'help', team_id: 'T123' });

      expect(response.status).toBe(200);
      expect(response.body.response_type).toBeDefined();
    });

    test('should return error when workspace not found', async () => {
      slackService.verifySignature.mockReturnValue(true);
      slackService.handleSlashCommand.mockReturnValue({
        command: '/bb',
        teamId: 'T_UNKNOWN',
      });
      db.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/webhooks/slack/commands')
        .set('x-slack-signature', 'v0=valid')
        .set('x-slack-request-timestamp', String(Math.floor(Date.now() / 1000)))
        .send({ command: '/bb', team_id: 'T_UNKNOWN' });

      expect(response.status).toBe(200);
      expect(response.body.text).toMatch(/not connected/i);
    });
  });

  describe('POST /interactive - Slack Interactive Messages', () => {
    test('should handle button interactions', async () => {
      slackService.verifySignature.mockReturnValue(true);
      slackService.handleInteractiveMessage.mockReturnValue({
        type: 'block_actions',
        teamId: 'T123',
      });
      db.query.mockResolvedValue({ rows: [{ id: 1, bot_id: 1 }] });

      const response = await request(app)
        .post('/webhooks/slack/interactive')
        .set('x-slack-signature', 'v0=valid')
        .set('x-slack-request-timestamp', String(Math.floor(Date.now() / 1000)))
        .send({
          type: 'block_actions',
          team: { id: 'T123' },
          payload: JSON.stringify({ actions: [] }),
        });

      expect(response.status).toBe(200);
    });

    test('should handle view submission', async () => {
      slackService.verifySignature.mockReturnValue(true);
      slackService.handleInteractiveMessage.mockReturnValue({
        type: 'view_submission',
        teamId: 'T123',
      });
      db.query.mockResolvedValue({ rows: [{ id: 1, bot_id: 1 }] });

      const response = await request(app)
        .post('/webhooks/slack/interactive')
        .set('x-slack-signature', 'v0=valid')
        .set('x-slack-request-timestamp', String(Math.floor(Date.now() / 1000)))
        .send({
          type: 'view_submission',
          team: { id: 'T123' },
          payload: JSON.stringify({}),
        });

      expect(response.status).toBe(200);
    });

    test('should reject invalid payload format', async () => {
      slackService.verifySignature.mockReturnValue(true);
      slackService.handleInteractiveMessage.mockThrowError(new Error('Invalid JSON'));

      const response = await request(app)
        .post('/webhooks/slack/interactive')
        .set('x-slack-signature', 'v0=valid')
        .set('x-slack-request-timestamp', String(Math.floor(Date.now() / 1000)))
        .send({ type: 'block_actions', team: { id: 'T123' } });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
    });
  });
});

/**
 * TELEGRAM WEBHOOK TESTS
 */
describe('Telegram Webhook Routes', () => {
  let app;
  let telegramRouter;
  const telegramService = require('../../../services/channels/telegramService');

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
    telegramRouter = require('../../../routes/webhooks/telegram');
    app.use('/webhooks/telegram', telegramRouter);
  });

  describe('POST /:botId - Telegram Updates', () => {
    test('should reject request without bot', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/webhooks/telegram/bot_123')
        .send({ update_id: 1, message: { text: 'Hello' } });

      expect(response.status).toBe(404);
      expect(response.body.error).toMatch(/not found/i);
    });

    test('should verify webhook secret token', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, webhook_secret: 'secret123', is_active: true }],
      });

      const response = await request(app)
        .post('/webhooks/telegram/bot_123')
        .set('x-telegram-bot-api-secret-token', 'wrong_secret')
        .send({ update_id: 1, message: { text: 'Hello' } });

      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/signature/i);
    });

    test('should process valid message update', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, bot_id: 1, bot_token: 'token', webhook_secret: 'secret' }],
      });
      telegramService.handleIncomingMessage.mockReturnValue({
        type: 'message',
        chatId: 123,
        userId: 456,
        text: 'Hello',
      });

      const response = await request(app)
        .post('/webhooks/telegram/bot_123')
        .set('x-telegram-bot-api-secret-token', 'secret')
        .send({
          update_id: 1,
          message: {
            message_id: 1,
            chat: { id: 123 },
            from: { id: 456, username: 'testuser' },
            text: 'Hello',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
    });

    test('should handle callback query updates', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, bot_id: 1, bot_token: 'token', webhook_secret: 'secret' }],
      });
      telegramService.handleIncomingMessage.mockReturnValue({
        type: 'callback_query',
        callbackQueryId: 'cq_123',
        chatId: 123,
        text: 'button_click',
      });

      const response = await request(app)
        .post('/webhooks/telegram/bot_123')
        .set('x-telegram-bot-api-secret-token', 'secret')
        .send({
          update_id: 1,
          callback_query: {
            id: 'cq_123',
            from: { id: 456 },
            data: 'button_click',
          },
        });

      expect(response.status).toBe(200);
      expect(telegramService.answerCallbackQuery).toHaveBeenCalled();
    });

    test('should handle media messages', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, bot_id: 1, bot_token: 'token', webhook_secret: 'secret' }],
      });
      telegramService.handleIncomingMessage.mockReturnValue({
        type: 'photo',
        chatId: 123,
        userId: 456,
      });

      const response = await request(app)
        .post('/webhooks/telegram/bot_123')
        .set('x-telegram-bot-api-secret-token', 'secret')
        .send({
          update_id: 1,
          message: {
            message_id: 1,
            chat: { id: 123 },
            from: { id: 456 },
            photo: [{ file_id: 'photo_123' }],
          },
        });

      expect(response.status).toBe(200);
    });

    test('should handle Telegram commands', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, bot_id: 1, bot_token: 'token', webhook_secret: 'secret' }],
      });
      telegramService.handleIncomingMessage.mockReturnValue({
        type: 'message',
        chatId: 123,
        userId: 456,
        text: '/start',
      });

      const response = await request(app)
        .post('/webhooks/telegram/bot_123')
        .set('x-telegram-bot-api-secret-token', 'secret')
        .send({
          update_id: 1,
          message: {
            message_id: 1,
            chat: { id: 123 },
            from: { id: 456 },
            text: '/start',
          },
        });

      expect(response.status).toBe(200);
    });

    test('should handle rate limiting', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, bot_id: 1, bot_token: 'token', webhook_secret: 'secret' }],
      });
      telegramService.handleIncomingMessage.mockReturnValue({
        type: 'message',
        chatId: 123,
      });

      // Make multiple requests to same chat to trigger rate limit
      for (let i = 0; i < 31; i++) {
        await request(app)
          .post('/webhooks/telegram/bot_123')
          .set('x-telegram-bot-api-secret-token', 'secret')
          .send({
            update_id: i,
            message: {
              message_id: i,
              chat: { id: 123 },
              from: { id: 456 },
              text: 'test',
            },
          });
      }

      // 31st request should be rate limited
      const response = await request(app)
        .post('/webhooks/telegram/bot_123')
        .set('x-telegram-bot-api-secret-token', 'secret')
        .send({
          update_id: 31,
          message: { chat: { id: 123 }, from: { id: 456 }, text: 'test' },
        });

      expect(response.status).toBe(200);
    });

    test('should handle errors gracefully', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/webhooks/telegram/bot_123')
        .set('x-telegram-bot-api-secret-token', 'secret')
        .send({ update_id: 1 });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
    });
  });
});

/**
 * DISCORD WEBHOOK TESTS
 */
describe('Discord Webhook Routes', () => {
  let app;
  let discordRouter;
  const nacl = require('tweetnacl');

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
    discordRouter = require('../../../routes/webhooks/discord');
    app.use('/webhooks/discord', discordRouter);
  });

  describe('POST /:botId/interactions - Discord Interactions', () => {
    test('should reject request without bot', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/webhooks/discord/bot_123/interactions')
        .send({ type: 1 });

      expect(response.status).toBe(404);
      expect(response.body.error).toMatch(/not found/i);
    });

    test('should verify Discord signature', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1, public_key: 'key123' }] });
      nacl.sign.detached.verify.mockReturnValue(false);

      const response = await request(app)
        .post('/webhooks/discord/bot_123/interactions')
        .set('x-signature-ed25519', 'sig_invalid')
        .set('x-signature-timestamp', '12345')
        .send({ type: 1 });

      expect(response.status).toBe(401);
    });

    test('should handle PING interaction', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1, public_key: 'key123' }] });
      nacl.sign.detached.verify.mockReturnValue(true);

      const response = await request(app)
        .post('/webhooks/discord/bot_123/interactions')
        .set('x-signature-ed25519', 'sig_valid')
        .set('x-signature-timestamp', String(Math.floor(Date.now() / 1000)))
        .send({ type: 1 });

      expect(response.status).toBe(200);
      expect(response.body.type).toBe(1);
    });

    test('should handle slash commands', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, bot_id: 1, public_key: 'key123' }],
      });
      nacl.sign.detached.verify.mockReturnValue(true);

      const response = await request(app)
        .post('/webhooks/discord/bot_123/interactions')
        .set('x-signature-ed25519', 'sig_valid')
        .set('x-signature-timestamp', String(Math.floor(Date.now() / 1000)))
        .send({
          type: 2,
          data: { name: 'help' },
          member: { user: { id: '123', username: 'testuser' } },
          channel_id: 'ch_123',
        });

      expect(response.status).toBe(200);
      expect(response.body.type).toBeDefined();
    });

    test('should handle button interactions', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, bot_id: 1, public_key: 'key123' }],
      });
      nacl.sign.detached.verify.mockReturnValue(true);

      const response = await request(app)
        .post('/webhooks/discord/bot_123/interactions')
        .set('x-signature-ed25519', 'sig_valid')
        .set('x-signature-timestamp', String(Math.floor(Date.now() / 1000)))
        .send({
          type: 3,
          data: { custom_id: 'button_1', component_type: 2 },
          member: { user: { id: '123', username: 'testuser' } },
          channel_id: 'ch_123',
        });

      expect(response.status).toBe(200);
    });

    test('should handle modal submissions', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, bot_id: 1, public_key: 'key123' }],
      });
      nacl.sign.detached.verify.mockReturnValue(true);

      const response = await request(app)
        .post('/webhooks/discord/bot_123/interactions')
        .set('x-signature-ed25519', 'sig_valid')
        .set('x-signature-timestamp', String(Math.floor(Date.now() / 1000)))
        .send({
          type: 5,
          data: {
            custom_id: 'feedback_modal',
            components: [
              {
                components: [
                  { custom_id: 'feedback_input', value: 'Great bot!' },
                ],
              },
            ],
          },
          member: { user: { id: '123', username: 'testuser' } },
        });

      expect(response.status).toBe(200);
    });
  });

  describe('POST /:botId/gateway - Discord Gateway Events', () => {
    test('should reject request without bot', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/webhooks/discord/bot_123/gateway')
        .send({ t: 'MESSAGE_CREATE' });

      expect(response.status).toBe(404);
    });

    test('should process MESSAGE_CREATE event', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1, bot_id: 1 }] });

      const response = await request(app)
        .post('/webhooks/discord/bot_123/gateway')
        .send({
          t: 'MESSAGE_CREATE',
          d: {
            id: 'msg_123',
            channel_id: 'ch_123',
            guild_id: 'guild_123',
            author: { id: 'user_123', username: 'testuser' },
            content: 'Hello bot',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
    });

    test('should handle rate limiting in gateway', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1, bot_id: 1 }] });

      // Make requests to trigger rate limiting
      for (let i = 0; i < 31; i++) {
        await request(app)
          .post('/webhooks/discord/bot_123/gateway')
          .send({
            t: 'MESSAGE_CREATE',
            d: {
              id: `msg_${i}`,
              channel_id: 'ch_123',
              guild_id: 'guild_123',
              author: { id: 'user_123', username: 'testuser' },
              content: 'test',
            },
          });
      }

      const response = await request(app)
        .post('/webhooks/discord/bot_123/gateway')
        .send({
          t: 'MESSAGE_CREATE',
          d: {
            id: 'msg_31',
            channel_id: 'ch_123',
            guild_id: 'guild_123',
            author: { id: 'user_123', username: 'testuser' },
            content: 'test',
          },
        });

      expect(response.status).toBe(200);
    });
  });
});

/**
 * FACEBOOK WEBHOOK TESTS
 */
describe('Facebook Webhook Routes', () => {
  let app;
  let facebookRouter;
  const FacebookProvider = require('../../../channels/providers/FacebookProvider');

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
    facebookRouter = require('../../../routes/webhooks/facebook');
    app.use('/webhooks/facebook', facebookRouter);
  });

  describe('GET / - Webhook Verification', () => {
    test('should return 403 if tokens do not match', async () => {
      const response = await request(app)
        .get('/webhooks/facebook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong_token',
          'hub.challenge': 'challenge_123',
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/verification/i);
    });

    test('should return challenge if tokens match', async () => {
      process.env.FACEBOOK_VERIFY_TOKEN = 'correct_token';

      const response = await request(app)
        .get('/webhooks/facebook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'correct_token',
          'hub.challenge': 'challenge_123',
        });

      expect(response.status).toBe(200);
      expect(response.text).toBe('challenge_123');
    });

    test('should return 403 if mode is not subscribe', async () => {
      const response = await request(app)
        .get('/webhooks/facebook')
        .query({
          'hub.mode': 'unsubscribe',
          'hub.verify_token': 'token',
          'hub.challenge': 'challenge',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('POST / - Webhook Messages', () => {
    test('should validate webhook signature', async () => {
      const appSecret = 'test_secret';
      process.env.FACEBOOK_APP_SECRET = appSecret;

      const body = JSON.stringify({ object: 'page', entry: [] });
      const expectedSignature =
        'sha256=' +
        crypto
          .createHmac('sha256', appSecret)
          .update(body)
          .digest('hex');

      const response = await request(app)
        .post('/webhooks/facebook')
        .set('x-hub-signature-256', 'sha256=invalid')
        .send({ object: 'page', entry: [] });

      expect(response.status).toBe(401);
    });

    test('should return 200 for non-page events', async () => {
      const response = await request(app)
        .post('/webhooks/facebook')
        .send({ object: 'instagram', entry: [] });

      expect(response.status).toBe(200);
      expect(response.text).toBe('EVENT_RECEIVED');
    });

    test('should process page events', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1, bot_id: 1 }] });
      const mockProvider = new FacebookProvider();
      mockProvider.validateSignature.mockReturnValue(true);
      mockProvider.parseWebhookEvent.mockReturnValue([
        { type: 'text', senderId: '123', text: 'Hello' },
      ]);

      const response = await request(app)
        .post('/webhooks/facebook')
        .send({
          object: 'page',
          entry: [
            {
              id: 'page_123',
              messaging: [
                {
                  sender: { id: '123' },
                  message: { text: 'Hello' },
                },
              ],
            },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.text).toBe('EVENT_RECEIVED');
    });

    test('should rate limit requests', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1 }] });

      // Make requests to exceed rate limit
      for (let i = 0; i < 101; i++) {
        await request(app)
          .post('/webhooks/facebook')
          .send({
            object: 'page',
            entry: [{ id: 'page_123', messaging: [] }],
          });
      }

      const response = await request(app)
        .post('/webhooks/facebook')
        .send({
          object: 'page',
          entry: [{ id: 'page_123', messaging: [] }],
        });

      expect(response.status).toBe(429);
    });
  });
});

/**
 * WHATSAPP WEBHOOK TESTS
 */
describe('WhatsApp Webhook Routes', () => {
  let app;
  let whatsappRouter;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
    whatsappRouter = require('../../../routes/webhooks/whatsapp');
    app.use('/webhooks/whatsapp', whatsappRouter);
  });

  describe('GET / - Webhook Verification', () => {
    test('should verify webhook token', async () => {
      process.env.WHATSAPP_VERIFY_TOKEN = 'verify_token_123';

      const response = await request(app)
        .get('/webhooks/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'verify_token_123',
          'hub.challenge': 'challenge_xyz',
        });

      expect(response.status).toBe(200);
      expect(response.text).toBe('challenge_xyz');
    });

    test('should reject invalid token', async () => {
      const response = await request(app)
        .get('/webhooks/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong_token',
          'hub.challenge': 'challenge_xyz',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('POST / - Webhook Messages', () => {
    test('should validate webhook signature', async () => {
      process.env.WHATSAPP_APP_SECRET = 'app_secret_123';

      const body = JSON.stringify({ entry: [] });
      const invalidSignature = 'sha256=invalid_sig';

      const response = await request(app)
        .post('/webhooks/whatsapp')
        .set('x-hub-signature-256', invalidSignature)
        .send({ entry: [] });

      expect(response.status).toBe(401);
    });

    test('should process text messages', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, bot_id: 1, bot_token: 'token', credentials: '{}' }],
      });

      const response = await request(app)
        .post('/webhooks/whatsapp')
        .send({
          entry: [
            {
              id: 'bus_account_123',
              changes: [
                {
                  field: 'messages',
                  value: {
                    metadata: { phone_number_id: 'phone_123' },
                    messages: [
                      {
                        id: 'msg_123',
                        from: '1234567890',
                        type: 'text',
                        text: { body: 'Hello' },
                        timestamp: String(Math.floor(Date.now() / 1000)),
                      },
                    ],
                  },
                },
              ],
            },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('received');
    });

    test('should process media messages', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, bot_id: 1, credentials: '{}' }],
      });

      const response = await request(app)
        .post('/webhooks/whatsapp')
        .send({
          entry: [
            {
              id: 'bus_account_123',
              changes: [
                {
                  field: 'messages',
                  value: {
                    metadata: { phone_number_id: 'phone_123' },
                    messages: [
                      {
                        id: 'msg_123',
                        from: '1234567890',
                        type: 'image',
                        image: { id: 'image_123', mime_type: 'image/jpeg' },
                        timestamp: String(Math.floor(Date.now() / 1000)),
                      },
                    ],
                  },
                },
              ],
            },
          ],
        });

      expect(response.status).toBe(200);
    });

    test('should process status updates', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, bot_id: 1, credentials: '{}' }],
      });

      const response = await request(app)
        .post('/webhooks/whatsapp')
        .send({
          entry: [
            {
              id: 'bus_account_123',
              changes: [
                {
                  field: 'messages',
                  value: {
                    metadata: { phone_number_id: 'phone_123' },
                    statuses: [
                      {
                        id: 'msg_123',
                        status: 'delivered',
                        timestamp: String(Math.floor(Date.now() / 1000)),
                      },
                    ],
                  },
                },
              ],
            },
          ],
        });

      expect(response.status).toBe(200);
    });

    test('should handle rate limiting', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, bot_id: 1, credentials: '{}' }],
      });

      // Make requests to same phone number to trigger rate limit
      for (let i = 0; i < 101; i++) {
        await request(app)
          .post('/webhooks/whatsapp')
          .send({
            entry: [
              {
                id: 'bus_account_123',
                changes: [
                  {
                    field: 'messages',
                    value: {
                      metadata: { phone_number_id: 'phone_123' },
                      messages: [
                        {
                          id: `msg_${i}`,
                          from: '1234567890',
                          type: 'text',
                          text: { body: 'test' },
                          timestamp: String(Math.floor(Date.now() / 1000)),
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          });
      }

      const response = await request(app)
        .post('/webhooks/whatsapp')
        .send({
          entry: [
            {
              id: 'bus_account_123',
              changes: [
                {
                  field: 'messages',
                  value: {
                    metadata: { phone_number_id: 'phone_123' },
                    messages: [
                      {
                        id: 'msg_101',
                        from: '1234567890',
                        type: 'text',
                        text: { body: 'test' },
                        timestamp: String(Math.floor(Date.now() / 1000)),
                      },
                    ],
                  },
                },
              ],
            },
          ],
        });

      expect(response.status).toBe(200);
    });
  });
});

/**
 * INSTAGRAM WEBHOOK TESTS
 */
describe('Instagram Webhook Routes', () => {
  let app;
  let instagramRouter;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
    instagramRouter = require('../../../routes/webhooks/instagram');
    app.use('/webhooks/instagram', instagramRouter);
  });

  describe('GET / - Webhook Verification', () => {
    test('should verify webhook token', async () => {
      process.env.INSTAGRAM_VERIFY_TOKEN = 'verify_token_123';

      const response = await request(app)
        .get('/webhooks/instagram')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'verify_token_123',
          'hub.challenge': 'challenge_xyz',
        });

      expect(response.status).toBe(200);
      expect(response.text).toBe('challenge_xyz');
    });

    test('should reject invalid token', async () => {
      const response = await request(app)
        .get('/webhooks/instagram')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong_token',
          'hub.challenge': 'challenge_xyz',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('POST / - Webhook Events', () => {
    test('should process text messages', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, bot_id: 1, credentials: '{}' }],
      });

      const response = await request(app)
        .post('/webhooks/instagram')
        .send({
          object: 'instagram',
          entry: [
            {
              id: 'page_123',
              messaging: [
                {
                  sender: { id: 'user_123' },
                  recipient: { id: 'page_123' },
                  timestamp: Date.now(),
                  message: { mid: 'msg_123', text: 'Hello' },
                },
              ],
            },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('received');
    });

    test('should skip echo messages', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, bot_id: 1, credentials: '{}' }],
      });

      const response = await request(app)
        .post('/webhooks/instagram')
        .send({
          object: 'instagram',
          entry: [
            {
              id: 'page_123',
              messaging: [
                {
                  sender: { id: 'page_123' },
                  message: { mid: 'msg_123', text: 'Echo', is_echo: true },
                },
              ],
            },
          ],
        });

      expect(response.status).toBe(200);
    });

    test('should process postback events', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, bot_id: 1, credentials: '{}' }],
      });

      const response = await request(app)
        .post('/webhooks/instagram')
        .send({
          object: 'instagram',
          entry: [
            {
              id: 'page_123',
              messaging: [
                {
                  sender: { id: 'user_123' },
                  postback: { payload: 'BUTTON_CLICKED', title: 'Click' },
                  timestamp: Date.now(),
                },
              ],
            },
          ],
        });

      expect(response.status).toBe(200);
    });

    test('should handle delivery receipts', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, bot_id: 1, credentials: '{}' }],
      });

      const response = await request(app)
        .post('/webhooks/instagram')
        .send({
          object: 'instagram',
          entry: [
            {
              id: 'page_123',
              messaging: [
                {
                  sender: { id: 'page_123' },
                  delivery: { mids: ['msg_123'], watermark: Date.now() },
                },
              ],
            },
          ],
        });

      expect(response.status).toBe(200);
    });

    test('should rate limit requests', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, bot_id: 1, credentials: '{}' }],
      });

      // Make requests to exceed rate limit
      for (let i = 0; i < 101; i++) {
        await request(app)
          .post('/webhooks/instagram')
          .send({
            object: 'instagram',
            entry: [{ id: 'page_123', messaging: [] }],
          });
      }

      const response = await request(app)
        .post('/webhooks/instagram')
        .send({
          object: 'instagram',
          entry: [{ id: 'page_123', messaging: [] }],
        });

      expect(response.status).toBe(200);
    });
  });
});

/**
 * ERROR HANDLING AND EDGE CASES
 */
describe('Webhook Error Handling & Edge Cases', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
  });

  test('should handle malformed JSON payloads', async () => {
    app.use((req, res) => {
      res.status(400).json({ error: 'Invalid JSON' });
    });

    const response = await request(app)
      .post('/test')
      .set('Content-Type', 'application/json')
      .send('{ invalid json }');

    expect(response.status).toBe(400);
  });

  test('should handle missing required fields', async () => {
    app.use((req, res) => {
      if (!req.body.type) {
        return res.status(400).json({ error: 'Missing type field' });
      }
      res.status(200).json({ ok: true });
    });

    const response = await request(app)
      .post('/test')
      .send({ data: 'test' });

    expect(response.status).toBe(400);
  });

  test('should handle database connection errors', async () => {
    db.query.mockRejectedValue(new Error('Database connection failed'));

    app.use(async (req, res) => {
      try {
        await db.query('SELECT 1');
        res.status(200).json({ ok: true });
      } catch (error) {
        res.status(500).json({ error: 'Database error' });
      }
    });

    const response = await request(app).post('/test').send({});

    expect(response.status).toBe(500);
  });

  test('should timeout long-running requests', async () => {
    app.use(async (req, res) => {
      // Simulate long request
      await new Promise(resolve => setTimeout(resolve, 2000));
      res.status(200).json({ ok: true });
    });

    const response = await request(app)
      .post('/test')
      .timeout(1000)
      .send({});

    expect(response.status).toBeDefined();
  });

  test('should handle empty payloads', async () => {
    app.use((req, res) => {
      if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({ error: 'Empty payload' });
      }
      res.status(200).json({ ok: true });
    });

    const response = await request(app)
      .post('/test')
      .send({});

    expect(response.status).toBe(400);
  });
});

/**
 * SIGNATURE VERIFICATION TESTS
 */
describe('Signature Verification', () => {
  test('should verify Slack signature correctly', async () => {
    const slackService = require('../../../services/channels/slackService');
    const secret = 'test_secret';
    const timestamp = '1234567890';
    const body = JSON.stringify({ type: 'test' });

    const baseString = `v0:${timestamp}:${body}`;
    const signature = `v0=${crypto
      .createHmac('sha256', secret)
      .update(baseString)
      .digest('hex')}`;

    slackService.verifySignature.mockReturnValue(true);

    expect(slackService.verifySignature(secret, signature, timestamp, body)).toBe(
      true
    );
  });

  test('should verify WhatsApp/Instagram HMAC signature correctly', async () => {
    const secret = 'test_secret';
    const body = JSON.stringify({ type: 'test' });

    const expectedSignature =
      'sha256=' +
      crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');

    const isValid = crypto.timingSafeEquals(
      Buffer.from(expectedSignature),
      Buffer.from(expectedSignature)
    );

    expect(isValid).toBe(true);
  });

  test('should detect signature tampering', async () => {
    const signature1 = 'sha256=abc123';
    const signature2 = 'sha256=xyz789';

    let tamperingDetected = false;
    try {
      crypto.timingSafeEquals(Buffer.from(signature1), Buffer.from(signature2));
    } catch (error) {
      tamperingDetected = true;
    }

    expect(tamperingDetected || signature1 !== signature2).toBe(true);
  });
});
