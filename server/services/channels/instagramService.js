/**
 * Instagram Messaging API Service
 * High-level service wrapper for Instagram DM operations
 */

const InstagramProvider = require('../../channels/providers/InstagramProvider');
const db = require('../../db');
const log = require('../../utils/logger');

class InstagramService {
  constructor() {
    this.provider = new InstagramProvider();
    this.apiVersion = 'v18.0';
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
  }

  // ==================== CHANNEL MANAGEMENT ====================

  /**
   * Create a new Instagram channel
   */
  async createChannel(orgId, botId, credentials) {
    try {
      // Validate credentials
      const isValid = await this.provider.validateCredentials(credentials);
      if (!isValid) {
        throw new Error('Invalid Instagram credentials');
      }

      // Get account info
      const accountInfo = await this.getAccountInfo(credentials);

      // Create channel record
      const [channel] = await db('channels').insert({
        org_id: orgId,
        bot_id: botId,
        provider: 'instagram',
        name: `Instagram - ${accountInfo.username || credentials.page_id}`,
        business_account_id: credentials.instagram_account_id || credentials.page_id,
        credentials: JSON.stringify(credentials),
        settings: JSON.stringify({
          username: accountInfo.username,
          profilePic: accountInfo.profilePic,
          pageName: accountInfo.pageName
        }),
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }).returning('*');

      log.info('[Instagram] Channel created', { channelId: channel.id });
      return channel;
    } catch (error) {
      log.error('[Instagram] Failed to create channel', { error: error.message });
      throw error;
    }
  }

  /**
   * Get Instagram account information
   */
  async getAccountInfo(credentials) {
    try {
      // Get page info
      const pageResponse = await fetch(
        `${this.baseUrl}/${credentials.page_id}?fields=name,instagram_business_account&access_token=${credentials.access_token}`
      );

      if (!pageResponse.ok) {
        throw new Error('Failed to get page info');
      }

      const pageData = await pageResponse.json();
      const result = {
        pageName: pageData.name,
        pageId: pageData.id
      };

      // Get Instagram account info if available
      if (credentials.instagram_account_id || pageData.instagram_business_account?.id) {
        const igId = credentials.instagram_account_id || pageData.instagram_business_account.id;
        const igResponse = await fetch(
          `${this.baseUrl}/${igId}?fields=id,username,profile_picture_url&access_token=${credentials.access_token}`
        );

        if (igResponse.ok) {
          const igData = await igResponse.json();
          result.username = igData.username;
          result.profilePic = igData.profile_picture_url;
          result.instagramId = igData.id;
        }
      }

      return result;
    } catch (error) {
      log.error('[Instagram] Failed to get account info', { error: error.message });
      return {};
    }
  }

  /**
   * Update channel settings
   */
  async updateChannel(channelId, updates) {
    try {
      const [channel] = await db('channels')
        .where({ id: channelId, provider: 'instagram' })
        .update({
          ...updates,
          updated_at: new Date()
        })
        .returning('*');

      return channel;
    } catch (error) {
      log.error('[Instagram] Failed to update channel', { error: error.message });
      throw error;
    }
  }

  /**
   * Delete/disconnect channel
   */
  async deleteChannel(channelId) {
    try {
      await db('channels')
        .where({ id: channelId, provider: 'instagram' })
        .delete();

      log.info('[Instagram] Channel deleted', { channelId });
      return true;
    } catch (error) {
      log.error('[Instagram] Failed to delete channel', { error: error.message });
      throw error;
    }
  }

  /**
   * Get channel by ID
   */
  async getChannel(channelId) {
    return db('channels')
      .where({ id: channelId, provider: 'instagram' })
      .first();
  }

  /**
   * Get all Instagram channels for organization
   */
  async getChannels(orgId) {
    return db('channels')
      .where({ org_id: orgId, provider: 'instagram' })
      .orderBy('created_at', 'desc');
  }

  // ==================== MESSAGE SENDING ====================

