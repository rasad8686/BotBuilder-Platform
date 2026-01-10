/**
 * Ticket Webhook Service
 * Handles webhook delivery for ticket events
 */

const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Webhook events
const WEBHOOK_EVENTS = [
  'ticket.created',
  'ticket.updated',
  'ticket.assigned',
  'ticket.resolved',
  'ticket.closed',
  'ticket.reopened',
  'ticket.comment.added',
  'ticket.sla.breached',
  'ticket.sla.warning',
  'ticket.priority.changed',
  'ticket.status.changed',
];

class TicketWebhookService {
  /**
   * Send webhook for a ticket event
   */
  async triggerWebhook(workspaceId, event, data) {
    try {
      // Get active webhooks subscribed to this event
      const webhooks = await db('ticket_webhooks')
        .where('workspace_id', workspaceId)
        .where('is_active', true)
        .whereRaw("? = ANY(events::text[])", [event])
        .orWhereRaw("events::jsonb @> ?", [JSON.stringify([event])]);

      if (webhooks.length === 0) {
        return { sent: 0, webhooks: [] };
      }

      const results = [];

      for (const webhook of webhooks) {
        const result = await this.sendWebhook(webhook, event, data);
        results.push(result);
      }

      return {
        sent: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        webhooks: results,
      };
    } catch (error) {
      console.error('Error triggering webhooks:', error);
      return { sent: 0, failed: 0, error: error.message };
    }
  }

  /**
   * Send a single webhook
   */
  async sendWebhook(webhook, event, data) {
    const startTime = Date.now();
    const payload = this.buildPayload(event, data, webhook.workspace_id);
    const signature = this.generateSignature(payload, webhook.secret);

    const headers = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': event,
      'X-Webhook-Signature': signature,
      'X-Webhook-Timestamp': new Date().toISOString(),
      'X-Webhook-ID': uuidv4(),
      ...(typeof webhook.headers === 'string' ? JSON.parse(webhook.headers) : (webhook.headers || {})),
    };

    let attempt = 0;
    let lastError = null;
    let response = null;

