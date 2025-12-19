/**
 * SlackChannel Model
 * Database model for Slack workspace integration
 */

const db = require('../db');

class SlackChannel {
  static tableName = 'slack_channels';

  /**
   * Create a new Slack channel
   * @param {Object} data - Channel data
   * @returns {Object} Created channel
   */
  static async create(data) {
    const [channel] = await db(this.tableName)
      .insert({
        organization_id: data.organizationId,
        bot_id: data.botId,
        team_id: data.teamId,
        team_name: data.teamName,
        bot_token: data.botToken,
        bot_user_id: data.botUserId,
        app_id: data.appId,
        client_id: data.clientId,
        client_secret: data.clientSecret,
        signing_secret: data.signingSecret,
        webhook_url: data.webhookUrl,
        scopes: JSON.stringify(data.scopes || []),
        authed_user_id: data.authedUserId,
        authed_user_token: data.authedUserToken,
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
   * Find channel by team ID
   * @param {string} teamId - Slack team ID
   * @returns {Object|null} Channel or null
   */
  static async findByTeamId(teamId) {
    const channel = await db(this.tableName)
      .where({ team_id: teamId })
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

    if (data.botId !== undefined) updateData.bot_id = data.botId;
    if (data.teamName !== undefined) updateData.team_name = data.teamName;
    if (data.botToken !== undefined) updateData.bot_token = data.botToken;
    if (data.botUserId !== undefined) updateData.bot_user_id = data.botUserId;
    if (data.webhookUrl !== undefined) updateData.webhook_url = data.webhookUrl;
    if (data.signingSecret !== undefined) updateData.signing_secret = data.signingSecret;
    if (data.scopes !== undefined) updateData.scopes = JSON.stringify(data.scopes);
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
   * Check if team is already connected
   * @param {string} teamId - Slack team ID
   * @param {number} excludeId - ID to exclude from check
   * @returns {boolean} True if connected
   */
  static async isTeamConnected(teamId, excludeId = null) {
    const query = db(this.tableName)
      .where({ team_id: teamId });

    if (excludeId) {
      query.whereNot({ id: excludeId });
    }

    const existing = await query.first();
    return !!existing;
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
    const totalMessages = await db('slack_messages')
      .where({ channel_id: channelId })
      .whereBetween('created_at', [startDate, endDate])
      .count('* as count')
      .first();

    // Unique users
    const uniqueUsers = await db('slack_messages')
      .where({ channel_id: channelId })
      .whereBetween('created_at', [startDate, endDate])
      .countDistinct('user_id as count')
      .first();

    // Commands used
    const totalCommands = await db('slack_commands')
      .where({ channel_id: channelId })
      .whereBetween('created_at', [startDate, endDate])
      .count('* as count')
      .first();

    // Interactions
    const totalInteractions = await db('slack_interactions')
      .where({ channel_id: channelId })
      .whereBetween('created_at', [startDate, endDate])
      .count('* as count')
      .first();

    // Messages by event type
    const messagesByType = await db('slack_messages')
      .where({ channel_id: channelId })
      .whereBetween('created_at', [startDate, endDate])
      .select('event_type')
      .count('* as count')
      .groupBy('event_type');

    // Daily activity
    const dailyActivity = await db('slack_messages')
      .where({ channel_id: channelId })
      .whereBetween('created_at', [startDate, endDate])
      .select(db.raw("DATE(created_at) as date"))
      .count('* as count')
      .groupBy(db.raw('DATE(created_at)'))
      .orderBy('date', 'asc');

    return {
      totalMessages: parseInt(totalMessages?.count || 0),
      uniqueUsers: parseInt(uniqueUsers?.count || 0),
      totalCommands: parseInt(totalCommands?.count || 0),
      totalInteractions: parseInt(totalInteractions?.count || 0),
      messagesByType: messagesByType.reduce((acc, row) => {
        acc[row.event_type] = parseInt(row.count);
        return acc;
      }, {}),
      dailyActivity: dailyActivity.map(row => ({
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
   * Format channel object
   * @param {Object} channel - Raw channel data
   * @returns {Object} Formatted channel
   */
  static formatChannel(channel) {
    return {
      id: channel.id,
      organizationId: channel.organization_id,
      botId: channel.bot_id,
      teamId: channel.team_id,
      teamName: channel.team_name,
      botToken: channel.bot_token,
      botUserId: channel.bot_user_id,
      appId: channel.app_id,
      clientId: channel.client_id,
      clientSecret: channel.client_secret,
      signingSecret: channel.signing_secret,
      webhookUrl: channel.webhook_url,
      scopes: typeof channel.scopes === 'string'
        ? JSON.parse(channel.scopes)
        : channel.scopes || [],
      authedUserId: channel.authed_user_id,
      authedUserToken: channel.authed_user_token,
      isActive: channel.is_active,
      settings: typeof channel.settings === 'string'
        ? JSON.parse(channel.settings)
        : channel.settings || {},
      createdAt: channel.created_at,
      updatedAt: channel.updated_at
    };
  }
}

module.exports = SlackChannel;
