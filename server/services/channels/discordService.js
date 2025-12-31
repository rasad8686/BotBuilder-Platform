/**
 * Discord Bot API Integration Service
 * Full-featured Discord channel integration for BotBuilder
 * Using discord.js v14 - comprehensive Discord bot framework
 */

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');
const crypto = require('crypto');

class DiscordService {
  constructor() {
    this.bots = new Map(); // Store active bot instances
    this.commandHandlers = new Map(); // Store command handlers per bot
    this.webhookSecrets = new Map();
  }

  /**
   * Initialize a Discord bot instance
   * @param {string} botToken - Discord bot token
   * @param {Object} options - Configuration options
   * @returns {Client} Bot instance
   */
  initBot(botToken, options = {}) {
    if (this.bots.has(botToken)) {
      return this.bots.get(botToken);
    }

    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
      ],
      partials: [
        Partials.Channel,
        Partials.Message,
        Partials.Reaction
      ]
    });

    // Store options for later use
    client._options = options;
    client._token = botToken;

    this.bots.set(botToken, client);
    return client;
  }

  /**
   * Get or create bot instance
   * @param {string} botToken - Discord bot token
   * @returns {Client} Bot instance
   */
  getBot(botToken) {
    if (!this.bots.has(botToken)) {
      return this.initBot(botToken);
    }
    return this.bots.get(botToken);
  }

  /**
   * Connect bot to Discord
   * @param {string} botToken - Discord bot token
   * @returns {Promise<Client>} Connected client
   */
  async connectBot(botToken) {
    const client = this.getBot(botToken);

    if (!client.isReady()) {
      await client.login(botToken);
    }

    return client;
  }

  /**
   * Remove bot instance
   * @param {string} botToken - Discord bot token
   */
  removeBot(botToken) {
    const client = this.bots.get(botToken);
    if (client) {
      client.destroy();
      this.bots.delete(botToken);
    }
  }

  // ==================== SLASH COMMANDS ====================

  /**
   * Register slash commands for a bot
   * @param {string} botToken - Bot token
   * @param {string} clientId - Bot client ID
   * @param {Array} commands - Array of slash command definitions
   * @param {string} guildId - Optional guild ID for guild-specific commands
   */
  async registerSlashCommands(botToken, clientId, commands, guildId = null) {
    const rest = new REST({ version: '10' }).setToken(botToken);

    // Build command structures
    const builtCommands = commands.map(cmd => {
      const builder = new SlashCommandBuilder()
        .setName(cmd.name)
        .setDescription(cmd.description);

      // Add options if defined
      if (cmd.options) {
        cmd.options.forEach(opt => {
          switch (opt.type) {
            case 'string':
              builder.addStringOption(option =>
                option.setName(opt.name)
                  .setDescription(opt.description)
                  .setRequired(opt.required || false)
              );
              break;
            case 'integer':
              builder.addIntegerOption(option =>
                option.setName(opt.name)
                  .setDescription(opt.description)
                  .setRequired(opt.required || false)
              );
              break;
            case 'boolean':
              builder.addBooleanOption(option =>
                option.setName(opt.name)
                  .setDescription(opt.description)
                  .setRequired(opt.required || false)
              );
              break;
            case 'user':
              builder.addUserOption(option =>
                option.setName(opt.name)
                  .setDescription(opt.description)
                  .setRequired(opt.required || false)
              );
              break;
            case 'channel':
              builder.addChannelOption(option =>
                option.setName(opt.name)
                  .setDescription(opt.description)
                  .setRequired(opt.required || false)
              );
              break;
          }
        });
      }

      return builder.toJSON();
    });

    try {
      if (guildId) {
        // Guild-specific commands (instant deployment)
        await rest.put(
          Routes.applicationGuildCommands(clientId, guildId),
          { body: builtCommands }
        );
      } else {
        // Global commands (up to 1 hour to propagate)
        await rest.put(
          Routes.applicationCommands(clientId),
          { body: builtCommands }
        );
      }
      return { success: true, commandCount: builtCommands.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get default slash commands for BotBuilder bots
   * @returns {Array} Default command definitions
   */
  getDefaultSlashCommands() {
    return [
      {
        name: 'help',
        description: 'Show help information and available commands'
      },
      {
        name: 'ask',
        description: 'Ask the AI assistant a question',
        options: [
          {
            name: 'question',
            type: 'string',
            description: 'Your question for the AI',
            required: true
          }
        ]
      },
      {
        name: 'status',
        description: 'Check bot status and connection info'
      },
      {
        name: 'clear',
        description: 'Clear your conversation history with the bot'
      },
      {
        name: 'info',
        description: 'Get information about this bot'
      }
    ];
  }

  // ==================== MESSAGE SENDING ====================

  /**
   * Send text message
   * @param {string} botToken - Bot token
   * @param {string} channelId - Channel ID
   * @param {string} content - Message content
   * @param {Object} options - Additional options
   */
  async sendMessage(botToken, channelId, content, options = {}) {
    const client = await this.connectBot(botToken);
    const channel = await client.channels.fetch(channelId);

    if (!channel) {
      throw new Error('Channel not found');
    }

    const messageOptions = { content };

    if (options.embeds) {
      messageOptions.embeds = options.embeds;
    }

    if (options.components) {
      messageOptions.components = options.components;
    }

    if (options.replyTo) {
      messageOptions.reply = { messageReference: options.replyTo };
    }

    return await channel.send(messageOptions);
  }

  /**
   * Send embed message
   * @param {string} botToken - Bot token
   * @param {string} channelId - Channel ID
   * @param {Object} embedData - Embed configuration
   * @param {Object} options - Additional options
   */
  async sendEmbed(botToken, channelId, embedData, options = {}) {
    const embed = this.buildEmbed(embedData);

    const messageOptions = {
      embeds: [embed]
    };

    if (options.content) {
      messageOptions.content = options.content;
    }

    if (options.components) {
      messageOptions.components = options.components;
    }

    const client = await this.connectBot(botToken);
    const channel = await client.channels.fetch(channelId);

    return await channel.send(messageOptions);
  }

  /**
   * Build an embed from configuration
   * @param {Object} config - Embed configuration
   * @returns {EmbedBuilder} Built embed
   */
  buildEmbed(config) {
    const embed = new EmbedBuilder();

    if (config.title) embed.setTitle(config.title);
    if (config.description) embed.setDescription(config.description);
    if (config.color) embed.setColor(config.color);
    if (config.url) embed.setURL(config.url);
    if (config.timestamp) embed.setTimestamp(config.timestamp === true ? new Date() : new Date(config.timestamp));

    if (config.author) {
      embed.setAuthor({
        name: config.author.name,
        iconURL: config.author.iconURL,
        url: config.author.url
      });
    }

    if (config.thumbnail) {
      embed.setThumbnail(config.thumbnail);
    }

    if (config.image) {
      embed.setImage(config.image);
    }

    if (config.footer) {
      embed.setFooter({
        text: config.footer.text,
        iconURL: config.footer.iconURL
      });
    }

    if (config.fields && Array.isArray(config.fields)) {
      config.fields.forEach(field => {
        embed.addFields({
          name: field.name,
          value: field.value,
          inline: field.inline || false
        });
      });
    }

    return embed;
  }

  /**
   * Build standard response embeds
   */
  buildSuccessEmbed(title, description) {
    return this.buildEmbed({
      title: `✅ ${title}`,
      description,
      color: 0x00FF00,
      timestamp: true
    });
  }

  buildErrorEmbed(title, description) {
    return this.buildEmbed({
      title: `❌ ${title}`,
      description,
      color: 0xFF0000,
      timestamp: true
    });
  }

  buildInfoEmbed(title, description, fields = []) {
    return this.buildEmbed({
      title: `ℹ️ ${title}`,
      description,
      color: 0x0099FF,
      fields,
      timestamp: true
    });
  }

  buildAIResponseEmbed(question, answer, botName) {
    return this.buildEmbed({
      title: '🤖 AI Response',
      description: answer,
      color: 0x7289DA,
      fields: [
        { name: '❓ Question', value: question.substring(0, 1024), inline: false }
      ],
      footer: { text: `Powered by ${botName}` },
      timestamp: true
    });
  }

  // ==================== BUTTONS & SELECT MENUS ====================

  /**
   * Build button row
   * @param {Array} buttons - Button configurations
   * @returns {ActionRowBuilder} Button row
   */
  buildButtonRow(buttons) {
    const row = new ActionRowBuilder();

    buttons.forEach(btn => {
      const button = new ButtonBuilder()
        .setCustomId(btn.customId || btn.id)
        .setLabel(btn.label)
        .setStyle(this.getButtonStyle(btn.style || 'primary'));

      if (btn.emoji) {
        button.setEmoji(btn.emoji);
      }

      if (btn.disabled) {
        button.setDisabled(true);
      }

      if (btn.url) {
        button.setURL(btn.url);
        button.setStyle(ButtonStyle.Link);
      }

      row.addComponents(button);
    });

    return row;
  }

  /**
   * Get button style from string
   */
  getButtonStyle(style) {
    const styles = {
      'primary': ButtonStyle.Primary,
      'secondary': ButtonStyle.Secondary,
      'success': ButtonStyle.Success,
      'danger': ButtonStyle.Danger,
      'link': ButtonStyle.Link
    };
    return styles[style.toLowerCase()] || ButtonStyle.Primary;
  }

  /**
   * Build select menu
   * @param {Object} config - Select menu configuration
   * @returns {ActionRowBuilder} Select menu row
   */
  buildSelectMenu(config) {
    const row = new ActionRowBuilder();

    const select = new StringSelectMenuBuilder()
      .setCustomId(config.customId || config.id)
      .setPlaceholder(config.placeholder || 'Select an option');

    if (config.minValues) select.setMinValues(config.minValues);
    if (config.maxValues) select.setMaxValues(config.maxValues);

    config.options.forEach(opt => {
      const option = {
        label: opt.label,
        value: opt.value,
        description: opt.description
      };

      if (opt.emoji) {
        option.emoji = opt.emoji;
      }

      if (opt.default) {
        option.default = true;
      }

      select.addOptions(option);
    });

    row.addComponents(select);
    return row;
  }

  /**
   * Build interactive message with buttons and/or select menus
   */
  buildInteractiveMessage(content, components = []) {
    const messageOptions = {};

    if (typeof content === 'string') {
      messageOptions.content = content;
    } else if (content.embed) {
      messageOptions.embeds = [this.buildEmbed(content.embed)];
      if (content.text) {
        messageOptions.content = content.text;
      }
    }

    if (components.length > 0) {
      messageOptions.components = components.map(comp => {
        if (comp.type === 'buttons') {
          return this.buildButtonRow(comp.buttons);
        } else if (comp.type === 'select') {
          return this.buildSelectMenu(comp);
        }
        return comp;
      });
    }

    return messageOptions;
  }

  // ==================== THREAD SUPPORT ====================

  /**
   * Create a thread from a message
   * @param {string} botToken - Bot token
   * @param {string} channelId - Channel ID
   * @param {string} messageId - Message ID to create thread from
   * @param {Object} options - Thread options
   */
  async createThread(botToken, channelId, messageId, options = {}) {
    const client = await this.connectBot(botToken);
    const channel = await client.channels.fetch(channelId);
    const message = await channel.messages.fetch(messageId);

    const thread = await message.startThread({
      name: options.name || 'Discussion',
      autoArchiveDuration: options.autoArchiveDuration || 1440, // 24 hours default
      reason: options.reason || 'Bot created thread'
    });

    return thread;
  }

  /**
   * Create a standalone thread in a channel
   * @param {string} botToken - Bot token
   * @param {string} channelId - Channel ID
   * @param {Object} options - Thread options
   */
  async createStandaloneThread(botToken, channelId, options = {}) {
    const client = await this.connectBot(botToken);
    const channel = await client.channels.fetch(channelId);

    const thread = await channel.threads.create({
      name: options.name || 'New Thread',
      autoArchiveDuration: options.autoArchiveDuration || 1440,
      type: options.private ? ChannelType.PrivateThread : ChannelType.PublicThread,
      reason: options.reason || 'Bot created thread'
    });

    // Send initial message if provided
    if (options.initialMessage) {
      await thread.send(options.initialMessage);
    }

    return thread;
  }

  /**
   * Send message to a thread
   * @param {string} botToken - Bot token
   * @param {string} threadId - Thread ID
   * @param {string} content - Message content
   * @param {Object} options - Message options
   */
  async sendToThread(botToken, threadId, content, options = {}) {
    const client = await this.connectBot(botToken);
    const thread = await client.channels.fetch(threadId);

    if (!thread || !thread.isThread()) {
      throw new Error('Invalid thread ID');
    }

    const messageOptions = { content };

    if (options.embeds) {
      messageOptions.embeds = options.embeds;
    }

    if (options.components) {
      messageOptions.components = options.components;
    }

    return await thread.send(messageOptions);
  }

  /**
   * Archive a thread
   */
  async archiveThread(botToken, threadId) {
    const client = await this.connectBot(botToken);
    const thread = await client.channels.fetch(threadId);

    if (thread && thread.isThread()) {
      await thread.setArchived(true);
      return true;
    }
    return false;
  }

  /**
   * Unarchive a thread
   */
  async unarchiveThread(botToken, threadId) {
    const client = await this.connectBot(botToken);
    const thread = await client.channels.fetch(threadId);

    if (thread && thread.isThread()) {
      await thread.setArchived(false);
      return true;
    }
    return false;
  }

  // ==================== INTERACTION HANDLING ====================

  /**
   * Reply to an interaction
   * @param {Object} interaction - Discord interaction object
   * @param {Object} response - Response data
   */
  async replyToInteraction(interaction, response) {
    const replyOptions = {};

    if (typeof response === 'string') {
      replyOptions.content = response;
    } else {
      if (response.content) replyOptions.content = response.content;
      if (response.embeds) replyOptions.embeds = response.embeds;
      if (response.components) replyOptions.components = response.components;
      if (response.ephemeral) replyOptions.ephemeral = true;
    }

    if (interaction.replied || interaction.deferred) {
      return await interaction.followUp(replyOptions);
    } else {
      return await interaction.reply(replyOptions);
    }
  }

  /**
   * Defer interaction reply (for long-running operations)
   */
  async deferReply(interaction, ephemeral = false) {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply({ ephemeral });
    }
  }

  /**
   * Edit deferred reply
   */
  async editReply(interaction, response) {
    const replyOptions = {};

    if (typeof response === 'string') {
      replyOptions.content = response;
    } else {
      if (response.content) replyOptions.content = response.content;
      if (response.embeds) replyOptions.embeds = response.embeds;
      if (response.components) replyOptions.components = response.components;
    }

    return await interaction.editReply(replyOptions);
  }

  // ==================== MESSAGE HANDLING ====================

  /**
   * Handle incoming Discord message
   * @param {Object} message - Discord message object
   * @returns {Object} Parsed message data
   */
  handleIncomingMessage(message) {
    return {
      type: this.getMessageType(message),
      messageId: message.id,
      channelId: message.channel.id,
      channelType: message.channel.type,
      guildId: message.guild?.id,
      guildName: message.guild?.name,
      userId: message.author.id,
      username: message.author.username,
      displayName: message.member?.displayName || message.author.username,
      discriminator: message.author.discriminator,
      isBot: message.author.bot,
      content: message.content,
      cleanContent: message.cleanContent,
      attachments: message.attachments.map(a => ({
        id: a.id,
        name: a.name,
        url: a.url,
        contentType: a.contentType,
        size: a.size
      })),
      embeds: message.embeds.map(e => ({
        title: e.title,
        description: e.description,
        url: e.url
      })),
      mentions: {
        users: message.mentions.users.map(u => u.id),
        roles: message.mentions.roles.map(r => r.id),
        channels: message.mentions.channels.map(c => c.id)
      },
      replyTo: message.reference?.messageId,
      threadId: message.channel.isThread() ? message.channel.id : null,
      parentChannelId: message.channel.isThread() ? message.channel.parentId : null,
      timestamp: message.createdAt,
      raw: message
    };
  }

  /**
   * Get message type
   */
  getMessageType(message) {
    if (message.attachments.size > 0) {
      const attachment = message.attachments.first();
      if (attachment.contentType?.startsWith('image/')) return 'image';
      if (attachment.contentType?.startsWith('video/')) return 'video';
      if (attachment.contentType?.startsWith('audio/')) return 'audio';
      return 'document';
    }
    if (message.stickers?.size > 0) return 'sticker';
    return 'text';
  }

  /**
   * Handle slash command interaction
   * @param {Object} interaction - Discord interaction
   * @returns {Object} Parsed command data
   */
  handleSlashCommand(interaction) {
    return {
      type: 'slash_command',
      commandName: interaction.commandName,
      options: this.extractCommandOptions(interaction),
      userId: interaction.user.id,
      username: interaction.user.username,
      displayName: interaction.member?.displayName || interaction.user.username,
      channelId: interaction.channel.id,
      guildId: interaction.guild?.id,
      interaction: interaction
    };
  }

  /**
   * Extract options from slash command
   */
  extractCommandOptions(interaction) {
    const options = {};
    interaction.options.data.forEach(opt => {
      options[opt.name] = opt.value;
    });
    return options;
  }

  /**
   * Handle button interaction
   */
  handleButtonInteraction(interaction) {
    return {
      type: 'button',
      customId: interaction.customId,
      userId: interaction.user.id,
      username: interaction.user.username,
      channelId: interaction.channel.id,
      messageId: interaction.message.id,
      guildId: interaction.guild?.id,
      interaction: interaction
    };
  }

  /**
   * Handle select menu interaction
   */
  handleSelectMenuInteraction(interaction) {
    return {
      type: 'select_menu',
      customId: interaction.customId,
      values: interaction.values,
      userId: interaction.user.id,
      username: interaction.user.username,
      channelId: interaction.channel.id,
      messageId: interaction.message.id,
      guildId: interaction.guild?.id,
      interaction: interaction
    };
  }

  // ==================== BOT INFO ====================

  /**
   * Get bot info
   * @param {string} botToken - Bot token
   */
  async getBotInfo(botToken) {
    const client = await this.connectBot(botToken);
    const user = client.user;

    return {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatarURL(),
      guilds: client.guilds.cache.size,
      users: client.users.cache.size,
      uptime: client.uptime,
      createdAt: user.createdAt
    };
  }

  /**
   * Test bot connection
   * @param {string} botToken - Bot token
   * @returns {Object} Connection test result
   */
  async testConnection(botToken) {
    try {
      const client = this.initBot(botToken);
      await client.login(botToken);

      const botInfo = {
        success: true,
        botId: client.user.id,
        botUsername: client.user.username,
        discriminator: client.user.discriminator,
        avatar: client.user.avatarURL()
      };

      return botInfo;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get guild (server) information
   */
  async getGuildInfo(botToken, guildId) {
    const client = await this.connectBot(botToken);
    const guild = await client.guilds.fetch(guildId);

    return {
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL(),
      memberCount: guild.memberCount,
      ownerId: guild.ownerId,
      channels: guild.channels.cache.size,
      roles: guild.roles.cache.size,
      createdAt: guild.createdAt
    };
  }

  // ==================== REACTIONS ====================

  /**
   * Add reaction to message
   */
  async addReaction(botToken, channelId, messageId, emoji) {
    const client = await this.connectBot(botToken);
    const channel = await client.channels.fetch(channelId);
    const message = await channel.messages.fetch(messageId);
    await message.react(emoji);
    return true;
  }

  /**
   * Remove bot's reaction
   */
  async removeReaction(botToken, channelId, messageId, emoji) {
    const client = await this.connectBot(botToken);
    const channel = await client.channels.fetch(channelId);
    const message = await channel.messages.fetch(messageId);
    const reaction = message.reactions.cache.get(emoji);
    if (reaction) {
      await reaction.users.remove(client.user.id);
    }
    return true;
  }

  // ==================== MESSAGE EDITING ====================

  /**
   * Edit message
   */
  async editMessage(botToken, channelId, messageId, newContent, options = {}) {
    const client = await this.connectBot(botToken);
    const channel = await client.channels.fetch(channelId);
    const message = await channel.messages.fetch(messageId);

    const editOptions = {};

    if (typeof newContent === 'string') {
      editOptions.content = newContent;
    } else {
      if (newContent.content) editOptions.content = newContent.content;
      if (newContent.embeds) editOptions.embeds = newContent.embeds;
    }

    if (options.components) {
      editOptions.components = options.components;
    }

    return await message.edit(editOptions);
  }

  /**
   * Delete message
   */
  async deleteMessage(botToken, channelId, messageId) {
    const client = await this.connectBot(botToken);
    const channel = await client.channels.fetch(channelId);
    const message = await channel.messages.fetch(messageId);
    await message.delete();
    return true;
  }

  // ==================== TYPING INDICATOR ====================

  /**
   * Send typing indicator
   */
  async sendTyping(botToken, channelId) {
    const client = await this.connectBot(botToken);
    const channel = await client.channels.fetch(channelId);
    await channel.sendTyping();
    return true;
  }

  // ==================== USER & MEMBER INFO ====================

  /**
   * Get user info
   */
  async getUserInfo(botToken, userId) {
    const client = await this.connectBot(botToken);
    const user = await client.users.fetch(userId);

    return {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatarURL(),
      bot: user.bot,
      createdAt: user.createdAt
    };
  }

  /**
   * Get member info (guild-specific user data)
   */
  async getMemberInfo(botToken, guildId, userId) {
    const client = await this.connectBot(botToken);
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);

    return {
      id: member.id,
      username: member.user.username,
      displayName: member.displayName,
      nickname: member.nickname,
      avatar: member.avatarURL() || member.user.avatarURL(),
      roles: member.roles.cache.map(r => ({ id: r.id, name: r.name })),
      joinedAt: member.joinedAt,
      premiumSince: member.premiumSince
    };
  }
}

// Export singleton instance
module.exports = new DiscordService();
