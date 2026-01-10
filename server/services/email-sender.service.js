/**
 * @fileoverview Email Sender Service (ESP Abstraction Layer)
 * @description Handles actual email delivery through various ESPs (SendGrid, AWS SES, Resend, SMTP)
 * @module services/email-sender.service
 */

const nodemailer = require('nodemailer');
const log = require('../utils/logger');
const emailBounceService = require('./email-bounce.service');

class EmailSenderService {
  constructor() {
    this.provider = process.env.EMAIL_PROVIDER || 'smtp';
    this.initialized = false;
    this.transporter = null;
  }

  /**
   * Initialize the email transporter based on provider
   */
  async initialize() {
    if (this.initialized) return;

    switch (this.provider) {
      case 'sendgrid':
        this.initSendGrid();
        break;
      case 'ses':
        this.initSES();
        break;
      case 'resend':
        this.initResend();
        break;
      case 'smtp':
      default:
        this.initSMTP();
        break;
    }

    this.initialized = true;
  }

  /**
   * Initialize SendGrid
   */
  initSendGrid() {
    this.sendGridApiKey = process.env.SENDGRID_API_KEY;
    if (!this.sendGridApiKey) {
      log.warn('SendGrid API key not configured, falling back to console logging');
    }
  }

  /**
   * Initialize AWS SES
   */
  initSES() {
    this.sesConfig = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1'
    };

