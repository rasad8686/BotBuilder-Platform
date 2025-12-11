/**
 * Channel Webhooks Routes Tests
 * Tests for server/routes/channelWebhooks.js
 */

jest.mock('../../channels/core/ChannelManager', () => ({
  registerHandler: jest.fn(),
  processWebhook: jest.fn().mockResolvedValue([])
}));

jest.mock('../../channels/providers/WhatsAppProvider', () => {
  return jest.fn().mockImplementation(() => ({
    handleChallenge: jest.fn((query, token) => {
      if (query['hub.verify_token'] === token && query['hub.mode'] === 'subscribe') {
        return query['hub.challenge'];
      }
      return null;
    }),
    verify: jest.fn(() => true)
  }));
});

jest.mock('../../channels/providers/InstagramProvider', () => {
  return jest.fn().mockImplementation(() => ({
    handleChallenge: jest.fn((query, token) => {
      if (query['hub.verify_token'] === token && query['hub.mode'] === 'subscribe') {
        return query['hub.challenge'];
      }
      return null;
    }),
    verify: jest.fn(() => true)
  }));
});

jest.mock('../../models/Channel', () => ({
  findById: jest.fn()
}));

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Mock env vars
process.env.WHATSAPP_VERIFY_TOKEN = 'whatsapp_test_token';
process.env.INSTAGRAM_VERIFY_TOKEN = 'instagram_test_token';

const express = require('express');
const request = require('supertest');
const Channel = require('../../models/Channel');
const db = require('../../db');
const channelWebhooksRouter = require('../../routes/channelWebhooks');

const app = express();
app.use(express.json());
app.use('/webhooks', channelWebhooksRouter);

describe('Channel Webhooks Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('WhatsApp Webhooks', () => {
    describe('GET /webhooks/whatsapp', () => {
      it('should verify webhook with valid token', async () => {
        const response = await request(app)
          .get('/webhooks/whatsapp')
          .query({
            'hub.mode': 'subscribe',
            'hub.verify_token': 'whatsapp_test_token',
            'hub.challenge': 'challenge_string'
          });

        expect(response.status).toBe(200);
        expect(response.text).toBe('challenge_string');
      });

      it('should reject invalid token', async () => {
        const response = await request(app)
          .get('/webhooks/whatsapp')
          .query({
            'hub.mode': 'subscribe',
            'hub.verify_token': 'invalid_token',
            'hub.challenge': 'challenge_string'
          });

        expect(response.status).toBe(403);
      });
    });

    describe('POST /webhooks/whatsapp', () => {
      it('should accept webhook and respond quickly', async () => {
        const response = await request(app)
          .post('/webhooks/whatsapp')
          .send({
            entry: [{
              changes: [{
                value: { messages: [{ text: { body: 'Hello' } }] }
              }]
            }]
          });

        expect(response.status).toBe(200);
        expect(response.text).toBe('EVENT_RECEIVED');
      });
    });
  });

  describe('Instagram Webhooks', () => {
    describe('GET /webhooks/instagram', () => {
      it('should verify webhook with valid token', async () => {
        const response = await request(app)
          .get('/webhooks/instagram')
          .query({
            'hub.mode': 'subscribe',
            'hub.verify_token': 'instagram_test_token',
            'hub.challenge': 'challenge_123'
          });

        expect(response.status).toBe(200);
        expect(response.text).toBe('challenge_123');
      });

      it('should reject invalid token', async () => {
        const response = await request(app)
          .get('/webhooks/instagram')
          .query({
            'hub.mode': 'subscribe',
            'hub.verify_token': 'wrong_token',
            'hub.challenge': 'challenge_123'
          });

        expect(response.status).toBe(403);
      });
    });

    describe('POST /webhooks/instagram', () => {
      it('should accept webhook and respond quickly', async () => {
        const response = await request(app)
          .post('/webhooks/instagram')
          .send({
            entry: [{
              messaging: [{
                message: { text: 'Hello' }
              }]
            }]
          });

        expect(response.status).toBe(200);
        expect(response.text).toBe('EVENT_RECEIVED');
      });
    });
  });

  describe('Telegram Webhooks', () => {
    describe('POST /webhooks/telegram/:botToken', () => {
      it('should accept webhook for valid bot', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{ id: 1, type: 'telegram', credentials: { bot_token: 'valid_token' } }]
        });

        const response = await request(app)
          .post('/webhooks/telegram/valid_token')
          .send({
            update_id: 123,
            message: { text: 'Hello' }
          });

        expect(response.status).toBe(200);
        expect(response.text).toBe('OK');
      });

      it('should return 404 for unknown bot', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .post('/webhooks/telegram/unknown_token')
          .send({});

        expect(response.status).toBe(404);
      });

      it('should handle errors', async () => {
        db.query.mockRejectedValueOnce(new Error('DB error'));

        const response = await request(app)
          .post('/webhooks/telegram/token')
          .send({});

        expect(response.status).toBe(500);
      });
    });
  });

  describe('Generic Channel Webhooks', () => {
    describe('POST /webhooks/channel/:channelId', () => {
      it('should accept webhook for valid channel', async () => {
        Channel.findById.mockResolvedValueOnce({
          id: 1,
          type: 'custom',
          webhook_secret: null
        });

        const response = await request(app)
          .post('/webhooks/channel/1')
          .send({ data: 'test' });

        expect(response.status).toBe(200);
        expect(response.text).toBe('OK');
      });

      it('should validate webhook secret', async () => {
        Channel.findById.mockResolvedValueOnce({
          id: 1,
          type: 'custom',
          webhook_secret: 'secret123'
        });

        const response = await request(app)
          .post('/webhooks/channel/1')
          .set('x-webhook-secret', 'secret123')
          .send({ data: 'test' });

        expect(response.status).toBe(200);
      });

      it('should reject invalid webhook secret', async () => {
        Channel.findById.mockResolvedValueOnce({
          id: 1,
          type: 'custom',
          webhook_secret: 'secret123'
        });

        const response = await request(app)
          .post('/webhooks/channel/1')
          .set('x-webhook-secret', 'wrong_secret')
          .send({ data: 'test' });

        expect(response.status).toBe(401);
      });

      it('should return 404 for unknown channel', async () => {
        Channel.findById.mockResolvedValueOnce(null);

        const response = await request(app)
          .post('/webhooks/channel/999')
          .send({});

        expect(response.status).toBe(404);
      });

      it('should handle errors', async () => {
        Channel.findById.mockRejectedValueOnce(new Error('DB error'));

        const response = await request(app)
          .post('/webhooks/channel/1')
          .send({});

        expect(response.status).toBe(500);
      });
    });
  });

  describe('Status & Testing', () => {
    describe('GET /webhooks/status', () => {
      it('should return webhook configuration status', async () => {
        const response = await request(app).get('/webhooks/status');

        expect(response.status).toBe(200);
        expect(response.body.whatsapp).toBeDefined();
        expect(response.body.instagram).toBeDefined();
        expect(response.body.telegram).toBeDefined();
      });
    });

    describe('POST /webhooks/test', () => {
      it('should echo back test webhook', async () => {
        const response = await request(app)
          .post('/webhooks/test')
          .send({ test: 'data' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.received.body.test).toBe('data');
      });
    });
  });
});
