/**
 * Alert Service
 * Handles threshold checking and notification sending for usage alerts
 */

const db = require('../db');
const logger = require('../utils/logger');
const axios = require('axios');
const nodemailer = require('nodemailer');

// Email transporter configuration
let emailTransporter = null;

const initEmailTransporter = () => {
  if (emailTransporter) return emailTransporter;

  const smtpConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  };

  // Only create transporter if credentials are configured
  if (smtpConfig.auth.user && smtpConfig.auth.pass) {
    emailTransporter = nodemailer.createTransport(smtpConfig);
  }

  return emailTransporter;
};

/**
 * Check thresholds for all active alerts
 * @returns {Promise<Array>} Array of triggered alerts
 */
const checkThresholds = async () => {
  try {
    const activeAlerts = await db('usage_alerts')
      .where('is_active', true)
      .select('*');

    const triggeredAlerts = [];

    for (const alert of activeAlerts) {
      // Check cooldown (1 hour)
      if (alert.last_triggered_at) {
        const lastTriggered = new Date(alert.last_triggered_at);
        const cooldownPeriod = 60 * 60 * 1000; // 1 hour in milliseconds
        if (Date.now() - lastTriggered.getTime() < cooldownPeriod) {
          continue; // Skip this alert, still in cooldown
        }
      }

      const currentValue = await getCurrentValue(alert);
      const isTriggered = checkIfTriggered(alert, currentValue);

      if (isTriggered) {
        triggeredAlerts.push({
          alert,
          currentValue
        });
      }
    }

    return triggeredAlerts;
  } catch (error) {
    logger.error('Error checking thresholds:', error);
    throw error;
  }
};

/**
 * Get current value for an alert based on its type
 * @param {Object} alert - The alert configuration
 * @returns {Promise<number>} Current metric value
 */
const getCurrentValue = async (alert) => {
  const { alert_type, user_id, organization_id } = alert;

  try {
    switch (alert_type) {
      case 'spending': {
        // Get current month spending
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        let query = db('api_token_usage')
          .sum('cost as total')
          .where('created_at', '>=', startOfMonth);

        if (organization_id) {
          query = query.whereIn('api_token_id', function() {
            this.select('id').from('api_tokens').where('organization_id', organization_id);
          });
        } else if (user_id) {
          query = query.whereIn('api_token_id', function() {
            this.select('id').from('api_tokens').where('user_id', user_id);
          });
        }

        const [result] = await query;
        return parseFloat(result?.total || 0);
      }

      case 'rate_limit': {
        // Get current minute request count
        const oneMinuteAgo = new Date(Date.now() - 60000);

        let query = db('api_token_usage')
          .count('id as count')
          .where('created_at', '>=', oneMinuteAgo);

        if (organization_id) {
          query = query.whereIn('api_token_id', function() {
            this.select('id').from('api_tokens').where('organization_id', organization_id);
          });
        } else if (user_id) {
          query = query.whereIn('api_token_id', function() {
            this.select('id').from('api_tokens').where('user_id', user_id);
          });
        }

        const [result] = await query;
        return parseInt(result?.count || 0);
      }

      case 'usage': {
        // Get current day request count
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        let query = db('api_token_usage')
          .count('id as count')
          .where('created_at', '>=', startOfDay);

        if (organization_id) {
          query = query.whereIn('api_token_id', function() {
            this.select('id').from('api_tokens').where('organization_id', organization_id);
          });
        } else if (user_id) {
          query = query.whereIn('api_token_id', function() {
            this.select('id').from('api_tokens').where('user_id', user_id);
          });
        }

        const [result] = await query;
        return parseInt(result?.count || 0);
      }

      case 'error_rate': {
        // Get error rate for last hour
        const oneHourAgo = new Date(Date.now() - 3600000);

        let baseQuery = db('api_token_usage')
          .where('created_at', '>=', oneHourAgo);

        if (organization_id) {
          baseQuery = baseQuery.whereIn('api_token_id', function() {
            this.select('id').from('api_tokens').where('organization_id', organization_id);
          });
        } else if (user_id) {
          baseQuery = baseQuery.whereIn('api_token_id', function() {
            this.select('id').from('api_tokens').where('user_id', user_id);
          });
        }

        const [totalResult] = await baseQuery.clone().count('id as count');
        const [errorResult] = await baseQuery.clone()
          .where('status_code', '>=', 400)
          .count('id as count');

        const total = parseInt(totalResult?.count || 0);
        const errors = parseInt(errorResult?.count || 0);

        if (total === 0) return 0;
        return (errors / total) * 100;
      }

      default:
        return 0;
    }
  } catch (error) {
    logger.error(`Error getting current value for alert type ${alert_type}:`, error);
    return 0;
  }
};

