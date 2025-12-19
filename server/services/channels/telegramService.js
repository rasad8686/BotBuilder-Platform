/**
 * Telegram Bot API Integration Service
 * Full-featured Telegram channel integration for BotBuilder
 */

const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');

class TelegramService {
  constructor() {
    this.bots = new Map(); // Store active bot instances
    this.webhookSecrets = new Map();
  }

  /**
   * Initialize a Telegram bot instance
   * @param {string} botToken - Telegram bot token
   * @param {Object} options - Configuration options
   * @returns {TelegramBot} Bot instance
   */
  initBot(botToken, options = {}) {
    if (this.bots.has(botToken)) {
      return this.bots.get(botToken);
    }

    const bot = new TelegramBot(botToken, {
      polling: options.polling || false,
      ...options
    });

    this.bots.set(botToken, bot);
    return bot;
  }

  /**
   * Get or create bot instance
   * @param {string} botToken - Telegram bot token
   * @returns {TelegramBot} Bot instance
   */
  getBot(botToken) {
    if (!this.bots.has(botToken)) {
      return this.initBot(botToken);
    }
    return this.bots.get(botToken);
  }

  /**
   * Remove bot instance
   * @param {string} botToken - Telegram bot token
   */
  removeBot(botToken) {
    const bot = this.bots.get(botToken);
    if (bot) {
      bot.stopPolling();
      this.bots.delete(botToken);
    }
  }

  // ==================== MESSAGE SENDING ====================

  /**
   * Send text message
   * @param {string} botToken - Bot token
   * @param {string|number} chatId - Chat ID
   * @param {string} text - Message text
   * @param {Object} options - Additional options (parse_mode, reply_markup, etc.)
   */
  async sendMessage(botToken, chatId, text, options = {}) {
    const bot = this.getBot(botToken);

    const messageOptions = {
      parse_mode: options.parseMode || 'HTML',
      disable_web_page_preview: options.disablePreview || false,
      disable_notification: options.silent || false,
      ...options
    };

    if (options.replyToMessageId) {
      messageOptions.reply_to_message_id = options.replyToMessageId;
    }

    if (options.keyboard) {
      messageOptions.reply_markup = this.buildKeyboard(options.keyboard);
    }

    return await bot.sendMessage(chatId, text, messageOptions);
  }

  /**
   * Send photo
   * @param {string} botToken - Bot token
   * @param {string|number} chatId - Chat ID
   * @param {string|Buffer|Stream} photo - Photo to send (file_id, URL, or stream)
   * @param {Object} options - Additional options
   */
  async sendPhoto(botToken, chatId, photo, options = {}) {
    const bot = this.getBot(botToken);

    const photoOptions = {
      caption: options.caption || '',
      parse_mode: options.parseMode || 'HTML',
      ...options
    };

    if (options.keyboard) {
      photoOptions.reply_markup = this.buildKeyboard(options.keyboard);
    }

    return await bot.sendPhoto(chatId, photo, photoOptions);
  }

  /**
   * Send document
   * @param {string} botToken - Bot token
   * @param {string|number} chatId - Chat ID
   * @param {string|Buffer|Stream} document - Document to send
   * @param {Object} options - Additional options
   */
  async sendDocument(botToken, chatId, document, options = {}) {
    const bot = this.getBot(botToken);

    const docOptions = {
      caption: options.caption || '',
      parse_mode: options.parseMode || 'HTML',
      ...options
    };

    if (options.keyboard) {
      docOptions.reply_markup = this.buildKeyboard(options.keyboard);
    }

    return await bot.sendDocument(chatId, document, docOptions);
  }

  /**
   * Send video
   * @param {string} botToken - Bot token
   * @param {string|number} chatId - Chat ID
   * @param {string|Buffer|Stream} video - Video to send
   * @param {Object} options - Additional options
   */
  async sendVideo(botToken, chatId, video, options = {}) {
    const bot = this.getBot(botToken);

    const videoOptions = {
      caption: options.caption || '',
      parse_mode: options.parseMode || 'HTML',
      supports_streaming: true,
      ...options
    };

    if (options.keyboard) {
      videoOptions.reply_markup = this.buildKeyboard(options.keyboard);
    }

    return await bot.sendVideo(chatId, video, videoOptions);
  }

