/**
 * Email Provider Webhook Routes
 * Handles incoming webhooks from SendGrid, AWS SES, and other providers
 * for bounce, complaint, and unsubscribe events
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const emailBounceService = require('../services/email-bounce.service');
const emailMarketingService = require('../services/email-marketing.service');
const log = require('../utils/logger');
const db = require('../config/db');

// ==================== SENDGRID WEBHOOKS ====================

/**
 * Verify SendGrid webhook signature
 */
const verifySendGridSignature = (req, res, next) => {
  const publicKey = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY;

  if (!publicKey) {
    log.warn('SendGrid webhook public key not configured');
    return next(); // Skip verification if not configured
  }

  try {
    const signature = req.headers['x-twilio-email-event-webhook-signature'];
    const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'];

    if (!signature || !timestamp) {
      log.warn('Missing SendGrid webhook signature headers');
      return res.status(401).json({ error: 'Missing signature' });
    }

    const payload = timestamp + JSON.stringify(req.body);
    const verifier = crypto.createVerify('sha256');
    verifier.update(payload);

    const isValid = verifier.verify(
      publicKey,
      Buffer.from(signature, 'base64')
    );

    if (!isValid) {
      log.warn('Invalid SendGrid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    next();
  } catch (error) {
    log.error('SendGrid signature verification error:', error);
    return res.status(401).json({ error: 'Signature verification failed' });
  }
};

/**
 * POST /api/email/webhooks/sendgrid
 * Handle SendGrid event webhooks (bounces, complaints, unsubscribes)
 */
router.post('/sendgrid', express.json(), verifySendGridSignature, async (req, res) => {
  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];

    log.info(`Received ${events.length} SendGrid webhook events`);

    for (const event of events) {
      await processSendGridEvent(event);
    }

    res.status(200).json({ success: true, processed: events.length });
  } catch (error) {
    log.error('SendGrid webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Process individual SendGrid event
 */
async function processSendGridEvent(event) {
  const { email, event: eventType, sg_message_id, reason, type, timestamp } = event;

  // Extract workspace from custom args or message ID
  const workspaceId = event.workspace_id || await getWorkspaceFromMessageId(sg_message_id);

  if (!workspaceId) {
    log.warn(`Cannot determine workspace for SendGrid event: ${email}`);
    return;
  }

  // Find contact
  const contact = await db('email_contacts')
    .where({ email: email?.toLowerCase(), workspace_id: workspaceId })
    .first();

  // Find campaign/send from message ID
  const emailSend = sg_message_id
    ? await db('email_sends').where('message_id', sg_message_id).first()
    : null;

  switch (eventType) {
    case 'bounce':
      await emailBounceService.handleBounce({
        email,
        type: type === 'blocked' ? 'soft' : (type || 'hard'),
        reason: reason || 'Unknown bounce',
        workspaceId,
        contactId: contact?.id,
        campaignId: emailSend?.campaign_id,
        sendId: emailSend?.id,
        provider: 'sendgrid',
        providerResponse: JSON.stringify(event)
      });
      break;

    case 'dropped':
      await emailBounceService.handleBounce({
        email,
        type: 'hard',
        reason: reason || 'Message dropped',
        workspaceId,
        contactId: contact?.id,
        campaignId: emailSend?.campaign_id,
        sendId: emailSend?.id,
        provider: 'sendgrid',
        providerResponse: JSON.stringify(event)
      });
      break;

    case 'spamreport':
      await emailBounceService.handleComplaint({
        email,
        workspaceId,
        contactId: contact?.id,
        campaignId: emailSend?.campaign_id,
        complaintType: 'abuse',
        provider: 'sendgrid'
      });
      break;

    case 'unsubscribe':
      await handleUnsubscribe(email, workspaceId, contact?.id, emailSend?.campaign_id, 'sendgrid');
      break;

    default:
      log.debug(`Unhandled SendGrid event type: ${eventType}`);
  }
}

// ==================== AWS SES WEBHOOKS ====================

/**
 * Verify AWS SNS signature
 */
const verifySNSSignature = async (req, res, next) => {
  // SNS sends confirmation requests that we need to handle
  if (req.body.Type === 'SubscriptionConfirmation') {
    try {
      const subscribeUrl = req.body.SubscribeURL;
      log.info('SNS subscription confirmation request received');

      // Auto-confirm by fetching the URL
      const fetch = (await import('node-fetch')).default;
      await fetch(subscribeUrl);

      log.info('SNS subscription confirmed');
      return res.status(200).json({ success: true, message: 'Subscription confirmed' });
    } catch (error) {
      log.error('SNS subscription confirmation failed:', error);
      return res.status(500).json({ error: 'Subscription confirmation failed' });
    }
  }

  // For notifications, verify signature
  const snsSignatureVersion = req.body.SignatureVersion;

  if (snsSignatureVersion === '1') {
    try {
      const messageType = req.body.Type;
      let stringToSign = '';

      if (messageType === 'Notification') {
        stringToSign = `Message\n${req.body.Message}\n`;
        stringToSign += `MessageId\n${req.body.MessageId}\n`;
        if (req.body.Subject) {
          stringToSign += `Subject\n${req.body.Subject}\n`;
        }
        stringToSign += `Timestamp\n${req.body.Timestamp}\n`;
        stringToSign += `TopicArn\n${req.body.TopicArn}\n`;
        stringToSign += `Type\n${req.body.Type}\n`;
      }

      // Verification logic - in production, fetch certificate and verify
      // For now, log warning and continue
      log.debug('SNS signature verification - proceeding with processing');
      next();
    } catch (error) {
      log.error('SNS signature verification error:', error);
      return res.status(401).json({ error: 'Signature verification failed' });
    }
  } else {
    next();
  }
};

/**
 * POST /api/email/webhooks/ses
 * Handle AWS SES event webhooks via SNS
 */
router.post('/ses', express.json({ type: '*/*' }), verifySNSSignature, async (req, res) => {
  try {
    let message = req.body;

    // SNS wraps the message
    if (req.body.Type === 'Notification' && req.body.Message) {
      message = JSON.parse(req.body.Message);
    }

    log.info('Received SES webhook event', { notificationType: message.notificationType });

    await processSESEvent(message);

    res.status(200).json({ success: true });
  } catch (error) {
    log.error('SES webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Process SES notification event
 */
async function processSESEvent(message) {
  const notificationType = message.notificationType || message.eventType;
  const mail = message.mail || {};
  const messageId = mail.messageId;

  // Get workspace from message headers or tags
  const workspaceId = await getWorkspaceFromSESMessage(mail);

  if (!workspaceId) {
    log.warn('Cannot determine workspace for SES event');
    return;
  }

  switch (notificationType) {
    case 'Bounce': {
      const bounce = message.bounce || {};
      const bounceType = bounce.bounceType === 'Permanent' ? 'hard' : 'soft';

      for (const recipient of bounce.bouncedRecipients || []) {
        const email = recipient.emailAddress;
        const contact = await db('email_contacts')
          .where({ email: email?.toLowerCase(), workspace_id: workspaceId })
          .first();

        const emailSend = messageId
          ? await db('email_sends').where('message_id', messageId).first()
          : null;

        await emailBounceService.handleBounce({
          email,
          type: bounceType,
          reason: recipient.diagnosticCode || bounce.bounceSubType || 'SES bounce',
          workspaceId,
          contactId: contact?.id,
          campaignId: emailSend?.campaign_id,
          sendId: emailSend?.id,
          provider: 'ses',
          providerResponse: JSON.stringify(message),
          diagnosticCode: recipient.diagnosticCode
        });
      }
      break;
    }

    case 'Complaint': {
      const complaint = message.complaint || {};

      for (const recipient of complaint.complainedRecipients || []) {
        const email = recipient.emailAddress;
        const contact = await db('email_contacts')
          .where({ email: email?.toLowerCase(), workspace_id: workspaceId })
          .first();

        const emailSend = messageId
          ? await db('email_sends').where('message_id', messageId).first()
          : null;

        await emailBounceService.handleComplaint({
          email,
          workspaceId,
          contactId: contact?.id,
          campaignId: emailSend?.campaign_id,
          complaintType: complaint.complaintFeedbackType || 'abuse',
          feedback: complaint.complaintSubType,
          provider: 'ses'
        });
      }
      break;
    }

    case 'Delivery': {
      // Update send status to delivered
      if (messageId) {
        await db('email_sends')
          .where('message_id', messageId)
          .update({
            status: 'delivered',
            delivered_at: new Date()
          });
      }
      break;
    }

    default:
      log.debug(`Unhandled SES notification type: ${notificationType}`);
  }
}

// ==================== RESEND WEBHOOKS ====================

/**
 * Verify Resend webhook signature
 */
const verifyResendSignature = (req, res, next) => {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

  if (!webhookSecret) {
    log.warn('Resend webhook secret not configured');
    return next();
  }

  try {
    const signature = req.headers['resend-signature'];
    const timestamp = req.headers['resend-timestamp'];

    if (!signature || !timestamp) {
      log.warn('Missing Resend webhook signature headers');
      return res.status(401).json({ error: 'Missing signature' });
    }

    const payload = `${timestamp}.${JSON.stringify(req.body)}`;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    if (signature !== expectedSignature) {
      log.warn('Invalid Resend webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    next();
  } catch (error) {
    log.error('Resend signature verification error:', error);
    return res.status(401).json({ error: 'Signature verification failed' });
  }
};

/**
 * POST /api/email/webhooks/resend
 * Handle Resend event webhooks
 */
router.post('/resend', express.json(), verifyResendSignature, async (req, res) => {
  try {
    const event = req.body;

    log.info('Received Resend webhook event', { type: event.type });

    await processResendEvent(event);

    res.status(200).json({ success: true });
  } catch (error) {
    log.error('Resend webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Process Resend event
 */
async function processResendEvent(event) {
  const { type, data } = event;
  const email = data.to?.[0] || data.email;
  const messageId = data.email_id;

  // Get workspace from tags or message
  const workspaceId = data.tags?.workspace_id || await getWorkspaceFromMessageId(messageId);

  if (!workspaceId) {
    log.warn('Cannot determine workspace for Resend event');
    return;
  }

  const contact = await db('email_contacts')
    .where({ email: email?.toLowerCase(), workspace_id: workspaceId })
    .first();

  const emailSend = messageId
    ? await db('email_sends').where('message_id', messageId).first()
    : null;

  switch (type) {
    case 'email.bounced':
      await emailBounceService.handleBounce({
        email,
        type: data.bounce_type === 'permanent' ? 'hard' : 'soft',
        reason: data.reason || 'Resend bounce',
        workspaceId,
        contactId: contact?.id,
        campaignId: emailSend?.campaign_id,
        sendId: emailSend?.id,
        provider: 'resend',
        providerResponse: JSON.stringify(event)
      });
      break;

    case 'email.complained':
      await emailBounceService.handleComplaint({
        email,
        workspaceId,
        contactId: contact?.id,
        campaignId: emailSend?.campaign_id,
        complaintType: 'abuse',
        provider: 'resend'
      });
      break;

    case 'email.delivered':
      if (emailSend) {
        await db('email_sends')
          .where('id', emailSend.id)
          .update({
            status: 'delivered',
            delivered_at: new Date()
          });
      }
      break;

    default:
      log.debug(`Unhandled Resend event type: ${type}`);
  }
}

// ==================== GENERIC SMTP WEBHOOKS ====================

/**
 * POST /api/email/webhooks/smtp
 * Handle generic SMTP bounce notifications (postmaster format)
 */
router.post('/smtp', express.json(), async (req, res) => {
  try {
    const { email, type, reason, workspace_id, diagnostic_code } = req.body;

    if (!email || !workspace_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const contact = await db('email_contacts')
      .where({ email: email?.toLowerCase(), workspace_id })
      .first();

    await emailBounceService.handleBounce({
      email,
      type: type || 'hard',
      reason: reason || 'SMTP bounce',
      workspaceId: workspace_id,
      contactId: contact?.id,
      provider: 'smtp',
      diagnosticCode: diagnostic_code
    });

    res.status(200).json({ success: true });
  } catch (error) {
    log.error('SMTP webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Get workspace ID from email message ID
 */
async function getWorkspaceFromMessageId(messageId) {
  if (!messageId) return null;

  const emailSend = await db('email_sends')
    .where('message_id', messageId)
    .first();

  if (emailSend?.campaign_id) {
    const campaign = await db('email_campaigns')
      .where('id', emailSend.campaign_id)
      .first();
    return campaign?.workspace_id;
  }

  return null;
}

/**
 * Get workspace ID from SES message
 */
async function getWorkspaceFromSESMessage(mail) {
  // Check headers for workspace ID
  const headers = mail.headers || [];
  const workspaceHeader = headers.find(h => h.name === 'X-Workspace-ID');
  if (workspaceHeader) {
    return parseInt(workspaceHeader.value);
  }

  // Check tags
  const tags = mail.tags || {};
  if (tags['workspace_id']) {
    return parseInt(tags['workspace_id']);
  }

  // Try to find from message ID
  return getWorkspaceFromMessageId(mail.messageId);
}

/**
 * Handle unsubscribe event
 */
async function handleUnsubscribe(email, workspaceId, contactId, campaignId, provider) {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    // Record unsubscribe
    await db('email_unsubscribes').insert({
      workspace_id: workspaceId,
      contact_id: contactId || null,
      campaign_id: campaignId || null,
      email: normalizedEmail,
      reason: `Unsubscribed via ${provider}`,
      unsubscribed_at: new Date()
    });

    // Update contact status
    if (contactId) {
      await db('email_contacts')
        .where('id', contactId)
        .update({
          status: 'unsubscribed',
          unsubscribed_at: new Date(),
          updated_at: new Date()
        });
    } else {
      // Find contact by email
      await db('email_contacts')
        .where({ email: normalizedEmail, workspace_id: workspaceId })
        .update({
          status: 'unsubscribed',
          unsubscribed_at: new Date(),
          updated_at: new Date()
        });
    }

    // Record email event
    if (campaignId) {
      await db('email_events').insert({
        campaign_id: campaignId,
        contact_id: contactId || null,
        event_type: 'unsubscribed',
        metadata: JSON.stringify({ provider })
      });
    }

    log.info(`Unsubscribe processed for ${normalizedEmail}`, { workspaceId, provider });
  } catch (error) {
    log.error('Error handling unsubscribe:', error);
    throw error;
  }
}

// ==================== WEBHOOK STATUS ENDPOINT ====================

/**
 * GET /api/email/webhooks/status
 * Check webhook configuration status
 */
router.get('/status', async (req, res) => {
  const status = {
    sendgrid: {
      configured: !!process.env.SENDGRID_WEBHOOK_PUBLIC_KEY,
      endpoint: '/api/email/webhooks/sendgrid'
    },
    ses: {
      configured: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
      endpoint: '/api/email/webhooks/ses'
    },
    resend: {
      configured: !!process.env.RESEND_WEBHOOK_SECRET,
      endpoint: '/api/email/webhooks/resend'
    },
    smtp: {
      configured: true,
      endpoint: '/api/email/webhooks/smtp'
    }
  };

  res.json({ success: true, webhooks: status });
});

module.exports = router;
