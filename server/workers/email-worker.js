/**
 * Email Worker Process
 * Background job processor for email sending
 *
 * Run: node server/workers/email-worker.js
 * Or use PM2: pm2 start server/workers/email-worker.js --name email-worker
 *
 * NOTE: Requires Redis to be available. If Redis is not configured,
 * email processing falls back to immediate in-memory processing.
 */

require('dotenv').config();

const { emailQueue, campaignQueue, scheduledQueue, isRedisAvailable } = require('../queues/emailQueue');
const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// Check if Redis/queues are available
if (!isRedisAvailable()) {
  console.log('[EmailWorker] Redis not available - worker not needed (using in-memory fallback)');
  console.log('[EmailWorker] Email processing will be handled synchronously by the main server');
  process.exit(0);
}

// WebSocket progress sender (optional - only if socket.io-emitter is available)
let emitProgress = () => {}; // Default no-op

// Only try Redis emitter if Redis is configured
if (process.env.REDIS_HOST || process.env.REDIS_URL) {
  try {
    const Redis = require('ioredis');
    const { Emitter } = require('@socket.io/redis-emitter');

    const redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null // Don't retry
    });

    redisClient.on('error', () => {}); // Silent error handler

    const emitter = new Emitter(redisClient);

    emitProgress = (room, event, data) => {
      try {
        emitter.to(room).emit(event, data);
      } catch (e) {
        // Silently ignore emit errors
      }
    };

    console.log('[EmailWorker] WebSocket emitter initialized');
  } catch (error) {
    console.log('[EmailWorker] WebSocket emitter not available, progress will be database-only');
  }
}

// Worker ID for tracking
const WORKER_ID = `worker-${process.pid}-${Date.now()}`;

// Rate limits per provider (emails per second)
const RATE_LIMITS = {
  sendgrid: { perSecond: 10, perMinute: 600 },
  ses: { perSecond: 14, perMinute: 840 },
  resend: { perSecond: 10, perMinute: 600 },
  smtp: { perSecond: 5, perMinute: 300 }
};

// Track send rates
const sendRateTracker = {
  count: 0,
  windowStart: Date.now()
};

console.log(`Email Worker started: ${WORKER_ID}`);

/**
 * Process individual email send job
 */
