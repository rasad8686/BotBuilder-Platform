/**
 * Facebook Webhook Routes Tests
 * Tests for Facebook Messenger webhook endpoints
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies
jest.mock('../../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../../channels/providers/FacebookProvider', () => {
  return jest.fn().mockImplementation(() => ({
    validateSignature: jest.fn(() => true),
    parseWebhookEvent: jest.fn(() => []),
    markSeen: jest.fn(() => Promise.resolve()),
    showTypingOn: jest.fn(() => Promise.resolve()),
    showTypingOff: jest.fn(() => Promise.resolve()),
    sendText: jest.fn(() => Promise.resolve({ success: true, messageId: 'msg123' })),
    getUserProfile: jest.fn(() => Promise.resolve({ success: true, profile: { firstName: 'Test', lastName: 'User' } }))
  }));
});

jest.mock('../../../services/channels/facebookService', () => ({}));

const db = require('../../../db');
const log = require('../../../utils/logger');
const FacebookProvider = require('../../../channels/providers/FacebookProvider');

// Import router after mocks
const facebookWebhook = require('../../../routes/webhooks/facebook');

describe('Facebook Webhook Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/webhooks/facebook', facebookWebhook);
    jest.clearAllMocks();
    process.env.FACEBOOK_VERIFY_TOKEN = 'test-verify-token';
    process.env.FACEBOOK_APP_SECRET = 'test-app-secret';
  });

  afterEach(() => {
    delete process.env.FACEBOOK_VERIFY_TOKEN;
    delete process.env.FACEBOOK_APP_SECRET;
  });

  describe('GET / (Webhook Verification)', () => {
    it('should verify webhook with correct token', async () => {
      const response = await request(app)
        .get('/webhooks/facebook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'test-verify-token',
          'hub.challenge': 'challenge123'
        });

      expect(response.status).toBe(200);
      expect(response.text).toBe('challenge123');
    });

    it('should reject webhook with incorrect token', async () => {
      const response = await request(app)
        .get('/webhooks/facebook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong-token',
          'hub.challenge': 'challenge123'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Verification failed');
    });

    it('should reject webhook with wrong mode', async () => {
      const response = await request(app)
        .get('/webhooks/facebook')
        .query({
          'hub.mode': 'unsubscribe',
          'hub.verify_token': 'test-verify-token',
          'hub.challenge': 'challenge123'
        });

      expect(response.status).toBe(403);
    });

    it('should handle verification error', async () => {
      // Simulate error by removing env variable and causing exception
      const response = await request(app)
        .get('/webhooks/facebook')
        .query({});

      expect(response.status).toBe(403);
    });
  });

  describe('POST / (Incoming Messages)', () => {
    it('should acknowledge event immediately', async () => {
      const response = await request(app)
        .post('/webhooks/facebook')
        .send({ object: 'page', entry: [] });

      expect(response.status).toBe(200);
      expect(response.text).toBe('EVENT_RECEIVED');
    });

    it('should skip non-page events', async () => {
      const response = await request(app)
        .post('/webhooks/facebook')
        .send({ object: 'user', entry: [] });

      expect(response.status).toBe(200);
    });

    it('should process page events', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          page_id: 'page123',
          access_token: 'token123',
          bot_id: 1,
          ai_enabled: true
        }]
      });

      const mockProvider = {
        parseWebhookEvent: jest.fn(() => []),
        validateSignature: jest.fn(() => true)
      };
      FacebookProvider.mockImplementation(() => mockProvider);

      const response = await request(app)
        .post('/webhooks/facebook')
        .send({
          object: 'page',
          entry: [{ id: 'page123' }]
        });

      expect(response.status).toBe(200);
    });

    it('should handle invalid signature', async () => {
      const mockProvider = {
        validateSignature: jest.fn(() => false)
      };
      FacebookProvider.mockImplementation(() => mockProvider);

      const response = await request(app)
        .post('/webhooks/facebook')
        .set('x-hub-signature-256', 'invalid')
        .send({ object: 'page', entry: [] });

      expect(response.status).toBe(200); // Still returns 200 for Facebook
    });

    it('should handle text message events', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          page_id: 'page123',
          access_token: 'token123',
          bot_id: 1
        }]
      });

      const mockProvider = {
        parseWebhookEvent: jest.fn(() => [{
          type: 'text',
          senderId: 'user123',
          text: 'Hello!',
          messageId: 'msg123'
        }]),
        validateSignature: jest.fn(() => true),
        markSeen: jest.fn(() => Promise.resolve()),
        showTypingOn: jest.fn(() => Promise.resolve()),
        showTypingOff: jest.fn(() => Promise.resolve()),
        sendText: jest.fn(() => Promise.resolve({ success: true }))
      };
      FacebookProvider.mockImplementation(() => mockProvider);

      const response = await request(app)
        .post('/webhooks/facebook')
        .send({
          object: 'page',
          entry: [{
            id: 'page123',
            messaging: [{
              sender: { id: 'user123' },
              message: { text: 'Hello!' }
            }]
          }]
        });

      expect(response.status).toBe(200);
    });

    it('should skip echo events', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, page_id: 'page123', access_token: 'token123' }]
      });

      const mockProvider = {
        parseWebhookEvent: jest.fn(() => [{
          type: 'echo',
          senderId: 'user123'
        }]),
        validateSignature: jest.fn(() => true)
      };
      FacebookProvider.mockImplementation(() => mockProvider);

      const response = await request(app)
        .post('/webhooks/facebook')
        .send({
          object: 'page',
          entry: [{ id: 'page123' }]
        });

      expect(response.status).toBe(200);
    });

    it('should handle attachment events', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          page_id: 'page123',
          access_token: 'token123'
        }]
      });

      const mockProvider = {
        parseWebhookEvent: jest.fn(() => [{
          type: 'attachments',
          senderId: 'user123',
          attachments: [{ type: 'image', url: 'http://example.com/image.jpg' }]
        }]),
        validateSignature: jest.fn(() => true),
        markSeen: jest.fn(() => Promise.resolve()),
        sendText: jest.fn(() => Promise.resolve({ success: true }))
      };
      FacebookProvider.mockImplementation(() => mockProvider);

      const response = await request(app)
        .post('/webhooks/facebook')
        .send({
          object: 'page',
          entry: [{ id: 'page123' }]
        });

      expect(response.status).toBe(200);
    });

    it('should handle postback events', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          page_id: 'page123',
          access_token: 'token123',
          welcome_message: 'Welcome!'
        }]
      });

      const mockProvider = {
        parseWebhookEvent: jest.fn(() => [{
          type: 'postback',
          senderId: 'user123',
          payload: 'GET_STARTED',
          title: 'Get Started'
        }]),
        validateSignature: jest.fn(() => true),
        markSeen: jest.fn(() => Promise.resolve()),
        sendText: jest.fn(() => Promise.resolve({ success: true }))
      };
      FacebookProvider.mockImplementation(() => mockProvider);

      const response = await request(app)
        .post('/webhooks/facebook')
        .send({
          object: 'page',
          entry: [{ id: 'page123' }]
        });

      expect(response.status).toBe(200);
    });

    it('should handle referral events', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          page_id: 'page123',
          access_token: 'token123'
        }]
      });

      const mockProvider = {
        parseWebhookEvent: jest.fn(() => [{
          type: 'referral',
          senderId: 'user123',
          ref: 'campaign123',
          source: 'AD',
          adId: 'ad123'
        }]),
        validateSignature: jest.fn(() => true),
        markSeen: jest.fn(() => Promise.resolve()),
        sendText: jest.fn(() => Promise.resolve({ success: true }))
      };
      FacebookProvider.mockImplementation(() => mockProvider);

      const response = await request(app)
        .post('/webhooks/facebook')
        .send({
          object: 'page',
          entry: [{ id: 'page123' }]
        });

      expect(response.status).toBe(200);
    });

    it('should handle delivery events', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, page_id: 'page123' }]
      });

      const mockProvider = {
        parseWebhookEvent: jest.fn(() => [{
          type: 'delivery',
          mids: ['msg123', 'msg456'],
          watermark: Date.now()
        }]),
        validateSignature: jest.fn(() => true),
        markSeen: jest.fn(() => Promise.resolve())
      };
      FacebookProvider.mockImplementation(() => mockProvider);

      const response = await request(app)
        .post('/webhooks/facebook')
        .send({
          object: 'page',
          entry: [{ id: 'page123' }]
        });

      expect(response.status).toBe(200);
    });

    it('should handle read events', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, page_id: 'page123' }]
      });

      const mockProvider = {
        parseWebhookEvent: jest.fn(() => [{
          type: 'read',
          watermark: Date.now()
        }]),
        validateSignature: jest.fn(() => true),
        markSeen: jest.fn(() => Promise.resolve())
      };
      FacebookProvider.mockImplementation(() => mockProvider);

      const response = await request(app)
        .post('/webhooks/facebook')
        .send({
          object: 'page',
          entry: [{ id: 'page123' }]
        });

      expect(response.status).toBe(200);
    });

    it('should handle reaction events', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, page_id: 'page123' }]
      });

      const mockProvider = {
        parseWebhookEvent: jest.fn(() => [{
          type: 'reaction',
          mid: 'msg123',
          reaction: 'love',
          emoji: '❤️',
          action: 'react'
        }]),
        validateSignature: jest.fn(() => true),
        markSeen: jest.fn(() => Promise.resolve())
      };
      FacebookProvider.mockImplementation(() => mockProvider);

      const response = await request(app)
        .post('/webhooks/facebook')
        .send({
          object: 'page',
          entry: [{ id: 'page123' }]
        });

      expect(response.status).toBe(200);
    });

    it('should skip unconfigured pages', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/webhooks/facebook')
        .send({
          object: 'page',
          entry: [{ id: 'unknown-page' }]
        });

      expect(response.status).toBe(200);
      expect(log.warn).toHaveBeenCalled();
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      const response = await request(app)
        .post('/webhooks/facebook')
        .send({
          object: 'page',
          entry: [{ id: 'page123' }]
        });

      expect(response.status).toBe(200);
    });

    it('should handle multiple requests', async () => {
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/webhooks/facebook')
          .send({
            object: 'page',
            entry: [{ id: 'page' + i }]
          });

        expect(response.status).toBe(200);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      db.query.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/webhooks/facebook')
        .send({
          object: 'page',
          entry: [{ id: 'page123' }]
        });

      expect(response.status).toBe(200); // Still return 200 for Facebook
    });

    it('should log errors', async () => {
      db.query.mockRejectedValue(new Error('Test error'));

      await request(app)
        .post('/webhooks/facebook')
        .send({
          object: 'page',
          entry: [{ id: 'page123' }]
        });

      // Error should be logged but not exposed
      expect(log.error).toHaveBeenCalled();
    });
  });
});
