/**
 * WhatsAppProvider - Meta WhatsApp Cloud API Integration
 * Handles all WhatsApp Business API operations
 */

const BaseProvider = require('./BaseProvider');
const crypto = require('crypto');

class WhatsAppProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'whatsapp';
    this.version = '1.0.0';
    this.apiVersion = config.apiVersion || 'v18.0';
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
  }

  /**
   * Initialize WhatsApp channel
   */
  async initialize(channel) {
    try {
      // Validate credentials by making a test API call
      const isValid = await this.validateCredentials(channel.credentials);
      if (!isValid) {
        throw new Error('Invalid WhatsApp credentials');
      }

      this.log('info', `WhatsApp channel initialized: ${channel.id}`);
      return true;
    } catch (error) {
      this.log('error', 'Failed to initialize WhatsApp channel', { error: error.message });
      throw error;
    }
  }

  /**
   * Send a message (generic method)
   */
  async send(channel, message) {
    const { to, type = 'text', content, mediaUrl, templateName, templateLanguage, components } = message;

    switch (type) {
      case 'text':
        return this.sendTextMessage(channel, to, content, message);
      case 'image':
      case 'video':
      case 'audio':
      case 'document':
        return this.sendMediaMessage(channel, to, type, mediaUrl, message);
      case 'template':
        return this.sendTemplate(channel, to, templateName, templateLanguage, components);
      case 'interactive':
        return this.sendInteractiveMessage(channel, to, message);
      case 'location':
        return this.sendLocationMessage(channel, to, message);
      case 'contact':
        return this.sendContactMessage(channel, to, message);
      default:
        throw new Error(`Unsupported message type: ${type}`);
    }
  }

  /**
   * Send a text message
   */
  async sendTextMessage(channel, to, text, options = {}) {
    const { phoneNumberId, accessToken } = this.getCredentials(channel);

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.formatPhoneNumber(to),
      type: 'text',
      text: {
        preview_url: options.previewUrl !== false,
        body: text
      }
    };

    // Add reply context if replying to a message
    if (options.replyToId) {
      payload.context = {
        message_id: options.replyToId
      };
    }

    return this.makeRequest(phoneNumberId, accessToken, payload);
  }

  /**
   * Send a media message (image, video, audio, document)
   */
  async sendMediaMessage(channel, to, mediaType, mediaUrl, options = {}) {
    const { phoneNumberId, accessToken } = this.getCredentials(channel);

    const mediaObject = {
      link: mediaUrl
    };

    if (options.caption) {
      mediaObject.caption = options.caption;
    }

    if (mediaType === 'document' && options.filename) {
      mediaObject.filename = options.filename;
    }

    // If media ID is provided instead of URL
    if (options.mediaId) {
      delete mediaObject.link;
      mediaObject.id = options.mediaId;
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.formatPhoneNumber(to),
      type: mediaType,
      [mediaType]: mediaObject
    };

    if (options.replyToId) {
      payload.context = {
        message_id: options.replyToId
      };
    }

    return this.makeRequest(phoneNumberId, accessToken, payload);
  }

  /**
   * Send a template message (HSM)
   */
  async sendTemplate(channel, to, templateName, language = 'en', components = []) {
    const { phoneNumberId, accessToken } = this.getCredentials(channel);

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.formatPhoneNumber(to),
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: language
        }
      }
    };

    if (components && components.length > 0) {
      payload.template.components = components;
    }

    return this.makeRequest(phoneNumberId, accessToken, payload);
  }

  /**
   * Send interactive message (buttons, lists)
   */
  async sendInteractiveMessage(channel, to, message) {
    const { phoneNumberId, accessToken } = this.getCredentials(channel);

    const { interactiveType, header, body, footer, action } = message;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.formatPhoneNumber(to),
      type: 'interactive',
      interactive: {
        type: interactiveType, // 'button', 'list', 'product', 'product_list'
        body: {
          text: body
        },
        action
      }
    };

    if (header) {
      payload.interactive.header = header;
    }

    if (footer) {
      payload.interactive.footer = {
        text: footer
      };
    }

    return this.makeRequest(phoneNumberId, accessToken, payload);
  }

  /**
   * Send location message
   */
  async sendLocationMessage(channel, to, message) {
    const { phoneNumberId, accessToken } = this.getCredentials(channel);

    const { latitude, longitude, name, address } = message;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.formatPhoneNumber(to),
      type: 'location',
      location: {
        latitude,
        longitude,
        name,
        address
      }
    };

    return this.makeRequest(phoneNumberId, accessToken, payload);
  }

  /**
   * Send contact message
   */
  async sendContactMessage(channel, to, message) {
    const { phoneNumberId, accessToken } = this.getCredentials(channel);

    const { contacts } = message;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.formatPhoneNumber(to),
      type: 'contacts',
      contacts
    };

    return this.makeRequest(phoneNumberId, accessToken, payload);
  }

  /**
   * Send reaction to a message
   */
  async sendReaction(channel, to, messageId, emoji) {
    const { phoneNumberId, accessToken } = this.getCredentials(channel);

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.formatPhoneNumber(to),
      type: 'reaction',
      reaction: {
        message_id: messageId,
        emoji
      }
    };

    return this.makeRequest(phoneNumberId, accessToken, payload);
  }

  /**
   * Mark message as read
   */
  async markAsRead(channel, messageId) {
    const { phoneNumberId, accessToken } = this.getCredentials(channel);

    const payload = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId
    };

    try {
      await this.makeRequest(phoneNumberId, accessToken, payload);
      return true;
    } catch (error) {
      this.log('error', 'Failed to mark message as read', { error: error.message });
      return false;
    }
  }

  /**
   * Verify webhook signature
   */
  verify(request, secret) {
    const signature = request.headers['x-hub-signature-256'];
    if (!signature) {
      return false;
    }

    const body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    return crypto.timingSafeEquals(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Handle webhook verification challenge
   */
  handleChallenge(query, verifyToken) {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === verifyToken) {
      return challenge;
    }

    return null;
  }

  /**
   * Process incoming webhook
   */
  async processWebhook(manager, payload, headers) {
    const results = [];

    if (!payload.entry) {
      return results;
    }

    for (const entry of payload.entry) {
      const businessAccountId = entry.id;

      if (!entry.changes) continue;

      for (const change of entry.changes) {
        if (change.field !== 'messages') continue;

        const value = change.value;
        const phoneNumberId = value.metadata?.phone_number_id;
        const displayPhoneNumber = value.metadata?.display_phone_number;

        // Process messages
        if (value.messages) {
          for (const message of value.messages) {
            const result = await this.processIncomingMessage(
              manager,
              message,
              value.contacts?.[0],
              phoneNumberId,
              displayPhoneNumber
            );
            if (result) results.push(result);
          }
        }

        // Process status updates
        if (value.statuses) {
          for (const status of value.statuses) {
            await this.processStatusUpdate(manager, status);
          }
        }
      }
    }

    return results;
  }

  /**
   * Process incoming message
   */
  async processIncomingMessage(manager, message, contact, phoneNumberId, displayPhoneNumber) {
    const Channel = require('../../models/Channel');

    // Find channel by phone number ID
    const channel = await Channel.findByBusinessAccountId(phoneNumberId);
    if (!channel) {
      this.log('warn', 'Channel not found for phone number ID', { phoneNumberId });
      return null;
    }

    const messageData = {
      from: message.from,
      fromName: contact?.profile?.name || null,
      messageType: message.type,
      externalId: message.id,
      timestamp: message.timestamp ? parseInt(message.timestamp) * 1000 : Date.now(),
      replyToId: message.context?.id || null,
      metadata: {
        phoneNumberId,
        displayPhoneNumber
      }
    };

    // Extract content based on message type
    switch (message.type) {
      case 'text':
        messageData.content = message.text?.body;
        break;

      case 'image':
        messageData.mediaUrl = message.image?.id;
        messageData.mediaMimeType = message.image?.mime_type;
        messageData.content = message.image?.caption;
        break;

      case 'video':
        messageData.mediaUrl = message.video?.id;
        messageData.mediaMimeType = message.video?.mime_type;
        messageData.content = message.video?.caption;
        break;

      case 'audio':
        messageData.mediaUrl = message.audio?.id;
        messageData.mediaMimeType = message.audio?.mime_type;
        break;

      case 'document':
        messageData.mediaUrl = message.document?.id;
        messageData.mediaMimeType = message.document?.mime_type;
        messageData.content = message.document?.caption;
        messageData.metadata.filename = message.document?.filename;
        break;

      case 'location':
        messageData.content = JSON.stringify({
          latitude: message.location?.latitude,
          longitude: message.location?.longitude,
          name: message.location?.name,
          address: message.location?.address
        });
        break;

      case 'contacts':
        messageData.content = JSON.stringify(message.contacts);
        break;

      case 'interactive':
        messageData.content = message.interactive?.button_reply?.id ||
                              message.interactive?.list_reply?.id;
        messageData.metadata.interactive = message.interactive;
        break;

      case 'button':
        messageData.content = message.button?.text;
        messageData.metadata.payload = message.button?.payload;
        break;

      case 'sticker':
        messageData.mediaUrl = message.sticker?.id;
        messageData.mediaMimeType = message.sticker?.mime_type;
        break;

      case 'reaction':
        messageData.content = message.reaction?.emoji;
        messageData.replyToId = message.reaction?.message_id;
        break;

      default:
        messageData.content = JSON.stringify(message);
    }

    return manager.receiveMessage(channel.id, messageData);
  }

  /**
   * Process status update (sent, delivered, read, failed)
   */
  async processStatusUpdate(manager, status) {
    const statusMap = {
      'sent': 'sent',
      'delivered': 'delivered',
      'read': 'read',
      'failed': 'failed'
    };

    const mappedStatus = statusMap[status.status];
    if (!mappedStatus) return;

    const timestamp = status.timestamp ? parseInt(status.timestamp) * 1000 : null;

    await manager.updateMessageStatus(status.id, mappedStatus, timestamp);

    // Log errors if present
    if (status.errors) {
      this.log('warn', 'Message delivery error', {
        messageId: status.id,
        errors: status.errors
      });
    }
  }

  /**
   * Get message status from API
   */
  async getMessageStatus(channel, messageId) {
    // WhatsApp Cloud API doesn't have a direct endpoint to get message status
    // Status updates come via webhooks
    // This method is included for interface compliance
    return {
      messageId,
      status: 'unknown',
      note: 'Status updates are received via webhooks'
    };
  }

  /**
   * Upload media to WhatsApp servers
   */
  async uploadMedia(channel, media, mimeType) {
    const { phoneNumberId, accessToken } = this.getCredentials(channel);

    const formData = new FormData();
    formData.append('messaging_product', 'whatsapp');
    formData.append('file', media, { contentType: mimeType });
    formData.append('type', mimeType);

    const response = await fetch(`${this.baseUrl}/${phoneNumberId}/media`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to upload media');
    }

    const data = await response.json();
    return data.id;
  }

  /**
   * Download media from WhatsApp servers
   */
  async downloadMedia(channel, mediaId) {
    const { accessToken } = this.getCredentials(channel);

    // First, get the media URL
    const urlResponse = await fetch(`${this.baseUrl}/${mediaId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!urlResponse.ok) {
      throw new Error('Failed to get media URL');
    }

    const urlData = await urlResponse.json();

    // Then download the actual media
    const mediaResponse = await fetch(urlData.url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!mediaResponse.ok) {
      throw new Error('Failed to download media');
    }

    const buffer = await mediaResponse.buffer();

    return {
      buffer,
      mimeType: urlData.mime_type,
      sha256: urlData.sha256,
      fileSize: urlData.file_size
    };
  }

  /**
   * Get user profile (limited in WhatsApp Business API)
   */
  async getUserProfile(channel, userId) {
    // WhatsApp Business API doesn't provide extensive profile info
    // Basic info comes with messages via webhook
    return {
      id: userId,
      note: 'Profile info is received with messages via webhook'
    };
  }

  /**
   * Validate credentials by making a test API call
   */
  async validateCredentials(credentials) {
    const { phoneNumberId, accessToken } = credentials;

    if (!phoneNumberId || !accessToken) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/${phoneNumberId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get templates for a phone number
   */
  async getTemplates(channel) {
    const { businessAccountId, accessToken } = this.getCredentials(channel);

    const response = await fetch(
      `${this.baseUrl}/${businessAccountId}/message_templates`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch templates');
    }

    const data = await response.json();
    return data.data || [];
  }

  /**
   * Send typing indicator
   */
  async sendTypingIndicator(channel, to, typing = true) {
    // WhatsApp Business API doesn't support typing indicators
    return true;
  }

  /**
   * Get provider capabilities
   */
  getCapabilities() {
    return {
      textMessages: true,
      mediaMessages: true,
      templates: true,
      reactions: true,
      replies: true,
      typing: false,
      readReceipts: true,
      locationMessages: true,
      contactMessages: true,
      interactiveMessages: true,
      stickers: true
    };
  }

  /**
   * Get credentials from channel
   */
  getCredentials(channel) {
    const credentials = channel.credentials || {};

    return {
      phoneNumberId: credentials.phone_number_id || channel.business_account_id,
      accessToken: credentials.access_token || channel.access_token,
      businessAccountId: credentials.business_account_id,
      appSecret: credentials.app_secret
    };
  }

  /**
   * Make API request to WhatsApp Cloud API
   */
  async makeRequest(phoneNumberId, accessToken, payload) {
    const response = await fetch(`${this.baseUrl}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.error?.message || 'WhatsApp API request failed';
      this.log('error', 'WhatsApp API error', { error: data.error, payload });
      throw new Error(errorMessage);
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
      contacts: data.contacts
    };
  }

  /**
   * Format phone number for WhatsApp
   */
  formatPhoneNumber(phoneNumber) {
    // Remove all non-numeric characters
    let formatted = phoneNumber.replace(/\D/g, '');

    // WhatsApp expects numbers without + prefix
    if (formatted.startsWith('+')) {
      formatted = formatted.substring(1);
    }

    return formatted;
  }
}

module.exports = WhatsAppProvider;
