/**
 * TelegramProvider - Telegram Bot API Provider
 * Extends BaseProvider for Telegram integration using Grammy framework
 */

const BaseProvider = require('./BaseProvider');
const telegramService = require('../../services/channels/telegramService');
const crypto = require('crypto');

class TelegramProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'telegram';
    this.version = '1.0.0';

    // Rate limiting configuration
    this.rateLimits = {
      messagesPerSecond: 30,
      messagesPerMinute: 60,
      messagesPerChatPerSecond: 1
    };

    // Track rate limits per bot
    this.rateLimitTrackers = new Map();
  }

  /**
   * Initialize the provider with channel credentials
   * @param {Object} channel - Channel object with credentials
   * @returns {Promise<boolean>} - Success status
   */
  async initialize(channel) {
    try {
      const botToken = channel.bot_token || channel.botToken;
      telegramService.initBot(botToken);
      return true;
    } catch (error) {
      this.log('error', 'Failed to initialize Telegram bot', { error: error.message });
      return false;
    }
  }

  /**
   * Send a message through Telegram
   * @param {Object} channel - Channel object
   * @param {Object} message - Message data
   * @returns {Promise<Object>} - Send result with messageId
   */
  async send(channel, message) {
    const botToken = channel.bot_token || channel.botToken;
    const chatId = message.to || message.chatId;

    // Apply rate limiting
    await this.checkRateLimit(botToken, chatId);

    try {
      let result;

      switch (message.type) {
        case 'text':
          result = await telegramService.sendMessage(
            botToken,
            chatId,
            message.text,
            message.options || {}
          );
          break;

        case 'photo':
          result = await telegramService.sendPhoto(
            botToken,
            chatId,
            message.media,
            message.options || {}
          );
          break;

        case 'video':
          result = await telegramService.sendVideo(
            botToken,
            chatId,
            message.media,
            message.options || {}
          );
          break;

        case 'audio':
          result = await telegramService.sendAudio(
            botToken,
            chatId,
            message.media,
            message.options || {}
          );
          break;

        case 'document':
          result = await telegramService.sendDocument(
            botToken,
            chatId,
            message.media,
            message.options || {}
          );
          break;

        case 'sticker':
          result = await telegramService.sendSticker(
            botToken,
            chatId,
            message.sticker,
            message.options || {}
          );
          break;

        case 'location':
          result = await telegramService.sendLocation(
            botToken,
            chatId,
            message.latitude,
            message.longitude,
            message.options || {}
          );
          break;

        case 'voice':
          result = await telegramService.sendVoice(
            botToken,
            chatId,
            message.media,
            message.options || {}
          );
          break;

        default:
          throw new Error(`Unsupported message type: ${message.type}`);
      }

      return {
        success: true,
        messageId: result.message_id,
        timestamp: new Date(),
        raw: result
      };
    } catch (error) {
      this.log('error', 'Failed to send message', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send a text message
   */
  async sendTextMessage(channel, to, text, options = {}) {
    return this.send(channel, {
      type: 'text',
      to,
      text,
      options
    });
  }

  /**
   * Send a media message
   */
  async sendMediaMessage(channel, to, mediaType, mediaUrl, options = {}) {
    return this.send(channel, {
      type: mediaType,
      to,
      media: mediaUrl,
      options
    });
  }

  /**
   * Send a template message (using keyboard buttons for Telegram)
   */
  async sendTemplate(channel, to, templateName, language, components = []) {
    // Telegram doesn't have templates like WhatsApp, but we can use keyboards
    const keyboard = components.map(comp => {
      if (comp.type === 'button') {
        return {
          text: comp.text,
          callback_data: comp.callback_data || comp.text
        };
      }
      return comp;
    });

    return this.send(channel, {
      type: 'text',
      to,
      text: templateName,
      options: {
        keyboard: keyboard.length > 0 ? { inline: true, buttons: [keyboard] } : null
      }
    });
  }

  /**
   * Receive and parse an incoming message from webhook
   */
  async receive(payload) {
    return telegramService.handleIncomingMessage(payload);
  }

  /**
   * Verify webhook authenticity
   */
  verify(request, secret) {
    const headerToken = request.headers['x-telegram-bot-api-secret-token'];
    return headerToken === secret;
  }

  /**
   * Handle webhook challenge (Telegram doesn't use challenges)
   */
  handleChallenge(query, verifyToken) {
    // Telegram doesn't require webhook challenges
    return null;
  }

  /**
   * Process webhook payload and extract events
   */
  async processWebhook(manager, payload, headers) {
    const events = [];

    try {
      const parsed = await this.receive(payload);

      events.push({
        type: parsed.type,
        timestamp: parsed.date || new Date(),
        from: {
          id: parsed.userId,
          username: parsed.username,
          firstName: parsed.firstName,
          lastName: parsed.lastName
        },
        chat: {
          id: parsed.chatId,
          type: parsed.chatType
        },
        message: {
          id: parsed.messageId,
          text: parsed.text,
          type: parsed.type
        },
        raw: parsed.raw
      });
    } catch (error) {
      this.log('error', 'Error processing webhook', { error: error.message });
    }

    return events;
  }

  /**
   * Get message delivery status
   */
  async getMessageStatus(channel, messageId) {
    // Telegram doesn't provide delivery status API
    // Messages are considered delivered once sent successfully
    return {
      status: 'delivered',
      messageId
    };
  }

  /**
   * Mark message as read
   */
  async markAsRead(channel, messageId) {
    // Telegram doesn't have read receipts API for bots
    return true;
  }

  /**
   * Send typing indicator
   */
  async sendTypingIndicator(channel, to, typing = true) {
    if (!typing) return true;

    const botToken = channel.bot_token || channel.botToken;
    try {
      await telegramService.sendChatAction(botToken, to, 'typing');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Upload media to Telegram
   */
  async uploadMedia(channel, media, mimeType) {
    // Telegram handles media upload automatically when sending
    // Return the media as-is
    return media;
  }

  /**
   * Download media from Telegram
   */
  async downloadMedia(channel, mediaId) {
    const botToken = channel.bot_token || channel.botToken;
    const bot = telegramService.getBot(botToken);

    try {
      const file = await bot.api.getFile(mediaId);
      const fileUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;

      return {
        url: fileUrl,
        filePath: file.file_path,
        fileSize: file.file_size
      };
    } catch (error) {
      throw new Error(`Failed to download media: ${error.message}`);
    }
  }

  /**
   * Get user profile information
   */
  async getUserProfile(channel, userId) {
    const botToken = channel.bot_token || channel.botToken;
    const bot = telegramService.getBot(botToken);

    try {
      const chat = await bot.api.getChat(userId);
      const photos = await bot.api.getUserProfilePhotos(userId, { limit: 1 });

      return {
        id: chat.id,
        firstName: chat.first_name,
        lastName: chat.last_name,
        username: chat.username,
        bio: chat.bio,
        photo: photos.total_count > 0 ? photos.photos[0][0].file_id : null
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate channel credentials
   */
  async validateCredentials(credentials) {
    const result = await telegramService.testConnection(credentials.botToken);
    return result.success;
  }

  /**
   * Get provider capabilities
   */
  getCapabilities() {
    return {
      textMessages: true,
      mediaMessages: true,
      templates: false, // No HSM templates, but has inline keyboards
      reactions: false,
      replies: true,
      typing: true,
      readReceipts: false,
      locationMessages: true,
      contactMessages: true,
      interactiveMessages: true, // Inline keyboards
      stickers: true,
      voice: true,
      video: true,
      audio: true,
      documents: true,
      groups: true,
      channels: true,
      inlineMode: true
    };
  }

  // ==================== RATE LIMITING ====================

  /**
   * Check and apply rate limits
   * @param {string} botToken - Bot token
   * @param {string} chatId - Chat ID
   */
  async checkRateLimit(botToken, chatId) {
    const now = Date.now();
    const key = `${botToken}:${chatId}`;

    if (!this.rateLimitTrackers.has(key)) {
      this.rateLimitTrackers.set(key, {
        lastMessage: 0,
        messagesThisSecond: 0,
        messagesThisMinute: 0,
        minuteStart: now
      });
    }

    const tracker = this.rateLimitTrackers.get(key);

    // Reset minute counter if needed
    if (now - tracker.minuteStart > 60000) {
      tracker.messagesThisMinute = 0;
      tracker.minuteStart = now;
    }

    // Check per-chat rate limit (1 message per second per chat)
    const timeSinceLastMessage = now - tracker.lastMessage;
    if (timeSinceLastMessage < 1000) {
      await this.delay(1000 - timeSinceLastMessage);
    }

    // Check minute rate limit
    if (tracker.messagesThisMinute >= this.rateLimits.messagesPerMinute) {
      const waitTime = 60000 - (now - tracker.minuteStart);
      await this.delay(waitTime);
      tracker.messagesThisMinute = 0;
      tracker.minuteStart = Date.now();
    }

    // Update tracker
    tracker.lastMessage = Date.now();
    tracker.messagesThisMinute++;
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==================== GROUP/CHANNEL METHODS ====================

  /**
   * Get chat information
   * @param {Object} channel - Channel object
   * @param {string} chatId - Chat ID
   */
  async getChatInfo(channel, chatId) {
    const botToken = channel.bot_token || channel.botToken;
    const bot = telegramService.getBot(botToken);

    try {
      const chat = await bot.api.getChat(chatId);
      return {
        id: chat.id,
        type: chat.type,
        title: chat.title,
        username: chat.username,
        firstName: chat.first_name,
        lastName: chat.last_name,
        description: chat.description,
        inviteLink: chat.invite_link,
        pinnedMessage: chat.pinned_message,
        permissions: chat.permissions,
        memberCount: chat.member_count
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Get chat member count
   */
  async getChatMemberCount(channel, chatId) {
    const botToken = channel.bot_token || channel.botToken;
    const bot = telegramService.getBot(botToken);

    try {
      return await bot.api.getChatMemberCount(chatId);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get chat administrators
   */
  async getChatAdministrators(channel, chatId) {
    const botToken = channel.bot_token || channel.botToken;
    const bot = telegramService.getBot(botToken);

    try {
      return await bot.api.getChatAdministrators(chatId);
    } catch (error) {
      return [];
    }
  }

  /**
   * Leave a chat
   */
  async leaveChat(channel, chatId) {
    const botToken = channel.bot_token || channel.botToken;
    const bot = telegramService.getBot(botToken);

    try {
      await bot.api.leaveChat(chatId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Pin a message in chat
   */
  async pinMessage(channel, chatId, messageId, disableNotification = false) {
    const botToken = channel.bot_token || channel.botToken;
    const bot = telegramService.getBot(botToken);

    try {
      await bot.api.pinChatMessage(chatId, messageId, {
        disable_notification: disableNotification
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Unpin a message
   */
  async unpinMessage(channel, chatId, messageId) {
    const botToken = channel.bot_token || channel.botToken;
    const bot = telegramService.getBot(botToken);

    try {
      await bot.api.unpinChatMessage(chatId, messageId);
      return true;
    } catch (error) {
      return false;
    }
  }

  // ==================== WEBHOOK MANAGEMENT ====================

  /**
   * Set up webhook for the bot
   */
  async setupWebhook(channel, webhookUrl, options = {}) {
    const botToken = channel.bot_token || channel.botToken;
    return await telegramService.setWebhook(botToken, webhookUrl, options);
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(channel, dropPendingUpdates = false) {
    const botToken = channel.bot_token || channel.botToken;
    return await telegramService.deleteWebhook(botToken, dropPendingUpdates);
  }

  /**
   * Get webhook info
   */
  async getWebhookInfo(channel) {
    const botToken = channel.bot_token || channel.botToken;
    return await telegramService.getWebhookInfo(botToken);
  }

  // ==================== INLINE QUERY HANDLING ====================

  /**
   * Answer inline query
   */
  async answerInlineQuery(channel, queryId, results, options = {}) {
    const botToken = channel.bot_token || channel.botToken;
    const bot = telegramService.getBot(botToken);

    try {
      await bot.api.answerInlineQuery(queryId, results, {
        cache_time: options.cacheTime || 300,
        is_personal: options.isPersonal || false,
        next_offset: options.nextOffset || '',
        switch_pm_text: options.switchPmText,
        switch_pm_parameter: options.switchPmParameter
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  // ==================== CALLBACK QUERY ====================

  /**
   * Answer callback query
   */
  async answerCallbackQuery(channel, queryId, options = {}) {
    const botToken = channel.bot_token || channel.botToken;
    return await telegramService.answerCallbackQuery(botToken, queryId, options);
  }

  // ==================== MESSAGE EDITING ====================

  /**
   * Edit message text
   */
  async editMessageText(channel, chatId, messageId, text, options = {}) {
    const botToken = channel.bot_token || channel.botToken;
    return await telegramService.editMessageText(botToken, chatId, messageId, text, options);
  }

  /**
   * Delete message
   */
  async deleteMessage(channel, chatId, messageId) {
    const botToken = channel.bot_token || channel.botToken;
    return await telegramService.deleteMessage(botToken, chatId, messageId);
  }

  // ==================== COMMANDS ====================

  /**
   * Set bot commands
   */
  async setCommands(channel, commands) {
    const botToken = channel.bot_token || channel.botToken;
    const bot = telegramService.getBot(botToken);

    try {
      await bot.api.setMyCommands(commands);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get bot commands
   */
  async getCommands(channel) {
    const botToken = channel.bot_token || channel.botToken;
    const bot = telegramService.getBot(botToken);

    try {
      return await bot.api.getMyCommands();
    } catch (error) {
      return [];
    }
  }
}

module.exports = TelegramProvider;