    if (!this.sesConfig.accessKeyId || !this.sesConfig.secretAccessKey) {
      log.warn('AWS SES credentials not configured, falling back to console logging');
    }
  }

  /**
   * Initialize Resend
   */
  initResend() {
    this.resendApiKey = process.env.RESEND_API_KEY;
    if (!this.resendApiKey) {
      log.warn('Resend API key not configured, falling back to console logging');
    }
  }

  /**
   * Initialize SMTP transporter
   */
  initSMTP() {
    const smtpConfig = {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      } : undefined
    };

    if (smtpConfig.host && smtpConfig.host !== 'localhost') {
      this.transporter = nodemailer.createTransport(smtpConfig);
    } else {
      log.warn('SMTP not configured, falling back to console logging');
    }
  }

  /**
   * Send an email via the configured provider
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email
   * @param {string} options.from - Sender (name <email>)
   * @param {string} options.subject - Email subject
   * @param {string} options.html - HTML content
   * @param {string} [options.text] - Plain text content
   * @param {string} [options.replyTo] - Reply-to address
   * @param {Object} [options.headers] - Custom headers
   * @param {string[]} [options.tags] - Email tags for tracking
   * @returns {Promise<{success: boolean, messageId?: string}>}
   */
  async send(options) {
    await this.initialize();

    const { to, from, subject, html, text, replyTo, headers, tags } = options;

    switch (this.provider) {
      case 'sendgrid':
        return this.sendViaSendGrid(options);
      case 'ses':
        return this.sendViaSES(options);
      case 'resend':
        return this.sendViaResend(options);
      case 'smtp':
      default:
        return this.sendViaSMTP(options);
    }
  }

  /**
   * Send an email with blacklist check
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email
   * @param {string} options.from - Sender (name <email>)
   * @param {string} options.subject - Email subject
   * @param {string} options.html - HTML content
   * @param {number} options.workspaceId - Workspace ID for blacklist check
   * @param {string} [options.text] - Plain text content
   * @param {string} [options.replyTo] - Reply-to address
   * @param {Object} [options.headers] - Custom headers
   * @param {string[]} [options.tags] - Email tags for tracking
   * @param {boolean} [options.skipBlacklistCheck] - Skip blacklist check (use with caution)
   * @returns {Promise<{success: boolean, messageId?: string, skipped?: boolean, reason?: string}>}
   */
  async sendWithBlacklistCheck(options) {
    const { to, workspaceId, skipBlacklistCheck = false } = options;

    // Check blacklist before sending
    if (!skipBlacklistCheck && workspaceId) {
      try {
        const isBlacklisted = await emailBounceService.isBlacklisted(to, workspaceId);

        if (isBlacklisted) {
          log.info(`Email skipped - blacklisted: ${to}`, { workspaceId });
          return {
            success: false,
            skipped: true,
            reason: 'Email is blacklisted'
          };
        }
      } catch (error) {
        log.warn('Blacklist check failed, proceeding with send', { error: error.message, to });
        // Continue with send if blacklist check fails
      }
    }

    // Proceed with sending
    return this.send(options);
  }

  /**
   * Filter blacklisted emails from a list
   * @param {string[]} emails - Array of email addresses
   * @param {number} workspaceId - Workspace ID
   * @returns {Promise<{valid: string[], blacklisted: string[]}>}
   */
  async filterBlacklistedEmails(emails, workspaceId) {
    if (!workspaceId) {
      return { valid: emails, blacklisted: [] };
    }

    try {
      return await emailBounceService.filterBlacklistedEmails(emails, workspaceId);
    } catch (error) {
      log.warn('Failed to filter blacklisted emails', { error: error.message });
      return { valid: emails, blacklisted: [] };
    }
  }

  /**
   * Send via SendGrid
   */
  async sendViaSendGrid(options) {
    if (!this.sendGridApiKey) {
      return this.logEmailToConsole(options);
    }

    const { to, from, subject, html, text, replyTo, headers, tags } = options;

    try {
      const payload = {
        personalizations: [{
          to: [{ email: to }]
        }],
        from: this.parseFromAddress(from),
        subject,
        content: [
          { type: 'text/html', value: html }
        ]
      };

      if (text) {
        payload.content.unshift({ type: 'text/plain', value: text });
      }

      if (replyTo) {
        payload.reply_to = { email: replyTo };
      }

      if (headers) {
        payload.headers = headers;
      }

      if (tags && tags.length > 0) {
        payload.categories = tags;
      }

      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.sendGridApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.errors?.[0]?.message || 'SendGrid API error');
      }

      const messageId = response.headers.get('x-message-id');
      log.info('Email sent via SendGrid', { to, messageId });

      return { success: true, messageId };
    } catch (error) {
      log.error('SendGrid send failed', { error: error.message, to });
      throw error;
    }
  }

  /**
   * Send via AWS SES
   */
  async sendViaSES(options) {
    if (!this.sesConfig.accessKeyId) {
      return this.logEmailToConsole(options);
    }

    const { to, from, subject, html, text, replyTo, headers } = options;

    try {
      // Dynamic import for AWS SDK
      const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');

      const client = new SESClient({
        region: this.sesConfig.region,
        credentials: {
          accessKeyId: this.sesConfig.accessKeyId,
          secretAccessKey: this.sesConfig.secretAccessKey
        }
      });

      const fromParsed = this.parseFromAddress(from);

      const params = {
        Source: `${fromParsed.name} <${fromParsed.email}>`,
        Destination: {
          ToAddresses: [to]
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Data: html,
              Charset: 'UTF-8'
            }
          }
        }
      };

      if (text) {
        params.Message.Body.Text = {
          Data: text,
          Charset: 'UTF-8'
        };
      }

      if (replyTo) {
        params.ReplyToAddresses = [replyTo];
      }

      const command = new SendEmailCommand(params);
      const response = await client.send(command);

      log.info('Email sent via AWS SES', { to, messageId: response.MessageId });

      return { success: true, messageId: response.MessageId };
    } catch (error) {
      log.error('AWS SES send failed', { error: error.message, to });
      throw error;
    }
  }

  /**
   * Send via Resend
   */
  async sendViaResend(options) {
    if (!this.resendApiKey) {
      return this.logEmailToConsole(options);
    }

    const { to, from, subject, html, text, replyTo, headers, tags } = options;

    try {
      const payload = {
        from,
        to: [to],
        subject,
        html
      };

      if (text) {
        payload.text = text;
      }

      if (replyTo) {
        payload.reply_to = replyTo;
      }

      if (headers) {
        payload.headers = headers;
      }

      if (tags && tags.length > 0) {
        payload.tags = tags.map(tag => ({ name: tag, value: 'true' }));
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Resend API error');
      }

      const result = await response.json();
      log.info('Email sent via Resend', { to, messageId: result.id });

      return { success: true, messageId: result.id };
    } catch (error) {
      log.error('Resend send failed', { error: error.message, to });
      throw error;
    }
  }

  /**
   * Send via SMTP
   */
  async sendViaSMTP(options) {
    if (!this.transporter) {
      return this.logEmailToConsole(options);
    }

    const { to, from, subject, html, text, replyTo, headers } = options;

    try {
      const mailOptions = {
        from,
        to,
        subject,
        html
      };

      if (text) {
        mailOptions.text = text;
      }

      if (replyTo) {
        mailOptions.replyTo = replyTo;
      }

      if (headers) {
        mailOptions.headers = headers;
      }

      const info = await this.transporter.sendMail(mailOptions);
      log.info('Email sent via SMTP', { to, messageId: info.messageId });

      return { success: true, messageId: info.messageId };
    } catch (error) {
      log.error('SMTP send failed', { error: error.message, to });
      throw error;
    }
  }

  /**
   * Log email to console (development fallback)
   */
  logEmailToConsole(options) {
    const { to, from, subject, html, text } = options;

    log.info('========================================');
    log.info('EMAIL (Development Mode - No ESP Configured)');
    log.info('========================================');
    log.info(`Provider: ${this.provider}`);
    log.info(`From: ${from}`);
    log.info(`To: ${to}`);
    log.info(`Subject: ${subject}`);
    log.info(`Body: ${text || html?.substring(0, 500)}...`);
    log.info('========================================');

    return { success: true, messageId: `dev-${Date.now()}`, dev: true };
  }

  /**
   * Parse from address string into name and email
   */
  parseFromAddress(from) {
    const match = from.match(/^(.+)\s*<(.+)>$/);
    if (match) {
      return { name: match[1].trim(), email: match[2].trim() };
    }
    return { name: '', email: from };
  }

  /**
   * Send bulk emails (batch processing)
   * @param {Array<Object>} emails - Array of email options
   * @param {number} [batchSize=100] - Number of emails per batch
   * @param {number} [delayMs=1000] - Delay between batches
   */
  async sendBulk(emails, batchSize = 100, delayMs = 1000) {
    const results = { sent: 0, failed: 0, skipped: 0, errors: [] };

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);

      const batchPromises = batch.map(async (email) => {
        try {
          await this.send(email);
          results.sent++;
        } catch (error) {
          results.failed++;
          results.errors.push({ email: email.to, error: error.message });
        }
      });

      await Promise.all(batchPromises);

      // Delay between batches to avoid rate limiting
      if (i + batchSize < emails.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }

  /**
   * Send bulk emails with blacklist filtering
   * @param {Array<Object>} emails - Array of email options
   * @param {number} workspaceId - Workspace ID for blacklist check
   * @param {number} [batchSize=100] - Number of emails per batch
   * @param {number} [delayMs=1000] - Delay between batches
   */
  async sendBulkWithBlacklistCheck(emails, workspaceId, batchSize = 100, delayMs = 1000) {
    const results = { sent: 0, failed: 0, skipped: 0, errors: [], skippedEmails: [] };

    // Pre-filter blacklisted emails
    if (workspaceId) {
      try {
        const emailAddresses = emails.map(e => e.to);
        const { valid, blacklisted } = await this.filterBlacklistedEmails(emailAddresses, workspaceId);

        // Filter out blacklisted from send queue
        const blacklistedSet = new Set(blacklisted.map(e => e.toLowerCase()));
        const validEmails = emails.filter(e => !blacklistedSet.has(e.to.toLowerCase()));

        results.skipped = blacklisted.length;
        results.skippedEmails = blacklisted;

        if (blacklisted.length > 0) {
          log.info(`Filtered ${blacklisted.length} blacklisted emails from bulk send`, { workspaceId });
        }

        // Send only valid emails
        for (let i = 0; i < validEmails.length; i += batchSize) {
          const batch = validEmails.slice(i, i + batchSize);

          const batchPromises = batch.map(async (email) => {
            try {
              await this.send(email);
              results.sent++;
            } catch (error) {
              results.failed++;
              results.errors.push({ email: email.to, error: error.message });
            }
          });

          await Promise.all(batchPromises);

          // Delay between batches to avoid rate limiting
          if (i + batchSize < validEmails.length) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        }
      } catch (error) {
        log.warn('Blacklist filtering failed, proceeding with all emails', { error: error.message });
        // Fall back to regular bulk send
        return this.sendBulk(emails, batchSize, delayMs);
      }
    } else {
      // No workspace ID, send all
      return this.sendBulk(emails, batchSize, delayMs);
    }

    return results;
  }

  /**
   * Verify domain for email sending
   * @param {string} domain - Domain to verify
   */
  async verifyDomain(domain) {
    switch (this.provider) {
      case 'sendgrid':
        return this.verifyDomainSendGrid(domain);
      case 'ses':
        return this.verifyDomainSES(domain);
      case 'resend':
        return this.verifyDomainResend(domain);
      default:
        return { verified: true, records: [] }; // SMTP doesn't need verification
    }
  }

  /**
   * Verify domain via SendGrid
   */
  async verifyDomainSendGrid(domain) {
    if (!this.sendGridApiKey) {
      throw new Error('SendGrid API key not configured');
    }

    try {
      const response = await fetch('https://api.sendgrid.com/v3/whitelabel/domains', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.sendGridApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          domain,
          subdomain: 'mail',
          automatic_security: true
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.errors?.[0]?.message || 'Failed to verify domain');
      }

      const result = await response.json();

      return {
        id: result.id,
        domain: result.domain,
        verified: result.valid,
        records: result.dns
      };
    } catch (error) {
      log.error('SendGrid domain verification failed', { error: error.message, domain });
      throw error;
    }
  }

  /**
   * Verify domain via AWS SES
   */
  async verifyDomainSES(domain) {
    if (!this.sesConfig.accessKeyId) {
      throw new Error('AWS SES credentials not configured');
    }

    try {
      const { SESClient, VerifyDomainIdentityCommand, GetIdentityVerificationAttributesCommand } = await import('@aws-sdk/client-ses');

      const client = new SESClient({
        region: this.sesConfig.region,
        credentials: {
          accessKeyId: this.sesConfig.accessKeyId,
          secretAccessKey: this.sesConfig.secretAccessKey
        }
      });

      // Start domain verification
      const verifyCommand = new VerifyDomainIdentityCommand({ Domain: domain });
      const verifyResult = await client.send(verifyCommand);

      // Get verification status
      const statusCommand = new GetIdentityVerificationAttributesCommand({
        Identities: [domain]
      });
      const statusResult = await client.send(statusCommand);

      const status = statusResult.VerificationAttributes?.[domain];

      return {
        domain,
        verified: status?.VerificationStatus === 'Success',
        token: verifyResult.VerificationToken,
        records: [{
          type: 'TXT',
          name: `_amazonses.${domain}`,
          value: verifyResult.VerificationToken
        }]
      };
    } catch (error) {
      log.error('AWS SES domain verification failed', { error: error.message, domain });
      throw error;
    }
  }

  /**
   * Verify domain via Resend
   */
  async verifyDomainResend(domain) {
    if (!this.resendApiKey) {
      throw new Error('Resend API key not configured');
    }

    try {
      const response = await fetch('https://api.resend.com/domains', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: domain })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to verify domain');
      }

      const result = await response.json();

      return {
        id: result.id,
        domain: result.name,
        verified: result.status === 'verified',
        records: result.records
      };
    } catch (error) {
      log.error('Resend domain verification failed', { error: error.message, domain });
      throw error;
    }
  }

  /**
   * Get domain verification status
   * @param {string} domain - Domain to check
   */
  async getDomainStatus(domain) {
    switch (this.provider) {
      case 'sendgrid':
        return this.getDomainStatusSendGrid(domain);
      case 'ses':
        return this.getDomainStatusSES(domain);
      case 'resend':
        return this.getDomainStatusResend(domain);
      default:
        return { domain, verified: true, status: 'active' };
    }
  }

  /**
   * Get domain status via SendGrid
   */
  async getDomainStatusSendGrid(domain) {
    if (!this.sendGridApiKey) {
      throw new Error('SendGrid API key not configured');
    }

    try {
      const response = await fetch('https://api.sendgrid.com/v3/whitelabel/domains', {
        headers: {
          'Authorization': `Bearer ${this.sendGridApiKey}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get domains');
      }

      const domains = await response.json();
      const found = domains.find(d => d.domain === domain);

      return {
        domain,
        verified: found?.valid || false,
        status: found?.valid ? 'active' : 'pending',
        records: found?.dns
      };
    } catch (error) {
      log.error('Failed to get SendGrid domain status', { error: error.message, domain });
      throw error;
    }
  }

  /**
   * Get domain status via AWS SES
   */
  async getDomainStatusSES(domain) {
    if (!this.sesConfig.accessKeyId) {
      throw new Error('AWS SES credentials not configured');
    }

    try {
      const { SESClient, GetIdentityVerificationAttributesCommand } = await import('@aws-sdk/client-ses');

      const client = new SESClient({
        region: this.sesConfig.region,
        credentials: {
          accessKeyId: this.sesConfig.accessKeyId,
          secretAccessKey: this.sesConfig.secretAccessKey
        }
      });

      const command = new GetIdentityVerificationAttributesCommand({
        Identities: [domain]
      });
      const result = await client.send(command);

      const status = result.VerificationAttributes?.[domain];

      return {
        domain,
        verified: status?.VerificationStatus === 'Success',
        status: status?.VerificationStatus?.toLowerCase() || 'unknown'
      };
    } catch (error) {
      log.error('Failed to get SES domain status', { error: error.message, domain });
      throw error;
    }
  }

  /**
   * Get domain status via Resend
   */
  async getDomainStatusResend(domain) {
    if (!this.resendApiKey) {
      throw new Error('Resend API key not configured');
    }

    try {
      const response = await fetch('https://api.resend.com/domains', {
        headers: {
          'Authorization': `Bearer ${this.resendApiKey}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get domains');
      }

      const result = await response.json();
      const found = result.data?.find(d => d.name === domain);

      return {
        domain,
        verified: found?.status === 'verified',
        status: found?.status || 'unknown',
        records: found?.records
      };
    } catch (error) {
      log.error('Failed to get Resend domain status', { error: error.message, domain });
      throw error;
    }
  }

  /**
   * Get provider info
   */
  getProviderInfo() {
    return {
      provider: this.provider,
      configured: this.isConfigured(),
      features: this.getProviderFeatures()
    };
  }

  /**
   * Check if provider is configured
   */
  isConfigured() {
    switch (this.provider) {
      case 'sendgrid':
        return !!this.sendGridApiKey;
      case 'ses':
        return !!(this.sesConfig?.accessKeyId && this.sesConfig?.secretAccessKey);
      case 'resend':
        return !!this.resendApiKey;
      case 'smtp':
        return !!this.transporter;
      default:
        return false;
    }
  }

  /**
   * Get provider features
   */
  getProviderFeatures() {
    const features = {
      sendgrid: {
        tracking: true,
        webhooks: true,
        templates: true,
        analytics: true
      },
      ses: {
        tracking: true,
        webhooks: true,
        templates: true,
        analytics: true
      },
      resend: {
        tracking: true,
        webhooks: true,
        templates: false,
        analytics: true
      },
      smtp: {
        tracking: false,
        webhooks: false,
        templates: false,
        analytics: false
      }
    };

    return features[this.provider] || features.smtp;
  }
}

module.exports = new EmailSenderService();
