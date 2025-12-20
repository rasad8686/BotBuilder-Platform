/**
 * Slack Controller
 * Handles Slack workspace integration operations
 */

const slackService = require('../services/channels/slackService');
const SlackChannel = require('../models/SlackChannel');
const db = require('../db');
const crypto = require('crypto');

// Default OAuth scopes
const DEFAULT_BOT_SCOPES = [
  'app_mentions:read',
  'channels:history',
  'channels:read',
  'chat:write',
  'commands',
  'groups:history',
  'groups:read',
  'im:history',
  'im:read',
  'im:write',
  'mpim:history',
  'mpim:read',
  'reactions:read',
  'reactions:write',
  'users:read',
  'files:read',
  'files:write'
];

/**
 * Start OAuth flow
 * GET /api/channels/slack/oauth
 */
exports.startOAuth = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const userId = req.user.id;
    const { botId } = req.query;

    // Generate state token
    const state = crypto.randomBytes(32).toString('hex');

    // Store state for verification
    await db('slack_oauth_states').insert({
      organization_id: organizationId,
      user_id: userId,
      state: state,
      bot_id: botId || null,
      expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      created_at: new Date()
    });

    // Build OAuth URL
    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = `${process.env.BASE_URL || req.protocol + '://' + req.get('host')}/api/channels/slack/callback`;

    const authUrl = slackService.generateOAuthUrl({
      clientId,
      scopes: DEFAULT_BOT_SCOPES,
      redirectUri,
      state
    });

    res.json({
      success: true,
      data: {
        authUrl,
        state
      }
    });

  } catch (error) {
    // Error starting OAuth - silent fail
    res.status(500).json({
      success: false,
      error: 'Failed to start OAuth flow'
    });
  }
};

/**
 * OAuth callback
 * GET /api/channels/slack/callback
 */
exports.oauthCallback = async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;

    // Handle OAuth errors
    if (oauthError) {
      return res.redirect(`/channels/slack?error=${encodeURIComponent(oauthError)}`);
    }

    if (!code || !state) {
      return res.redirect('/channels/slack?error=missing_params');
    }

    // Verify state
    const oauthState = await db('slack_oauth_states')
      .where({ state })
      .where('expires_at', '>', new Date())
      .first();

    if (!oauthState) {
      return res.redirect('/channels/slack?error=invalid_state');
    }

    // Delete used state
    await db('slack_oauth_states').where({ id: oauthState.id }).del();

    // Exchange code for tokens
    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    const redirectUri = `${process.env.BASE_URL || req.protocol + '://' + req.get('host')}/api/channels/slack/callback`;

    const tokenResponse = await slackService.exchangeOAuthCode(code, {
      clientId,
      clientSecret,
      redirectUri
    });

    if (!tokenResponse.ok) {
      return res.redirect('/channels/slack?error=token_exchange_failed');
    }

    // Check if team is already connected
    const existingChannel = await SlackChannel.findByTeamId(tokenResponse.team.id);
    if (existingChannel) {
      // Update existing channel
      await SlackChannel.update(existingChannel.id, {
        botToken: tokenResponse.accessToken,
        botUserId: tokenResponse.botUserId,
        teamName: tokenResponse.team.name,
        scopes: tokenResponse.scope?.split(',') || [],
        authedUserId: tokenResponse.authedUser?.id,
        authedUserToken: tokenResponse.authedUser?.accessToken,
        isActive: true
      });

      return res.redirect(`/channels/slack?success=reconnected&team=${encodeURIComponent(tokenResponse.team.name)}`);
    }

    // Create new channel
    const channel = await SlackChannel.create({
      organizationId: oauthState.organization_id,
      botId: oauthState.bot_id,
      teamId: tokenResponse.team.id,
      teamName: tokenResponse.team.name,
      botToken: tokenResponse.accessToken,
      botUserId: tokenResponse.botUserId,
      appId: tokenResponse.appId,
      clientId: clientId,
      clientSecret: clientSecret,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      scopes: tokenResponse.scope?.split(',') || [],
      authedUserId: tokenResponse.authedUser?.id,
      authedUserToken: tokenResponse.authedUser?.accessToken,
      webhookUrl: tokenResponse.incomingWebhook?.url,
      isActive: true
    });

    res.redirect(`/channels/slack?success=connected&team=${encodeURIComponent(tokenResponse.team.name)}`);

  } catch (error) {
    // Error in OAuth callback - silent fail
    res.redirect('/channels/slack?error=callback_failed');
  }
};

/**
 * Disconnect Slack workspace
 * DELETE /api/channels/slack/:id
 */
exports.disconnectSlack = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    // Find channel
    const channel = await SlackChannel.findById(id);
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Slack workspace not found'
      });
    }

    // Verify ownership
    if (channel.organizationId !== organizationId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to disconnect this workspace'
      });
    }

    // Revoke token
    try {
      await slackService.revokeToken(channel.botToken);
    } catch (revokeError) {
      // Failed to revoke token - silent fail
    }

    // Remove client instance
    slackService.removeClient(channel.teamId);

    // Delete channel record
    await SlackChannel.delete(id);

    res.json({
      success: true,
      message: `Slack workspace "${channel.teamName}" disconnected successfully`
    });

  } catch (error) {
    // Error disconnecting Slack - silent fail
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect Slack workspace'
    });
  }
};

/**
 * Get workspace info
 * GET /api/channels/slack/:id/info
 */
