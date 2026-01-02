const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { organizationContext, requireOrganization } = require('../middleware/organizationContext');
const webhookService = require('../services/webhookService');
const crypto = require('crypto');
const log = require('../utils/logger');

// Apply authentication and organization context to all routes
router.use(authenticateToken);
router.use(organizationContext);
router.use(requireOrganization);

/**
 * GET /api/webhooks/events/list
 * Get available webhook events
 */
router.get('/events/list', async (req, res) => {
  try {
    log.info('Fetching available webhook events');
    const events = await webhookService.getAvailableEvents();

    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    log.error('Error fetching webhook events', {
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch webhook events'
    });
  }
});

/**
 * GET /api/webhooks
 * Get all webhooks for the current organization
 */
router.get('/', async (req, res) => {
  try {
    const organizationId = req.organization.id;

    log.info('Fetching webhooks', { organizationId });

    const result = await db.query(
      `SELECT
         w.id,
         w.name,
         w.url,
         w.events,
         w.is_active,
         w.created_at,
         w.updated_at,
         COUNT(wdl.id) AS total_attempts,
         COUNT(CASE WHEN wdl.delivery_status = 'success' THEN 1 END) AS successful,
         COUNT(CASE WHEN wdl.delivery_status = 'failed' THEN 1 END) AS failed
       FROM webhooks w
       LEFT JOIN webhook_delivery_logs wdl ON w.id = wdl.webhook_id
       WHERE w.organization_id = $1
       GROUP BY w.id, w.name, w.url, w.events, w.is_active, w.created_at, w.updated_at
       ORDER BY w.created_at DESC`,
      [organizationId]
    );

    // Format the response with stats
    const webhooks = result.rows.map(webhook => {
      const totalAttempts = parseInt(webhook.total_attempts) || 0;
      const successful = parseInt(webhook.successful) || 0;
      const failed = parseInt(webhook.failed) || 0;
      const successRate = totalAttempts > 0 ? Math.round((successful / totalAttempts) * 100) : 0;

      return {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        is_active: webhook.is_active,
        created_at: webhook.created_at,
        updated_at: webhook.updated_at,
        stats: {
          total_attempts: totalAttempts,
          successful: successful,
          failed: failed,
          success_rate: successRate
        }
      };
    });

    res.json({
      success: true,
      data: webhooks
    });
  } catch (error) {
    log.error('Error fetching webhooks', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch webhooks'
    });
  }
});

/**
 * POST /api/webhooks
 * Create a new webhook
 */
router.post('/', async (req, res) => {
  try {
    const organizationId = req.organization.id;
    const { name, url, events } = req.body;

    log.info('Creating webhook', { organizationId, name, url, events: events?.join(', ') });

    // Validation
    if (!name || !url || !events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Name, URL, and at least one event are required'
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: 'Invalid URL format'
      });
    }

    // Generate a secret for webhook signature verification
    const secret = crypto.randomBytes(32).toString('hex');

    // Insert webhook
    const result = await db.query(
      `INSERT INTO webhooks (organization_id, name, url, secret, events, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
       RETURNING id, name, url, secret, events, is_active, created_at, updated_at`,
      [organizationId, name, url, secret, events]
    );

    log.info('Webhook created successfully', { webhookId: result.rows[0].id });

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    log.error('Error creating webhook', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to create webhook'
    });
  }
});

/**
 * PUT /api/webhooks/:id
 * Update a webhook
 */
router.put('/:id', async (req, res) => {
  try {
    const webhookId = req.params.id; // UUID string, no need to parseInt
    const organizationId = req.organization.id;
    const { name, url, events, is_active } = req.body;

    log.info('Updating webhook', { webhookId });

    // Verify webhook belongs to organization
    const checkResult = await db.query(
      'SELECT id FROM webhooks WHERE id = $1 AND organization_id = $2',
      [webhookId, organizationId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Webhook not found'
      });
    }

    // Build update query dynamically based on provided fields
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }

    if (url !== undefined) {
      // Validate URL format
      try {
        new URL(url);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Invalid URL format'
        });
      }
      updates.push(`url = $${paramCount++}`);
      values.push(url);
    }

    if (events !== undefined) {
      if (!Array.isArray(events) || events.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Events must be a non-empty array'
        });
      }
      updates.push(`events = $${paramCount++}`);
      values.push(events);
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }

    // Add updated_at
    updates.push(`updated_at = NOW()`);

    // Add webhook ID as last parameter
    values.push(webhookId);

    const result = await db.query(
      `UPDATE webhooks
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, name, url, secret, events, is_active, created_at, updated_at`,
      values
    );

    log.info('Webhook updated successfully', { webhookId });

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    log.error('Error updating webhook', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to update webhook'
    });
  }
});

/**
 * DELETE /api/webhooks/:id
 * Delete a webhook
 */
