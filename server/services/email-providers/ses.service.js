/**
 * @fileoverview AWS SES Email Provider Service
 * @description Full AWS SES API integration for email marketing
 * @module services/email-providers/ses.service
 */

const log = require('../../utils/logger');

class SESProvider {
  constructor() {
    this.name = 'ses';
    this.config = {
      accessKeyId: process.env.AWS_SES_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SES_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_SES_REGION || process.env.AWS_REGION || 'us-east-1'
    };
    this.fromEmail = process.env.SES_FROM_EMAIL || process.env.EMAIL_FROM;
    this.fromName = process.env.SES_FROM_NAME || 'BotBuilder';
    this.client = null;
    this.sesV2Client = null;
  }

  /**
   * Check if provider is configured
   * @returns {boolean}
   */
  isConfigured() {
    return !!(this.config.accessKeyId && this.config.secretAccessKey);
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
      scheduling: false, // SES doesn't have native scheduling
      domainVerification: true,
      suppressionLists: true,
      ipWarmup: true,
      dedicatedIp: true,
      configurationSets: true
    };
  }

  /**
   * Initialize SES client lazily
   * @private
   */
  async _getClient() {
    if (!this.client) {
      const { SESClient } = await import('@aws-sdk/client-ses');
      this.client = new SESClient({
        region: this.config.region,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey
        }
      });
    }
    return this.client;
  }

  /**
   * Initialize SES v2 client lazily
   * @private
   */
  async _getV2Client() {
    if (!this.sesV2Client) {
      const { SESv2Client } = await import('@aws-sdk/client-sesv2');
      this.sesV2Client = new SESv2Client({
        region: this.config.region,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey
        }
      });
    }
    return this.sesV2Client;
  }

  /**
   * Parse from address
   * @private
   */
  _parseFromAddress(from) {
    if (typeof from === 'object') {
      return `${from.name} <${from.email}>`;
    }
    const match = from?.match(/^(.+)\s*<(.+)>$/);
    if (match) {
      return from;
    }
    return `${this.fromName} <${from || this.fromEmail}>`;
  }

  /**
   * Send a single email
   * @param {Object} options - Email options
   * @returns {Promise<{success: boolean, messageId?: string}>}
   */
  async send(options) {
    if (!this.isConfigured()) {
      throw new Error('AWS SES credentials not configured');
    }

    const { to, from, subject, html, text, replyTo, headers, tags, attachments, templateName, templateData, configurationSet } = options;

    const client = await this._getClient();
    const fromAddress = this._parseFromAddress(from);

    try {
      // Use template if provided
      if (templateName) {
        return this._sendTemplatedEmail(options);
      }

      // Build email with potential attachments
      if (attachments && attachments.length > 0) {
        return this._sendRawEmail(options);
      }

      // Simple email
      const { SendEmailCommand } = await import('@aws-sdk/client-ses');

      const params = {
        Source: fromAddress,
        Destination: {
          ToAddresses: Array.isArray(to) ? to : [to]
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8'
          },
          Body: {}
        }
      };

      if (html) {
        params.Message.Body.Html = {
          Data: html,
          Charset: 'UTF-8'
        };
      }

      if (text) {
        params.Message.Body.Text = {
          Data: text,
          Charset: 'UTF-8'
        };
      }

      if (replyTo) {
        params.ReplyToAddresses = Array.isArray(replyTo) ? replyTo : [replyTo];
      }

      if (tags && tags.length > 0) {
        params.Tags = tags.map(tag => ({
          Name: typeof tag === 'string' ? tag : tag.name,
          Value: typeof tag === 'string' ? 'true' : tag.value
        }));
      }

      if (configurationSet || process.env.SES_CONFIGURATION_SET) {
        params.ConfigurationSetName = configurationSet || process.env.SES_CONFIGURATION_SET;
      }

      const command = new SendEmailCommand(params);
      const response = await client.send(command);

      log.info('Email sent via AWS SES', { to, messageId: response.MessageId });

      return {
        success: true,
        messageId: response.MessageId,
        provider: 'ses'
      };
    } catch (error) {
      log.error('AWS SES send failed', { error: error.message, to });
      throw error;
    }
  }

  /**
   * Send templated email
   * @private
   */
  async _sendTemplatedEmail(options) {
    const { to, from, templateName, templateData, replyTo, tags, configurationSet } = options;

    const client = await this._getClient();
    const { SendTemplatedEmailCommand } = await import('@aws-sdk/client-ses');

    const params = {
      Source: this._parseFromAddress(from),
      Destination: {
        ToAddresses: Array.isArray(to) ? to : [to]
      },
      Template: templateName,
      TemplateData: JSON.stringify(templateData || {})
    };

    if (replyTo) {
      params.ReplyToAddresses = Array.isArray(replyTo) ? replyTo : [replyTo];
    }

    if (tags && tags.length > 0) {
      params.Tags = tags.map(tag => ({
        Name: typeof tag === 'string' ? tag : tag.name,
        Value: typeof tag === 'string' ? 'true' : tag.value
      }));
    }

    if (configurationSet || process.env.SES_CONFIGURATION_SET) {
      params.ConfigurationSetName = configurationSet || process.env.SES_CONFIGURATION_SET;
    }

    const command = new SendTemplatedEmailCommand(params);
    const response = await client.send(command);

    return {
      success: true,
      messageId: response.MessageId,
      provider: 'ses'
    };
  }

  /**
   * Send raw email (with attachments)
   * @private
   */
  async _sendRawEmail(options) {
    const { to, from, subject, html, text, replyTo, attachments, configurationSet } = options;

    const client = await this._getClient();
    const { SendRawEmailCommand } = await import('@aws-sdk/client-ses');

    // Build MIME message
    const boundary = `----=_Part_${Date.now()}`;
    const fromAddress = this._parseFromAddress(from);
    const toAddresses = Array.isArray(to) ? to.join(', ') : to;

    let rawMessage = [
      `From: ${fromAddress}`,
      `To: ${toAddresses}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ''
    ];

    if (replyTo) {
      rawMessage.splice(3, 0, `Reply-To: ${Array.isArray(replyTo) ? replyTo.join(', ') : replyTo}`);
    }

    // Text part
    if (text) {
      rawMessage.push(
        `--${boundary}`,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: quoted-printable',
        '',
        text,
        ''
      );
    }

    // HTML part
    if (html) {
      rawMessage.push(
        `--${boundary}`,
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: quoted-printable',
        '',
        html,
        ''
      );
    }

    // Attachments
    for (const att of attachments) {
      rawMessage.push(
        `--${boundary}`,
        `Content-Type: ${att.type || 'application/octet-stream'}; name="${att.filename}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${att.filename}"`,
        '',
        att.content, // Should be base64 encoded
        ''
      );
    }

    rawMessage.push(`--${boundary}--`);

    const params = {
      RawMessage: {
        Data: Buffer.from(rawMessage.join('\r\n'))
      },
      Destinations: Array.isArray(to) ? to : [to]
    };

    if (configurationSet || process.env.SES_CONFIGURATION_SET) {
      params.ConfigurationSetName = configurationSet || process.env.SES_CONFIGURATION_SET;
    }

    const command = new SendRawEmailCommand(params);
    const response = await client.send(command);

    return {
      success: true,
      messageId: response.MessageId,
      provider: 'ses'
    };
  }

  /**
   * Send batch emails
   * @param {Array<Object>} emails - Array of email options
   * @param {Object} options - Batch options
   * @returns {Promise<{sent: number, failed: number, errors: Array}>}
   */
  async sendBatch(emails, options = {}) {
    const { batchSize = 50, delayMs = 100 } = options; // SES has 50 destinations per request limit
    const results = { sent: 0, failed: 0, errors: [], messageIds: [] };

    // Group by template for bulk templated email
    const templatedEmails = emails.filter(e => e.templateName);
    const regularEmails = emails.filter(e => !e.templateName);

    // Send templated emails in bulk
    if (templatedEmails.length > 0) {
      const bulkResults = await this._sendBulkTemplatedEmail(templatedEmails, options);
      results.sent += bulkResults.sent;
      results.failed += bulkResults.failed;
      results.errors.push(...bulkResults.errors);
      results.messageIds.push(...bulkResults.messageIds);
    }

    // Send regular emails individually (SES limitation)
    for (let i = 0; i < regularEmails.length; i += batchSize) {
      const batch = regularEmails.slice(i, i + batchSize);

      const batchPromises = batch.map(async (email) => {
        try {
          const result = await this.send(email);
          results.sent++;
          if (result.messageId) {
            results.messageIds.push(result.messageId);
          }
        } catch (error) {
          results.failed++;
          results.errors.push({ email: email.to, error: error.message });
        }
      });

      await Promise.all(batchPromises);

      if (i + batchSize < regularEmails.length && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }

  /**
   * Send bulk templated emails
   * @private
   */
  async _sendBulkTemplatedEmail(emails, options = {}) {
    const results = { sent: 0, failed: 0, errors: [], messageIds: [] };

    // Group by template
    const grouped = {};
    for (const email of emails) {
      const key = email.templateName;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(email);
    }

    const client = await this._getClient();
    const { SendBulkTemplatedEmailCommand } = await import('@aws-sdk/client-ses');

    for (const [templateName, templateEmails] of Object.entries(grouped)) {
      // SES limits 50 destinations per request
      for (let i = 0; i < templateEmails.length; i += 50) {
        const batch = templateEmails.slice(i, i + 50);
        const firstEmail = batch[0];

        const params = {
          Source: this._parseFromAddress(firstEmail.from),
          Template: templateName,
          DefaultTemplateData: JSON.stringify(firstEmail.templateData || {}),
          Destinations: batch.map(email => ({
            Destination: {
              ToAddresses: [email.to]
            },
            ReplacementTemplateData: JSON.stringify(email.templateData || {})
          }))
        };

        if (process.env.SES_CONFIGURATION_SET) {
          params.ConfigurationSetName = process.env.SES_CONFIGURATION_SET;
        }

        try {
          const command = new SendBulkTemplatedEmailCommand(params);
          const response = await client.send(command);

          for (const status of response.Status) {
            if (status.Status === 'Success') {
              results.sent++;
              if (status.MessageId) {
                results.messageIds.push(status.MessageId);
              }
            } else {
              results.failed++;
              results.errors.push({
                error: status.Error || 'Unknown error'
              });
            }
          }
        } catch (error) {
          results.failed += batch.length;
          results.errors.push({ template: templateName, error: error.message });
        }
      }
    }

    return results;
  }

  /**
   * Get email status (via CloudWatch if configured)
   * @param {string} messageId - Message ID
   * @returns {Promise<Object>}
   */
  async getStatus(messageId) {
    // SES doesn't have direct message status API
    // Status tracking requires CloudWatch or Event Publishing
    return {
      messageId,
      status: 'unknown',
      note: 'Use SES Event Publishing with SNS/CloudWatch for tracking'
    };
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
    const { maxItems = 50, nextToken } = options;

    const client = await this._getClient();
    const { ListTemplatesCommand } = await import('@aws-sdk/client-ses');

    const params = { MaxItems: maxItems };
    if (nextToken) {
      params.NextToken = nextToken;
    }

    const command = new ListTemplatesCommand(params);
    const response = await client.send(command);

    return {
      templates: response.TemplatesMetadata || [],
      nextToken: response.NextToken
    };
  }

  /**
   * Get template by name
   * @param {string} templateName - Template name
   * @returns {Promise<Object>}
   */
  async getTemplate(templateName) {
    const client = await this._getClient();
    const { GetTemplateCommand } = await import('@aws-sdk/client-ses');

    const command = new GetTemplateCommand({ TemplateName: templateName });
    const response = await client.send(command);

    return response.Template;
  }

  /**
   * Create a new template
   * @param {Object} template - Template data
   * @returns {Promise<Object>}
   */
  async createTemplate(template) {
    const client = await this._getClient();
    const { CreateTemplateCommand } = await import('@aws-sdk/client-ses');

    const params = {
      Template: {
        TemplateName: template.name,
        SubjectPart: template.subject,
        HtmlPart: template.html,
        TextPart: template.text
      }
    };

    const command = new CreateTemplateCommand(params);
    await client.send(command);

    return { name: template.name, created: true };
  }

  /**
   * Update template
   * @param {Object} template - Template data
   * @returns {Promise<Object>}
   */
  async updateTemplate(template) {
    const client = await this._getClient();
    const { UpdateTemplateCommand } = await import('@aws-sdk/client-ses');

    const params = {
      Template: {
        TemplateName: template.name,
        SubjectPart: template.subject,
        HtmlPart: template.html,
        TextPart: template.text
      }
    };

    const command = new UpdateTemplateCommand(params);
    await client.send(command);

    return { name: template.name, updated: true };
  }

  /**
   * Delete template
   * @param {string} templateName - Template name
   * @returns {Promise<void>}
   */
  async deleteTemplate(templateName) {
    const client = await this._getClient();
    const { DeleteTemplateCommand } = await import('@aws-sdk/client-ses');

    const command = new DeleteTemplateCommand({ TemplateName: templateName });
    await client.send(command);
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
    const client = await this._getClient();
    const { VerifyDomainIdentityCommand, VerifyDomainDkimCommand } = await import('@aws-sdk/client-ses');

    // Verify domain identity
    const verifyCommand = new VerifyDomainIdentityCommand({ Domain: domain });
    const verifyResult = await client.send(verifyCommand);

    // Enable DKIM
    const dkimCommand = new VerifyDomainDkimCommand({ Domain: domain });
    const dkimResult = await client.send(dkimCommand);

    const records = [
      {
        type: 'TXT',
        name: `_amazonses.${domain}`,
        value: verifyResult.VerificationToken
      }
    ];

    // Add DKIM records
    if (dkimResult.DkimTokens) {
      for (const token of dkimResult.DkimTokens) {
        records.push({
          type: 'CNAME',
          name: `${token}._domainkey.${domain}`,
          value: `${token}.dkim.amazonses.com`
        });
      }
    }

    return {
      domain,
      verified: false,
      verificationToken: verifyResult.VerificationToken,
      dkimTokens: dkimResult.DkimTokens,
      records
    };
  }

  /**
   * Get domain verification status
   * @param {string} domain - Domain name
   * @returns {Promise<Object>}
   */
  async getDomainStatus(domain) {
    const client = await this._getClient();
    const { GetIdentityVerificationAttributesCommand, GetIdentityDkimAttributesCommand } = await import('@aws-sdk/client-ses');

    const verifyCommand = new GetIdentityVerificationAttributesCommand({
      Identities: [domain]
    });
    const verifyResult = await client.send(verifyCommand);

    const dkimCommand = new GetIdentityDkimAttributesCommand({
      Identities: [domain]
    });
    const dkimResult = await client.send(dkimCommand);

    const verificationStatus = verifyResult.VerificationAttributes?.[domain];
    const dkimStatus = dkimResult.DkimAttributes?.[domain];

    return {
      domain,
      verified: verificationStatus?.VerificationStatus === 'Success',
      verificationStatus: verificationStatus?.VerificationStatus,
      dkimEnabled: dkimStatus?.DkimEnabled,
      dkimVerificationStatus: dkimStatus?.DkimVerificationStatus,
      dkimTokens: dkimStatus?.DkimTokens
    };
  }

  /**
   * List all verified identities
   * @returns {Promise<Array>}
   */
  async listDomains() {
    const client = await this._getClient();
    const { ListIdentitiesCommand, GetIdentityVerificationAttributesCommand } = await import('@aws-sdk/client-ses');

    const listCommand = new ListIdentitiesCommand({ IdentityType: 'Domain' });
    const listResult = await client.send(listCommand);

    if (!listResult.Identities || listResult.Identities.length === 0) {
      return [];
    }

    const verifyCommand = new GetIdentityVerificationAttributesCommand({
      Identities: listResult.Identities
    });
    const verifyResult = await client.send(verifyCommand);

    return listResult.Identities.map(domain => ({
      domain,
      verified: verifyResult.VerificationAttributes?.[domain]?.VerificationStatus === 'Success',
      status: verifyResult.VerificationAttributes?.[domain]?.VerificationStatus
    }));
  }

  /**
   * Delete domain identity
   * @param {string} domain - Domain name
   * @returns {Promise<void>}
   */
  async deleteDomain(domain) {
    const client = await this._getClient();
    const { DeleteIdentityCommand } = await import('@aws-sdk/client-ses');

    const command = new DeleteIdentityCommand({ Identity: domain });
    await client.send(command);
  }

  // ==========================================
  // EMAIL VERIFICATION
  // ==========================================

  /**
   * Verify email address
   * @param {string} email - Email address
   * @returns {Promise<Object>}
   */
  async verifyEmail(email) {
    const client = await this._getClient();
    const { VerifyEmailIdentityCommand } = await import('@aws-sdk/client-ses');

    const command = new VerifyEmailIdentityCommand({ EmailAddress: email });
    await client.send(command);

    return { email, verificationSent: true };
  }

  /**
   * List verified email addresses
   * @returns {Promise<Array>}
   */
  async listVerifiedEmails() {
    const client = await this._getClient();
    const { ListIdentitiesCommand, GetIdentityVerificationAttributesCommand } = await import('@aws-sdk/client-ses');

    const listCommand = new ListIdentitiesCommand({ IdentityType: 'EmailAddress' });
    const listResult = await client.send(listCommand);

    if (!listResult.Identities || listResult.Identities.length === 0) {
      return [];
    }

    const verifyCommand = new GetIdentityVerificationAttributesCommand({
      Identities: listResult.Identities
    });
    const verifyResult = await client.send(verifyCommand);

    return listResult.Identities.map(email => ({
      email,
      verified: verifyResult.VerificationAttributes?.[email]?.VerificationStatus === 'Success',
      status: verifyResult.VerificationAttributes?.[email]?.VerificationStatus
    }));
  }

  // ==========================================
  // SUPPRESSION LIST
  // ==========================================

  /**
   * Get suppression list entries
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async getSuppressionList(options = {}) {
    const { reasons = ['BOUNCE', 'COMPLAINT'], pageSize = 100, nextToken } = options;

    const v2Client = await this._getV2Client();
    const { ListSuppressedDestinationsCommand } = await import('@aws-sdk/client-sesv2');

    const params = {
      Reasons: reasons,
      PageSize: pageSize
    };

    if (nextToken) {
      params.NextToken = nextToken;
    }

    const command = new ListSuppressedDestinationsCommand(params);
    const response = await v2Client.send(command);

    return {
      items: response.SuppressedDestinationSummaries || [],
      nextToken: response.NextToken
    };
  }

  /**
   * Add email to suppression list
   * @param {string} email - Email address
   * @param {string} reason - Reason (BOUNCE or COMPLAINT)
   * @returns {Promise<void>}
   */
  async addToSuppressionList(email, reason = 'BOUNCE') {
    const v2Client = await this._getV2Client();
    const { PutSuppressedDestinationCommand } = await import('@aws-sdk/client-sesv2');

    const command = new PutSuppressedDestinationCommand({
      EmailAddress: email,
      Reason: reason
    });

    await v2Client.send(command);
  }

  /**
   * Remove from suppression list
   * @param {string} email - Email address
   * @returns {Promise<void>}
   */
  async removeFromSuppressionList(email) {
    const v2Client = await this._getV2Client();
    const { DeleteSuppressedDestinationCommand } = await import('@aws-sdk/client-sesv2');

    const command = new DeleteSuppressedDestinationCommand({
      EmailAddress: email
    });

    await v2Client.send(command);
  }

  // ==========================================
  // SENDING QUOTA & STATISTICS
  // ==========================================

  /**
   * Get sending quota
   * @returns {Promise<Object>}
   */
  async getSendingQuota() {
    const client = await this._getClient();
    const { GetSendQuotaCommand } = await import('@aws-sdk/client-ses');

    const command = new GetSendQuotaCommand({});
    const response = await client.send(command);

    return {
      max24HourSend: response.Max24HourSend,
      maxSendRate: response.MaxSendRate,
      sentLast24Hours: response.SentLast24Hours
    };
  }

  /**
   * Get send statistics
   * @returns {Promise<Array>}
   */
  async getSendStatistics() {
    const client = await this._getClient();
    const { GetSendStatisticsCommand } = await import('@aws-sdk/client-ses');

    const command = new GetSendStatisticsCommand({});
    const response = await client.send(command);

    return response.SendDataPoints || [];
  }

  // ==========================================
  // CONFIGURATION SETS
  // ==========================================

  /**
   * Create configuration set
   * @param {string} name - Configuration set name
   * @returns {Promise<void>}
   */
  async createConfigurationSet(name) {
    const v2Client = await this._getV2Client();
    const { CreateConfigurationSetCommand } = await import('@aws-sdk/client-sesv2');

    const command = new CreateConfigurationSetCommand({
      ConfigurationSetName: name,
      TrackingOptions: {
        CustomRedirectDomain: undefined
      },
      ReputationOptions: {
        ReputationMetricsEnabled: true
      },
      SendingOptions: {
        SendingEnabled: true
      }
    });

    await v2Client.send(command);
  }

  /**
   * List configuration sets
   * @returns {Promise<Array>}
   */
  async listConfigurationSets() {
    const v2Client = await this._getV2Client();
    const { ListConfigurationSetsCommand } = await import('@aws-sdk/client-sesv2');

    const command = new ListConfigurationSetsCommand({});
    const response = await v2Client.send(command);

    return response.ConfigurationSets || [];
  }

  /**
   * Test connection
   * @returns {Promise<{connected: boolean, error?: string}>}
   */
  async testConnection() {
    try {
      await this.getSendingQuota();
      return { connected: true };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }
}

module.exports = SESProvider;
