/**
 * Slack Integration for Autonomous Agents
 * Handles Slack messaging and channel operations
 */

const log = require('../../../utils/logger');

class SlackIntegration {
  constructor(credentials = {}) {
    this.type = 'slack';
    this.name = 'Slack';
    this.accessToken = credentials.access_token;
    this.botToken = credentials.bot_token;
    this.teamId = credentials.team_id;
    this.baseUrl = 'https://slack.com/api';
  }

  /**
   * Get OAuth2 configuration
   */
  static getOAuthConfig() {
    return {
      authorizationUrl: 'https://slack.com/oauth/v2/authorize',
      tokenUrl: 'https://slack.com/api/oauth.v2.access',
      clientId: process.env.SLACK_CLIENT_ID,
      clientSecret: process.env.SLACK_CLIENT_SECRET,
      scopes: [
        'channels:read',
        'channels:history',
        'chat:write',
        'users:read',
        'groups:read',
        'im:read',
        'mpim:read'
      ],
      redirectUri: `${process.env.APP_URL}/api/integrations/slack/callback`
    };
  }

  /**
   * Exchange authorization code for tokens
   */
  static async exchangeCode(code) {
    const config = SlackIntegration.getOAuthConfig();

    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: code,
      redirect_uri: config.redirectUri
    });

    const response = await fetch(`${config.tokenUrl}?${params}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.error || 'Failed to exchange code');
    }

    return {
      access_token: data.access_token,
      bot_token: data.access_token,
      team_id: data.team?.id,
      team_name: data.team?.name,
      scope: data.scope,
      token_type: data.token_type
    };
  }

  /**
   * Make API request to Slack
   */
  async request(endpoint, method = 'GET', body = null) {
    const token = this.botToken || this.accessToken;

    if (!token) {
      throw new Error('No access token available');
    }

    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}/${endpoint}`;
    const response = await fetch(url, options);
    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.error || 'Slack API error');
    }

    return data;
  }

  /**
   * Send message to a channel
   */
  async sendMessage(channel, text, options = {}) {
    log.info('SlackIntegration: Sending message', { channel });

    const body = {
      channel,
      text,
      ...options
    };

    // Support blocks for rich formatting
    if (options.blocks) {
      body.blocks = options.blocks;
    }

    // Support attachments
    if (options.attachments) {
      body.attachments = options.attachments;
    }

    // Support thread replies
    if (options.thread_ts) {
      body.thread_ts = options.thread_ts;
    }

    const result = await this.request('chat.postMessage', 'POST', body);

    return {
      success: true,
      channel: result.channel,
      timestamp: result.ts,
      message: result.message
    };
  }

  /**
   * List channels
   */
  async listChannels(options = {}) {
    log.info('SlackIntegration: Listing channels');

    const params = new URLSearchParams({
      types: options.types || 'public_channel,private_channel',
      exclude_archived: options.excludeArchived !== false ? 'true' : 'false',
      limit: options.limit || 100
    });

    if (options.cursor) {
      params.append('cursor', options.cursor);
    }

    const result = await this.request(`conversations.list?${params}`);

    return {
      success: true,
      channels: result.channels.map(ch => ({
        id: ch.id,
        name: ch.name,
        isPrivate: ch.is_private,
        isArchived: ch.is_archived,
        memberCount: ch.num_members,
        topic: ch.topic?.value,
        purpose: ch.purpose?.value
      })),
      nextCursor: result.response_metadata?.next_cursor
    };
  }

  /**
   * Get channel history
   */
  async getChannelHistory(channel, options = {}) {
    log.info('SlackIntegration: Getting channel history', { channel });

    const params = new URLSearchParams({
      channel,
      limit: options.limit || 50
    });

    if (options.oldest) {
      params.append('oldest', options.oldest);
    }
    if (options.latest) {
      params.append('latest', options.latest);
    }

    const result = await this.request(`conversations.history?${params}`);

    return {
      success: true,
      messages: result.messages.map(msg => ({
        type: msg.type,
        user: msg.user,
        text: msg.text,
        timestamp: msg.ts,
        threadTs: msg.thread_ts,
        replyCount: msg.reply_count
      })),
      hasMore: result.has_more
    };
  }

  /**
   * List users
   */
  async listUsers(options = {}) {
    log.info('SlackIntegration: Listing users');

    const params = new URLSearchParams({
      limit: options.limit || 100
    });

    if (options.cursor) {
      params.append('cursor', options.cursor);
    }

    const result = await this.request(`users.list?${params}`);

    return {
      success: true,
      users: result.members
        .filter(u => !u.is_bot && !u.deleted)
        .map(u => ({
          id: u.id,
          name: u.name,
          realName: u.real_name,
          displayName: u.profile?.display_name,
          email: u.profile?.email,
          isAdmin: u.is_admin,
          avatar: u.profile?.image_72
        })),
      nextCursor: result.response_metadata?.next_cursor
    };
  }

  /**
   * Get user info
   */
  async getUserInfo(userId) {
    log.info('SlackIntegration: Getting user info', { userId });

    const result = await this.request(`users.info?user=${userId}`);

    return {
      success: true,
      user: {
        id: result.user.id,
        name: result.user.name,
        realName: result.user.real_name,
        email: result.user.profile?.email,
        title: result.user.profile?.title,
        isAdmin: result.user.is_admin,
        timezone: result.user.tz
      }
    };
  }

  /**
   * Create channel
   */
  async createChannel(name, isPrivate = false) {
    log.info('SlackIntegration: Creating channel', { name, isPrivate });

    const result = await this.request('conversations.create', 'POST', {
      name: name.toLowerCase().replace(/\s+/g, '-'),
      is_private: isPrivate
    });

    return {
      success: true,
      channel: {
        id: result.channel.id,
        name: result.channel.name
      }
    };
  }

  /**
   * Test connection
   */
  async testConnection() {
    try {
      const result = await this.request('auth.test');
      return {
        success: true,
        team: result.team,
        user: result.user,
        teamId: result.team_id,
        userId: result.user_id
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get available actions for this integration
   */
  static getAvailableActions() {
    return [
      {
        name: 'send_message',
        description: 'Send a message to a Slack channel',
        parameters: {
          channel: { type: 'string', required: true },
          text: { type: 'string', required: true },
          thread_ts: { type: 'string', required: false }
        }
      },
      {
        name: 'list_channels',
        description: 'List all Slack channels',
        parameters: {
          types: { type: 'string', required: false },
          limit: { type: 'number', required: false }
        }
      },
      {
        name: 'get_history',
        description: 'Get message history from a channel',
        parameters: {
          channel: { type: 'string', required: true },
          limit: { type: 'number', required: false }
        }
      },
      {
        name: 'list_users',
        description: 'List all Slack users',
        parameters: {
          limit: { type: 'number', required: false }
        }
      }
    ];
  }
}

module.exports = SlackIntegration;
