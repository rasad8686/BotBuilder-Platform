/**
 * Slack API Integration Service
 * Full-featured Slack channel integration for BotBuilder
 */

const { WebClient } = require('@slack/web-api');
const crypto = require('crypto');

class SlackService {
  constructor() {
    this.clients = new Map(); // Store WebClient instances by team_id
  }

  /**
   * Initialize a Slack WebClient instance
   * @param {string} teamId - Slack team/workspace ID
   * @param {string} botToken - Bot OAuth token
   * @returns {WebClient} Slack WebClient instance
   */
  initClient(teamId, botToken) {
    const client = new WebClient(botToken);
    this.clients.set(teamId, client);
    return client;
  }

  /**
   * Get or create WebClient instance
   * @param {string} teamId - Slack team ID
   * @param {string} botToken - Bot token (required if not cached)
   * @returns {WebClient} Slack WebClient instance
   */
  getClient(teamId, botToken) {
    if (!this.clients.has(teamId) && botToken) {
      return this.initClient(teamId, botToken);
    }
    return this.clients.get(teamId);
  }

  /**
   * Remove client instance
   * @param {string} teamId - Slack team ID
   */
  removeClient(teamId) {
    this.clients.delete(teamId);
  }

  // ==================== MESSAGE SENDING ====================

  /**
   * Send message to a channel
   * @param {string} teamId - Slack team ID
   * @param {string} botToken - Bot token
   * @param {string} channelId - Channel ID
   * @param {string} text - Message text
   * @param {Array} blocks - Block Kit blocks (optional)
   * @param {Object} options - Additional options
   */
  async sendMessage(teamId, botToken, channelId, text, blocks = null, options = {}) {
    const client = this.getClient(teamId, botToken);

    const messageParams = {
      channel: channelId,
      text: text,
      ...options
    };

    if (blocks) {
      messageParams.blocks = blocks;
    }

    if (options.threadTs) {
      messageParams.thread_ts = options.threadTs;
    }

    if (options.attachments) {
      messageParams.attachments = options.attachments;
    }

    if (options.unfurlLinks !== undefined) {
      messageParams.unfurl_links = options.unfurlLinks;
    }

    if (options.unfurlMedia !== undefined) {
      messageParams.unfurl_media = options.unfurlMedia;
    }

    return await client.chat.postMessage(messageParams);
  }

  /**
   * Send direct message to a user
   * @param {string} teamId - Slack team ID
   * @param {string} botToken - Bot token
   * @param {string} userId - User ID
   * @param {string} text - Message text
   * @param {Array} blocks - Block Kit blocks (optional)
   * @param {Object} options - Additional options
   */
  async sendDirectMessage(teamId, botToken, userId, text, blocks = null, options = {}) {
    const client = this.getClient(teamId, botToken);

    // Open DM channel
    const dmResponse = await client.conversations.open({
      users: userId
    });

    const channelId = dmResponse.channel.id;

    // Send message to DM channel
    return await this.sendMessage(teamId, botToken, channelId, text, blocks, options);
  }

  /**
   * Update an existing message
   * @param {string} teamId - Slack team ID
   * @param {string} botToken - Bot token
   * @param {string} channelId - Channel ID
   * @param {string} ts - Message timestamp
   * @param {string} text - New text
   * @param {Array} blocks - New blocks (optional)
   */
  async updateMessage(teamId, botToken, channelId, ts, text, blocks = null) {
    const client = this.getClient(teamId, botToken);

    const updateParams = {
      channel: channelId,
      ts: ts,
      text: text
    };

    if (blocks) {
      updateParams.blocks = blocks;
    }

    return await client.chat.update(updateParams);
  }

  /**
   * Delete a message
   * @param {string} teamId - Slack team ID
   * @param {string} botToken - Bot token
   * @param {string} channelId - Channel ID
   * @param {string} ts - Message timestamp
   */
  async deleteMessage(teamId, botToken, channelId, ts) {
    const client = this.getClient(teamId, botToken);

    return await client.chat.delete({
      channel: channelId,
      ts: ts
    });
  }

