/**
 * TelegramChannel Model
 * Database model for Telegram bot channel integration
 */

const db = require('../db');

class TelegramChannel {
  static tableName = 'telegram_channels';

  /**
   * Create a new Telegram channel
   * @param {Object} data - Channel data
   * @returns {Object} Created channel
   */
  static async create(data) {
    const [channel] = await db(this.tableName)
      .insert({
        organization_id: data.organizationId,
        bot_id: data.botId,
        bot_token: data.botToken,
        bot_username: data.botUsername,
        webhook_url: data.webhookUrl,
        webhook_secret: data.webhookSecret,
        chat_id: data.chatId,
        is_active: data.isActive !== false,
        settings: JSON.stringify(data.settings || {}),
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    return this.formatChannel(channel);
  }

  /**
   * Find channel by ID
   * @param {number} id - Channel ID
   * @returns {Object|null} Channel or null
   */
  static async findById(id) {
    const channel = await db(this.tableName)
      .where({ id })
      .first();

    return channel ? this.formatChannel(channel) : null;
  }

  /**
   * Find channel by bot token
   * @param {string} botToken - Telegram bot token
   * @returns {Object|null} Channel or null
   */
  static async findByBotToken(botToken) {
    const channel = await db(this.tableName)
      .where({ bot_token: botToken })
      .first();

    return channel ? this.formatChannel(channel) : null;
  }

  /**
   * Find channel by bot username
   * @param {string} botUsername - Telegram bot username
   * @returns {Object|null} Channel or null
   */
  static async findByBotUsername(botUsername) {
    const channel = await db(this.tableName)
      .where({ bot_username: botUsername })
      .first();

    return channel ? this.formatChannel(channel) : null;
  }

  /**
   * Find channels by organization
   * @param {number} organizationId - Organization ID
   * @returns {Array} Channels
   */
  static async findByOrganization(organizationId) {
    const channels = await db(this.tableName)
      .where({ organization_id: organizationId })
      .orderBy('created_at', 'desc');

    return channels.map(c => this.formatChannel(c));
  }

  /**
   * Find channels by bot
   * @param {number} botId - Bot ID
   * @returns {Array} Channels
   */
  static async findByBot(botId) {
    const channels = await db(this.tableName)
      .where({ bot_id: botId })
      .orderBy('created_at', 'desc');

    return channels.map(c => this.formatChannel(c));
  }

  /**
   * Find active channels
   * @param {number} organizationId - Organization ID
   * @returns {Array} Active channels
   */
  static async findActive(organizationId) {
    const channels = await db(this.tableName)
      .where({ organization_id: organizationId, is_active: true })
      .orderBy('created_at', 'desc');

    return channels.map(c => this.formatChannel(c));
  }

  /**
   * Update channel
   * @param {number} id - Channel ID
   * @param {Object} data - Update data
   * @returns {Object} Updated channel
   */
  static async update(id, data) {
    const updateData = {
      updated_at: new Date()
    };

    if (data.botToken !== undefined) updateData.bot_token = data.botToken;
    if (data.botUsername !== undefined) updateData.bot_username = data.botUsername;
    if (data.webhookUrl !== undefined) updateData.webhook_url = data.webhookUrl;
    if (data.webhookSecret !== undefined) updateData.webhook_secret = data.webhookSecret;
    if (data.chatId !== undefined) updateData.chat_id = data.chatId;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;
    if (data.settings !== undefined) updateData.settings = JSON.stringify(data.settings);

    const [channel] = await db(this.tableName)
      .where({ id })
      .update(updateData)
      .returning('*');

    return channel ? this.formatChannel(channel) : null;
  }

  /**
   * Delete channel
   * @param {number} id - Channel ID
   * @returns {boolean} Success
   */
  static async delete(id) {
    const deleted = await db(this.tableName)
      .where({ id })
      .del();

    return deleted > 0;
  }

  /**
   * Activate channel
   * @param {number} id - Channel ID
   * @returns {Object} Updated channel
   */
  static async activate(id) {
    return this.update(id, { isActive: true });
  }

  /**
   * Deactivate channel
   * @param {number} id - Channel ID
   * @returns {Object} Updated channel
   */
  static async deactivate(id) {
    return this.update(id, { isActive: false });
  }

  /**
   * Get channel statistics
   * @param {number} channelId - Channel ID
   * @param {Object} dateRange - Date range filter
   * @returns {Object} Statistics
   */
  static async getStats(channelId, dateRange = {}) {
    const startDate = dateRange.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = dateRange.end || new Date();

    // Total messages
    const totalMessages = await db('telegram_messages')
      .where({ channel_id: channelId })
      .whereBetween('created_at', [startDate, endDate])
      .count('* as count')
      .first();

    // Unique users
    const uniqueUsers = await db('telegram_messages')
      .where({ channel_id: channelId })
      .whereBetween('created_at', [startDate, endDate])
      .countDistinct('user_id as count')
      .first();

    // Messages by type
    const messagesByType = await db('telegram_messages')
      .where({ channel_id: channelId })
      .whereBetween('created_at', [startDate, endDate])
      .select('message_type')
      .count('* as count')
      .groupBy('message_type');

    // Daily messages
    const dailyMessages = await db('telegram_messages')
      .where({ channel_id: channelId })
      .whereBetween('created_at', [startDate, endDate])
      .select(db.raw("DATE(created_at) as date"))
      .count('* as count')
      .groupBy(db.raw('DATE(created_at)'))
      .orderBy('date', 'asc');

    return {
      totalMessages: parseInt(totalMessages?.count || 0),
      uniqueUsers: parseInt(uniqueUsers?.count || 0),
      messagesByType: messagesByType.reduce((acc, row) => {
        acc[row.message_type] = parseInt(row.count);
        return acc;
      }, {}),
      dailyMessages: dailyMessages.map(row => ({
        date: row.date,
        count: parseInt(row.count)
      })),
      period: {
        start: startDate,
        end: endDate
      }
    };
  }

  /**
   * Check if bot token is already in use
   * @param {string} botToken - Bot token to check
   * @param {number} excludeId - ID to exclude from check
   * @returns {boolean} True if in use
   */
  static async isBotTokenInUse(botToken, excludeId = null) {
    const query = db(this.tableName)
      .where({ bot_token: botToken });

    if (excludeId) {
      query.whereNot({ id: excludeId });
    }

    const existing = await query.first();
    return !!existing;
  }

  /**
   * Format channel object
   * @param {Object} channel - Raw channel data
   * @returns {Object} Formatted channel
   */
  static formatChannel(channel) {
    return {
      id: channel.id,
      organizationId: channel.organization_id,
      botId: channel.bot_id,
      botToken: channel.bot_token,
      botUsername: channel.bot_username,
      webhookUrl: channel.webhook_url,
      webhookSecret: channel.webhook_secret,
      chatId: channel.chat_id,
      isActive: channel.is_active,
      settings: typeof channel.settings === 'string'
        ? JSON.parse(channel.settings)
        : channel.settings || {},
      createdAt: channel.created_at,
      updatedAt: channel.updated_at
    };
  }
}

module.exports = TelegramChannel;
