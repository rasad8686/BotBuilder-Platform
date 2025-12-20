/**
 * Telegram Controller
 * Handles Telegram channel management operations
 */

const telegramService = require('../services/channels/telegramService');
const TelegramChannel = require('../models/TelegramChannel');
const crypto = require('crypto');
const db = require('../db');

/**
 * Connect a new Telegram bot
 * POST /api/channels/telegram/connect
 */
exports.connectTelegram = async (req, res) => {
  try {
    const { botToken, botId } = req.body;
    const organizationId = req.user.organizationId;

    if (!botToken) {
      return res.status(400).json({
        success: false,
        error: 'Bot token is required'
      });
    }

    // Check if bot token is already in use
    const existingChannel = await TelegramChannel.findByBotToken(botToken);
    if (existingChannel) {
      return res.status(400).json({
        success: false,
        error: 'This bot token is already connected'
      });
    }

    // Test the bot token
    const connectionTest = await telegramService.testConnection(botToken);
    if (!connectionTest.success) {
      return res.status(400).json({
        success: false,
        error: `Invalid bot token: ${connectionTest.error}`
      });
    }

    // Generate webhook secret
    const webhookSecret = crypto.randomBytes(32).toString('hex');

    // Build webhook URL
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const webhookUrl = `${baseUrl}/api/webhooks/telegram/${connectionTest.botId}`;

    // Create channel record
    const channel = await TelegramChannel.create({
      organizationId,
      botId: botId || null,
      botToken,
      botUsername: connectionTest.botUsername,
      webhookUrl,
      webhookSecret,
      isActive: true,
      settings: {
        canJoinGroups: connectionTest.canJoinGroups,
        canReadAllGroupMessages: connectionTest.canReadAllGroupMessages,
        supportsInlineQueries: connectionTest.supportsInlineQueries
      }
    });

    // Set up webhook
    try {
      await telegramService.setWebhook(botToken, webhookUrl, {
        secretToken: webhookSecret,
        allowedUpdates: ['message', 'callback_query', 'inline_query']
      });
    } catch (webhookError) {
      // Failed to set webhook - silent fail
      // Continue anyway - webhook can be set manually
    }

    res.status(201).json({
      success: true,
      data: {
        id: channel.id,
        botUsername: channel.botUsername,
        webhookUrl: channel.webhookUrl,
        isActive: channel.isActive,
        settings: channel.settings,
        createdAt: channel.createdAt
      },
      message: `Telegram bot @${channel.botUsername} connected successfully`
    });

  } catch (error) {
    // Error connecting Telegram - silent fail
    res.status(500).json({
      success: false,
      error: 'Failed to connect Telegram bot'
    });
  }
};

/**
 * Disconnect a Telegram bot
 * DELETE /api/channels/telegram/:id
 */
exports.disconnectTelegram = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    // Find channel
    const channel = await TelegramChannel.findById(id);
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Telegram channel not found'
      });
    }

    // Verify ownership
    if (channel.organizationId !== organizationId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to disconnect this channel'
      });
    }

    // Delete webhook
    try {
      await telegramService.deleteWebhook(channel.botToken, true);
    } catch (webhookError) {
      // Failed to delete webhook - silent fail
    }

    // Remove bot instance
    telegramService.removeBot(channel.botToken);

    // Delete channel record
    await TelegramChannel.delete(id);

    res.json({
      success: true,
      message: `Telegram bot @${channel.botUsername} disconnected successfully`
    });

  } catch (error) {
    // Error disconnecting Telegram - silent fail
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect Telegram bot'
    });
  }
};

/**
 * Get channel statistics
 * GET /api/channels/telegram/stats
 */
