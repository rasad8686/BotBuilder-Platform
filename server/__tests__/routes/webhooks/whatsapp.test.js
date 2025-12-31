/**
 * WhatsApp Webhook Routes Tests
 * Tests for WhatsApp Cloud API webhook endpoints
 */

const request = require('supertest');
const express = require('express');
const crypto = require('crypto');

// Mock dependencies
jest.mock('../../../db', () => {
  const mockDb = jest.fn(() => mockDb);
  mockDb.where = jest.fn(() => mockDb);
  mockDb.whereRaw = jest.fn(() => mockDb);
  mockDb.orWhere = jest.fn(() => mockDb);
  mockDb.first = jest.fn();
  mockDb.insert = jest.fn(() => Promise.resolve([1]));
  mockDb.update = jest.fn(() => Promise.resolve(1));
  mockDb.orderBy = jest.fn(() => mockDb);
  mockDb.limit = jest.fn(() => Promise.resolve([]));
  mockDb.raw = jest.fn((sql, params) => ({ sql, params }));
  return mockDb;
});

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../../channels/providers/WhatsAppProvider', () => {
  return jest.fn().mockImplementation(() => ({
    sendTextMessage: jest.fn(() => Promise.resolve({ success: true }))
  }));
});

const db = require('../../../db');
const log = require('../../../utils/logger');

// Import router after mocks
const whatsappWebhook = require('../../../routes/webhooks/whatsapp');