  /**
   * Upload a file
   * @param {string} teamId - Slack team ID
   * @param {string} botToken - Bot token
   * @param {Object} options - Upload options
   */
  async uploadFile(teamId, botToken, options) {
    const client = this.getClient(teamId, botToken);

    return await client.files.uploadV2({
      channels: options.channels,
      content: options.content,
      file: options.file,
      filename: options.filename,
      filetype: options.filetype,
      initial_comment: options.initialComment,
      title: options.title,
      thread_ts: options.threadTs
    });
  }

  /**
   * Send ephemeral message (only visible to one user)
   * @param {string} teamId - Slack team ID
   * @param {string} botToken - Bot token
   * @param {string} channelId - Channel ID
   * @param {string} userId - User ID to show message to
   * @param {string} text - Message text
   * @param {Array} blocks - Block Kit blocks (optional)
   */
  async sendEphemeral(teamId, botToken, channelId, userId, text, blocks = null) {
    const client = this.getClient(teamId, botToken);

    const params = {
      channel: channelId,
      user: userId,
      text: text
    };

    if (blocks) {
      params.blocks = blocks;
    }

    return await client.chat.postEphemeral(params);
  }

  // ==================== SLASH COMMAND HANDLING ====================

  /**
   * Handle incoming slash command
   * @param {Object} payload - Slash command payload from Slack
   * @returns {Object} Parsed command data
   */
  handleSlashCommand(payload) {
    return {
      command: payload.command,
      text: payload.text,
      responseUrl: payload.response_url,
      triggerId: payload.trigger_id,
      userId: payload.user_id,
      userName: payload.user_name,
      channelId: payload.channel_id,
      channelName: payload.channel_name,
      teamId: payload.team_id,
      teamDomain: payload.team_domain,
      apiAppId: payload.api_app_id
    };
  }

  /**
   * Respond to slash command
   * @param {string} responseUrl - Response URL from command
   * @param {Object} response - Response object
   */
  async respondToCommand(responseUrl, response) {
    const axios = require('axios');

    return await axios.post(responseUrl, {
      response_type: response.responseType || 'ephemeral', // 'ephemeral' or 'in_channel'
      text: response.text,
      blocks: response.blocks,
      attachments: response.attachments
    });
  }

  // ==================== INTERACTIVE MESSAGE HANDLING ====================

  /**
   * Handle interactive message payload
   * @param {Object} payload - Interactive message payload
   * @returns {Object} Parsed interaction data
   */
  handleInteractiveMessage(payload) {
    const baseData = {
      type: payload.type,
      teamId: payload.team?.id,
      teamDomain: payload.team?.domain,
      userId: payload.user?.id,
      userName: payload.user?.name,
      channelId: payload.channel?.id,
      channelName: payload.channel?.name,
      triggerId: payload.trigger_id,
      responseUrl: payload.response_url,
      apiAppId: payload.api_app_id
    };

    switch (payload.type) {
      case 'block_actions':
        return {
          ...baseData,
          actions: payload.actions.map(action => ({
            actionId: action.action_id,
            blockId: action.block_id,
            type: action.type,
            value: action.value || action.selected_option?.value,
            text: action.text?.text
          })),
          message: payload.message,
          container: payload.container
        };

      case 'view_submission':
        return {
          ...baseData,
          view: payload.view,
          values: this.parseViewValues(payload.view?.state?.values)
        };

      case 'view_closed':
        return {
          ...baseData,
          view: payload.view,
          isCleared: payload.is_cleared
        };

      case 'shortcut':
      case 'message_action':
        return {
          ...baseData,
          callbackId: payload.callback_id,
          message: payload.message
        };

      default:
        return baseData;
    }
  }

  /**
   * Parse view submission values
   * @param {Object} values - View state values
   * @returns {Object} Parsed values
   */
  parseViewValues(values) {
    if (!values) return {};

    const parsed = {};
    for (const blockId in values) {
      for (const actionId in values[blockId]) {
        const action = values[blockId][actionId];
        parsed[actionId] = action.value ||
          action.selected_option?.value ||
          action.selected_options?.map(o => o.value) ||
          action.selected_date ||
          action.selected_time ||
          action.selected_users ||
          action.selected_channels ||
          action.selected_conversations;
      }
    }
    return parsed;
  }

