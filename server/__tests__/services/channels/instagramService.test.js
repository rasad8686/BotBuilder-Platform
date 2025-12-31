/**
 * InstagramService Tests
 */

jest.mock('../../../channels/providers/InstagramProvider', () => {
  return jest.fn().mockImplementation(() => ({
    validateCredentials: jest.fn().mockResolvedValue(true),
    sendTextMessage: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-1' }),
    sendMediaMessage: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-2' }),
    sendButtonTemplate: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-3' }),
    sendGenericTemplate: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-4' }),
    sendStoryReply: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-5' }),
    sendReaction: jest.fn().mockResolvedValue({ success: true }),
    sendTypingIndicator: jest.fn().mockResolvedValue({ success: true }),
    getUserProfile: jest.fn().mockResolvedValue({ success: true, profile: { name: 'User' } }),
    setIceBreakers: jest.fn().mockResolvedValue({ success: true }),
    setPersistentMenu: jest.fn().mockResolvedValue({ success: true }),
    getCapabilities: jest.fn(() => ({ text: true, image: true, video: true }))
  }));
});

jest.mock('../../../db', () => jest.fn());

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// Mock global fetch
global.fetch = jest.fn();

const db = require('../../../db');
const InstagramProvider = require('../../../channels/providers/InstagramProvider');

