/**
 * Email Tracking Service
 * Handles tracking of email opens, clicks, bounces, and complaints
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

class EmailTrackingService {
  /**
   * Track email open
   */
  async trackOpen(sendId, req) {
    try {
      const send = await db('email_sends').where({ id: sendId }).first();
      if (!send) return;

      // Check if already recorded an open for this send
      const existingOpen = await db('email_events')
        .where({ send_id: sendId, event_type: 'opened' })
        .first();

      // Record event
      await db('email_events').insert({
        id: uuidv4(),
        campaign_id: send.campaign_id,
        contact_id: send.contact_id,
        send_id: sendId,
        event_type: 'opened',
        user_agent: req.headers['user-agent'] || null,
        ip_address: this.getClientIP(req),
        location: await this.getLocation(this.getClientIP(req)),
        created_at: new Date()
      });

      // Update send record if first open
      if (!existingOpen) {
        await db('email_sends')
          .where({ id: sendId })
          .update({ status: 'delivered' });
      }

      // Update contact last activity
      if (send.contact_id) {
        await db('email_contacts')
          .where({ id: send.contact_id })
          .update({ last_activity_at: new Date() });
      }
    } catch (error) {
      console.error('Error tracking open:', error);
    }
  }

  /**
   * Track link click
   */
  async trackClick(sendId, url, req) {
    try {
      const send = await db('email_sends').where({ id: sendId }).first();
      if (!send) return url;

      // Record event
      await db('email_events').insert({
        id: uuidv4(),
        campaign_id: send.campaign_id,
        contact_id: send.contact_id,
        send_id: sendId,
        event_type: 'clicked',
        link_url: url,
        user_agent: req.headers['user-agent'] || null,
        ip_address: this.getClientIP(req),
        location: await this.getLocation(this.getClientIP(req)),
        created_at: new Date()
      });

      // Update contact last activity
      if (send.contact_id) {
        await db('email_contacts')
          .where({ id: send.contact_id })
          .update({ last_activity_at: new Date() });
      }

      return url;
    } catch (error) {
      console.error('Error tracking click:', error);
      return url;
    }
  }

  /**
   * Handle ESP webhooks (bounces, complaints, etc.)
   */
  async handleWebhook(provider, event) {
    switch (provider) {
      case 'sendgrid':
        return this.handleSendGridWebhook(event);
      case 'ses':
        return this.handleSESWebhook(event);
      case 'resend':
        return this.handleResendWebhook(event);
      default:
        console.warn('Unknown webhook provider:', provider);
    }
  }

  /**
   * Handle SendGrid webhook events
   */
  async handleSendGridWebhook(events) {
    if (!Array.isArray(events)) {
      events = [events];
    }

    for (const event of events) {
      try {
        const send = await db('email_sends')
          .where({ message_id: event.sg_message_id })
          .first();

        if (!send) continue;

        switch (event.event) {
          case 'delivered':
            await db('email_sends').where({ id: send.id }).update({
              status: 'delivered',
              delivered_at: new Date(event.timestamp * 1000)
            });
            await this.recordEvent(send, 'delivered');
            break;

          case 'bounce':
            await this.handleBounce(send, {
              type: event.type === 'bounce' ? 'hard' : 'soft',
              reason: event.reason
            });
            break;

          case 'spamreport':
            await this.handleComplaint(send);
            break;

          case 'unsubscribe':
            await this.handleUnsubscribe(send);
            break;

          case 'open':
            // Already tracked via pixel, but record if webhook comes first
            await this.recordEvent(send, 'opened');
            break;

          case 'click':
            await this.recordEvent(send, 'clicked', { link_url: event.url });
            break;
        }
      } catch (error) {
        console.error('Error processing SendGrid webhook event:', error);
      }
    }
  }

  /**
   * Handle AWS SES webhook events (via SNS)
   */
  async handleSESWebhook(notification) {
    try {
      const message = typeof notification.Message === 'string'
        ? JSON.parse(notification.Message)
        : notification;

      const messageId = message.mail?.messageId;
      if (!messageId) return;

      const send = await db('email_sends')
        .where({ message_id: messageId })
        .first();

      if (!send) return;

      switch (message.notificationType || message.eventType) {
        case 'Delivery':
          await db('email_sends').where({ id: send.id }).update({
            status: 'delivered',
            delivered_at: new Date()
          });
          await this.recordEvent(send, 'delivered');
          break;

        case 'Bounce':
          const bounceType = message.bounce?.bounceType === 'Permanent' ? 'hard' : 'soft';
          await this.handleBounce(send, {
            type: bounceType,
            reason: message.bounce?.bouncedRecipients?.[0]?.diagnosticCode || 'Unknown'
          });
          break;

        case 'Complaint':
          await this.handleComplaint(send);
          break;
      }
    } catch (error) {
      console.error('Error processing SES webhook:', error);
    }
  }

  /**
   * Handle Resend webhook events
   */
  async handleResendWebhook(event) {
    try {
      const send = await db('email_sends')
        .where({ message_id: event.data?.email_id })
        .first();

      if (!send) return;

      switch (event.type) {
        case 'email.delivered':
          await db('email_sends').where({ id: send.id }).update({
            status: 'delivered',
            delivered_at: new Date()
          });
          await this.recordEvent(send, 'delivered');
          break;

        case 'email.bounced':
          await this.handleBounce(send, {
            type: 'hard',
            reason: event.data?.bounce?.message || 'Unknown'
          });
          break;

        case 'email.complained':
          await this.handleComplaint(send);
          break;
      }
    } catch (error) {
      console.error('Error processing Resend webhook:', error);
    }
  }

  /**
   * Handle bounce
   */
  async handleBounce(send, bounceInfo) {
    await db('email_sends').where({ id: send.id }).update({
      status: 'bounced',
      bounce_type: bounceInfo.type,
      bounce_reason: bounceInfo.reason
    });

    await this.recordEvent(send, 'bounced', {
      metadata: { type: bounceInfo.type, reason: bounceInfo.reason }
    });

    // Update contact status for hard bounces
    if (bounceInfo.type === 'hard' && send.contact_id) {
      await db('email_contacts')
        .where({ id: send.contact_id })
        .update({
          status: 'bounced',
          updated_at: new Date()
        });
    }
  }

  /**
   * Handle complaint (spam report)
   */
  async handleComplaint(send) {
    await this.recordEvent(send, 'complained');

    if (send.contact_id) {
      await db('email_contacts')
        .where({ id: send.contact_id })
        .update({
          status: 'complained',
          updated_at: new Date()
        });
    }
  }

  /**
   * Handle unsubscribe via webhook
   */
  async handleUnsubscribe(send) {
    await this.recordEvent(send, 'unsubscribed');

    if (send.contact_id) {
      await this.unsubscribeContact(send.contact_id, send.campaign_id);
    }
  }

  /**
   * Unsubscribe a contact
   */
  async unsubscribeContact(contactId, campaignId, reason = null, feedback = null) {
    const contact = await db('email_contacts').where({ id: contactId }).first();
    if (!contact) return;

    // Update contact status
    await db('email_contacts')
      .where({ id: contactId })
      .update({
        status: 'unsubscribed',
        unsubscribed_at: new Date(),
        updated_at: new Date()
      });

    // Record unsubscribe
    await db('email_unsubscribes').insert({
      id: uuidv4(),
      workspace_id: contact.workspace_id,
      contact_id: contactId,
      campaign_id: campaignId,
      email: contact.email,
      reason: reason,
      feedback: feedback,
      unsubscribed_at: new Date()
    });
  }

  /**
   * Resubscribe a contact
   */
  async resubscribeContact(contactId) {
    await db('email_contacts')
      .where({ id: contactId })
      .update({
        status: 'subscribed',
        unsubscribed_at: null,
        updated_at: new Date()
      });
  }

  /**
   * Record an event
   */
  async recordEvent(send, eventType, extra = {}) {
    await db('email_events').insert({
      id: uuidv4(),
      campaign_id: send.campaign_id,
      contact_id: send.contact_id,
      send_id: send.id,
      event_type: eventType,
      link_url: extra.link_url || null,
      user_agent: extra.user_agent || null,
      ip_address: extra.ip_address || null,
      location: extra.location || null,
      metadata: extra.metadata || null,
      created_at: new Date()
    });
  }

  /**
   * Get campaign report data
   */
  async getCampaignReport(campaignId) {
    const campaign = await db('email_campaigns').where({ id: campaignId }).first();
    if (!campaign) return null;

    // Get stats
    const stats = await this.getCampaignStats(campaignId);

    // Get open trend (hourly for first 48 hours)
    const openTrend = await db('email_events')
      .where({ campaign_id: campaignId, event_type: 'opened' })
      .select(
        db.raw("DATE_TRUNC('hour', created_at) as hour"),
        db.raw('COUNT(*) as opens')
      )
      .groupBy('hour')
      .orderBy('hour');

    // Get click map (links clicked)
    const clickMap = await db('email_events')
      .where({ campaign_id: campaignId, event_type: 'clicked' })
      .whereNotNull('link_url')
      .select('link_url as url')
      .count('* as clicks')
      .groupBy('link_url')
      .orderBy('clicks', 'desc');

    // Get device breakdown
    const deviceBreakdown = await this.getDeviceBreakdown(campaignId);

    // Get location data
    const locationData = await this.getLocationData(campaignId);

    // Get recipients with status
    const recipients = await db('email_sends')
      .where({ campaign_id: campaignId })
      .leftJoin('email_contacts', 'email_sends.contact_id', 'email_contacts.id')
      .select(
        'email_sends.email',
        'email_sends.status',
        'email_sends.sent_at',
        'email_sends.delivered_at',
        db.raw(`EXISTS(
          SELECT 1 FROM email_events
          WHERE send_id = email_sends.id AND event_type = 'opened'
        ) as opened`),
        db.raw(`EXISTS(
          SELECT 1 FROM email_events
          WHERE send_id = email_sends.id AND event_type = 'clicked'
        ) as clicked`),
        db.raw(`(
          SELECT created_at FROM email_events
          WHERE send_id = email_sends.id AND event_type = 'opened'
          ORDER BY created_at ASC LIMIT 1
        ) as opened_at`)
      )
      .limit(1000);

    return {
      campaign,
      stats,
      openTrend,
      clickMap,
      deviceBreakdown,
      locationData,
      recipients
    };
  }

  /**
   * Get campaign stats
   */
  async getCampaignStats(campaignId) {
    const sends = await db('email_sends')
      .where({ campaign_id: campaignId })
      .select(
        db.raw('COUNT(*) as total'),
        db.raw("COUNT(CASE WHEN status IN ('sent', 'delivered') THEN 1 END) as sent"),
        db.raw("COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered"),
        db.raw("COUNT(CASE WHEN status = 'bounced' THEN 1 END) as bounced")
      )
      .first();

    const events = await db('email_events')
      .where({ campaign_id: campaignId })
      .select(
        db.raw("COUNT(DISTINCT CASE WHEN event_type = 'opened' THEN contact_id END) as opens"),
        db.raw("COUNT(DISTINCT CASE WHEN event_type = 'clicked' THEN contact_id END) as clicks"),
        db.raw("COUNT(CASE WHEN event_type = 'unsubscribed' THEN 1 END) as unsubscribed")
      )
      .first();

    const delivered = parseInt(sends.delivered) || parseInt(sends.sent) || 1;

    return {
      sent: parseInt(sends.sent) || 0,
      delivered: parseInt(sends.delivered) || 0,
      bounced: parseInt(sends.bounced) || 0,
      opens: parseInt(events.opens) || 0,
      clicks: parseInt(events.clicks) || 0,
      unsubscribed: parseInt(events.unsubscribed) || 0,
      openRate: (parseInt(events.opens) / delivered) * 100,
      clickRate: (parseInt(events.clicks) / delivered) * 100
    };
  }

  /**
   * Get device breakdown
   */
  async getDeviceBreakdown(campaignId) {
    const events = await db('email_events')
      .where({ campaign_id: campaignId, event_type: 'opened' })
      .whereNotNull('user_agent')
      .select('user_agent');

    const breakdown = { desktop: 0, mobile: 0, tablet: 0 };

    for (const event of events) {
      const ua = (event.user_agent || '').toLowerCase();
      if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
        if (ua.includes('ipad') || ua.includes('tablet')) {
          breakdown.tablet++;
        } else {
          breakdown.mobile++;
        }
      } else {
        breakdown.desktop++;
      }
    }

    return breakdown;
  }

  /**
   * Get location data
   */
  async getLocationData(campaignId) {
    const locations = await db('email_events')
      .where({ campaign_id: campaignId, event_type: 'opened' })
      .whereNotNull('location')
      .select(db.raw("location->>'country' as country"))
      .count('* as opens')
      .groupBy(db.raw("location->>'country'"))
      .orderBy('opens', 'desc')
      .limit(20);

    return locations.map(l => ({
      country: l.country || 'Unknown',
      opens: parseInt(l.opens)
    }));
  }

  /**
   * Get client IP from request
   */
  getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.connection?.remoteAddress ||
           req.ip;
  }

  /**
   * Get location from IP
   */
  async getLocation(ip) {
    if (!ip || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return null;
    }

    try {
      const response = await fetch(`https://ipapi.co/${ip}/json/`);
      if (!response.ok) return null;

      const data = await response.json();
      return {
        country: data.country_name,
        country_code: data.country_code,
        city: data.city,
        region: data.region
      };
    } catch (error) {
      console.error('Error getting location:', error);
      return null;
    }
  }
}

module.exports = new EmailTrackingService();
