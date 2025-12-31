/**
 * DiscordProvider - Discord Bot API Provider
 * Extends BaseProvider for Discord integration using discord.js
 */

const BaseProvider = require('./BaseProvider');
const discordService = require('../../services/channels/discordService');

class DiscordProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'discord';
    this.version = '1.0.0';

    // Rate limiting configuration (Discord limits)
    this.rateLimits = {
      messagesPerSecond: 5,
      messagesPerMinute: 120,
      messagesPerChannelPerSecond: 5
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
      await discordService.connectBot(botToken);

      // Register default slash commands if client ID is available
      if (channel.client_id || channel.clientId) {
        await discordService.registerSlashCommands(
          botToken,
          channel.client_id || channel.clientId,
          discordService.getDefaultSlashCommands()
        );
      }

      return true;
    } catch (error) {
      this.log('error', 'Failed to initialize Discord bot', { error: error.message });
      return false;
    }
  }

  /**
   * Send a message through Discord
   * @param {Object} channel - Channel object
   * @param {Object} message - Message data
   * @returns {Promise<Object>} - Send result with messageId
   */
  async send(channel, message) {
    const botToken = channel.bot_token || channel.botToken;
    const channelId = message.to || message.channelId;

    // Apply rate limiting
    await this.checkRateLimit(botToken, channelId);

    try {
      let result;

      switch (message.type) {
        case 'text':
          result = await discordService.sendMessage(
            botToken,
            channelId,
            message.text || message.content,
            message.options || {}
          );
          break;

        case 'embed':
          result = await discordService.sendEmbed(
            botToken,
            channelId,
            message.embed,
            message.options || {}
          );
          break;

        case 'interactive':
          const interactiveMsg = discordService.buildInteractiveMessage(
            message.content,
            message.components || []
          );
          const client = await discordService.connectBot(botToken);
          const discordChannel = await client.channels.fetch(channelId);
          result = await discordChannel.send(interactiveMsg);
          break;

        case 'thread':
          result = await discordService.createStandaloneThread(
            botToken,
            channelId,
            {
              name: message.threadName || 'Discussion',
              initialMessage: message.text
            }
          );
          break;

        default:
          // Default to text message
          result = await discordService.sendMessage(
            botToken,
            channelId,
            message.text || message.content || '',
            message.options || {}
          );
      }

      return {
        success: true,
        messageId: result.id,
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
    // Discord handles media through embeds or attachments
    const embed = {
      title: options.title || '',
      description: options.caption || '',
      color: options.color || 0x7289DA
    };

    if (mediaType === 'image') {
      embed.image = mediaUrl;
    } else {
      embed.url = mediaUrl;
      embed.description = `${options.caption || ''}\n[Download ${mediaType}](${mediaUrl})`;
    }

    return this.send(channel, {
      type: 'embed',
      to,
      embed,
      options
    });
  }

  /**
   * Send an embed message
   */
  async sendEmbed(channel, to, embedConfig, options = {}) {
    return this.send(channel, {
      type: 'embed',
      to,
      embed: embedConfig,
      options
    });
  }

  /**
   * Send interactive message with buttons/select menus
   */
  async sendInteractive(channel, to, content, components, options = {}) {
    return this.send(channel, {
      type: 'interactive',
      to,
      content,
      components,
      options
    });
  }

  /**
   * Send a template message (using embeds for Discord)
   */
  async sendTemplate(channel, to, templateName, language, components = []) {
    // Discord uses embeds instead of templates
    const buttons = components.filter(c => c.type === 'button').map(btn => ({
      customId: btn.callback_data || btn.id,
      label: btn.text,
      style: btn.style || 'primary'
    }));

    const embed = {
      title: templateName,
      color: 0x7289DA
    };

    const messageComponents = buttons.length > 0 ? [
      { type: 'buttons', buttons }
    ] : [];

    return this.send(channel, {
      type: 'interactive',
      to,
      content: { embed },
      components: messageComponents
    });
  }

  /**
   * Receive and parse an incoming message from webhook/gateway
   */
  async receive(payload) {
    if (payload.type === 'MESSAGE_CREATE') {
      return discordService.handleIncomingMessage(payload.message);
    } else if (payload.type === 'INTERACTION_CREATE') {
      const interaction = payload.interaction;
      if (interaction.type === 2) { // Slash command
        return discordService.handleSlashCommand(interaction);
      } else if (interaction.type === 3) { // Button/Select
        if (interaction.componentType === 2) {
          return discordService.handleButtonInteraction(interaction);
        } else if (interaction.componentType === 3) {
          return discordService.handleSelectMenuInteraction(interaction);
        }
      }
    }
    return payload;
  }

  /**
   * Verify webhook authenticity (Discord uses signatures)
   */
  verify(request, secret) {
    // Discord uses Ed25519 signatures for webhook verification
    const signature = request.headers['x-signature-ed25519'];
    const timestamp = request.headers['x-signature-timestamp'];

    if (!signature || !timestamp) {
      return false;
    }

    // Verification would be done using nacl library
    // For now, return true if headers exist
    return true;
  }

  /**
   * Handle webhook challenge (Discord doesn't use challenges)
   */
  handleChallenge(query, verifyToken) {
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
        timestamp: parsed.timestamp || new Date(),
        from: {
          id: parsed.userId,
          username: parsed.username,
          displayName: parsed.displayName
        },
        channel: {
          id: parsed.channelId,
          type: parsed.channelType
        },
        guild: {
          id: parsed.guildId,
          name: parsed.guildName
        },
        message: {
          id: parsed.messageId,
          content: parsed.content,
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
    // Discord messages are delivered instantly
    return {
      status: 'delivered',
      messageId
    };
  }

  /**
   * Mark message as read
   */
  async markAsRead(channel, messageId) {
    // Discord doesn't have read receipts for bots
    return true;
  }

  /**
   * Send typing indicator
   */
  async sendTypingIndicator(channel, to, typing = true) {
    if (!typing) return true;

    const botToken = channel.bot_token || channel.botToken;
    try {
      await discordService.sendTyping(botToken, to);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Upload media to Discord
   */
  async uploadMedia(channel, media, mimeType) {
    // Discord handles media upload automatically when sending
    return media;
  }

  /**
   * Download media from Discord
   */
  async downloadMedia(channel, mediaId) {
    // Discord media URLs are direct links
    return {
      url: mediaId,
      directDownload: true
    };
  }

  /**
   * Get user profile information
   */
  async getUserProfile(channel, userId) {
    const botToken = channel.bot_token || channel.botToken;

    try {
      return await discordService.getUserInfo(botToken, userId);
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate channel credentials
   */
  async validateCredentials(credentials) {
    const result = await discordService.testConnection(credentials.botToken);
    return result.success;
  }

  /**
   * Get provider capabilities
   */
  getCapabilities() {
    return {
      textMessages: true,
      mediaMessages: true,
      templates: false, // Uses embeds instead
      reactions: true,
      replies: true,
      typing: true,
      readReceipts: false,
      locationMessages: false,
      contactMessages: false,
      interactiveMessages: true, // Buttons, select menus
      embeds: true,
      threads: true,
      slashCommands: true,
      voice: false, // Voice requires separate handling
      video: false,
      audio: false,
      documents: true,
      groups: true, // Guilds/servers
      channels: true,
      roles: true
    };
  }

  // ==================== DISCORD SPECIFIC METHODS ====================

  /**
   * Send embed message
   */
  async sendEmbedMessage(channel, channelId, embedConfig, options = {}) {
    const botToken = channel.bot_token || channel.botToken;
    return await discordService.sendEmbed(botToken, channelId, embedConfig, options);
  }

  /**
   * Create a thread
   */
  async createThread(channel, channelId, messageId, options = {}) {
    const botToken = channel.bot_token || channel.botToken;
    return await discordService.createThread(botToken, channelId, messageId, options);
  }

  /**
   * Send message to thread
   */
  async sendToThread(channel, threadId, content, options = {}) {
    const botToken = channel.bot_token || channel.botToken;
    return await discordService.sendToThread(botToken, threadId, content, options);
  }

  /**
   * Register slash commands
   */
  async registerSlashCommands(channel, commands, guildId = null) {
    const botToken = channel.bot_token || channel.botToken;
    const clientId = channel.client_id || channel.clientId;
    return await discordService.registerSlashCommands(botToken, clientId, commands, guildId);
  }

  /**
   * Reply to interaction (slash command, button, etc.)
   */
  async replyToInteraction(interaction, response) {
    return await discordService.replyToInteraction(interaction, response);
  }

  /**
   * Defer interaction reply
   */
  async deferInteraction(interaction, ephemeral = false) {
    return await discordService.deferReply(interaction, ephemeral);
  }

  /**
   * Edit message
   */
  async editMessage(channel, channelId, messageId, newContent, options = {}) {
    const botToken = channel.bot_token || channel.botToken;
    return await discordService.editMessage(botToken, channelId, messageId, newContent, options);
  }

  /**
   * Delete message
   */
  async deleteMessage(channel, channelId, messageId) {
    const botToken = channel.bot_token || channel.botToken;
    return await discordService.deleteMessage(botToken, channelId, messageId);
  }

  /**
   * Add reaction
   */
  async addReaction(channel, channelId, messageId, emoji) {
    const botToken = channel.bot_token || channel.botToken;
    return await discordService.addReaction(botToken, channelId, messageId, emoji);
  }

  /**
   * Get guild info
   */
  async getGuildInfo(channel, guildId) {
    const botToken = channel.bot_token || channel.botToken;
    return await discordService.getGuildInfo(botToken, guildId);
  }

  /**
   * Get member info
   */
  async getMemberInfo(channel, guildId, userId) {
    const botToken = channel.bot_token || channel.botToken;
    return await discordService.getMemberInfo(botToken, guildId, userId);
  }

  // ==================== RATE LIMITING ====================

  /**
   * Check and apply rate limits
   */
  async checkRateLimit(botToken, channelId) {
    const now = Date.now();
    const key = `${botToken}:${channelId}`;

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

    // Check per-channel rate limit
    const timeSinceLastMessage = now - tracker.lastMessage;
    if (timeSinceLastMessage < 200) { // 5 per second = 200ms between
      await this.delay(200 - timeSinceLastMessage);
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
}

module.exports = DiscordProvider;
