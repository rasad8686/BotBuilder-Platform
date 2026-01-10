/**
 * @fileoverview Email Provider Abstraction Layer
 * @description Unified interface for all email providers (SendGrid, AWS SES, SMTP, Resend)
 * @module services/email-providers
 */

const log = require('../../utils/logger');
const SendGridProvider = require('./sendgrid.service');
const SESProvider = require('./ses.service');

// Provider registry
const providers = {
  sendgrid: SendGridProvider,
  ses: SESProvider
};

/**
 * Email Provider Manager
 * Handles provider selection, fallback, and unified interface
 */
class EmailProviderManager {
  constructor() {
    this.primaryProvider = process.env.EMAIL_PROVIDER || 'smtp';
    this.fallbackProvider = process.env.EMAIL_FALLBACK_PROVIDER;
    this.instances = {};
    this.initialized = false;
  }

  /**
   * Initialize providers
   */
  async initialize() {
    if (this.initialized) return;

    // Initialize primary provider
    await this._initializeProvider(this.primaryProvider);

    // Initialize fallback if configured
    if (this.fallbackProvider && this.fallbackProvider !== this.primaryProvider) {
      await this._initializeProvider(this.fallbackProvider);
    }

    this.initialized = true;
    log.info('Email provider manager initialized', {
      primary: this.primaryProvider,
      fallback: this.fallbackProvider
    });
  }

  /**
   * Initialize a specific provider
   * @private
   */
  async _initializeProvider(providerName) {
    const ProviderClass = providers[providerName];
    if (!ProviderClass) {
      log.warn(`Unknown email provider: ${providerName}`);
      return null;
    }

    const instance = new ProviderClass();
    this.instances[providerName] = instance;
    return instance;
  }

  /**
   * Get provider instance
   * @param {string} [name] - Provider name (optional, uses primary if not specified)
   * @returns {Object}
   */
  getProvider(name) {
    const providerName = name || this.primaryProvider;
    return this.instances[providerName];
  }

  /**
   * Get all available providers
   * @returns {Array<string>}
   */
  getAvailableProviders() {
    return Object.keys(providers);
  }

  /**
   * Get configured providers
   * @returns {Array<{name: string, configured: boolean, capabilities: Object}>}
   */
  getConfiguredProviders() {
    return Object.entries(this.instances).map(([name, instance]) => ({
      name,
      configured: instance.isConfigured(),
      capabilities: instance.getCapabilities()
    }));
  }

  /**
   * Set primary provider
   * @param {string} providerName - Provider name
   */
  async setPrimaryProvider(providerName) {
    if (!providers[providerName]) {
      throw new Error(`Unknown provider: ${providerName}`);
    }

    if (!this.instances[providerName]) {
      await this._initializeProvider(providerName);
    }

    this.primaryProvider = providerName;
    log.info('Primary email provider changed', { provider: providerName });
  }

  // ==========================================
  // UNIFIED EMAIL INTERFACE
  // ==========================================

  /**
   * Send a single email
   * @param {Object} options - Email options
   * @returns {Promise<{success: boolean, messageId?: string, provider: string}>}
   */
  async send(options) {
    await this.initialize();

    const provider = this.getProvider();
    if (!provider || !provider.isConfigured()) {
      // Try fallback
      if (this.fallbackProvider) {
        const fallback = this.getProvider(this.fallbackProvider);
        if (fallback && fallback.isConfigured()) {
          log.info('Using fallback email provider', { provider: this.fallbackProvider });
          return fallback.send(options);
        }
      }

      // Log to console in development
      return this._devModeSend(options);
    }

    try {
      return await provider.send(options);
    } catch (error) {
      // Try fallback on error
      if (this.fallbackProvider) {
        const fallback = this.getProvider(this.fallbackProvider);
        if (fallback && fallback.isConfigured()) {
          log.warn('Primary provider failed, using fallback', {
            primary: this.primaryProvider,
            fallback: this.fallbackProvider,
            error: error.message
          });
          return fallback.send(options);
        }
      }
      throw error;
    }
  }

  /**
   * Send batch emails
   * @param {Array<Object>} emails - Array of email options
   * @param {Object} options - Batch options
   * @returns {Promise<{sent: number, failed: number, errors: Array}>}
   */
  async sendBatch(emails, options = {}) {
    await this.initialize();

    const provider = this.getProvider();
    if (!provider || !provider.isConfigured()) {
      return this._devModeSendBatch(emails);
    }

    return provider.sendBatch(emails, options);
  }

