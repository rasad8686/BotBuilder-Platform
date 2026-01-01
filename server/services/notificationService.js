/**
 * @fileoverview Notification Service Module
 * @description Handles all notification operations including email, push, and in-app notifications
 * @module services/notificationService
 * @author BotBuilder Team
 */

const db = require('../db');
const log = require('../utils/logger');
const emailService = require('./emailService');

/**
 * Notification types supported by the system
 * @enum {string}
 */
const NOTIFICATION_TYPES = {
  EMAIL: 'email',
  PUSH: 'push',
  IN_APP: 'in-app'
};

/**
 * Notification categories
 * @enum {string}
 */
const NOTIFICATION_CATEGORIES = {
  SYSTEM: 'system',
  BOT_ALERT: 'bot_alert',
  TRAINING: 'training',
  BILLING: 'billing',
  SECURITY: 'security',
  TEAM: 'team',
  MARKETING: 'marketing'
};

/**
 * Notification Service Class
 * @class NotificationService
 * @description Manages all notification delivery across multiple channels
 */
class NotificationService {
  /**
   * Send a notification to a user
   * @param {Object} options - Notification options
   * @param {number} options.userId - Target user ID
   * @param {string} options.type - Notification type (email, push, in-app)
   * @param {string} options.category - Notification category
   * @param {string} options.title - Notification title
   * @param {string} options.message - Notification message
   * @param {Object} [options.data] - Additional data payload
   * @param {string} [options.priority] - Priority level (low, medium, high)
   * @param {string} [options.actionUrl] - URL for notification action
   * @returns {Promise<Object>} Created notification
   */
  async sendNotification({ userId, type, category, title, message, data = {}, priority = 'medium', actionUrl = null }) {
    try {
      // Validate input
      if (!userId || !type || !category || !title || !message) {
        throw new Error('Missing required notification fields');
      }

      if (!Object.values(NOTIFICATION_TYPES).includes(type)) {
        throw new Error(`Invalid notification type: ${type}`);
      }

      if (!Object.values(NOTIFICATION_CATEGORIES).includes(category)) {
        throw new Error(`Invalid notification category: ${category}`);
      }

      // Check user preferences
      const shouldSend = await this.checkNotificationPreference(userId, type, category);
      if (!shouldSend) {
        log.info('Notification blocked by user preferences', { userId, type, category });
        return { success: false, reason: 'blocked_by_preferences' };
      }

      // Store notification in database
      const result = await db.query(
        `INSERT INTO notifications
         (user_id, type, category, title, message, data, priority, action_url, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, NOW())
         RETURNING *`,
        [userId, type, category, title, message, JSON.stringify(data), priority, actionUrl]
      );

      const notification = result.rows[0];

      // Send based on type
      if (type === NOTIFICATION_TYPES.EMAIL) {
        await this.sendEmailNotification(userId, notification);
      } else if (type === NOTIFICATION_TYPES.PUSH) {
        await this.sendPushNotification(userId, notification);
      }
      // IN_APP notifications are already stored in DB

      log.info('Notification sent successfully', {
        notificationId: notification.id,
        userId,
        type,
        category
      });

      return { success: true, notification };
    } catch (error) {
      log.error('Failed to send notification', { error: error.message, userId, type });
      throw error;
    }
  }

  /**
   * Send notifications to multiple users in batch
   * @param {Object} options - Batch notification options
   * @param {number[]} options.userIds - Array of user IDs
   * @param {string} options.type - Notification type
   * @param {string} options.category - Notification category
   * @param {string} options.title - Notification title
   * @param {string} options.message - Notification message
   * @param {Object} [options.data] - Additional data
   * @param {string} [options.priority] - Priority level
   * @returns {Promise<Object>} Batch send result
   */
  async sendBulkNotifications({ userIds, type, category, title, message, data = {}, priority = 'medium' }) {
    try {
      if (!Array.isArray(userIds) || userIds.length === 0) {
        throw new Error('userIds must be a non-empty array');
      }

      const results = {
        success: 0,
        failed: 0,
        blocked: 0,
        errors: []
      };

      // Send to each user
      for (const userId of userIds) {
        try {
          const result = await this.sendNotification({
            userId,
            type,
            category,
            title,
            message,
            data,
            priority
          });

          if (result.success) {
            results.success++;
          } else if (result.reason === 'blocked_by_preferences') {
            results.blocked++;
          } else {
            results.failed++;
          }
        } catch (error) {
          results.failed++;
          results.errors.push({ userId, error: error.message });
        }
      }

      log.info('Bulk notifications sent', {
        total: userIds.length,
        success: results.success,
        failed: results.failed,
        blocked: results.blocked
      });

      return results;
    } catch (error) {
      log.error('Failed to send bulk notifications', { error: error.message });
      throw error;
    }
  }