router.delete('/:id', async (req, res) => {
  try {
    const webhookId = req.params.id; // UUID string, no need to parseInt
    const organizationId = req.organization.id;

    log.info('Deleting webhook', { webhookId });

    // Verify webhook belongs to organization and delete
    const result = await db.query(
      'DELETE FROM webhooks WHERE id = $1 AND organization_id = $2 RETURNING id',
      [webhookId, organizationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Webhook not found'
      });
    }

    log.info('Webhook deleted successfully', { webhookId });

    res.json({
      success: true,
      message: 'Webhook deleted successfully'
    });
  } catch (error) {
    log.error('Error deleting webhook', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to delete webhook'
    });
  }
});

/**
 * POST /api/webhooks/:id/test
 * Test a webhook by sending a test event
 */
router.post('/:id/test', async (req, res) => {
  try {
    const webhookId = req.params.id; // UUID string, no need to parseInt
    const organizationId = req.organization.id;

    log.info('Testing webhook', { webhookId });

    // Verify webhook belongs to organization
    const checkResult = await db.query(
      'SELECT id FROM webhooks WHERE id = $1 AND organization_id = $2',
      [webhookId, organizationId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Webhook not found'
      });
    }

    // Send test webhook
    const result = await webhookService.testWebhook(webhookId);

    log.info('Webhook test completed', { webhookId, success: result.success, statusCode: result.statusCode });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    log.error('Error testing webhook', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to test webhook: ' + error.message
    });
  }
});

/**
 * GET /api/webhooks/:id/logs
 * Get delivery logs for a webhook
 */
