/**
 * Facebook Provider Tests
 * Tests for Facebook Messenger integration
 */

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// Mock global fetch
global.fetch = jest.fn();

const FacebookProvider = require('../../channels/providers/FacebookProvider');

describe('FacebookProvider', () => {
  let provider;
  let mockConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      pageAccessToken: 'test-page-access-token',
      appSecret: 'test-app-secret',
      verifyToken: 'test-verify-token',
      apiVersion: 'v18.0'
    };

    provider = new FacebookProvider(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with config', () => {
      expect(provider.pageAccessToken).toBe('test-page-access-token');
      expect(provider.appSecret).toBe('test-app-secret');
      expect(provider.verifyToken).toBe('test-verify-token');
      expect(provider.apiVersion).toBe('v18.0');
    });

    it('should use default API version', () => {
      const defaultProvider = new FacebookProvider({});
      expect(defaultProvider.apiVersion).toBe('v18.0');
    });
  });

  describe('verifyWebhook', () => {
    it('should return success with challenge for valid verification', () => {
      const query = {
        'hub.mode': 'subscribe',
        'hub.verify_token': 'test-verify-token',
        'hub.challenge': 'challenge123'
      };

      const result = provider.verifyWebhook(query);

      expect(result.success).toBe(true);
      expect(result.challenge).toBe('challenge123');
    });

    it('should return failure for invalid mode', () => {
      const query = {
        'hub.mode': 'invalid',
        'hub.verify_token': 'test-verify-token',
        'hub.challenge': 'challenge123'
      };

      const result = provider.verifyWebhook(query);

      expect(result.success).toBe(false);
    });

    it('should return failure for wrong verify token', () => {
      const query = {
        'hub.mode': 'subscribe',
        'hub.verify_token': 'wrong-token',
        'hub.challenge': 'challenge123'
      };

      const result = provider.verifyWebhook(query);

      expect(result.success).toBe(false);
    });
  });

  describe('validateSignature', () => {
    it('should return false for missing signature', () => {
      const result = provider.validateSignature('body', null);
      expect(result).toBe(false);
    });

    it('should return false for missing app secret', () => {
      provider.appSecret = null;
      const result = provider.validateSignature('body', 'sha256=abc');
      expect(result).toBe(false);
    });

    it('should return false for invalid signature format', () => {
      const result = provider.validateSignature('body', 'invalid');
      expect(result).toBe(false);
    });

    it('should validate correct signature', () => {
      const crypto = require('crypto');
      const body = '{"test":"data"}';
      const hash = crypto.createHmac('sha256', 'test-app-secret').update(body).digest('hex');

      const result = provider.validateSignature(body, `sha256=${hash}`);
      expect(result).toBe(true);
    });
  });

  describe('sendMessage', () => {
    it('should send message successfully', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message_id: 'msg123', recipient_id: 'user123' })
      });

      const result = await provider.sendMessage('user123', { text: 'Hello' });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg123');
    });

    it('should handle API errors', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: { message: 'Invalid token' } })
      });

      const result = await provider.sendMessage('user123', { text: 'Hello' });

      expect(result.success).toBe(false);
    });

    it('should handle network errors', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const result = await provider.sendMessage('user123', { text: 'Hello' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should include optional parameters', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message_id: 'msg123' })
      });

      await provider.sendMessage('user123', { text: 'Hello' }, {
        messagingType: 'UPDATE',
        tag: 'CONFIRMED_EVENT_UPDATE',
        notificationType: 'SILENT_PUSH'
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('UPDATE')
        })
      );
    });
  });

  describe('sendText', () => {
    it('should send text message', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message_id: 'msg123' })
      });

      const result = await provider.sendText('user123', 'Hello World');

      expect(result.success).toBe(true);
    });
  });

  describe('sendImage', () => {
    it('should send image attachment', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message_id: 'msg123' })
      });

      const result = await provider.sendImage('user123', 'https://example.com/image.jpg');

      expect(result.success).toBe(true);
    });
  });

  describe('sendVideo', () => {
    it('should send video attachment', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message_id: 'msg123' })
      });

      const result = await provider.sendVideo('user123', 'https://example.com/video.mp4');

      expect(result.success).toBe(true);
    });
  });

  describe('sendAudio', () => {
    it('should send audio attachment', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message_id: 'msg123' })
      });

      const result = await provider.sendAudio('user123', 'https://example.com/audio.mp3');

      expect(result.success).toBe(true);
    });
  });

  describe('sendFile', () => {
    it('should send file attachment', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message_id: 'msg123' })
      });

      const result = await provider.sendFile('user123', 'https://example.com/file.pdf');

      expect(result.success).toBe(true);
    });
  });

  describe('sendGenericTemplate', () => {
    it('should send carousel template', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message_id: 'msg123' })
      });

      const elements = [
        { title: 'Item 1', subtitle: 'Description', imageUrl: 'https://example.com/1.jpg' },
        { title: 'Item 2', subtitle: 'Description 2' }
      ];

      const result = await provider.sendGenericTemplate('user123', elements);

      expect(result.success).toBe(true);
    });

    it('should limit to 10 elements', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message_id: 'msg123' })
      });

      const elements = Array(15).fill({ title: 'Item', subtitle: 'Desc' });

      await provider.sendGenericTemplate('user123', elements);

      const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(requestBody.message.attachment.payload.elements.length).toBeLessThanOrEqual(10);
    });
  });

  describe('sendButtonTemplate', () => {
    it('should send button template', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message_id: 'msg123' })
      });

      const buttons = [
        { type: 'postback', title: 'Button 1', payload: 'BTN1' }
      ];

      const result = await provider.sendButtonTemplate('user123', 'Choose:', buttons);

      expect(result.success).toBe(true);
    });
  });

  describe('sendQuickReplies', () => {
    it('should send quick replies', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message_id: 'msg123' })
      });

      const quickReplies = [
        { title: 'Option 1', payload: 'OPT1' },
        { title: 'Option 2', payload: 'OPT2' }
      ];

      const result = await provider.sendQuickReplies('user123', 'Choose:', quickReplies);

      expect(result.success).toBe(true);
    });

    it('should handle special quick reply types', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message_id: 'msg123' })
      });

      const quickReplies = [
        { contentType: 'location' },
        { contentType: 'user_phone_number' },
        { contentType: 'user_email' }
      ];

      await provider.sendQuickReplies('user123', 'Share:', quickReplies);

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('formatButtons', () => {
    it('should format web_url buttons', () => {
      const buttons = [{ url: 'https://example.com', title: 'Click' }];
      const formatted = provider.formatButtons(buttons);

      expect(formatted[0].type).toBe('web_url');
      expect(formatted[0].url).toBe('https://example.com');
    });

    it('should format postback buttons', () => {
      const buttons = [{ payload: 'ACTION', title: 'Click' }];
      const formatted = provider.formatButtons(buttons);

      expect(formatted[0].type).toBe('postback');
      expect(formatted[0].payload).toBe('ACTION');
    });

    it('should format phone_number buttons', () => {
      const buttons = [{ type: 'phone_number', phoneNumber: '+1234567890', title: 'Call' }];
      const formatted = provider.formatButtons(buttons);

      expect(formatted[0].type).toBe('phone_number');
    });

    it('should format account_link buttons', () => {
      const buttons = [{ type: 'account_link', url: 'https://example.com/login' }];
      const formatted = provider.formatButtons(buttons);

      expect(formatted[0].type).toBe('account_link');
    });

    it('should format account_unlink buttons', () => {
      const buttons = [{ type: 'account_unlink' }];
      const formatted = provider.formatButtons(buttons);

      expect(formatted[0].type).toBe('account_unlink');
    });
  });

  describe('sendSenderAction', () => {
    it('should send typing indicator', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });

      const result = await provider.showTypingOn('user123');

      expect(result.success).toBe(true);
    });

    it('should stop typing indicator', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });

      const result = await provider.showTypingOff('user123');

      expect(result.success).toBe(true);
    });

    it('should mark as seen', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });

      const result = await provider.markSeen('user123');

      expect(result.success).toBe(true);
    });
  });

  describe('setPersistentMenu', () => {
    it('should set persistent menu', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });

      const menuItems = [
        { title: 'Help', payload: 'HELP' },
        { title: 'Website', url: 'https://example.com' }
      ];

      const result = await provider.setPersistentMenu(menuItems);

      expect(result.success).toBe(true);
    });
  });

  describe('deletePersistentMenu', () => {
    it('should delete persistent menu', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });

      const result = await provider.deletePersistentMenu();

      expect(result.success).toBe(true);
    });
  });

  describe('getUserProfile', () => {
    it('should get user profile', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'user123',
          first_name: 'John',
          last_name: 'Doe',
          profile_pic: 'https://example.com/pic.jpg',
          locale: 'en_US',
          timezone: -5
        })
      });

      const result = await provider.getUserProfile('user123');

      expect(result.success).toBe(true);
      expect(result.profile.firstName).toBe('John');
      expect(result.profile.lastName).toBe('Doe');
    });

    it('should handle error', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: { message: 'User not found' } })
      });

      const result = await provider.getUserProfile('user123');

      expect(result.success).toBe(false);
    });
  });

  describe('parseWebhookEvent', () => {
    it('should parse text message', () => {
      const body = {
        object: 'page',
        entry: [{
          id: 'page123',
          time: Date.now(),
          messaging: [{
            sender: { id: 'user123' },
            recipient: { id: 'page123' },
            timestamp: Date.now(),
            message: {
              mid: 'msg123',
              text: 'Hello'
            }
          }]
        }]
      };

      const events = provider.parseWebhookEvent(body);

      expect(events.length).toBe(1);
      expect(events[0].type).toBe('text');
      expect(events[0].text).toBe('Hello');
    });

    it('should parse postback', () => {
      const body = {
        object: 'page',
        entry: [{
          id: 'page123',
          messaging: [{
            sender: { id: 'user123' },
            postback: {
              payload: 'GET_STARTED',
              title: 'Get Started'
            }
          }]
        }]
      };

      const events = provider.parseWebhookEvent(body);

      expect(events[0].type).toBe('postback');
      expect(events[0].payload).toBe('GET_STARTED');
    });

    it('should parse attachments', () => {
      const body = {
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: 'user123' },
            message: {
              mid: 'msg123',
              attachments: [{
                type: 'image',
                payload: { url: 'https://example.com/image.jpg' }
              }]
            }
          }]
        }]
      };

      const events = provider.parseWebhookEvent(body);

      expect(events[0].type).toBe('attachments');
      expect(events[0].attachments[0].type).toBe('image');
    });

    it('should parse referral', () => {
      const body = {
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: 'user123' },
            referral: {
              ref: 'campaign123',
              source: 'SHORTLINK'
            }
          }]
        }]
      };

      const events = provider.parseWebhookEvent(body);

      expect(events[0].type).toBe('referral');
      expect(events[0].ref).toBe('campaign123');
    });

    it('should return empty for non-page object', () => {
      const events = provider.parseWebhookEvent({ object: 'other' });
      expect(events.length).toBe(0);
    });
  });

  describe('uploadAttachment', () => {
    it('should upload attachment', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ attachment_id: 'att123' })
      });

      const result = await provider.uploadAttachment('image', 'https://example.com/image.jpg');

      expect(result.success).toBe(true);
      expect(result.attachmentId).toBe('att123');
    });
  });

  describe('Broadcast API', () => {
    it('should create message creative', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message_creative_id: 'creative123' })
      });

      const result = await provider.createMessageCreative({ text: 'Broadcast message' });

      expect(result.success).toBe(true);
      expect(result.messageCreativeId).toBe('creative123');
    });

    it('should send broadcast', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ broadcast_id: 'broadcast123' })
      });

      const result = await provider.sendBroadcast('creative123');

      expect(result.success).toBe(true);
      expect(result.broadcastId).toBe('broadcast123');
    });
  });

  describe('Labels', () => {
    it('should create label', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'label123' })
      });

      const result = await provider.createLabel('VIP Users');

      expect(result.success).toBe(true);
      expect(result.labelId).toBe('label123');
    });

    it('should associate label to user', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });

      const result = await provider.associateLabelToUser('label123', 'user123');

      expect(result.success).toBe(true);
    });
  });

  describe('Handover Protocol', () => {
    it('should pass thread control', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });

      const result = await provider.passThreadControl('user123', 'app123', 'metadata');

      expect(result.success).toBe(true);
    });

    it('should take thread control', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });

      const result = await provider.takeThreadControl('user123');

      expect(result.success).toBe(true);
    });

    it('should request thread control', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });

      const result = await provider.requestThreadControl('user123');

      expect(result.success).toBe(true);
    });
  });

  describe('setGetStartedButton', () => {
    it('should set get started button', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });

      const result = await provider.setGetStartedButton('GET_STARTED');

      expect(result.success).toBe(true);
    });
  });

  describe('setGreetingText', () => {
    it('should set greeting text', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });

      const result = await provider.setGreetingText('Welcome!');

      expect(result.success).toBe(true);
    });

    it('should handle array of greetings', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });

      const greetings = [
        { locale: 'default', text: 'Welcome!' },
        { locale: 'es_ES', text: 'Bienvenido!' }
      ];

      const result = await provider.setGreetingText(greetings);

      expect(result.success).toBe(true);
    });
  });
});