exports.getWorkspaceInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const channel = await SlackChannel.findById(id);
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Slack workspace not found'
      });
    }

    if (channel.organizationId !== organizationId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }

    // Get workspace info from Slack
    const teamInfo = await slackService.getTeamInfo(channel.teamId, channel.botToken);
    const botInfo = await slackService.getBotInfo(channel.teamId, channel.botToken);

    res.json({
      success: true,
      data: {
        workspace: {
          id: teamInfo.id,
          name: teamInfo.name,
          domain: teamInfo.domain,
          icon: teamInfo.icon
        },
        bot: {
          id: botInfo.botId,
          userId: botInfo.userId,
          user: botInfo.user
        },
        scopes: channel.scopes
      }
    });

  } catch (error) {
    // Error getting workspace info - silent fail
    res.status(500).json({
      success: false,
      error: 'Failed to get workspace info'
    });
  }
};

/**
 * Get channel statistics
 * GET /api/channels/slack/stats
 */
exports.getChannelStats = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { channelId, startDate, endDate } = req.query;

    // Get all channels for organization
    const channels = await SlackChannel.findByOrganization(organizationId);

    if (channelId) {
      const channel = channels.find(c => c.id === parseInt(channelId));
      if (!channel) {
        return res.status(404).json({
          success: false,
          error: 'Channel not found'
        });
      }

      const stats = await SlackChannel.getStats(parseInt(channelId), {
        start: startDate ? new Date(startDate) : undefined,
        end: endDate ? new Date(endDate) : undefined
      });

      return res.json({
        success: true,
        data: {
          channel: {
            id: channel.id,
            teamName: channel.teamName,
            isActive: channel.isActive
          },
          stats
        }
      });
    }

    // Get aggregated stats
    const allStats = await Promise.all(
      channels.map(async (channel) => {
        const stats = await SlackChannel.getStats(channel.id, {
          start: startDate ? new Date(startDate) : undefined,
          end: endDate ? new Date(endDate) : undefined
        });
        return {
          channelId: channel.id,
          teamName: channel.teamName,
          isActive: channel.isActive,
          ...stats
        };
      })
    );

    const totals = {
      totalWorkspaces: channels.length,
      activeWorkspaces: channels.filter(c => c.isActive).length,
      totalMessages: allStats.reduce((sum, s) => sum + s.totalMessages, 0),
      totalCommands: allStats.reduce((sum, s) => sum + s.totalCommands, 0),
      totalInteractions: allStats.reduce((sum, s) => sum + s.totalInteractions, 0),
      totalUniqueUsers: allStats.reduce((sum, s) => sum + s.uniqueUsers, 0)
    };

    res.json({
      success: true,
      data: {
        totals,
        workspaces: allStats
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
 * Test Slack connection
 * POST /api/channels/slack/test
 */
exports.testConnection = async (req, res) => {
  try {
    const { channelId } = req.body;
    const organizationId = req.user.organizationId;

    const channel = await SlackChannel.findById(channelId);
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }

    if (channel.organizationId !== organizationId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }

    const result = await slackService.testConnection(channel.teamId, channel.botToken);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      data: {
        bot: result.bot,
        team: result.team
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
 * Get all Slack channels for organization
 * GET /api/channels/slack
 */
exports.getChannels = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const channels = await SlackChannel.findByOrganization(organizationId);

    // Hide sensitive data
    const safeChannels = channels.map(channel => ({
      id: channel.id,
      botId: channel.botId,
      teamId: channel.teamId,
      teamName: channel.teamName,
      botUserId: channel.botUserId,
      webhookUrl: channel.webhookUrl,
      scopes: channel.scopes,
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
 * Get single Slack channel
 * GET /api/channels/slack/:id
 */
exports.getChannel = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const channel = await SlackChannel.findById(id);
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }

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
        teamId: channel.teamId,
        teamName: channel.teamName,
        botUserId: channel.botUserId,
        webhookUrl: channel.webhookUrl,
        scopes: channel.scopes,
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
 * Update Slack channel
 * PUT /api/channels/slack/:id
 */
exports.updateChannel = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;
    const { isActive, settings, botId } = req.body;

    const channel = await SlackChannel.findById(id);
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }

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

    const updatedChannel = await SlackChannel.update(id, updateData);

    res.json({
      success: true,
      data: {
        id: updatedChannel.id,
        teamName: updatedChannel.teamName,
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
 * List Slack channels in workspace
 * GET /api/channels/slack/:id/channels
 */
exports.listSlackChannels = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const channel = await SlackChannel.findById(id);
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Workspace not found'
      });
    }

    if (channel.organizationId !== organizationId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }

    const result = await slackService.listChannels(channel.teamId, channel.botToken);

    res.json({
      success: true,
      data: result.channels.map(ch => ({
        id: ch.id,
        name: ch.name,
        isPrivate: ch.is_private,
        isMember: ch.is_member,
        numMembers: ch.num_members
      })),
      nextCursor: result.nextCursor
    });

  } catch (error) {
    // Error listing channels - silent fail
    res.status(500).json({
      success: false,
      error: 'Failed to list channels'
    });
  }
};

/**
 * Send test message
 * POST /api/channels/slack/:id/send-test
 */
exports.sendTestMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { slackChannelId, message } = req.body;
    const organizationId = req.user.organizationId;

    if (!slackChannelId || !message) {
      return res.status(400).json({
        success: false,
        error: 'Channel ID and message are required'
      });
    }

    const channel = await SlackChannel.findById(id);
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Workspace not found'
      });
    }

    if (channel.organizationId !== organizationId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }

    const result = await slackService.sendMessage(
      channel.teamId,
      channel.botToken,
      slackChannelId,
      message,
      [slackService.buildTextBlock(message)]
    );

    res.json({
      success: true,
      data: {
        channel: result.channel,
        ts: result.ts,
        message: result.message
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
