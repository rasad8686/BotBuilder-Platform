/**
 * Webhook Service Tests
 * Tests for server/services/webhookService.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('axios');

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../db');
const axios = require('axios');
const webhookService = require('../../services/webhookService');

describe('Webhook Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAvailableEvents()', () => {
    it('should return list of available events', async () => {
      const events = await webhookService.getAvailableEvents();

      expect(events).toBeInstanceOf(Array);
      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toHaveProperty('name');
      expect(events[0]).toHaveProperty('description');
    });
  });

  describe('WEBHOOK_EVENTS', () => {
    it('should contain bot events', () => {
      const eventNames = webhookService.WEBHOOK_EVENTS.map(e => e.name);

      expect(eventNames).toContain('bot.created');
      expect(eventNames).toContain('bot.updated');
      expect(eventNames).toContain('bot.deleted');
    });

    it('should contain message events', () => {
      const eventNames = webhookService.WEBHOOK_EVENTS.map(e => e.name);

      expect(eventNames).toContain('message.received');
      expect(eventNames).toContain('message.sent');
    });
  });

  describe('trigger()', () => {
    it('should return early if no webhooks found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await webhookService.trigger(1, 'bot.created', { id: 1 });

      expect(result.success).toBe(true);
      expect(result.triggered).toBe(0);
    });

    it('should trigger webhooks for event', async () => {
      const mockWebhooks = [
        { id: 1, url: 'http://example.com/webhook', secret: 'secret123', events: ['bot.created'] }
      ];
      db.query
        .mockResolvedValueOnce({ rows: mockWebhooks }) // Find webhooks
        .mockResolvedValueOnce({ rows: [] }); // Log delivery

      axios.post.mockResolvedValueOnce({ status: 200, data: { ok: true } });

      const result = await webhookService.trigger(1, 'bot.created', { id: 1, name: 'Test Bot' });

      expect(result.success).toBe(true);
      expect(result.triggered).toBe(1);
      expect(axios.post).toHaveBeenCalledWith(
        'http://example.com/webhook',
        expect.objectContaining({
          event: 'bot.created',
          data: { id: 1, name: 'Test Bot' }
        }),
        expect.any(Object)
      );
    });

    it('should trigger multiple webhooks', async () => {
      const mockWebhooks = [
        { id: 1, url: 'http://example1.com/webhook', secret: 'secret1' },
        { id: 2, url: 'http://example2.com/webhook', secret: 'secret2' }
      ];
      db.query
        .mockResolvedValueOnce({ rows: mockWebhooks })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      axios.post
        .mockResolvedValueOnce({ status: 200, data: {} })
        .mockResolvedValueOnce({ status: 200, data: {} });

      const result = await webhookService.trigger(1, 'bot.created', {});

      expect(result.triggered).toBe(2);
      expect(axios.post).toHaveBeenCalledTimes(2);
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const result = await webhookService.trigger(1, 'bot.created', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('testWebhook()', () => {
    it('should test webhook successfully', async () => {
      const mockWebhook = { id: 1, url: 'http://example.com/webhook', secret: 'test' };
      db.query
        .mockResolvedValueOnce({ rows: [mockWebhook] })
        .mockResolvedValueOnce({ rows: [] }); // Log delivery

      axios.post.mockResolvedValueOnce({ status: 200, data: { received: true } });

      const result = await webhookService.testWebhook(1);

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(axios.post).toHaveBeenCalledWith(
        'http://example.com/webhook',
        expect.objectContaining({
          event: 'test.webhook',
          data: expect.objectContaining({ test: true })
        }),
        expect.any(Object)
      );
    });

    it('should throw error if webhook not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(webhookService.testWebhook(999))
        .rejects.toThrow('Webhook not found');
    });

    it('should return failure on non-2xx response', async () => {
      const mockWebhook = { id: 1, url: 'http://example.com/webhook' };
      db.query
        .mockResolvedValueOnce({ rows: [mockWebhook] })
        .mockResolvedValueOnce({ rows: [] });

      axios.post.mockResolvedValueOnce({ status: 500, data: { error: 'Server error' } });

      const result = await webhookService.testWebhook(1);

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(500);
    });

    it('should handle connection errors', async () => {
      const mockWebhook = { id: 1, url: 'http://example.com/webhook' };
      db.query
        .mockResolvedValueOnce({ rows: [mockWebhook] })
        .mockResolvedValueOnce({ rows: [] });

      const connectionError = new Error('Connection refused');
      connectionError.code = 'ECONNREFUSED';
      axios.post.mockRejectedValueOnce(connectionError);

      const result = await webhookService.testWebhook(1);

      expect(result.success).toBe(false);
    });

    it('should handle timeout errors', async () => {
      const mockWebhook = { id: 1, url: 'http://example.com/webhook' };
      db.query
        .mockResolvedValueOnce({ rows: [mockWebhook] })
        .mockResolvedValueOnce({ rows: [] });

      const timeoutError = new Error('Timeout');
      timeoutError.code = 'ETIMEDOUT';
      axios.post.mockRejectedValueOnce(timeoutError);

      const result = await webhookService.testWebhook(1);

      expect(result.success).toBe(false);
    });

    it('should handle DNS errors', async () => {
      const mockWebhook = { id: 1, url: 'http://nonexistent.invalid/webhook' };
      db.query
        .mockResolvedValueOnce({ rows: [mockWebhook] })
        .mockResolvedValueOnce({ rows: [] });

      const dnsError = new Error('DNS lookup failed');
      dnsError.code = 'ENOTFOUND';
      axios.post.mockRejectedValueOnce(dnsError);

      const result = await webhookService.testWebhook(1);

      expect(result.success).toBe(false);
    });
  });
});
