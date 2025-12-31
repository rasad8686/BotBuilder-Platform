/**
 * Telegram Service Tests
 * Tests for server/services/channels/telegramService.js
 */

// Mock Grammy before requiring the service
jest.mock('grammy', () => {
  const mockApi = {
    sendMessage: jest.fn(),
    sendPhoto: jest.fn(),
    sendDocument: jest.fn(),
    sendVideo: jest.fn(),
    sendAudio: jest.fn(),
    sendVoice: jest.fn(),
    sendSticker: jest.fn(),
    sendAnimation: jest.fn(),
    sendVideoNote: jest.fn(),
    sendContact: jest.fn(),
    sendPoll: jest.fn(),
    sendDice: jest.fn(),
    forwardMessage: jest.fn(),
    copyMessage: jest.fn(),
    sendMediaGroup: jest.fn(),
    sendLocation: jest.fn(),
    sendChatAction: jest.fn(),
    setWebhook: jest.fn(),
    deleteWebhook: jest.fn(),
    getWebhookInfo: jest.fn(),
    getUpdates: jest.fn(),
    getMe: jest.fn(),
    answerCallbackQuery: jest.fn(),
    editMessageText: jest.fn(),
    deleteMessage: jest.fn()
  };

  return {
    Bot: jest.fn().mockImplementation(() => ({
      api: mockApi,
      stop: jest.fn(),
      start: jest.fn(),
      on: jest.fn(),
      _options: {}
    })),
    InputFile: jest.fn().mockImplementation((data) => ({ data }))
  };
});

jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => ({
    toString: jest.fn(() => 'mock-secret-token-12345')
  }))
}));

// Now require the service
const telegramService = require('../../../services/channels/telegramService');
const { Bot, InputFile } = require('grammy');