  /**
   * Acknowledge interactive action
   * @param {string} responseUrl - Response URL
   * @param {Object} update - Update to send
   */
  async acknowledgeAction(responseUrl, update = null) {
    if (!update) return; // Empty acknowledgment

    const axios = require('axios');
    return await axios.post(responseUrl, update);
  }

  // ==================== EVENT CALLBACK HANDLING ====================

  /**
   * Handle event callback
   * @param {Object} payload - Event payload
   * @returns {Object} Parsed event data
   */
  handleEventCallback(payload) {
    // URL verification challenge
    if (payload.type === 'url_verification') {
      return {
        type: 'url_verification',
        challenge: payload.challenge
      };
    }

    if (payload.type !== 'event_callback') {
      return { type: payload.type, raw: payload };
    }

    const event = payload.event;

    const baseData = {
      type: event.type,
      teamId: payload.team_id,
      apiAppId: payload.api_app_id,
      eventId: payload.event_id,
      eventTime: new Date(payload.event_time * 1000)
    };

    switch (event.type) {
      case 'message':
        return {
          ...baseData,
          subtype: event.subtype,
          channelId: event.channel,
          channelType: event.channel_type,
          userId: event.user,
          text: event.text,
          ts: event.ts,
          threadTs: event.thread_ts,
          botId: event.bot_id,
          files: event.files,
          attachments: event.attachments
        };

      case 'app_mention':
        return {
          ...baseData,
          channelId: event.channel,
          userId: event.user,
          text: event.text,
          ts: event.ts,
          threadTs: event.thread_ts
        };

      case 'app_home_opened':
        return {
          ...baseData,
          userId: event.user,
          channelId: event.channel,
          tab: event.tab,
          view: event.view
        };

      case 'member_joined_channel':
      case 'member_left_channel':
        return {
          ...baseData,
          userId: event.user,
          channelId: event.channel,
          channelType: event.channel_type,
          inviter: event.inviter
        };

      case 'reaction_added':
      case 'reaction_removed':
        return {
          ...baseData,
          userId: event.user,
          reaction: event.reaction,
          itemUser: event.item_user,
          item: event.item
        };

      default:
        return { ...baseData, raw: event };
    }
  }

  // ==================== OAUTH FLOW ====================

  /**
   * Generate OAuth authorization URL
   * @param {Object} config - OAuth configuration
   * @returns {string} Authorization URL
   */
  generateOAuthUrl(config) {
    const baseUrl = 'https://slack.com/oauth/v2/authorize';
    const params = new URLSearchParams({
      client_id: config.clientId,
      scope: config.scopes.join(','),
      redirect_uri: config.redirectUri,
      state: config.state || crypto.randomBytes(16).toString('hex')
    });

    if (config.userScopes) {
      params.append('user_scope', config.userScopes.join(','));
    }

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Exchange OAuth code for tokens
   * @param {string} code - Authorization code
   * @param {Object} config - OAuth configuration
   * @returns {Object} Token response
   */
  async exchangeOAuthCode(code, config) {
    const client = new WebClient();

    const response = await client.oauth.v2.access({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: code,
      redirect_uri: config.redirectUri
    });

    return {
      ok: response.ok,
      accessToken: response.access_token,
      tokenType: response.token_type,
      scope: response.scope,
      botUserId: response.bot_user_id,
      appId: response.app_id,
      team: {
        id: response.team?.id,
        name: response.team?.name
      },
      enterprise: response.enterprise,
      authedUser: {
        id: response.authed_user?.id,
        scope: response.authed_user?.scope,
        accessToken: response.authed_user?.access_token,
        tokenType: response.authed_user?.token_type
      },
      incomingWebhook: response.incoming_webhook
    };
  }

  /**
   * Revoke OAuth token
   * @param {string} token - Token to revoke
   */
  async revokeToken(token) {
    const client = new WebClient(token);
    return await client.auth.revoke();
  }

  // ==================== SIGNATURE VERIFICATION ====================

  /**
   * Verify Slack request signature
   * @param {string} signingSecret - App signing secret
   * @param {string} signature - x-slack-signature header
   * @param {string} timestamp - x-slack-request-timestamp header
   * @param {string} body - Raw request body
   * @returns {boolean} Is signature valid
   */
  verifySignature(signingSecret, signature, timestamp, body) {
    // Check timestamp to prevent replay attacks (5 minutes)
    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - parseInt(timestamp)) > 300) {
      return false;
    }

