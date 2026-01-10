/**
 * @fileoverview SendGrid Email Provider Service
 * @description Full SendGrid API integration for email marketing
 * @module services/email-providers/sendgrid.service
 */

const log = require('../../utils/logger');

class SendGridProvider {
  constructor() {
    this.name = 'sendgrid';
    this.apiKey = process.env.SENDGRID_API_KEY;
    this.baseUrl = 'https://api.sendgrid.com/v3';
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_FROM;
    this.fromName = process.env.SENDGRID_FROM_NAME || 'BotBuilder';
  }

  /**
   * Check if provider is configured
   * @returns {boolean}
   */
  isConfigured() {
    return !!this.apiKey;
  }

  /**
   * Get provider capabilities
   * @returns {Object}
   */
  getCapabilities() {
    return {
      tracking: true,
      webhooks: true,
      templates: true,
      analytics: true,
      batchSending: true,
      scheduling: true,
      domainVerification: true,
      suppressionLists: true,
      ipWarmup: true,
      dedicatedIp: true
    };
  }

  /**
   * Make API request to SendGrid
   * @private
   */
  async _request(endpoint, method = 'GET', body = null) {
    if (!this.apiKey) {
      throw new Error('SendGrid API key not configured');
    }

    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, options);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const errorMessage = error.errors?.[0]?.message || error.message || `SendGrid API error: ${response.status}`;
      throw new Error(errorMessage);
    }

    // Some endpoints return 204 No Content
    if (response.status === 204 || response.status === 202) {
      return { success: true, messageId: response.headers.get('x-message-id') };
    }

    return response.json();
  }

  /**
   * Parse from address
   * @private
   */
  _parseFromAddress(from) {
    if (typeof from === 'object') {
      return from;
    }
    const match = from?.match(/^(.+)\s*<(.+)>$/);
    if (match) {
      return { name: match[1].trim(), email: match[2].trim() };
    }
    return { name: this.fromName, email: from || this.fromEmail };
  }

  /**
   * Send a single email
   * @param {Object} options - Email options
   * @returns {Promise<{success: boolean, messageId?: string}>}
   */
  async send(options) {
    const { to, from, subject, html, text, replyTo, headers, tags, attachments, templateId, dynamicData } = options;

    const fromParsed = this._parseFromAddress(from);

    const payload = {
      personalizations: [{
        to: Array.isArray(to) ? to.map(email => ({ email })) : [{ email: to }]
      }],
      from: fromParsed,
      subject
    };

    // Template support
    if (templateId) {
      payload.template_id = templateId;
      if (dynamicData) {
        payload.personalizations[0].dynamic_template_data = dynamicData;
      }
    } else {
      payload.content = [];
      if (text) {
        payload.content.push({ type: 'text/plain', value: text });
      }
      if (html) {
        payload.content.push({ type: 'text/html', value: html });
      }
    }

    if (replyTo) {
      payload.reply_to = typeof replyTo === 'string' ? { email: replyTo } : replyTo;
    }

    if (headers) {
      payload.headers = headers;
    }

    if (tags && tags.length > 0) {
      payload.categories = tags.slice(0, 10); // SendGrid max 10 categories
    }

    // Attachments support
    if (attachments && attachments.length > 0) {
      payload.attachments = attachments.map(att => ({
        content: att.content, // Base64 encoded
        filename: att.filename,
        type: att.type || 'application/octet-stream',
        disposition: att.disposition || 'attachment'
      }));
    }

    // Tracking settings
    payload.tracking_settings = {
      click_tracking: { enable: true, enable_text: false },
      open_tracking: { enable: true },
      subscription_tracking: { enable: false }
    };

    try {
      const result = await this._request('/mail/send', 'POST', payload);
      log.info('Email sent via SendGrid', { to, messageId: result.messageId });
      return { success: true, messageId: result.messageId, provider: 'sendgrid' };
    } catch (error) {
      log.error('SendGrid send failed', { error: error.message, to });
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
    const { batchSize = 1000, delayMs = 100 } = options;
    const results = { sent: 0, failed: 0, errors: [], messageIds: [] };

    // SendGrid supports up to 1000 recipients per request
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);

      // Group emails by template/content for efficiency
      const grouped = this._groupByContent(batch);

      for (const group of grouped) {
        try {
          const payload = this._buildBatchPayload(group);
          const result = await this._request('/mail/send', 'POST', payload);
          results.sent += group.recipients.length;
          if (result.messageId) {
            results.messageIds.push(result.messageId);
          }
        } catch (error) {
          results.failed += group.recipients.length;
          results.errors.push({
            recipients: group.recipients.map(r => r.email),
            error: error.message
          });
        }
      }

      // Rate limiting delay
      if (i + batchSize < emails.length && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }

  /**
   * Group emails by content for batch sending
   * @private
   */
  _groupByContent(emails) {
    const groups = new Map();

    for (const email of emails) {
      const key = email.templateId || `${email.subject}-${email.html?.substring(0, 100)}`;
      if (!groups.has(key)) {
        groups.set(key, {
          template: email,
          recipients: []
        });
      }
      groups.get(key).recipients.push({
        email: email.to,
        dynamicData: email.dynamicData || email.variables
      });
    }

    return Array.from(groups.values());
  }

  /**
   * Build batch payload
   * @private
   */
  _buildBatchPayload(group) {
    const { template, recipients } = group;
    const fromParsed = this._parseFromAddress(template.from);

    const payload = {
      personalizations: recipients.map(r => ({
        to: [{ email: r.email }],
        dynamic_template_data: r.dynamicData
      })),
      from: fromParsed,
      subject: template.subject
    };

    if (template.templateId) {
      payload.template_id = template.templateId;
    } else {
      payload.content = [];
      if (template.text) {
        payload.content.push({ type: 'text/plain', value: template.text });
      }
      if (template.html) {
        payload.content.push({ type: 'text/html', value: template.html });
      }
    }

    if (template.tags) {
      payload.categories = template.tags.slice(0, 10);
    }

    return payload;
  }

  /**
   * Get email status
   * @param {string} messageId - Message ID
   * @returns {Promise<Object>}
   */
  async getStatus(messageId) {
    // SendGrid requires Activity API for message status
    // This is available on Pro plans and above
    try {
      const result = await this._request(`/messages?msg_id=${messageId}`);
      return {
        messageId,
        status: result.messages?.[0]?.status || 'unknown',
        events: result.messages?.[0]?.events || []
      };
    } catch (error) {
      log.warn('Failed to get SendGrid message status', { error: error.message, messageId });
      return { messageId, status: 'unknown' };
    }
  }

  // ==========================================
  // TEMPLATE MANAGEMENT
  // ==========================================

  /**
   * List all templates
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async listTemplates(options = {}) {
    const { generations = 'dynamic', pageSize = 50 } = options;
    const result = await this._request(`/templates?generations=${generations}&page_size=${pageSize}`);
    return result.result || result.templates || [];
  }

  /**
   * Get template by ID
   * @param {string} templateId - Template ID
   * @returns {Promise<Object>}
   */
  async getTemplate(templateId) {
    return this._request(`/templates/${templateId}`);
  }

  /**
   * Create a new template
   * @param {Object} template - Template data
   * @returns {Promise<Object>}
   */
  async createTemplate(template) {
    const payload = {
      name: template.name,
      generation: 'dynamic'
    };

    const result = await this._request('/templates', 'POST', payload);

    // Create version with content
    if (template.html || template.subject) {
      await this.createTemplateVersion(result.id, {
        name: 'Version 1',
        subject: template.subject,
        html_content: template.html,
        plain_content: template.text,
        active: 1
      });
    }

    return result;
  }

  /**
   * Create template version
   * @param {string} templateId - Template ID
   * @param {Object} version - Version data
   * @returns {Promise<Object>}
   */
  async createTemplateVersion(templateId, version) {
    return this._request(`/templates/${templateId}/versions`, 'POST', version);
  }

  /**
   * Delete template
   * @param {string} templateId - Template ID
   * @returns {Promise<void>}
   */
  async deleteTemplate(templateId) {
    await this._request(`/templates/${templateId}`, 'DELETE');
  }

  // ==========================================
  // DOMAIN VERIFICATION
  // ==========================================

  /**
   * Add domain for verification
   * @param {string} domain - Domain name
   * @returns {Promise<Object>}
   */
  async addDomain(domain) {
    const payload = {
      domain,
      subdomain: 'mail',
      automatic_security: true
    };

    const result = await this._request('/whitelabel/domains', 'POST', payload);

    return {
      id: result.id,
      domain: result.domain,
      subdomain: result.subdomain,
      verified: result.valid,
      records: this._formatDnsRecords(result.dns)
    };
  }

  /**
   * Get domain verification status
   * @param {string} domainId - Domain ID
   * @returns {Promise<Object>}
   */
  async getDomainStatus(domainId) {
    const result = await this._request(`/whitelabel/domains/${domainId}`);
    return {
      id: result.id,
      domain: result.domain,
      verified: result.valid,
      records: this._formatDnsRecords(result.dns)
    };
  }

  /**
   * Verify domain DNS records
   * @param {string} domainId - Domain ID
   * @returns {Promise<Object>}
   */
  async verifyDomain(domainId) {
    const result = await this._request(`/whitelabel/domains/${domainId}/validate`, 'POST');
    return {
      valid: result.valid,
      results: result.validation_results
    };
  }

  /**
   * List all domains
   * @returns {Promise<Array>}
   */
  async listDomains() {
    const result = await this._request('/whitelabel/domains');
    return result.map(d => ({
      id: d.id,
      domain: d.domain,
      subdomain: d.subdomain,
      verified: d.valid,
      default: d.default
    }));
  }

  /**
   * Delete domain
   * @param {string} domainId - Domain ID
   * @returns {Promise<void>}
   */
  async deleteDomain(domainId) {
    await this._request(`/whitelabel/domains/${domainId}`, 'DELETE');
  }

  /**
   * Format DNS records
   * @private
   */
  _formatDnsRecords(dns) {
    if (!dns) return [];

    const records = [];
    for (const [key, value] of Object.entries(dns)) {
      if (value && value.host) {
        records.push({
          type: value.type || 'CNAME',
          name: value.host,
          value: value.data,
          valid: value.valid
        });
      }
    }
    return records;
  }

  // ==========================================
  // SUPPRESSION MANAGEMENT
  // ==========================================

  /**
   * Get bounces
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async getBounces(options = {}) {
    const { startTime, endTime, limit = 500 } = options;
    let query = `?limit=${limit}`;
    if (startTime) query += `&start_time=${startTime}`;
    if (endTime) query += `&end_time=${endTime}`;

    return this._request(`/suppression/bounces${query}`);
  }

  /**
   * Get spam reports
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async getSpamReports(options = {}) {
    const { startTime, endTime, limit = 500 } = options;
    let query = `?limit=${limit}`;
    if (startTime) query += `&start_time=${startTime}`;
    if (endTime) query += `&end_time=${endTime}`;

    return this._request(`/suppression/spam_reports${query}`);
  }

  /**
   * Get unsubscribes
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async getUnsubscribes(options = {}) {
    const { startTime, endTime, limit = 500 } = options;
    let query = `?limit=${limit}`;
    if (startTime) query += `&start_time=${startTime}`;
    if (endTime) query += `&end_time=${endTime}`;

    return this._request(`/suppression/unsubscribes${query}`);
  }

  /**
   * Add to global unsubscribe
   * @param {string} email - Email address
   * @returns {Promise<void>}
   */
  async addUnsubscribe(email) {
    await this._request('/asm/suppressions/global', 'POST', {
      recipient_emails: [email]
    });
  }

  /**
   * Remove from global unsubscribe
   * @param {string} email - Email address
   * @returns {Promise<void>}
   */
  async removeUnsubscribe(email) {
    await this._request(`/asm/suppressions/global/${email}`, 'DELETE');
  }

  // ==========================================
  // STATISTICS & ANALYTICS
  // ==========================================

  /**
   * Get global stats
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async getStats(options = {}) {
    const { startDate, endDate, aggregatedBy = 'day' } = options;

    if (!startDate) {
      throw new Error('startDate is required');
    }

    let query = `?start_date=${startDate}&aggregated_by=${aggregatedBy}`;
    if (endDate) query += `&end_date=${endDate}`;

    return this._request(`/stats${query}`);
  }

  /**
   * Get category stats
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async getCategoryStats(options = {}) {
    const { startDate, endDate, categories, aggregatedBy = 'day' } = options;

    if (!startDate) {
      throw new Error('startDate is required');
    }

    let query = `?start_date=${startDate}&aggregated_by=${aggregatedBy}`;
    if (endDate) query += `&end_date=${endDate}`;
    if (categories) query += `&categories=${categories.join(',')}`;

    return this._request(`/categories/stats${query}`);
  }

  /**
   * Get mailbox provider stats
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async getMailboxProviderStats(options = {}) {
    const { startDate, endDate, aggregatedBy = 'day' } = options;

    if (!startDate) {
      throw new Error('startDate is required');
    }

    let query = `?start_date=${startDate}&aggregated_by=${aggregatedBy}`;
    if (endDate) query += `&end_date=${endDate}`;

    return this._request(`/mailbox_providers/stats${query}`);
  }

  // ==========================================
  // SENDER VERIFICATION
  // ==========================================

  /**
   * Create sender identity
   * @param {Object} sender - Sender data
   * @returns {Promise<Object>}
   */
  async createSender(sender) {
    const payload = {
      nickname: sender.nickname || sender.name,
      from: {
        email: sender.email,
        name: sender.name
      },
      reply_to: sender.replyTo || sender.email,
      address: sender.address,
      city: sender.city,
      country: sender.country
    };

    return this._request('/verified_senders', 'POST', payload);
  }

  /**
   * List verified senders
   * @returns {Promise<Array>}
   */
  async listSenders() {
    const result = await this._request('/verified_senders');
    return result.results || [];
  }

  /**
   * Delete sender
   * @param {string} senderId - Sender ID
   * @returns {Promise<void>}
   */
  async deleteSender(senderId) {
    await this._request(`/verified_senders/${senderId}`, 'DELETE');
  }

  // ==========================================
  // WEBHOOK MANAGEMENT
  // ==========================================

  /**
   * Get event webhook settings
   * @returns {Promise<Object>}
   */
  async getWebhookSettings() {
    return this._request('/user/webhooks/event/settings');
  }

  /**
   * Update event webhook settings
   * @param {Object} settings - Webhook settings
   * @returns {Promise<Object>}
   */
  async updateWebhookSettings(settings) {
    return this._request('/user/webhooks/event/settings', 'PATCH', settings);
  }

  /**
   * Test connection
   * @returns {Promise<{connected: boolean, error?: string}>}
   */
  async testConnection() {
    try {
      await this._request('/user/profile');
      return { connected: true };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }
}

module.exports = SendGridProvider;
