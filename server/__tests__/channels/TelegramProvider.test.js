/**
 * Telegram Provider Tests
 * Tests for Telegram Bot API integration
 */

jest.mock('../../services/channels/telegramService', () => ({
  initBot: jest.fn(),
  getBot: jest.fn(() => ({
    api: {
      getFile: jest.fn(),
      getChat: jest.fn(),
      getUserProfilePhotos: jest.fn(),
      getChatMemberCount: jest.fn(),
      getChatAdministrators: jest.fn(),
      leaveChat: jest.fn(),
      pinChatMessage: jest.fn(),
      unpinChatMessage: jest.fn(),
      answerInlineQuery: jest.fn(),
      setMyCommands: jest.fn(),
      getMyCommands: jest.fn()
    }
  })),
  sendMessage: jest.fn(),
  sendPhoto: jest.fn(),
  sendVideo: jest.fn(),
  sendAudio: jest.fn(),
  sendDocument: jest.fn(),
  sendSticker: jest.fn(),
  sendLocation: jest.fn(),
  sendVoice: jest.fn(),
  sendChatAction: jest.fn(),
  handleIncomingMessage: jest.fn(),
  testConnection: jest.fn(),
  setWebhook: jest.fn(),
  deleteWebhook: jest.fn(),
  getWebhookInfo: jest.fn(),
  answerCallbackQuery: jest.fn(),
  editMessageText: jest.fn(),
  deleteMessage: jest.fn()
}));

jest.mock('../../channels/providers/BaseProvider', () => {
  return class BaseProvider {
    constructor(config) {
      this.config = config;
    }
    log() {}
  };
});

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const TelegramProvider = require('../../channels/providers/TelegramProvider');
const telegramService = require('../../services/channels/telegramService');

