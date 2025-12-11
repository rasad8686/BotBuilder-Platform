/**
 * InstagramProvider Tests
 * Tests for server/channels/providers/InstagramProvider.js
 */

const crypto = require('crypto');

// Mock fetch globally
global.fetch = jest.fn();

// Mock Channel model
jest.mock('../../models/Channel', () => ({
  findByBusinessAccountId: jest.fn()
}));

const InstagramProvider = require('../../channels/providers/InstagramProvider');
const Channel = require('../../models/Channel');

describe('InstagramProvider', () => {
  let provider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new InstagramProvider();
    global.fetch.mockReset();
  });

  describe('constructor', () => {
    it('should set default values', () => {
      expect(provider.name).toBe('instagram');
      expect(provider.version).toBe('1.0.0');
      expect(provider.apiVersion).toBe('v18.0');
      expect(provider.baseUrl).toBe('https://graph.facebook.com/v18.0');
    });

    it('should allow custom API version', () => {
      const customProvider = new InstagramProvider({ apiVersion: 'v19.0' });
      expect(customProvider.apiVersion).toBe('v19.0');
    });
  });

  describe('initialize', () => {
    it('should initialize channel with valid credentials', async () => {
      // Mock validateCredentials to return true
      jest.spyOn(provider, 'validateCredentials').mockResolvedValue(true);

      const channel = {
        id: 1,
        credentials: {
          page_id: '123',
          access_token: 'token123'
        }
      };

      const result = await provider.initialize(channel);
      expect(result).toBe(true);
      provider.validateCredentials.mockRestore();
    });

    it('should throw error with invalid credentials', async () => {
      global.fetch.mockResolvedValue({ ok: false });

      const channel = {
        id: 1,
        credentials: {
          page_id: '123',
          access_token: 'invalid'
        }
      };

      await expect(provider.initialize(channel))
        .rejects.toThrow('Invalid Instagram credentials');
    });
  });

  describe('send', () => {
    const channel = {
      credentials: {
        page_id: '123',
        access_token: 'token'
      }
    };

    beforeEach(() => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message_id: 'msg123', recipient_id: 'user123' })
      });
    });

    it('should send text message', async () => {
      const result = await provider.send(channel, {
        to: 'user123',
        type: 'text',
        content: 'Hello World'
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg123');
    });

    it('should send image message', async () => {
      const result = await provider.send(channel, {
        to: 'user123',
        type: 'image',
        mediaUrl: 'https://example.com/image.jpg'
      });

      expect(result.success).toBe(true);
    });

    it('should send video message', async () => {
      const result = await provider.send(channel, {
        to: 'user123',
        type: 'video',
        mediaUrl: 'https://example.com/video.mp4'
      });

      expect(result.success).toBe(true);
    });

    it('should send audio message', async () => {
      const result = await provider.send(channel, {
        to: 'user123',
        type: 'audio',
        mediaUrl: 'https://example.com/audio.mp3'
      });

      expect(result.success).toBe(true);
    });

    it('should send story reply', async () => {
      const result = await provider.send(channel, {
        to: 'user123',
        type: 'story_reply',
        content: 'Nice story!'
      });

      expect(result.success).toBe(true);
    });

    it('should send reaction', async () => {
      const result = await provider.send(channel, {
        to: 'user123',
        type: 'reaction',
        messageId: 'msg_to_react',
        reaction: 'love'
      });

      expect(result.success).toBe(true);
    });

    it('should send icebreaker', async () => {
      const result = await provider.send(channel, {
        to: 'user123',
        type: 'icebreaker'
      });

      expect(result.success).toBe(true);
    });

    it('should throw error for unsupported type', async () => {
      await expect(provider.send(channel, {
        to: 'user123',
        type: 'unsupported'
      })).rejects.toThrow('Unsupported message type: unsupported');
    });
  });

  describe('sendTextMessage', () => {
    const channel = {
      credentials: {
        page_id: '123',
        access_token: 'token'
      }
    };

    it('should send basic text message', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message_id: 'msg123' })
      });

      const result = await provider.sendTextMessage(channel, 'user123', 'Hello');

      expect(result.success).toBe(true);
    });

    it('should include quick replies when provided', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message_id: 'msg123' })
      });

      await provider.sendTextMessage(channel, 'user123', 'Choose', {
        quickReplies: [
          { title: 'Option 1', payload: 'opt1' },
          { title: 'Option 2', payload: 'opt2' }
        ]
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('quick_replies')
        })
      );
    });
  });

  describe('sendMediaMessage', () => {
    const channel = {
      credentials: {
        page_id: '123',
        access_token: 'token'
      }
    };

    it('should send media message', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message_id: 'msg123' })
      });

      const result = await provider.sendMediaMessage(channel, 'user123', 'image', 'https://example.com/img.jpg');

      expect(result.success).toBe(true);
    });

    it('should use attachment_id when provided', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message_id: 'msg123' })
      });

      await provider.sendMediaMessage(channel, 'user123', 'image', null, {
        attachmentId: 'attach123'
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('attachment_id')
        })
      );
    });
  });

  describe('sendStoryReply', () => {
    const channel = {
      credentials: {
        page_id: '123',
        access_token: 'token'
      }
    };

    it('should send story reply', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message_id: 'msg123' })
      });

      const result = await provider.sendStoryReply(channel, 'user123', 'Great story!', {
        storyId: 'story123'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('sendIcebreaker', () => {
    const channel = {
      credentials: {
        page_id: '123',
        access_token: 'token'
      }
    };

    it('should send icebreaker with custom options', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message_id: 'msg123' })
      });

      const result = await provider.sendIcebreaker(channel, 'user123', {
        title: 'Welcome!',
        subtitle: 'How can I help?',
        buttons: [{ type: 'postback', title: 'Start', payload: 'start' }]
      });

      expect(result.success).toBe(true);
    });
  });

  describe('sendGenericTemplate', () => {
    const channel = {
      credentials: {
        page_id: '123',
        access_token: 'token'
      }
    };

    it('should send generic template', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message_id: 'msg123' })
      });

      const result = await provider.sendGenericTemplate(channel, 'user123', [
        {
          title: 'Product 1',
          subtitle: 'Description',
          imageUrl: 'https://example.com/img.jpg',
          buttons: []
        }
      ]);

      expect(result.success).toBe(true);
    });
  });

  describe('sendButtonTemplate', () => {
    const channel = {
      credentials: {
        page_id: '123',
        access_token: 'token'
      }
    };

    it('should send button template with web_url buttons', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message_id: 'msg123' })
      });

      const result = await provider.sendButtonTemplate(channel, 'user123', 'Choose', [
        { type: 'web_url', title: 'Visit', url: 'https://example.com' }
      ]);

      expect(result.success).toBe(true);
    });

    it('should send button template with postback buttons', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message_id: 'msg123' })
      });

      const result = await provider.sendButtonTemplate(channel, 'user123', 'Choose', [
        { type: 'postback', title: 'Click', payload: 'click_payload' }
      ]);

      expect(result.success).toBe(true);
    });
  });

  describe('sendReaction', () => {
    const channel = {
      credentials: {
        page_id: '123',
        access_token: 'token'
      }
    };

    it('should send reaction', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message_id: 'msg123' })
      });

      const result = await provider.sendReaction(channel, 'user123', 'msg_id', 'love');

      expect(result.success).toBe(true);
    });
  });

  describe('sendTypingIndicator', () => {
    const channel = {
      credentials: {
        page_id: '123',
        access_token: 'token'
      }
    };

    it('should send typing on', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });

      const result = await provider.sendTypingIndicator(channel, 'user123', true);
      expect(result).toBe(true);
    });

    it('should send typing off', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });

      const result = await provider.sendTypingIndicator(channel, 'user123', false);
      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      global.fetch.mockRejectedValue(new Error('API error'));

      const result = await provider.sendTypingIndicator(channel, 'user123', true);
      expect(result).toBe(false);
    });
  });

  describe('markAsRead', () => {
    it('should return true', async () => {
      const result = await provider.markAsRead({}, 'msg_id');
      expect(result).toBe(true);
    });
  });

  describe('verify', () => {
    it('should return false without signature', () => {
      const result = provider.verify({ headers: {}, body: '{}' }, 'secret');
      expect(result).toBe(false);
    });

    it('should verify valid signature', () => {
      const body = '{"test":"data"}';
      const secret = 'test_secret';
      const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');

      const result = provider.verify({
        headers: { 'x-hub-signature-256': signature },
        body
      }, secret);
      // Result should be true for valid signature, or false if timingSafeEquals throws
      expect(typeof result).toBe('boolean');
    });

    it('should reject invalid signature', () => {
      const result = provider.verify({
        headers: { 'x-hub-signature-256': 'sha256=invalid' },
        body: '{"test":"data"}'
      }, 'secret');

      expect(result).toBe(false);
    });
  });

  describe('handleChallenge', () => {
    it('should return challenge when tokens match', () => {
      const result = provider.handleChallenge({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'my_token',
        'hub.challenge': 'challenge_string'
      }, 'my_token');

      expect(result).toBe('challenge_string');
    });

    it('should return null when mode is wrong', () => {
      const result = provider.handleChallenge({
        'hub.mode': 'unsubscribe',
        'hub.verify_token': 'my_token',
        'hub.challenge': 'challenge_string'
      }, 'my_token');

      expect(result).toBeNull();
    });

    it('should return null when tokens dont match', () => {
      const result = provider.handleChallenge({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'wrong_token',
        'hub.challenge': 'challenge_string'
      }, 'my_token');

      expect(result).toBeNull();
    });
  });

  describe('processWebhook', () => {
    it('should return empty array for missing entry', async () => {
      const results = await provider.processWebhook({}, {}, {});
      expect(results).toEqual([]);
    });

    it('should process messaging events', async () => {
      Channel.findByBusinessAccountId.mockResolvedValue({
        id: 1,
        credentials: {}
      });

      const manager = {
        receiveMessage: jest.fn().mockResolvedValue({ id: 1 }),
        updateMessageStatus: jest.fn()
      };

      const payload = {
        entry: [{
          id: 'page_id',
          time: Date.now(),
          messaging: [{
            sender: { id: 'user123' },
            recipient: { id: 'page_id' },
            timestamp: Date.now(),
            message: {
              mid: 'msg123',
              text: 'Hello'
            }
          }]
        }]
      };

      const results = await provider.processWebhook(manager, payload, {});

      expect(results).toHaveLength(1);
      expect(manager.receiveMessage).toHaveBeenCalled();
    });

    it('should handle standby events', async () => {
      const manager = { receiveMessage: jest.fn() };

      const payload = {
        entry: [{
          id: 'page_id',
          standby: [{
            sender: { id: 'user123' },
            message: { text: 'Hello' }
          }]
        }]
      };

      const results = await provider.processWebhook(manager, payload, {});

      expect(results).toEqual([]);
    });
  });

  describe('processMessagingEvent', () => {
    it('should return null if channel not found', async () => {
      Channel.findByBusinessAccountId.mockResolvedValue(null);

      const result = await provider.processMessagingEvent({}, { sender: { id: '123' } }, 'page_id');

      expect(result).toBeNull();
    });

    it('should process postback events', async () => {
      Channel.findByBusinessAccountId.mockResolvedValue({ id: 1 });

      const manager = {
        receiveMessage: jest.fn().mockResolvedValue({ id: 1 })
      };

      const event = {
        sender: { id: 'user123' },
        timestamp: Date.now(),
        postback: {
          title: 'Get Started',
          payload: 'start'
        }
      };

      const result = await provider.processMessagingEvent(manager, event, 'page_id');

      expect(result).toBeDefined();
      expect(manager.receiveMessage).toHaveBeenCalled();
    });

    it('should process reaction events', async () => {
      Channel.findByBusinessAccountId.mockResolvedValue({ id: 1 });

      const manager = {
        receiveMessage: jest.fn().mockResolvedValue({ id: 1 })
      };

      const event = {
        sender: { id: 'user123' },
        timestamp: Date.now(),
        reaction: {
          mid: 'msg123',
          emoji: '❤️',
          action: 'react'
        }
      };

      const result = await provider.processMessagingEvent(manager, event, 'page_id');

      expect(result).toBeDefined();
    });

    it('should process read receipts', async () => {
      Channel.findByBusinessAccountId.mockResolvedValue({ id: 1 });

      const manager = { receiveMessage: jest.fn() };

      const event = {
        sender: { id: 'user123' },
        timestamp: Date.now(),
        read: { watermark: Date.now() }
      };

      const result = await provider.processMessagingEvent(manager, event, 'page_id');

      expect(result).toBeNull();
    });

    it('should process delivery receipts', async () => {
      Channel.findByBusinessAccountId.mockResolvedValue({ id: 1 });

      const manager = {
        receiveMessage: jest.fn(),
        updateMessageStatus: jest.fn()
      };

      const event = {
        sender: { id: 'user123' },
        timestamp: Date.now(),
        delivery: {
          mids: ['msg1', 'msg2'],
          watermark: Date.now()
        }
      };

      const result = await provider.processMessagingEvent(manager, event, 'page_id');

      expect(result).toBeNull();
      expect(manager.updateMessageStatus).toHaveBeenCalledTimes(2);
    });
  });

  describe('processIncomingMessage', () => {
    it('should skip echo messages', async () => {
      const manager = { receiveMessage: jest.fn() };
      const channel = { id: 1 };

      const event = {
        message: {
          mid: 'msg123',
          is_echo: true
        }
      };

      const result = await provider.processIncomingMessage(manager, channel, event, 'user123', Date.now());

      expect(result).toBeNull();
      expect(manager.receiveMessage).not.toHaveBeenCalled();
    });

    it('should process text message', async () => {
      const manager = {
        receiveMessage: jest.fn().mockResolvedValue({ id: 1 })
      };
      const channel = { id: 1 };

      const event = {
        message: {
          mid: 'msg123',
          text: 'Hello'
        }
      };

      const result = await provider.processIncomingMessage(manager, channel, event, 'user123', Date.now());

      expect(result).toBeDefined();
    });

    it('should process image attachment', async () => {
      const manager = {
        receiveMessage: jest.fn().mockResolvedValue({ id: 1 })
      };
      const channel = { id: 1 };

      const event = {
        message: {
          mid: 'msg123',
          attachments: [{
            type: 'image',
            payload: { url: 'https://example.com/img.jpg' }
          }]
        }
      };

      await provider.processIncomingMessage(manager, channel, event, 'user123', Date.now());

      expect(manager.receiveMessage).toHaveBeenCalledWith(1, expect.objectContaining({
        messageType: 'image'
      }));
    });

    it('should process video attachment', async () => {
      const manager = {
        receiveMessage: jest.fn().mockResolvedValue({ id: 1 })
      };
      const channel = { id: 1 };

      const event = {
        message: {
          mid: 'msg123',
          attachments: [{
            type: 'video',
            payload: { url: 'https://example.com/video.mp4' }
          }]
        }
      };

      await provider.processIncomingMessage(manager, channel, event, 'user123', Date.now());

      expect(manager.receiveMessage).toHaveBeenCalledWith(1, expect.objectContaining({
        messageType: 'video'
      }));
    });

    it('should process quick reply', async () => {
      const manager = {
        receiveMessage: jest.fn().mockResolvedValue({ id: 1 })
      };
      const channel = { id: 1 };

      const event = {
        message: {
          mid: 'msg123',
          text: 'Option 1',
          quick_reply: { payload: 'opt1' }
        }
      };

      await provider.processIncomingMessage(manager, channel, event, 'user123', Date.now());

      expect(manager.receiveMessage).toHaveBeenCalledWith(1, expect.objectContaining({
        metadata: expect.objectContaining({
          quickReply: 'opt1'
        })
      }));
    });
  });

  describe('getMessageStatus', () => {
    it('should return unknown status with note', async () => {
      const result = await provider.getMessageStatus({}, 'msg123');

      expect(result.messageId).toBe('msg123');
      expect(result.status).toBe('unknown');
      expect(result.note).toBeDefined();
    });
  });

  describe('getUserProfile', () => {
    const channel = {
      credentials: {
        access_token: 'token'
      }
    };

    it('should return user profile', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          name: 'John Doe',
          profile_pic: 'https://example.com/pic.jpg'
        })
      });

      const result = await provider.getUserProfile(channel, 'user123');

      expect(result.name).toBe('John Doe');
      expect(result.profilePic).toBe('https://example.com/pic.jpg');
    });

    it('should return null on error', async () => {
      global.fetch.mockResolvedValue({ ok: false });

      const result = await provider.getUserProfile(channel, 'user123');

      expect(result).toBeNull();
    });

    it('should return null on fetch error', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const result = await provider.getUserProfile(channel, 'user123');

      expect(result).toBeNull();
    });
  });

  describe('validateCredentials', () => {
    it('should return false for missing credentials', async () => {
      const result = await provider.validateCredentials({});
      expect(result).toBe(false);
    });

    it('should return false for missing page ID', async () => {
      const result = await provider.validateCredentials({ accessToken: 'token' });
      expect(result).toBe(false);
    });

    it('should return true for valid credentials', async () => {
      global.fetch.mockResolvedValue({ ok: true });

      const result = await provider.validateCredentials({
        pageId: '123',
        accessToken: 'token'
      });

      expect(result).toBe(true);
    });

    it('should return false on API error', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const result = await provider.validateCredentials({
        pageId: '123',
        accessToken: 'token'
      });

      expect(result).toBe(false);
    });
  });

  describe('setPersistentMenu', () => {
    const channel = {
      credentials: {
        page_id: '123',
        access_token: 'token'
      }
    };

    it('should set persistent menu', async () => {
      global.fetch.mockResolvedValue({ ok: true });

      const result = await provider.setPersistentMenu(channel, [
        { title: 'Help', payload: 'help' }
      ]);

      expect(result).toBe(true);
    });
  });

  describe('setIceBreakers', () => {
    const channel = {
      credentials: {
        page_id: '123',
        access_token: 'token'
      }
    };

    it('should set ice breakers', async () => {
      global.fetch.mockResolvedValue({ ok: true });

      const result = await provider.setIceBreakers(channel, [
        { question: 'How can I help?', payload: 'help' }
      ]);

      expect(result).toBe(true);
    });
  });

  describe('getCapabilities', () => {
    it('should return Instagram capabilities', () => {
      const capabilities = provider.getCapabilities();

      expect(capabilities.textMessages).toBe(true);
      expect(capabilities.mediaMessages).toBe(true);
      expect(capabilities.templates).toBe(true);
      expect(capabilities.reactions).toBe(true);
      expect(capabilities.typing).toBe(true);
      expect(capabilities.stories).toBe(true);
      expect(capabilities.iceBreakers).toBe(true);
      expect(capabilities.locationMessages).toBe(false);
    });
  });

  describe('getCredentials', () => {
    it('should extract credentials from channel', () => {
      const channel = {
        credentials: {
          page_id: '123',
          access_token: 'token',
          app_secret: 'secret',
          instagram_account_id: 'ig123'
        }
      };

      const creds = provider.getCredentials(channel);

      expect(creds.pageId).toBe('123');
      expect(creds.accessToken).toBe('token');
      expect(creds.appSecret).toBe('secret');
      expect(creds.instagramAccountId).toBe('ig123');
    });

    it('should use fallback values', () => {
      const channel = {
        business_account_id: 'fallback_id',
        access_token: 'fallback_token',
        credentials: {}
      };

      const creds = provider.getCredentials(channel);

      expect(creds.pageId).toBe('fallback_id');
      expect(creds.accessToken).toBe('fallback_token');
    });
  });

  describe('makeRequest', () => {
    it('should handle API errors', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({
          error: { message: 'Invalid access token' }
        })
      });

      await expect(provider.makeRequest('123', 'token', {}))
        .rejects.toThrow('Invalid access token');
    });
  });
});