    while (attempt < (webhook.retry_count || 3)) {
      attempt++;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), webhook.timeout_ms || 30000);

        const fetchResponse = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        response = {
          status: fetchResponse.status,
          body: await fetchResponse.text().catch(() => ''),
        };

        if (fetchResponse.ok) {
          // Success
          await this.logDelivery(webhook.id, event, payload, response, 'success', attempt, null, Date.now() - startTime);
          await this.updateWebhookStats(webhook.id, true);

          return {
            success: true,
            webhook_id: webhook.id,
            event,
            status: response.status,
            attempt,
            duration: Date.now() - startTime,
          };
        }

        // Non-retryable status codes
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          lastError = `HTTP ${response.status}: ${response.body.substring(0, 200)}`;
          break;
        }

        lastError = `HTTP ${response.status}`;
      } catch (error) {
        lastError = error.message;

        // Don't retry on abort (timeout)
        if (error.name === 'AbortError') {
          lastError = 'Request timeout';
          break;
        }
      }

      // Wait before retry (exponential backoff)
      if (attempt < webhook.retry_count) {
        await this.sleep(Math.pow(2, attempt) * 1000);
      }
    }

    // All attempts failed
    await this.logDelivery(webhook.id, event, payload, response, 'failed', attempt, lastError, Date.now() - startTime);
    await this.updateWebhookStats(webhook.id, false);

    return {
      success: false,
      webhook_id: webhook.id,
      event,
      error: lastError,
      attempts: attempt,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Build webhook payload
   */
  buildPayload(event, data, workspaceId) {
    return {
      event,
      timestamp: new Date().toISOString(),
      workspace_id: workspaceId,
      data: {
        ticket: data.ticket ? this.sanitizeTicket(data.ticket) : null,
        changes: data.changes || null,
        actor: data.actor ? {
          id: data.actor.id,
          name: data.actor.name,
          email: data.actor.email,
          type: data.actor.type,
        } : null,
        comment: data.comment ? {
          id: data.comment.id,
          content: data.comment.content,
          is_internal: data.comment.is_internal,
          created_at: data.comment.created_at,
        } : null,
        metadata: data.metadata || {},
      },
    };
  }

  /**
   * Sanitize ticket data for webhook
   */
  sanitizeTicket(ticket) {
    return {
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      category_id: ticket.category_id,
      assignee_id: ticket.assignee_id,
      requester_id: ticket.requester_id,
      requester_email: ticket.requester_email,
      tags: ticket.tags,
      channel: ticket.channel,
      sla_policy_id: ticket.sla_policy_id,
      first_response_due: ticket.first_response_due,
      resolution_due: ticket.resolution_due,
      first_response_at: ticket.first_response_at,
      resolved_at: ticket.resolved_at,
      closed_at: ticket.closed_at,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      custom_fields: ticket.custom_fields,
    };
  }

  /**
   * Generate HMAC signature
   */
  generateSignature(payload, secret) {
    if (!secret) {
      return 'none';
    }

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return `sha256=${hmac.digest('hex')}`;
  }

  /**
   * Log webhook delivery
   */
  async logDelivery(webhookId, event, payload, response, status, attempt, error, duration) {
    await db('webhook_delivery_logs').insert({
      id: uuidv4(),
      webhook_id: webhookId,
      event,
      payload: JSON.stringify(payload),
      response_status: response?.status,
      response_body: response?.body?.substring(0, 2000),
      duration_ms: duration,
      status,
      attempt_number: attempt,
      error_message: error,
      delivered_at: new Date(),
    });
  }

  /**
   * Update webhook statistics
   */
  async updateWebhookStats(webhookId, success) {
    const updates = {
      last_triggered_at: new Date(),
      last_status: success ? 'success' : 'failed',
    };

    if (success) {
      updates.success_count = db.raw('success_count + 1');
    } else {
      updates.failure_count = db.raw('failure_count + 1');
    }

    await db('ticket_webhooks').where('id', webhookId).update(updates);
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a webhook
   */
  async createWebhook(workspaceId, data) {
    const id = uuidv4();

    await db('ticket_webhooks').insert({
      id,
      workspace_id: workspaceId,
      name: data.name,
      url: data.url,
      secret: data.secret || crypto.randomBytes(32).toString('hex'),
      events: JSON.stringify(data.events || []),
      headers: JSON.stringify(data.headers || {}),
      is_active: data.is_active !== false,
      retry_count: data.retry_count || 3,
      timeout_ms: data.timeout_ms || 30000,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return this.getWebhookById(id);
  }

  /**
   * Update a webhook
   */
  async updateWebhook(webhookId, data) {
    const updates = { updated_at: new Date() };

    if (data.name !== undefined) updates.name = data.name;
    if (data.url !== undefined) updates.url = data.url;
    if (data.secret !== undefined) updates.secret = data.secret;
    if (data.events !== undefined) updates.events = JSON.stringify(data.events);
    if (data.headers !== undefined) updates.headers = JSON.stringify(data.headers);
    if (data.is_active !== undefined) updates.is_active = data.is_active;
    if (data.retry_count !== undefined) updates.retry_count = data.retry_count;
    if (data.timeout_ms !== undefined) updates.timeout_ms = data.timeout_ms;

    await db('ticket_webhooks').where('id', webhookId).update(updates);
    return this.getWebhookById(webhookId);
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId) {
    const deleted = await db('ticket_webhooks').where('id', webhookId).delete();
    return deleted > 0;
  }

  /**
   * Get webhook by ID
   */
  async getWebhookById(webhookId) {
    const webhook = await db('ticket_webhooks').where('id', webhookId).first();
    if (webhook) {
      webhook.events = typeof webhook.events === 'string'
        ? JSON.parse(webhook.events)
        : webhook.events;
      webhook.headers = typeof webhook.headers === 'string'
        ? JSON.parse(webhook.headers)
        : webhook.headers;
    }
    return webhook;
  }

  /**
   * Get all webhooks for a workspace
   */
  async getWebhooks(workspaceId) {
    const webhooks = await db('ticket_webhooks')
      .where('workspace_id', workspaceId)
      .orderBy('created_at', 'desc');

    return webhooks.map(w => ({
      ...w,
      events: typeof w.events === 'string' ? JSON.parse(w.events) : w.events,
      headers: typeof w.headers === 'string' ? JSON.parse(w.headers) : w.headers,
    }));
  }

  /**
   * Get delivery logs for a webhook
   */
  async getDeliveryLogs(webhookId, options = {}) {
    const { page = 1, limit = 50, status } = options;
    const offset = (page - 1) * limit;

    let query = db('webhook_delivery_logs')
      .where('webhook_id', webhookId)
      .orderBy('delivered_at', 'desc')
      .offset(offset)
      .limit(limit);

    if (status) {
      query = query.where('status', status);
    }

    const [logs, countResult] = await Promise.all([
      query,
      db('webhook_delivery_logs').where('webhook_id', webhookId).count('id as count').first(),
    ]);

    return {
      logs: logs.map(log => ({
        ...log,
        payload: typeof log.payload === 'string' ? JSON.parse(log.payload) : log.payload,
      })),
      total: parseInt(countResult?.count || 0),
      page,
      limit,
    };
  }

  /**
   * Test a webhook
   */
  async testWebhook(webhookId) {
    const webhook = await this.getWebhookById(webhookId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const testData = {
      ticket: {
        id: 'test-' + uuidv4().substring(0, 8),
        subject: 'Test Ticket',
        status: 'open',
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      actor: {
        id: 'system',
        name: 'System',
        type: 'system',
      },
      metadata: {
        test: true,
      },
    };

    return this.sendWebhook(webhook, 'test.webhook', testData);
  }

  /**
   * Regenerate webhook secret
   */
  async regenerateSecret(webhookId) {
    const newSecret = crypto.randomBytes(32).toString('hex');

    await db('ticket_webhooks')
      .where('id', webhookId)
      .update({
        secret: newSecret,
        updated_at: new Date(),
      });

    return { secret: newSecret };
  }

  /**
   * Get available webhook events
   */
  getAvailableEvents() {
    return WEBHOOK_EVENTS;
  }

  /**
   * Verify webhook signature (for incoming webhooks)
   */
  verifySignature(payload, signature, secret) {
    if (!signature || !secret) {
      return false;
    }

    const expected = this.generateSignature(
      typeof payload === 'string' ? JSON.parse(payload) : payload,
      secret
    );

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  }
}

module.exports = new TicketWebhookService();
