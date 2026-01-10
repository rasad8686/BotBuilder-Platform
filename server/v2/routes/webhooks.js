/**
 * V2 Webhooks Routes
 * Professional webhook management API
 */

const express = require('express');
const router = express.Router();
const validate = require('../middleware/validate');
const { createWebhook, updateWebhook, webhookIdParam, listWebhooks } = require('../validators/webhook.schema');
const { ErrorCodes } = require('../constants/errorCodes');
const { webhookLinks, addLinks } = require('../utils/hateoas');
const { processCursorResults } = require('../utils/pagination');
const { generateSecret, generateSignature } = require('../utils/webhookSignature');

// Get database connection
const getDb = () => require('../../db');

/**
 * GET /api/v2/webhooks
 * List all webhooks
 */
router.get('/', validate(listWebhooks), async (req, res) => {
  try {
    const db = getDb();
    const { limit, cursor, isActive, event } = req.query;

    let query = db('webhooks').where('user_id', req.user.id);

    if (isActive !== undefined) {
      query.where('is_active', isActive);
    }

    if (event) {
      query.whereRaw('events @> ?', [JSON.stringify([event])]);
    }

    if (cursor) {
      const decoded = req.pagination.decodeCursor(cursor);
      if (decoded) {
        query.where('id', '<', decoded.id);
      }
    }

    query.orderBy('created_at', 'desc').limit(limit + 1);

    const webhooks = await query;
    const { data, hasMore, nextCursor } = processCursorResults(webhooks, limit, 'id');

    const webhooksWithLinks = data.map(wh => addLinks(formatWebhook(wh), webhookLinks));

    res.paginate(webhooksWithLinks, { hasMore, nextCursor });
    res.success(webhooksWithLinks);
  } catch (error) {
    console.error('V2 List webhooks error:', error);
    res.apiError(ErrorCodes.DATABASE_ERROR, { message: error.message });
  }
});

/**
 * GET /api/v2/webhooks/:id
 * Get a single webhook
 */
router.get('/:id', validate(webhookIdParam), async (req, res) => {
  try {
    const db = getDb();
    const webhook = await db('webhooks')
      .where({ id: req.params.id, user_id: req.user.id })
      .first();

    if (!webhook) {
      return res.apiError(ErrorCodes.WEBHOOK_NOT_FOUND);
    }

    const formattedWebhook = addLinks(formatWebhook(webhook), webhookLinks);
    res.success(formattedWebhook);
  } catch (error) {
    console.error('V2 Get webhook error:', error);
    res.apiError(ErrorCodes.DATABASE_ERROR, { message: error.message });
  }
});

/**
 * POST /api/v2/webhooks
 * Create a new webhook
 */
router.post('/', validate(createWebhook), async (req, res) => {
  try {
    const db = getDb();
    const { url, events, description, isActive, secret, headers } = req.body;

    // Generate secret if not provided
    const webhookSecret = secret || generateSecret();

    const [webhook] = await db('webhooks')
      .insert({
        user_id: req.user.id,
        url,
        events: JSON.stringify(events),
        description,
        is_active: isActive !== false,
        secret: webhookSecret,
        headers: headers ? JSON.stringify(headers) : null,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    const formattedWebhook = addLinks(formatWebhook(webhook, true), webhookLinks);
    res.created(formattedWebhook);
  } catch (error) {
    console.error('V2 Create webhook error:', error);
    res.apiError(ErrorCodes.DATABASE_ERROR, { message: error.message });
  }
});

/**
 * PUT /api/v2/webhooks/:id
 * Update a webhook
 */
router.put('/:id', validate(updateWebhook), async (req, res) => {
  try {
    const db = getDb();

    const existing = await db('webhooks')
      .where({ id: req.params.id, user_id: req.user.id })
      .first();

    if (!existing) {
      return res.apiError(ErrorCodes.WEBHOOK_NOT_FOUND);
    }

    const updates = { updated_at: new Date() };
    if (req.body.url !== undefined) updates.url = req.body.url;
    if (req.body.events !== undefined) updates.events = JSON.stringify(req.body.events);
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.isActive !== undefined) updates.is_active = req.body.isActive;
    if (req.body.headers !== undefined) updates.headers = JSON.stringify(req.body.headers);

    const [webhook] = await db('webhooks')
      .where({ id: req.params.id })
      .update(updates)
      .returning('*');

    const formattedWebhook = addLinks(formatWebhook(webhook), webhookLinks);
    res.success(formattedWebhook);
  } catch (error) {
    console.error('V2 Update webhook error:', error);
    res.apiError(ErrorCodes.DATABASE_ERROR, { message: error.message });
  }
});

/**
 * DELETE /api/v2/webhooks/:id
 * Delete a webhook
 */
router.delete('/:id', validate(webhookIdParam), async (req, res) => {
  try {
    const db = getDb();

    const deleted = await db('webhooks')
      .where({ id: req.params.id, user_id: req.user.id })
      .del();

    if (!deleted) {
      return res.apiError(ErrorCodes.WEBHOOK_NOT_FOUND);
    }

    res.noContent();
  } catch (error) {
    console.error('V2 Delete webhook error:', error);
    res.apiError(ErrorCodes.DATABASE_ERROR, { message: error.message });
  }
});

/**
 * POST /api/v2/webhooks/:id/test
 * Send a test webhook
 */
router.post('/:id/test', validate(webhookIdParam), async (req, res) => {
  try {
    const db = getDb();
    const axios = require('axios');

    const webhook = await db('webhooks')
      .where({ id: req.params.id, user_id: req.user.id })
      .first();

    if (!webhook) {
      return res.apiError(ErrorCodes.WEBHOOK_NOT_FOUND);
    }

    // Prepare test payload
    const testPayload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook delivery',
        webhookId: webhook.id
      }
    };

    // Generate signature
    const signature = generateSignature(testPayload, webhook.secret);

    // Send test webhook
    const headers = {
      'Content-Type': 'application/json',
      'X-BotBuilder-Signature': signature,
      'X-BotBuilder-Event': 'webhook.test',
      'X-BotBuilder-Delivery': `test_${Date.now()}`,
      ...(webhook.headers ? JSON.parse(webhook.headers) : {})
    };

    let delivery;
    try {
      const response = await axios.post(webhook.url, testPayload, {
        headers,
        timeout: 30000
      });

      delivery = {
        success: true,
        statusCode: response.status,
        responseTime: response.headers['x-response-time'] || null
      };
    } catch (deliveryError) {
      delivery = {
        success: false,
        statusCode: deliveryError.response?.status || null,
        error: deliveryError.message
      };
    }

    res.success({
      webhookId: webhook.id,
      url: webhook.url,
      delivery,
      payload: testPayload
    });
  } catch (error) {
    console.error('V2 Test webhook error:', error);
    res.apiError(ErrorCodes.DATABASE_ERROR, { message: error.message });
  }
});

