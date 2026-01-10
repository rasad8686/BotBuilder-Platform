/**
 * @fileoverview Fine-Tuning Notification Service
 * @description Handles notifications for fine-tuning events via multiple channels
 * @module services/fine-tuning-notification.service
 */

const db = require('../config/db');
const log = require('../utils/logger');
const emailService = require('./emailService');

class FineTuningNotificationService {
  constructor() {
    this.io = null; // Socket.io instance (set from outside)
  }

  /**
   * Set Socket.io instance for real-time notifications
   * @param {Object} io - Socket.io instance
   */
  setSocketIO(io) {
    this.io = io;
  }

  // ==================== NOTIFICATION CREATORS ====================

  /**
   * Notify when training starts
   * @param {number} jobId - Job ID
   * @param {number} userId - User ID
   */
  async notifyTrainingStarted(jobId, userId) {
    try {
      const job = await this.getJobWithDetails(jobId);
      if (!job) return;

      const notification = {
        organizationId: job.organization_id,
        userId,
        jobId,
        type: 'training_started',
        title: 'Fine-Tuning Started',
        message: `Training has started for model "${job.model_name}". This may take several minutes to hours depending on dataset size.`,
        metadata: {
          modelId: job.model_id,
          modelName: job.model_name,
          baseModel: job.base_model
        }
      };

      await this.createAndSendNotification(notification);
    } catch (error) {
      log.error('Error sending training started notification:', error);
    }
  }

  /**
   * Notify when training completes
   * @param {number} jobId - Job ID
   * @param {number} userId - User ID
   * @param {Object} result - Training result
   */
  async notifyTrainingComplete(jobId, userId, result = {}) {
    try {
      const job = await this.getJobWithDetails(jobId);
      if (!job) return;

      const notification = {
        organizationId: job.organization_id,
        userId,
        jobId,
        type: 'training_complete',
        title: 'Fine-Tuning Complete',
        message: `Training completed successfully for model "${job.model_name}". Your fine-tuned model is now ready to use.`,
        metadata: {
          modelId: job.model_id,
          modelName: job.model_name,
          baseModel: job.base_model,
          fineTunedModelId: result.fine_tuned_model || result.modelId,
          trainingCost: result.cost,
          tokensUsed: result.tokens
        }
      };

      await this.createAndSendNotification(notification);
    } catch (error) {
      log.error('Error sending training complete notification:', error);
    }
  }

  /**
   * Notify when training fails
   * @param {number} jobId - Job ID
   * @param {number} userId - User ID
   * @param {string|Object} error - Error details
   */
  async notifyTrainingFailed(jobId, userId, error) {
    try {
      const job = await this.getJobWithDetails(jobId);
      if (!job) return;

      const errorMessage = typeof error === 'string' ? error : error.message || 'Unknown error';

      const notification = {
        organizationId: job.organization_id,
        userId,
        jobId,
        type: 'training_failed',
        title: 'Fine-Tuning Failed',
        message: `Training failed for model "${job.model_name}". Error: ${errorMessage}`,
        metadata: {
          modelId: job.model_id,
          modelName: job.model_name,
          baseModel: job.base_model,
          error: errorMessage,
          errorDetails: typeof error === 'object' ? error : null
        }
      };

      await this.createAndSendNotification(notification);
    } catch (err) {
      log.error('Error sending training failed notification:', err);
    }
  }

  /**
   * Notify when budget warning threshold reached
   * @param {number} organizationId - Organization ID
   * @param {Object} budgetInfo - Budget information
   */
  async notifyBudgetWarning(organizationId, budgetInfo) {
    try {
      // Get admin users for organization
      const admins = await this.getOrganizationAdmins(organizationId);

      for (const admin of admins) {
        const notification = {
          organizationId,
          userId: admin.id,
          jobId: null,
          type: 'budget_warning',
          title: 'Budget Warning',
          message: `Your fine-tuning budget has reached ${budgetInfo.percentage}% of the monthly limit ($${budgetInfo.currentSpend.toFixed(2)} of $${budgetInfo.monthlyLimit.toFixed(2)}).`,
          metadata: budgetInfo
        };

        await this.createAndSendNotification(notification);
      }
    } catch (error) {
      log.error('Error sending budget warning notification:', error);
    }
  }

