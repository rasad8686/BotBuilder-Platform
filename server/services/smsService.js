/**
 * SMS Service - Twilio Integration
 * Handles SMS sending, templates, and delivery status
 */

const twilio = require('twilio');
const db = require('../config/db');

class SMSService {
  /**
   * Get Twilio client for organization
   * @param {number} organizationId - Organization ID
   * @returns {Promise<Object>} Twilio client and phone number
   */
  async getTwilioClient(organizationId) {
    const settings = await db('sms_settings')
      .where({ organization_id: organizationId, enabled: true })
      .first();

    if (!settings) {
      throw new Error('SMS settings not configured or disabled');
    }

    if (!settings.twilio_account_sid || !settings.twilio_auth_token) {
      throw new Error('Twilio credentials not configured');
    }

    const client = twilio(settings.twilio_account_sid, settings.twilio_auth_token);

    return {
      client,
      phoneNumber: settings.twilio_phone_number
    };
  }

  /**
   * Get default Twilio client from environment variables
   * @returns {Object} Twilio client and phone number
   */
  getDefaultClient() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials not configured in environment');
    }

    const client = twilio(accountSid, authToken);

    return {
      client,
      phoneNumber
    };
  }

  /**
   * Send SMS message
   * @param {string} to - Recipient phone number
   * @param {string} message - Message content
   * @param {number} organizationId - Organization ID
   * @returns {Promise<Object>} SMS log entry
   */
  async sendSMS(to, message, organizationId) {
    let twilioClient, fromNumber;

    try {
      // Try organization-specific settings first
      const orgClient = await this.getTwilioClient(organizationId);
      twilioClient = orgClient.client;
      fromNumber = orgClient.phoneNumber;
    } catch (error) {
      // Fall back to default environment credentials
      const defaultClient = this.getDefaultClient();
      twilioClient = defaultClient.client;
      fromNumber = defaultClient.phoneNumber;
    }

    // Create log entry
    const [inserted] = await db('sms_logs').insert({
      organization_id: organizationId,
      to_number: to,
      from_number: fromNumber,
      direction: 'outbound',
      content: message,
      status: 'pending',
      created_at: new Date()
    }).returning('id');
    const logId = inserted.id || inserted;

    try {
      // Send via Twilio
      const twilioMessage = await twilioClient.messages.create({
        body: message,
        from: fromNumber,
        to: to
      });

      // Update log with success
      await db('sms_logs')
        .where({ id: logId })
        .update({
          status: 'sent',
          twilio_sid: twilioMessage.sid,
          sent_at: new Date()
        });

      return await db('sms_logs').where({ id: logId }).first();
    } catch (error) {
      // Update log with failure
      await db('sms_logs')
        .where({ id: logId })
        .update({
          status: 'failed',
          error_message: error.message
        });

      throw error;
    }
  }

  /**
   * Send SMS using template
   * @param {string} to - Recipient phone number
   * @param {number} templateId - Template ID
   * @param {Object} variables - Template variables
   * @param {number} organizationId - Organization ID
   * @returns {Promise<Object>} SMS log entry
   */
  async sendTemplateSMS(to, templateId, variables, organizationId) {
    // Get template
    const template = await db('sms_templates')
      .where({ id: templateId, organization_id: organizationId })
      .first();

    if (!template) {
      throw new Error('Template not found');
    }

    // Replace variables in template
    let message = template.content;
    if (variables && typeof variables === 'object') {
      Object.keys(variables).forEach(key => {
        const regex = new RegExp(`\\{${key}\\}`, 'g');
        message = message.replace(regex, variables[key]);
      });
    }

    let twilioClient, fromNumber;

    try {
      const orgClient = await this.getTwilioClient(organizationId);
      twilioClient = orgClient.client;
      fromNumber = orgClient.phoneNumber;
    } catch (error) {
      const defaultClient = this.getDefaultClient();
      twilioClient = defaultClient.client;
      fromNumber = defaultClient.phoneNumber;
    }

    // Create log entry with template reference
    const [inserted] = await db('sms_logs').insert({
      organization_id: organizationId,
      to_number: to,
      from_number: fromNumber,
      direction: 'outbound',
      template_id: templateId,
      content: message,
      status: 'pending',
      created_at: new Date()
    }).returning('id');
    const logId = inserted.id || inserted;

    try {
      const twilioMessage = await twilioClient.messages.create({
        body: message,
        from: fromNumber,
        to: to
      });

      await db('sms_logs')
        .where({ id: logId })
        .update({
          status: 'sent',
          twilio_sid: twilioMessage.sid,
          sent_at: new Date()
        });

      return await db('sms_logs').where({ id: logId }).first();
    } catch (error) {
      await db('sms_logs')
        .where({ id: logId })
        .update({
          status: 'failed',
          error_message: error.message
        });

      throw error;
    }
  }

  /**
   * Get delivery status from Twilio
   * @param {string} twilioSid - Twilio message SID
   * @param {number} organizationId - Organization ID
   * @returns {Promise<Object>} Delivery status
   */
  async getDeliveryStatus(twilioSid, organizationId) {
    let twilioClient;

    try {
      const orgClient = await this.getTwilioClient(organizationId);
      twilioClient = orgClient.client;
    } catch (error) {
      const defaultClient = this.getDefaultClient();
      twilioClient = defaultClient.client;
    }

    const message = await twilioClient.messages(twilioSid).fetch();

    // Update local log status
    const statusMap = {
      'queued': 'pending',
      'sending': 'pending',
      'sent': 'sent',
      'delivered': 'delivered',
      'failed': 'failed',
      'undelivered': 'failed'
    };

    const localStatus = statusMap[message.status] || 'pending';

    await db('sms_logs')
      .where({ twilio_sid: twilioSid })
      .update({ status: localStatus });

    return {
      sid: message.sid,
      status: message.status,
      localStatus,
      errorCode: message.errorCode,
      errorMessage: message.errorMessage,
      dateSent: message.dateSent,
      dateUpdated: message.dateUpdated
    };
  }

  // ============ Settings Management ============

  /**
   * Get SMS settings for organization
   * @param {number} organizationId - Organization ID
   * @returns {Promise<Object>} SMS settings
   */
  async getSettings(organizationId) {
    let settings = await db('sms_settings')
      .where({ organization_id: organizationId })
      .first();

    if (!settings) {
      // Return default empty settings
      settings = {
        organization_id: organizationId,
        twilio_account_sid: '',
        twilio_auth_token: '',
        twilio_phone_number: '',
        enabled: false
      };
    }

    // Mask auth token for security
    if (settings.twilio_auth_token) {
      settings.twilio_auth_token_masked = '••••••••' + settings.twilio_auth_token.slice(-4);
    }

    return settings;
  }

  /**
   * Update SMS settings for organization
   * @param {number} organizationId - Organization ID
   * @param {Object} data - Settings data
   * @returns {Promise<Object>} Updated settings
   */
  async updateSettings(organizationId, data) {
    const existingSettings = await db('sms_settings')
      .where({ organization_id: organizationId })
      .first();

    const updateData = {
      twilio_account_sid: data.twilio_account_sid,
      twilio_phone_number: data.twilio_phone_number,
      enabled: data.enabled,
      updated_at: new Date()
    };

    // Only update auth token if provided (not masked value)
    if (data.twilio_auth_token && !data.twilio_auth_token.includes('••••')) {
      updateData.twilio_auth_token = data.twilio_auth_token;
    }

    if (existingSettings) {
      await db('sms_settings')
        .where({ organization_id: organizationId })
        .update(updateData);
    } else {
      updateData.organization_id = organizationId;
      updateData.twilio_auth_token = data.twilio_auth_token;
      updateData.created_at = new Date();
      await db('sms_settings').insert(updateData);
    }

    return this.getSettings(organizationId);
  }

  // ============ Templates Management ============

  /**
   * Get all templates for organization
   * @param {number} organizationId - Organization ID
   * @returns {Promise<Array>} Templates list
   */
  async getTemplates(organizationId) {
    return db('sms_templates')
      .where({ organization_id: organizationId })
      .orderBy('created_at', 'desc');
  }

  /**
   * Get single template
   * @param {number} id - Template ID
   * @param {number} organizationId - Organization ID
   * @returns {Promise<Object>} Template
   */
  async getTemplate(id, organizationId) {
    return db('sms_templates')
      .where({ id, organization_id: organizationId })
      .first();
  }

  /**
   * Create template
   * @param {number} organizationId - Organization ID
   * @param {Object} data - Template data
   * @returns {Promise<Object>} Created template
   */
  async createTemplate(organizationId, data) {
    // Extract variables from content
    const variableMatches = data.content.match(/\{(\w+)\}/g) || [];
    const variables = variableMatches.map(v => v.replace(/[{}]/g, ''));

    const [result] = await db('sms_templates').insert({
      organization_id: organizationId,
      name: data.name,
      content: data.content,
      variables: JSON.stringify(variables),
      created_at: new Date(),
      updated_at: new Date()
    }).returning('id');

    const id = typeof result === 'object' ? result.id : result;
    return db('sms_templates').where({ id }).first();
  }

  /**
   * Update template
   * @param {number} id - Template ID
   * @param {number} organizationId - Organization ID
   * @param {Object} data - Template data
   * @returns {Promise<Object>} Updated template
   */
  async updateTemplate(id, organizationId, data) {
    const template = await this.getTemplate(id, organizationId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Extract variables from content
    const variableMatches = data.content.match(/\{(\w+)\}/g) || [];
    const variables = variableMatches.map(v => v.replace(/[{}]/g, ''));

    await db('sms_templates')
      .where({ id, organization_id: organizationId })
      .update({
        name: data.name,
        content: data.content,
        variables: JSON.stringify(variables),
        updated_at: new Date()
      });

    return db('sms_templates').where({ id }).first();
  }

  /**
   * Delete template
   * @param {number} id - Template ID
   * @param {number} organizationId - Organization ID
   * @returns {Promise<boolean>} Success
   */
  async deleteTemplate(id, organizationId) {
    const deleted = await db('sms_templates')
      .where({ id, organization_id: organizationId })
      .delete();

    return deleted > 0;
  }

  // ============ Logs Management ============

  /**
   * Get SMS logs for organization
   * @param {number} organizationId - Organization ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Logs with pagination
   */
  async getLogs(organizationId, options = {}) {
    const { page = 1, limit = 20, status, search, direction } = options;
    const offset = (page - 1) * limit;

    let query = db('sms_logs')
      .where({ organization_id: organizationId });

    if (status) {
      query = query.where({ status });
    }

    if (direction) {
      query = query.where({ direction });
    }

    if (search) {
      query = query.where(function() {
        this.where('to_number', 'like', `%${search}%`)
          .orWhere('from_number', 'like', `%${search}%`)
          .orWhere('content', 'like', `%${search}%`);
      });
    }

    const [countResult] = await query.clone().count('id as count');
    const total = countResult.count;

    const logs = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return {
      data: logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get single log entry
   * @param {number} id - Log ID
   * @param {number} organizationId - Organization ID
   * @returns {Promise<Object>} Log entry
   */
  async getLog(id, organizationId) {
    return db('sms_logs')
      .where({ id, organization_id: organizationId })
      .first();
  }
}

module.exports = new SMSService();