  /**
   * Send audio
   * @param {string} botToken - Bot token
   * @param {string|number} chatId - Chat ID
   * @param {string|Buffer|Stream} audio - Audio to send
   * @param {Object} options - Additional options
   */
  async sendAudio(botToken, chatId, audio, options = {}) {
    const bot = this.getBot(botToken);

    return await bot.sendAudio(chatId, audio, {
      caption: options.caption || '',
      parse_mode: options.parseMode || 'HTML',
      ...options
    });
  }

  /**
   * Send voice message
   * @param {string} botToken - Bot token
   * @param {string|number} chatId - Chat ID
   * @param {string|Buffer|Stream} voice - Voice to send
   * @param {Object} options - Additional options
   */
  async sendVoice(botToken, chatId, voice, options = {}) {
    const bot = this.getBot(botToken);
    return await bot.sendVoice(chatId, voice, options);
  }

  /**
   * Send location
   * @param {string} botToken - Bot token
   * @param {string|number} chatId - Chat ID
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @param {Object} options - Additional options
   */
  async sendLocation(botToken, chatId, latitude, longitude, options = {}) {
    const bot = this.getBot(botToken);
    return await bot.sendLocation(chatId, latitude, longitude, options);
  }

  /**
   * Send chat action (typing, uploading, etc.)
   * @param {string} botToken - Bot token
   * @param {string|number} chatId - Chat ID
   * @param {string} action - Action type
   */
  async sendChatAction(botToken, chatId, action = 'typing') {
    const bot = this.getBot(botToken);
    return await bot.sendChatAction(chatId, action);
  }

  // ==================== KEYBOARD BUILDERS ====================

  /**
   * Build keyboard markup
   * @param {Object} keyboardConfig - Keyboard configuration
   * @returns {Object} Reply markup object
   */
  buildKeyboard(keyboardConfig) {
    if (keyboardConfig.inline) {
      return this.buildInlineKeyboard(keyboardConfig.buttons);
    } else {
      return this.buildReplyKeyboard(keyboardConfig.buttons, keyboardConfig.options);
    }
  }

  /**
   * Build inline keyboard
   * @param {Array} buttons - Array of button rows
   * @returns {Object} Inline keyboard markup
   */
  buildInlineKeyboard(buttons) {
    const inlineKeyboard = buttons.map(row => {
      if (!Array.isArray(row)) row = [row];
      return row.map(btn => {
        const button = { text: btn.text };

        if (btn.callback_data) {
          button.callback_data = btn.callback_data;
        } else if (btn.url) {
          button.url = btn.url;
        } else if (btn.switch_inline_query) {
          button.switch_inline_query = btn.switch_inline_query;
        } else if (btn.web_app) {
          button.web_app = { url: btn.web_app };
        }

        return button;
      });
    });

    return { inline_keyboard: inlineKeyboard };
  }

  /**
   * Build reply keyboard
   * @param {Array} buttons - Array of button rows
   * @param {Object} options - Keyboard options
   * @returns {Object} Reply keyboard markup
   */
  buildReplyKeyboard(buttons, options = {}) {
    const keyboard = buttons.map(row => {
      if (!Array.isArray(row)) row = [row];
      return row.map(btn => {
        if (typeof btn === 'string') {
          return { text: btn };
        }
        return {
          text: btn.text,
          request_contact: btn.requestContact || false,
          request_location: btn.requestLocation || false
        };
      });
    });

    return {
      keyboard,
      resize_keyboard: options.resize !== false,
      one_time_keyboard: options.oneTime || false,
      selective: options.selective || false
    };
  }

  /**
   * Remove keyboard
   * @returns {Object} Remove keyboard markup
   */
  removeKeyboard() {
    return { remove_keyboard: true };
  }

  // ==================== WEBHOOK MANAGEMENT ====================

  /**
   * Set webhook for bot
   * @param {string} botToken - Bot token
   * @param {string} webhookUrl - Webhook URL
   * @param {Object} options - Webhook options
   */
  async setWebhook(botToken, webhookUrl, options = {}) {
    const bot = this.getBot(botToken);

    // Generate secret token for verification
    const secretToken = options.secretToken || crypto.randomBytes(32).toString('hex');
    this.webhookSecrets.set(botToken, secretToken);

    const webhookOptions = {
      url: webhookUrl,
      secret_token: secretToken,
      max_connections: options.maxConnections || 100,
      allowed_updates: options.allowedUpdates || ['message', 'callback_query', 'inline_query']
    };

    if (options.certificate) {
      webhookOptions.certificate = options.certificate;
    }

    await bot.setWebHook(webhookUrl, webhookOptions);

    return { secretToken, webhookUrl };
  }