emailQueue.process('send-email', 10, async (job) => {
  const { sendId, campaignId, contactId, email } = job.data;
  const startTime = Date.now();

  try {
    // Update job progress
    await job.progress(10);

    // Get send record
    const emailSend = await db('email_sends').where({ id: sendId }).first();
    if (!emailSend) {
      throw new Error('Email send record not found');
    }

    // Skip if already sent
    if (emailSend.status === 'sent' || emailSend.status === 'delivered') {
      return { skipped: true, reason: 'Already sent' };
    }

    // Update status to processing
    await db('email_sends').where({ id: sendId }).update({
      status: 'processing',
      processing_started_at: new Date(),
      worker_id: WORKER_ID,
      attempts: db.raw('attempts + 1')
    });

    await job.progress(20);

    // Get campaign
    const campaign = await db('email_campaigns').where({ id: campaignId }).first();
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Check if campaign is still active
    if (campaign.status !== 'sending') {
      await db('email_sends').where({ id: sendId }).update({ status: 'queued' });
      return { skipped: true, reason: 'Campaign not active' };
    }

    await job.progress(30);

    // Get contact
    const contact = await db('email_contacts').where({ id: contactId }).first();
    if (!contact) {
      await markFailed(sendId, 'Contact not found');
      throw new Error('Contact not found');
    }

    // Check contact is still subscribed
    if (contact.status !== 'subscribed') {
      await markFailed(sendId, 'Contact unsubscribed');
      return { skipped: true, reason: 'Contact unsubscribed' };
    }

    await job.progress(40);

    // Get workspace email settings
    const settings = await db('email_settings')
      .where({ workspace_id: campaign.workspace_id })
      .first();

    // Rate limiting check
    await enforceRateLimit(settings?.provider || 'smtp');

    await job.progress(50);

    // Personalize content
    const html = personalize(campaign.content_html, contact);
    const subject = personalize(campaign.subject, contact);

    // Add tracking
    const trackedHtml = addTracking(html, sendId, campaign.settings);

    await job.progress(60);

    // Send email via provider
    const result = await sendViaProvider(settings, {
      to: contact.email,
      from: `${campaign.from_name} <${campaign.from_email}>`,
      replyTo: campaign.reply_to || campaign.from_email,
      subject: subject,
      html: trackedHtml
    });

    await job.progress(80);

    // Update send record - success
    await db('email_sends').where({ id: sendId }).update({
      status: 'sent',
      sent_at: new Date(),
      message_id: result.messageId,
      worker_id: WORKER_ID
    });

    // Update campaign sent count
    await db('email_campaigns')
      .where({ id: campaignId })
      .increment('sent_count', 1);

    // Log success
    await logQueueEvent(campaignId, sendId, 'sent', {
      messageId: result.messageId,
      duration: Date.now() - startTime
    });

    // Update stats
    await updateQueueStats(campaignId, {
      total_sent: 1,
      avg_send_time_ms: Date.now() - startTime
    });

    await job.progress(100);

    // Emit real-time progress
    emitProgress(`campaign:${campaignId}`, 'email:send_status', {
      campaignId,
      sendId,
      email,
      status: 'sent',
      messageId: result.messageId,
      timestamp: new Date()
    });

    return {
      success: true,
      messageId: result.messageId,
      duration: Date.now() - startTime
    };

  } catch (error) {
    console.error(`Error sending email ${sendId}:`, error);

    // Update send record - failed
    const emailSend = await db('email_sends').where({ id: sendId }).first();
    const attempts = (emailSend?.attempts || 0);
    const maxAttempts = emailSend?.max_attempts || 3;

    if (attempts >= maxAttempts) {
      await markFailed(sendId, error.message);
      await logQueueEvent(campaignId, sendId, 'failed', {
        error: error.message,
        attempts
      });
      await updateQueueStats(campaignId, { total_failed: 1 });
    } else {
      // Schedule retry
      const nextRetry = new Date(Date.now() + Math.pow(2, attempts) * 5000);
      await db('email_sends').where({ id: sendId }).update({
        status: 'queued',
        next_retry_at: nextRetry
      });
      await logQueueEvent(campaignId, sendId, 'retried', {
        error: error.message,
        nextRetry,
        attempts
      });
      await updateQueueStats(campaignId, { total_retried: 1 });
    }

    throw error;
  }
});

/**
 * Process campaign job - queues all emails for a campaign
 */
campaignQueue.process('process-campaign', async (job) => {
  const { campaignId, batchSize, delayBetweenBatches } = job.data;

  console.log(`Processing campaign ${campaignId}`);

  try {
    // Get campaign
    const campaign = await db('email_campaigns').where({ id: campaignId }).first();
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Get all queued emails
    const totalEmails = await db('email_sends')
      .where({ campaign_id: campaignId, status: 'queued' })
      .count('* as count')
      .first();

    const total = parseInt(totalEmails.count);
    let processed = 0;

    // Process in batches
    while (processed < total) {
      // Check if campaign is still active
      const currentCampaign = await db('email_campaigns').where({ id: campaignId }).first();
      if (currentCampaign.status !== 'sending') {
        console.log(`Campaign ${campaignId} is no longer active`);
        break;
      }

      // Get next batch
      const batch = await db('email_sends')
        .where({ campaign_id: campaignId, status: 'queued' })
        .orderBy('priority', 'desc')
        .orderBy('created_at', 'asc')
        .limit(batchSize);

      if (batch.length === 0) break;

      // Add batch to email queue
      const { emailQueue: eq, addToQueue } = require('../queues/emailQueue');
      await addToQueue(campaignId, batch);

      processed += batch.length;

      // Update progress
      const progress = Math.round((processed / total) * 100);
      await job.progress(progress);

      console.log(`Campaign ${campaignId}: Queued ${processed}/${total} (${progress}%)`);

      // Emit progress to WebSocket
      emitProgress(`campaign:${campaignId}`, 'campaign:progress', {
        campaignId,
        processed,
        total,
        progress,
        status: 'processing',
        timestamp: new Date()
      });

      // Delay between batches
      if (processed < total) {
        await delay(delayBetweenBatches);
      }
    }

    // Emit completion
    emitProgress(`campaign:${campaignId}`, 'campaign:progress', {
      campaignId,
      processed,
      total,
      progress: 100,
      status: 'completed',
      timestamp: new Date()
    });

    return { processed, total };

  } catch (error) {
    console.error(`Error processing campaign ${campaignId}:`, error);
    throw error;
  }
});

