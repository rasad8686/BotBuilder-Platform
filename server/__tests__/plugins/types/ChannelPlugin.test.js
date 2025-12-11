/**
 * ChannelPlugin Tests
 * Tests for server/plugins/types/ChannelPlugin.js
 */

jest.mock('../../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

const ChannelPlugin = require('../../../plugins/types/ChannelPlugin');
const log = require('../../../utils/logger');

describe('ChannelPlugin', () => {
  let plugin;

  beforeEach(() => {
    jest.clearAllMocks();
    plugin = new ChannelPlugin({
      id: 'test-channel',
      name: 'Test Channel',
      channelType: 'whatsapp',
      webhookPath: '/webhook/test'
    });
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      expect(plugin.channelType).toBe('whatsapp');
      expect(plugin.webhookPath).toBe('/webhook/test');
    });

    it('should use defaults for missing config', () => {
      const defaultPlugin = new ChannelPlugin({ id: 'default' });

      expect(defaultPlugin.channelType).toBe('generic');
      expect(defaultPlugin.webhookPath).toBe('/webhook/default');
    });

    it('should initialize apiClient as null', () => {
      expect(plugin.apiClient).toBeNull();
    });

    it('should initialize messageQueue as empty array', () => {
      expect(plugin.messageQueue).toEqual([]);
    });
  });

  describe('getType', () => {
    it('should return "channel"', () => {
      expect(plugin.getType()).toBe('channel');
    });
  });

  describe('sendMessage', () => {
    beforeEach(() => {
      plugin.enabled = true;
      plugin.installed = true;
      plugin.doSendMessage = jest.fn().mockResolvedValue({ messageId: '123' });
      plugin.onMessageSent = jest.fn();
    });

    it('should send message successfully', async () => {
      const result = await plugin.sendMessage('user1', { text: 'Hello' });

      expect(result.messageId).toBe('123');
      expect(plugin.doSendMessage).toHaveBeenCalled();
      expect(plugin.onMessageSent).toHaveBeenCalled();
    });

    it('should throw if plugin is disabled', async () => {
      plugin.enabled = false;
      plugin.installed = false;

      await expect(plugin.sendMessage('user1', { text: 'Hello' }))
        .rejects.toThrow('Plugin is not enabled');
    });

    it('should format outgoing message', async () => {
      plugin.formatOutgoingMessage = jest.fn().mockResolvedValue({ content: 'formatted' });

      await plugin.sendMessage('user1', { text: 'Hello' });

      expect(plugin.formatOutgoingMessage).toHaveBeenCalledWith({ text: 'Hello' });
    });

    it('should call onMessageError on failure', async () => {
      const error = new Error('Send failed');
      plugin.doSendMessage = jest.fn().mockRejectedValue(error);
      plugin.onMessageError = jest.fn();

      await expect(plugin.sendMessage('user1', { text: 'Hello' }))
        .rejects.toThrow('Send failed');

      expect(plugin.onMessageError).toHaveBeenCalled();
    });
  });

  describe('receiveMessage', () => {
    beforeEach(() => {
      plugin.enabled = true;
      plugin.installed = true;
      plugin.onMessageReceived = jest.fn();
    });

    it('should receive message successfully', async () => {
      const rawMessage = {
        id: 'msg1',
        from: 'user1',
        text: 'Hello',
        timestamp: 1234567890
      };

      const result = await plugin.receiveMessage(rawMessage);

      expect(result.id).toBe('msg1');
      expect(result.senderId).toBe('user1');
      expect(result.content).toBe('Hello');
      expect(plugin.onMessageReceived).toHaveBeenCalled();
    });

    it('should throw if plugin is disabled', async () => {
      plugin.enabled = false;
      plugin.installed = false;

      await expect(plugin.receiveMessage({}))
        .rejects.toThrow('Plugin is not enabled');
    });

    it('should parse incoming message', async () => {
      plugin.parseIncomingMessage = jest.fn().mockResolvedValue({ parsed: true });

      await plugin.receiveMessage({ raw: 'data' });

      expect(plugin.parseIncomingMessage).toHaveBeenCalledWith({ raw: 'data' });
    });
  });

  describe('webhookHandler', () => {
    let mockReq;
    let mockRes;

    beforeEach(() => {
      mockReq = {
        method: 'POST',
        body: { event: 'message' }
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        send: jest.fn()
      };
    });

    it('should process webhook successfully', async () => {
      plugin.verifyWebhook = jest.fn().mockResolvedValue(true);
      plugin.extractWebhookEvents = jest.fn().mockResolvedValue([{ type: 'message' }]);
      plugin.processWebhookEvent = jest.fn();

      await plugin.webhookHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ status: 'ok' });
    });

    it('should return 401 for invalid webhook signature', async () => {
      plugin.verifyWebhook = jest.fn().mockResolvedValue(false);

      await plugin.webhookHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should handle GET verification challenge', async () => {
      mockReq.method = 'GET';
      plugin.verifyWebhook = jest.fn().mockResolvedValue(true);
      plugin.handleVerificationChallenge = jest.fn().mockResolvedValue('challenge_token');

      await plugin.webhookHandler(mockReq, mockRes);

      expect(mockRes.send).toHaveBeenCalledWith('challenge_token');
    });

    it('should not send challenge if null', async () => {
      mockReq.method = 'GET';
      plugin.verifyWebhook = jest.fn().mockResolvedValue(true);
      plugin.handleVerificationChallenge = jest.fn().mockResolvedValue(null);
      plugin.extractWebhookEvents = jest.fn().mockResolvedValue([]);

      await plugin.webhookHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should process multiple webhook events', async () => {
      plugin.verifyWebhook = jest.fn().mockResolvedValue(true);
      plugin.extractWebhookEvents = jest.fn().mockResolvedValue([
        { type: 'message' },
        { type: 'delivery' },
        { type: 'read' }
      ]);
      plugin.processWebhookEvent = jest.fn();

      await plugin.webhookHandler(mockReq, mockRes);

      expect(plugin.processWebhookEvent).toHaveBeenCalledTimes(3);
    });

    it('should handle errors', async () => {
      plugin.verifyWebhook = jest.fn().mockRejectedValue(new Error('Verification error'));

      await plugin.webhookHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(log.error).toHaveBeenCalled();
    });
  });

  describe('formatOutgoingMessage', () => {
    it('should format message with default values', async () => {
      const result = await plugin.formatOutgoingMessage({ text: 'Hello' });

      expect(result.type).toBe('text');
      expect(result.content).toBe('Hello');
      expect(result.buttons).toEqual([]);
      expect(result.media).toBeNull();
      expect(result.metadata).toEqual({});
    });

    it('should preserve message properties', async () => {
      const result = await plugin.formatOutgoingMessage({
        type: 'image',
        content: 'url',
        buttons: [{ text: 'Click' }],
        media: { url: 'http://...' },
        metadata: { key: 'value' }
      });

      expect(result.type).toBe('image');
      expect(result.buttons).toHaveLength(1);
      expect(result.media.url).toBe('http://...');
    });
  });

  describe('parseIncomingMessage', () => {
    it('should parse message with default values', async () => {
      const result = await plugin.parseIncomingMessage({
        id: 'msg1',
        from: 'user1',
        text: 'Hello'
      });

      expect(result.id).toBe('msg1');
      expect(result.senderId).toBe('user1');
      expect(result.content).toBe('Hello');
      expect(result.type).toBe('text');
      expect(result.channel).toBe('whatsapp');
    });

    it('should handle sender field', async () => {
      const result = await plugin.parseIncomingMessage({
        id: 'msg1',
        sender: 'user2',
        body: 'Hi'
      });

      expect(result.senderId).toBe('user2');
      expect(result.content).toBe('Hi');
    });

    it('should include timestamp', async () => {
      const result = await plugin.parseIncomingMessage({
        id: 'msg1',
        timestamp: 1234567890
      });

      expect(result.timestamp).toBe(1234567890);
    });

    it('should include raw message', async () => {
      const raw = { id: 'msg1', custom: 'data' };
      const result = await plugin.parseIncomingMessage(raw);

      expect(result.raw).toEqual(raw);
    });
  });

  describe('doSendMessage', () => {
    it('should throw error (must be implemented)', async () => {
      await expect(plugin.doSendMessage('user1', {}, {}))
        .rejects.toThrow('doSendMessage must be implemented in subclass');
    });
  });

  describe('verifyWebhook', () => {
    it('should return true by default', async () => {
      const result = await plugin.verifyWebhook({});
      expect(result).toBe(true);
    });
  });

  describe('handleVerificationChallenge', () => {
    it('should return null by default', async () => {
      const result = await plugin.handleVerificationChallenge({});
      expect(result).toBeNull();
    });
  });

  describe('extractWebhookEvents', () => {
    it('should return body as single event by default', async () => {
      const body = { event: 'message' };
      const result = await plugin.extractWebhookEvents(body);

      expect(result).toEqual([body]);
    });
  });

  describe('processWebhookEvent', () => {
    it('should not throw by default', async () => {
      await expect(plugin.processWebhookEvent({})).resolves.toBeUndefined();
    });
  });

  describe('event hooks', () => {
    it('onMessageSent should not throw', async () => {
      await expect(plugin.onMessageSent('user1', {}, {})).resolves.toBeUndefined();
    });

    it('onMessageReceived should not throw', async () => {
      await expect(plugin.onMessageReceived({})).resolves.toBeUndefined();
    });

    it('onMessageError should not throw', async () => {
      await expect(plugin.onMessageError('user1', {}, new Error())).resolves.toBeUndefined();
    });
  });

  describe('getCapabilities', () => {
    it('should return default capabilities', () => {
      const caps = plugin.getCapabilities();

      expect(caps.text).toBe(true);
      expect(caps.images).toBe(false);
      expect(caps.video).toBe(false);
      expect(caps.audio).toBe(false);
      expect(caps.documents).toBe(false);
      expect(caps.buttons).toBe(false);
      expect(caps.quickReplies).toBe(false);
      expect(caps.templates).toBe(false);
      expect(caps.location).toBe(false);
      expect(caps.contacts).toBe(false);
    });
  });
});
