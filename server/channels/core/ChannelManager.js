/**
 * Channel Manager - Core class for managing messaging channels
 * Supports WhatsApp, Instagram, Telegram, and other messaging platforms
 */

const pool = require('../../db');
const Channel = require('../../models/Channel');
const ChannelMessage = require('../../models/ChannelMessage');
const crypto = require('crypto');
const log = require('../../utils/logger');

class ChannelManager {
  constructor() {
    this.handlers = new Map();
    this.webhookProcessors = new Map();
  }

  /**
   * Register a channel handler for a specific platform
   */
  registerHandler(type, handler) {
    this.handlers.set(type, handler);
    log.info(`Channel handler registered for: ${type}`);
  }

  /**
   * Get handler for a channel type
   */
  getHandler(type) {
    return this.handlers.get(type);
  }

  /**
   * Register a new channel for a tenant
   */
  async registerChannel(tenantId, channelData) {
    const {
      type,
      name,
      credentials,
      phone_number,
      username,
      settings
    } = channelData;

    // Generate webhook secret
    const webhookSecret = crypto.randomBytes(32).toString('hex');

    // Create channel record
    const channel = await Channel.create({
      tenant_id: tenantId,
      type,
      name,
      credentials: credentials || {},
      phone_number,
      username,
      webhook_secret: webhookSecret,
      settings: settings || {},
      status: 'pending'
    });

    // Initialize channel with platform-specific handler
    const handler = this.getHandler(type);
    if (handler && handler.initialize) {
      try {
        await handler.initialize(channel);
        await Channel.update(channel.id, { status: 'active' });
        channel.status = 'active';
      } catch (error) {
        await Channel.update(channel.id, {
          status: 'error',
          error_message: error.message
        });
        channel.status = 'error';
        channel.error_message = error.message;
      }
    }

    return channel;
  }

  /**
   * Get a channel by ID
   */
  async getChannel(channelId) {
    return Channel.findById(channelId);
  }

  /**
   * Get all channels for a tenant
   */
  async getChannelsByTenant(tenantId, type = null) {
    return Channel.findByTenant(tenantId, type);
  }

