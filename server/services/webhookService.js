const db = require('../db');
const axios = require('axios');
const crypto = require('crypto');
const log = require('../utils/logger');

/**
 * Webhook Service
 * Handles webhook triggering and delivery for organization events
 * Features: HMAC signature, auto-disable, retry with exponential backoff
 */

// Configuration
const MAX_RETRIES = 3;
const MAX_CONSECUTIVE_FAILURES = 5;
const RETRY_DELAYS = [1000, 5000, 30000]; // 1s, 5s, 30s exponential backoff

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
  { name: 'conversation.started', description: 'Triggered when a new conversation starts' },
  { name: 'conversation.ended', description: 'Triggered when a conversation ends' },
  { name: 'agent.completed', description: 'Triggered when an autonomous agent completes a task' },
];

/**
 * Generate HMAC signature for webhook payload
 * @param {string} payload - JSON string payload
 * @param {string} secret - Webhook signing secret
 * @returns {string} HMAC-SHA256 signature
 */
function generateSignature(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

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
    log.info(`\n[WEBHOOK] 🔔 Triggering ${eventType} for organization ${organizationId}`);

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
    log.info(`[WEBHOOK] Found ${webhooks.length} active webhook(s) subscribed to ${eventType}`);

    if (webhooks.length === 0) {
      log.info(`[WEBHOOK] No webhooks to deliver for ${eventType}`);
      return { success: true, triggered: 0 };
    }

    // Trigger each webhook
    for (const webhook of webhooks) {
      await deliverWebhook(webhook, eventType, payload);
    }

    log.info(`[WEBHOOK] ✓ Completed triggering ${webhooks.length} webhook(s)\n`);
    return { success: true, triggered: webhooks.length };
  } catch (error) {
    log.error('[WEBHOOK] ❌ Error triggering webhooks:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Deliver a webhook to a specific URL with HMAC signature
 * @param {object} webhook - Webhook configuration
 * @param {string} eventType - Event type
 * @param {object} payload - Event payload
 * @param {number} attemptNumber - Current attempt number (for retries)
 */
async function deliverWebhook(webhook, eventType, payload, attemptNumber = 1) {
  const startTime = Date.now();
  let status = 'success';
  let statusCode = null;
  let responseBody = null;
  let errorMessage = null;
  let success = false;

  try {
    log.info(`[WEBHOOK] 📤 Delivering to ${webhook.url} (attempt ${attemptNumber}/${MAX_RETRIES})`);

    // Prepare webhook payload
    const webhookPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      webhook_id: webhook.id,
      data: payload
    };

    const payloadString = JSON.stringify(webhookPayload);
    log.debug(`[WEBHOOK] 📦 Payload:`, payloadString.substring(0, 500));

    // Generate HMAC signature using signing_secret or secret
    const signingSecret = webhook.signing_secret || webhook.secret || '';
    const signature = signingSecret ? generateSignature(payloadString, signingSecret) : '';

    // Send webhook request with timeout
    const response = await axios.post(webhook.url, webhookPayload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': webhook.secret || '',
        'X-Signature': signature,
        'X-Signature-256': `sha256=${signature}`,
        'X-Webhook-Timestamp': webhookPayload.timestamp,
        'User-Agent': 'BotBuilder-Webhook/1.0'
      },
      timeout: 10000, // 10 second timeout
      validateStatus: () => true // Don't throw on any status code
    });

    statusCode = response.status;
    responseBody = JSON.stringify(response.data).substring(0, 1000); // Limit response body size

    // Consider 2xx as success
    if (statusCode >= 200 && statusCode < 300) {
      log.info(`[WEBHOOK] ✅ Delivered successfully (HTTP ${statusCode})`);
      status = 'success';
      success = true;
    } else {
      log.info(`[WEBHOOK] ❌ Delivery failed (HTTP ${statusCode})`);
      log.info(`[WEBHOOK] Response:`, responseBody.substring(0, 200));
      status = 'failed';
      errorMessage = `HTTP ${statusCode}: ${responseBody}`;
    }
  } catch (error) {
    log.error(`[WEBHOOK] ✗ Delivery error:`, error.message);
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
       (webhook_id, event_type, delivery_status, status_code, response_time_ms, response_body, error_message, payload, attempt_number, success, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [webhook.id, eventType, status, statusCode, responseTime, responseBody, errorMessage, payload, attemptNumber, success]
    );
  } catch (logError) {
    log.error('[WEBHOOK] Failed to log webhook delivery:', logError);
  }

  // Update failure tracking
  if (!success) {
    await updateFailureCount(webhook.id, true);
  } else {
    await updateFailureCount(webhook.id, false);
  }

  return { status, statusCode, responseTime, success };
}