/**
 * Process scheduled email job
 */
scheduledQueue.process('scheduled-send', async (job) => {
  const emailData = job.data;

  // Add to main email queue for immediate sending
  await emailQueue.add('send-email', emailData, {
    priority: emailData.priority || 0
  });

  return { scheduled: true, sendId: emailData.sendId };
});

/**
 * Send email via configured provider
 */
async function sendViaProvider(settings, emailData) {
  const provider = settings?.provider || 'smtp';
  const config = settings?.provider_config || {};

  switch (provider) {
    case 'sendgrid':
      return sendViaSendGrid(config, emailData);
    case 'ses':
      return sendViaSES(config, emailData);
    case 'resend':
      return sendViaResend(config, emailData);
    default:
      return sendViaSMTP(config, emailData);
  }
}

/**
 * Send via SendGrid
 */
async function sendViaSendGrid(config, emailData) {
  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(config.apiKey);

  const msg = {
    to: emailData.to,
    from: emailData.from,
    replyTo: emailData.replyTo,
    subject: emailData.subject,
    html: emailData.html
  };

  const [response] = await sgMail.send(msg);
  return { messageId: response.headers['x-message-id'] };
}

/**
 * Send via AWS SES
 */
async function sendViaSES(config, emailData) {
  const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

  const client = new SESClient({
    region: config.region || 'us-east-1',
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });

  const command = new SendEmailCommand({
    Source: emailData.from,
    Destination: {
      ToAddresses: [emailData.to]
    },
    ReplyToAddresses: [emailData.replyTo],
    Message: {
      Subject: { Data: emailData.subject },
      Body: { Html: { Data: emailData.html } }
    }
  });

  const result = await client.send(command);
  return { messageId: result.MessageId };
}

/**
 * Send via Resend
 */
async function sendViaResend(config, emailData) {
  const { Resend } = require('resend');
  const resend = new Resend(config.apiKey);

  const { data } = await resend.emails.send({
    from: emailData.from,
    to: emailData.to,
    reply_to: emailData.replyTo,
    subject: emailData.subject,
    html: emailData.html
  });

  return { messageId: data.id };
}

/**
 * Send via SMTP
 */
async function sendViaSMTP(config, emailData) {
  const nodemailer = require('nodemailer');

  const transporter = nodemailer.createTransport({
    host: config.host || process.env.SMTP_HOST,
    port: config.port || process.env.SMTP_PORT || 587,
    secure: config.secure || false,
    auth: {
      user: config.user || process.env.SMTP_USER,
      pass: config.pass || process.env.SMTP_PASS
    }
  });

  const result = await transporter.sendMail({
    from: emailData.from,
    to: emailData.to,
    replyTo: emailData.replyTo,
    subject: emailData.subject,
    html: emailData.html
  });

  return { messageId: result.messageId };
}

/**
 * Personalize content with contact data
 */
function personalize(content, contact) {
  if (!content) return '';

  return content
    .replace(/\{\{first_name\}\}/g, contact.first_name || '')
    .replace(/\{\{last_name\}\}/g, contact.last_name || '')
    .replace(/\{\{email\}\}/g, contact.email || '')
    .replace(/\{\{company\}\}/g, contact.company || '')
    .replace(/\{\{full_name\}\}/g, `${contact.first_name || ''} ${contact.last_name || ''}`.trim())
    .replace(/\{\{phone\}\}/g, contact.phone || '')
    .replace(/\{\{job_title\}\}/g, contact.job_title || '');
}

/**
 * Add tracking pixel and click tracking
 */
