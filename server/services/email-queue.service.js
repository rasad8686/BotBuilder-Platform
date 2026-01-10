/**
 * Email Queue Service
 * Handles queuing and processing of email campaigns using Bull Queue
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const {
  emailQueue,
  campaignQueue,
  addToQueue,
  addCampaignJob,
  scheduleEmail,
  getQueueStats,
  getCampaignQueueStats,
  pauseCampaign: pauseCampaignQueue,
  resumeCampaign: resumeCampaignQueue,
  cancelCampaign: cancelCampaignQueue,
  retryFailedEmails,
  getFailedJobs,
  cleanQueue
} = require('../queues/emailQueue');

class EmailQueueService {
  constructor() {
    this.isProcessing = false;
    this.rateLimits = {
      sendgrid: { perSecond: 10, perMinute: 600 },
      ses: { perSecond: 14, perMinute: 840 },
      resend: { perSecond: 10, perMinute: 600 },
      smtp: { perSecond: 5, perMinute: 300 }
    };
    this.useBullQueue = true; // Enable Bull Queue
  }

  /**
   * Queue a campaign for sending (using Bull Queue)
   */
  async queueCampaign(campaignId, options = {}) {
    const campaign = await this.getCampaign(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      throw new Error(`Campaign cannot be sent from status: ${campaign.status}`);
    }

    // Get recipients
    const recipients = await this.getRecipients(campaign);
    if (recipients.length === 0) {
      throw new Error('No recipients found for campaign');
    }

    // Create email_sends records in batches
    const batchSize = 1000;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      await this.createEmailSends(campaignId, batch);
    }

    // Initialize queue stats
    await db('email_queue_stats').insert({
      id: uuidv4(),
      campaign_id: campaignId,
      workspace_id: campaign.workspace_id,
      total_queued: recipients.length,
      created_at: new Date(),
      updated_at: new Date()
    }).onConflict('campaign_id').merge();

    // Update campaign status
    await db('email_campaigns')
      .where({ id: campaignId })
      .update({
        status: 'sending',
        total_recipients: recipients.length,
        started_at: new Date(),
        updated_at: new Date()
      });

    // Use Bull Queue if enabled
    if (this.useBullQueue) {
      // Add campaign to Bull queue for processing
      await addCampaignJob(campaignId, {
        batchSize: options.batchSize || 100,
        delayBetweenBatches: options.delayBetweenBatches || 1000
      });
    } else {
      // Fallback to in-process queue
      this.processQueue(campaignId);
    }

    return { success: true, totalRecipients: recipients.length };
  }

  /**
   * Get campaign by ID
   */
  async getCampaign(campaignId) {
    return db('email_campaigns').where({ id: campaignId }).first();
  }

  /**
   * Get recipients for a campaign
   */
  async getRecipients(campaign) {
    const { workspace_id, list_ids } = campaign;

    let query = db('email_contacts')
      .where({ workspace_id, status: 'subscribed' })
      .select('id', 'email', 'first_name', 'last_name', 'company');

    // Filter by lists if specified
    if (list_ids && list_ids.length > 0) {
      query = query
        .whereIn('id', function() {
          this.select('contact_id')
            .from('email_list_contacts')
            .whereIn('list_id', list_ids);
        });
    }

    const contacts = await query;

    // Remove duplicates by email
    const uniqueContacts = [];
    const seenEmails = new Set();

    for (const contact of contacts) {
      const email = contact.email.toLowerCase();
      if (!seenEmails.has(email)) {
        seenEmails.add(email);
        uniqueContacts.push(contact);
      }
    }

    return uniqueContacts;
  }

  /**
   * Create email send records
   */
  async createEmailSends(campaignId, contacts) {
    const sends = contacts.map(contact => ({
      id: uuidv4(),
      campaign_id: campaignId,
      contact_id: contact.id,
      email: contact.email,
      status: 'queued',
      created_at: new Date()
    }));

    await db('email_sends').insert(sends);
  }

  /**
   * Process the email queue for a campaign
   */
  async processQueue(campaignId) {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const batchSize = 100;
    const delayBetweenBatches = 1000; // 1 second

    try {
      while (true) {
        // Check if campaign is still active
        const campaign = await this.getCampaign(campaignId);
        if (!campaign || campaign.status !== 'sending') {
          break;
        }

        // Get next batch of queued emails
        const batch = await db('email_sends')
          .where({ campaign_id: campaignId, status: 'queued' })
          .limit(batchSize);

        if (batch.length === 0) {
          // All done
          await this.completeCampaign(campaignId);
          break;
        }

        // Send batch in parallel
        await Promise.all(batch.map(send => this.sendEmail(send)));

        // Rate limiting delay
        await this.delay(delayBetweenBatches);
      }
    } catch (error) {
      console.error('Error processing email queue:', error);
      await db('email_campaigns')
        .where({ id: campaignId })
        .update({
          status: 'paused',
          updated_at: new Date()
        });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Send a single email
   */
  async sendEmail(emailSend) {
    try {
      const campaign = await this.getCampaign(emailSend.campaign_id);
      const contact = await db('email_contacts').where({ id: emailSend.contact_id }).first();

      if (!contact) {
        await this.markSendFailed(emailSend.id, 'Contact not found');
        return;
      }

      // Personalize content
      const html = this.personalize(campaign.content_html, contact);
      const subject = this.personalize(campaign.subject, contact);

      // Add tracking
      const trackedHtml = this.addTracking(html, emailSend.id, campaign.settings);

      // Get email settings for workspace
      const settings = await db('email_settings')
        .where({ workspace_id: campaign.workspace_id })
        .first();

      // Send via configured provider
      const result = await this.sendViaProvider(settings, {
        to: contact.email,
        from: `${campaign.from_name} <${campaign.from_email}>`,
        replyTo: campaign.reply_to || campaign.from_email,
        subject: subject,
        html: trackedHtml
      });

      // Update send record
      await db('email_sends').where({ id: emailSend.id }).update({
        status: 'sent',
        sent_at: new Date(),
        message_id: result.messageId
      });

      // Update campaign sent count
      await db('email_campaigns')
        .where({ id: emailSend.campaign_id })
        .increment('sent_count', 1);

    } catch (error) {
      console.error('Error sending email:', error);
      await this.markSendFailed(emailSend.id, error.message);
    }
  }

  /**
   * Send email via configured provider
   */
  async sendViaProvider(settings, emailData) {
    const provider = settings?.provider || 'smtp';
    const config = settings?.provider_config || {};

    switch (provider) {
      case 'sendgrid':
        return this.sendViaSendGrid(config, emailData);
      case 'ses':
        return this.sendViaSES(config, emailData);
      case 'resend':
        return this.sendViaResend(config, emailData);
      default:
        return this.sendViaSMTP(config, emailData);
    }
  }

  /**
   * Send via SendGrid
   */
  async sendViaSendGrid(config, emailData) {
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
  async sendViaSES(config, emailData) {
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
  async sendViaResend(config, emailData) {
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
  async sendViaSMTP(config, emailData) {
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
  personalize(content, contact) {
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
  addTracking(html, sendId, settings = {}) {
    const baseUrl = process.env.API_URL || 'http://localhost:3001';

    // Open tracking pixel
    if (settings.trackOpens !== false) {
      const pixel = `<img src="${baseUrl}/api/public/email/open/${sendId}" width="1" height="1" style="display:none;" alt="" />`;
      html = html.replace('</body>', `${pixel}</body>`);
    }

    // Click tracking
    if (settings.trackClicks !== false) {
      html = html.replace(/href="(https?:\/\/[^"]+)"/g, (match, url) => {
        // Don't track unsubscribe links
        if (url.includes('unsubscribe')) return match;
        const trackUrl = `${baseUrl}/api/public/email/click/${sendId}?url=${encodeURIComponent(url)}`;
        return `href="${trackUrl}"`;
      });
    }

    // Add unsubscribe link if enabled
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
   * Mark send as failed
   */
  async markSendFailed(sendId, reason) {
    await db('email_sends').where({ id: sendId }).update({
      status: 'failed',
      bounce_reason: reason
    });
  }

  /**
   * Complete campaign
   */
  async completeCampaign(campaignId) {
    await db('email_campaigns').where({ id: campaignId }).update({
      status: 'sent',
      completed_at: new Date(),
      updated_at: new Date()
    });
  }

  /**
   * Pause a campaign
   */
  async pauseCampaign(campaignId) {
    // Pause in Bull queue
    if (this.useBullQueue) {
      await pauseCampaignQueue(campaignId);
    }

    await db('email_campaigns').where({ id: campaignId }).update({
      status: 'paused',
      updated_at: new Date()
    });

    return { success: true };
  }

  /**
   * Resume a paused campaign
   */
  async resumeCampaign(campaignId) {
    const campaign = await this.getCampaign(campaignId);
    if (campaign.status !== 'paused') {
      throw new Error('Campaign is not paused');
    }

    await db('email_campaigns').where({ id: campaignId }).update({
      status: 'sending',
      updated_at: new Date()
    });

    if (this.useBullQueue) {
      // Get pending emails and re-queue them
      const pendingEmails = await db('email_sends')
        .where({ campaign_id: campaignId, status: 'queued' });
      await resumeCampaignQueue(campaignId, pendingEmails);
    } else {
      this.processQueue(campaignId);
    }

    return { success: true };
  }

  /**
   * Cancel a campaign
   */
  async cancelCampaign(campaignId) {
    const campaign = await this.getCampaign(campaignId);
    if (!['scheduled', 'sending', 'paused'].includes(campaign.status)) {
      throw new Error('Campaign cannot be cancelled');
    }

    // Cancel in Bull queue
    if (this.useBullQueue) {
      await cancelCampaignQueue(campaignId);
    }

    // Delete queued emails
    await db('email_sends')
      .where({ campaign_id: campaignId, status: 'queued' })
      .delete();

    await db('email_campaigns').where({ id: campaignId }).update({
      status: 'cancelled',
      updated_at: new Date()
    });

    return { success: true };
  }

  /**
   * Retry failed emails for a campaign
   */
  async retryFailed(campaignId) {
    if (this.useBullQueue) {
      return retryFailedEmails(campaignId);
    }

    // Fallback: reset failed emails to queued status
    const result = await db('email_sends')
      .where({ campaign_id: campaignId, status: 'failed' })
      .update({
        status: 'queued',
        bounce_reason: null,
        attempts: 0,
        next_retry_at: null
      });

    // Re-trigger processing
    const campaign = await this.getCampaign(campaignId);
    if (campaign.status === 'sent') {
      await db('email_campaigns').where({ id: campaignId }).update({
        status: 'sending',
        updated_at: new Date()
      });
    }

    this.processQueue(campaignId);
    return { retried: result };
  }

  /**
   * Get queue statistics (global)
   */
  async getQueueStats() {
    if (this.useBullQueue) {
      return getQueueStats();
    }

    // Fallback: query database
    const stats = await db('email_sends')
      .select(
        db.raw("COUNT(CASE WHEN status = 'queued' THEN 1 END) as pending"),
        db.raw("COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing"),
        db.raw("COUNT(CASE WHEN status = 'sent' OR status = 'delivered' THEN 1 END) as sent"),
        db.raw("COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed")
      )
      .first();

    return {
      waiting: parseInt(stats.pending) || 0,
      active: parseInt(stats.processing) || 0,
      completed: parseInt(stats.sent) || 0,
      failed: parseInt(stats.failed) || 0
    };
  }

  /**
   * Get campaign-specific queue stats
   */
  async getCampaignQueueStats(campaignId) {
    if (this.useBullQueue) {
      const bullStats = await getCampaignQueueStats(campaignId);

      // Merge with DB stats
      const dbStats = await db('email_queue_stats')
        .where({ campaign_id: campaignId })
        .first();

      return {
        ...bullStats,
        totalQueued: dbStats?.total_queued || 0,
        totalSent: dbStats?.total_sent || 0,
        totalFailed: dbStats?.total_failed || 0,
        avgSendTimeMs: dbStats?.avg_send_time_ms || 0,
        lastProcessedAt: dbStats?.last_processed_at
      };
    }

    // Fallback: query database
    const stats = await db('email_sends')
      .where({ campaign_id: campaignId })
      .select(
        db.raw('COUNT(*) as total'),
        db.raw("COUNT(CASE WHEN status = 'queued' THEN 1 END) as pending"),
        db.raw("COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing"),
        db.raw("COUNT(CASE WHEN status = 'sent' OR status = 'delivered' THEN 1 END) as sent"),
        db.raw("COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed")
      )
      .first();

    return {
      total: parseInt(stats.total) || 0,
      pending: parseInt(stats.pending) || 0,
      processing: parseInt(stats.processing) || 0,
      sent: parseInt(stats.sent) || 0,
      failed: parseInt(stats.failed) || 0
    };
  }

  /**
   * Get failed jobs for a campaign
   */
  async getFailedEmails(campaignId) {
    if (this.useBullQueue) {
      return getFailedJobs(campaignId);
    }

    return db('email_sends')
      .where({ campaign_id: campaignId, status: 'failed' })
      .select('id', 'email', 'bounce_reason', 'attempts', 'created_at');
  }

  /**
   * Get queue logs for debugging
   */
  async getQueueLogs(campaignId, options = {}) {
    const query = db('email_queue_logs')
      .where({ campaign_id: campaignId })
      .orderBy('created_at', 'desc');

    if (options.event) {
      query.where({ event: options.event });
    }

    if (options.limit) {
      query.limit(options.limit);
    }

    return query;
  }

  /**
   * Clean old queue data
   */
  async cleanQueue(daysOld = 7) {
    if (this.useBullQueue) {
      await cleanQueue(daysOld * 24 * 60 * 60 * 1000);
    }

    // Clean old logs
    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    await db('email_queue_logs')
      .where('created_at', '<', cutoff)
      .delete();

    return { success: true };
  }

  /**
   * Get campaign statistics
   */
  async getCampaignStats(campaignId) {
    const campaign = await this.getCampaign(campaignId);

    const sends = await db('email_sends')
      .where({ campaign_id: campaignId })
      .select(
        db.raw('COUNT(*) as total'),
        db.raw("COUNT(CASE WHEN status = 'sent' OR status = 'delivered' THEN 1 END) as sent"),
        db.raw("COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered"),
        db.raw("COUNT(CASE WHEN status = 'bounced' THEN 1 END) as bounced"),
        db.raw("COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed")
      )
      .first();

    const events = await db('email_events')
      .where({ campaign_id: campaignId })
      .select(
        db.raw("COUNT(DISTINCT CASE WHEN event_type = 'opened' THEN contact_id END) as unique_opens"),
        db.raw("COUNT(CASE WHEN event_type = 'opened' THEN 1 END) as total_opens"),
        db.raw("COUNT(DISTINCT CASE WHEN event_type = 'clicked' THEN contact_id END) as unique_clicks"),
        db.raw("COUNT(CASE WHEN event_type = 'clicked' THEN 1 END) as total_clicks"),
        db.raw("COUNT(CASE WHEN event_type = 'unsubscribed' THEN 1 END) as unsubscribed")
      )
      .first();

    return {
      sent: parseInt(sends.sent) || 0,
      delivered: parseInt(sends.delivered) || 0,
      bounced: parseInt(sends.bounced) || 0,
      failed: parseInt(sends.failed) || 0,
      opens: parseInt(events.unique_opens) || 0,
      totalOpens: parseInt(events.total_opens) || 0,
      clicks: parseInt(events.unique_clicks) || 0,
      totalClicks: parseInt(events.total_clicks) || 0,
      unsubscribed: parseInt(events.unsubscribed) || 0,
      openRate: sends.delivered ? (events.unique_opens / sends.delivered) * 100 : 0,
      clickRate: sends.delivered ? (events.unique_clicks / sends.delivered) * 100 : 0
    };
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new EmailQueueService();