/**
 * Check if an alert should be triggered
 * @param {Object} alert - The alert configuration
 * @param {number} currentValue - Current metric value
 * @returns {boolean} Whether the alert should trigger
 */
const checkIfTriggered = (alert, currentValue) => {
  const { threshold_value, threshold_type } = alert;

  if (threshold_type === 'percentage') {
    // For percentage, currentValue is already a percentage
    return currentValue >= parseFloat(threshold_value);
  }

  // Absolute comparison
  return currentValue >= parseFloat(threshold_value);
};

/**
 * Send email notification
 * @param {Object} alert - Alert configuration
 * @param {Object} user - User information
 * @param {number} triggeredValue - The value that triggered the alert
 * @returns {Promise<Object>} Send result
 */
const sendEmail = async (alert, user, triggeredValue) => {
  try {
    const transporter = initEmailTransporter();
    if (!transporter) {
      return { success: false, error: 'Email not configured' };
    }

    const alertTypeLabels = {
      spending: 'Spending Alert',
      rate_limit: 'Rate Limit Alert',
      usage: 'Usage Alert',
      error_rate: 'Error Rate Alert'
    };

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: user.email,
      subject: `[BotBuilder] ${alertTypeLabels[alert.alert_type]}: ${alert.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ef4444;">Alert Triggered</h2>
          <p>Hello ${user.name || 'User'},</p>
          <p>Your alert "<strong>${alert.name}</strong>" has been triggered.</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0;"><strong>Alert Type:</strong> ${alertTypeLabels[alert.alert_type]}</p>
            <p style="margin: 8px 0 0;"><strong>Threshold:</strong> ${alert.threshold_value}${alert.threshold_type === 'percentage' ? '%' : ''}</p>
            <p style="margin: 8px 0 0;"><strong>Current Value:</strong> ${triggeredValue.toFixed(2)}${alert.threshold_type === 'percentage' ? '%' : ''}</p>
            <p style="margin: 8px 0 0;"><strong>Triggered At:</strong> ${new Date().toISOString()}</p>
          </div>
          <p>Please review your usage and take appropriate action.</p>
          <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">
            This is an automated message from BotBuilder. You can manage your alerts in the Developer Portal.
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    return { success: true, channel: 'email' };
  } catch (error) {
    logger.error('Error sending email:', error);
    return { success: false, error: error.message, channel: 'email' };
  }
};

/**
 * Send webhook notification
 * @param {Object} alert - Alert configuration
 * @param {number} triggeredValue - The value that triggered the alert
 * @returns {Promise<Object>} Send result
 */
const sendWebhook = async (alert, triggeredValue) => {
  try {
    if (!alert.webhook_url) {
      return { success: false, error: 'Webhook URL not configured', channel: 'webhook' };
    }

    const payload = {
      alert_id: alert.id,
      alert_name: alert.name,
      alert_type: alert.alert_type,
      threshold_value: parseFloat(alert.threshold_value),
      threshold_type: alert.threshold_type,
      triggered_value: triggeredValue,
      triggered_at: new Date().toISOString(),
      organization_id: alert.organization_id,
      user_id: alert.user_id
    };

    await axios.post(alert.webhook_url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'BotBuilder-Alert-Service'
      },
      timeout: 10000 // 10 second timeout
    });

    return { success: true, channel: 'webhook' };
  } catch (error) {
    logger.error('Error sending webhook:', error);
    return { success: false, error: error.message, channel: 'webhook' };
  }
};

/**
 * Send Slack notification
 * @param {Object} alert - Alert configuration
 * @param {number} triggeredValue - The value that triggered the alert
 * @returns {Promise<Object>} Send result
 */
const sendSlack = async (alert, triggeredValue) => {
  try {
    if (!alert.slack_channel) {
      return { success: false, error: 'Slack channel not configured', channel: 'slack' };
    }

    // Get organization's Slack webhook URL from settings or environment
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!slackWebhookUrl) {
      return { success: false, error: 'Slack webhook not configured', channel: 'slack' };
    }

    const alertTypeEmoji = {
      spending: ':money_with_wings:',
      rate_limit: ':warning:',
      usage: ':chart_with_upwards_trend:',
      error_rate: ':x:'
    };

    const alertTypeLabels = {
      spending: 'Spending Alert',
      rate_limit: 'Rate Limit Alert',
      usage: 'Usage Alert',
      error_rate: 'Error Rate Alert'
    };

    const payload = {
      channel: alert.slack_channel,
      username: 'BotBuilder Alerts',
      icon_emoji: ':robot_face:',
      attachments: [
        {
          color: '#ef4444',
          title: `${alertTypeEmoji[alert.alert_type]} ${alertTypeLabels[alert.alert_type]}`,
          text: `Alert "${alert.name}" has been triggered`,
          fields: [
            {
              title: 'Threshold',
              value: `${alert.threshold_value}${alert.threshold_type === 'percentage' ? '%' : ''}`,
              short: true
            },
            {
              title: 'Current Value',
              value: `${triggeredValue.toFixed(2)}${alert.threshold_type === 'percentage' ? '%' : ''}`,
              short: true
            }
          ],
          footer: 'BotBuilder Alert Service',
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };

    await axios.post(slackWebhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    return { success: true, channel: 'slack' };
  } catch (error) {
    logger.error('Error sending Slack notification:', error);
    return { success: false, error: error.message, channel: 'slack' };
  }
};

/**
 * Send notifications through all configured channels
 * @param {Object} alert - Alert configuration
 * @param {number} triggeredValue - The value that triggered the alert
 * @param {Object} user - User information
 * @returns {Promise<Object>} Results from all channels
 */
const sendNotifications = async (alert, triggeredValue, user) => {
  const channels = typeof alert.notification_channels === 'string'
    ? JSON.parse(alert.notification_channels)
    : alert.notification_channels || ['email'];

  const results = {};

  for (const channel of channels) {
    switch (channel) {
      case 'email':
        results.email = await sendEmail(alert, user, triggeredValue);
        break;
      case 'webhook':
        results.webhook = await sendWebhook(alert, triggeredValue);
        break;
      case 'slack':
        results.slack = await sendSlack(alert, triggeredValue);
        break;
    }
  }

  return results;
};

/**
 * Process a triggered alert
 * @param {Object} alert - Alert configuration
 * @param {number} triggeredValue - The value that triggered the alert
 */
const processTriggeredAlert = async (alert, triggeredValue) => {
  try {
    // Get user info for email
    const user = await db('users')
      .where('id', alert.user_id)
      .select('email', 'name')
      .first();

    if (!user) {
      logger.warn(`User not found for alert ${alert.id}`);
      return;
    }

    // Send notifications
    const notificationResults = await sendNotifications(alert, triggeredValue, user);

    // Record in history
    await db('alert_history').insert({
      alert_id: alert.id,
      triggered_value: triggeredValue,
      notification_sent: JSON.stringify(notificationResults),
      status: Object.values(notificationResults).some(r => r.success) ? 'sent' : 'failed',
      created_at: new Date()
    });

    // Update last triggered timestamp
    await db('usage_alerts')
      .where('id', alert.id)
      .update({
        last_triggered_at: new Date(),
        updated_at: new Date()
      });

    logger.info(`Alert ${alert.id} (${alert.name}) triggered with value ${triggeredValue}`);
  } catch (error) {
    logger.error(`Error processing triggered alert ${alert.id}:`, error);
  }
};

/**
 * Send a test notification for an alert
 * @param {Object} alert - Alert configuration
 * @param {Object} user - User information
 * @returns {Promise<Object>} Test results
 */
const sendTestNotification = async (alert, user) => {
  const testValue = parseFloat(alert.threshold_value) * 1.1; // 10% over threshold for demo
  return await sendNotifications(alert, testValue, user);
};

module.exports = {
  checkThresholds,
  getCurrentValue,
  checkIfTriggered,
  sendEmail,
  sendWebhook,
  sendSlack,
  sendNotifications,
  processTriggeredAlert,
  sendTestNotification
};