exports.getChannelStats = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { channelId, startDate, endDate } = req.query;

    // Get all channels for organization
    const channels = await TelegramChannel.findByOrganization(organizationId);

    if (channelId) {
      // Get stats for specific channel
      const channel = channels.find(c => c.id === parseInt(channelId));
      if (!channel) {
        return res.status(404).json({
          success: false,
          error: 'Channel not found'
        });
      }

      const stats = await TelegramChannel.getStats(parseInt(channelId), {
        start: startDate ? new Date(startDate) : undefined,
        end: endDate ? new Date(endDate) : undefined
      });

      return res.json({
        success: true,
        data: {
          channel: {
            id: channel.id,
            botUsername: channel.botUsername,
            isActive: channel.isActive
          },
          stats
        }
      });
    }

    // Get aggregated stats for all channels with single JOIN query (optimized - no N+1)
    const statsResult = await db.query(`
      SELECT
        tc.id as channel_id,
        tc.bot_username,
        tc.is_active,
        COUNT(tm.id) as total_messages,
        COUNT(DISTINCT tm.user_id) as unique_users
      FROM telegram_channels tc
      LEFT JOIN telegram_messages tm ON tc.id = tm.channel_id
        AND tm.created_at >= NOW() - INTERVAL '30 days'
      WHERE tc.organization_id = $1
      GROUP BY tc.id, tc.bot_username, tc.is_active
      ORDER BY total_messages DESC
    `, [organizationId]);

    const allStats = statsResult.rows.map(row => ({
      channelId: row.channel_id,
      botUsername: row.bot_username,
      isActive: row.is_active,
      totalMessages: parseInt(row.total_messages) || 0,
      uniqueUsers: parseInt(row.unique_users) || 0
    }));

    // Calculate totals
    const totals = {
      totalChannels: allStats.length,
      activeChannels: allStats.filter(c => c.isActive).length,
      totalMessages: allStats.reduce((sum, s) => sum + s.totalMessages, 0),
      totalUniqueUsers: allStats.reduce((sum, s) => sum + s.uniqueUsers, 0)
    };

    res.json({
      success: true,
      data: {
        totals,
        channels: allStats
      }
    });

  } catch (error) {
    // Error getting channel stats - silent fail
    res.status(500).json({
      success: false,
      error: 'Failed to get channel statistics'
    });
  }
};

/**
 * Test Telegram connection
 * POST /api/channels/telegram/test
 */
exports.testConnection = async (req, res) => {
  try {
    const { botToken, channelId } = req.body;
    let token = botToken;

    // If channelId is provided, get token from database
    if (channelId && !botToken) {
      const channel = await TelegramChannel.findById(channelId);
      if (!channel) {
        return res.status(404).json({
          success: false,
          error: 'Channel not found'
        });
      }

      // Verify ownership
      if (channel.organizationId !== req.user.organizationId) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized'
        });
      }

      token = channel.botToken;
    }

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Bot token or channel ID is required'
      });
    }

    // Test connection
    const result = await telegramService.testConnection(token);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    // Get webhook info
    const webhookInfo = await telegramService.getWebhookInfo(token);

    res.json({
      success: true,
      data: {
        bot: {
          id: result.botId,
          username: result.botUsername,
          firstName: result.firstName,
          canJoinGroups: result.canJoinGroups,
          canReadAllGroupMessages: result.canReadAllGroupMessages,
          supportsInlineQueries: result.supportsInlineQueries
        },
        webhook: {
          url: webhookInfo.url,
          hasCustomCertificate: webhookInfo.has_custom_certificate,
          pendingUpdateCount: webhookInfo.pending_update_count,
          lastErrorDate: webhookInfo.last_error_date
            ? new Date(webhookInfo.last_error_date * 1000)
            : null,
          lastErrorMessage: webhookInfo.last_error_message,
          maxConnections: webhookInfo.max_connections
        }
      }
    });

  } catch (error) {
    // Error testing connection - silent fail
    res.status(500).json({
      success: false,
      error: 'Failed to test connection'
    });
  }
};

/**
 * Get all Telegram channels for organization
 * GET /api/channels/telegram
 */
exports.getChannels = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const channels = await TelegramChannel.findByOrganization(organizationId);

    // Hide sensitive data
    const safeChannels = channels.map(channel => ({
      id: channel.id,
      botId: channel.botId,
      botUsername: channel.botUsername,
      webhookUrl: channel.webhookUrl,
      isActive: channel.isActive,
      settings: channel.settings,
      createdAt: channel.createdAt,
      updatedAt: channel.updatedAt
    }));

    res.json({
      success: true,
      data: safeChannels
    });

  } catch (error) {
    // Error getting channels - silent fail
    res.status(500).json({
      success: false,
      error: 'Failed to get channels'
    });
  }
};

