/**
 * Comprehensive Provider Tests
 * Tests for all channel providers: Telegram, Discord, Facebook, WhatsApp
 *
 * This test suite covers:
 * - Message sending methods
 * - Webhook verification
 * - Event handling
 * - API response parsing
 * - Error handling
 * - Rate limiting
 * - Media handling
 * - Channel configuration
 */

// Mock database
jest.mock('../../../db', () => ({
  query: jest.fn()
}));

// Mock logger
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// Mock node-fetch
jest.mock('node-fetch', () => jest.fn(), { virtual: true });

// Mock crypto for signature verification
const crypto = require('crypto');

// Mock Telegram service
jest.mock('../../../services/channels/telegramService', () => ({
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

// Mock Discord service
jest.mock('../../../services/channels/discordService', () => ({
  connectBot: jest.fn(),
  getDefaultSlashCommands: jest.fn(() => []),
  registerSlashCommands: jest.fn(),
  sendMessage: jest.fn(),
  sendEmbed: jest.fn(),
  buildInteractiveMessage: jest.fn(),
  createStandaloneThread: jest.fn(),
  sendTyping: jest.fn(),
  getUserInfo: jest.fn(),
  testConnection: jest.fn(),
  handleIncomingMessage: jest.fn(),
  handleSlashCommand: jest.fn(),
  handleButtonInteraction: jest.fn(),
  handleSelectMenuInteraction: jest.fn(),
  createThread: jest.fn(),
  sendToThread: jest.fn(),
  replyToInteraction: jest.fn(),
  deferReply: jest.fn(),
  editMessage: jest.fn(),
  deleteMessage: jest.fn(),
  addReaction: jest.fn(),
  getGuildInfo: jest.fn(),
  getMemberInfo: jest.fn()
}));

// Mock BaseProvider
jest.mock('../../../channels/providers/BaseProvider', () => {
  return class BaseProvider {
    constructor(config) {
      this.config = config;
    }
    log() {}
  };
});

const TelegramProvider = require('../../../channels/providers/TelegramProvider');
const DiscordProvider = require('../../../channels/providers/DiscordProvider');
const FacebookProvider = require('../../../channels/providers/FacebookProvider');
const WhatsAppProvider = require('../../../channels/providers/WhatsAppProvider');

const telegramService = require('../../../services/channels/telegramService');
const discordService = require('../../../services/channels/discordService');
const fetch = require('node-fetch');

describe('Comprehensive Provider Tests', () => {

  // ============================================
  // TELEGRAM PROVIDER TESTS
  // ============================================

  describe('TelegramProvider', () => {
    let provider;
    let mockChannel;

    beforeEach(() => {
      jest.clearAllMocks();
      provider = new TelegramProvider({});
      mockChannel = {
        bot_token: 'telegram-bot-token',
        id: 'telegram-channel-1'
      };
    });

    describe('Initialization', () => {
      test('should initialize with correct name and version', () => {
        expect(provider.name).toBe('telegram');
        expect(provider.version).toBe('1.0.0');
      });

      test('should have rate limits configured', () => {
        expect(provider.rateLimits.messagesPerSecond).toBe(30);
        expect(provider.rateLimits.messagesPerMinute).toBe(60);
        expect(provider.rateLimits.messagesPerChatPerSecond).toBe(1);
      });

      test('should initialize bot successfully', async () => {
        const result = await provider.initialize(mockChannel);
        expect(result).toBe(true);
        expect(telegramService.initBot).toHaveBeenCalledWith('telegram-bot-token');
      });

      test('should handle initialization errors', async () => {
        telegramService.initBot.mockImplementation(() => {
          throw new Error('Init failed');
        });
        const result = await provider.initialize(mockChannel);
        expect(result).toBe(false);
      });

      test('should use botToken property as fallback', async () => {
        const channel = { botToken: 'fallback-token' };
        await provider.initialize(channel);
        expect(telegramService.initBot).toHaveBeenCalledWith('fallback-token');
      });
    });

    describe('Message Sending', () => {
      test('should send text message successfully', async () => {
        telegramService.sendMessage.mockResolvedValue({ message_id: 123 });

        const result = await provider.send(mockChannel, {
          type: 'text',
          to: 'chat123',
          text: 'Hello World'
        });

        expect(result.success).toBe(true);
        expect(result.messageId).toBe(123);
        expect(telegramService.sendMessage).toHaveBeenCalledWith(
          'telegram-bot-token',
          'chat123',
          'Hello World',
          {}
        );
      });

      test('should send photo message', async () => {
        telegramService.sendPhoto.mockResolvedValue({ message_id: 124 });

        const result = await provider.send(mockChannel, {
          type: 'photo',
          to: 'chat123',
          media: 'https://example.com/photo.jpg'
        });

        expect(result.success).toBe(true);
        expect(result.messageId).toBe(124);
        expect(telegramService.sendPhoto).toHaveBeenCalled();
      });

      test('should send video message', async () => {
        telegramService.sendVideo.mockResolvedValue({ message_id: 125 });

        const result = await provider.send(mockChannel, {
          type: 'video',
          to: 'chat123',
          media: 'https://example.com/video.mp4'
        });

        expect(result.success).toBe(true);
        expect(telegramService.sendVideo).toHaveBeenCalled();
      });

      test('should send audio message', async () => {
        telegramService.sendAudio.mockResolvedValue({ message_id: 126 });

        const result = await provider.send(mockChannel, {
          type: 'audio',
          to: 'chat123',
          media: 'https://example.com/audio.mp3'
        });

        expect(result.success).toBe(true);
        expect(telegramService.sendAudio).toHaveBeenCalled();
      });

      test('should send document message', async () => {
        telegramService.sendDocument.mockResolvedValue({ message_id: 127 });

        const result = await provider.send(mockChannel, {
          type: 'document',
          to: 'chat123',
          media: 'https://example.com/document.pdf'
        });

        expect(result.success).toBe(true);
        expect(telegramService.sendDocument).toHaveBeenCalled();
      });

      test('should send sticker message', async () => {
        telegramService.sendSticker.mockResolvedValue({ message_id: 128 });

        const result = await provider.send(mockChannel, {
          type: 'sticker',
          to: 'chat123',
          sticker: 'sticker_id_123'
        });

        expect(result.success).toBe(true);
        expect(telegramService.sendSticker).toHaveBeenCalled();
      });

      test('should send location message', async () => {
        telegramService.sendLocation.mockResolvedValue({ message_id: 129 });

        const result = await provider.send(mockChannel, {
          type: 'location',
          to: 'chat123',
          latitude: 40.7128,
          longitude: -74.0060
        });

        expect(result.success).toBe(true);
        expect(telegramService.sendLocation).toHaveBeenCalled();
      });

      test('should send voice message', async () => {
        telegramService.sendVoice.mockResolvedValue({ message_id: 130 });

        const result = await provider.send(mockChannel, {
          type: 'voice',
          to: 'chat123',
          media: 'https://example.com/voice.ogg'
        });

        expect(result.success).toBe(true);
        expect(telegramService.sendVoice).toHaveBeenCalled();
      });

      test('should handle unsupported message type', async () => {
        const result = await provider.send(mockChannel, {
          type: 'unsupported',
          to: 'chat123'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Unsupported message type');
      });

      test('should handle send errors', async () => {
        telegramService.sendMessage.mockRejectedValue(new Error('Send failed'));

        const result = await provider.send(mockChannel, {
          type: 'text',
          to: 'chat123',
          text: 'Test'
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Send failed');
      });

      test('should send text message with options', async () => {
        telegramService.sendMessage.mockResolvedValue({ message_id: 131 });

        await provider.sendTextMessage(mockChannel, 'chat123', 'Hello', {
          parse_mode: 'Markdown'
        });

        expect(telegramService.sendMessage).toHaveBeenCalledWith(
          'telegram-bot-token',
          'chat123',
          'Hello',
          { parse_mode: 'Markdown' }
        );
      });

      test('should send media message', async () => {
        telegramService.sendPhoto.mockResolvedValue({ message_id: 132 });

        await provider.sendMediaMessage(mockChannel, 'chat123', 'photo',
          'https://example.com/image.jpg', { caption: 'Test' });

        expect(telegramService.sendPhoto).toHaveBeenCalled();
      });

      test('should send template with keyboard', async () => {
        telegramService.sendMessage.mockResolvedValue({ message_id: 133 });

        const result = await provider.sendTemplate(mockChannel, 'chat123', 'Menu', 'en', [
          { type: 'button', text: 'Option 1', callback_data: 'opt1' }
        ]);

        expect(result.success).toBe(true);
      });
    });

    describe('Webhook Handling', () => {
      test('should verify webhook with correct token', () => {
        const request = {
          headers: { 'x-telegram-bot-api-secret-token': 'correct-secret' }
        };

        const result = provider.verify(request, 'correct-secret');
        expect(result).toBe(true);
      });

      test('should reject webhook with incorrect token', () => {
        const request = {
          headers: { 'x-telegram-bot-api-secret-token': 'wrong-secret' }
        };

        const result = provider.verify(request, 'correct-secret');
        expect(result).toBe(false);
      });

      test('should handle challenge (Telegram does not use challenges)', () => {
        const result = provider.handleChallenge({}, 'token');
        expect(result).toBeNull();
      });

      test('should process webhook payload', async () => {
        telegramService.handleIncomingMessage.mockResolvedValue({
          type: 'text',
          userId: 'user123',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          chatId: 'chat123',
          chatType: 'private',
          messageId: 'msg123',
          text: 'Hello',
          date: new Date(),
          raw: {}
        });

        const events = await provider.processWebhook(null, {
          message: { text: 'Hello' }
        }, {});

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe('text');
        expect(events[0].from.id).toBe('user123');
      });

      test('should handle webhook processing errors', async () => {
        telegramService.handleIncomingMessage.mockRejectedValue(new Error('Parse error'));

        const events = await provider.processWebhook(null, {}, {});
        expect(events).toHaveLength(0);
      });

      test('should receive and parse incoming message', async () => {
        const payload = { message: { text: 'Test' } };
        telegramService.handleIncomingMessage.mockResolvedValue({
          type: 'text',
          text: 'Test'
        });

        const result = await provider.receive(payload);
        expect(result.type).toBe('text');
      });
    });

    describe('Rate Limiting', () => {
      test('should initialize rate limit tracker', async () => {
        telegramService.sendMessage.mockResolvedValue({ message_id: 200 });

        await provider.send(mockChannel, {
          type: 'text',
          to: 'chat123',
          text: 'Test'
        });

        const key = `telegram-bot-token:chat123`;
        expect(provider.rateLimitTrackers.has(key)).toBe(true);
      });

      test('should track message count per minute', async () => {
        telegramService.sendMessage.mockResolvedValue({ message_id: 201 });

        await provider.send(mockChannel, {
          type: 'text',
          to: 'chat123',
          text: 'Test'
        });

        const key = `telegram-bot-token:chat123`;
        const tracker = provider.rateLimitTrackers.get(key);
        expect(tracker.messagesThisMinute).toBe(1);
      });

      test('should delay helper work correctly', async () => {
        const start = Date.now();
        await provider.delay(100);
        const elapsed = Date.now() - start;
        expect(elapsed).toBeGreaterThanOrEqual(95);
      });
    });

    describe('Media Handling', () => {
      test('should upload media (returns as-is for Telegram)', async () => {
        const media = 'https://example.com/image.jpg';
        const result = await provider.uploadMedia(mockChannel, media, 'image/jpeg');
        expect(result).toBe(media);
      });

      test('should download media', async () => {
        const mockBot = telegramService.getBot();
        mockBot.api.getFile.mockResolvedValue({
          file_path: 'photos/file.jpg',
          file_size: 12345
        });

        const result = await provider.downloadMedia(mockChannel, 'file123');
        expect(result.url).toContain('file.jpg');
        expect(result.fileSize).toBe(12345);
      });

      test('should handle download media errors', async () => {
        const mockBot = telegramService.getBot();
        mockBot.api.getFile.mockRejectedValue(new Error('Download failed'));

        await expect(provider.downloadMedia(mockChannel, 'file123'))
          .rejects.toThrow('Failed to download media');
      });
    });

    describe('User Profile', () => {
      test('should get user profile', async () => {
        const mockBot = telegramService.getBot();
        mockBot.api.getChat.mockResolvedValue({
          id: 123,
          first_name: 'John',
          last_name: 'Doe',
          username: 'johndoe',
          bio: 'Test bio'
        });
        mockBot.api.getUserProfilePhotos.mockResolvedValue({
          total_count: 1,
          photos: [[{ file_id: 'photo123' }]]
        });

        const profile = await provider.getUserProfile(mockChannel, 123);
        expect(profile.firstName).toBe('John');
        expect(profile.username).toBe('johndoe');
        expect(profile.photo).toBe('photo123');
      });

      test('should handle user profile errors', async () => {
        const mockBot = telegramService.getBot();
        mockBot.api.getChat.mockRejectedValue(new Error('User not found'));

        const profile = await provider.getUserProfile(mockChannel, 123);
        expect(profile).toBeNull();
      });
    });

    describe('Message Status', () => {
      test('should get message status', async () => {
        const status = await provider.getMessageStatus(mockChannel, 'msg123');
        expect(status.status).toBe('delivered');
        expect(status.messageId).toBe('msg123');
      });

      test('should mark as read (not supported)', async () => {
        const result = await provider.markAsRead(mockChannel, 'msg123');
        expect(result).toBe(true);
      });
    });

    describe('Typing Indicator', () => {
      test('should send typing indicator', async () => {
        telegramService.sendChatAction.mockResolvedValue({});

        const result = await provider.sendTypingIndicator(mockChannel, 'chat123', true);
        expect(result).toBe(true);
        expect(telegramService.sendChatAction).toHaveBeenCalledWith(
          'telegram-bot-token',
          'chat123',
          'typing'
        );
      });

      test('should not send typing off', async () => {
        const result = await provider.sendTypingIndicator(mockChannel, 'chat123', false);
        expect(result).toBe(true);
        expect(telegramService.sendChatAction).not.toHaveBeenCalled();
      });

      test('should handle typing indicator errors', async () => {
        telegramService.sendChatAction.mockRejectedValue(new Error('Failed'));

        const result = await provider.sendTypingIndicator(mockChannel, 'chat123', true);
        expect(result).toBe(false);
      });
    });

    describe('Credential Validation', () => {
      test('should validate credentials successfully', async () => {
        telegramService.testConnection.mockResolvedValue({ success: true });

        const result = await provider.validateCredentials({ botToken: 'test-token' });
        expect(result).toBe(true);
      });

      test('should fail validation with invalid credentials', async () => {
        telegramService.testConnection.mockResolvedValue({ success: false });

        const result = await provider.validateCredentials({ botToken: 'invalid-token' });
        expect(result).toBe(false);
      });
    });

    describe('Capabilities', () => {
      test('should return correct capabilities', () => {
        const capabilities = provider.getCapabilities();
        expect(capabilities.textMessages).toBe(true);
        expect(capabilities.mediaMessages).toBe(true);
        expect(capabilities.templates).toBe(false);
        expect(capabilities.stickers).toBe(true);
        expect(capabilities.voice).toBe(true);
        expect(capabilities.locationMessages).toBe(true);
        expect(capabilities.interactiveMessages).toBe(true);
        expect(capabilities.groups).toBe(true);
      });
    });

    describe('Chat Management', () => {
      test('should get chat info', async () => {
        const mockBot = telegramService.getBot();
        mockBot.api.getChat.mockResolvedValue({
          id: 'chat123',
          type: 'group',
          title: 'Test Group',
          username: 'testgroup',
          description: 'Test description',
          member_count: 42
        });

        const chatInfo = await provider.getChatInfo(mockChannel, 'chat123');
        expect(chatInfo.type).toBe('group');
        expect(chatInfo.title).toBe('Test Group');
        expect(chatInfo.memberCount).toBe(42);
      });

      test('should get chat member count', async () => {
        const mockBot = telegramService.getBot();
        mockBot.api.getChatMemberCount.mockResolvedValue(100);

        const count = await provider.getChatMemberCount(mockChannel, 'chat123');
        expect(count).toBe(100);
      });

      test('should get chat administrators', async () => {
        const mockBot = telegramService.getBot();
        mockBot.api.getChatAdministrators.mockResolvedValue([
          { user: { id: 1, username: 'admin1' } }
        ]);

        const admins = await provider.getChatAdministrators(mockChannel, 'chat123');
        expect(admins).toHaveLength(1);
      });

      test('should leave chat', async () => {
        const mockBot = telegramService.getBot();
        mockBot.api.leaveChat.mockResolvedValue(true);

        const result = await provider.leaveChat(mockChannel, 'chat123');
        expect(result).toBe(true);
      });

      test('should pin message', async () => {
        const mockBot = telegramService.getBot();
        mockBot.api.pinChatMessage.mockResolvedValue(true);

        const result = await provider.pinMessage(mockChannel, 'chat123', 'msg123');
        expect(result).toBe(true);
      });

      test('should unpin message', async () => {
        const mockBot = telegramService.getBot();
        mockBot.api.unpinChatMessage.mockResolvedValue(true);

        const result = await provider.unpinMessage(mockChannel, 'chat123', 'msg123');
        expect(result).toBe(true);
      });
    });

    describe('Webhook Management', () => {
      test('should setup webhook', async () => {
        telegramService.setWebhook.mockResolvedValue({ success: true });

        const result = await provider.setupWebhook(mockChannel, 'https://example.com/webhook');
        expect(result.success).toBe(true);
      });

      test('should delete webhook', async () => {
        telegramService.deleteWebhook.mockResolvedValue({ success: true });

        const result = await provider.deleteWebhook(mockChannel, true);
        expect(result.success).toBe(true);
      });

      test('should get webhook info', async () => {
        telegramService.getWebhookInfo.mockResolvedValue({
          url: 'https://example.com/webhook',
          has_custom_certificate: false
        });

        const info = await provider.getWebhookInfo(mockChannel);
        expect(info.url).toBe('https://example.com/webhook');
      });
    });

    describe('Inline Queries', () => {
      test('should answer inline query', async () => {
        const mockBot = telegramService.getBot();
        mockBot.api.answerInlineQuery.mockResolvedValue(true);

        const result = await provider.answerInlineQuery(mockChannel, 'query123', []);
        expect(result).toBe(true);
      });
    });

    describe('Callback Queries', () => {
      test('should answer callback query', async () => {
        telegramService.answerCallbackQuery.mockResolvedValue({ success: true });

        const result = await provider.answerCallbackQuery(mockChannel, 'callback123', {});
        expect(result.success).toBe(true);
      });
    });

    describe('Message Editing', () => {
      test('should edit message text', async () => {
        telegramService.editMessageText.mockResolvedValue({ success: true });

        const result = await provider.editMessageText(
          mockChannel, 'chat123', 'msg123', 'Updated text'
        );
        expect(result.success).toBe(true);
      });

      test('should delete message', async () => {
        telegramService.deleteMessage.mockResolvedValue({ success: true });

        const result = await provider.deleteMessage(mockChannel, 'chat123', 'msg123');
        expect(result.success).toBe(true);
      });
    });

    describe('Commands', () => {
      test('should set bot commands', async () => {
        const mockBot = telegramService.getBot();
        mockBot.api.setMyCommands.mockResolvedValue(true);

        const result = await provider.setCommands(mockChannel, [
          { command: 'start', description: 'Start bot' }
        ]);
        expect(result).toBe(true);
      });

      test('should get bot commands', async () => {
        const mockBot = telegramService.getBot();
        mockBot.api.getMyCommands.mockResolvedValue([
          { command: 'start', description: 'Start bot' }
        ]);

        const commands = await provider.getCommands(mockChannel);
        expect(commands).toHaveLength(1);
      });
    });
  });

  // ============================================
  // DISCORD PROVIDER TESTS
  // ============================================

  describe('DiscordProvider', () => {
    let provider;
    let mockChannel;

    beforeEach(() => {
      jest.clearAllMocks();
      provider = new DiscordProvider({});
      mockChannel = {
        bot_token: 'discord-bot-token',
        client_id: 'client-123',
        id: 'discord-channel-1'
      };
    });

    describe('Initialization', () => {
      test('should initialize with correct name and version', () => {
        expect(provider.name).toBe('discord');
        expect(provider.version).toBe('1.0.0');
      });

      test('should have rate limits configured', () => {
        expect(provider.rateLimits.messagesPerSecond).toBe(5);
        expect(provider.rateLimits.messagesPerMinute).toBe(120);
        expect(provider.rateLimits.messagesPerChannelPerSecond).toBe(5);
      });

      test('should initialize bot successfully', async () => {
        discordService.connectBot.mockResolvedValue({});
        discordService.registerSlashCommands.mockResolvedValue({});

        const result = await provider.initialize(mockChannel);
        expect(result).toBe(true);
        expect(discordService.connectBot).toHaveBeenCalledWith('discord-bot-token');
      });

      test('should handle initialization errors', async () => {
        discordService.connectBot.mockRejectedValue(new Error('Connection failed'));

        const result = await provider.initialize(mockChannel);
        expect(result).toBe(false);
      });

      test('should register slash commands on init', async () => {
        discordService.connectBot.mockResolvedValue({});
        discordService.getDefaultSlashCommands.mockReturnValue([
          { name: 'test', description: 'Test command' }
        ]);

        await provider.initialize(mockChannel);
        expect(discordService.registerSlashCommands).toHaveBeenCalled();
      });
    });

    describe('Message Sending', () => {
      test('should send text message', async () => {
        discordService.sendMessage.mockResolvedValue({ id: 'msg123' });

        const result = await provider.send(mockChannel, {
          type: 'text',
          to: 'channel123',
          text: 'Hello Discord'
        });

        expect(result.success).toBe(true);
        expect(result.messageId).toBe('msg123');
      });

      test('should send embed message', async () => {
        discordService.sendEmbed.mockResolvedValue({ id: 'msg124' });

        const result = await provider.send(mockChannel, {
          type: 'embed',
          to: 'channel123',
          embed: { title: 'Test Embed', color: 0x00FF00 }
        });

        expect(result.success).toBe(true);
        expect(discordService.sendEmbed).toHaveBeenCalled();
      });

      test('should send interactive message', async () => {
        discordService.buildInteractiveMessage.mockReturnValue({
          content: 'Test',
          components: []
        });
        discordService.connectBot.mockResolvedValue({
          channels: {
            fetch: jest.fn().mockResolvedValue({
              send: jest.fn().mockResolvedValue({ id: 'msg125' })
            })
          }
        });

        const result = await provider.send(mockChannel, {
          type: 'interactive',
          to: 'channel123',
          content: 'Choose an option',
          components: []
        });

        expect(result.success).toBe(true);
      });

      test('should create thread', async () => {
        discordService.createStandaloneThread.mockResolvedValue({ id: 'thread123' });

        const result = await provider.send(mockChannel, {
          type: 'thread',
          to: 'channel123',
          threadName: 'Discussion',
          text: 'Start discussion'
        });

        expect(result.success).toBe(true);
      });

      test('should handle send errors', async () => {
        discordService.sendMessage.mockRejectedValue(new Error('Send failed'));

        const result = await provider.send(mockChannel, {
          type: 'text',
          to: 'channel123',
          text: 'Test'
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Send failed');
      });

      test('should send text message using helper', async () => {
        discordService.sendMessage.mockResolvedValue({ id: 'msg126' });

        await provider.sendTextMessage(mockChannel, 'channel123', 'Hello');
        expect(discordService.sendMessage).toHaveBeenCalled();
      });

      test('should send media message as embed', async () => {
        const result = await provider.sendMediaMessage(
          mockChannel, 'channel123', 'image', 'https://example.com/image.jpg',
          { caption: 'Test image' }
        );

        expect(result.type).toBe('embed');
      });

      test('should send embed using helper', async () => {
        discordService.sendEmbed.mockResolvedValue({ id: 'msg127' });

        await provider.sendEmbed(mockChannel, 'channel123', {
          title: 'Test',
          color: 0xFF0000
        });

        expect(discordService.sendEmbed).toHaveBeenCalled();
      });
    });

    describe('Webhook Handling', () => {
      test('should verify webhook signature', () => {
        const request = {
          headers: {
            'x-signature-ed25519': 'signature',
            'x-signature-timestamp': '1234567890'
          }
        };

        const result = provider.verify(request, 'secret');
        expect(result).toBe(true);
      });

      test('should reject webhook without signature', () => {
        const request = { headers: {} };
        const result = provider.verify(request, 'secret');
        expect(result).toBe(false);
      });

      test('should handle challenge (not used by Discord)', () => {
        const result = provider.handleChallenge({}, 'token');
        expect(result).toBeNull();
      });

      test('should process MESSAGE_CREATE webhook', async () => {
        discordService.handleIncomingMessage.mockResolvedValue({
          type: 'message',
          userId: 'user123',
          username: 'testuser',
          channelId: 'channel123',
          messageId: 'msg123',
          content: 'Hello'
        });

        const events = await provider.processWebhook(null, {
          type: 'MESSAGE_CREATE',
          message: { content: 'Hello' }
        }, {});

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe('message');
      });

      test('should process INTERACTION_CREATE webhook with slash command', async () => {
        discordService.handleSlashCommand.mockResolvedValue({
          type: 'slash_command',
          commandName: 'test'
        });

        const events = await provider.processWebhook(null, {
          type: 'INTERACTION_CREATE',
          interaction: { type: 2 }
        }, {});

        expect(events).toHaveLength(1);
      });

      test('should process button interaction', async () => {
        discordService.handleButtonInteraction.mockResolvedValue({
          type: 'button',
          customId: 'btn123'
        });

        const events = await provider.processWebhook(null, {
          type: 'INTERACTION_CREATE',
          interaction: { type: 3, componentType: 2 }
        }, {});

        expect(events).toHaveLength(1);
      });

      test('should process select menu interaction', async () => {
        discordService.handleSelectMenuInteraction.mockResolvedValue({
          type: 'select',
          customId: 'select123'
        });

        const events = await provider.processWebhook(null, {
          type: 'INTERACTION_CREATE',
          interaction: { type: 3, componentType: 3 }
        }, {});

        expect(events).toHaveLength(1);
      });
    });

    describe('Message Status', () => {
      test('should get message status (always delivered)', async () => {
        const status = await provider.getMessageStatus(mockChannel, 'msg123');
        expect(status.status).toBe('delivered');
      });

      test('should mark as read (not supported)', async () => {
        const result = await provider.markAsRead(mockChannel, 'msg123');
        expect(result).toBe(true);
      });
    });

    describe('Typing Indicator', () => {
      test('should send typing indicator', async () => {
        discordService.sendTyping.mockResolvedValue({});

        const result = await provider.sendTypingIndicator(mockChannel, 'channel123', true);
        expect(result).toBe(true);
      });

      test('should handle typing errors', async () => {
        discordService.sendTyping.mockRejectedValue(new Error('Failed'));

        const result = await provider.sendTypingIndicator(mockChannel, 'channel123', true);
        expect(result).toBe(false);
      });
    });

    describe('Media Handling', () => {
      test('should upload media (returns as-is)', async () => {
        const media = 'https://example.com/image.jpg';
        const result = await provider.uploadMedia(mockChannel, media, 'image/jpeg');
        expect(result).toBe(media);
      });

      test('should download media', async () => {
        const result = await provider.downloadMedia(mockChannel, 'https://cdn.discord.com/file.jpg');
        expect(result.url).toBe('https://cdn.discord.com/file.jpg');
        expect(result.directDownload).toBe(true);
      });
    });

    describe('User Profile', () => {
      test('should get user profile', async () => {
        discordService.getUserInfo.mockResolvedValue({
          id: 'user123',
          username: 'testuser',
          discriminator: '1234'
        });

        const profile = await provider.getUserProfile(mockChannel, 'user123');
        expect(profile.username).toBe('testuser');
      });

      test('should handle user profile errors', async () => {
        discordService.getUserInfo.mockRejectedValue(new Error('User not found'));

        const profile = await provider.getUserProfile(mockChannel, 'user123');
        expect(profile).toBeNull();
      });
    });

    describe('Credential Validation', () => {
      test('should validate credentials', async () => {
        discordService.testConnection.mockResolvedValue({ success: true });

        const result = await provider.validateCredentials({ botToken: 'test-token' });
        expect(result).toBe(true);
      });
    });

    describe('Capabilities', () => {
      test('should return correct capabilities', () => {
        const capabilities = provider.getCapabilities();
        expect(capabilities.textMessages).toBe(true);
        expect(capabilities.embeds).toBe(true);
        expect(capabilities.threads).toBe(true);
        expect(capabilities.slashCommands).toBe(true);
        expect(capabilities.reactions).toBe(true);
        expect(capabilities.interactiveMessages).toBe(true);
      });
    });

    describe('Discord-Specific Methods', () => {
      test('should send embed message', async () => {
        discordService.sendEmbed.mockResolvedValue({ id: 'msg200' });

        const result = await provider.sendEmbedMessage(mockChannel, 'channel123', {
          title: 'Test'
        });
        expect(result.id).toBe('msg200');
      });

      test('should create thread', async () => {
        discordService.createThread.mockResolvedValue({ id: 'thread123' });

        const result = await provider.createThread(mockChannel, 'channel123', 'msg123', {
          name: 'Discussion'
        });
        expect(result.id).toBe('thread123');
      });

      test('should send to thread', async () => {
        discordService.sendToThread.mockResolvedValue({ id: 'msg201' });

        const result = await provider.sendToThread(mockChannel, 'thread123', 'Hello');
        expect(result.id).toBe('msg201');
      });

      test('should register slash commands', async () => {
        discordService.registerSlashCommands.mockResolvedValue({});

        await provider.registerSlashCommands(mockChannel, [
          { name: 'test', description: 'Test' }
        ]);
        expect(discordService.registerSlashCommands).toHaveBeenCalled();
      });

      test('should reply to interaction', async () => {
        discordService.replyToInteraction.mockResolvedValue({});

        const result = await provider.replyToInteraction(
          { id: 'interaction123' },
          { content: 'Reply' }
        );
        expect(discordService.replyToInteraction).toHaveBeenCalled();
      });

      test('should defer interaction', async () => {
        discordService.deferReply.mockResolvedValue({});

        await provider.deferInteraction({ id: 'interaction123' }, false);
        expect(discordService.deferReply).toHaveBeenCalled();
      });

      test('should edit message', async () => {
        discordService.editMessage.mockResolvedValue({ id: 'msg202' });

        const result = await provider.editMessage(
          mockChannel, 'channel123', 'msg123', 'Updated content'
        );
        expect(result.id).toBe('msg202');
      });

      test('should delete message', async () => {
        discordService.deleteMessage.mockResolvedValue(true);

        const result = await provider.deleteMessage(mockChannel, 'channel123', 'msg123');
        expect(result).toBe(true);
      });

      test('should add reaction', async () => {
        discordService.addReaction.mockResolvedValue(true);

        const result = await provider.addReaction(
          mockChannel, 'channel123', 'msg123', '👍'
        );
        expect(result).toBe(true);
      });

      test('should get guild info', async () => {
        discordService.getGuildInfo.mockResolvedValue({
          id: 'guild123',
          name: 'Test Guild'
        });

        const info = await provider.getGuildInfo(mockChannel, 'guild123');
        expect(info.name).toBe('Test Guild');
      });

      test('should get member info', async () => {
        discordService.getMemberInfo.mockResolvedValue({
          user: { id: 'user123', username: 'testuser' },
          roles: []
        });

        const info = await provider.getMemberInfo(mockChannel, 'guild123', 'user123');
        expect(info.user.username).toBe('testuser');
      });
    });

    describe('Rate Limiting', () => {
      test('should apply rate limiting', async () => {
        discordService.sendMessage.mockResolvedValue({ id: 'msg300' });

        await provider.send(mockChannel, {
          type: 'text',
          to: 'channel123',
          text: 'Test'
        });

        const key = `discord-bot-token:channel123`;
        expect(provider.rateLimitTrackers.has(key)).toBe(true);
      });

      test('should track messages per minute', async () => {
        discordService.sendMessage.mockResolvedValue({ id: 'msg301' });

        await provider.send(mockChannel, {
          type: 'text',
          to: 'channel123',
          text: 'Test'
        });

        const key = `discord-bot-token:channel123`;
        const tracker = provider.rateLimitTrackers.get(key);
        expect(tracker.messagesThisMinute).toBe(1);
      });
    });
  });

  // ============================================
  // FACEBOOK PROVIDER TESTS
  // ============================================

  describe('FacebookProvider', () => {
    let provider;

    beforeEach(() => {
      jest.clearAllMocks();
      provider = new FacebookProvider({
        pageAccessToken: 'fb-page-token',
        appSecret: 'fb-app-secret',
        verifyToken: 'fb-verify-token'
      });
      fetch.mockClear();
    });

    describe('Initialization', () => {
      test('should initialize with config', () => {
        expect(provider.pageAccessToken).toBe('fb-page-token');
        expect(provider.appSecret).toBe('fb-app-secret');
        expect(provider.verifyToken).toBe('fb-verify-token');
      });

      test('should use default API version', () => {
        expect(provider.apiVersion).toBe('v18.0');
        expect(provider.baseUrl).toContain('v18.0');
      });

      test('should accept custom API version', () => {
        const customProvider = new FacebookProvider({ apiVersion: 'v19.0' });
        expect(customProvider.apiVersion).toBe('v19.0');
      });
    });

    describe('Webhook Verification', () => {
      test('should verify webhook successfully', () => {
        const result = provider.verifyWebhook({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'fb-verify-token',
          'hub.challenge': 'challenge123'
        });

        expect(result.success).toBe(true);
        expect(result.challenge).toBe('challenge123');
      });

      test('should reject invalid verification token', () => {
        const result = provider.verifyWebhook({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong-token',
          'hub.challenge': 'challenge123'
        });

        expect(result.success).toBe(false);
      });

      test('should reject invalid mode', () => {
        const result = provider.verifyWebhook({
          'hub.mode': 'unsubscribe',
          'hub.verify_token': 'fb-verify-token',
          'hub.challenge': 'challenge123'
        });

        expect(result.success).toBe(false);
      });
    });

    describe('Signature Validation', () => {
      test('should validate correct signature', () => {
        const rawBody = JSON.stringify({ test: 'data' });
        const hash = crypto.createHmac('sha256', 'fb-app-secret')
          .update(rawBody)
          .digest('hex');

        const result = provider.validateSignature(rawBody, `sha256=${hash}`);
        expect(result).toBe(true);
      });

      test('should reject invalid signature', () => {
        const rawBody = JSON.stringify({ test: 'data' });
        const result = provider.validateSignature(rawBody, 'sha256=invalid');
        expect(result).toBe(false);
      });

      test('should reject missing signature', () => {
        const result = provider.validateSignature('body', null);
        expect(result).toBe(false);
      });

      test('should reject malformed signature', () => {
        const result = provider.validateSignature('body', 'invalid-format');
        expect(result).toBe(false);
      });
    });

    describe('Message Sending', () => {
      test('should send text message successfully', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ message_id: 'msg123', recipient_id: 'user123' })
        });

        const result = await provider.sendText('user123', 'Hello');
        expect(result.success).toBe(true);
        expect(result.messageId).toBe('msg123');
      });

      test('should send message with options', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ message_id: 'msg124' })
        });

        await provider.sendMessage('user123', { text: 'Hello' }, {
          messagingType: 'UPDATE',
          tag: 'ACCOUNT_UPDATE'
        });

        expect(fetch).toHaveBeenCalled();
      });

      test('should handle send errors', async () => {
        fetch.mockResolvedValue({
          ok: false,
          json: async () => ({ error: { message: 'Send failed' } })
        });

        const result = await provider.sendText('user123', 'Hello');
        expect(result.success).toBe(false);
        expect(result.error.message).toBe('Send failed');
      });

      test('should handle network errors', async () => {
        fetch.mockRejectedValue(new Error('Network error'));

        const result = await provider.sendText('user123', 'Hello');
        expect(result.success).toBe(false);
        expect(result.error).toBe('Network error');
      });

      test('should send image', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ message_id: 'msg125' })
        });

        const result = await provider.sendImage('user123', 'https://example.com/image.jpg');
        expect(result.success).toBe(true);
      });

      test('should send video', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ message_id: 'msg126' })
        });

        const result = await provider.sendVideo('user123', 'https://example.com/video.mp4');
        expect(result.success).toBe(true);
      });

      test('should send audio', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ message_id: 'msg127' })
        });

        const result = await provider.sendAudio('user123', 'https://example.com/audio.mp3');
        expect(result.success).toBe(true);
      });

      test('should send file', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ message_id: 'msg128' })
        });

        const result = await provider.sendFile('user123', 'https://example.com/file.pdf');
        expect(result.success).toBe(true);
      });
    });

    describe('Templates', () => {
      test('should send generic template', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ message_id: 'msg200' })
        });

        const elements = [
          {
            title: 'Item 1',
            subtitle: 'Description',
            imageUrl: 'https://example.com/image.jpg',
            buttons: [
              { type: 'web_url', url: 'https://example.com', title: 'View' }
            ]
          }
        ];

        const result = await provider.sendGenericTemplate('user123', elements);
        expect(result.success).toBe(true);
      });

      test('should send button template', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ message_id: 'msg201' })
        });

        const buttons = [
          { type: 'postback', title: 'Button 1', payload: 'btn1' }
        ];

        const result = await provider.sendButtonTemplate('user123', 'Choose:', buttons);
        expect(result.success).toBe(true);
      });

      test('should send receipt template', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ message_id: 'msg202' })
        });

        const receipt = {
          recipientName: 'John Doe',
          orderNumber: 'ORDER123',
          currency: 'USD',
          paymentMethod: 'Visa',
          summary: { total_cost: 100.00 }
        };

        const result = await provider.sendReceiptTemplate('user123', receipt);
        expect(result.success).toBe(true);
      });

      test('should format buttons correctly', () => {
        const buttons = [
          { type: 'web_url', url: 'https://example.com', title: 'Visit' },
          { type: 'postback', payload: 'action1', title: 'Action' },
          { type: 'phone_number', phoneNumber: '+1234567890', title: 'Call' }
        ];

        const formatted = provider.formatButtons(buttons);
        expect(formatted).toHaveLength(3);
        expect(formatted[0].type).toBe('web_url');
        expect(formatted[1].type).toBe('postback');
        expect(formatted[2].type).toBe('phone_number');
      });
    });

    describe('Quick Replies', () => {
      test('should send quick replies', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ message_id: 'msg300' })
        });

        const quickReplies = [
          { title: 'Option 1', payload: 'opt1' },
          { contentType: 'location' }
        ];

        const result = await provider.sendQuickReplies('user123', 'Choose:', quickReplies);
        expect(result.success).toBe(true);
      });
    });

    describe('Sender Actions', () => {
      test('should send typing on', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ success: true })
        });

        const result = await provider.showTypingOn('user123');
        expect(result.success).toBe(true);
      });

      test('should send typing off', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ success: true })
        });

        const result = await provider.showTypingOff('user123');
        expect(result.success).toBe(true);
      });

      test('should mark seen', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ success: true })
        });

        const result = await provider.markSeen('user123');
        expect(result.success).toBe(true);
      });
    });

    describe('User Profile', () => {
      test('should get user profile', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            id: 'user123',
            first_name: 'John',
            last_name: 'Doe',
            profile_pic: 'https://example.com/pic.jpg',
            locale: 'en_US',
            timezone: -7
          })
        });

        const result = await provider.getUserProfile('user123');
        expect(result.success).toBe(true);
        expect(result.profile.firstName).toBe('John');
        expect(result.profile.lastName).toBe('Doe');
      });

      test('should handle user profile errors', async () => {
        fetch.mockResolvedValue({
          ok: false,
          json: async () => ({ error: { message: 'User not found' } })
        });

        const result = await provider.getUserProfile('user123');
        expect(result.success).toBe(false);
      });
    });

    describe('Webhook Event Parsing', () => {
      test('should parse text message event', () => {
        const body = {
          object: 'page',
          entry: [{
            id: 'page123',
            time: 1234567890,
            messaging: [{
              sender: { id: 'user123' },
              recipient: { id: 'page123' },
              timestamp: 1234567890,
              message: {
                mid: 'msg123',
                text: 'Hello'
              }
            }]
          }]
        };

        const events = provider.parseWebhookEvent(body);
        expect(events).toHaveLength(1);
        expect(events[0].type).toBe('text');
        expect(events[0].text).toBe('Hello');
      });

      test('should parse postback event', () => {
        const body = {
          object: 'page',
          entry: [{
            messaging: [{
              sender: { id: 'user123' },
              recipient: { id: 'page123' },
              postback: {
                payload: 'GET_STARTED',
                title: 'Get Started'
              }
            }]
          }]
        };

        const events = provider.parseWebhookEvent(body);
        expect(events).toHaveLength(1);
        expect(events[0].type).toBe('postback');
        expect(events[0].payload).toBe('GET_STARTED');
      });

      test('should parse attachment event', () => {
        const body = {
          object: 'page',
          entry: [{
            messaging: [{
              sender: { id: 'user123' },
              recipient: { id: 'page123' },
              message: {
                mid: 'msg124',
                attachments: [{
                  type: 'image',
                  payload: { url: 'https://example.com/image.jpg' }
                }]
              }
            }]
          }]
        };

        const events = provider.parseWebhookEvent(body);
        expect(events).toHaveLength(1);
        expect(events[0].type).toBe('attachments');
        expect(events[0].attachments[0].type).toBe('image');
      });

      test('should parse delivery event', () => {
        const body = {
          object: 'page',
          entry: [{
            messaging: [{
              sender: { id: 'user123' },
              recipient: { id: 'page123' },
              delivery: {
                mids: ['msg123'],
                watermark: 1234567890
              }
            }]
          }]
        };

        const events = provider.parseWebhookEvent(body);
        expect(events).toHaveLength(1);
        expect(events[0].type).toBe('delivery');
      });

      test('should parse read event', () => {
        const body = {
          object: 'page',
          entry: [{
            messaging: [{
              sender: { id: 'user123' },
              recipient: { id: 'page123' },
              read: {
                watermark: 1234567890
              }
            }]
          }]
        };

        const events = provider.parseWebhookEvent(body);
        expect(events).toHaveLength(1);
        expect(events[0].type).toBe('read');
      });

      test('should return empty array for non-page events', () => {
        const body = { object: 'user' };
        const events = provider.parseWebhookEvent(body);
        expect(events).toHaveLength(0);
      });
    });

    describe('Attachment Upload', () => {
      test('should upload attachment', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ attachment_id: 'attach123' })
        });

        const result = await provider.uploadAttachment('image', 'https://example.com/image.jpg');
        expect(result.success).toBe(true);
        expect(result.attachmentId).toBe('attach123');
      });
    });

    describe('Persistent Menu', () => {
      test('should set persistent menu', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ result: 'success' })
        });

        const menuItems = [
          { type: 'postback', title: 'Menu Item', payload: 'menu1' }
        ];

        const result = await provider.setPersistentMenu(menuItems);
        expect(result.success).toBe(true);
      });

      test('should delete persistent menu', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ result: 'success' })
        });

        const result = await provider.deletePersistentMenu();
        expect(result.success).toBe(true);
      });
    });

    describe('Get Started Button', () => {
      test('should set get started button', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ result: 'success' })
        });

        const result = await provider.setGetStartedButton('GET_STARTED');
        expect(result.success).toBe(true);
      });
    });

    describe('Greeting Text', () => {
      test('should set greeting text', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ result: 'success' })
        });

        const result = await provider.setGreetingText('Welcome!');
        expect(result.success).toBe(true);
      });

      test('should set multiple greetings', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ result: 'success' })
        });

        const greetings = [
          { locale: 'en_US', text: 'Welcome!' },
          { locale: 'es_ES', text: 'Bienvenido!' }
        ];

        const result = await provider.setGreetingText(greetings);
        expect(result.success).toBe(true);
      });
    });

    describe('Handover Protocol', () => {
      test('should pass thread control', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ success: true })
        });

        const result = await provider.passThreadControl('user123', 'app456', 'metadata');
        expect(result.success).toBe(true);
      });

      test('should take thread control', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ success: true })
        });

        const result = await provider.takeThreadControl('user123', 'metadata');
        expect(result.success).toBe(true);
      });

      test('should request thread control', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ success: true })
        });

        const result = await provider.requestThreadControl('user123', 'metadata');
        expect(result.success).toBe(true);
      });
    });
  });

  // ============================================
  // WHATSAPP PROVIDER TESTS
  // ============================================

  describe('WhatsAppProvider', () => {
    let provider;
    let mockChannel;

    beforeEach(() => {
      jest.clearAllMocks();
      provider = new WhatsAppProvider({});
      mockChannel = {
        credentials: {
          phone_number_id: 'phone123',
          access_token: 'whatsapp-token',
          business_account_id: 'business123',
          app_secret: 'app-secret'
        },
        id: 'whatsapp-channel-1'
      };
      fetch.mockClear();
    });

    describe('Initialization', () => {
      test('should initialize with correct name', () => {
        expect(provider.name).toBe('whatsapp');
        expect(provider.version).toBe('1.0.0');
      });

      test('should use default API version', () => {
        expect(provider.apiVersion).toBe('v18.0');
      });

      test('should initialize successfully', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ id: 'phone123' })
        });

        const result = await provider.initialize(mockChannel);
        expect(result).toBe(true);
      });

      test('should handle initialization errors', async () => {
        fetch.mockResolvedValue({
          ok: false,
          json: async () => ({ error: 'Invalid credentials' })
        });

        await expect(provider.initialize(mockChannel)).rejects.toThrow();
      });
    });

    describe('Message Sending', () => {
      test('should send text message', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ messages: [{ id: 'msg123' }] })
        });

        const result = await provider.sendTextMessage(mockChannel, '+1234567890', 'Hello');
        expect(result.success).toBe(true);
        expect(result.messageId).toBe('msg123');
      });

      test('should send image message', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ messages: [{ id: 'msg124' }] })
        });

        const result = await provider.sendMediaMessage(
          mockChannel, '+1234567890', 'image', 'https://example.com/image.jpg',
          { caption: 'Test image' }
        );
        expect(result.success).toBe(true);
      });

      test('should send video message', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ messages: [{ id: 'msg125' }] })
        });

        const result = await provider.sendMediaMessage(
          mockChannel, '+1234567890', 'video', 'https://example.com/video.mp4'
        );
        expect(result.success).toBe(true);
      });

      test('should send audio message', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ messages: [{ id: 'msg126' }] })
        });

        const result = await provider.sendMediaMessage(
          mockChannel, '+1234567890', 'audio', 'https://example.com/audio.mp3'
        );
        expect(result.success).toBe(true);
      });

      test('should send document message', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ messages: [{ id: 'msg127' }] })
        });

        const result = await provider.sendMediaMessage(
          mockChannel, '+1234567890', 'document', 'https://example.com/doc.pdf',
          { filename: 'document.pdf' }
        );
        expect(result.success).toBe(true);
      });

      test('should send template message', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ messages: [{ id: 'msg128' }] })
        });

        const result = await provider.sendTemplate(
          mockChannel, '+1234567890', 'hello_world', 'en'
        );
        expect(result.success).toBe(true);
      });

      test('should send interactive message', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ messages: [{ id: 'msg129' }] })
        });

        const result = await provider.send(mockChannel, {
          type: 'interactive',
          to: '+1234567890',
          interactiveType: 'button',
          body: 'Choose an option',
          action: { buttons: [] }
        });
        expect(result.success).toBe(true);
      });

      test('should send location message', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ messages: [{ id: 'msg130' }] })
        });

        const result = await provider.send(mockChannel, {
          type: 'location',
          to: '+1234567890',
          latitude: 40.7128,
          longitude: -74.0060,
          name: 'New York',
          address: 'NYC, USA'
        });
        expect(result.success).toBe(true);
      });

      test('should send contact message', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ messages: [{ id: 'msg131' }] })
        });

        const result = await provider.send(mockChannel, {
          type: 'contact',
          to: '+1234567890',
          contacts: [{ name: { formatted_name: 'John Doe' } }]
        });
        expect(result.success).toBe(true);
      });

      test('should send reaction', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ messages: [{ id: 'msg132' }] })
        });

        const result = await provider.sendReaction(
          mockChannel, '+1234567890', 'msg123', '👍'
        );
        expect(result.success).toBe(true);
      });

      test('should handle send errors', async () => {
        fetch.mockResolvedValue({
          ok: false,
          json: async () => ({ error: { message: 'Send failed' } })
        });

        await expect(provider.sendTextMessage(mockChannel, '+1234567890', 'Test'))
          .rejects.toThrow('Send failed');
      });

      test('should handle unsupported message type', async () => {
        await expect(provider.send(mockChannel, {
          type: 'unsupported',
          to: '+1234567890'
        })).rejects.toThrow('Unsupported message type');
      });
    });

    describe('Webhook Handling', () => {
      test('should verify webhook signature', () => {
        const body = JSON.stringify({ test: 'data' });
        const signature = 'sha256=' + crypto.createHmac('sha256', 'app-secret')
          .update(body)
          .digest('hex');

        const request = {
          headers: { 'x-hub-signature-256': signature },
          body
        };

        const result = provider.verify(request, 'app-secret');
        expect(result).toBe(true);
      });

      test('should reject invalid signature', () => {
        const request = {
          headers: { 'x-hub-signature-256': 'sha256=invalid' },
          body: JSON.stringify({ test: 'data' })
        };

        const result = provider.verify(request, 'app-secret');
        expect(result).toBe(false);
      });

      test('should handle webhook challenge', () => {
        const challenge = provider.handleChallenge({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'verify-token',
          'hub.challenge': 'challenge123'
        }, 'verify-token');

        expect(challenge).toBe('challenge123');
      });

      test('should reject invalid challenge', () => {
        const challenge = provider.handleChallenge({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong-token',
          'hub.challenge': 'challenge123'
        }, 'verify-token');

        expect(challenge).toBeNull();
      });
    });

    describe('Phone Number Formatting', () => {
      test('should format phone number correctly', () => {
        expect(provider.formatPhoneNumber('+1 (234) 567-8900')).toBe('12345678900');
      });

      test('should remove + prefix', () => {
        expect(provider.formatPhoneNumber('+1234567890')).toBe('1234567890');
      });

      test('should handle already formatted numbers', () => {
        expect(provider.formatPhoneNumber('1234567890')).toBe('1234567890');
      });
    });

    describe('Media Handling', () => {
      test('should download media', async () => {
        fetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              url: 'https://example.com/media.jpg',
              mime_type: 'image/jpeg',
              sha256: 'hash123',
              file_size: 12345
            })
          })
          .mockResolvedValueOnce({
            ok: true,
            buffer: async () => Buffer.from('image data')
          });

        const result = await provider.downloadMedia(mockChannel, 'media123');
        expect(result.mimeType).toBe('image/jpeg');
        expect(result.fileSize).toBe(12345);
      });

      test('should handle media download errors', async () => {
        fetch.mockResolvedValue({
          ok: false,
          json: async () => ({ error: 'Not found' })
        });

        await expect(provider.downloadMedia(mockChannel, 'media123'))
          .rejects.toThrow();
      });
    });

    describe('Message Status', () => {
      test('should mark message as read', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ success: true })
        });

        const result = await provider.markAsRead(mockChannel, 'msg123');
        expect(result).toBe(true);
      });

      test('should handle mark as read errors', async () => {
        fetch.mockRejectedValue(new Error('Failed'));

        const result = await provider.markAsRead(mockChannel, 'msg123');
        expect(result).toBe(false);
      });

      test('should get message status', async () => {
        const status = await provider.getMessageStatus(mockChannel, 'msg123');
        expect(status.status).toBe('unknown');
        expect(status.note).toContain('webhooks');
      });
    });

    describe('User Profile', () => {
      test('should get user profile (limited)', async () => {
        const profile = await provider.getUserProfile(mockChannel, 'user123');
        expect(profile.id).toBe('user123');
        expect(profile.note).toContain('webhook');
      });
    });

    describe('Typing Indicator', () => {
      test('should not support typing indicator', async () => {
        const result = await provider.sendTypingIndicator(mockChannel, '+1234567890', true);
        expect(result).toBe(true);
      });
    });

    describe('Credential Validation', () => {
      test('should validate credentials', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ id: 'phone123' })
        });

        const result = await provider.validateCredentials({
          phoneNumberId: 'phone123',
          accessToken: 'token'
        });
        expect(result).toBe(true);
      });

      test('should fail validation with invalid credentials', async () => {
        fetch.mockResolvedValue({
          ok: false
        });

        const result = await provider.validateCredentials({
          phoneNumberId: 'phone123',
          accessToken: 'invalid'
        });
        expect(result).toBe(false);
      });

      test('should fail validation with missing credentials', async () => {
        const result = await provider.validateCredentials({});
        expect(result).toBe(false);
      });
    });

    describe('Templates', () => {
      test('should get templates', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            data: [
              { name: 'hello_world', language: 'en', status: 'APPROVED' }
            ]
          })
        });

        mockChannel.credentials.business_account_id = 'business123';
        const templates = await provider.getTemplates(mockChannel);
        expect(templates).toHaveLength(1);
        expect(templates[0].name).toBe('hello_world');
      });

      test('should handle template fetch errors', async () => {
        fetch.mockResolvedValue({
          ok: false,
          json: async () => ({ error: 'Failed' })
        });

        mockChannel.credentials.business_account_id = 'business123';
        await expect(provider.getTemplates(mockChannel)).rejects.toThrow();
      });
    });

    describe('Capabilities', () => {
      test('should return correct capabilities', () => {
        const capabilities = provider.getCapabilities();
        expect(capabilities.textMessages).toBe(true);
        expect(capabilities.mediaMessages).toBe(true);
        expect(capabilities.templates).toBe(true);
        expect(capabilities.reactions).toBe(true);
        expect(capabilities.typing).toBe(false);
        expect(capabilities.locationMessages).toBe(true);
        expect(capabilities.interactiveMessages).toBe(true);
      });
    });

    describe('Credential Extraction', () => {
      test('should extract credentials from channel', () => {
        const creds = provider.getCredentials(mockChannel);
        expect(creds.phoneNumberId).toBe('phone123');
        expect(creds.accessToken).toBe('whatsapp-token');
        expect(creds.businessAccountId).toBe('business123');
      });

      test('should handle missing credentials object', () => {
        const channelWithoutCreds = { id: 'channel1' };
        const creds = provider.getCredentials(channelWithoutCreds);
        expect(creds.phoneNumberId).toBeUndefined();
      });
    });
  });
});