describe('Telegram Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear stored bots
    telegramService.bots.clear();
    telegramService.webhookSecrets.clear();
  });

  describe('initBot', () => {
    it('should create new bot instance', () => {
      const bot = telegramService.initBot('test-token');

      expect(Bot).toHaveBeenCalledWith('test-token');
      expect(bot).toBeDefined();
    });

    it('should return existing bot if already initialized', () => {
      const bot1 = telegramService.initBot('test-token');
      const bot2 = telegramService.initBot('test-token');

      expect(bot1).toBe(bot2);
      expect(Bot).toHaveBeenCalledTimes(1);
    });

    it('should store options on bot instance', () => {
      const bot = telegramService.initBot('test-token', { customOption: true });

      expect(bot._options).toEqual({ customOption: true });
    });
  });

  describe('getBot', () => {
    it('should create bot if not exists', () => {
      const bot = telegramService.getBot('new-token');

      expect(bot).toBeDefined();
      expect(Bot).toHaveBeenCalled();
    });

    it('should return existing bot', () => {
      telegramService.initBot('existing-token');
      const bot = telegramService.getBot('existing-token');

      expect(Bot).toHaveBeenCalledTimes(1);
      expect(bot).toBeDefined();
    });
  });

  describe('removeBot', () => {
    it('should remove and stop bot', () => {
      const bot = telegramService.initBot('remove-token');
      telegramService.removeBot('remove-token');

      expect(bot.stop).toHaveBeenCalled();
      expect(telegramService.bots.has('remove-token')).toBe(false);
    });

    it('should do nothing if bot not found', () => {
      // Should not throw
      telegramService.removeBot('non-existent-token');
    });
  });

  describe('sendMessage', () => {
    it('should send text message', async () => {
      const bot = telegramService.initBot('test-token');
      bot.api.sendMessage.mockResolvedValue({ message_id: 123 });

      const result = await telegramService.sendMessage('test-token', 12345, 'Hello');

      expect(bot.api.sendMessage).toHaveBeenCalledWith(12345, 'Hello', expect.objectContaining({
        parse_mode: 'HTML'
      }));
      expect(result.message_id).toBe(123);
    });

    it('should send with custom options', async () => {
      const bot = telegramService.initBot('test-token');
      bot.api.sendMessage.mockResolvedValue({ message_id: 123 });

      await telegramService.sendMessage('test-token', 12345, 'Hello', {
        parseMode: 'Markdown',
        silent: true,
        disablePreview: true,
        replyToMessageId: 100
      });

      expect(bot.api.sendMessage).toHaveBeenCalledWith(12345, 'Hello', expect.objectContaining({
        parse_mode: 'Markdown',
        disable_notification: true,
        disable_web_page_preview: true,
        reply_to_message_id: 100
      }));
    });

    it('should include keyboard if provided', async () => {
      const bot = telegramService.initBot('test-token');
      bot.api.sendMessage.mockResolvedValue({ message_id: 123 });

      await telegramService.sendMessage('test-token', 12345, 'Hello', {
        keyboard: {
          inline: true,
          buttons: [[{ text: 'Click', callback_data: 'action' }]]
        }
      });

      expect(bot.api.sendMessage).toHaveBeenCalledWith(12345, 'Hello', expect.objectContaining({
        reply_markup: expect.objectContaining({
          inline_keyboard: expect.any(Array)
        })
      }));
    });
  });

  describe('sendPhoto', () => {
    it('should send photo', async () => {
      const bot = telegramService.initBot('test-token');
      bot.api.sendPhoto.mockResolvedValue({ message_id: 123 });

      await telegramService.sendPhoto('test-token', 12345, 'https://example.com/photo.jpg', {
        caption: 'Nice photo'
      });

      expect(bot.api.sendPhoto).toHaveBeenCalledWith(12345, 'https://example.com/photo.jpg', expect.objectContaining({
        caption: 'Nice photo'
      }));
    });

    it('should handle buffer input', async () => {
      const bot = telegramService.initBot('test-token');
      bot.api.sendPhoto.mockResolvedValue({ message_id: 123 });

      const buffer = Buffer.from('image data');
      await telegramService.sendPhoto('test-token', 12345, buffer);

      expect(InputFile).toHaveBeenCalledWith(buffer);
    });
  });

  describe('sendDocument', () => {
    it('should send document', async () => {
      const bot = telegramService.initBot('test-token');
      bot.api.sendDocument.mockResolvedValue({ message_id: 123 });

      await telegramService.sendDocument('test-token', 12345, 'https://example.com/doc.pdf', {
        caption: 'Document'
      });

      expect(bot.api.sendDocument).toHaveBeenCalled();
    });
  });

  describe('sendVideo', () => {
    it('should send video', async () => {
      const bot = telegramService.initBot('test-token');
      bot.api.sendVideo.mockResolvedValue({ message_id: 123 });

      await telegramService.sendVideo('test-token', 12345, 'https://example.com/video.mp4');

      expect(bot.api.sendVideo).toHaveBeenCalled();
    });
  });

  describe('sendAudio', () => {
    it('should send audio', async () => {
      const bot = telegramService.initBot('test-token');
      bot.api.sendAudio.mockResolvedValue({ message_id: 123 });

      await telegramService.sendAudio('test-token', 12345, 'https://example.com/audio.mp3');

      expect(bot.api.sendAudio).toHaveBeenCalled();
    });
  });

  describe('sendVoice', () => {
    it('should send voice', async () => {
      const bot = telegramService.initBot('test-token');
      bot.api.sendVoice.mockResolvedValue({ message_id: 123 });

      await telegramService.sendVoice('test-token', 12345, 'https://example.com/voice.ogg');

      expect(bot.api.sendVoice).toHaveBeenCalled();
    });
  });

  describe('sendContact', () => {
    it('should send contact', async () => {
      const bot = telegramService.initBot('test-token');
      bot.api.sendContact.mockResolvedValue({ message_id: 123 });

      await telegramService.sendContact('test-token', 12345, '+1234567890', 'John', {
        lastName: 'Doe'
      });

      expect(bot.api.sendContact).toHaveBeenCalledWith(12345, '+1234567890', 'John', expect.objectContaining({
        last_name: 'Doe'
      }));
    });
  });

  describe('sendPoll', () => {
    it('should send poll', async () => {
      const bot = telegramService.initBot('test-token');
      bot.api.sendPoll.mockResolvedValue({ message_id: 123 });

      await telegramService.sendPoll('test-token', 12345, 'Question?', ['Yes', 'No']);

      expect(bot.api.sendPoll).toHaveBeenCalledWith(12345, 'Question?', ['Yes', 'No'], expect.any(Object));
    });
  });

  describe('sendDice', () => {
    it('should send dice', async () => {
      const bot = telegramService.initBot('test-token');
      bot.api.sendDice.mockResolvedValue({ message_id: 123, dice: { value: 5 } });

      await telegramService.sendDice('test-token', 12345);

      expect(bot.api.sendDice).toHaveBeenCalled();
    });
  });

  describe('sendLocation', () => {
    it('should send location', async () => {
      const bot = telegramService.initBot('test-token');
      bot.api.sendLocation.mockResolvedValue({ message_id: 123 });

      await telegramService.sendLocation('test-token', 12345, 40.7128, -74.0060);

      expect(bot.api.sendLocation).toHaveBeenCalledWith(12345, 40.7128, -74.0060, {});
    });
  });

  describe('sendChatAction', () => {
    it('should send typing action by default', async () => {
      const bot = telegramService.initBot('test-token');
      bot.api.sendChatAction.mockResolvedValue(true);

      await telegramService.sendChatAction('test-token', 12345);

      expect(bot.api.sendChatAction).toHaveBeenCalledWith(12345, 'typing');
    });

    it('should send custom action', async () => {
      const bot = telegramService.initBot('test-token');
      bot.api.sendChatAction.mockResolvedValue(true);

      await telegramService.sendChatAction('test-token', 12345, 'upload_photo');

      expect(bot.api.sendChatAction).toHaveBeenCalledWith(12345, 'upload_photo');
    });
  });

  describe('forwardMessage', () => {
    it('should forward message', async () => {
      const bot = telegramService.initBot('test-token');
      bot.api.forwardMessage.mockResolvedValue({ message_id: 124 });

      await telegramService.forwardMessage('test-token', 12345, 67890, 100);

      expect(bot.api.forwardMessage).toHaveBeenCalledWith(12345, 67890, 100, expect.any(Object));
    });
  });

  describe('copyMessage', () => {
    it('should copy message', async () => {
      const bot = telegramService.initBot('test-token');
      bot.api.copyMessage.mockResolvedValue({ message_id: 125 });

      await telegramService.copyMessage('test-token', 12345, 67890, 100);

      expect(bot.api.copyMessage).toHaveBeenCalled();
    });
  });

  describe('Keyboard Builders', () => {
    describe('buildKeyboard', () => {
      it('should build inline keyboard', () => {
        const result = telegramService.buildKeyboard({
          inline: true,
          buttons: [[{ text: 'Click', callback_data: 'action' }]]
        });

        expect(result.inline_keyboard).toBeDefined();
      });

      it('should build reply keyboard', () => {
        const result = telegramService.buildKeyboard({
          inline: false,
          buttons: [['Button 1', 'Button 2']]
        });

        expect(result.keyboard).toBeDefined();
      });
    });

    describe('buildInlineKeyboard', () => {
      it('should build with callback_data', () => {
        const result = telegramService.buildInlineKeyboard([
          [{ text: 'Click', callback_data: 'action' }]
        ]);

        expect(result.inline_keyboard[0][0]).toEqual({
          text: 'Click',
          callback_data: 'action'
        });
      });

      it('should build with url', () => {
        const result = telegramService.buildInlineKeyboard([
          [{ text: 'Visit', url: 'https://example.com' }]
        ]);

        expect(result.inline_keyboard[0][0]).toEqual({
          text: 'Visit',
          url: 'https://example.com'
        });
      });

      it('should build with web_app', () => {
        const result = telegramService.buildInlineKeyboard([
          [{ text: 'Open App', web_app: 'https://webapp.example.com' }]
        ]);

        expect(result.inline_keyboard[0][0]).toEqual({
          text: 'Open App',
          web_app: { url: 'https://webapp.example.com' }
        });
      });
    });

    describe('buildReplyKeyboard', () => {
      it('should build with string buttons', () => {
        const result = telegramService.buildReplyKeyboard([['A', 'B']]);

        expect(result.keyboard[0]).toEqual([{ text: 'A' }, { text: 'B' }]);
        expect(result.resize_keyboard).toBe(true);
      });

      it('should build with object buttons', () => {
        const result = telegramService.buildReplyKeyboard([
          [{ text: 'Share Contact', requestContact: true }]
        ]);

        expect(result.keyboard[0][0]).toEqual({
          text: 'Share Contact',
          request_contact: true,
          request_location: false
        });
      });
    });

    describe('removeKeyboard', () => {
      it('should return remove keyboard markup', () => {
        const result = telegramService.removeKeyboard();

        expect(result).toEqual({ remove_keyboard: true });
      });
    });
  });

  describe('Webhook Management', () => {
    describe('setWebhook', () => {
      it('should set webhook with secret token', async () => {
        const bot = telegramService.initBot('test-token');
        bot.api.setWebhook.mockResolvedValue(true);

        const result = await telegramService.setWebhook('test-token', 'https://example.com/webhook');

        expect(bot.api.setWebhook).toHaveBeenCalledWith('https://example.com/webhook', expect.objectContaining({
          url: 'https://example.com/webhook',
          secret_token: expect.any(String)
        }));
        expect(result.secretToken).toBeDefined();
        expect(result.webhookUrl).toBe('https://example.com/webhook');
      });

      it('should use custom secret token', async () => {
        const bot = telegramService.initBot('test-token');
        bot.api.setWebhook.mockResolvedValue(true);

        const result = await telegramService.setWebhook('test-token', 'https://example.com/webhook', {
          secretToken: 'custom-secret'
        });

        expect(result.secretToken).toBe('custom-secret');
      });
    });

    describe('deleteWebhook', () => {
      it('should delete webhook', async () => {
        const bot = telegramService.initBot('test-token');
        bot.api.deleteWebhook.mockResolvedValue(true);

        const result = await telegramService.deleteWebhook('test-token');

        expect(bot.api.deleteWebhook).toHaveBeenCalled();
        expect(result).toBe(true);
      });

      it('should clear stored secret', async () => {
        const bot = telegramService.initBot('test-token');
        bot.api.setWebhook.mockResolvedValue(true);
        bot.api.deleteWebhook.mockResolvedValue(true);

        await telegramService.setWebhook('test-token', 'https://example.com/webhook');
        await telegramService.deleteWebhook('test-token');

        expect(telegramService.webhookSecrets.has('test-token')).toBe(false);
      });
    });

    describe('getWebhookInfo', () => {
      it('should get webhook info', async () => {
        const bot = telegramService.initBot('test-token');
        bot.api.getWebhookInfo.mockResolvedValue({
          url: 'https://example.com/webhook',
          pending_update_count: 0
        });

        const result = await telegramService.getWebhookInfo('test-token');

        expect(result.url).toBe('https://example.com/webhook');
      });
    });

    describe('verifyWebhookSignature', () => {
      it('should verify valid signature', async () => {
        const bot = telegramService.initBot('test-token');
        bot.api.setWebhook.mockResolvedValue(true);

        const { secretToken } = await telegramService.setWebhook('test-token', 'https://example.com');

        const result = telegramService.verifyWebhookSignature('test-token', secretToken);

        expect(result).toBe(true);
      });

      it('should reject invalid signature', () => {
        const result = telegramService.verifyWebhookSignature('test-token', 'wrong-secret');

        // Returns undefined (falsy) when no stored secret exists
        expect(result).toBeFalsy();
      });
    });
  });

  describe('Message Handling', () => {
    describe('handleIncomingMessage', () => {
      it('should handle text message', () => {
        const update = {
          update_id: 123,
          message: {
            message_id: 456,
            chat: { id: 12345, type: 'private' },
            from: { id: 67890, username: 'user', first_name: 'John' },
            text: 'Hello',
            date: 1609459200
          }
        };

        const result = telegramService.handleIncomingMessage(update);

        expect(result.type).toBe('text');
        expect(result.chatId).toBe(12345);
        expect(result.text).toBe('Hello');
        expect(result.username).toBe('user');
      });

      it('should handle callback query', () => {
        const update = {
          update_id: 123,
          callback_query: {
            id: 'query-123',
            from: { id: 67890, username: 'user' },
            message: { chat: { id: 12345 }, message_id: 456 },
            data: 'button_clicked'
          }
        };

        const result = telegramService.handleIncomingMessage(update);

        expect(result.type).toBe('callback_query');
        expect(result.text).toBe('button_clicked');
        expect(result.callbackQueryId).toBe('query-123');
      });

      it('should handle inline query', () => {
        const update = {
          update_id: 123,
          inline_query: {
            id: 'inline-123',
            from: { id: 67890, username: 'user' },
            query: 'search term',
            offset: ''
          }
        };

        const result = telegramService.handleIncomingMessage(update);

        expect(result.type).toBe('inline_query');
        expect(result.text).toBe('search term');
        expect(result.inlineQueryId).toBe('inline-123');
      });

      it('should handle photo message', () => {
        const update = {
          update_id: 123,
          message: {
            message_id: 456,
            chat: { id: 12345 },
            from: { id: 67890 },
            photo: [{ file_id: 'photo123' }],
            caption: 'My photo',
            date: 1609459200
          }
        };

        const result = telegramService.handleIncomingMessage(update);

        expect(result.type).toBe('photo');
        expect(result.text).toBe('My photo');
        expect(result.photo).toBeDefined();
      });
    });

    describe('getMessageType', () => {
      it('should detect text message', () => {
        expect(telegramService.getMessageType({ text: 'Hello' })).toBe('text');
      });

      it('should detect photo message', () => {
        expect(telegramService.getMessageType({ photo: [] })).toBe('photo');
      });

      it('should detect document message', () => {
        expect(telegramService.getMessageType({ document: {} })).toBe('document');
      });

      it('should detect video message', () => {
        expect(telegramService.getMessageType({ video: {} })).toBe('video');
      });

      it('should detect audio message', () => {
        expect(telegramService.getMessageType({ audio: {} })).toBe('audio');
      });

      it('should detect voice message', () => {
        expect(telegramService.getMessageType({ voice: {} })).toBe('voice');
      });

      it('should detect location message', () => {
        expect(telegramService.getMessageType({ location: {} })).toBe('location');
      });

      it('should detect contact message', () => {
        expect(telegramService.getMessageType({ contact: {} })).toBe('contact');
      });

      it('should detect sticker message', () => {
        expect(telegramService.getMessageType({ sticker: {} })).toBe('sticker');
      });

      it('should detect animation message', () => {
        expect(telegramService.getMessageType({ animation: {} })).toBe('animation');
      });

      it('should return unknown for empty message', () => {
        expect(telegramService.getMessageType({})).toBe('unknown');
      });
    });

    describe('answerCallbackQuery', () => {
      it('should answer callback query', async () => {
        const bot = telegramService.initBot('test-token');
        bot.api.answerCallbackQuery.mockResolvedValue(true);

        await telegramService.answerCallbackQuery('test-token', 'query-123', {
          text: 'Done!',
          showAlert: true
        });

        expect(bot.api.answerCallbackQuery).toHaveBeenCalledWith('query-123', expect.objectContaining({
          text: 'Done!',
          show_alert: true
        }));
      });
    });
  });

  describe('Text Formatting', () => {
    describe('formatMarkdown', () => {
      it('should format bold', () => {
        expect(telegramService.formatMarkdown('text', 'bold')).toBe('*text*');
      });

      it('should format italic', () => {
        expect(telegramService.formatMarkdown('text', 'italic')).toBe('_text_');
      });

      it('should format code', () => {
        expect(telegramService.formatMarkdown('text', 'code')).toBe('`text`');
      });

      it('should format pre', () => {
        expect(telegramService.formatMarkdown('text', 'pre')).toBe('```\ntext\n```');
      });

      it('should format link', () => {
        expect(telegramService.formatMarkdown({ label: 'Click', url: 'https://example.com' }, 'link'))
          .toBe('[Click](https://example.com)');
      });

      it('should format mention', () => {
        expect(telegramService.formatMarkdown({ name: 'John', userId: 123 }, 'mention'))
          .toBe('[John](tg://user?id=123)');
      });

      it('should return original for unknown style', () => {
        expect(telegramService.formatMarkdown('text', 'unknown')).toBe('text');
      });
    });

    describe('formatHTML', () => {
      it('should format bold', () => {
        expect(telegramService.formatHTML('text', 'bold')).toBe('<b>text</b>');
      });

      it('should format italic', () => {
        expect(telegramService.formatHTML('text', 'italic')).toBe('<i>text</i>');
      });

      it('should format underline', () => {
        expect(telegramService.formatHTML('text', 'underline')).toBe('<u>text</u>');
      });

      it('should format strikethrough', () => {
        expect(telegramService.formatHTML('text', 'strikethrough')).toBe('<s>text</s>');
      });

      it('should format code', () => {
        expect(telegramService.formatHTML('text', 'code')).toBe('<code>text</code>');
      });

      it('should format pre', () => {
        expect(telegramService.formatHTML('text', 'pre')).toBe('<pre>text</pre>');
      });

      it('should format link', () => {
        expect(telegramService.formatHTML({ label: 'Click', url: 'https://example.com' }, 'link'))
          .toBe('<a href="https://example.com">Click</a>');
      });

      it('should format mention', () => {
        expect(telegramService.formatHTML({ name: 'John', userId: 123 }, 'mention'))
          .toBe('<a href="tg://user?id=123">John</a>');
      });
    });

    describe('escapeHTML', () => {
      it('should escape HTML characters', () => {
        expect(telegramService.escapeHTML('<script>"alert"</script>'))
          .toBe('&lt;script&gt;&quot;alert&quot;&lt;/script&gt;');
      });

      it('should escape ampersand', () => {
        expect(telegramService.escapeHTML('a & b')).toBe('a &amp; b');
      });
    });

    describe('escapeMarkdown', () => {
      it('should escape Markdown characters', () => {
        expect(telegramService.escapeMarkdown('*bold* _italic_'))
          .toBe('\\*bold\\* \\_italic\\_');
      });
    });
  });

  describe('Bot Info', () => {
    describe('getBotInfo', () => {
      it('should get bot info', async () => {
        const bot = telegramService.initBot('test-token');
        bot.api.getMe.mockResolvedValue({
          id: 123,
          username: 'testbot',
          first_name: 'Test Bot'
        });

        const result = await telegramService.getBotInfo('test-token');

        expect(result.id).toBe(123);
        expect(result.username).toBe('testbot');
      });
    });

    describe('testConnection', () => {
      it('should return success on valid token', async () => {
        const bot = telegramService.initBot('test-token');
        bot.api.getMe.mockResolvedValue({
          id: 123,
          username: 'testbot',
          first_name: 'Test Bot',
          can_join_groups: true,
          can_read_all_group_messages: false,
          supports_inline_queries: true
        });

        const result = await telegramService.testConnection('test-token');

        expect(result.success).toBe(true);
        expect(result.botId).toBe(123);
        expect(result.botUsername).toBe('testbot');
      });

      it('should return error on invalid token', async () => {
        const bot = telegramService.initBot('bad-token');
        bot.api.getMe.mockRejectedValue(new Error('Unauthorized'));

        const result = await telegramService.testConnection('bad-token');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Unauthorized');
      });
    });
  });

  describe('Message Editing', () => {
    describe('editMessageText', () => {
      it('should edit message text', async () => {
        const bot = telegramService.initBot('test-token');
        bot.api.editMessageText.mockResolvedValue({ message_id: 123 });

        await telegramService.editMessageText('test-token', 12345, 123, 'New text');

        expect(bot.api.editMessageText).toHaveBeenCalledWith(12345, 123, 'New text', expect.any(Object));
      });
    });

    describe('deleteMessage', () => {
      it('should delete message', async () => {
        const bot = telegramService.initBot('test-token');
        bot.api.deleteMessage.mockResolvedValue(true);

        await telegramService.deleteMessage('test-token', 12345, 123);

        expect(bot.api.deleteMessage).toHaveBeenCalledWith(12345, 123);
      });
    });
  });
});