  /**
   * Notify when budget exceeded
   * @param {number} organizationId - Organization ID
   * @param {Object} budgetInfo - Budget information
   */
  async notifyBudgetExceeded(organizationId, budgetInfo) {
    try {
      const admins = await this.getOrganizationAdmins(organizationId);

      for (const admin of admins) {
        const notification = {
          organizationId,
          userId: admin.id,
          jobId: null,
          type: 'budget_exceeded',
          title: 'Budget Exceeded',
          message: `Your fine-tuning budget has exceeded the monthly limit. Current spend: $${budgetInfo.currentSpend.toFixed(2)} / $${budgetInfo.monthlyLimit.toFixed(2)}. ${budgetInfo.autoStop ? 'New training jobs will be blocked.' : ''}`,
          metadata: budgetInfo
        };

        await this.createAndSendNotification(notification);
      }
    } catch (error) {
      log.error('Error sending budget exceeded notification:', error);
    }
  }

  // ==================== CORE NOTIFICATION METHODS ====================

  /**
   * Create notification and send via all enabled channels
   * @param {Object} data - Notification data
   */
  async createAndSendNotification(data) {
    const {
      organizationId,
      userId,
      jobId,
      type,
      title,
      message,
      metadata
    } = data;

    // Get user notification settings
    const settings = await this.getNotificationSettings(organizationId, userId);

    // Check if this notification type is enabled
    const typeSettingMap = {
      'training_started': 'notify_training_start',
      'training_complete': 'notify_training_complete',
      'training_failed': 'notify_training_failed',
      'budget_warning': 'notify_budget_warning',
      'budget_exceeded': 'notify_budget_exceeded'
    };

    const settingKey = typeSettingMap[type];
    if (settingKey && settings[settingKey] === false) {
      return; // Notification type disabled
    }

    // Create in-app notification
    if (settings.in_app_enabled !== false) {
      await this.createInAppNotification({
        organizationId,
        userId,
        jobId,
        type,
        title,
        message,
        metadata
      });

      // Send via WebSocket
      this.sendRealtimeNotification(userId, {
        type,
        title,
        message,
        metadata,
        jobId
      });
    }

    // Send email notification
    if (settings.email_enabled !== false) {
      await this.sendEmailNotification(userId, {
        type,
        title,
        message,
        metadata
      });
    }

    // Send Slack notification
    if (settings.slack_enabled && settings.slack_webhook_url) {
      await this.sendSlackNotification(settings.slack_webhook_url, {
        type,
        title,
        message,
        metadata
      });
    }

    // Send Discord notification
    if (settings.discord_enabled && settings.discord_webhook_url) {
      await this.sendDiscordNotification(settings.discord_webhook_url, {
        type,
        title,
        message,
        metadata
      });
    }
  }

  /**
   * Create in-app notification record
   * @param {Object} data - Notification data
   * @returns {Object} Created notification
   */
  async createInAppNotification(data) {
    const [notification] = await db('fine_tuning_notifications')
      .insert({
        organization_id: data.organizationId,
        user_id: data.userId,
        job_id: data.jobId,
        type: data.type,
        title: data.title,
        message: data.message,
        channel: 'in_app',
        metadata: JSON.stringify(data.metadata || {}),
        is_sent: true,
        sent_at: new Date()
      })
      .returning('*');

    return notification;
  }