function addTracking(html, sendId, settings = {}) {
  const baseUrl = process.env.API_URL || 'http://localhost:3001';

  // Open tracking pixel
  if (settings.trackOpens !== false) {
    const pixel = `<img src="${baseUrl}/api/public/email/open/${sendId}" width="1" height="1" style="display:none;" alt="" />`;
    html = html.replace('</body>', `${pixel}</body>`);
  }

  // Click tracking
  if (settings.trackClicks !== false) {
    html = html.replace(/href="(https?:\/\/[^"]+)"/g, (match, url) => {
      if (url.includes('unsubscribe')) return match;
      const trackUrl = `${baseUrl}/api/public/email/click/${sendId}?url=${encodeURIComponent(url)}`;
      return `href="${trackUrl}"`;
    });
  }

  // Add unsubscribe link
  if (settings.unsubscribeLink !== false && !html.includes('unsubscribe')) {
    const unsubscribeUrl = `${baseUrl}/api/public/email/unsubscribe/${sendId}`;
    const unsubscribeHtml = `
      <div style="text-align: center; margin-top: 20px; padding: 10px; font-size: 12px; color: #666;">
        <a href="${unsubscribeUrl}" style="color: #666; text-decoration: underline;">Unsubscribe</a>
      </div>
    `;
    html = html.replace('</body>', `${unsubscribeHtml}</body>`);
  }

  return html;
}

/**
 * Mark email as failed
 */
async function markFailed(sendId, reason) {
  await db('email_sends').where({ id: sendId }).update({
    status: 'failed',
    bounce_reason: reason,
    worker_id: WORKER_ID
  });
}

/**
 * Enforce rate limiting
 */
async function enforceRateLimit(provider) {
  const limits = RATE_LIMITS[provider] || RATE_LIMITS.smtp;
  const now = Date.now();

  // Reset counter if window has passed
  if (now - sendRateTracker.windowStart > 1000) {
    sendRateTracker.count = 0;
    sendRateTracker.windowStart = now;
  }

  // Wait if at limit
  if (sendRateTracker.count >= limits.perSecond) {
    const waitTime = 1000 - (now - sendRateTracker.windowStart);
    if (waitTime > 0) {
      await delay(waitTime);
      sendRateTracker.count = 0;
      sendRateTracker.windowStart = Date.now();
    }
  }

  sendRateTracker.count++;
}

/**
 * Log queue event
 */
async function logQueueEvent(campaignId, sendId, event, details = {}) {
  try {
    await db('email_queue_logs').insert({
      id: uuidv4(),
      campaign_id: campaignId,
      send_id: sendId,
      event,
      worker_id: WORKER_ID,
      details: JSON.stringify(details),
      created_at: new Date()
    });
  } catch (error) {
    console.error('Error logging queue event:', error);
  }
}

/**
 * Update queue statistics
 */
async function updateQueueStats(campaignId, updates) {
  try {
    const existing = await db('email_queue_stats').where({ campaign_id: campaignId }).first();

    if (existing) {
      const updateData = {};
      if (updates.total_sent) updateData.total_sent = db.raw(`total_sent + ${updates.total_sent}`);
      if (updates.total_failed) updateData.total_failed = db.raw(`total_failed + ${updates.total_failed}`);
      if (updates.total_retried) updateData.total_retried = db.raw(`total_retried + ${updates.total_retried}`);
      if (updates.avg_send_time_ms) {
        // Running average calculation
        updateData.avg_send_time_ms = db.raw(
          `(avg_send_time_ms * total_sent + ${updates.avg_send_time_ms}) / (total_sent + 1)`
        );
      }
      updateData.last_processed_at = new Date();
      updateData.updated_at = new Date();

      await db('email_queue_stats').where({ campaign_id: campaignId }).update(updateData);
    } else {
      await db('email_queue_stats').insert({
        id: uuidv4(),
        campaign_id: campaignId,
        total_sent: updates.total_sent || 0,
        total_failed: updates.total_failed || 0,
        total_retried: updates.total_retried || 0,
        avg_send_time_ms: updates.avg_send_time_ms || 0,
        last_processed_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      });
    }
  } catch (error) {
    console.error('Error updating queue stats:', error);
  }
}

/**
 * Delay helper
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await emailQueue.close();
  await campaignQueue.close();
  await scheduledQueue.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await emailQueue.close();
  await campaignQueue.close();
  await scheduledQueue.close();
  process.exit(0);
});

console.log('Email worker is ready and processing jobs...');
