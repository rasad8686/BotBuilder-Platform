/**
 * Email Marketing Public Routes
 * Handles unsubscribe, tracking, webhooks, and public subscribe endpoints
 * These routes do not require authentication
 */

const express = require('express');
const router = express.Router();
const emailMarketingService = require('../services/email-marketing.service');
const db = require('../config/db');
const log = require('../utils/logger');
const crypto = require('crypto');

// ==================== UNSUBSCRIBE ====================

/**
 * GET /api/public/email/unsubscribe/:token
 * Display unsubscribe page
 */
router.get('/unsubscribe/:token', async (req, res) => {
  try {
    const data = emailMarketingService.verifyUnsubscribeToken(req.params.token);
    const contact = await db('email_contacts').where('id', data.contactId).first();

    if (!contact) {
      return res.status(404).send(getUnsubscribeHtml({
        error: true,
        message: 'Contact not found'
      }));
    }

    if (contact.status === 'unsubscribed') {
      return res.send(getUnsubscribeHtml({
        alreadyUnsubscribed: true,
        email: contact.email
      }));
    }

    res.send(getUnsubscribeHtml({
      email: contact.email,
      token: req.params.token
    }));
  } catch (error) {
    log.error('Unsubscribe page error', { error: error.message });
    res.status(400).send(getUnsubscribeHtml({
      error: true,
      message: error.message
    }));
  }
});

/**
 * POST /api/public/email/unsubscribe/:token
 * Process unsubscribe request
 */
router.post('/unsubscribe/:token', async (req, res) => {
  try {
    const data = emailMarketingService.verifyUnsubscribeToken(req.params.token);
    const { reason, feedback } = req.body;

    await emailMarketingService.unsubscribeContact(
      data.contactId,
      data.campaignId,
      reason,
      feedback
    );

    const contact = await db('email_contacts').where('id', data.contactId).first();

    res.send(getUnsubscribeHtml({
      success: true,
      email: contact?.email
    }));
  } catch (error) {
    log.error('Unsubscribe error', { error: error.message });
    res.status(400).send(getUnsubscribeHtml({
      error: true,
      message: error.message
    }));
  }
});

// ==================== TRACKING ====================

/**
 * GET /api/public/email/open/:sendId
 * Track email open (1x1 pixel)
 */
router.get('/open/:sendId', async (req, res) => {
  try {
    const send = await db('email_sends').where('id', req.params.sendId).first();

    if (send) {
      // Record open event
      await db('email_events').insert({
        id: crypto.randomUUID(),
        campaign_id: send.campaign_id,
        contact_id: send.contact_id,
        send_id: send.id,
        event_type: 'opened',
        user_agent: req.headers['user-agent'],
        ip_address: req.ip || req.connection.remoteAddress,
        metadata: {}
      });

      // Update contact last activity
      if (send.contact_id) {
        await db('email_contacts')
          .where('id', send.contact_id)
          .update({ last_activity_at: new Date() });
      }
    }
  } catch (error) {
    log.error('Track open error', { error: error.message, sendId: req.params.sendId });
  }

  // Return 1x1 transparent GIF
  const pixel = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
  );

  res.set({
    'Content-Type': 'image/gif',
    'Content-Length': pixel.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0'
  });

  res.send(pixel);
});

/**
 * GET /api/public/email/click/:sendId
 * Track link click and redirect
 */
router.get('/click/:sendId', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).send('Missing URL parameter');
    }

    const send = await db('email_sends').where('id', req.params.sendId).first();

    if (send) {
      // Record click event
      await db('email_events').insert({
        id: crypto.randomUUID(),
        campaign_id: send.campaign_id,
        contact_id: send.contact_id,
        send_id: send.id,
        event_type: 'clicked',
        link_url: url,
        user_agent: req.headers['user-agent'],
        ip_address: req.ip || req.connection.remoteAddress,
        metadata: {}
      });

      // Update contact last activity
      if (send.contact_id) {
        await db('email_contacts')
          .where('id', send.contact_id)
          .update({ last_activity_at: new Date() });
      }
    }

    // Redirect to original URL
    res.redirect(302, url);
  } catch (error) {
    log.error('Track click error', { error: error.message, sendId: req.params.sendId });
    res.redirect(302, req.query.url || '/');
  }
});

// ==================== ESP WEBHOOKS ====================

/**
 * POST /api/public/email/webhook/sendgrid
 * Handle SendGrid webhooks
 */
