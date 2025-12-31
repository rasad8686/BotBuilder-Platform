/**
 * WhatsApp Business API Service
 * High-level service wrapper for WhatsApp Cloud API operations
 */

const WhatsAppProvider = require('../../channels/providers/WhatsAppProvider');
const db = require('../../db');
const log = require('../../utils/logger');

class WhatsAppService {
  constructor() {
    this.provider = new WhatsAppProvider();
    this.apiVersion = 'v18.0';
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
  }

  // ==================== CHANNEL MANAGEMENT ====================

  /**
   * Create a new WhatsApp channel
   */
  async createChannel(orgId, botId, credentials) {
    try {
      // Validate credentials
      const isValid = await this.provider.validateCredentials(credentials);
      if (!isValid) {
        throw new Error('Invalid WhatsApp credentials');
      }

      // Get phone number details
      const phoneInfo = await this.getPhoneNumberInfo(credentials);

      // Create channel record
      const [channel] = await db('channels').insert({
        org_id: orgId,
        bot_id: botId,
        provider: 'whatsapp',
        name: `WhatsApp - ${phoneInfo.display_phone_number || credentials.phone_number_id}`,
        business_account_id: credentials.phone_number_id,
        credentials: JSON.stringify(credentials),
        settings: JSON.stringify({
          display_phone_number: phoneInfo.display_phone_number,
          verified_name: phoneInfo.verified_name,
          quality_rating: phoneInfo.quality_rating
        }),
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }).returning('*');

      log.info('[WhatsApp] Channel created', { channelId: channel.id });
      return channel;
    } catch (error) {
      log.error('[WhatsApp] Failed to create channel', { error: error.message });
      throw error;
    }
  }

  /**
   * Get phone number information
   */
  async getPhoneNumberInfo(credentials) {
    try {
      const response = await fetch(
        `${this.baseUrl}/${credentials.phone_number_id}`,
        {
          headers: {
            'Authorization': `Bearer ${credentials.access_token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get phone number info');
      }

      return await response.json();
    } catch (error) {
      log.error('[WhatsApp] Failed to get phone info', { error: error.message });
      return {};
    }
  }

  /**
   * Update channel settings
   */
  async updateChannel(channelId, updates) {
    try {
      const [channel] = await db('channels')
        .where({ id: channelId, provider: 'whatsapp' })
        .update({
          ...updates,
          updated_at: new Date()
        })
        .returning('*');

      return channel;
    } catch (error) {
      log.error('[WhatsApp] Failed to update channel', { error: error.message });
      throw error;
    }
  }

  /**
   * Delete/disconnect channel
   */
  async deleteChannel(channelId) {
    try {
      await db('channels')
        .where({ id: channelId, provider: 'whatsapp' })
        .delete();

      log.info('[WhatsApp] Channel deleted', { channelId });
      return true;
    } catch (error) {
      log.error('[WhatsApp] Failed to delete channel', { error: error.message });
      throw error;
    }
  }

  /**
   * Get channel by ID
   */
  async getChannel(channelId) {
    return db('channels')
      .where({ id: channelId, provider: 'whatsapp' })
      .first();
  }

  /**
   * Get all WhatsApp channels for organization
   */
  async getChannels(orgId) {
    return db('channels')
      .where({ org_id: orgId, provider: 'whatsapp' })
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

    await this.storeOutboundMessage(channel, to, 'image', options.caption || '', result, imageUrl);

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

    await this.storeOutboundMessage(channel, to, 'video', options.caption || '', result, videoUrl);

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
   * Send document
   */
  async sendDocument(channelId, to, documentUrl, options = {}) {
    const channel = await this.getChannel(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const credentials = JSON.parse(channel.credentials || '{}');
    const result = await this.provider.sendMediaMessage(
      { credentials },
      to,
      'document',
      documentUrl,
      options
    );

    await this.storeOutboundMessage(channel, to, 'document', options.caption || '', result, documentUrl);

    return result;
  }

  /**
   * Send template message
   */
  async sendTemplate(channelId, to, templateName, language = 'en', components = []) {
    const channel = await this.getChannel(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const credentials = JSON.parse(channel.credentials || '{}');
    const result = await this.provider.sendTemplate(
      { credentials },
      to,
      templateName,
      language,
      components
    );

    await this.storeOutboundMessage(channel, to, 'template', templateName, result);

    return result;
  }

  /**
   * Send interactive message (buttons/list)
   */
  async sendInteractive(channelId, to, interactiveType, body, action, options = {}) {
    const channel = await this.getChannel(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const credentials = JSON.parse(channel.credentials || '{}');
    const result = await this.provider.sendInteractiveMessage(
      { credentials },
      to,
      {
        interactiveType,
        body,
        action,
        header: options.header,
        footer: options.footer
      }
    );

    await this.storeOutboundMessage(channel, to, 'interactive', body, result);

    return result;
  }

  /**
   * Send location
   */
  async sendLocation(channelId, to, latitude, longitude, options = {}) {
    const channel = await this.getChannel(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const credentials = JSON.parse(channel.credentials || '{}');
    const result = await this.provider.sendLocationMessage(
      { credentials },
      to,
      { latitude, longitude, name: options.name, address: options.address }
    );

    await this.storeOutboundMessage(channel, to, 'location', JSON.stringify({ latitude, longitude }), result);

    return result;
  }

  /**
   * Send reaction
   */
  async sendReaction(channelId, to, messageId, emoji) {
    const channel = await this.getChannel(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const credentials = JSON.parse(channel.credentials || '{}');
    return this.provider.sendReaction({ credentials }, to, messageId, emoji);
  }

  /**
   * Mark message as read
   */
  async markAsRead(channelId, messageId) {
    const channel = await this.getChannel(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const credentials = JSON.parse(channel.credentials || '{}');
    return this.provider.markAsRead({ credentials }, messageId);
  }

  // ==================== TEMPLATES ====================

  /**
   * Get available templates
   */
  async getTemplates(channelId) {
    const channel = await this.getChannel(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const credentials = JSON.parse(channel.credentials || '{}');
    return this.provider.getTemplates({ credentials });
  }

  // ==================== MEDIA ====================

  /**
   * Upload media
   */
  async uploadMedia(channelId, media, mimeType) {
    const channel = await this.getChannel(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const credentials = JSON.parse(channel.credentials || '{}');
    return this.provider.uploadMedia({ credentials }, media, mimeType);
  }

  /**
   * Download media
   */
  async downloadMedia(channelId, mediaId) {
    const channel = await this.getChannel(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const credentials = JSON.parse(channel.credentials || '{}');
    return this.provider.downloadMedia({ credentials }, mediaId);
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

    return {
      channelId,
      totalMessages: parseInt(messageStats.total_messages) || 0,
      inbound: parseInt(messageStats.inbound) || 0,
      outbound: parseInt(messageStats.outbound) || 0,
      delivered: parseInt(messageStats.delivered) || 0,
      read: parseInt(messageStats.read) || 0,
      failed: parseInt(messageStats.failed) || 0,
      todayMessages: parseInt(messageStats.today) || 0,
      uniqueContacts: parseInt(uniqueContacts[0]?.count) || 0
    };
  }

  /**
   * Get organization-wide WhatsApp stats
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

    // Get unread counts
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
      log.error('[WhatsApp] Failed to store outbound message', { error: error.message });
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

      const phoneInfo = await this.getPhoneNumberInfo(credentials);

      return {
        success: true,
        phoneNumber: phoneInfo.display_phone_number,
        verifiedName: phoneInfo.verified_name,
        qualityRating: phoneInfo.quality_rating
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
module.exports = new WhatsAppService();