router.get('/:id/logs', async (req, res) => {
  try {
    const webhookId = req.params.id; // UUID string, no need to parseInt
    const organizationId = req.organization.id;
    const limit = parseInt(req.query.limit) || 50;

    log.info('Fetching webhook logs', { webhookId });

    // Verify webhook belongs to organization
    const checkResult = await db.query(
      'SELECT id FROM webhooks WHERE id = $1 AND organization_id = $2',
      [webhookId, organizationId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Webhook not found'
      });
    }

    // Fetch logs
    const result = await db.query(
      `SELECT id, event_type, delivery_status as status, status_code, response_time_ms, response_body, error_message, created_at
       FROM webhook_delivery_logs
       WHERE webhook_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [webhookId, limit]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    log.error('Error fetching logs', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch webhook logs'
    });
  }
});

/**
 * POST /api/webhooks/:id/regenerate-secret
 * Regenerate webhook secret
 */
router.post('/:id/regenerate-secret', async (req, res) => {
  try {
    const webhookId = req.params.id;
    const organizationId = req.organization.id;

    log.info('Regenerating webhook secret', { webhookId });

    // Verify webhook belongs to organization
    const checkResult = await db.query(
      'SELECT id FROM webhooks WHERE id = $1 AND organization_id = $2',
      [webhookId, organizationId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Webhook not found'
      });
    }

    // Generate new secret
    const secret = crypto.randomBytes(32).toString('hex');

    // Update secret and signing_secret
    const result = await db.query(
      `UPDATE webhooks
       SET secret = $1, signing_secret = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, url, secret, signing_secret, events, is_active, created_at, updated_at`,
      [secret, webhookId]
    );

    log.info('Webhook secret regenerated successfully', { webhookId });

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    log.error('Error regenerating secret', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to regenerate secret'
    });
  }
});

/**
 * POST /api/webhooks/:id/rotate-secret
 * Rotate webhook signing secret
 */
router.post('/:id/rotate-secret', async (req, res) => {
  try {
    const webhookId = req.params.id;
    const organizationId = req.organization.id;

    log.info('Rotating webhook signing secret', { webhookId });

    // Verify webhook belongs to organization
    const checkResult = await db.query(
      'SELECT id FROM webhooks WHERE id = $1 AND organization_id = $2',
      [webhookId, organizationId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Webhook not found'
      });
    }

    // Generate new signing secret
    const signingSecret = crypto.randomBytes(32).toString('hex');

    // Update signing_secret
    const result = await db.query(
      `UPDATE webhooks
       SET signing_secret = $1, secret = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, url, signing_secret, events, is_active, created_at, updated_at`,
      [signingSecret, webhookId]
    );

    log.info('Webhook signing secret rotated successfully', { webhookId });

    res.json({
      success: true,
      data: {
        ...result.rows[0],
        message: 'Signing secret rotated. Update your webhook handler with the new secret.'
      }
    });
  } catch (error) {
    log.error('Error rotating signing secret', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to rotate signing secret'
    });
  }
});

/**
 * GET /api/webhooks/:id/stats
 * Get webhook statistics (success rate, avg response time)
 */
router.get('/:id/stats', async (req, res) => {
  try {
    const webhookId = req.params.id;
    const organizationId = req.organization.id;
    const days = parseInt(req.query.days) || 30;

    log.info('Fetching webhook stats', { webhookId, days });

    // Verify webhook belongs to organization
    const checkResult = await db.query(
      'SELECT id, failure_count, last_failure_at, disabled_at FROM webhooks WHERE id = $1 AND organization_id = $2',
      [webhookId, organizationId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Webhook not found'
      });
    }

    const webhook = checkResult.rows[0];

    // Get statistics
    const statsResult = await db.query(
      `SELECT
         COUNT(*) AS total_deliveries,
         COUNT(CASE WHEN delivery_status = 'success' OR success = true THEN 1 END) AS successful,
         COUNT(CASE WHEN delivery_status = 'failed' OR success = false THEN 1 END) AS failed,
         ROUND(AVG(response_time_ms)::numeric, 2) AS avg_response_time,
         MIN(response_time_ms) AS min_response_time,
         MAX(response_time_ms) AS max_response_time
       FROM webhook_delivery_logs
       WHERE webhook_id = $1
         AND created_at > NOW() - INTERVAL '1 day' * $2`,
      [webhookId, days]
    );

    // Get daily breakdown
    const dailyResult = await db.query(
      `SELECT
         DATE(created_at) AS date,
         COUNT(*) AS total,
         COUNT(CASE WHEN delivery_status = 'success' OR success = true THEN 1 END) AS successful,
         COUNT(CASE WHEN delivery_status = 'failed' OR success = false THEN 1 END) AS failed
       FROM webhook_delivery_logs
       WHERE webhook_id = $1
         AND created_at > NOW() - INTERVAL '1 day' * $2
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at) DESC`,
      [webhookId, days]
    );

    // Get event type breakdown
    const eventsResult = await db.query(
      `SELECT
         event_type,
         COUNT(*) AS total,
         COUNT(CASE WHEN delivery_status = 'success' OR success = true THEN 1 END) AS successful
       FROM webhook_delivery_logs
       WHERE webhook_id = $1
         AND created_at > NOW() - INTERVAL '1 day' * $2
       GROUP BY event_type
       ORDER BY total DESC`,
      [webhookId, days]
    );

    const stats = statsResult.rows[0];
    const totalDeliveries = parseInt(stats.total_deliveries) || 0;
    const successful = parseInt(stats.successful) || 0;
    const successRate = totalDeliveries > 0 ? Math.round((successful / totalDeliveries) * 100) : 0;

    res.json({
      success: true,
      data: {
        summary: {
          total_deliveries: totalDeliveries,
          successful: successful,
          failed: parseInt(stats.failed) || 0,
          success_rate: successRate,
          avg_response_time: parseFloat(stats.avg_response_time) || 0,
          min_response_time: parseInt(stats.min_response_time) || 0,
          max_response_time: parseInt(stats.max_response_time) || 0
        },
        health: {
          failure_count: webhook.failure_count || 0,
          last_failure_at: webhook.last_failure_at,
          disabled_at: webhook.disabled_at,
          status: webhook.disabled_at ? 'disabled' : (webhook.failure_count >= 5 ? 'failing' : 'healthy')
        },
        daily: dailyResult.rows,
        by_event: eventsResult.rows,
        period_days: days
      }
    });
  } catch (error) {
    log.error('Error fetching webhook stats', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch webhook stats'
    });
  }
});

/**
 * POST /api/webhooks/:id/retry/:logId
 * Retry a failed webhook delivery
 */
router.post('/:id/retry/:logId', async (req, res) => {
  try {
    const webhookId = req.params.id;
    const logId = parseInt(req.params.logId);
    const organizationId = req.organization.id;

    log.info('Retrying webhook delivery', { webhookId, logId });

    // Verify webhook belongs to organization
    const webhookResult = await db.query(
      'SELECT * FROM webhooks WHERE id = $1 AND organization_id = $2',
      [webhookId, organizationId]
    );

    if (webhookResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Webhook not found'
      });
    }

    // Get the failed delivery log
    const logResult = await db.query(
      `SELECT * FROM webhook_delivery_logs
       WHERE id = $1 AND webhook_id = $2`,
      [logId, webhookId]
    );

    if (logResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Delivery log not found'
      });
    }

    const deliveryLog = logResult.rows[0];
    const webhook = webhookResult.rows[0];

    // Retry the delivery
    const retryResult = await webhookService.retryDelivery(webhook, deliveryLog);

    log.info('Webhook retry completed', { webhookId, logId, success: retryResult.success });

    res.json({
      success: true,
      data: retryResult
    });
  } catch (error) {
    log.error('Error retrying webhook', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to retry webhook delivery'
    });
  }
});

/**
 * POST /api/webhooks/:id/enable
 * Re-enable a disabled webhook
 */
router.post('/:id/enable', async (req, res) => {
  try {
    const webhookId = req.params.id;
    const organizationId = req.organization.id;

    log.info('Enabling webhook', { webhookId });

    // Verify webhook belongs to organization
    const checkResult = await db.query(
      'SELECT id FROM webhooks WHERE id = $1 AND organization_id = $2',
      [webhookId, organizationId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Webhook not found'
      });
    }

    // Re-enable webhook and reset failure count
    const result = await db.query(
      `UPDATE webhooks
       SET is_active = true, disabled_at = NULL, failure_count = 0, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, url, events, is_active, failure_count, disabled_at, created_at, updated_at`,
      [webhookId]
    );

    log.info('Webhook enabled successfully', { webhookId });

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    log.error('Error enabling webhook', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to enable webhook'
    });
  }
});

module.exports = router;
