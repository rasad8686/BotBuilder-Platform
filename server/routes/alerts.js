/**
 * Usage Alerts Routes
 * API endpoints for managing usage alerts and viewing history
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../db');
const alertService = require('../services/alertService');
const logger = require('../utils/logger');

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/alerts
 * Get all alerts for the current user/organization
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    let query = db('usage_alerts')
      .select('*')
      .orderBy('created_at', 'desc');

    if (organizationId) {
      query = query.where('organization_id', organizationId);
    } else {
      query = query.where('user_id', userId);
    }

    const alerts = await query;

    res.json({
      success: true,
      alerts: alerts.map(alert => ({
        ...alert,
        notification_channels: typeof alert.notification_channels === 'string'
          ? JSON.parse(alert.notification_channels)
          : alert.notification_channels
      }))
    });
  } catch (error) {
    logger.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alerts'
    });
  }
});

/**
 * POST /api/alerts
 * Create a new alert
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const organizationId = req.user.organization_id;
    const {
      name,
      alert_type,
      threshold_value,
      threshold_type = 'absolute',
      notification_channels = ['email'],
      webhook_url,
      slack_channel,
      is_active = true
    } = req.body;

    // Validation
    if (!alert_type || !['spending', 'rate_limit', 'usage', 'error_rate'].includes(alert_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid alert_type. Must be one of: spending, rate_limit, usage, error_rate'
      });
    }

    if (threshold_value === undefined || threshold_value === null || isNaN(threshold_value)) {
      return res.status(400).json({
        success: false,
        error: 'threshold_value is required and must be a number'
      });
    }

    if (!['absolute', 'percentage'].includes(threshold_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid threshold_type. Must be absolute or percentage'
      });
    }

    // Validate channels
    const validChannels = ['email', 'webhook', 'slack'];
    const channels = Array.isArray(notification_channels) ? notification_channels : ['email'];
    const invalidChannels = channels.filter(c => !validChannels.includes(c));
    if (invalidChannels.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid notification channels: ${invalidChannels.join(', ')}`
      });
    }

    // Validate webhook URL if webhook channel selected
    if (channels.includes('webhook') && !webhook_url) {
      return res.status(400).json({
        success: false,
        error: 'webhook_url is required when webhook channel is selected'
      });
    }

    // Validate slack channel if slack notification selected
    if (channels.includes('slack') && !slack_channel) {
      return res.status(400).json({
        success: false,
        error: 'slack_channel is required when slack notification is selected'
      });
    }

    const [alert] = await db('usage_alerts')
      .insert({
        user_id: userId,
        organization_id: organizationId,
        name: name || `${alert_type} Alert`,
        alert_type,
        threshold_value,
        threshold_type,
        notification_channels: JSON.stringify(channels),
        webhook_url,
        slack_channel,
        is_active,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    res.status(201).json({
      success: true,
      alert: {
        ...alert,
        notification_channels: channels
      }
    });
  } catch (error) {
    logger.error('Error creating alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create alert'
    });
  }
});

/**
 * PUT /api/alerts/:id
 * Update an existing alert
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    // Check ownership
    const existingAlert = await db('usage_alerts')
      .where('id', id)
      .first();

    if (!existingAlert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    // Verify ownership
    if (organizationId && existingAlert.organization_id !== organizationId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this alert'
      });
    }
    if (!organizationId && existingAlert.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this alert'
      });
    }

    const {
      name,
      alert_type,
      threshold_value,
      threshold_type,
      notification_channels,
      webhook_url,
      slack_channel,
      is_active
    } = req.body;

    const updates = { updated_at: new Date() };

    if (name !== undefined) updates.name = name;
    if (alert_type !== undefined) {
      if (!['spending', 'rate_limit', 'usage', 'error_rate'].includes(alert_type)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid alert_type'
        });
      }
      updates.alert_type = alert_type;
    }
    if (threshold_value !== undefined) updates.threshold_value = threshold_value;
    if (threshold_type !== undefined) {
      if (!['absolute', 'percentage'].includes(threshold_type)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid threshold_type'
        });
      }
      updates.threshold_type = threshold_type;
    }
    if (notification_channels !== undefined) {
      updates.notification_channels = JSON.stringify(notification_channels);
    }
    if (webhook_url !== undefined) updates.webhook_url = webhook_url;
    if (slack_channel !== undefined) updates.slack_channel = slack_channel;
    if (is_active !== undefined) updates.is_active = is_active;

    const [updatedAlert] = await db('usage_alerts')
      .where('id', id)
      .update(updates)
      .returning('*');

    res.json({
      success: true,
      alert: {
        ...updatedAlert,
        notification_channels: typeof updatedAlert.notification_channels === 'string'
          ? JSON.parse(updatedAlert.notification_channels)
          : updatedAlert.notification_channels
      }
    });
  } catch (error) {
    logger.error('Error updating alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update alert'
    });
  }
});

/**
 * DELETE /api/alerts/:id
 * Delete an alert
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    // Check ownership
    const existingAlert = await db('usage_alerts')
      .where('id', id)
      .first();

    if (!existingAlert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    // Verify ownership
    if (organizationId && existingAlert.organization_id !== organizationId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this alert'
      });
    }
    if (!organizationId && existingAlert.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this alert'
      });
    }

    await db('usage_alerts')
      .where('id', id)
      .delete();

    res.json({
      success: true,
      message: 'Alert deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete alert'
    });
  }
});

/**
 * GET /api/alerts/:id/history
 * Get trigger history for an alert
 */
router.get('/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;
    const { limit = 50, offset = 0 } = req.query;

    // Check ownership
    const existingAlert = await db('usage_alerts')
      .where('id', id)
      .first();

    if (!existingAlert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    // Verify ownership
    if (organizationId && existingAlert.organization_id !== organizationId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this alert history'
      });
    }
    if (!organizationId && existingAlert.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this alert history'
      });
    }

    const history = await db('alert_history')
      .where('alert_id', id)
      .orderBy('created_at', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    const [{ count }] = await db('alert_history')
      .where('alert_id', id)
      .count('id as count');

    res.json({
      success: true,
      history: history.map(h => ({
        ...h,
        notification_sent: typeof h.notification_sent === 'string'
          ? JSON.parse(h.notification_sent)
          : h.notification_sent
      })),
      total: parseInt(count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('Error fetching alert history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alert history'
    });
  }
});

/**
 * POST /api/alerts/test/:id
 * Send a test notification for an alert
 */
router.post('/test/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    // Check ownership
    const alert = await db('usage_alerts')
      .where('id', id)
      .first();

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    // Verify ownership
    if (organizationId && alert.organization_id !== organizationId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to test this alert'
      });
    }
    if (!organizationId && alert.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to test this alert'
      });
    }

    // Get user email
    const user = await db('users')
      .where('id', userId)
      .select('email', 'name')
      .first();

    // Send test notification
    const result = await alertService.sendTestNotification(alert, user);

    res.json({
      success: true,
      message: 'Test notification sent',
      results: result
    });
  } catch (error) {
    logger.error('Error sending test notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test notification'
    });
  }
});

module.exports = router;