describe('InstagramService', () => {
  let InstagramService;
  let mockProviderInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    mockProviderInstance = new InstagramProvider();

    // Setup db mock
    db.mockImplementation((table) => {
      const chain = {
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockResolvedValue(1),
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
        returning: jest.fn().mockResolvedValue([{ id: 1 }]),
        select: jest.fn().mockReturnThis(),
        max: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockResolvedValue([]),
        countDistinct: jest.fn().mockResolvedValue([{ count: 5 }]),
        count: jest.fn().mockResolvedValue([{ count: 3 }]),
        raw: jest.fn((sql) => sql),
        orWhere: jest.fn().mockReturnThis()
      };
      return chain;
    });
    db.raw = jest.fn((sql) => sql);

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        name: 'Test Page',
        id: 'page-123',
        instagram_business_account: { id: 'ig-123' }
      })
    });

    InstagramService = require('../../../services/channels/instagramService');
  });

  describe('createChannel', () => {
    it('should create an Instagram channel', async () => {
      const credentials = {
        page_id: 'page-123',
        access_token: 'token-123'
      };

      const result = await InstagramService.createChannel(1, 'bot-1', credentials);

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
    });

    it('should throw error for invalid credentials', async () => {
      mockProviderInstance.validateCredentials.mockResolvedValue(false);
      jest.resetModules();
      InstagramProvider.mockImplementation(() => mockProviderInstance);
      InstagramService = require('../../../services/channels/instagramService');

      const credentials = { page_id: 'invalid' };

      await expect(InstagramService.createChannel(1, 'bot-1', credentials))
        .rejects.toThrow('Invalid Instagram credentials');
    });
  });

  describe('getAccountInfo', () => {
    it('should return account info', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          name: 'Test Page',
          id: 'page-123',
          instagram_business_account: { id: 'ig-123' }
        })
      }).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'ig-123',
          username: 'testuser',
          profile_picture_url: 'http://example.com/pic.jpg'
        })
      });

      const credentials = {
        page_id: 'page-123',
        access_token: 'token-123'
      };

      const result = await InstagramService.getAccountInfo(credentials);

      expect(result.pageName).toBe('Test Page');
      expect(result.username).toBe('testuser');
    });

    it('should handle fetch error', async () => {
      global.fetch.mockResolvedValue({ ok: false });

      const result = await InstagramService.getAccountInfo({
        page_id: 'invalid',
        access_token: 'token'
      });

      expect(result).toEqual({});
    });
  });

  describe('updateChannel', () => {
    it('should update channel settings', async () => {
      db.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: 1, name: 'Updated' }])
      }));

      const result = await InstagramService.updateChannel(1, { name: 'Updated' });

      expect(result.name).toBe('Updated');
    });
  });

  describe('deleteChannel', () => {
    it('should delete channel', async () => {
      db.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        delete: jest.fn().mockResolvedValue(1)
      }));

      const result = await InstagramService.deleteChannel(1);

      expect(result).toBe(true);
    });
  });

  describe('getChannel', () => {
    it('should return channel by ID', async () => {
      db.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ id: 1, provider: 'instagram' })
      }));

      const result = await InstagramService.getChannel(1);

      expect(result.id).toBe(1);
    });
  });

  describe('getChannels', () => {
    it('should return all Instagram channels for org', async () => {
      db.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }])
      }));

      const result = await InstagramService.getChannels(1);

      expect(result).toHaveLength(2);
    });
  });

  describe('sendText', () => {
    it('should send text message', async () => {
      const mockChannel = {
        id: 1,
        credentials: JSON.stringify({ access_token: 'token' })
      };

      db.mockImplementation((table) => {
        if (table === 'channel_messages') {
          return {
            insert: jest.fn().mockResolvedValue([])
          };
        }
        return {
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(mockChannel)
        };
      });

      const result = await InstagramService.sendText(1, 'recipient-123', 'Hello');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-1');
    });

    it('should throw error if channel not found', async () => {
      db.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null)
      }));

      await expect(InstagramService.sendText(999, 'recipient-123', 'Hello'))
        .rejects.toThrow('Channel not found');
    });
  });

  describe('sendImage', () => {
    it('should send image message', async () => {
      const mockChannel = { id: 1, credentials: '{}' };

      db.mockImplementation((table) => {
        if (table === 'channel_messages') {
          return { insert: jest.fn().mockResolvedValue([]) };
        }
        return {
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(mockChannel)
        };
      });

      const result = await InstagramService.sendImage(1, 'recipient-123', 'http://example.com/image.jpg');

      expect(result.success).toBe(true);
    });
  });

  describe('sendVideo', () => {
    it('should send video message', async () => {
      const mockChannel = { id: 1, credentials: '{}' };

      db.mockImplementation((table) => {
        if (table === 'channel_messages') {
          return { insert: jest.fn().mockResolvedValue([]) };
        }
        return {
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(mockChannel)
        };
      });

      const result = await InstagramService.sendVideo(1, 'recipient-123', 'http://example.com/video.mp4');

      expect(result.success).toBe(true);
    });
  });

  describe('sendAudio', () => {
    it('should send audio message', async () => {
      const mockChannel = { id: 1, credentials: '{}' };

      db.mockImplementation((table) => {
        if (table === 'channel_messages') {
          return { insert: jest.fn().mockResolvedValue([]) };
        }
        return {
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(mockChannel)
        };
      });

      const result = await InstagramService.sendAudio(1, 'recipient-123', 'http://example.com/audio.mp3');

      expect(result.success).toBe(true);
    });
  });

  describe('sendQuickReplies', () => {
    it('should send message with quick replies', async () => {
      const mockChannel = { id: 1, credentials: '{}' };

      db.mockImplementation((table) => {
        if (table === 'channel_messages') {
          return { insert: jest.fn().mockResolvedValue([]) };
        }
        return {
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(mockChannel)
        };
      });

      const quickReplies = [{ title: 'Yes', payload: 'YES' }];
      const result = await InstagramService.sendQuickReplies(1, 'recipient-123', 'Question?', quickReplies);

      expect(result.success).toBe(true);
    });
  });

  describe('sendButtons', () => {
    it('should send button template', async () => {
      const mockChannel = { id: 1, credentials: '{}' };

      db.mockImplementation((table) => {
        if (table === 'channel_messages') {
          return { insert: jest.fn().mockResolvedValue([]) };
        }
        return {
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(mockChannel)
        };
      });

      const buttons = [{ title: 'Option 1', payload: 'OPT1' }];
      const result = await InstagramService.sendButtons(1, 'recipient-123', 'Choose:', buttons);

      expect(result.success).toBe(true);
    });
  });

  describe('sendCarousel', () => {
    it('should send generic template (carousel)', async () => {
      const mockChannel = { id: 1, credentials: '{}' };

      db.mockImplementation((table) => {
        if (table === 'channel_messages') {
          return { insert: jest.fn().mockResolvedValue([]) };
        }
        return {
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(mockChannel)
        };
      });

      const elements = [{ title: 'Item 1', subtitle: 'Desc' }];
      const result = await InstagramService.sendCarousel(1, 'recipient-123', elements);

      expect(result.success).toBe(true);
    });
  });

  describe('sendStoryReply', () => {
    it('should send story reply', async () => {
      const mockChannel = { id: 1, credentials: '{}' };

      db.mockImplementation((table) => {
        if (table === 'channel_messages') {
          return { insert: jest.fn().mockResolvedValue([]) };
        }
        return {
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(mockChannel)
        };
      });

      const result = await InstagramService.sendStoryReply(1, 'recipient-123', 'Nice story!', 'story-123');

      expect(result.success).toBe(true);
    });
  });

  describe('sendReaction', () => {
    it('should send reaction', async () => {
      const mockChannel = { id: 1, credentials: '{}' };

      db.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockChannel)
      }));

      const result = await InstagramService.sendReaction(1, 'recipient-123', 'msg-123', '❤️');

      expect(result.success).toBe(true);
    });
  });

  describe('sendTyping', () => {
    it('should send typing indicator', async () => {
      const mockChannel = { id: 1, credentials: '{}' };

      db.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockChannel)
      }));

      const result = await InstagramService.sendTyping(1, 'recipient-123', true);

      expect(result.success).toBe(true);
    });
  });

  describe('getUserProfile', () => {
    it('should get user profile', async () => {
      const mockChannel = { id: 1, credentials: '{}' };

      db.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockChannel)
      }));

      const result = await InstagramService.getUserProfile(1, 'user-123');

      expect(result.success).toBe(true);
    });
  });

  describe('setIceBreakers', () => {
    it('should set ice breakers', async () => {
      const mockChannel = { id: 1, credentials: '{}' };

      db.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockChannel)
      }));

      const iceBreakers = [{ question: 'What can you do?', payload: 'HELP' }];
      const result = await InstagramService.setIceBreakers(1, iceBreakers);

      expect(result.success).toBe(true);
    });
  });

  describe('setPersistentMenu', () => {
    it('should set persistent menu', async () => {
      const mockChannel = { id: 1, credentials: '{}' };

      db.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockChannel)
      }));

      const menuItems = [{ title: 'Help', payload: 'HELP' }];
      const result = await InstagramService.setPersistentMenu(1, menuItems);

      expect(result.success).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return channel statistics', async () => {
      const mockChannel = { id: 1, credentials: '{}' };

      db.mockImplementation((table) => {
        if (table === 'channel_messages') {
          const chain = {
            where: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            count: jest.fn().mockReturnThis(),
            groupBy: jest.fn().mockResolvedValue([{ message_type: 'text', count: 10 }]),
            countDistinct: jest.fn().mockResolvedValue([{ count: 5 }])
          };
          // For first call (messageStats)
          chain.select.mockReturnValue([{
            total_messages: 100,
            inbound: 50,
            outbound: 50,
            delivered: 45,
            read: 40,
            failed: 2,
            today: 10
          }]);
          return chain;
        }
        return {
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(mockChannel)
        };
      });

      const result = await InstagramService.getStats(1);

      expect(result.channelId).toBe(1);
    });
  });

  describe('getOrgStats', () => {
    it('should return organization-wide statistics', async () => {
      db.mockImplementation((table) => {
        if (table === 'channels') {
          return {
            where: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockResolvedValue([
              { id: 1, is_active: true },
              { id: 2, is_active: false }
            ])
          };
        }
        return {
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue({ id: 1, credentials: '{}' }),
          select: jest.fn().mockResolvedValue([{
            total_messages: 50,
            inbound: 25,
            outbound: 25,
            delivered: 20,
            read: 15,
            failed: 1,
            today: 5
          }]),
          countDistinct: jest.fn().mockResolvedValue([{ count: 10 }]),
          count: jest.fn().mockReturnThis(),
          groupBy: jest.fn().mockResolvedValue([])
        };
      });

      const result = await InstagramService.getOrgStats(1);

      expect(result.totalChannels).toBe(2);
      expect(result.activeChannels).toBe(1);
    });
  });

  describe('getConversations', () => {
    it('should return conversations for a channel', async () => {
      db.mockImplementation(() => {
        const chain = {
          where: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          max: jest.fn().mockReturnThis(),
          groupBy: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          offset: jest.fn().mockResolvedValue([
            { sender_id: 'user-1', sender_name: 'User 1', last_message_at: new Date() }
          ]),
          whereNull: jest.fn().mockReturnThis(),
          count: jest.fn().mockResolvedValue([{ count: 2 }]),
          first: jest.fn().mockResolvedValue({ content: 'Hello', message_type: 'text' })
        };
        return chain;
      });

      const result = await InstagramService.getConversations(1);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getMessages', () => {
    it('should return messages for a conversation', async () => {
      db.mockImplementation(() => ({
        where: jest.fn(function() { return this; }),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([
          { id: 1, content: 'Hello', direction: 'inbound' },
          { id: 2, content: 'Hi', direction: 'outbound' }
        ])
      }));

      const result = await InstagramService.getMessages(1, 'user-123');

      expect(Array.isArray(result)).toBe(true);
    });

    it('should support before option', async () => {
      const mockQuery = {
        where: jest.fn(function() { return this; }),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis()
      };
      mockQuery.where.mockResolvedValue([]);

      db.mockImplementation(() => mockQuery);

      const before = new Date();
      await InstagramService.getMessages(1, 'user-123', { before });

      expect(mockQuery.where).toHaveBeenCalled();
    });
  });

  describe('storeOutboundMessage', () => {
    it('should store outbound message', async () => {
      db.mockImplementation(() => ({
        insert: jest.fn().mockResolvedValue([])
      }));

      const channel = { id: 1 };
      await InstagramService.storeOutboundMessage(
        channel,
        'recipient-123',
        'text',
        'Hello',
        { messageId: 'msg-1' }
      );

      expect(db).toHaveBeenCalledWith('channel_messages');
    });
  });

  describe('testConnection', () => {
    it('should return success for valid credentials', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          name: 'Test Page',
          id: 'page-123',
          instagram_business_account: { id: 'ig-123' }
        })
      }).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'ig-123',
          username: 'testuser',
          profile_picture_url: 'http://example.com/pic.jpg'
        })
      });

      const credentials = {
        page_id: 'page-123',
        access_token: 'token-123'
      };

      const result = await InstagramService.testConnection(credentials);

      expect(result.success).toBe(true);
      expect(result.username).toBe('testuser');
    });

    it('should return error for invalid credentials', async () => {
      mockProviderInstance.validateCredentials.mockResolvedValue(false);
      jest.resetModules();
      InstagramProvider.mockImplementation(() => mockProviderInstance);
      InstagramService = require('../../../services/channels/instagramService');

      const result = await InstagramService.testConnection({ invalid: true });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });
  });

  describe('getCapabilities', () => {
    it('should return provider capabilities', () => {
      const result = InstagramService.getCapabilities();

      expect(result.text).toBe(true);
      expect(result.image).toBe(true);
      expect(result.video).toBe(true);
    });
  });
});
