const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { organizationContext, requireOrganization } = require('../middleware/organizationContext');
const webhookService = require('../services/webhookService');
const crypto = require('crypto');

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
    console.log('[WEBHOOKS] Fetching available events');
    const events = await webhookService.getAvailableEvents();

    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    console.error('[WEBHOOKS] Error fetching events:', error);
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

    console.log(`[WEBHOOKS] Fetching webhooks for organization ${organizationId}`);

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
    console.error('[WEBHOOKS] Error fetching webhooks:', error);
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

    console.log(`[WEBHOOKS] Creating webhook for organization ${organizationId}`);
    console.log(`[WEBHOOKS] Name: ${name}, URL: ${url}, Events: ${events?.join(', ')}`);

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

    console.log(`[WEBHOOKS] ✓ Webhook created with ID ${result.rows[0].id}`);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[WEBHOOKS] Error creating webhook:', error);
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

    console.log(`[WEBHOOKS] Updating webhook ${webhookId}`);

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

    console.log(`[WEBHOOKS] ✓ Webhook ${webhookId} updated`);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[WEBHOOKS] Error updating webhook:', error);
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

    console.log(`[WEBHOOKS] Deleting webhook ${webhookId}`);

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

    console.log(`[WEBHOOKS] ✓ Webhook ${webhookId} deleted`);

    res.json({
      success: true,
      message: 'Webhook deleted successfully'
    });
  } catch (error) {
    console.error('[WEBHOOKS] Error deleting webhook:', error);
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

    console.log(`[WEBHOOKS] Testing webhook ${webhookId}`);

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

    console.log(`[WEBHOOKS] Test result: ${result.success ? 'success' : 'failed'} (${result.statusCode})`);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[WEBHOOKS] Error testing webhook:', error);
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

    console.log(`[WEBHOOKS] Fetching logs for webhook ${webhookId}`);

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
    console.error('[WEBHOOKS] Error fetching logs:', error);
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
    const webhookId = req.params.id; // UUID string, no need to parseInt
    const organizationId = req.organization.id;

    console.log(`[WEBHOOKS] Regenerating secret for webhook ${webhookId}`);

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

    // Update secret
    const result = await db.query(
      `UPDATE webhooks
       SET secret = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, url, secret, events, is_active, created_at, updated_at`,
      [secret, webhookId]
    );

    console.log(`[WEBHOOKS] ✓ Secret regenerated for webhook ${webhookId}`);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[WEBHOOKS] Error regenerating secret:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to regenerate secret'
    });
  }
});

module.exports = router;