  /**
   * Send real-time notification via WebSocket
   * @param {number} userId - User ID
   * @param {Object} notification - Notification data
   */
  sendRealtimeNotification(userId, notification) {
    if (!this.io) return;

    try {
      this.io.to(`user:${userId}`).emit('fine_tuning_notification', {
        ...notification,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      log.warn('Failed to send realtime notification:', error.message);
    }
  }

  /**
   * Send email notification
   * @param {number} userId - User ID
   * @param {Object} notification - Notification data
   */
  async sendEmailNotification(userId, notification) {
    try {
      const user = await db('users').where('id', userId).first();
      if (!user || !user.email) return;

      const subject = `[BotBuilder] ${notification.title}`;
      const html = this.generateEmailHtml(notification);

      await emailService.sendEmail({
        to: user.email,
        subject,
        html
      });

      log.info(`Email notification sent to ${user.email}`);
    } catch (error) {
      log.warn('Failed to send email notification:', error.message);
    }
  }

  /**
   * Send Slack webhook notification
   * @param {string} webhookUrl - Slack webhook URL
   * @param {Object} notification - Notification data
   */
  async sendSlackNotification(webhookUrl, notification) {
    try {
      const color = this.getNotificationColor(notification.type);

      const payload = {
        attachments: [{
          color,
          title: notification.title,
          text: notification.message,
          footer: 'BotBuilder Fine-Tuning',
          ts: Math.floor(Date.now() / 1000)
        }]
      };

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      log.info('Slack notification sent');
    } catch (error) {
      log.warn('Failed to send Slack notification:', error.message);
    }
  }

  /**
   * Send Discord webhook notification
   * @param {string} webhookUrl - Discord webhook URL
   * @param {Object} notification - Notification data
   */
  async sendDiscordNotification(webhookUrl, notification) {
    try {
      const color = this.getNotificationColorInt(notification.type);

      const payload = {
        embeds: [{
          title: notification.title,
          description: notification.message,
          color,
          footer: { text: 'BotBuilder Fine-Tuning' },
          timestamp: new Date().toISOString()
        }]
      };

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      log.info('Discord notification sent');
    } catch (error) {
      log.warn('Failed to send Discord notification:', error.message);
    }
  }

  // ==================== NOTIFICATION RETRIEVAL ====================

  /**
   * Get notifications for user
   * @param {number} userId - User ID
   * @param {Object} options - Query options
   * @returns {Object} Notifications with pagination
   */
  async getNotifications(userId, options = {}) {
    const {
      page = 1,
      limit = 20,
      unreadOnly = false,
      type
    } = options;

    let query = db('fine_tuning_notifications')
      .where('user_id', userId);

    if (unreadOnly) {
      query = query.where('is_read', false);
    }

    if (type) {
      query = query.where('type', type);
    }

    const countResult = await query.clone().count('* as total').first();
    const total = parseInt(countResult.total);

    const notifications = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset((page - 1) * limit);

    // Get unread count
    const unreadCount = await db('fine_tuning_notifications')
      .where('user_id', userId)
      .where('is_read', false)
      .count('* as count')
      .first();

    return {
      notifications,
      unreadCount: parseInt(unreadCount.count),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Mark notification as read
   * @param {string} notificationId - Notification ID
   * @param {number} userId - User ID
   */
  async markAsRead(notificationId, userId) {
    await db('fine_tuning_notifications')
      .where('id', notificationId)
      .where('user_id', userId)
      .update({
        is_read: true,
        read_at: new Date()
      });
  }

  /**
   * Mark all notifications as read
   * @param {number} userId - User ID
   */
  async markAllAsRead(userId) {
    await db('fine_tuning_notifications')
      .where('user_id', userId)
      .where('is_read', false)
      .update({
        is_read: true,
        read_at: new Date()
      });
  }

  /**
   * Delete notification
   * @param {string} notificationId - Notification ID
   * @param {number} userId - User ID
   */
  async deleteNotification(notificationId, userId) {
    await db('fine_tuning_notifications')
      .where('id', notificationId)
      .where('user_id', userId)
      .del();
  }

  // ==================== NOTIFICATION SETTINGS ====================

  /**
   * Get notification settings for user
   * @param {number} organizationId - Organization ID
   * @param {number} userId - User ID
   * @returns {Object} Notification settings
   */
  async getNotificationSettings(organizationId, userId) {
    let settings = await db('fine_tuning_notification_settings')
      .where('organization_id', organizationId)
      .where('user_id', userId)
      .first();

    if (!settings) {
      // Return defaults
      return {
        email_enabled: true,
        in_app_enabled: true,
        slack_enabled: false,
        slack_webhook_url: null,
        discord_enabled: false,
        discord_webhook_url: null,
        notify_training_start: true,
        notify_training_complete: true,
        notify_training_failed: true,
        notify_budget_warning: true,
        notify_budget_exceeded: true
      };
    }

    return settings;
  }

  /**
   * Update notification settings
   * @param {number} organizationId - Organization ID
   * @param {number} userId - User ID
   * @param {Object} settingsData - Settings to update
   * @returns {Object} Updated settings
   */
  async updateNotificationSettings(organizationId, userId, settingsData) {
    const existing = await db('fine_tuning_notification_settings')
      .where('organization_id', organizationId)
      .where('user_id', userId)
      .first();

    if (existing) {
      await db('fine_tuning_notification_settings')
        .where('id', existing.id)
        .update({
          ...settingsData,
          updated_at: new Date()
        });
    } else {
      await db('fine_tuning_notification_settings')
        .insert({
          organization_id: organizationId,
          user_id: userId,
          ...settingsData
        });
    }

    return this.getNotificationSettings(organizationId, userId);
  }

  // ==================== HELPER METHODS ====================

  /**
   * Get job with model details
   * @param {number} jobId - Job ID
   * @returns {Object} Job with details
   */
  async getJobWithDetails(jobId) {
    return db('fine_tune_jobs as j')
      .join('fine_tune_models as m', 'j.fine_tune_model_id', 'm.id')
      .where('j.id', jobId)
      .select(
        'j.*',
        'm.name as model_name',
        'm.base_model',
        'm.organization_id',
        'm.id as model_id'
      )
      .first();
  }

  /**
   * Get organization admin users
   * @param {number} organizationId - Organization ID
   * @returns {Array} Admin users
   */
  async getOrganizationAdmins(organizationId) {
    return db('users')
      .where('organization_id', organizationId)
      .whereIn('role', ['admin', 'owner', 'super_admin'])
      .select('id', 'email', 'first_name', 'last_name');
  }

  /**
   * Get notification color for Slack
   * @param {string} type - Notification type
   * @returns {string} Color hex
   */
  getNotificationColor(type) {
    const colors = {
      'training_started': '#3498db', // Blue
      'training_complete': '#2ecc71', // Green
      'training_failed': '#e74c3c', // Red
      'budget_warning': '#f39c12', // Orange
      'budget_exceeded': '#e74c3c' // Red
    };
    return colors[type] || '#95a5a6';
  }

  /**
   * Get notification color as integer for Discord
   * @param {string} type - Notification type
   * @returns {number} Color integer
   */
  getNotificationColorInt(type) {
    const colors = {
      'training_started': 3447003, // Blue
      'training_complete': 3066993, // Green
      'training_failed': 15158332, // Red
      'budget_warning': 15844367, // Orange
      'budget_exceeded': 15158332 // Red
    };
    return colors[type] || 9807270;
  }

  /**
   * Generate email HTML
   * @param {Object} notification - Notification data
   * @returns {string} HTML content
   */
  generateEmailHtml(notification) {
    const colorMap = {
      'training_started': '#3498db',
      'training_complete': '#2ecc71',
      'training_failed': '#e74c3c',
      'budget_warning': '#f39c12',
      'budget_exceeded': '#e74c3c'
    };

    const color = colorMap[notification.type] || '#3498db';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${color}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
          .footer { text-align: center; margin-top: 20px; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0;">${notification.title}</h2>
          </div>
          <div class="content">
            <p>${notification.message}</p>
            ${notification.metadata?.modelName ? `<p><strong>Model:</strong> ${notification.metadata.modelName}</p>` : ''}
            ${notification.metadata?.trainingCost ? `<p><strong>Cost:</strong> $${notification.metadata.trainingCost.toFixed(4)}</p>` : ''}
          </div>
          <div class="footer">
            <p>This notification was sent by BotBuilder Fine-Tuning Platform</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = new FineTuningNotificationService();