/**
 * POST /api/v2/webhooks/:id/rotate-secret
 * Rotate webhook secret
 */
router.post('/:id/rotate-secret', validate(webhookIdParam), async (req, res) => {
  try {
    const db = getDb();

    const existing = await db('webhooks')
      .where({ id: req.params.id, user_id: req.user.id })
      .first();

    if (!existing) {
      return res.apiError(ErrorCodes.WEBHOOK_NOT_FOUND);
    }

    const newSecret = generateSecret();

    const [webhook] = await db('webhooks')
      .where({ id: req.params.id })
      .update({
        secret: newSecret,
        updated_at: new Date()
      })
      .returning('*');

    // Return with secret visible (one-time)
    const formattedWebhook = addLinks(formatWebhook(webhook, true), webhookLinks);
    res.success(formattedWebhook);
  } catch (error) {
    console.error('V2 Rotate secret error:', error);
    res.apiError(ErrorCodes.DATABASE_ERROR, { message: error.message });
  }
});

/**
 * GET /api/v2/webhooks/:id/deliveries
 * Get webhook delivery history
 */
router.get('/:id/deliveries', validate(webhookIdParam), async (req, res) => {
  try {
    const db = getDb();
    const { limit = 50 } = req.query;

    const webhook = await db('webhooks')
      .where({ id: req.params.id, user_id: req.user.id })
      .first();

    if (!webhook) {
      return res.apiError(ErrorCodes.WEBHOOK_NOT_FOUND);
    }

    const deliveries = await db('webhook_deliveries')
      .where('webhook_id', req.params.id)
      .orderBy('created_at', 'desc')
      .limit(limit);

    res.success(deliveries.map(formatDelivery));
  } catch (error) {
    console.error('V2 Get deliveries error:', error);
    res.apiError(ErrorCodes.DATABASE_ERROR, { message: error.message });
  }
});

/**
 * Format webhook for API response
 */
function formatWebhook(webhook, showSecret = false) {
  return {
    id: webhook.id,
    url: webhook.url,
    events: webhook.events ? JSON.parse(webhook.events) : [],
    description: webhook.description,
    isActive: webhook.is_active,
    secret: showSecret ? webhook.secret : undefined,
    secretLastFour: webhook.secret ? `...${webhook.secret.slice(-4)}` : null,
    headers: webhook.headers ? JSON.parse(webhook.headers) : null,
    createdAt: webhook.created_at,
    updatedAt: webhook.updated_at
  };
}

/**
 * Format delivery for API response
 */
function formatDelivery(delivery) {
  return {
    id: delivery.id,
    event: delivery.event,
    success: delivery.success,
    statusCode: delivery.status_code,
    responseTime: delivery.response_time,
    error: delivery.error,
    attempts: delivery.attempts,
    createdAt: delivery.created_at
  };
}

module.exports = router;