describe('WhatsApp Webhook Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/webhooks/whatsapp', whatsappWebhook);
    jest.clearAllMocks();
    process.env.WHATSAPP_VERIFY_TOKEN = 'test-verify-token';
    process.env.WHATSAPP_APP_SECRET = 'test-app-secret';
  });

  afterEach(() => {
    delete process.env.WHATSAPP_VERIFY_TOKEN;
    delete process.env.WHATSAPP_APP_SECRET;
  });

  describe('GET / (Webhook Verification)', () => {
    it('should verify webhook with correct token', async () => {
      const response = await request(app)
        .get('/api/webhooks/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'test-verify-token',
          'hub.challenge': 'challenge123'
        });

      expect(response.status).toBe(200);
      expect(response.text).toBe('challenge123');
    });

    it('should use default verify token if not set', async () => {
      delete process.env.WHATSAPP_VERIFY_TOKEN;

      const response = await request(app)
        .get('/api/webhooks/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'botbuilder_whatsapp_webhook',
          'hub.challenge': 'challenge123'
        });

      expect(response.status).toBe(200);
      expect(response.text).toBe('challenge123');
    });

    it('should reject webhook with incorrect token', async () => {
      const response = await request(app)
        .get('/api/webhooks/whatsapp')
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
        .get('/api/webhooks/whatsapp')
        .query({
          'hub.mode': 'unsubscribe',
          'hub.verify_token': 'test-verify-token',
          'hub.challenge': 'challenge123'
        });

      expect(response.status).toBe(403);
    });

    it('should log verification request', async () => {
      await request(app)
        .get('/api/webhooks/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'test-verify-token',
          'hub.challenge': 'challenge123'
        });

      expect(log.info).toHaveBeenCalled();
    });

    it('should handle verification error', async () => {
      // Force error by making query throw
      const originalGet = app.get;

      const response = await request(app)
        .get('/api/webhooks/whatsapp')
        .query({});

      expect(response.status).toBe(403);
    });
  });

  describe('POST / (Incoming Messages)', () => {
    it('should acknowledge webhook immediately', async () => {
      const response = await request(app)
        .post('/api/webhooks/whatsapp')
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
        .post('/api/webhooks/whatsapp')
        .set('x-hub-signature-256', signature)
        .set('Content-Type', 'application/json')
        .send(body);

      expect(response.status).toBe(200);
    });

    it('should reject invalid signature', async () => {
      const response = await request(app)
        .post('/api/webhooks/whatsapp')
        .set('x-hub-signature-256', 'sha256=invalid')
        .send({ entry: [] });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid signature');
    });

    it('should process text messages', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 1,
        credentials: JSON.stringify({ phone_number_id: 'phone123' })
      });

      const response = await request(app)
        .post('/api/webhooks/whatsapp')
        .send({
          entry: [{
            id: 'business123',
            changes: [{
              field: 'messages',
              value: {
                metadata: {
                  phone_number_id: 'phone123',
                  display_phone_number: '+1234567890'
                },
                messages: [{
                  id: 'msg123',
                  from: '1234567890',
                  timestamp: '1234567890',
                  type: 'text',
                  text: { body: 'Hello!' }
                }],
                contacts: [{ profile: { name: 'John Doe' } }]
              }
            }]
          }]
        });

      expect(response.status).toBe(200);
    });

    it('should process image messages', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 1,
        credentials: JSON.stringify({})
      });

      const response = await request(app)
        .post('/api/webhooks/whatsapp')
        .send({
          entry: [{
            id: 'business123',
            changes: [{
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'phone123' },
                messages: [{
                  id: 'msg123',
                  from: '1234567890',
                  type: 'image',
                  image: { id: 'img123', mime_type: 'image/jpeg', caption: 'Photo' }
                }]
              }
            }]
          }]
        });

      expect(response.status).toBe(200);
    });

    it('should process video messages', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 1,
        credentials: JSON.stringify({})
      });

      const response = await request(app)
        .post('/api/webhooks/whatsapp')
        .send({
          entry: [{
            id: 'business123',
            changes: [{
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'phone123' },
                messages: [{
                  id: 'msg123',
                  from: '1234567890',
                  type: 'video',
                  video: { id: 'vid123', mime_type: 'video/mp4' }
                }]
              }
            }]
          }]
        });

      expect(response.status).toBe(200);
    });

    it('should process audio messages', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 1,
        credentials: JSON.stringify({})
      });

      const response = await request(app)
        .post('/api/webhooks/whatsapp')
        .send({
          entry: [{
            id: 'business123',
            changes: [{
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'phone123' },
                messages: [{
                  id: 'msg123',
                  from: '1234567890',
                  type: 'audio',
                  audio: { id: 'aud123', mime_type: 'audio/ogg' }
                }]
              }
            }]
          }]
        });

      expect(response.status).toBe(200);
    });

    it('should process document messages', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 1,
        credentials: JSON.stringify({})
      });

      const response = await request(app)
        .post('/api/webhooks/whatsapp')
        .send({
          entry: [{
            id: 'business123',
            changes: [{
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'phone123' },
                messages: [{
                  id: 'msg123',
                  from: '1234567890',
                  type: 'document',
                  document: { id: 'doc123', mime_type: 'application/pdf', filename: 'file.pdf' }
                }]
              }
            }]
          }]
        });

      expect(response.status).toBe(200);
    });

    it('should process location messages', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 1,
        credentials: JSON.stringify({})
      });

      const response = await request(app)
        .post('/api/webhooks/whatsapp')
        .send({
          entry: [{
            id: 'business123',
            changes: [{
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'phone123' },
                messages: [{
                  id: 'msg123',
                  from: '1234567890',
                  type: 'location',
                  location: { latitude: 40.7128, longitude: -74.006, name: 'NYC', address: 'New York' }
                }]
              }
            }]
          }]
        });

      expect(response.status).toBe(200);
    });

    it('should process contacts messages', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 1,
        credentials: JSON.stringify({})
      });

      const response = await request(app)
        .post('/api/webhooks/whatsapp')
        .send({
          entry: [{
            id: 'business123',
            changes: [{
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'phone123' },
                messages: [{
                  id: 'msg123',
                  from: '1234567890',
                  type: 'contacts',
                  contacts: [{ name: { formatted_name: 'John Doe' } }]
                }]
              }
            }]
          }]
        });

      expect(response.status).toBe(200);
    });

    it('should process interactive messages', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 1,
        credentials: JSON.stringify({})
      });

      const response = await request(app)
        .post('/api/webhooks/whatsapp')
        .send({
          entry: [{
            id: 'business123',
            changes: [{
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'phone123' },
                messages: [{
                  id: 'msg123',
                  from: '1234567890',
                  type: 'interactive',
                  interactive: { button_reply: { id: 'btn123' } }
                }]
              }
            }]
          }]
        });

      expect(response.status).toBe(200);
    });

    it('should process button messages', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 1,
        credentials: JSON.stringify({})
      });

      const response = await request(app)
        .post('/api/webhooks/whatsapp')
        .send({
          entry: [{
            id: 'business123',
            changes: [{
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'phone123' },
                messages: [{
                  id: 'msg123',
                  from: '1234567890',
                  type: 'button',
                  button: { text: 'Click me', payload: 'btn_click' }
                }]
              }
            }]
          }]
        });

      expect(response.status).toBe(200);
    });

    it('should process sticker messages', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 1,
        credentials: JSON.stringify({})
      });

      const response = await request(app)
        .post('/api/webhooks/whatsapp')
        .send({
          entry: [{
            id: 'business123',
            changes: [{
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'phone123' },
                messages: [{
                  id: 'msg123',
                  from: '1234567890',
                  type: 'sticker',
                  sticker: { id: 'sticker123', mime_type: 'image/webp' }
                }]
              }
            }]
          }]
        });

      expect(response.status).toBe(200);
    });

    it('should process reaction messages', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 1,
        credentials: JSON.stringify({})
      });

      const response = await request(app)
        .post('/api/webhooks/whatsapp')
        .send({
          entry: [{
            id: 'business123',
            changes: [{
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'phone123' },
                messages: [{
                  id: 'msg123',
                  from: '1234567890',
                  type: 'reaction',
                  reaction: { emoji: '👍', message_id: 'orig_msg123' }
                }]
              }
            }]
          }]
        });

      expect(response.status).toBe(200);
    });

    it('should process status updates', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 1,
        credentials: JSON.stringify({})
      });

      const response = await request(app)
        .post('/api/webhooks/whatsapp')
        .send({
          entry: [{
            id: 'business123',
            changes: [{
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'phone123' },
                statuses: [{
                  id: 'msg123',
                  status: 'delivered',
                  timestamp: '1234567890'
                }]
              }
            }]
          }]
        });

      expect(response.status).toBe(200);
    });

    it('should process failed status with errors', async () => {
      db.first.mockResolvedValue({
        id: 1,
        bot_id: 1,
        credentials: JSON.stringify({})
      });

      const response = await request(app)
        .post('/api/webhooks/whatsapp')
        .send({
          entry: [{
            id: 'business123',
            changes: [{
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'phone123' },
                statuses: [{
                  id: 'msg123',
                  status: 'failed',
                  timestamp: '1234567890',
                  errors: [{ code: 131047, title: 'Rate limit exceeded' }]
                }]
              }
            }]
          }]
        });

      expect(response.status).toBe(200);
    });

    it('should skip if channel not found', async () => {
      db.first.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/webhooks/whatsapp')
        .send({
          entry: [{
            id: 'business123',
            changes: [{
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'unknown' },
                messages: [{ type: 'text', text: { body: 'Hello' } }]
              }
            }]
          }]
        });

      expect(response.status).toBe(200);
      expect(log.warn).toHaveBeenCalled();
    });

    it('should skip non-messages field changes', async () => {
      const response = await request(app)
        .post('/api/webhooks/whatsapp')
        .send({
          entry: [{
            id: 'business123',
            changes: [{
              field: 'account_update',
              value: {}
            }]
          }]
        });

      expect(response.status).toBe(200);
    });

    it('should handle empty entry array', async () => {
      const response = await request(app)
        .post('/api/webhooks/whatsapp')
        .send({ entry: [] });

      expect(response.status).toBe(200);
    });

    it('should handle missing entry', async () => {
      const response = await request(app)
        .post('/api/webhooks/whatsapp')
        .send({});

      expect(response.status).toBe(200);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      const response = await request(app)
        .post('/api/webhooks/whatsapp')
        .send({
          entry: [{
            id: 'business123',
            changes: [{
              field: 'messages',
              value: { metadata: { phone_number_id: 'phone123' } }
            }]
          }]
        });

      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should return 200 even on processing errors', async () => {
      db.first.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/webhooks/whatsapp')
        .send({
          entry: [{
            id: 'business123',
            changes: [{
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'phone123' },
                messages: [{ type: 'text', text: { body: 'Hello' } }]
              }
            }]
          }]
        });

      expect(response.status).toBe(200);
    });

    it('should handle verification errors', async () => {
      const response = await request(app)
        .get('/api/webhooks/whatsapp')
        .query({
          'hub.mode': 'subscribe'
        });

      expect(response.status).toBe(403);
    });
  });
});
