/**
 * Multi-channel Recovery Messaging Service
 *
 * Handles sending recovery messages across multiple channels:
 * WhatsApp, Email, SMS, Telegram
 *
 * Channel priority by open rate: WhatsApp > Telegram > SMS > Email
 */

const db = require('../../db');
const log = require('../../utils/logger');
const nodemailer = require('nodemailer');

/**
 * Channel priority based on typical open rates
 */
const CHANNEL_PRIORITY = ['whatsapp', 'telegram', 'sms', 'email'];

/**
 * Channel configurations
 */
const CHANNEL_CONFIG = {
  whatsapp: {
    avgOpenRate: 0.98,
    avgClickRate: 0.45,
    costPerMessage: 0.05
  },
  telegram: {
    avgOpenRate: 0.85,
    avgClickRate: 0.35,
    costPerMessage: 0.01
  },
  sms: {
    avgOpenRate: 0.90,
    avgClickRate: 0.20,
    costPerMessage: 0.03
  },
  email: {
    avgOpenRate: 0.25,
    avgClickRate: 0.03,
    costPerMessage: 0.001
  }
};

class RecoveryMessagingService {
  constructor() {
    this.emailTransporter = null;
    this._initEmailTransporter();
  }

  /**
   * Initialize email transporter
   */
  _initEmailTransporter() {
    if (process.env.EMAIL_HOST && process.env.EMAIL_USER) {
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_PORT === '465',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS
        }
      });
    }
  }

  /**
   * Send recovery message via specified channel
   * @param {Object} messageData - Message details
   * @param {string} channel - Channel to use (whatsapp, email, sms, telegram)
   * @returns {Object} Send result
   */
  async sendRecoveryMessage(messageData, channel) {
    const {
      message_id,
      to,
      to_phone,
      to_email,
      to_chat_id,
      subject,
      body,
      template,
      variables,
      buttons
    } = messageData;

    try {
      let result;

      switch (channel) {
        case 'whatsapp':
          result = await this.sendWhatsAppMessage(to_phone || to, template, variables);
          break;

        case 'email':
          result = await this.sendEmailMessage(to_email || to, subject, body, template);
          break;

        case 'sms':
          result = await this.sendSMSMessage(to_phone || to, body);
          break;

        case 'telegram':
          result = await this.sendTelegramMessage(to_chat_id || to, body, buttons);
          break;

        default:
          throw new Error(`Unsupported channel: ${channel}`);
      }

      // Update message status
      if (message_id && result.success) {
        await this.trackMessageDelivery(message_id, 'sent');
      }

      log.info('Recovery message sent', { messageId: message_id, channel, success: result.success });

      return {
        success: result.success,
        message_id,
        channel,
        external_id: result.external_id,
        sent_at: new Date()
      };
    } catch (error) {
      log.error('Failed to send recovery message', { messageId: message_id, channel, error: error.message });

      if (message_id) {
        await this.trackMessageDelivery(message_id, 'failed', error.message);
      }

      return {
        success: false,
        message_id,
        channel,
        error: error.message
      };
    }
  }

  /**
   * Send WhatsApp message
   * @param {string} to - Phone number
   * @param {string} template - Template name
   * @param {Object} variables - Template variables
   * @returns {Object} Send result
   */
  async sendWhatsAppMessage(to, template, variables = {}) {
    try {
      const phoneNumber = this._formatPhoneNumber(to);

      // WhatsApp Business API integration
      const apiUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v17.0';
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

      if (!phoneNumberId || !accessToken) {
        throw new Error('WhatsApp API not configured');
      }

      const response = await fetch(`${apiUrl}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phoneNumber,
          type: 'template',
          template: {
            name: template,
            language: { code: 'en' },
            components: this._buildWhatsAppComponents(variables)
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'WhatsApp API error');
      }

      return {
        success: true,
        external_id: data.messages?.[0]?.id,
        channel: 'whatsapp'
      };
    } catch (error) {
      log.error('WhatsApp send failed', { to, error: error.message });
      return {
        success: false,
        error: error.message,
        channel: 'whatsapp'
      };
    }
  }

  /**
   * Send Email message
   * @param {string} to - Email address
   * @param {string} subject - Email subject
   * @param {string} body - Email body (text or HTML)
   * @param {string} template - Optional template name
   * @returns {Object} Send result
   */
  async sendEmailMessage(to, subject, body, template = null) {
    try {
      if (!this.emailTransporter) {
        throw new Error('Email transporter not configured');
      }

      const htmlBody = template ? await this._renderEmailTemplate(template, body) : body;

      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to,
        subject,
        html: htmlBody,
        text: this._stripHtml(htmlBody)
      };

      const result = await this.emailTransporter.sendMail(mailOptions);

      return {
        success: true,
        external_id: result.messageId,
        channel: 'email'
      };
    } catch (error) {
      log.error('Email send failed', { to, error: error.message });
      return {
        success: false,
        error: error.message,
        channel: 'email'
      };
    }
  }

  /**
   * Send SMS message
   * @param {string} to - Phone number
   * @param {string} text - SMS text
   * @returns {Object} Send result
   */
  async sendSMSMessage(to, text) {
    try {
      const phoneNumber = this._formatPhoneNumber(to);

      // Twilio SMS integration
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_PHONE_NUMBER;

      if (!accountSid || !authToken || !fromNumber) {
        throw new Error('Twilio SMS not configured');
      }

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            To: phoneNumber,
            From: fromNumber,
            Body: text
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Twilio API error');
      }

      return {
        success: true,
        external_id: data.sid,
        channel: 'sms'
      };
    } catch (error) {
      log.error('SMS send failed', { to, error: error.message });
      return {
        success: false,
        error: error.message,
        channel: 'sms'
      };
    }
  }

  /**
   * Send Telegram message
   * @param {string} chatId - Telegram chat ID
   * @param {string} text - Message text
   * @param {Array} buttons - Optional inline keyboard buttons
   * @returns {Object} Send result
   */
  async sendTelegramMessage(chatId, text, buttons = null) {
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;

      if (!botToken) {
        throw new Error('Telegram bot not configured');
      }

      const payload = {
        chat_id: chatId,
        text,
        parse_mode: 'HTML'
      };

      // Add inline keyboard if buttons provided
      if (buttons && buttons.length > 0) {
        payload.reply_markup = {
          inline_keyboard: buttons.map(row =>
            Array.isArray(row) ? row : [row]
          ).map(row =>
            row.map(btn => ({
              text: btn.text,
              url: btn.url || undefined,
              callback_data: btn.callback_data || undefined
            }))
          )
        };
      }

      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.description || 'Telegram API error');
      }

      return {
        success: true,
        external_id: data.result?.message_id?.toString(),
        channel: 'telegram'
      };
    } catch (error) {
      log.error('Telegram send failed', { chatId, error: error.message });
      return {
        success: false,
        error: error.message,
        channel: 'telegram'
      };
    }
  }

  /**
   * Select best channel for customer based on engagement history
   * @param {string} customerId - Customer identifier
   * @returns {Object} Best channel recommendation
   */
  async selectBestChannel(customerId) {
    try {
      // Get customer's channel engagement history
      const historyResult = await db.query(
        `SELECT
          channel,
          COUNT(*) as total_sent,
          COUNT(*) FILTER (WHERE opened_at IS NOT NULL) as opened,
          COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) as clicked,
          COUNT(*) FILTER (WHERE converted_at IS NOT NULL) as converted
         FROM recovery_messages
         WHERE customer_id = $1
         GROUP BY channel`,
        [customerId]
      );

      // Get customer contact info
      const contactResult = await db.query(
        `SELECT DISTINCT recipient_email, recipient_phone
         FROM recovery_messages
         WHERE customer_id = $1
         AND (recipient_email IS NOT NULL OR recipient_phone IS NOT NULL)
         LIMIT 1`,
        [customerId]
      );

      const contact = contactResult.rows[0] || {};
      const hasEmail = !!contact.recipient_email;
      const hasPhone = !!contact.recipient_phone;

      // Calculate channel scores
      const channelScores = {};

      for (const channel of CHANNEL_PRIORITY) {
        const history = historyResult.rows.find(h => h.channel === channel);
        const config = CHANNEL_CONFIG[channel];

        let score = config.avgOpenRate * 100;

        if (history && parseInt(history.total_sent) > 0) {
          const openRate = parseInt(history.opened) / parseInt(history.total_sent);
          const clickRate = parseInt(history.clicked) / parseInt(history.total_sent);
          const conversionRate = parseInt(history.converted) / parseInt(history.total_sent);

          // Weight historical performance heavily
          score = (openRate * 40) + (clickRate * 30) + (conversionRate * 30);
          score = score * 100;
        }

        // Check availability
        const isAvailable = (
          (channel === 'email' && hasEmail) ||
          (['whatsapp', 'sms'].includes(channel) && hasPhone) ||
          channel === 'telegram'
        );

        channelScores[channel] = {
          score: isAvailable ? score : 0,
          available: isAvailable,
          history: history || null
        };
      }

      // Sort by score and get best available
      const rankedChannels = Object.entries(channelScores)
        .filter(([_, data]) => data.available)
        .sort((a, b) => b[1].score - a[1].score);

      const bestChannel = rankedChannels[0]?.[0] || 'email';
      const fallbackChannel = rankedChannels[1]?.[0] || null;

      log.debug('Best channel selected', { customerId, bestChannel, fallbackChannel });

      return {
        customer_id: customerId,
        recommended_channel: bestChannel,
        fallback_channel: fallbackChannel,
        channel_scores: channelScores,
        available_channels: rankedChannels.map(([ch]) => ch),
        contact_info: {
          has_email: hasEmail,
          has_phone: hasPhone
        }
      };
    } catch (error) {
      log.error('Failed to select best channel', { customerId, error: error.message });
      // Default to email as fallback
      return {
        customer_id: customerId,
        recommended_channel: 'email',
        fallback_channel: null,
        error: error.message
      };
    }
  }

  /**
   * Track message delivery status
   * @param {string} messageId - Message ID
   * @param {string} status - Delivery status
   * @param {string} errorMessage - Optional error message
   * @returns {Object} Updated message
   */
  async trackMessageDelivery(messageId, status, errorMessage = null) {
    try {
      const updateFields = {
        sent: { status: 'sent', sent_at: 'CURRENT_TIMESTAMP' },
        delivered: { status: 'delivered', delivered_at: 'CURRENT_TIMESTAMP' },
        bounced: { status: 'bounced', error_message: errorMessage },
        failed: { status: 'failed', error_message: errorMessage }
      };

      const update = updateFields[status];
      if (!update) {
        throw new Error(`Invalid status: ${status}`);
      }

      let query = `UPDATE recovery_messages SET status = $1, updated_at = CURRENT_TIMESTAMP`;
      const params = [update.status, messageId];
      let paramIndex = 3;

      if (update.sent_at) {
        query += `, sent_at = CURRENT_TIMESTAMP`;
      }
      if (update.delivered_at) {
        query += `, delivered_at = CURRENT_TIMESTAMP`;
      }
      if (update.error_message) {
        query += `, error_message = $${paramIndex}`;
        params.splice(paramIndex - 1, 0, errorMessage);
        paramIndex++;
      }

      query += ` WHERE id = $2 RETURNING *`;

      const result = await db.query(query, params);

      log.debug('Message delivery tracked', { messageId, status });

      return result.rows[0];
    } catch (error) {
      log.error('Failed to track message delivery', { messageId, status, error: error.message });
      throw error;
    }
  }

  /**
   * Track message open
   * @param {string} messageId - Message ID
   * @returns {Object} Updated message
   */
  async trackMessageOpen(messageId) {
    try {
      const result = await db.query(
        `UPDATE recovery_messages
         SET status = CASE WHEN status IN ('sent', 'delivered') THEN 'opened' ELSE status END,
             opened_at = COALESCE(opened_at, CURRENT_TIMESTAMP),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [messageId]
      );

      if (result.rows.length === 0) {
        throw new Error('Message not found');
      }

      log.debug('Message open tracked', { messageId });

      return result.rows[0];
    } catch (error) {
      log.error('Failed to track message open', { messageId, error: error.message });
      throw error;
    }
  }

  /**
   * Track message link click
   * @param {string} messageId - Message ID
   * @param {string} linkId - Clicked link identifier
   * @returns {Object} Updated message
   */
  async trackMessageClick(messageId, linkId = null) {
    try {
      const result = await db.query(
        `UPDATE recovery_messages
         SET status = CASE WHEN status IN ('sent', 'delivered', 'opened') THEN 'clicked' ELSE status END,
             clicked_at = COALESCE(clicked_at, CURRENT_TIMESTAMP),
             opened_at = COALESCE(opened_at, CURRENT_TIMESTAMP),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [messageId]
      );

      if (result.rows.length === 0) {
        throw new Error('Message not found');
      }

      log.debug('Message click tracked', { messageId, linkId });

      return result.rows[0];
    } catch (error) {
      log.error('Failed to track message click', { messageId, linkId, error: error.message });
      throw error;
    }
  }

  /**
   * Track conversion from message
   * @param {string} messageId - Message ID
   * @param {number} revenue - Conversion revenue amount
   * @returns {Object} Updated message and event
   */
  async trackConversion(messageId, revenue) {
    try {
      // Update message
      const messageResult = await db.query(
        `UPDATE recovery_messages
         SET status = 'converted',
             converted_at = CURRENT_TIMESTAMP,
             conversion_value = $1,
             clicked_at = COALESCE(clicked_at, CURRENT_TIMESTAMP),
             opened_at = COALESCE(opened_at, CURRENT_TIMESTAMP),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [revenue, messageId]
      );

      if (messageResult.rows.length === 0) {
        throw new Error('Message not found');
      }

      const message = messageResult.rows[0];

      // Update related event
      await db.query(
        `UPDATE recovery_events
         SET status = 'recovered',
             recovered_at = CURRENT_TIMESTAMP,
             recovered_value = $1,
             recovery_method = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [revenue, message.channel, message.event_id]
      );

      // Update campaign stats
      await db.query(
        `UPDATE recovery_campaigns
         SET total_recovered = total_recovered + 1,
             total_revenue_recovered = total_revenue_recovered + $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [revenue, message.campaign_id]
      );

      log.info('Conversion tracked', { messageId, revenue, channel: message.channel });

      return {
        message: message,
        revenue,
        converted_at: new Date()
      };
    } catch (error) {
      log.error('Failed to track conversion', { messageId, revenue, error: error.message });
      throw error;
    }
  }

  /**
   * Get message statistics for organization/campaign
   * @param {number} orgId - Organization ID
   * @param {string} campaignId - Optional campaign ID
   * @returns {Object} Message statistics
   */
  async getMessageStats(orgId, campaignId = null) {
    try {
      let baseQuery = `
        SELECT
          channel,
          COUNT(*) as total_sent,
          COUNT(*) FILTER (WHERE status = 'delivered' OR delivered_at IS NOT NULL) as delivered,
          COUNT(*) FILTER (WHERE opened_at IS NOT NULL) as opened,
          COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) as clicked,
          COUNT(*) FILTER (WHERE converted_at IS NOT NULL) as converted,
          COUNT(*) FILTER (WHERE status = 'bounced') as bounced,
          COUNT(*) FILTER (WHERE status = 'failed') as failed,
          COALESCE(SUM(conversion_value), 0) as total_revenue
        FROM recovery_messages
        WHERE org_id = $1
      `;
      const params = [orgId];

      if (campaignId) {
        baseQuery += ` AND campaign_id = $2`;
        params.push(campaignId);
      }

      baseQuery += ` GROUP BY channel`;

      const channelResult = await db.query(baseQuery, params);

      // Get overall stats
      let overallQuery = `
        SELECT
          COUNT(*) as total_messages,
          COUNT(*) FILTER (WHERE status = 'delivered' OR delivered_at IS NOT NULL) as delivered,
          COUNT(*) FILTER (WHERE opened_at IS NOT NULL) as opened,
          COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) as clicked,
          COUNT(*) FILTER (WHERE converted_at IS NOT NULL) as converted,
          COALESCE(SUM(conversion_value), 0) as total_revenue,
          COALESCE(AVG(conversion_value) FILTER (WHERE conversion_value > 0), 0) as avg_conversion_value
        FROM recovery_messages
        WHERE org_id = $1
      `;

      if (campaignId) {
        overallQuery += ` AND campaign_id = $2`;
      }

      const overallResult = await db.query(overallQuery, params);
      const overall = overallResult.rows[0];

      // Calculate rates
      const totalSent = parseInt(overall.total_messages);
      const delivered = parseInt(overall.delivered);
      const opened = parseInt(overall.opened);
      const clicked = parseInt(overall.clicked);
      const converted = parseInt(overall.converted);

      const stats = {
        overall: {
          total_sent: totalSent,
          delivered,
          opened,
          clicked,
          converted,
          total_revenue: parseFloat(overall.total_revenue),
          avg_conversion_value: parseFloat(overall.avg_conversion_value),
          delivery_rate: totalSent > 0 ? ((delivered / totalSent) * 100).toFixed(2) : 0,
          open_rate: delivered > 0 ? ((opened / delivered) * 100).toFixed(2) : 0,
          click_rate: opened > 0 ? ((clicked / opened) * 100).toFixed(2) : 0,
          conversion_rate: clicked > 0 ? ((converted / clicked) * 100).toFixed(2) : 0
        },
        by_channel: {}
      };

      // Process channel stats
      for (const row of channelResult.rows) {
        const chTotal = parseInt(row.total_sent);
        const chDelivered = parseInt(row.delivered);
        const chOpened = parseInt(row.opened);
        const chClicked = parseInt(row.clicked);
        const chConverted = parseInt(row.converted);

        stats.by_channel[row.channel] = {
          total_sent: chTotal,
          delivered: chDelivered,
          opened: chOpened,
          clicked: chClicked,
          converted: chConverted,
          bounced: parseInt(row.bounced),
          failed: parseInt(row.failed),
          revenue: parseFloat(row.total_revenue),
          open_rate: chDelivered > 0 ? ((chOpened / chDelivered) * 100).toFixed(2) : 0,
          click_rate: chOpened > 0 ? ((chClicked / chOpened) * 100).toFixed(2) : 0,
          conversion_rate: chClicked > 0 ? ((chConverted / chClicked) * 100).toFixed(2) : 0
        };
      }

      return stats;
    } catch (error) {
      log.error('Failed to get message stats', { orgId, campaignId, error: error.message });
      throw error;
    }
  }

  // ==================== Private Helper Methods ====================

  _formatPhoneNumber(phone) {
    if (!phone) return null;
    // Remove all non-digits except leading +
    let cleaned = phone.replace(/[^\d+]/g, '');
    // Ensure starts with +
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }
    return cleaned;
  }

  _buildWhatsAppComponents(variables) {
    if (!variables || Object.keys(variables).length === 0) {
      return [];
    }

    const parameters = Object.values(variables).map(value => ({
      type: 'text',
      text: String(value)
    }));

    return [{
      type: 'body',
      parameters
    }];
  }

  async _renderEmailTemplate(templateName, data) {
    // Simple template rendering - can be extended with handlebars/ejs
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        ${data}
      </body>
      </html>
    `;
    return html;
  }

  _stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }
}

module.exports = new RecoveryMessagingService();