  /**
   * Get email status
   * @param {string} messageId - Message ID
   * @returns {Promise<Object>}
   */
  async getStatus(messageId) {
    await this.initialize();

    const provider = this.getProvider();
    if (!provider || !provider.getStatus) {
      return { messageId, status: 'unknown' };
    }

    return provider.getStatus(messageId);
  }

  // ==========================================
  // TEMPLATE MANAGEMENT
  // ==========================================

  /**
   * List templates
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async listTemplates(options = {}) {
    await this.initialize();

    const provider = this.getProvider();
    if (!provider || !provider.listTemplates) {
      return [];
    }

    return provider.listTemplates(options);
  }

  /**
   * Get template
   * @param {string} templateId - Template ID
   * @returns {Promise<Object>}
   */
  async getTemplate(templateId) {
    await this.initialize();

    const provider = this.getProvider();
    if (!provider || !provider.getTemplate) {
      throw new Error('Template management not supported');
    }

    return provider.getTemplate(templateId);
  }

  /**
   * Create template
   * @param {Object} template - Template data
   * @returns {Promise<Object>}
   */
  async createTemplate(template) {
    await this.initialize();

    const provider = this.getProvider();
    if (!provider || !provider.createTemplate) {
      throw new Error('Template management not supported');
    }

    return provider.createTemplate(template);
  }

  /**
   * Delete template
   * @param {string} templateId - Template ID
   * @returns {Promise<void>}
   */
  async deleteTemplate(templateId) {
    await this.initialize();

    const provider = this.getProvider();
    if (!provider || !provider.deleteTemplate) {
      throw new Error('Template management not supported');
    }

    return provider.deleteTemplate(templateId);
  }

  // ==========================================
  // DOMAIN MANAGEMENT
  // ==========================================

  /**
   * Add domain for verification
   * @param {string} domain - Domain name
   * @returns {Promise<Object>}
   */
  async addDomain(domain) {
    await this.initialize();

    const provider = this.getProvider();
    if (!provider || !provider.addDomain) {
      throw new Error('Domain verification not supported');
    }

    return provider.addDomain(domain);
  }

  /**
   * Get domain status
   * @param {string} domainOrId - Domain name or ID
   * @returns {Promise<Object>}
   */
  async getDomainStatus(domainOrId) {
    await this.initialize();

    const provider = this.getProvider();
    if (!provider || !provider.getDomainStatus) {
      return { domain: domainOrId, verified: false, status: 'unsupported' };
    }

    return provider.getDomainStatus(domainOrId);
  }

  /**
   * List domains
   * @returns {Promise<Array>}
   */
  async listDomains() {
    await this.initialize();

    const provider = this.getProvider();
    if (!provider || !provider.listDomains) {
      return [];
    }

    return provider.listDomains();
  }

  /**
   * Delete domain
   * @param {string} domainOrId - Domain name or ID
   * @returns {Promise<void>}
   */
  async deleteDomain(domainOrId) {
    await this.initialize();

    const provider = this.getProvider();
    if (!provider || !provider.deleteDomain) {
      throw new Error('Domain management not supported');
    }

    return provider.deleteDomain(domainOrId);
  }

  // ==========================================
  // SUPPRESSION LIST
  // ==========================================

  /**
   * Get bounces
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async getBounces(options = {}) {
    await this.initialize();

    const provider = this.getProvider();
    if (!provider || !provider.getBounces) {
      if (provider && provider.getSuppressionList) {
        const result = await provider.getSuppressionList({ ...options, reasons: ['BOUNCE'] });
        return result.items || result;
      }
      return [];
    }

    return provider.getBounces(options);
  }

  /**
   * Get unsubscribes
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async getUnsubscribes(options = {}) {
    await this.initialize();

    const provider = this.getProvider();
    if (!provider || !provider.getUnsubscribes) {
      return [];
    }

    return provider.getUnsubscribes(options);
  }

  /**
   * Add to suppression list
   * @param {string} email - Email address
   * @param {string} reason - Reason
   * @returns {Promise<void>}
   */
  async addToSuppressionList(email, reason = 'manual') {
    await this.initialize();

    const provider = this.getProvider();
    if (provider && provider.addUnsubscribe) {
      return provider.addUnsubscribe(email);
    }
    if (provider && provider.addToSuppressionList) {
      return provider.addToSuppressionList(email, reason);
    }
  }