router.post('/webhook/sendgrid', express.json(), async (req, res) => {
  try {
    const events = req.body;

    if (!Array.isArray(events)) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    for (const event of events) {
      const sendId = event.send_id || extractSendIdFromHeaders(event);

      if (!sendId) continue;

      const eventType = mapSendGridEvent(event.event);
      if (!eventType) continue;

      await emailMarketingService.handleWebhook({
        type: eventType,
        sendId,
        data: {
          bounceType: event.type === 'bounce' ? (event.bounce_classification === 'Permanent' ? 'hard' : 'soft') : undefined,
          reason: event.reason || event.response
        }
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    log.error('SendGrid webhook error', { error: error.message });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * POST /api/public/email/webhook/ses
 * Handle AWS SES webhooks (SNS notifications)
 */
router.post('/webhook/ses', express.json({ type: '*/*' }), async (req, res) => {
  try {
    const message = req.body;

    // Handle SNS subscription confirmation
    if (message.Type === 'SubscriptionConfirmation') {
      // Auto-confirm subscription
      const response = await fetch(message.SubscribeURL);
      if (response.ok) {
        log.info('SES webhook subscription confirmed');
      }
      return res.status(200).send('OK');
    }

    // Handle notification
    if (message.Type === 'Notification') {
      const notification = JSON.parse(message.Message);
      const notificationType = notification.notificationType || notification.eventType;

      const sendId = extractSendIdFromSESHeaders(notification);
      if (!sendId) {
        return res.status(200).send('OK');
      }

      let eventType = null;
      let data = {};

      switch (notificationType) {
        case 'Delivery':
          eventType = 'delivered';
          break;
        case 'Bounce':
          eventType = 'bounced';
          data = {
            bounceType: notification.bounce?.bounceType === 'Permanent' ? 'hard' : 'soft',
            reason: notification.bounce?.bouncedRecipients?.[0]?.diagnosticCode
          };
          break;
        case 'Complaint':
          eventType = 'complained';
          break;
      }

      if (eventType) {
        await emailMarketingService.handleWebhook({
          type: eventType,
          sendId,
          data
        });
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    log.error('SES webhook error', { error: error.message });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * POST /api/public/email/webhook/resend
 * Handle Resend webhooks
 */
router.post('/webhook/resend', express.json(), async (req, res) => {
  try {
    const event = req.body;

    // Verify webhook signature if configured
    const signature = req.headers['resend-signature'];
    if (process.env.RESEND_WEBHOOK_SECRET && signature) {
      const isValid = verifyResendSignature(req.body, signature);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const sendId = event.data?.tags?.send_id || extractSendIdFromResendHeaders(event);
    if (!sendId) {
      return res.status(200).json({ success: true });
    }

    let eventType = null;
    let data = {};

    switch (event.type) {
      case 'email.delivered':
        eventType = 'delivered';
        break;
      case 'email.bounced':
        eventType = 'bounced';
        data = {
          bounceType: event.data?.bounce_type === 'hard' ? 'hard' : 'soft',
          reason: event.data?.error?.message
        };
        break;
      case 'email.complained':
        eventType = 'complained';
        break;
    }

    if (eventType) {
      await emailMarketingService.handleWebhook({
        type: eventType,
        sendId,
        data
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    log.error('Resend webhook error', { error: error.message });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ==================== PUBLIC SUBSCRIBE ====================

/**
 * POST /api/public/email/subscribe
 * Public subscribe endpoint for forms
 */
router.post('/subscribe', express.json(), async (req, res) => {
  try {
    const { email, first_name, last_name, workspace_id, list_id, tags, source } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    if (!workspace_id) {
      return res.status(400).json({
        success: false,
        message: 'Workspace ID is required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Check if contact exists
    let contact = await emailMarketingService.getContactByEmail(email, workspace_id);

    if (contact) {
      // Update existing contact if unsubscribed
      if (contact.status === 'unsubscribed') {
        contact = await emailMarketingService.updateContact(contact.id, workspace_id, {
          status: 'subscribed',
          subscribed_at: new Date(),
          first_name: first_name || contact.first_name,
          last_name: last_name || contact.last_name
        });
      }
    } else {
      // Create new contact
      contact = await emailMarketingService.createContact(workspace_id, {
        email,
        first_name,
        last_name,
        source: source || 'form',
        tags: tags || [],
        status: 'subscribed'
      });
    }

    // Add to list if specified
    if (list_id) {
      await emailMarketingService.addContactsToList(list_id, [contact.id]);
    }

    // Check if double opt-in is enabled
    const settings = await emailMarketingService.getSettings(workspace_id);
    if (settings.double_opt_in) {
      // TODO: Send confirmation email
    }

    res.status(201).json({
      success: true,
      message: 'Successfully subscribed'
    });
  } catch (error) {
    log.error('Public subscribe error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to subscribe'
    });
  }
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Map SendGrid event types to our event types
 */
function mapSendGridEvent(event) {
  const mapping = {
    'delivered': 'delivered',
    'bounce': 'bounced',
    'spamreport': 'complained',
    'dropped': 'failed'
  };
  return mapping[event];
}

/**
 * Extract send ID from SendGrid headers
 */
function extractSendIdFromHeaders(event) {
  if (event['X-Send-ID']) {
    return event['X-Send-ID'];
  }
  // Try to extract from custom args
  if (event.marketing_campaign_id) {
    return event.marketing_campaign_id;
  }
  return null;
}

/**
 * Extract send ID from SES headers
 */
function extractSendIdFromSESHeaders(notification) {
  const headers = notification.mail?.headers || [];
  const sendIdHeader = headers.find(h => h.name === 'X-Send-ID');
  return sendIdHeader?.value;
}

/**
 * Extract send ID from Resend headers/tags
 */
function extractSendIdFromResendHeaders(event) {
  return event.data?.headers?.['X-Send-ID'];
}

/**
 * Verify Resend webhook signature
 */
function verifyResendSignature(payload, signature) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return true;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Generate unsubscribe HTML page
 */
function getUnsubscribeHtml(options = {}) {
  const { email, token, success, alreadyUnsubscribed, error, message } = options;

  let content = '';

  if (error) {
    content = `
      <div class="error">
        <h2>Error</h2>
        <p>${message || 'An error occurred. Please try again later.'}</p>
      </div>
    `;
  } else if (success) {
    content = `
      <div class="success">
        <h2>Unsubscribed Successfully</h2>
        <p>You have been unsubscribed from our mailing list.</p>
        <p>Email: <strong>${email}</strong></p>
        <p>We're sorry to see you go. If you change your mind, you can always re-subscribe.</p>
      </div>
    `;
  } else if (alreadyUnsubscribed) {
    content = `
      <div class="info">
        <h2>Already Unsubscribed</h2>
        <p>This email address is already unsubscribed.</p>
        <p>Email: <strong>${email}</strong></p>
      </div>
    `;
  } else {
    content = `
      <form method="POST" action="/api/public/email/unsubscribe/${token}">
        <h2>Unsubscribe</h2>
        <p>Are you sure you want to unsubscribe <strong>${email}</strong> from our mailing list?</p>

        <div class="form-group">
          <label>Reason for unsubscribing (optional):</label>
          <select name="reason">
            <option value="">Select a reason...</option>
            <option value="too_many">Too many emails</option>
            <option value="not_relevant">Content not relevant</option>
            <option value="never_signed_up">I never signed up</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div class="form-group">
          <label>Additional feedback (optional):</label>
          <textarea name="feedback" rows="3" placeholder="Help us improve..."></textarea>
        </div>

        <button type="submit" class="btn-primary">Unsubscribe</button>
      </form>
    `;
  }

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Unsubscribe</title>
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          background-color: #0a0a0f;
          color: #e5e7eb;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          max-width: 500px;
          width: 100%;
          background-color: #12121a;
          border-radius: 16px;
          padding: 40px;
          border: 1px solid #2d2d3a;
        }
        h2 {
          font-size: 24px;
          margin-bottom: 16px;
          color: #ffffff;
        }
        p {
          margin-bottom: 16px;
          line-height: 1.6;
          color: #9ca3af;
        }
        .form-group {
          margin-bottom: 20px;
        }
        label {
          display: block;
          margin-bottom: 8px;
          font-size: 14px;
          color: #9ca3af;
        }
        select, textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid #2d2d3a;
          border-radius: 8px;
          background-color: #1a1a2e;
          color: #e5e7eb;
          font-size: 14px;
        }
        select:focus, textarea:focus {
          outline: none;
          border-color: #8b5cf6;
        }
        .btn-primary {
          width: 100%;
          padding: 14px 24px;
          background-color: #dc2626;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .btn-primary:hover {
          background-color: #b91c1c;
        }
        .success {
          text-align: center;
        }
        .success h2 {
          color: #22c55e;
        }
        .info h2 {
          color: #f59e0b;
        }
        .error h2 {
          color: #ef4444;
        }
      </style>
    </head>
    <body>
      <div class="container">
        ${content}
      </div>
    </body>
    </html>
  `;
}

module.exports = router;
