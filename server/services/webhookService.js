const db = require('../db');
const axios = require('axios');

/**
 * Webhook Service
 * Handles webhook triggering and delivery for organization events
 */

/**
 * Available webhook events
 */
const WEBHOOK_EVENTS = [
  { name: 'bot.created', description: 'Triggered when a new bot is created' },
  { name: 'bot.updated', description: 'Triggered when a bot is updated' },
  { name: 'bot.deleted', description: 'Triggered when a bot is deleted' },
  { name: 'message.received', description: 'Triggered when a message is received' },
  { name: 'message.sent', description: 'Triggered when a message is sent' },
  { name: 'user.subscribed', description: 'Triggered when a user subscribes to a plan' },
  { name: 'user.unsubscribed', description: 'Triggered when a user unsubscribes' },
];

/**
 * Get all available webhook events
 */
async function getAvailableEvents() {
  return WEBHOOK_EVENTS;
}

/**
 * Trigger a webhook for a specific organization and event
 * @param {number} organizationId - Organization ID
 * @param {string} eventType - Event type (e.g., 'bot.created')
 * @param {object} payload - Event payload data
 */
async function trigger(organizationId, eventType, payload) {
  try {
    console.log(`\n[WEBHOOK] 🔔 Triggering ${eventType} for organization ${organizationId}`);

    // Get all webhooks for this organization that are subscribed to this event
    const result = await db.query(
      `SELECT id, url, secret, events
       FROM webhooks
       WHERE organization_id = $1
         AND is_active = true
         AND $2 = ANY(events)`,
      [organizationId, eventType]
    );

    const webhooks = result.rows;
    console.log(`[WEBHOOK] Found ${webhooks.length} active webhook(s) subscribed to ${eventType}`);

    if (webhooks.length === 0) {
      console.log(`[WEBHOOK] No webhooks to deliver for ${eventType}`);
      return { success: true, triggered: 0 };
    }

    // Trigger each webhook
    for (const webhook of webhooks) {
      await deliverWebhook(webhook, eventType, payload);
    }

    console.log(`[WEBHOOK] ✓ Completed triggering ${webhooks.length} webhook(s)\n`);
    return { success: true, triggered: webhooks.length };
  } catch (error) {
    console.error('[WEBHOOK] ❌ Error triggering webhooks:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Deliver a webhook to a specific URL
 * @param {object} webhook - Webhook configuration
 * @param {string} eventType - Event type
 * @param {object} payload - Event payload
 */
async function deliverWebhook(webhook, eventType, payload) {
  const startTime = Date.now();
  let status = 'success';
  let statusCode = null;
  let responseBody = null;
  let errorMessage = null;

  try {
    console.log(`[WEBHOOK] 📤 Delivering to ${webhook.url}`);

    // Prepare webhook payload
    const webhookPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: payload
    };

    console.log(`[WEBHOOK] 📦 Payload:`, JSON.stringify(webhookPayload, null, 2).substring(0, 500));

    // Send webhook request with timeout
    const response = await axios.post(webhook.url, webhookPayload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': webhook.secret || '',
        'User-Agent': 'BotBuilder-Webhook/1.0'
      },
      timeout: 10000, // 10 second timeout
      validateStatus: () => true // Don't throw on any status code
    });

    statusCode = response.status;
    responseBody = JSON.stringify(response.data).substring(0, 1000); // Limit response body size

    // Consider 2xx as success
    if (statusCode >= 200 && statusCode < 300) {
      console.log(`[WEBHOOK] ✅ Delivered successfully (HTTP ${statusCode})`);
      status = 'success';
    } else {
      console.log(`[WEBHOOK] ❌ Delivery failed (HTTP ${statusCode})`);
      console.log(`[WEBHOOK] Response:`, responseBody.substring(0, 200));
      status = 'failed';
      errorMessage = `HTTP ${statusCode}: ${responseBody}`;
    }
  } catch (error) {
    console.error(`[WEBHOOK] ✗ Delivery error:`, error.message);
    status = 'failed';

    // Handle different error types
    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Connection refused - webhook endpoint not accessible';
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      errorMessage = 'Request timeout - webhook endpoint did not respond in time';
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'DNS lookup failed - webhook URL hostname not found';
    } else {
      errorMessage = error.message;
    }

    statusCode = error.response?.status || null;
    responseBody = error.response?.data ? JSON.stringify(error.response.data).substring(0, 1000) : null;
  }

  const responseTime = Date.now() - startTime;

  // Log webhook delivery attempt
  try {
    await db.query(
      `INSERT INTO webhook_delivery_logs
       (webhook_id, event_type, delivery_status, status_code, response_time_ms, response_body, error_message, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [webhook.id, eventType, status, statusCode, responseTime, responseBody, errorMessage]
    );
  } catch (logError) {
    console.error('[WEBHOOK] Failed to log webhook delivery:', logError);
  }

  return { status, statusCode, responseTime };
}

/**
 * Test a webhook by sending a test event
 * @param {number} webhookId - Webhook ID
 */
async function testWebhook(webhookId) {
  try {
    // Get webhook details
    const result = await db.query(
      'SELECT * FROM webhooks WHERE id = $1',
      [webhookId]
    );

    if (result.rows.length === 0) {
      throw new Error('Webhook not found');
    }

    const webhook = result.rows[0];

    // Send test payload
    const testPayload = {
      test: true,
      message: 'This is a test webhook from BotBuilder',
      timestamp: new Date().toISOString()
    };

    const deliveryResult = await deliverWebhook(webhook, 'test.webhook', testPayload);

    return {
      success: deliveryResult.status === 'success',
      statusCode: deliveryResult.statusCode,
      responseTime: deliveryResult.responseTime
    };
  } catch (error) {
    console.error('[WEBHOOK] Test webhook error:', error);
    throw error;
  }
}

module.exports = {
  trigger,
  testWebhook,
  getAvailableEvents,
  WEBHOOK_EVENTS
};