    const sigBaseString = `v0:${timestamp}:${body}`;
    const mySignature = 'v0=' + crypto
      .createHmac('sha256', signingSecret)
      .update(sigBaseString)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(mySignature),
      Buffer.from(signature)
    );
  }

  // ==================== WORKSPACE & CHANNEL INFO ====================

  /**
   * Get workspace/team info
   * @param {string} teamId - Slack team ID
   * @param {string} botToken - Bot token
   */
  async getTeamInfo(teamId, botToken) {
    const client = this.getClient(teamId, botToken);
    const response = await client.team.info();
    return response.team;
  }

  /**
   * Get bot info
   * @param {string} teamId - Slack team ID
   * @param {string} botToken - Bot token
   */
  async getBotInfo(teamId, botToken) {
    const client = this.getClient(teamId, botToken);
    const response = await client.auth.test();
    return {
      ok: response.ok,
      url: response.url,
      team: response.team,
      teamId: response.team_id,
      user: response.user,
      userId: response.user_id,
      botId: response.bot_id,
      isEnterpriseInstall: response.is_enterprise_install
    };
  }

  /**
   * List channels
   * @param {string} teamId - Slack team ID
   * @param {string} botToken - Bot token
   * @param {Object} options - List options
   */
  async listChannels(teamId, botToken, options = {}) {
    const client = this.getClient(teamId, botToken);

    const response = await client.conversations.list({
      types: options.types || 'public_channel,private_channel',
      exclude_archived: options.excludeArchived !== false,
      limit: options.limit || 100,
      cursor: options.cursor
    });

    return {
      channels: response.channels,
      nextCursor: response.response_metadata?.next_cursor
    };
  }

  /**
   * Get channel info
   * @param {string} teamId - Slack team ID
   * @param {string} botToken - Bot token
   * @param {string} channelId - Channel ID
   */
  async getChannelInfo(teamId, botToken, channelId) {
    const client = this.getClient(teamId, botToken);
    const response = await client.conversations.info({
      channel: channelId
    });
    return response.channel;
  }

  /**
   * Get user info
   * @param {string} teamId - Slack team ID
   * @param {string} botToken - Bot token
   * @param {string} userId - User ID
   */
  async getUserInfo(teamId, botToken, userId) {
    const client = this.getClient(teamId, botToken);
    const response = await client.users.info({
      user: userId
    });
    return response.user;
  }

  /**
   * Test connection
   * @param {string} teamId - Slack team ID
   * @param {string} botToken - Bot token
   */
  async testConnection(teamId, botToken) {
    try {
      const botInfo = await this.getBotInfo(teamId, botToken);
      const teamInfo = await this.getTeamInfo(teamId, botToken);

      return {
        success: true,
        bot: botInfo,
        team: teamInfo
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ==================== BLOCK KIT BUILDERS ====================

  /**
   * Build a simple text block
   * @param {string} text - Text content
   * @param {string} type - Text type (mrkdwn or plain_text)
   */
  buildTextBlock(text, type = 'mrkdwn') {
    return {
      type: 'section',
      text: {
        type: type,
        text: text
      }
    };
  }

  /**
   * Build button block
   * @param {Array} buttons - Button configurations
   */
  buildButtonBlock(buttons) {
    return {
      type: 'actions',
      elements: buttons.map(btn => ({
        type: 'button',
        text: {
          type: 'plain_text',
          text: btn.text,
          emoji: btn.emoji !== false
        },
        action_id: btn.actionId,
        value: btn.value,
        style: btn.style, // 'primary' or 'danger'
        url: btn.url,
        confirm: btn.confirm ? {
          title: { type: 'plain_text', text: btn.confirm.title },
          text: { type: 'mrkdwn', text: btn.confirm.text },
          confirm: { type: 'plain_text', text: btn.confirm.confirmText || 'Confirm' },
          deny: { type: 'plain_text', text: btn.confirm.denyText || 'Cancel' }
        } : undefined
      }))
    };
  }

  /**
   * Build divider block
   */
  buildDivider() {
    return { type: 'divider' };
  }

  /**
   * Build header block
   * @param {string} text - Header text
   */
  buildHeader(text) {
    return {
      type: 'header',
      text: {
        type: 'plain_text',
        text: text,
        emoji: true
      }
    };
  }

  /**
   * Build image block
   * @param {string} imageUrl - Image URL
   * @param {string} altText - Alt text
   * @param {string} title - Optional title
   */
  buildImageBlock(imageUrl, altText, title = null) {
    const block = {
      type: 'image',
      image_url: imageUrl,
      alt_text: altText
    };

    if (title) {
      block.title = {
        type: 'plain_text',
        text: title,
        emoji: true
      };
    }

    return block;
  }

  /**
   * Build context block
   * @param {Array} elements - Context elements (text or image)
   */
  buildContextBlock(elements) {
    return {
      type: 'context',
      elements: elements.map(el => {
        if (el.type === 'image') {
          return {
            type: 'image',
            image_url: el.url,
            alt_text: el.alt
          };
        }
        return {
          type: el.type || 'mrkdwn',
          text: el.text
        };
      })
    };
  }

  /**
   * Build input block
   * @param {Object} config - Input configuration
   */
  buildInputBlock(config) {
    const block = {
      type: 'input',
      block_id: config.blockId,
      label: {
        type: 'plain_text',
        text: config.label,
        emoji: true
      },
      optional: config.optional || false
    };

    switch (config.inputType) {
      case 'text':
        block.element = {
          type: 'plain_text_input',
          action_id: config.actionId,
          placeholder: config.placeholder ? {
            type: 'plain_text',
            text: config.placeholder
          } : undefined,
          multiline: config.multiline || false,
          initial_value: config.initialValue
        };
        break;

      case 'select':
        block.element = {
          type: 'static_select',
          action_id: config.actionId,
          placeholder: config.placeholder ? {
            type: 'plain_text',
            text: config.placeholder
          } : undefined,
          options: config.options.map(opt => ({
            text: { type: 'plain_text', text: opt.text },
            value: opt.value
          })),
          initial_option: config.initialOption ? {
            text: { type: 'plain_text', text: config.initialOption.text },
            value: config.initialOption.value
          } : undefined
        };
        break;

      case 'multi_select':
        block.element = {
          type: 'multi_static_select',
          action_id: config.actionId,
          placeholder: config.placeholder ? {
            type: 'plain_text',
            text: config.placeholder
          } : undefined,
          options: config.options.map(opt => ({
            text: { type: 'plain_text', text: opt.text },
            value: opt.value
          }))
        };
        break;

      case 'datepicker':
        block.element = {
          type: 'datepicker',
          action_id: config.actionId,
          placeholder: config.placeholder ? {
            type: 'plain_text',
            text: config.placeholder
          } : undefined,
          initial_date: config.initialDate
        };
        break;

      case 'users_select':
        block.element = {
          type: 'users_select',
          action_id: config.actionId,
          placeholder: config.placeholder ? {
            type: 'plain_text',
            text: config.placeholder
          } : undefined
        };
        break;

      case 'channels_select':
        block.element = {
          type: 'channels_select',
          action_id: config.actionId,
          placeholder: config.placeholder ? {
            type: 'plain_text',
            text: config.placeholder
          } : undefined
        };
        break;
    }

    return block;
  }
}

// Export singleton instance
module.exports = new SlackService();
