/**
 * Email Tool for Autonomous Agents
 * Sends emails via SMTP
 */

const nodemailer = require('nodemailer');
const log = require('../../../utils/logger');

class EmailTool {
  constructor() {
    this.name = 'send_email';
    this.description = 'Send emails via SMTP';
    this.parameters = {
      to: {
        type: 'string',
        required: true,
        description: 'Recipient email address(es), comma-separated for multiple'
      },
      subject: {
        type: 'string',
        required: true,
        description: 'Email subject'
      },
      body: {
        type: 'string',
        required: true,
        description: 'Email body content'
      },
      html: {
        type: 'boolean',
        required: false,
        description: 'Whether body is HTML',
        default: false
      },
      cc: {
        type: 'string',
        required: false,
        description: 'CC recipients, comma-separated'
      },
      bcc: {
        type: 'string',
        required: false,
        description: 'BCC recipients, comma-separated'
      },
      replyTo: {
        type: 'string',
        required: false,
        description: 'Reply-to email address'
      },
      attachments: {
        type: 'array',
        required: false,
        description: 'Array of attachment objects with filename and content'
      }
    };

    // SMTP configuration from environment
    this.smtpConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    };

    this.fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
  }

  /**
   * Execute email send
   */
  async execute(params, context = {}) {
    const {
      to,
      subject,
      body,
      html = false,
      cc,
      bcc,
      replyTo,
      attachments
    } = params;

    // Validate required fields
    if (!to || !subject || !body) {
      return {
        success: false,
        error: 'Missing required fields: to, subject, body'
      };
    }

    // Check if SMTP is configured
    if (!this.smtpConfig.auth.user || !this.smtpConfig.auth.pass) {
      log.warn('EmailTool: SMTP not configured, simulating send');
      return this.simulateSend(params, context);
    }

    // Validate email addresses
    const recipients = to.split(',').map(e => e.trim());
    for (const email of recipients) {
      if (!this.isValidEmail(email)) {
        return {
          success: false,
          error: `Invalid email address: ${email}`
        };
      }
    }

    const startTime = Date.now();

    try {
      log.info('EmailTool: Sending email', { to, subject });

      // Create transporter
      const transporter = nodemailer.createTransport(this.smtpConfig);

      // Build email options
      const mailOptions = {
        from: this.fromAddress,
        to: recipients.join(', '),
        subject: subject
      };

      // Set body type
      if (html) {
        mailOptions.html = body;
      } else {
        mailOptions.text = body;
      }

      // Optional fields
      if (cc) {
        mailOptions.cc = cc.split(',').map(e => e.trim()).join(', ');
      }

      if (bcc) {
        mailOptions.bcc = bcc.split(',').map(e => e.trim()).join(', ');
      }

      if (replyTo) {
        mailOptions.replyTo = replyTo;
      }

      // Handle attachments
      if (attachments && Array.isArray(attachments)) {
        mailOptions.attachments = attachments.map(att => ({
          filename: att.filename,
          content: att.content,
          encoding: att.encoding || 'base64'
        }));
      }

      // Send email
      const info = await transporter.sendMail(mailOptions);
      const duration = Date.now() - startTime;

      // Log execution
      this.logExecution(context, {
        to,
        subject,
        messageId: info.messageId,
        duration,
        success: true
      });

      log.info('EmailTool: Email sent successfully', {
        messageId: info.messageId,
        to,
        duration
      });

      return {
        success: true,
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      log.error('EmailTool: Failed to send email', {
        to,
        subject,
        error: error.message,
        duration
      });

      // Log failed execution
      this.logExecution(context, {
        to,
        subject,
        error: error.message,
        duration,
        success: false
      });

      return {
        success: false,
        error: error.message,
        duration
      };
    }
  }

  /**
   * Simulate email send (when SMTP not configured)
   */
  simulateSend(params, context) {
    const { to, subject, body, html } = params;

    log.info('EmailTool: Simulating email send', { to, subject });

    // Log simulated execution
    this.logExecution(context, {
      to,
      subject,
      simulated: true,
      success: true
    });

    return {
      success: true,
      simulated: true,
      message: 'Email simulated (SMTP not configured)',
      preview: {
        to,
        subject,
        bodyPreview: body.substring(0, 100) + (body.length > 100 ? '...' : ''),
        isHtml: html
      }
    };
  }

  /**
   * Validate email format
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Log tool execution
   */
  logExecution(context, details) {
    if (!context.toolLogs) {
      context.toolLogs = [];
    }

    context.toolLogs.push({
      tool: this.name,
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  /**
   * Get tool definition for registry
   */
  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: this.parameters,
      execute: this.execute.bind(this)
    };
  }
}

module.exports = EmailTool;