/**
 * Get single Telegram channel
 * GET /api/channels/telegram/:id
 */
exports.getChannel = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const channel = await TelegramChannel.findById(id);
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }

    // Verify ownership
    if (channel.organizationId !== organizationId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }

    res.json({
      success: true,
      data: {
        id: channel.id,
        botId: channel.botId,
        botUsername: channel.botUsername,
        webhookUrl: channel.webhookUrl,
        isActive: channel.isActive,
        settings: channel.settings,
        createdAt: channel.createdAt,
        updatedAt: channel.updatedAt
      }
    });

  } catch (error) {
    // Error getting channel - silent fail
    res.status(500).json({
      success: false,
      error: 'Failed to get channel'
    });
  }
};

/**
 * Update Telegram channel
 * PUT /api/channels/telegram/:id
 */
exports.updateChannel = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;
    const { isActive, settings, botId } = req.body;

    const channel = await TelegramChannel.findById(id);
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }

    // Verify ownership
    if (channel.organizationId !== organizationId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }

    const updateData = {};
    if (isActive !== undefined) updateData.isActive = isActive;
    if (settings !== undefined) updateData.settings = { ...channel.settings, ...settings };
    if (botId !== undefined) updateData.botId = botId;

    const updatedChannel = await TelegramChannel.update(id, updateData);

    res.json({
      success: true,
      data: {
        id: updatedChannel.id,
        botUsername: updatedChannel.botUsername,
        isActive: updatedChannel.isActive,
        settings: updatedChannel.settings,
        updatedAt: updatedChannel.updatedAt
      },
      message: 'Channel updated successfully'
    });

  } catch (error) {
    // Error updating channel - silent fail
    res.status(500).json({
      success: false,
      error: 'Failed to update channel'
    });
  }
};

/**
 * Send test message
 * POST /api/channels/telegram/:id/send-test
 */
exports.sendTestMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { chatId, message } = req.body;
    const organizationId = req.user.organizationId;

    if (!chatId || !message) {
      return res.status(400).json({
        success: false,
        error: 'Chat ID and message are required'
      });
    }

    const channel = await TelegramChannel.findById(id);
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }

    // Verify ownership
    if (channel.organizationId !== organizationId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }

    // Send message
    const result = await telegramService.sendMessage(
      channel.botToken,
      chatId,
      message,
      { parseMode: 'HTML' }
    );

    res.json({
      success: true,
      data: {
        messageId: result.message_id,
        chatId: result.chat.id,
        date: new Date(result.date * 1000)
      },
      message: 'Test message sent successfully'
    });

  } catch (error) {
    // Error sending test message - silent fail
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send test message'
    });
  }
};

/**
 * Refresh webhook
 * POST /api/channels/telegram/:id/refresh-webhook
 */
exports.refreshWebhook = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const channel = await TelegramChannel.findById(id);
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }

    // Verify ownership
    if (channel.organizationId !== organizationId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }

    // Generate new secret
    const webhookSecret = crypto.randomBytes(32).toString('hex');

    // Set webhook
    await telegramService.setWebhook(channel.botToken, channel.webhookUrl, {
      secretToken: webhookSecret,
      allowedUpdates: ['message', 'callback_query', 'inline_query']
    });

    // Update channel
    await TelegramChannel.update(id, { webhookSecret });

    // Get updated webhook info
    const webhookInfo = await telegramService.getWebhookInfo(channel.botToken);

    res.json({
      success: true,
      data: {
        webhookUrl: webhookInfo.url,
        pendingUpdates: webhookInfo.pending_update_count,
        lastError: webhookInfo.last_error_message
      },
      message: 'Webhook refreshed successfully'
    });

  } catch (error) {
    // Error refreshing webhook - silent fail
    res.status(500).json({
      success: false,
      error: 'Failed to refresh webhook'
    });
  }
};
