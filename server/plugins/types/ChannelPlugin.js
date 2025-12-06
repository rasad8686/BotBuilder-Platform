/**
 * ChannelPlugin - Base class for messaging channel plugins
 * Supports: WhatsApp, Telegram, Instagram, Messenger, etc.
 */

const BasePlugin = require('./BasePlugin');
const log = require('../../utils/logger');

class ChannelPlugin extends BasePlugin {
  constructor(config = {}) {
    super(config);
    this.channelType = config.channelType || 'generic';
    this.webhookPath = config.webhookPath || `/webhook/${this.id}`;
    this.apiClient = null;
    this.messageQueue = [];
  }

  /**
   * Get plugin type
   * @returns {string}
   */
  getType() {
    return 'channel';
  }

  /**
   * Send a message through the channel
   * @param {string} recipientId - Recipient identifier
   * @param {object} message - Message content
   * @param {object} options - Send options
   * @returns {Promise<object>}
   */
  async sendMessage(recipientId, message, options = {}) {
    if (!this.isEnabled()) {
      throw new Error('Plugin is not enabled');
    }

    const formattedMessage = await this.formatOutgoingMessage(message);

    try {
      const result = await this.doSendMessage(recipientId, formattedMessage, options);
      await this.onMessageSent(recipientId, formattedMessage, result);
      return result;
    } catch (error) {
      await this.onMessageError(recipientId, formattedMessage, error);
      throw error;
    }
  }

  /**
   * Receive and process incoming message
   * @param {object} rawMessage - Raw message from channel
   * @returns {Promise<object>}
   */
  async receiveMessage(rawMessage) {
    if (!this.isEnabled()) {
      throw new Error('Plugin is not enabled');
    }

    const parsedMessage = await this.parseIncomingMessage(rawMessage);
    await this.onMessageReceived(parsedMessage);
    return parsedMessage;
  }

  /**
   * Handle webhook requests from the channel
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @returns {Promise<void>}
   */
  async webhookHandler(req, res) {
    try {
      // Verify webhook signature
      const isValid = await this.verifyWebhook(req);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      // Handle verification challenge (for Facebook, etc.)
      if (req.method === 'GET') {
        const challenge = await this.handleVerificationChallenge(req);
        if (challenge) {
          return res.send(challenge);
        }
      }

      // Process webhook payload
      const events = await this.extractWebhookEvents(req.body);

      for (const event of events) {
        await this.processWebhookEvent(event);
      }

      res.status(200).json({ status: 'ok' });
    } catch (error) {
      log.error(`[${this.name}] Webhook error:`, error.message);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  /**
   * Format outgoing message for the channel
   * @param {object} message - Generic message format
   * @returns {Promise<object>}
   */
  async formatOutgoingMessage(message) {
    // Override in subclass for channel-specific formatting
    return {
      type: message.type || 'text',
      content: message.content || message.text,
      buttons: message.buttons || [],
      media: message.media || null,
      metadata: message.metadata || {}
    };
  }

  /**
   * Parse incoming message to generic format
   * @param {object} rawMessage - Raw channel message
   * @returns {Promise<object>}
   */
  async parseIncomingMessage(rawMessage) {
    // Override in subclass for channel-specific parsing
    return {
      id: rawMessage.id,
      senderId: rawMessage.from || rawMessage.sender,
      content: rawMessage.text || rawMessage.body,
      type: rawMessage.type || 'text',
      timestamp: rawMessage.timestamp || Date.now(),
      channel: this.channelType,
      raw: rawMessage
    };
  }

  /**
   * Actually send the message (implement in subclass)
   * @param {string} recipientId
   * @param {object} message
   * @param {object} options
   * @returns {Promise<object>}
   */
  async doSendMessage(recipientId, message, options) {
    throw new Error('doSendMessage must be implemented in subclass');
  }

  /**
   * Verify webhook signature
   * @param {object} req
   * @returns {Promise<boolean>}
   */
  async verifyWebhook(req) {
    // Override in subclass
    return true;
  }

  /**
   * Handle verification challenge
   * @param {object} req
   * @returns {Promise<string|null>}
   */
  async handleVerificationChallenge(req) {
    // Override in subclass
    return null;
  }

  /**
   * Extract events from webhook payload
   * @param {object} body
   * @returns {Promise<Array>}
   */
  async extractWebhookEvents(body) {
    // Override in subclass
    return [body];
  }

  /**
   * Process a single webhook event
   * @param {object} event
   * @returns {Promise<void>}
   */
  async processWebhookEvent(event) {
    // Override in subclass
  }

  // Event hooks
  async onMessageSent(recipientId, message, result) {}
  async onMessageReceived(message) {}
  async onMessageError(recipientId, message, error) {}

  /**
   * Get channel capabilities
   * @returns {object}
   */
  getCapabilities() {
    return {
      text: true,
      images: false,
      video: false,
      audio: false,
      documents: false,
      buttons: false,
      quickReplies: false,
      templates: false,
      location: false,
      contacts: false
    };
  }
}

module.exports = ChannelPlugin;