/**
 * Update webhook failure count and auto-disable if needed
 * @param {string} webhookId - Webhook ID
 * @param {boolean} failed - Whether the delivery failed
 */
async function updateFailureCount(webhookId, failed) {
  try {
    if (failed) {
      // Increment failure count
      const result = await db.query(
        `UPDATE webhooks
         SET failure_count = COALESCE(failure_count, 0) + 1,
             last_failure_at = NOW(),
             updated_at = NOW()
         WHERE id = $1
         RETURNING failure_count`,
        [webhookId]
      );

      const failureCount = result.rows[0]?.failure_count || 0;

      // Auto-disable after MAX_CONSECUTIVE_FAILURES failures
      if (failureCount >= MAX_CONSECUTIVE_FAILURES) {
        await db.query(
          `UPDATE webhooks
           SET is_active = false, disabled_at = NOW(), updated_at = NOW()
           WHERE id = $1 AND disabled_at IS NULL`,
          [webhookId]
        );
        log.warn(`[WEBHOOK] ⚠️ Webhook ${webhookId} auto-disabled after ${failureCount} consecutive failures`);
      }
    } else {
      // Reset failure count on success
      await db.query(
        `UPDATE webhooks
         SET failure_count = 0, updated_at = NOW()
         WHERE id = $1`,
        [webhookId]
      );
    }
  } catch (error) {
    log.error('[WEBHOOK] Failed to update failure count:', error);
  }
}

/**
 * Deliver webhook with retry logic (exponential backoff)
 * @param {object} webhook - Webhook configuration
 * @param {string} eventType - Event type
 * @param {object} payload - Event payload
 */
async function deliverWithRetry(webhook, eventType, payload) {
  let lastResult = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    lastResult = await deliverWebhook(webhook, eventType, payload, attempt);

    if (lastResult.success) {
      return lastResult;
    }

    // Don't retry on last attempt
    if (attempt < MAX_RETRIES) {
      const delay = RETRY_DELAYS[attempt - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
      log.info(`[WEBHOOK] Retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return lastResult;
}

/**
 * Retry a specific failed delivery
 * @param {object} webhook - Webhook configuration
 * @param {object} deliveryLog - Original delivery log entry
 */
async function retryDelivery(webhook, deliveryLog) {
  const eventType = deliveryLog.event_type;
  const payload = deliveryLog.payload || {};

  log.info(`[WEBHOOK] Retrying delivery for log ${deliveryLog.id}`);

  // Get current attempt count for this original delivery
  const attemptResult = await db.query(
    `SELECT MAX(attempt_number) as max_attempt FROM webhook_delivery_logs
     WHERE webhook_id = $1 AND event_type = $2
     AND created_at >= $3 - INTERVAL '1 hour'`,
    [webhook.id, eventType, deliveryLog.created_at]
  );

  const nextAttempt = (attemptResult.rows[0]?.max_attempt || 0) + 1;

  const result = await deliverWebhook(webhook, eventType, payload, nextAttempt);

  return {
    success: result.success,
    statusCode: result.statusCode,
    responseTime: result.responseTime,
    attempt: nextAttempt
  };
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
    log.error('[WEBHOOK] Test webhook error:', error);
    throw error;
  }
}

module.exports = {
  trigger,
  testWebhook,
  getAvailableEvents,
  deliverWithRetry,
  retryDelivery,
  generateSignature,
  WEBHOOK_EVENTS,
  MAX_RETRIES,
  MAX_CONSECUTIVE_FAILURES
};