  /**
   * Get notifications for a user
   * @param {number} userId - User ID
   * @param {Object} [options] - Query options
   * @param {number} [options.limit] - Maximum number of notifications
   * @param {number} [options.offset] - Pagination offset
   * @param {boolean} [options.unreadOnly] - Return only unread notifications
   * @param {string} [options.category] - Filter by category
   * @param {string} [options.type] - Filter by type
   * @returns {Promise<Array>} List of notifications
   */
  async getNotifications(userId, options = {}) {
    try {
      const {
        limit = 50,
        offset = 0,
        unreadOnly = false,
        category = null,
        type = null
      } = options;

      let query = 'SELECT * FROM notifications WHERE user_id = $1';
      const params = [userId];
      let paramIndex = 2;

      if (unreadOnly) {
        query += ` AND is_read = false`;
      }

      if (category) {
        query += ` AND category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      if (type) {
        query += ` AND type = $${paramIndex}`;
        params.push(type);
        paramIndex++;
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await db.query(query, params);

      // Parse JSON data field
      const notifications = result.rows.map(notif => ({
        ...notif,
        data: typeof notif.data === 'string' ? JSON.parse(notif.data) : notif.data
      }));

      return notifications;
    } catch (error) {
      log.error('Failed to get notifications', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Mark notification as read
   * @param {number} notificationId - Notification ID
   * @param {number} userId - User ID (for verification)
   * @returns {Promise<Object>} Updated notification
   */
  async markAsRead(notificationId, userId) {
    try {
      const result = await db.query(
        `UPDATE notifications
         SET is_read = true, read_at = NOW()
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        [notificationId, userId]
      );

      if (result.rows.length === 0) {
        throw new Error('Notification not found or access denied');
      }

      log.info('Notification marked as read', { notificationId, userId });
      return result.rows[0];
    } catch (error) {
      log.error('Failed to mark notification as read', { error: error.message, notificationId });
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   * @param {number} userId - User ID
   * @param {string} [category] - Optional category filter
   * @returns {Promise<number>} Number of notifications updated
   */
  async markAllAsRead(userId, category = null) {
    try {
      let query = 'UPDATE notifications SET is_read = true, read_at = NOW() WHERE user_id = $1 AND is_read = false';
      const params = [userId];

      if (category) {
        query += ' AND category = $2';
        params.push(category);
      }

      query += ' RETURNING id';
      const result = await db.query(query, params);

      log.info('All notifications marked as read', { userId, count: result.rows.length });
      return result.rows.length;
    } catch (error) {
      log.error('Failed to mark all notifications as read', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Delete a notification
   * @param {number} notificationId - Notification ID
   * @param {number} userId - User ID (for verification)
   * @returns {Promise<boolean>} Success status
   */
  async deleteNotification(notificationId, userId) {
    try {
      const result = await db.query(
        'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id',
        [notificationId, userId]
      );

      if (result.rows.length === 0) {
        throw new Error('Notification not found or access denied');
      }

      log.info('Notification deleted', { notificationId, userId });
      return true;
    } catch (error) {
      log.error('Failed to delete notification', { error: error.message, notificationId });
      throw error;
    }
  }

  /**
   * Delete all notifications for a user
   * @param {number} userId - User ID
   * @param {boolean} [readOnly] - Delete only read notifications
   * @returns {Promise<number>} Number of notifications deleted
   */
  async deleteAllNotifications(userId, readOnly = false) {
    try {
      let query = 'DELETE FROM notifications WHERE user_id = $1';
      const params = [userId];

      if (readOnly) {
        query += ' AND is_read = true';
      }

      query += ' RETURNING id';
      const result = await db.query(query, params);

      log.info('Notifications deleted', { userId, count: result.rows.length, readOnly });
      return result.rows.length;
    } catch (error) {
      log.error('Failed to delete all notifications', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get unread notification count
   * @param {number} userId - User ID
   * @param {string} [category] - Optional category filter
   * @returns {Promise<number>} Unread count
   */
  async getUnreadCount(userId, category = null) {
    try {
      let query = 'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false';
      const params = [userId];

      if (category) {
        query += ' AND category = $2';
        params.push(category);
      }

      const result = await db.query(query, params);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      log.error('Failed to get unread count', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get notification preferences for a user
   * @param {number} userId - User ID
   * @returns {Promise<Object>} User notification preferences
   */
  async getNotificationPreferences(userId) {
    try {
      const result = await db.query(
        'SELECT * FROM notification_preferences WHERE user_id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        // Return default preferences
        return this.createDefaultPreferences(userId);
      }

      const prefs = result.rows[0];
      return {
        ...prefs,
        email_preferences: typeof prefs.email_preferences === 'string'
          ? JSON.parse(prefs.email_preferences)
          : prefs.email_preferences,
        push_preferences: typeof prefs.push_preferences === 'string'
          ? JSON.parse(prefs.push_preferences)
          : prefs.push_preferences,
        in_app_preferences: typeof prefs.in_app_preferences === 'string'
          ? JSON.parse(prefs.in_app_preferences)
          : prefs.in_app_preferences
      };
    } catch (error) {
      log.error('Failed to get notification preferences', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Update notification preferences
   * @param {number} userId - User ID
   * @param {Object} preferences - Preference updates
   * @returns {Promise<Object>} Updated preferences
   */
  async updateNotificationPreferences(userId, preferences) {
    try {
      const {
        email_enabled,
        push_enabled,
        in_app_enabled,
        email_preferences,
        push_preferences,
        in_app_preferences
      } = preferences;

      const result = await db.query(
        `INSERT INTO notification_preferences
         (user_id, email_enabled, push_enabled, in_app_enabled,
          email_preferences, push_preferences, in_app_preferences, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           email_enabled = COALESCE($2, notification_preferences.email_enabled),
           push_enabled = COALESCE($3, notification_preferences.push_enabled),
           in_app_enabled = COALESCE($4, notification_preferences.in_app_enabled),
           email_preferences = COALESCE($5, notification_preferences.email_preferences),
           push_preferences = COALESCE($6, notification_preferences.push_preferences),
           in_app_preferences = COALESCE($7, notification_preferences.in_app_preferences),
           updated_at = NOW()
         RETURNING *`,
        [
          userId,
          email_enabled,
          push_enabled,
          in_app_enabled,
          email_preferences ? JSON.stringify(email_preferences) : null,
          push_preferences ? JSON.stringify(push_preferences) : null,
          in_app_preferences ? JSON.stringify(in_app_preferences) : null
        ]
      );

      log.info('Notification preferences updated', { userId });
      return result.rows[0];
    } catch (error) {
      log.error('Failed to update notification preferences', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Check if notification should be sent based on user preferences
   * @param {number} userId - User ID
   * @param {string} type - Notification type
   * @param {string} category - Notification category
   * @returns {Promise<boolean>} Whether to send notification
   */
  async checkNotificationPreference(userId, type, category) {
    try {
      const preferences = await this.getNotificationPreferences(userId);

      // Check if type is enabled
      if (type === NOTIFICATION_TYPES.EMAIL && !preferences.email_enabled) {
        return false;
      }
      if (type === NOTIFICATION_TYPES.PUSH && !preferences.push_enabled) {
        return false;
      }
      if (type === NOTIFICATION_TYPES.IN_APP && !preferences.in_app_enabled) {
        return false;
      }

      // Check category preferences
      const categoryPrefs = type === NOTIFICATION_TYPES.EMAIL
        ? preferences.email_preferences
        : type === NOTIFICATION_TYPES.PUSH
        ? preferences.push_preferences
        : preferences.in_app_preferences;

      if (categoryPrefs && categoryPrefs[category] === false) {
        return false;
      }

      return true;
    } catch (error) {
      log.error('Failed to check notification preference', { error: error.message });
      // Default to sending if preference check fails
      return true;
    }
  }

  /**
   * Create default notification preferences
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Default preferences
   */
  async createDefaultPreferences(userId) {
    const defaultPrefs = {
      user_id: userId,
      email_enabled: true,
      push_enabled: true,
      in_app_enabled: true,
      email_preferences: {
        system: true,
        bot_alert: true,
        training: true,
        billing: true,
        security: true,
        team: true,
        marketing: false
      },
      push_preferences: {
        system: true,
        bot_alert: true,
        training: true,
        billing: true,
        security: true,
        team: true,
        marketing: false
      },
      in_app_preferences: {
        system: true,
        bot_alert: true,
        training: true,
        billing: true,
        security: true,
        team: true,
        marketing: true
      }
    };

    await db.query(
      `INSERT INTO notification_preferences
       (user_id, email_enabled, push_enabled, in_app_enabled,
        email_preferences, push_preferences, in_app_preferences)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id) DO NOTHING`,
      [
        userId,
        defaultPrefs.email_enabled,
        defaultPrefs.push_enabled,
        defaultPrefs.in_app_enabled,
        JSON.stringify(defaultPrefs.email_preferences),
        JSON.stringify(defaultPrefs.push_preferences),
        JSON.stringify(defaultPrefs.in_app_preferences)
      ]
    );

    return defaultPrefs;
  }

  /**
   * Send email notification
   * @param {number} userId - User ID
   * @param {Object} notification - Notification object
   * @returns {Promise<void>}
   */
  async sendEmailNotification(userId, notification) {
    try {
      // Get user email
      const userResult = await db.query(
        'SELECT email, name FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0];

      // Send email using email service
      await emailService.sendEmail({
        to: user.email,
        subject: notification.title,
        html: this.generateEmailHTML(notification, user.name),
        text: notification.message
      });
    } catch (error) {
      log.error('Failed to send email notification', { error: error.message, userId });
      // Don't throw - we don't want email failures to break notification creation
    }
  }

  /**
   * Generate HTML for email notification
   * @param {Object} notification - Notification object
   * @param {string} userName - User name
   * @returns {string} HTML content
   */
  generateEmailHTML(notification, userName) {
    const actionButton = notification.action_url
      ? `<div style="text-align: center; margin: 32px 0;">
           <a href="${notification.action_url}" style="display: inline-block; background-color: #8b5cf6; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
             View Details
           </a>
         </div>`
      : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0f; color: #e5e7eb; padding: 40px 20px; margin: 0;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #12121a; border-radius: 16px; padding: 40px; border: 1px solid #2d2d3a;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #8b5cf6; margin: 0; font-size: 28px;">${notification.title}</h1>
          </div>
          <p style="margin-bottom: 16px; font-size: 16px; line-height: 1.6;">
            Hi${userName ? ` ${userName}` : ''},
          </p>
          <p style="margin-bottom: 24px; font-size: 16px; line-height: 1.6;">
            ${notification.message}
          </p>
          ${actionButton}
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send push notification (stub - would integrate with push service)
   * @param {number} userId - User ID
   * @param {Object} notification - Notification object
   * @returns {Promise<void>}
   */
  async sendPushNotification(userId, notification) {
    // This would integrate with a push notification service like Firebase, OneSignal, etc.
    log.info('Push notification sent (stub)', { userId, notificationId: notification.id });
    return Promise.resolve();
  }

  /**
   * Clean up old notifications
   * @param {number} daysOld - Delete notifications older than this many days
   * @returns {Promise<number>} Number of deleted notifications
   */
  async cleanupOldNotifications(daysOld = 90) {
    try {
      const result = await db.query(
        `DELETE FROM notifications
         WHERE created_at < NOW() - INTERVAL '${daysOld} days'
         AND is_read = true
         RETURNING id`
      );

      log.info('Old notifications cleaned up', { count: result.rows.length, daysOld });
      return result.rows.length;
    } catch (error) {
      log.error('Failed to cleanup old notifications', { error: error.message });
      throw error;
    }
  }
}

module.exports = new NotificationService();
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
module.exports.NOTIFICATION_CATEGORIES = NOTIFICATION_CATEGORIES;