  /**
   * Send a message through a channel
   */
  async sendMessage(channelId, messageData) {
    const channel = await Channel.findById(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    if (channel.status !== 'active') {
      throw new Error(`Channel is not active: ${channel.status}`);
    }

    const {
      to,
      type: messageType = 'text',
      content,
      mediaUrl,
      caption,
      templateName,
      templateVariables,
      replyToId,
      metadata
    } = messageData;

    // Create outbound message record
    const message = await ChannelMessage.create({
      channel_id: channelId,
      direction: 'outbound',
      to_number: to,
      from_number: channel.phone_number || channel.username,
      message_type: messageType,
      content,
      media_url: mediaUrl,
      caption,
      reply_to_id: replyToId,
      metadata: metadata || {},
      status: 'pending'
    });

    // Send via platform handler
    const handler = this.getHandler(channel.type);
    if (!handler) {
      await ChannelMessage.updateStatus(message.id, 'failed', 'No handler for channel type');
      throw new Error(`No handler registered for channel type: ${channel.type}`);
    }

    try {
      const result = await handler.sendMessage(channel, {
        ...messageData,
        messageId: message.id
      });

      // Update message with external ID and status
      await ChannelMessage.updateStatus(message.id, 'sent', null, {
        external_id: result.messageId,
        sent_at: new Date()
      });

      return {
        success: true,
        messageId: message.id,
        externalId: result.messageId
      };

    } catch (error) {
      await ChannelMessage.updateStatus(message.id, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Process an incoming message (from webhook)
   */
  async receiveMessage(channelId, incomingData) {
    const channel = await Channel.findById(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const {
      from,
      fromName,
      messageType = 'text',
      content,
      mediaUrl,
      mediaMimeType,
      externalId,
      replyToId,
      timestamp,
      metadata
    } = incomingData;

    // Check for duplicate message
    const existing = await ChannelMessage.findByExternalId(externalId);
    if (existing) {
      return existing;
    }

    // Create inbound message record
    const message = await ChannelMessage.create({
      channel_id: channelId,
      direction: 'inbound',
      from_number: from,
      from_name: fromName,
      to_number: channel.phone_number || channel.username,
      message_type: messageType,
      content,
      media_url: mediaUrl,
      media_mime_type: mediaMimeType,
      external_id: externalId,
      reply_to_id: replyToId,
      metadata: metadata || {},
      status: 'received',
      created_at: timestamp ? new Date(timestamp) : new Date()
    });

    // Update or create contact
    await this.updateContact(channelId, {
      externalId: from,
      phoneNumber: from,
      displayName: fromName
    });

    // Emit event for processing (bot response, etc.)
    this.emitMessageReceived(channel, message);

    return message;
  }

  /**
   * Get message history for a channel
   */
  async getMessageHistory(channelId, options = {}) {
    const {
      conversationId,
      limit = 50,
      offset = 0,
      direction,
      startDate,
      endDate
    } = options;

    return ChannelMessage.findByChannel(channelId, {
      conversationId,
      limit,
      offset,
      direction,
      startDate,
      endDate
    });
  }

  /**
   * Get conversation between channel and a specific contact
   */
  async getConversation(channelId, contactNumber, limit = 50) {
    return ChannelMessage.getConversation(channelId, contactNumber, limit);
  }

  /**
   * Update message status (from webhook delivery reports)
   */
  async updateMessageStatus(externalId, status, timestamp = null) {
    const message = await ChannelMessage.findByExternalId(externalId);
    if (!message) {
      return null;
    }

    const updates = { status };
    if (status === 'delivered' && timestamp) {
      updates.delivered_at = new Date(timestamp);
    } else if (status === 'read' && timestamp) {
      updates.read_at = new Date(timestamp);
    }

    return ChannelMessage.updateStatus(message.id, status, null, updates);
  }

  /**
   * Process incoming webhook
   */
  async processWebhook(channelType, payload, headers = {}) {
    // Store webhook for processing
    const result = await pool.query(
      `INSERT INTO channel_webhooks (channel_type, event_type, payload, headers)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [channelType, payload.event || 'unknown', payload, headers]
    );

    const webhook = result.rows[0];

    // Process webhook based on type
    const handler = this.getHandler(channelType);
    if (handler && handler.processWebhook) {
      try {
        await handler.processWebhook(this, payload, headers);
        await pool.query(
          `UPDATE channel_webhooks SET processed = true, processed_at = NOW() WHERE id = $1`,
          [webhook.id]
        );
      } catch (error) {
        await pool.query(
          `UPDATE channel_webhooks SET error_message = $1, retry_count = retry_count + 1 WHERE id = $2`,
          [error.message, webhook.id]
        );
        throw error;
      }
    }

    return webhook;
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(channelId, payload, signature, secret) {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    return crypto.timingSafeEquals(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Update or create a contact
   */
  async updateContact(channelId, contactData) {
    const {
      externalId,
      phoneNumber,
      username,
      displayName,
      profilePictureUrl,
      metadata
    } = contactData;

    const result = await pool.query(
      `INSERT INTO channel_contacts
       (channel_id, external_id, phone_number, username, display_name, profile_picture_url, metadata, first_message_at, last_message_at, message_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), 1)
       ON CONFLICT (channel_id, external_id)
       DO UPDATE SET
         phone_number = COALESCE($3, channel_contacts.phone_number),
         username = COALESCE($4, channel_contacts.username),
         display_name = COALESCE($5, channel_contacts.display_name),
         profile_picture_url = COALESCE($6, channel_contacts.profile_picture_url),
         metadata = COALESCE($7, channel_contacts.metadata),
         last_message_at = NOW(),
         message_count = channel_contacts.message_count + 1,
         updated_at = NOW()
       RETURNING *`,
      [channelId, externalId, phoneNumber, username, displayName, profilePictureUrl, metadata || {}]
    );

    return result.rows[0];
  }

  /**
   * Get contacts for a channel
   */
  async getContacts(channelId, options = {}) {
    const { limit = 50, offset = 0, search } = options;

    let query = `
      SELECT * FROM channel_contacts
      WHERE channel_id = $1
    `;
    const params = [channelId];

    if (search) {
      query += ` AND (display_name ILIKE $${params.length + 1} OR phone_number ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY last_message_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Emit message received event
   */
  emitMessageReceived(channel, message) {
    // This would integrate with event system/bot processing
    // For now, just log
    log.info(`Message received on channel ${channel.id}:`, {
      from: message.from_number,
      type: message.message_type,
      content: message.content?.substring(0, 50)
    });
  }

  /**
   * Get channel statistics
   */
  async getChannelStats(channelId, period = '30d') {
    const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : 90;

    const result = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE direction = 'inbound') as inbound_count,
        COUNT(*) FILTER (WHERE direction = 'outbound') as outbound_count,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered_count,
        COUNT(*) FILTER (WHERE status = 'read') as read_count,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
        COUNT(DISTINCT from_number) FILTER (WHERE direction = 'inbound') as unique_contacts
       FROM channel_messages
       WHERE channel_id = $1
       AND created_at >= NOW() - INTERVAL '${periodDays} days'`,
      [channelId]
    );

    return result.rows[0];
  }
}

// Singleton instance
const channelManager = new ChannelManager();

module.exports = channelManager;
