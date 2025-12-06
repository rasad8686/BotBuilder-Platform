/**
 * BaseProvider - Abstract base class for all messaging channel providers
 * All providers (WhatsApp, Instagram, Telegram, etc.) should extend this class
 */

class BaseProvider {
  constructor(config = {}) {
    this.config = config;
    this.name = 'base';
    this.version = '1.0.0';

    if (new.target === BaseProvider) {
      throw new Error('BaseProvider is abstract and cannot be instantiated directly');
    }
  }

  /**
   * Initialize the provider with channel credentials
   * @param {Object} channel - Channel object with credentials
   * @returns {Promise<boolean>} - Success status
   */
  async initialize(channel) {
    throw new Error('Method initialize() must be implemented');
  }

  /**
   * Send a message through this provider
   * @param {Object} channel - Channel object
   * @param {Object} message - Message data
   * @returns {Promise<Object>} - Send result with messageId
   */
  async send(channel, message) {
    throw new Error('Method send() must be implemented');
  }

  /**
   * Send a text message
   * @param {Object} channel - Channel object
   * @param {string} to - Recipient identifier
   * @param {string} text - Message text
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Send result
   */
  async sendTextMessage(channel, to, text, options = {}) {
    throw new Error('Method sendTextMessage() must be implemented');
  }

  /**
   * Send a media message (image, video, audio, document)
   * @param {Object} channel - Channel object
   * @param {string} to - Recipient identifier
   * @param {string} mediaType - Type of media
   * @param {string} mediaUrl - URL of media
   * @param {Object} options - Additional options (caption, filename)
   * @returns {Promise<Object>} - Send result
   */
  async sendMediaMessage(channel, to, mediaType, mediaUrl, options = {}) {
    throw new Error('Method sendMediaMessage() must be implemented');
  }

  /**
   * Send a template message (for WhatsApp HSM templates)
   * @param {Object} channel - Channel object
   * @param {string} to - Recipient identifier
   * @param {string} templateName - Template name
   * @param {string} language - Template language
   * @param {Array} components - Template components/variables
   * @returns {Promise<Object>} - Send result
   */
  async sendTemplate(channel, to, templateName, language, components = []) {
    throw new Error('Method sendTemplate() must be implemented');
  }

  /**
   * Receive and parse an incoming message from webhook
   * @param {Object} payload - Webhook payload
   * @returns {Promise<Object>} - Parsed message object
   */
  async receive(payload) {
    throw new Error('Method receive() must be implemented');
  }

  /**
   * Verify webhook authenticity
   * @param {Object} request - Request object with headers and body
   * @param {string} secret - Webhook secret
   * @returns {boolean} - Verification result
   */
  verify(request, secret) {
    throw new Error('Method verify() must be implemented');
  }

  /**
   * Handle webhook challenge (for initial webhook setup)
   * @param {Object} query - Query parameters
   * @param {string} verifyToken - Verification token
   * @returns {string|null} - Challenge response or null
   */
  handleChallenge(query, verifyToken) {
    throw new Error('Method handleChallenge() must be implemented');
  }

  /**
   * Process webhook payload and extract events
   * @param {Object} manager - ChannelManager instance
   * @param {Object} payload - Webhook payload
   * @param {Object} headers - Request headers
   * @returns {Promise<Array>} - Array of processed events
   */
  async processWebhook(manager, payload, headers) {
    throw new Error('Method processWebhook() must be implemented');
  }

  /**
   * Get message delivery status
   * @param {Object} channel - Channel object
   * @param {string} messageId - External message ID
   * @returns {Promise<Object>} - Status object
   */
  async getMessageStatus(channel, messageId) {
    throw new Error('Method getMessageStatus() must be implemented');
  }

  /**
   * Mark message as read
   * @param {Object} channel - Channel object
   * @param {string} messageId - External message ID
   * @returns {Promise<boolean>} - Success status
   */
  async markAsRead(channel, messageId) {
    throw new Error('Method markAsRead() must be implemented');
  }

  /**
   * Send typing indicator
   * @param {Object} channel - Channel object
   * @param {string} to - Recipient identifier
   * @param {boolean} typing - Typing status
   * @returns {Promise<boolean>} - Success status
   */
  async sendTypingIndicator(channel, to, typing = true) {
    // Optional - not all providers support this
    return true;
  }

  /**
   * Upload media to provider's servers
   * @param {Object} channel - Channel object
   * @param {Buffer|string} media - Media buffer or path
   * @param {string} mimeType - Media MIME type
   * @returns {Promise<string>} - Media ID or URL
   */
  async uploadMedia(channel, media, mimeType) {
    throw new Error('Method uploadMedia() must be implemented');
  }

  /**
   * Download media from provider
   * @param {Object} channel - Channel object
   * @param {string} mediaId - Media identifier
   * @returns {Promise<Object>} - Media data with buffer and mimeType
   */
  async downloadMedia(channel, mediaId) {
    throw new Error('Method downloadMedia() must be implemented');
  }

  /**
   * Get user profile information
   * @param {Object} channel - Channel object
   * @param {string} userId - User identifier
   * @returns {Promise<Object>} - User profile
   */
  async getUserProfile(channel, userId) {
    // Optional - not all providers support this
    return null;
  }

  /**
   * Validate channel credentials
   * @param {Object} credentials - Credentials to validate
   * @returns {Promise<boolean>} - Validation result
   */
  async validateCredentials(credentials) {
    throw new Error('Method validateCredentials() must be implemented');
  }

  /**
   * Refresh access token (for OAuth-based providers)
   * @param {Object} channel - Channel object
   * @returns {Promise<Object>} - New tokens
   */
  async refreshToken(channel) {
    // Optional - only for OAuth providers
    return null;
  }

  /**
   * Get provider capabilities
   * @returns {Object} - Capabilities object
   */
  getCapabilities() {
    return {
      textMessages: true,
      mediaMessages: false,
      templates: false,
      reactions: false,
      replies: false,
      typing: false,
      readReceipts: false,
      locationMessages: false,
      contactMessages: false,
      interactiveMessages: false
    };
  }

  /**
   * Format phone number for this provider
   * @param {string} phoneNumber - Raw phone number
   * @returns {string} - Formatted phone number
   */
  formatPhoneNumber(phoneNumber) {
    // Remove all non-numeric characters except +
    let formatted = phoneNumber.replace(/[^\d+]/g, '');

    // Ensure it starts with country code
    if (!formatted.startsWith('+')) {
      // Assume it needs a + prefix
      formatted = '+' + formatted;
    }

    return formatted;
  }

  /**
   * Log provider activity
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    console[level](`[${timestamp}] [${this.name}] ${message}`, data);
  }
}

module.exports = BaseProvider;
