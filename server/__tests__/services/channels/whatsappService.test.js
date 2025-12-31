/**
 * WhatsAppService Tests
 */

jest.mock('../../../channels/providers/WhatsAppProvider', () => {
  return jest.fn().mockImplementation(() => ({
    validateCredentials: jest.fn().mockResolvedValue(true),
    sendTextMessage: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-1' }),
    sendMediaMessage: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-2' }),
    sendTemplate: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-3' }),
    sendInteractiveMessage: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-4' }),
    sendLocationMessage: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-5' }),
    sendReaction: jest.fn().mockResolvedValue({ success: true }),
    markAsRead: jest.fn().mockResolvedValue({ success: true }),
    getTemplates: jest.fn().mockResolvedValue({ success: true, templates: [] }),
    uploadMedia: jest.fn().mockResolvedValue({ success: true, mediaId: 'media-1' }),
    downloadMedia: jest.fn().mockResolvedValue({ success: true }),
    getCapabilities: jest.fn(() => ({ text: true, image: true }))
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
const WhatsAppProvider = require('../../../channels/providers/WhatsAppProvider');

describe('WhatsAppService', () => {
  let WhatsAppService;
  let mockProviderInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    mockProviderInstance = new WhatsAppProvider();

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
        raw: jest.fn((sql) => sql)
      };
      return chain;
    });
    db.raw = jest.fn((sql) => sql);

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        display_phone_number: '+1234567890',
        verified_name: 'Test Business',
        quality_rating: 'GREEN'
      })
    });

    WhatsAppService = require('../../../services/channels/whatsappService');
  });

  describe('createChannel', () => {
    it('should create a WhatsApp channel', async () => {
      const credentials = {
        phone_number_id: 'phone-123',
        access_token: 'token-123'
      };

      const result = await WhatsAppService.createChannel(1, 'bot-1', credentials);

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
    });

    it('should throw error for invalid credentials', async () => {
      mockProviderInstance.validateCredentials.mockResolvedValue(false);
      jest.resetModules();
      WhatsAppProvider.mockImplementation(() => mockProviderInstance);
      WhatsAppService = require('../../../services/channels/whatsappService');

      const credentials = { phone_number_id: 'invalid' };

      await expect(WhatsAppService.createChannel(1, 'bot-1', credentials))
        .rejects.toThrow('Invalid WhatsApp credentials');
    });
  });

  describe('getPhoneNumberInfo', () => {
    it('should return phone number info', async () => {
      const credentials = {
        phone_number_id: 'phone-123',
        access_token: 'token-123'
      };

      const result = await WhatsAppService.getPhoneNumberInfo(credentials);

      expect(result.display_phone_number).toBe('+1234567890');
      expect(result.verified_name).toBe('Test Business');
    });

    it('should handle fetch error', async () => {
      global.fetch.mockResolvedValue({ ok: false });

      const result = await WhatsAppService.getPhoneNumberInfo({
        phone_number_id: 'invalid',
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

      const result = await WhatsAppService.updateChannel(1, { name: 'Updated' });

      expect(result.name).toBe('Updated');
    });
  });

  describe('deleteChannel', () => {
    it('should delete channel', async () => {
      db.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        delete: jest.fn().mockResolvedValue(1)
      }));

      const result = await WhatsAppService.deleteChannel(1);

      expect(result).toBe(true);
    });
  });

  describe('getChannel', () => {
    it('should return channel by ID', async () => {
      db.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ id: 1, provider: 'whatsapp' })
      }));

      const result = await WhatsAppService.getChannel(1);

      expect(result.id).toBe(1);
    });
  });

  describe('getChannels', () => {
    it('should return all WhatsApp channels for org', async () => {
      db.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }])
      }));

      const result = await WhatsAppService.getChannels(1);

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

      const result = await WhatsAppService.sendText(1, '+1234567890', 'Hello');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-1');
    });

    it('should throw error if channel not found', async () => {
      db.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null)
      }));

      await expect(WhatsAppService.sendText(999, '+1234567890', 'Hello'))
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

      const result = await WhatsAppService.sendImage(1, '+1234567890', 'http://example.com/image.jpg');

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

      const result = await WhatsAppService.sendVideo(1, '+1234567890', 'http://example.com/video.mp4');

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

      const result = await WhatsAppService.sendAudio(1, '+1234567890', 'http://example.com/audio.mp3');

      expect(result.success).toBe(true);
    });
  });

  describe('sendDocument', () => {
    it('should send document message', async () => {
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

      const result = await WhatsAppService.sendDocument(1, '+1234567890', 'http://example.com/doc.pdf');

      expect(result.success).toBe(true);
    });
  });

  describe('sendTemplate', () => {
    it('should send template message', async () => {
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

      const result = await WhatsAppService.sendTemplate(1, '+1234567890', 'welcome_template', 'en');

      expect(result.success).toBe(true);
    });
  });

  describe('sendInteractive', () => {
    it('should send interactive message', async () => {
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

      const result = await WhatsAppService.sendInteractive(
        1,
        '+1234567890',
        'button',
        'Choose an option',
        { buttons: [{ id: '1', title: 'Option 1' }] }
      );

      expect(result.success).toBe(true);
    });
  });

  describe('sendLocation', () => {
    it('should send location message', async () => {
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

      const result = await WhatsAppService.sendLocation(1, '+1234567890', 37.7749, -122.4194);

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

      const result = await WhatsAppService.sendReaction(1, '+1234567890', 'msg-123', '👍');

      expect(result.success).toBe(true);
    });
  });

  describe('markAsRead', () => {
    it('should mark message as read', async () => {
      const mockChannel = { id: 1, credentials: '{}' };

      db.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockChannel)
      }));

      const result = await WhatsAppService.markAsRead(1, 'msg-123');

      expect(result.success).toBe(true);
    });
  });

  describe('getTemplates', () => {
    it('should get available templates', async () => {
      const mockChannel = { id: 1, credentials: '{}' };

      db.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockChannel)
      }));

      const result = await WhatsAppService.getTemplates(1);

      expect(result.success).toBe(true);
    });
  });

  describe('uploadMedia', () => {
    it('should upload media', async () => {
      const mockChannel = { id: 1, credentials: '{}' };

      db.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockChannel)
      }));

      const result = await WhatsAppService.uploadMedia(1, Buffer.from('test'), 'image/jpeg');

      expect(result.success).toBe(true);
    });
  });

  describe('downloadMedia', () => {
    it('should download media', async () => {
      const mockChannel = { id: 1, credentials: '{}' };

      db.mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockChannel)
      }));

      const result = await WhatsAppService.downloadMedia(1, 'media-123');

      expect(result.success).toBe(true);
    });
  });

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      const credentials = {
        phone_number_id: 'phone-123',
        access_token: 'token-123'
      };

      const result = await WhatsAppService.testConnection(credentials);

      expect(result.success).toBe(true);
      expect(result.phoneNumber).toBe('+1234567890');
    });

    it('should return error for invalid credentials', async () => {
      mockProviderInstance.validateCredentials.mockResolvedValue(false);
      jest.resetModules();
      WhatsAppProvider.mockImplementation(() => mockProviderInstance);
      WhatsAppService = require('../../../services/channels/whatsappService');

      const result = await WhatsAppService.testConnection({ invalid: true });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });
  });

  describe('getCapabilities', () => {
    it('should return provider capabilities', () => {
      const result = WhatsAppService.getCapabilities();

      expect(result.text).toBe(true);
      expect(result.image).toBe(true);
    });
  });
});