  /**
   * Delete webhook
   * @param {string} botToken - Bot token
   * @param {boolean} dropPendingUpdates - Drop pending updates
   */
  async deleteWebhook(botToken, dropPendingUpdates = false) {
    const bot = this.getBot(botToken);
    await bot.deleteWebHook({ drop_pending_updates: dropPendingUpdates });
    this.webhookSecrets.delete(botToken);
    return true;
  }

  /**
   * Get webhook info
   * @param {string} botToken - Bot token
   */
  async getWebhookInfo(botToken) {
    const bot = this.getBot(botToken);
    return await bot.getWebHookInfo();
  }

  /**
   * Verify webhook signature
   * @param {string} botToken - Bot token
   * @param {string} secretToken - Secret token from header
   */
  verifyWebhookSignature(botToken, secretToken) {
    const storedSecret = this.webhookSecrets.get(botToken);
    return storedSecret && storedSecret === secretToken;
  }

  // ==================== POLLING (ALTERNATIVE) ====================

  /**
   * Get updates using polling
   * @param {string} botToken - Bot token
   * @param {Object} options - Polling options
   */
  async getUpdates(botToken, options = {}) {
    const bot = this.getBot(botToken);

    return await bot.getUpdates({
      offset: options.offset,
      limit: options.limit || 100,
      timeout: options.timeout || 30,
      allowed_updates: options.allowedUpdates
    });
  }

  /**
   * Start polling
   * @param {string} botToken - Bot token
   * @param {Function} messageHandler - Message handler callback
   */
  startPolling(botToken, messageHandler) {
    const bot = this.initBot(botToken, { polling: true });

    bot.on('message', (msg) => {
      messageHandler(msg, 'message');
    });

    bot.on('callback_query', (query) => {
      messageHandler(query, 'callback_query');
    });

    return bot;
  }

  /**
   * Stop polling
   * @param {string} botToken - Bot token
   */
  stopPolling(botToken) {
    const bot = this.bots.get(botToken);
    if (bot) {
      bot.stopPolling();
    }
  }

  // ==================== MESSAGE HANDLING ====================

  /**
   * Handle incoming message/update
   * @param {Object} update - Telegram update object
   * @returns {Object} Parsed message data
   */
  handleIncomingMessage(update) {
    let messageData = {
      updateId: update.update_id,
      type: 'unknown',
      chatId: null,
      userId: null,
      username: null,
      firstName: null,
      lastName: null,
      text: null,
      messageId: null,
      date: null,
      raw: update
    };

    // Handle regular message
    if (update.message) {
      const msg = update.message;
      messageData = {
        ...messageData,
        type: this.getMessageType(msg),
        chatId: msg.chat.id,
        chatType: msg.chat.type,
        userId: msg.from?.id,
        username: msg.from?.username,
        firstName: msg.from?.first_name,
        lastName: msg.from?.last_name,
        text: msg.text || msg.caption || '',
        messageId: msg.message_id,
        date: new Date(msg.date * 1000),
        photo: msg.photo,
        document: msg.document,
        video: msg.video,
        audio: msg.audio,
        voice: msg.voice,
        location: msg.location,
        contact: msg.contact,
        replyToMessage: msg.reply_to_message
      };
    }

    // Handle callback query (inline button press)
    if (update.callback_query) {
      const query = update.callback_query;
      messageData = {
        ...messageData,
        type: 'callback_query',
        chatId: query.message?.chat.id,
        userId: query.from.id,
        username: query.from.username,
        firstName: query.from.first_name,
        lastName: query.from.last_name,
        text: query.data,
        messageId: query.message?.message_id,
        callbackQueryId: query.id,
        inlineMessageId: query.inline_message_id
      };
    }

    // Handle inline query
    if (update.inline_query) {
      const query = update.inline_query;
      messageData = {
        ...messageData,
        type: 'inline_query',
        userId: query.from.id,
        username: query.from.username,
        firstName: query.from.first_name,
        lastName: query.from.last_name,
        text: query.query,
        inlineQueryId: query.id,
        offset: query.offset
      };
    }

    return messageData;
  }

