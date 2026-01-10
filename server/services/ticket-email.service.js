/**
 * Ticket Email Service
 * Handles email notifications for the ticket system
 */

const fs = require('fs').promises;
const path = require('path');
const Handlebars = require('handlebars');

class TicketEmailService {
  constructor(emailService, config = {}) {
    this.emailService = emailService;
    this.config = {
      templatesPath: path.join(__dirname, '../templates/emails/tickets'),
      defaultPrimaryColor: '#7c3aed',
      defaultCompanyName: 'Support',
      ...config,
    };
    this.templateCache = new Map();
  }

  /**
   * Load and compile email template
   */
  async loadTemplate(templateName) {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName);
    }

    const templatePath = path.join(this.config.templatesPath, `${templateName}.html`);
    const templateContent = await fs.readFile(templatePath, 'utf8');
    const compiledTemplate = Handlebars.compile(templateContent);

    this.templateCache.set(templateName, compiledTemplate);
    return compiledTemplate;
  }

  /**
   * Get portal configuration for workspace
   */
  async getPortalConfig(workspaceId) {
    // This should fetch from database - simplified for now
    return {
      name: this.config.defaultCompanyName,
      primaryColor: this.config.defaultPrimaryColor,
      logo: null,
    };
  }

  /**
   * Generate portal URL for ticket
   */
  getPortalUrl(workspaceSlug) {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    return `${baseUrl}/support/${workspaceSlug}`;
  }

  /**
   * Generate ticket URL
   */
  getTicketUrl(workspaceSlug, ticketId, token) {
    const portalUrl = this.getPortalUrl(workspaceSlug);
    return `${portalUrl}/tickets/${ticketId}?token=${token}`;
  }

  /**
   * Generate satisfaction survey URL
   */
  getSatisfactionUrl(workspaceSlug, ticketId, token) {
    const portalUrl = this.getPortalUrl(workspaceSlug);
    return `${portalUrl}/satisfaction/${ticketId}?token=${token}`;
  }

  /**
   * Format date for display
   */
  formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Get initials from name
   */
  getInitials(name) {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  /**
   * Calculate duration string
   */
  calculateDuration(startDate, endDate) {
    const diff = new Date(endDate) - new Date(startDate);
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''}`;
    }
    if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    }
    return 'Less than an hour';
  }

  /**
   * Send ticket created email
   */
  async sendTicketCreatedEmail(ticket, workspace) {
    try {
      const template = await this.loadTemplate('ticket-created');
      const portalConfig = await this.getPortalConfig(workspace.id);

      const accessToken = await this.generateAccessToken(ticket.customerEmail, workspace.id);

      const emailData = {
        // Company/Portal Info
        companyName: portalConfig.name || workspace.name,
        primaryColor: portalConfig.primaryColor || this.config.defaultPrimaryColor,
        logo: portalConfig.logo,
        portalUrl: this.getPortalUrl(workspace.slug),

        // Ticket Info
        ticketNumber: ticket.number,
        subject: ticket.subject,
        description: ticket.description,
        category: ticket.category,
        createdAt: this.formatDate(ticket.createdAt),
        ticketUrl: this.getTicketUrl(workspace.slug, ticket.id, accessToken),
      };

      const html = template(emailData);

      await this.emailService.send({
        to: ticket.customerEmail,
        subject: `[Ticket #${ticket.number}] ${ticket.subject}`,
        html,
        replyTo: this.getReplyToEmail(workspace, ticket),
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to send ticket created email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send comment added email (to customer)
   */
  async sendCommentAddedEmail(ticket, comment, workspace) {
    try {
      const template = await this.loadTemplate('ticket-comment-added');
      const portalConfig = await this.getPortalConfig(workspace.id);

      const accessToken = await this.generateAccessToken(ticket.customerEmail, workspace.id);

      // Get previous messages for context
      const previousMessages = (ticket.comments || [])
        .filter(c => c.id !== comment.id)
        .slice(-3)
        .map(c => ({
          author: c.isAgent ? c.agentName : 'You',
          date: this.formatDate(c.createdAt),
          preview: c.body?.substring(0, 100) + (c.body?.length > 100 ? '...' : ''),
        }));

      const emailData = {
        // Company/Portal Info
        companyName: portalConfig.name || workspace.name,
        primaryColor: portalConfig.primaryColor || this.config.defaultPrimaryColor,
        logo: portalConfig.logo,
        portalUrl: this.getPortalUrl(workspace.slug),

        // Ticket Info
        ticketNumber: ticket.number,
        subject: ticket.subject,
        ticketUrl: this.getTicketUrl(workspace.slug, ticket.id, accessToken),
        replyToEmail: this.getReplyToEmail(workspace, ticket),

        // Agent Info
        agentName: comment.agentName || 'Support Team',
        agentAvatar: comment.agentAvatar,
        agentInitials: this.getInitials(comment.agentName),

        // Reply Content
        replyContent: comment.body,
        repliedAt: this.formatDate(comment.createdAt),
        attachments: comment.attachments,

        // Context
        previousMessages,
      };

      const html = template(emailData);

      await this.emailService.send({
        to: ticket.customerEmail,
        subject: `Re: [Ticket #${ticket.number}] ${ticket.subject}`,
        html,
        replyTo: this.getReplyToEmail(workspace, ticket),
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to send comment added email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send ticket resolved email
   */
  async sendTicketResolvedEmail(ticket, workspace, resolutionNote = null) {
    try {
      const template = await this.loadTemplate('ticket-resolved');
      const portalConfig = await this.getPortalConfig(workspace.id);

      const accessToken = await this.generateAccessToken(ticket.customerEmail, workspace.id);

      const emailData = {
        // Company/Portal Info
        companyName: portalConfig.name || workspace.name,
        primaryColor: portalConfig.primaryColor || this.config.defaultPrimaryColor,
        logo: portalConfig.logo,
        portalUrl: this.getPortalUrl(workspace.slug),

        // Ticket Info
        ticketNumber: ticket.number,
        subject: ticket.subject,
        ticketUrl: this.getTicketUrl(workspace.slug, ticket.id, accessToken),
        satisfactionUrl: this.getSatisfactionUrl(workspace.slug, ticket.id, accessToken),

        // Resolution
        resolutionNote,
      };

      const html = template(emailData);

      await this.emailService.send({
        to: ticket.customerEmail,
        subject: `[Resolved] Ticket #${ticket.number}: ${ticket.subject}`,
        html,
        replyTo: this.getReplyToEmail(workspace, ticket),
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to send ticket resolved email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send ticket closed email
   */
  async sendTicketClosedEmail(ticket, workspace, closingNote = null) {
    try {
      const template = await this.loadTemplate('ticket-closed');
      const portalConfig = await this.getPortalConfig(workspace.id);

      const accessToken = await this.generateAccessToken(ticket.customerEmail, workspace.id);

      // Calculate stats
      const messageCount = (ticket.comments || []).length + 1; // +1 for initial message
      const agentsInvolved = new Set(
        (ticket.comments || [])
          .filter(c => c.isAgent)
          .map(c => c.agentId)
      ).size || 1;

      const emailData = {
        // Company/Portal Info
        companyName: portalConfig.name || workspace.name,
        primaryColor: portalConfig.primaryColor || this.config.defaultPrimaryColor,
        logo: portalConfig.logo,
        portalUrl: this.getPortalUrl(workspace.slug),

        // Ticket Info
        ticketNumber: ticket.number,
        subject: ticket.subject,
        ticketUrl: this.getTicketUrl(workspace.slug, ticket.id, accessToken),
        newTicketUrl: `${this.getPortalUrl(workspace.slug)}/submit`,
        closedAt: this.formatDate(ticket.closedAt || new Date()),
        duration: this.calculateDuration(ticket.createdAt, ticket.closedAt || new Date()),

        // Stats
        messageCount,
        responseTime: ticket.avgResponseTime || 'N/A',
        agentsInvolved,

        // Closing note
        closingNote,
      };

      const html = template(emailData);

      await this.emailService.send({
        to: ticket.customerEmail,
        subject: `[Closed] Ticket #${ticket.number}: ${ticket.subject}`,
        html,
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to send ticket closed email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send verification code email
   */
  async sendVerificationCodeEmail(email, code, workspace) {
    try {
      const portalConfig = await this.getPortalConfig(workspace.id);

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="400" cellspacing="0" cellpadding="0" border="0" style="max-width: 400px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding: 40px; text-align: center;">
                      <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: #1f2937;">
                        Verification Code
                      </h1>
                      <p style="margin: 0 0 24px 0; font-size: 14px; color: #6b7280;">
                        Enter this code to verify your email address
                      </p>
                      <div style="padding: 20px; background-color: #f9fafb; border-radius: 8px; margin-bottom: 24px;">
                        <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: ${portalConfig.primaryColor};">
                          ${code}
                        </span>
                      </div>
                      <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                        This code expires in 10 minutes.
                        <br>
                        If you didn't request this, you can ignore this email.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      await this.emailService.send({
        to: email,
        subject: `${code} is your verification code`,
        html,
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to send verification code email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send magic link email
   */
  async sendMagicLinkEmail(email, token, workspace) {
    try {
      const portalConfig = await this.getPortalConfig(workspace.id);
      const magicLinkUrl = `${this.getPortalUrl(workspace.slug)}/lookup?token=${token}`;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="500" cellspacing="0" cellpadding="0" border="0" style="max-width: 500px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="background-color: ${portalConfig.primaryColor}; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
                      <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;">
                        ${portalConfig.name || 'Support Center'}
                      </h2>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px; text-align: center;">
                      <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: #1f2937;">
                        Sign in to view your tickets
                      </h1>
                      <p style="margin: 0 0 32px 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                        Click the button below to securely sign in and view your support tickets.
                      </p>
                      <a href="${magicLinkUrl}" style="display: inline-block; padding: 14px 32px; background-color: ${portalConfig.primaryColor}; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 8px;">
                        View My Tickets
                      </a>
                      <p style="margin: 32px 0 0 0; font-size: 12px; color: #9ca3af;">
                        This link expires in 24 hours.
                        <br>
                        If you didn't request this, you can ignore this email.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      await this.emailService.send({
        to: email,
        subject: `Sign in to ${portalConfig.name || 'Support Center'}`,
        html,
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to send magic link email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate reply-to email address
   */
  getReplyToEmail(workspace, ticket) {
    // Format: support+ticketId@domain.com for inbound email parsing
    const domain = process.env.INBOUND_EMAIL_DOMAIN || 'reply.botbuilder.app';
    return `support+${ticket.id}@${domain}`;
  }

  /**
   * Generate access token for customer
   */
  async generateAccessToken(email, workspaceId) {
    // This should use JWT or similar - simplified for now
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'ticket-portal-secret';

    return jwt.sign(
      { email, workspaceId, type: 'portal-access' },
      secret,
      { expiresIn: '30d' }
    );
  }

  /**
   * Clear template cache
   */
  clearCache() {
    this.templateCache.clear();
  }
}

module.exports = TicketEmailService;