describe('TelegramProvider', () => {
  let provider;
  let mockChannel;

  beforeEach(() => {
    jest.clearAllMocks();

    provider = new TelegramProvider({});
    mockChannel = {
      bot_token: 'test-bot-token',
      id: 'channel-1'
    };
  });

  describe('constructor', () => {
    it('should initialize with correct name and version', () => {
      expect(provider.name).toBe('telegram');
      expect(provider.version).toBe('1.0.0');
    });

    it('should have rate limits defined', () => {
      expect(provider.rateLimits.messagesPerSecond).toBe(30);
      expect(provider.rateLimits.messagesPerMinute).toBe(60);
    });
  });

  describe('initialize', () => {
    it('should initialize bot successfully', async () => {
      const result = await provider.initialize(mockChannel);

      expect(result).toBe(true);
      expect(telegramService.initBot).toHaveBeenCalledWith('test-bot-token');
    });

    it('should handle initialization errors', async () => {
      telegramService.initBot.mockImplementation(() => {
        throw new Error('Init error');
      });

      const result = await provider.initialize(mockChannel);

      expect(result).toBe(false);
    });

    it('should use botToken property as fallback', async () => {
      const channel = { botToken: 'fallback-token' };

      await provider.initialize(channel);

      expect(telegramService.initBot).toHaveBeenCalledWith('fallback-token');
    });
  });

  describe('send', () => {
    it('should send text message', async () => {
      telegramService.sendMessage.mockResolvedValue({ message_id: 123 });

      const result = await provider.send(mockChannel, {
        type: 'text',
        to: 'chat123',
        text: 'Hello World'
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe(123);
      expect(telegramService.sendMessage).toHaveBeenCalled();
    });

    it('should send photo', async () => {
      telegramService.sendPhoto.mockResolvedValue({ message_id: 124 });

      const result = await provider.send(mockChannel, {
        type: 'photo',
        to: 'chat123',
        media: 'https://example.com/photo.jpg'
      });

      expect(result.success).toBe(true);
      expect(telegramService.sendPhoto).toHaveBeenCalled();
    });

    it('should send video', async () => {
      telegramService.sendVideo.mockResolvedValue({ message_id: 125 });

      const result = await provider.send(mockChannel, {
        type: 'video',
        to: 'chat123',
        media: 'https://example.com/video.mp4'
      });

      expect(result.success).toBe(true);
    });

    it('should send audio', async () => {
      telegramService.sendAudio.mockResolvedValue({ message_id: 126 });

      const result = await provider.send(mockChannel, {
        type: 'audio',
        to: 'chat123',
        media: 'https://example.com/audio.mp3'
      });

      expect(result.success).toBe(true);
    });

    it('should send document', async () => {
      telegramService.sendDocument.mockResolvedValue({ message_id: 127 });

      const result = await provider.send(mockChannel, {
        type: 'document',
        to: 'chat123',
        media: 'https://example.com/file.pdf'
      });

      expect(result.success).toBe(true);
    });

    it('should send sticker', async () => {
      telegramService.sendSticker.mockResolvedValue({ message_id: 128 });

      const result = await provider.send(mockChannel, {
        type: 'sticker',
        to: 'chat123',
        sticker: 'sticker-id'
      });

      expect(result.success).toBe(true);
    });

    it('should send location', async () => {
      telegramService.sendLocation.mockResolvedValue({ message_id: 129 });

      const result = await provider.send(mockChannel, {
        type: 'location',
        to: 'chat123',
        latitude: 40.7128,
        longitude: -74.006
      });

      expect(result.success).toBe(true);
    });

    it('should send voice message', async () => {
      telegramService.sendVoice.mockResolvedValue({ message_id: 130 });

      const result = await provider.send(mockChannel, {
        type: 'voice',
        to: 'chat123',
        media: 'https://example.com/voice.ogg'
      });

      expect(result.success).toBe(true);
    });

    it('should throw error for unsupported message type', async () => {
      const result = await provider.send(mockChannel, {
        type: 'unknown',
        to: 'chat123'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported message type');
    });

    it('should handle send errors', async () => {
      telegramService.sendMessage.mockRejectedValue(new Error('Send failed'));

      const result = await provider.send(mockChannel, {
        type: 'text',
        to: 'chat123',
        text: 'Hello'
      });

      expect(result.success).toBe(false);
    });
  });

  describe('sendTextMessage', () => {
    it('should send text message', async () => {
      telegramService.sendMessage.mockResolvedValue({ message_id: 123 });

      const result = await provider.sendTextMessage(mockChannel, 'chat123', 'Hello');

      expect(result.success).toBe(true);
    });
  });

  describe('sendMediaMessage', () => {
    it('should send media message', async () => {
      telegramService.sendPhoto.mockResolvedValue({ message_id: 123 });

      const result = await provider.sendMediaMessage(
        mockChannel,
        'chat123',
        'photo',
        'https://example.com/photo.jpg'
      );

      expect(result.success).toBe(true);
    });
  });

  describe('sendTemplate', () => {
    it('should send template as text with keyboard', async () => {
      telegramService.sendMessage.mockResolvedValue({ message_id: 123 });

      const components = [
        { type: 'button', text: 'Option 1', callback_data: 'opt1' }
      ];

      const result = await provider.sendTemplate(
        mockChannel,
        'chat123',
        'Choose an option:',
        'en',
        components
      );

      expect(result.success).toBe(true);
    });
  });

  describe('receive', () => {
    it('should parse incoming message', async () => {
      telegramService.handleIncomingMessage.mockResolvedValue({
        type: 'text',
        text: 'Hello'
      });

      const result = await provider.receive({ update_id: 123 });

      expect(result.type).toBe('text');
    });
  });

  describe('verify', () => {
    it('should verify valid secret token', () => {
      const request = {
        headers: { 'x-telegram-bot-api-secret-token': 'secret123' }
      };

      const result = provider.verify(request, 'secret123');

      expect(result).toBe(true);
    });

    it('should reject invalid secret token', () => {
      const request = {
        headers: { 'x-telegram-bot-api-secret-token': 'wrong' }
      };

      const result = provider.verify(request, 'secret123');

      expect(result).toBe(false);
    });
  });

  describe('handleChallenge', () => {
    it('should return null (Telegram does not use challenges)', () => {
      const result = provider.handleChallenge({}, 'token');
      expect(result).toBeNull();
    });
  });

  describe('getMessageStatus', () => {
    it('should return delivered status', async () => {
      const result = await provider.getMessageStatus(mockChannel, 'msg123');

      expect(result.status).toBe('delivered');
      expect(result.messageId).toBe('msg123');
    });
  });

  describe('markAsRead', () => {
    it('should return true', async () => {
      const result = await provider.markAsRead(mockChannel, 'msg123');
      expect(result).toBe(true);
    });
  });

  describe('sendTypingIndicator', () => {
    it('should send typing action', async () => {
      telegramService.sendChatAction.mockResolvedValue(true);

      const result = await provider.sendTypingIndicator(mockChannel, 'chat123', true);

      expect(result).toBe(true);
      expect(telegramService.sendChatAction).toHaveBeenCalledWith(
        'test-bot-token',
        'chat123',
        'typing'
      );
    });

    it('should return true when typing is false', async () => {
      const result = await provider.sendTypingIndicator(mockChannel, 'chat123', false);
      expect(result).toBe(true);
    });

    it('should handle errors', async () => {
      telegramService.sendChatAction.mockRejectedValue(new Error('Error'));

      const result = await provider.sendTypingIndicator(mockChannel, 'chat123', true);

      expect(result).toBe(false);
    });
  });

  describe('uploadMedia', () => {
    it('should return media as-is', async () => {
      const media = 'https://example.com/image.jpg';
      const result = await provider.uploadMedia(mockChannel, media, 'image/jpeg');

      expect(result).toBe(media);
    });
  });

  describe('downloadMedia', () => {
    it('should download media file', async () => {
      const bot = telegramService.getBot('test-bot-token');
      bot.api.getFile.mockResolvedValue({
        file_path: 'photos/photo.jpg',
        file_size: 12345
      });

      const result = await provider.downloadMedia(mockChannel, 'file123');

      expect(result.url).toContain('api.telegram.org');
      expect(result.filePath).toBe('photos/photo.jpg');
    });

    it('should handle download errors', async () => {
      const bot = telegramService.getBot('test-bot-token');
      bot.api.getFile.mockRejectedValue(new Error('File not found'));

      await expect(provider.downloadMedia(mockChannel, 'file123')).rejects.toThrow();
    });
  });

  describe('getUserProfile', () => {
    it('should get user profile', async () => {
      const bot = telegramService.getBot('test-bot-token');
      bot.api.getChat.mockResolvedValue({
        id: 123,
        first_name: 'John',
        last_name: 'Doe',
        username: 'johndoe',
        bio: 'Hello world'
      });
      bot.api.getUserProfilePhotos.mockResolvedValue({
        total_count: 1,
        photos: [[{ file_id: 'photo123' }]]
      });

      const result = await provider.getUserProfile(mockChannel, 123);

      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
      expect(result.photo).toBe('photo123');
    });

    it('should return null on error', async () => {
      const bot = telegramService.getBot('test-bot-token');
      bot.api.getChat.mockRejectedValue(new Error('User not found'));

      const result = await provider.getUserProfile(mockChannel, 123);

      expect(result).toBeNull();
    });
  });

  describe('validateCredentials', () => {
    it('should validate credentials', async () => {
      telegramService.testConnection.mockResolvedValue({ success: true });

      const result = await provider.validateCredentials({ botToken: 'test-token' });

      expect(result).toBe(true);
    });

    it('should return false for invalid credentials', async () => {
      telegramService.testConnection.mockResolvedValue({ success: false });

      const result = await provider.validateCredentials({ botToken: 'invalid' });

      expect(result).toBe(false);
    });
  });

  describe('getCapabilities', () => {
    it('should return correct capabilities', () => {
      const caps = provider.getCapabilities();

      expect(caps.textMessages).toBe(true);
      expect(caps.mediaMessages).toBe(true);
      expect(caps.templates).toBe(false);
      expect(caps.stickers).toBe(true);
      expect(caps.voice).toBe(true);
      expect(caps.groups).toBe(true);
      expect(caps.inlineMode).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it('should track rate limits', async () => {
      telegramService.sendMessage.mockResolvedValue({ message_id: 123 });

      // First message should work
      await provider.send(mockChannel, {
        type: 'text',
        to: 'chat123',
        text: 'Message 1'
      });

      expect(provider.rateLimitTrackers.size).toBeGreaterThan(0);
    });

    it('should delay messages correctly', async () => {
      const delayTime = await provider.delay(10);
      expect(delayTime).toBeUndefined(); // Promise resolves without value
    });
  });

  describe('Group/Channel Methods', () => {
    it('should get chat info', async () => {
      const bot = telegramService.getBot('test-bot-token');
      bot.api.getChat.mockResolvedValue({
        id: -123,
        type: 'group',
        title: 'Test Group'
      });

      const result = await provider.getChatInfo(mockChannel, -123);

      expect(result.type).toBe('group');
      expect(result.title).toBe('Test Group');
    });

    it('should get chat member count', async () => {
      const bot = telegramService.getBot('test-bot-token');
      bot.api.getChatMemberCount.mockResolvedValue(100);

      const result = await provider.getChatMemberCount(mockChannel, -123);

      expect(result).toBe(100);
    });

    it('should get chat administrators', async () => {
      const bot = telegramService.getBot('test-bot-token');
      bot.api.getChatAdministrators.mockResolvedValue([{ user: { id: 1 } }]);

      const result = await provider.getChatAdministrators(mockChannel, -123);

      expect(result.length).toBe(1);
    });

    it('should leave chat', async () => {
      const bot = telegramService.getBot('test-bot-token');
      bot.api.leaveChat.mockResolvedValue(true);

      const result = await provider.leaveChat(mockChannel, -123);

      expect(result).toBe(true);
    });

    it('should pin message', async () => {
      const bot = telegramService.getBot('test-bot-token');
      bot.api.pinChatMessage.mockResolvedValue(true);

      const result = await provider.pinMessage(mockChannel, -123, 456);

      expect(result).toBe(true);
    });

    it('should unpin message', async () => {
      const bot = telegramService.getBot('test-bot-token');
      bot.api.unpinChatMessage.mockResolvedValue(true);

      const result = await provider.unpinMessage(mockChannel, -123, 456);

      expect(result).toBe(true);
    });
  });

  describe('Webhook Management', () => {
    it('should setup webhook', async () => {
      telegramService.setWebhook.mockResolvedValue({ success: true });

      const result = await provider.setupWebhook(mockChannel, 'https://example.com/webhook');

      expect(result.success).toBe(true);
    });

    it('should delete webhook', async () => {
      telegramService.deleteWebhook.mockResolvedValue({ success: true });

      const result = await provider.deleteWebhook(mockChannel);

      expect(result.success).toBe(true);
    });

    it('should get webhook info', async () => {
      telegramService.getWebhookInfo.mockResolvedValue({ url: 'https://example.com/webhook' });

      const result = await provider.getWebhookInfo(mockChannel);

      expect(result.url).toBe('https://example.com/webhook');
    });
  });

  describe('Inline Query', () => {
    it('should answer inline query', async () => {
      const bot = telegramService.getBot('test-bot-token');
      bot.api.answerInlineQuery.mockResolvedValue(true);

      const results = [{ type: 'article', id: '1', title: 'Test' }];
      const result = await provider.answerInlineQuery(mockChannel, 'query123', results);

      expect(result).toBe(true);
    });
  });

  describe('Callback Query', () => {
    it('should answer callback query', async () => {
      telegramService.answerCallbackQuery.mockResolvedValue({ success: true });

      const result = await provider.answerCallbackQuery(mockChannel, 'query123', { text: 'OK' });

      expect(result.success).toBe(true);
    });
  });

  describe('Message Editing', () => {
    it('should edit message text', async () => {
      telegramService.editMessageText.mockResolvedValue({ success: true });

      const result = await provider.editMessageText(
        mockChannel,
        'chat123',
        'msg123',
        'Updated text'
      );

      expect(result.success).toBe(true);
    });

    it('should delete message', async () => {
      telegramService.deleteMessage.mockResolvedValue({ success: true });

      const result = await provider.deleteMessage(mockChannel, 'chat123', 'msg123');

      expect(result.success).toBe(true);
    });
  });

  describe('Commands', () => {
    it('should set commands', async () => {
      const bot = telegramService.getBot('test-bot-token');
      bot.api.setMyCommands.mockResolvedValue(true);

      const commands = [{ command: 'start', description: 'Start the bot' }];
      const result = await provider.setCommands(mockChannel, commands);

      expect(result).toBe(true);
    });

    it('should get commands', async () => {
      const bot = telegramService.getBot('test-bot-token');
      bot.api.getMyCommands.mockResolvedValue([{ command: 'start', description: 'Start' }]);

      const result = await provider.getCommands(mockChannel);

      expect(result.length).toBe(1);
    });
  });
});