  /**
   * Get message content type
   * @param {Object} message - Telegram message
   * @returns {string} Message type
   */
  getMessageType(message) {
    if (message.text) return 'text';
    if (message.photo) return 'photo';
    if (message.document) return 'document';
    if (message.video) return 'video';
    if (message.audio) return 'audio';
    if (message.voice) return 'voice';
    if (message.location) return 'location';
    if (message.contact) return 'contact';
    if (message.sticker) return 'sticker';
    if (message.animation) return 'animation';
    return 'unknown';
  }

  /**
   * Answer callback query
   * @param {string} botToken - Bot token
   * @param {string} callbackQueryId - Callback query ID
   * @param {Object} options - Answer options
   */
  async answerCallbackQuery(botToken, callbackQueryId, options = {}) {
    const bot = this.getBot(botToken);
    return await bot.answerCallbackQuery(callbackQueryId, {
      text: options.text,
      show_alert: options.showAlert || false,
      url: options.url,
      cache_time: options.cacheTime || 0
    });
  }

  // ==================== MESSAGE FORMATTING ====================

  /**
   * Format text as Markdown
   * @param {string} text - Text to format
   * @param {string} style - Style (bold, italic, code, etc.)
   * @returns {string} Formatted text
   */
  formatMarkdown(text, style) {
    switch (style) {
      case 'bold':
        return `*${text}*`;
      case 'italic':
        return `_${text}_`;
      case 'code':
        return `\`${text}\``;
      case 'pre':
        return `\`\`\`\n${text}\n\`\`\``;
      case 'link':
        return `[${text.label}](${text.url})`;
      case 'mention':
        return `[${text.name}](tg://user?id=${text.userId})`;
      default:
        return text;
    }
  }

  /**
   * Format text as HTML
   * @param {string} text - Text to format
   * @param {string} style - Style (bold, italic, code, etc.)
   * @returns {string} Formatted text
   */
  formatHTML(text, style) {
    switch (style) {
      case 'bold':
        return `<b>${text}</b>`;
      case 'italic':
        return `<i>${text}</i>`;
      case 'underline':
        return `<u>${text}</u>`;
      case 'strikethrough':
        return `<s>${text}</s>`;
      case 'code':
        return `<code>${text}</code>`;
      case 'pre':
        return `<pre>${text}</pre>`;
      case 'link':
        return `<a href="${text.url}">${text.label}</a>`;
      case 'mention':
        return `<a href="tg://user?id=${text.userId}">${text.name}</a>`;
      default:
        return text;
    }
  }

  /**
   * Escape HTML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHTML(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Escape Markdown special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeMarkdown(text) {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  }

  // ==================== BOT INFO ====================

  /**
   * Get bot info
   * @param {string} botToken - Bot token
   */
  async getBotInfo(botToken) {
    const bot = this.getBot(botToken);
    return await bot.getMe();
  }

  /**
   * Test bot connection
   * @param {string} botToken - Bot token
   * @returns {Object} Bot info if successful
   */
  async testConnection(botToken) {
    try {
      const botInfo = await this.getBotInfo(botToken);
      return {
        success: true,
        botId: botInfo.id,
        botUsername: botInfo.username,
        firstName: botInfo.first_name,
        canJoinGroups: botInfo.can_join_groups,
        canReadAllGroupMessages: botInfo.can_read_all_group_messages,
        supportsInlineQueries: botInfo.supports_inline_queries
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Edit message text
   * @param {string} botToken - Bot token
   * @param {string|number} chatId - Chat ID
   * @param {number} messageId - Message ID
   * @param {string} text - New text
   * @param {Object} options - Edit options
   */
  async editMessageText(botToken, chatId, messageId, text, options = {}) {
    const bot = this.getBot(botToken);
    return await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: options.parseMode || 'HTML',
      disable_web_page_preview: options.disablePreview || false,
      reply_markup: options.keyboard ? this.buildKeyboard(options.keyboard) : undefined
    });
  }

  /**
   * Delete message
   * @param {string} botToken - Bot token
   * @param {string|number} chatId - Chat ID
   * @param {number} messageId - Message ID
   */
  async deleteMessage(botToken, chatId, messageId) {
    const bot = this.getBot(botToken);
    return await bot.deleteMessage(chatId, messageId);
  }
}

// Export singleton instance
module.exports = new TelegramService();