  /**
   * Send text message
   */
  async sendText(channelId, to, text, options = {}) {
    const channel = await this.getChannel(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const credentials = JSON.parse(channel.credentials || '{}');
    const result = await this.provider.sendTextMessage(
      { credentials },
      to,
      text,
      options
    );

    // Store outbound message
    await this.storeOutboundMessage(channel, to, 'text', text, result);

    return result;
  }

  /**
   * Send image
   */
  async sendImage(channelId, to, imageUrl, options = {}) {
    const channel = await this.getChannel(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const credentials = JSON.parse(channel.credentials || '{}');
    const result = await this.provider.sendMediaMessage(
      { credentials },
      to,
      'image',
      imageUrl,
      options
    );

    await this.storeOutboundMessage(channel, to, 'image', '', result, imageUrl);

    return result;
  }

  /**
   * Send video
   */
  async sendVideo(channelId, to, videoUrl, options = {}) {
    const channel = await this.getChannel(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const credentials = JSON.parse(channel.credentials || '{}');
    const result = await this.provider.sendMediaMessage(
      { credentials },
      to,
      'video',
      videoUrl,
      options
    );

    await this.storeOutboundMessage(channel, to, 'video', '', result, videoUrl);

    return result;
  }

  /**
   * Send audio
   */
  async sendAudio(channelId, to, audioUrl, options = {}) {
    const channel = await this.getChannel(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const credentials = JSON.parse(channel.credentials || '{}');
    const result = await this.provider.sendMediaMessage(
      { credentials },
      to,
      'audio',
      audioUrl,
      options
    );

    await this.storeOutboundMessage(channel, to, 'audio', '', result, audioUrl);

    return result;
  }

  /**
   * Send message with quick replies
   */
  async sendQuickReplies(channelId, to, text, quickReplies) {
    const channel = await this.getChannel(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const credentials = JSON.parse(channel.credentials || '{}');
    const result = await this.provider.sendTextMessage(
      { credentials },
      to,
      text,
      { quickReplies }
    );

    await this.storeOutboundMessage(channel, to, 'quick_reply', text, result);

    return result;
  }

  /**
   * Send button template
   */
  async sendButtons(channelId, to, text, buttons) {
    const channel = await this.getChannel(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const credentials = JSON.parse(channel.credentials || '{}');
    const result = await this.provider.sendButtonTemplate(
      { credentials },
      to,
      text,
      buttons
    );

    await this.storeOutboundMessage(channel, to, 'buttons', text, result);

    return result;
  }

  /**
   * Send generic template (carousel)
   */
  async sendCarousel(channelId, to, elements) {
    const channel = await this.getChannel(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const credentials = JSON.parse(channel.credentials || '{}');
    const result = await this.provider.sendGenericTemplate(
      { credentials },
      to,
      elements
    );

    await this.storeOutboundMessage(channel, to, 'carousel', JSON.stringify(elements), result);

    return result;
  }

  /**
   * Send story reply
   */
  async sendStoryReply(channelId, to, text, storyId) {
    const channel = await this.getChannel(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const credentials = JSON.parse(channel.credentials || '{}');
    const result = await this.provider.sendStoryReply(
      { credentials },
      to,
      text,
      { storyId }
    );

    await this.storeOutboundMessage(channel, to, 'story_reply', text, result);

    return result;
  }

  /**
   * Send reaction
   */
  async sendReaction(channelId, to, messageId, reaction) {
    const channel = await this.getChannel(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const credentials = JSON.parse(channel.credentials || '{}');
    return this.provider.sendReaction({ credentials }, to, messageId, reaction);
  }

  /**
   * Send typing indicator
   */
  async sendTyping(channelId, to, typing = true) {
    const channel = await this.getChannel(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const credentials = JSON.parse(channel.credentials || '{}');
    return this.provider.sendTypingIndicator({ credentials }, to, typing);
  }

  // ==================== PROFILE & SETTINGS ====================

  /**
   * Get user profile
   */
  async getUserProfile(channelId, userId) {
    const channel = await this.getChannel(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const credentials = JSON.parse(channel.credentials || '{}');
    return this.provider.getUserProfile({ credentials }, userId);
  }

  /**
   * Set ice breakers
   */
  async setIceBreakers(channelId, iceBreakers) {
    const channel = await this.getChannel(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const credentials = JSON.parse(channel.credentials || '{}');
    return this.provider.setIceBreakers({ credentials }, iceBreakers);
  }

  /**
   * Set persistent menu
   */
  async setPersistentMenu(channelId, menuItems) {
    const channel = await this.getChannel(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const credentials = JSON.parse(channel.credentials || '{}');
    return this.provider.setPersistentMenu({ credentials }, menuItems);
  }

  // ==================== ANALYTICS ====================

  /**
   * Get channel statistics
   */
  async getStats(channelId) {
    const channel = await this.getChannel(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [messageStats] = await db('channel_messages')
      .where({ channel_id: channelId })
      .select(
        db.raw('COUNT(*) as total_messages'),
        db.raw("COUNT(*) FILTER (WHERE direction = 'inbound') as inbound"),
        db.raw("COUNT(*) FILTER (WHERE direction = 'outbound') as outbound"),
        db.raw("COUNT(*) FILTER (WHERE status = 'delivered') as delivered"),
        db.raw("COUNT(*) FILTER (WHERE status = 'read') as read"),
        db.raw("COUNT(*) FILTER (WHERE status = 'failed') as failed"),
        db.raw("COUNT(*) FILTER (WHERE created_at >= ?) as today", [today])
      );

    const uniqueContacts = await db('channel_messages')
      .where({ channel_id: channelId, direction: 'inbound' })
      .countDistinct('sender_id as count');

    // Message type breakdown
    const messageTypes = await db('channel_messages')
      .where({ channel_id: channelId })
      .select('message_type')
      .count('* as count')
      .groupBy('message_type');

    return {
      channelId,
      totalMessages: parseInt(messageStats.total_messages) || 0,
      inbound: parseInt(messageStats.inbound) || 0,
      outbound: parseInt(messageStats.outbound) || 0,
      delivered: parseInt(messageStats.delivered) || 0,
      read: parseInt(messageStats.read) || 0,
      failed: parseInt(messageStats.failed) || 0,
      todayMessages: parseInt(messageStats.today) || 0,
      uniqueContacts: parseInt(uniqueContacts[0]?.count) || 0,
      messageTypes: messageTypes.reduce((acc, mt) => {
        acc[mt.message_type] = parseInt(mt.count);
        return acc;
      }, {})
    };
  }

  /**
   * Get organization-wide Instagram stats
   */
  async getOrgStats(orgId) {
    const channels = await this.getChannels(orgId);

    let totalMessages = 0;
    let totalContacts = 0;

    for (const channel of channels) {
      const stats = await this.getStats(channel.id);
      totalMessages += stats.totalMessages;
      totalContacts += stats.uniqueContacts;
    }

    return {
      totalChannels: channels.length,
      activeChannels: channels.filter(c => c.is_active).length,
      totalMessages,
      totalContacts
    };
  }

  // ==================== CONVERSATIONS ====================

  /**
   * Get conversations for a channel
   */
  async getConversations(channelId, options = {}) {
    const { limit = 50, offset = 0 } = options;

    // Get unique conversations with latest message
    const conversations = await db('channel_messages')
      .where({ channel_id: channelId, direction: 'inbound' })
      .select('sender_id', 'sender_name')
      .max('created_at as last_message_at')
      .groupBy('sender_id', 'sender_name')
      .orderBy('last_message_at', 'desc')
      .limit(limit)
      .offset(offset);

    // Get unread counts and last message preview
    for (const conv of conversations) {
      const [unreadCount] = await db('channel_messages')
        .where({
          channel_id: channelId,
          sender_id: conv.sender_id,
          direction: 'inbound'
        })
        .whereNull('read_at')
        .count('* as count');

      conv.unreadCount = parseInt(unreadCount.count) || 0;

      // Get last message preview
      const lastMessage = await db('channel_messages')
        .where({
          channel_id: channelId,
          sender_id: conv.sender_id
        })
        .orderBy('created_at', 'desc')
        .first();

      conv.lastMessage = lastMessage?.content?.substring(0, 100) || '';
      conv.lastMessageType = lastMessage?.message_type;
    }

    return conversations;
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(channelId, contactId, options = {}) {
    const { limit = 50, before } = options;

    let query = db('channel_messages')
      .where({ channel_id: channelId })
      .where(function() {
        this.where({ sender_id: contactId })
            .orWhere({ recipient_id: contactId });
      })
      .orderBy('created_at', 'desc')
      .limit(limit);

    if (before) {
      query = query.where('created_at', '<', before);
    }

    const messages = await query;
    return messages.reverse();
  }

  // ==================== HELPERS ====================

  /**
   * Store outbound message
   */
  async storeOutboundMessage(channel, to, type, content, result, mediaUrl = null) {
    try {
      await db('channel_messages').insert({
        channel_id: channel.id,
        external_id: result.messageId,
        direction: 'outbound',
        sender_id: 'bot',
        recipient_id: to,
        content,
        message_type: type,
        media_url: mediaUrl,
        status: 'sent',
        sent_at: new Date(),
        created_at: new Date()
      });
    } catch (error) {
      log.error('[Instagram] Failed to store outbound message', { error: error.message });
    }
  }

  /**
   * Test channel connection
   */
  async testConnection(credentials) {
    try {
      const isValid = await this.provider.validateCredentials(credentials);
      if (!isValid) {
        return { success: false, error: 'Invalid credentials' };
      }

      const accountInfo = await this.getAccountInfo(credentials);

      return {
        success: true,
        username: accountInfo.username,
        profilePic: accountInfo.profilePic,
        pageName: accountInfo.pageName
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get provider capabilities
   */
  getCapabilities() {
    return this.provider.getCapabilities();
  }
}

// Export singleton instance
module.exports = new InstagramService();
