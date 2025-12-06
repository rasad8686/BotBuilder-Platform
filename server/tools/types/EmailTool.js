/**
 * EmailTool - SMTP email sending tool with templates and attachments
 */

const nodemailer = require('nodemailer');

class EmailTool {
  constructor(config = {}) {
    this.config = {
      ...config
    };
    this.transporter = null;
  }

  /**
   * Get or create SMTP transporter
   */
  getTransporter(smtpConfig) {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port || 587,
        secure: smtpConfig.secure || false,
        auth: smtpConfig.auth ? {
          user: smtpConfig.auth.user,
          pass: smtpConfig.auth.pass
        } : undefined,
        tls: smtpConfig.tls || {
          rejectUnauthorized: false
        }
      });
    }
    return this.transporter;
  }

  /**
   * Execute email sending
   */
  async execute(input, context = {}) {
    const {
      to,
      cc,
      bcc,
      from,
      replyTo,
      subject,
      text,
      html,
      template,
      templateData,
      attachments,
      priority,
      headers
    } = input;

    const smtpConfig = this.config.smtp || input.smtp;

    if (!smtpConfig) {
      throw new Error('SMTP configuration is required');
    }

    if (!to) {
      throw new Error('Recipient (to) is required');
    }

    if (!subject) {
      throw new Error('Subject is required');
    }

    // Build email content
    let emailHtml = html;
    let emailText = text;

    if (template && templateData) {
      const rendered = this.renderTemplate(template, templateData);
      emailHtml = rendered.html || emailHtml;
      emailText = rendered.text || emailText;
    }

    if (!emailHtml && !emailText) {
      throw new Error('Email body (text or html) is required');
    }

    // Build mail options
    const mailOptions = {
      from: from || this.config.defaultFrom,
      to: this.formatRecipients(to),
      subject: subject,
      text: emailText,
      html: emailHtml
    };

    if (cc) {
      mailOptions.cc = this.formatRecipients(cc);
    }

    if (bcc) {
      mailOptions.bcc = this.formatRecipients(bcc);
    }

    if (replyTo) {
      mailOptions.replyTo = replyTo;
    }

    if (priority) {
      mailOptions.priority = priority;
    }

    if (headers) {
      mailOptions.headers = headers;
    }

    if (attachments && attachments.length > 0) {
      mailOptions.attachments = this.processAttachments(attachments);
    }

    // Get transporter and send
    const transporter = this.getTransporter(smtpConfig);

    try {
      const info = await transporter.sendMail(mailOptions);

      return {
        success: true,
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
        response: info.response
      };
    } catch (error) {
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Format recipients (handle array or string)
   */
  formatRecipients(recipients) {
    if (Array.isArray(recipients)) {
      return recipients.join(', ');
    }
    return recipients;
  }

  /**
   * Process attachments
   */
  processAttachments(attachments) {
    return attachments.map(attachment => {
      if (typeof attachment === 'string') {
        // Base64 encoded content
        return {
          filename: 'attachment',
          content: attachment,
          encoding: 'base64'
        };
      }

      const result = {
        filename: attachment.filename || 'attachment'
      };

      if (attachment.content) {
        result.content = attachment.content;
        if (attachment.encoding) {
          result.encoding = attachment.encoding;
        }
      } else if (attachment.path) {
        result.path = attachment.path;
      } else if (attachment.href) {
        result.href = attachment.href;
      }

      if (attachment.contentType) {
        result.contentType = attachment.contentType;
      }

      if (attachment.cid) {
        result.cid = attachment.cid;
      }

      return result;
    });
  }

  /**
   * Render email template
   */
  renderTemplate(template, data) {
    // Simple template rendering with {{variable}} syntax
    const render = (str) => {
      if (!str) return str;

      return str.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
        const keys = path.split('.');
        let value = data;

        for (const key of keys) {
          if (value && typeof value === 'object' && key in value) {
            value = value[key];
          } else {
            return match;
          }
        }

        return this.escapeHtml(String(value));
      });
    };

    return {
      html: render(template.html),
      text: render(template.text)
    };
  }

  /**
   * Escape HTML entities
   */
  escapeHtml(str) {
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };

    return str.replace(/[&<>"']/g, char => escapeMap[char]);
  }

  /**
   * Verify SMTP connection
   */
  async verify(smtpConfig) {
    const transporter = this.getTransporter(smtpConfig || this.config.smtp);

    try {
      await transporter.verify();
      return { success: true, message: 'SMTP connection verified' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Close transporter
   */
  close() {
    if (this.transporter) {
      this.transporter.close();
      this.transporter = null;
    }
  }

  /**
   * Get input schema
   */
  static getInputSchema() {
    return {
      type: 'object',
      properties: {
        to: {
          oneOf: [
            { type: 'string', format: 'email' },
            { type: 'array', items: { type: 'string', format: 'email' } }
          ],
          description: 'Recipient email address(es)'
        },
        cc: {
          oneOf: [
            { type: 'string', format: 'email' },
            { type: 'array', items: { type: 'string', format: 'email' } }
          ],
          description: 'CC recipient(s)'
        },
        bcc: {
          oneOf: [
            { type: 'string', format: 'email' },
            { type: 'array', items: { type: 'string', format: 'email' } }
          ],
          description: 'BCC recipient(s)'
        },
        from: {
          type: 'string',
          description: 'Sender email address'
        },
        replyTo: {
          type: 'string',
          format: 'email',
          description: 'Reply-To address'
        },
        subject: {
          type: 'string',
          description: 'Email subject'
        },
        text: {
          type: 'string',
          description: 'Plain text body'
        },
        html: {
          type: 'string',
          description: 'HTML body'
        },
        template: {
          type: 'object',
          properties: {
            html: { type: 'string' },
            text: { type: 'string' }
          },
          description: 'Email template with {{variable}} placeholders'
        },
        templateData: {
          type: 'object',
          description: 'Data to fill template placeholders'
        },
        attachments: {
          type: 'array',
          items: {
            oneOf: [
              { type: 'string' },
              {
                type: 'object',
                properties: {
                  filename: { type: 'string' },
                  content: { type: 'string' },
                  path: { type: 'string' },
                  href: { type: 'string' },
                  encoding: { type: 'string' },
                  contentType: { type: 'string' },
                  cid: { type: 'string' }
                }
              }
            ]
          },
          description: 'Email attachments'
        },
        priority: {
          type: 'string',
          enum: ['high', 'normal', 'low'],
          description: 'Email priority'
        },
        headers: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Custom email headers'
        }
      },
      required: ['to', 'subject']
    };
  }

  /**
   * Get output schema
   */
  static getOutputSchema() {
    return {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether email was sent successfully'
        },
        messageId: {
          type: 'string',
          description: 'Message ID assigned by the mail server'
        },
        accepted: {
          type: 'array',
          items: { type: 'string' },
          description: 'Recipients that accepted the email'
        },
        rejected: {
          type: 'array',
          items: { type: 'string' },
          description: 'Recipients that rejected the email'
        },
        response: {
          type: 'string',
          description: 'SMTP server response'
        }
      }
    };
  }

  /**
   * Get configuration schema
   */
  static getConfigSchema() {
    return {
      type: 'object',
      properties: {
        smtp: {
          type: 'object',
          properties: {
            host: {
              type: 'string',
              description: 'SMTP server hostname'
            },
            port: {
              type: 'integer',
              default: 587,
              description: 'SMTP server port'
            },
            secure: {
              type: 'boolean',
              default: false,
              description: 'Use TLS (port 465)'
            },
            auth: {
              type: 'object',
              properties: {
                user: { type: 'string' },
                pass: { type: 'string' }
              },
              required: ['user', 'pass'],
              description: 'SMTP authentication'
            },
            tls: {
              type: 'object',
              properties: {
                rejectUnauthorized: { type: 'boolean', default: false }
              }
            }
          },
          required: ['host'],
          description: 'SMTP server configuration'
        },
        defaultFrom: {
          type: 'string',
          description: 'Default sender address'
        }
      }
    };
  }
}

module.exports = EmailTool;
