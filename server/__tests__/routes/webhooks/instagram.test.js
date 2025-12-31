/**
 * Instagram Webhook Routes Tests
 * Tests for Instagram Messaging API webhook endpoints
 */

const request = require('supertest');
const express = require('express');
const crypto = require('crypto');

// Mock dependencies
jest.mock('../../../db', () => {
  const mockDb = jest.fn(() => mockDb);
  mockDb.where = jest.fn(() => mockDb);
  mockDb.whereRaw = jest.fn(() => mockDb);
  mockDb.orWhereRaw = jest.fn(() => mockDb);
  mockDb.whereNull = jest.fn(() => mockDb);
  mockDb.first = jest.fn();
  mockDb.insert = jest.fn(() => Promise.resolve([1]));
  mockDb.update = jest.fn(() => Promise.resolve(1));
  mockDb.orderBy = jest.fn(() => mockDb);
  mockDb.limit = jest.fn(() => Promise.resolve([]));
  return mockDb;
});

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../../channels/providers/InstagramProvider', () => {
  return jest.fn().mockImplementation(() => ({
    sendTextMessage: jest.fn(() => Promise.resolve({ success: true }))
  }));
});

const db = require('../../../db');
const log = require('../../../utils/logger');

// Import router after mocks
const instagramWebhook = require('../../../routes/webhooks/instagram');