  /**
   * Remove from suppression list
   * @param {string} email - Email address
   * @returns {Promise<void>}
   */
  async removeFromSuppressionList(email) {
    await this.initialize();

    const provider = this.getProvider();
    if (provider && provider.removeUnsubscribe) {
      return provider.removeUnsubscribe(email);
    }
    if (provider && provider.removeFromSuppressionList) {
      return provider.removeFromSuppressionList(email);
    }
  }

  // ==========================================
  // STATISTICS
  // ==========================================

  /**
   * Get statistics
   * @param {Object} options - Query options
   * @returns {Promise<Object>}
   */
  async getStats(options = {}) {
    await this.initialize();

    const provider = this.getProvider();
    if (!provider) {
      return { error: 'No provider configured' };
    }

    if (provider.getStats) {
      return provider.getStats(options);
    }

    if (provider.getSendStatistics) {
      return provider.getSendStatistics();
    }

    return { error: 'Statistics not supported' };
  }

  /**
   * Get sending quota (for SES)
   * @returns {Promise<Object>}
   */
  async getSendingQuota() {
    await this.initialize();

    const provider = this.getProvider();
    if (provider && provider.getSendingQuota) {
      return provider.getSendingQuota();
    }

    return null;
  }

  // ==========================================
  // CONNECTION TEST
  // ==========================================

  /**
   * Test provider connection
   * @param {string} [providerName] - Provider name (optional)
   * @returns {Promise<{connected: boolean, provider: string, error?: string}>}
   */
  async testConnection(providerName) {
    await this.initialize();

    const provider = this.getProvider(providerName);
    if (!provider) {
      return {
        connected: false,
        provider: providerName || this.primaryProvider,
        error: 'Provider not configured'
      };
    }

    if (!provider.isConfigured()) {
      return {
        connected: false,
        provider: providerName || this.primaryProvider,
        error: 'Provider credentials not set'
      };
    }

    if (provider.testConnection) {
      const result = await provider.testConnection();
      return {
        ...result,
        provider: providerName || this.primaryProvider
      };
    }

    return {
      connected: true,
      provider: providerName || this.primaryProvider
    };
  }

  /**
   * Send test email
   * @param {string} toEmail - Recipient email
   * @returns {Promise<Object>}
   */
  async sendTestEmail(toEmail) {
    return this.send({
      to: toEmail,
      from: process.env.EMAIL_FROM || 'noreply@example.com',
      subject: 'BotBuilder Email Test',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1 style="color: #6366f1;">Email Configuration Test</h1>
          <p>This is a test email from BotBuilder.</p>
          <p>If you receive this email, your email provider is configured correctly!</p>
          <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 12px;">
            Provider: ${this.primaryProvider}<br>
            Sent at: ${new Date().toISOString()}
          </p>
        </div>
      `,
      text: `Email Configuration Test\n\nThis is a test email from BotBuilder.\n\nProvider: ${this.primaryProvider}\nSent at: ${new Date().toISOString()}`
    });
  }

  // ==========================================
  // DEVELOPMENT MODE
  // ==========================================

  /**
   * Development mode send (console logging)
   * @private
   */
  _devModeSend(options) {
    log.info('========================================');
    log.info('EMAIL (Development Mode)');
    log.info('========================================');
    log.info(`Provider: ${this.primaryProvider} (not configured)`);
    log.info(`From: ${options.from}`);
    log.info(`To: ${options.to}`);
    log.info(`Subject: ${options.subject}`);
    log.info(`Body: ${options.text || options.html?.substring(0, 200)}...`);
    log.info('========================================');

    return {
      success: true,
      messageId: `dev-${Date.now()}`,
      provider: 'development',
      dev: true
    };
  }

  /**
   * Development mode batch send
   * @private
   */
  _devModeSendBatch(emails) {
    log.info(`Development mode: Would send ${emails.length} emails`);
    return {
      sent: emails.length,
      failed: 0,
      errors: [],
      dev: true
    };
  }

  /**
   * Get provider info
   * @returns {Object}
   */
  getProviderInfo() {
    const provider = this.getProvider();
    return {
      name: this.primaryProvider,
      fallback: this.fallbackProvider,
      configured: provider ? provider.isConfigured() : false,
      capabilities: provider ? provider.getCapabilities() : {},
      available: this.getAvailableProviders()
    };
  }
}

// Export singleton instance
const manager = new EmailProviderManager();

module.exports = {
  EmailProviderManager,
  manager,
  providers,
  // Export individual providers for direct use
  SendGridProvider,
  SESProvider
};