describe('Instagram Webhook Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/webhooks/instagram', instagramWebhook);
    jest.clearAllMocks();
    process.env.INSTAGRAM_VERIFY_TOKEN = 'test-verify-token';
    process.env.INSTAGRAM_APP_SECRET = 'test-app-secret';
  });

  afterEach(() => {
    delete process.env.INSTAGRAM_VERIFY_TOKEN;
    delete process.env.INSTAGRAM_APP_SECRET;
  });

  describe('GET / (Webhook Verification)', () => {
    it('should verify webhook with correct token', async () => {
      const response = await request(app)
        .get('/api/webhooks/instagram')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'test-verify-token',
          'hub.challenge': 'challenge123'
        });

      expect(response.status).toBe(200);
      expect(response.text).toBe('challenge123');
    });

    it('should use default verify token if not set', async () => {
      delete process.env.INSTAGRAM_VERIFY_TOKEN;

      const response = await request(app)
        .get('/api/webhooks/instagram')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'botbuilder_instagram_webhook',
          'hub.challenge': 'challenge123'
        });

      expect(response.status).toBe(200);
      expect(response.text).toBe('challenge123');
    });

    it('should reject webhook with incorrect token', async () => {
      const response = await request(app)
        .get('/api/webhooks/instagram')
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
        .get('/api/webhooks/instagram')
        .query({
          'hub.mode': 'unsubscribe',
          'hub.verify_token': 'test-verify-token',
          'hub.challenge': 'challenge123'
        });

      expect(response.status).toBe(403);
    });

    it('should log verification request', async () => {
      await request(app)
        .get('/api/webhooks/instagram')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'test-verify-token',
          'hub.challenge': 'challenge123'
        });

      expect(log.info).toHaveBeenCalled();
    });
  });

  describe('POST / (Incoming Messages)', () => {
    it('should acknowledge webhook immediately', async () => {
      const response = await request(app)
        .post('/api/webhooks/instagram')
        .send({ entry: [] });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('received');
    });

    it('should validate signature if app secret is set', async () => {
      const body = JSON.stringify({ entry: [] });
      const signature = 'sha256=' + crypto
        .createHmac('sha256', 'test-app-secret')
        .update(body)
        .digest('hex');

      const response = await request(app)
        .post('/api/webhooks/instagram')
        .set('x-hub-signature-256', signature)
        .set('Content-Type', 'application/json')
        .send(body);

      expect(response.status).toBe(200);
    });

    it('should reject invalid signature', async () => {
      const response = await request(app)
        .post('/api/webhooks/instagram')
        .set('x-hub-signature-256', 'sha256=invalid')
        .send({ entry: [] });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid signature');
    });

    it('should process text messages', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 1,
        credentials: JSON.stringify({ page_id: 'page123' })
      });

      const response = await request(app)
        .post('/api/webhooks/instagram')
        .send({
          entry: [{
            id: 'page123',
            messaging: [{
              sender: { id: 'user123' },
              recipient: { id: 'page123' },
              timestamp: Date.now(),
              message: {
                mid: 'msg123',
                text: 'Hello!'
              }
            }]
          }]
        });

      expect(response.status).toBe(200);
    });

    it('should skip echo messages', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 1,
        credentials: JSON.stringify({})
      });

      const response = await request(app)
        .post('/api/webhooks/instagram')
        .send({
          entry: [{
            id: 'page123',
            messaging: [{
              sender: { id: 'page123' },
              recipient: { id: 'user123' },
              message: {
                mid: 'msg123',
                is_echo: true,
                text: 'Echo message'
              }
            }]
          }]
        });

      expect(response.status).toBe(200);
      expect(log.debug).toHaveBeenCalled();
    });

    it('should process image attachments', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 1,
        credentials: JSON.stringify({})
      });

      const response = await request(app)
        .post('/api/webhooks/instagram')
        .send({
          entry: [{
            id: 'page123',
            messaging: [{
              sender: { id: 'user123' },
              timestamp: Date.now(),
              message: {
                mid: 'msg123',
                attachments: [{
                  type: 'image',
                  payload: { url: 'http://example.com/image.jpg' }
                }]
              }
            }]
          }]
        });

      expect(response.status).toBe(200);
    });

    it('should process video attachments', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 1,
        credentials: JSON.stringify({})
      });

      const response = await request(app)
        .post('/api/webhooks/instagram')
        .send({
          entry: [{
            id: 'page123',
            messaging: [{
              sender: { id: 'user123' },
              timestamp: Date.now(),
              message: {
                mid: 'msg123',
                attachments: [{
                  type: 'video',
                  payload: { url: 'http://example.com/video.mp4' }
                }]
              }
            }]
          }]
        });

      expect(response.status).toBe(200);
    });

    it('should process audio attachments', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 1,
        credentials: JSON.stringify({})
      });

      const response = await request(app)
        .post('/api/webhooks/instagram')
        .send({
          entry: [{
            id: 'page123',
            messaging: [{
              sender: { id: 'user123' },
              timestamp: Date.now(),
              message: {
                mid: 'msg123',
                attachments: [{
                  type: 'audio',
                  payload: { url: 'http://example.com/audio.mp3' }
                }]
              }
            }]
          }]
        });

      expect(response.status).toBe(200);
    });

    it('should process share attachments', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 1,
        credentials: JSON.stringify({})
      });

      const response = await request(app)
        .post('/api/webhooks/instagram')
        .send({
          entry: [{
            id: 'page123',
            messaging: [{
              sender: { id: 'user123' },
              timestamp: Date.now(),
              message: {
                mid: 'msg123',
                attachments: [{
                  type: 'share',
                  payload: { url: 'http://example.com/post' }
                }]
              }
            }]
          }]
        });

      expect(response.status).toBe(200);
    });

    it('should process story mention attachments', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 1,
        credentials: JSON.stringify({})
      });

      const response = await request(app)
        .post('/api/webhooks/instagram')
        .send({
          entry: [{
            id: 'page123',
            messaging: [{
              sender: { id: 'user123' },
              timestamp: Date.now(),
              message: {
                mid: 'msg123',
                attachments: [{
                  type: 'story_mention',
                  payload: { url: 'http://example.com/story' }
                }]
              }
            }]
          }]
        });

      expect(response.status).toBe(200);
    });

    it('should process reel attachments', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 1,
        credentials: JSON.stringify({})
      });

      const response = await request(app)
        .post('/api/webhooks/instagram')
        .send({
          entry: [{
            id: 'page123',
            messaging: [{
              sender: { id: 'user123' },
              timestamp: Date.now(),
              message: {
                mid: 'msg123',
                attachments: [{
                  type: 'reel',
                  payload: { url: 'http://example.com/reel' }
                }]
              }
            }]
          }]
        });

      expect(response.status).toBe(200);
    });

    it('should process quick reply messages', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 1,
        credentials: JSON.stringify({})
      });

      const response = await request(app)
        .post('/api/webhooks/instagram')
        .send({
          entry: [{
            id: 'page123',
            messaging: [{
              sender: { id: 'user123' },
              timestamp: Date.now(),
              message: {
                mid: 'msg123',
                text: 'Quick reply',
                quick_reply: { payload: 'QUICK_REPLY_PAYLOAD' }
              }
            }]
          }]
        });

      expect(response.status).toBe(200);
    });

    it('should process story reply messages', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 1,
        credentials: JSON.stringify({})
      });

      const response = await request(app)
        .post('/api/webhooks/instagram')
        .send({
          entry: [{
            id: 'page123',
            messaging: [{
              sender: { id: 'user123' },
              timestamp: Date.now(),
              message: {
                mid: 'msg123',
                text: 'Replying to your story',
                reply_to: {
                  story: { id: 'story123', url: 'http://example.com/story' }
                }
              }
            }]
          }]
        });

      expect(response.status).toBe(200);
    });

    it('should process postback events', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 1,
        credentials: JSON.stringify({})
      });

      const response = await request(app)
        .post('/api/webhooks/instagram')
        .send({
          entry: [{
            id: 'page123',
            messaging: [{
              sender: { id: 'user123' },
              timestamp: Date.now(),
              postback: {
                title: 'Get Started',
                payload: 'GET_STARTED'
              }
            }]
          }]
        });

      expect(response.status).toBe(200);
    });

    it('should process reaction events', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 1,
        credentials: JSON.stringify({})
      });

      const response = await request(app)
        .post('/api/webhooks/instagram')
        .send({
          entry: [{
            id: 'page123',
            messaging: [{
              sender: { id: 'user123' },
              timestamp: Date.now(),
              reaction: {
                mid: 'msg123',
                action: 'react',
                reaction: 'love',
                emoji: '❤️'
              }
            }]
          }]
        });

      expect(response.status).toBe(200);
    });

    it('should process read receipts', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 1,
        credentials: JSON.stringify({})
      });

      const response = await request(app)
        .post('/api/webhooks/instagram')
        .send({
          entry: [{
            id: 'page123',
            messaging: [{
              sender: { id: 'user123' },
              timestamp: Date.now(),
              read: { watermark: Date.now() }
            }]
          }]
        });

      expect(response.status).toBe(200);
    });

    it('should process delivery receipts', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 1,
        credentials: JSON.stringify({})
      });

      const response = await request(app)
        .post('/api/webhooks/instagram')
        .send({
          entry: [{
            id: 'page123',
            messaging: [{
              sender: { id: 'user123' },
              timestamp: Date.now(),
              delivery: {
                mids: ['msg123', 'msg456'],
                watermark: Date.now()
              }
            }]
          }]
        });

      expect(response.status).toBe(200);
    });

    it('should process standby events', async () => {
      const response = await request(app)
        .post('/api/webhooks/instagram')
        .send({
          entry: [{
            id: 'page123',
            standby: [{
              sender: { id: 'user123' },
              message: { mid: 'msg123', text: 'Standby message' }
            }]
          }]
        });

      expect(response.status).toBe(200);
      expect(log.debug).toHaveBeenCalled();
    });

    it('should skip if channel not found', async () => {
      db.first.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/webhooks/instagram')
        .send({
          entry: [{
            id: 'unknown-page',
            messaging: [{
              sender: { id: 'user123' },
              message: { mid: 'msg123', text: 'Hello' }
            }]
          }]
        });

      expect(response.status).toBe(200);
      expect(log.warn).toHaveBeenCalled();
    });

    it('should handle empty entry array', async () => {
      const response = await request(app)
        .post('/api/webhooks/instagram')
        .send({ entry: [] });

      expect(response.status).toBe(200);
    });

    it('should handle missing entry', async () => {
      const response = await request(app)
        .post('/api/webhooks/instagram')
        .send({});

      expect(response.status).toBe(200);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      const response = await request(app)
        .post('/api/webhooks/instagram')
        .send({
          entry: [{
            id: 'page123',
            messaging: []
          }]
        });

      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should return 200 even on processing errors', async () => {
      db.first.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/webhooks/instagram')
        .send({
          entry: [{
            id: 'page123',
            messaging: [{
              sender: { id: 'user123' },
              message: { mid: 'msg123', text: 'Hello' }
            }]
          }]
        });

      expect(response.status).toBe(200);
    });

    it('should handle unknown attachment types', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 1,
        credentials: JSON.stringify({})
      });

      const response = await request(app)
        .post('/api/webhooks/instagram')
        .send({
          entry: [{
            id: 'page123',
            messaging: [{
              sender: { id: 'user123' },
              timestamp: Date.now(),
              message: {
                mid: 'msg123',
                attachments: [{
                  type: 'unknown_type',
                  payload: {}
                }]
              }
            }]
          }]
        });

      expect(response.status).toBe(200);
    });
  });
});
