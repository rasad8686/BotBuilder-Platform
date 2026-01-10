/**
 * Email Scheduler Service
 * Handles scheduling and processing of scheduled email campaigns
 */

const cron = require('node-cron');
const db = require('../config/db');
const emailQueueService = require('./email-queue.service');

class EmailSchedulerService {
  constructor() {
    this.isRunning = false;
    this.cronJob = null;
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this.cronJob) {
      console.log('Email scheduler already running');
      return;
    }

    // Check for scheduled campaigns every minute
    this.cronJob = cron.schedule('* * * * *', async () => {
      await this.processScheduledCampaigns();
    });

    console.log('Email scheduler started');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('Email scheduler stopped');
    }
  }

  /**
   * Process scheduled campaigns that are due
   */
  async processScheduledCampaigns() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const now = new Date();

      // Find campaigns ready to send
      const campaigns = await db('email_campaigns')
        .where({ status: 'scheduled' })
        .where('scheduled_at', '<=', now);

      for (const campaign of campaigns) {
        console.log(`Processing scheduled campaign: ${campaign.id}`);
        try {
          await emailQueueService.queueCampaign(campaign.id);
          console.log(`Campaign ${campaign.id} queued successfully`);
        } catch (error) {
          console.error(`Error processing campaign ${campaign.id}:`, error);
          // Mark campaign as failed
          await db('email_campaigns')
            .where({ id: campaign.id })
            .update({
              status: 'draft',
              updated_at: new Date()
            });
        }
      }
    } catch (error) {
      console.error('Error in processScheduledCampaigns:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Schedule a campaign for later
   */
  async scheduleCampaign(campaignId, scheduledAt) {
    const campaign = await db('email_campaigns').where({ id: campaignId }).first();

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (!['draft', 'scheduled'].includes(campaign.status)) {
      throw new Error(`Cannot schedule campaign with status: ${campaign.status}`);
    }

    const scheduleDate = new Date(scheduledAt);
    if (scheduleDate <= new Date()) {
      throw new Error('Scheduled time must be in the future');
    }

    await db('email_campaigns').where({ id: campaignId }).update({
      status: 'scheduled',
      scheduled_at: scheduleDate,
      updated_at: new Date()
    });

    return { success: true, scheduled_at: scheduleDate };
  }

  /**
   * Cancel a scheduled campaign
   */
  async cancelSchedule(campaignId) {
    const campaign = await db('email_campaigns').where({ id: campaignId }).first();

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status !== 'scheduled') {
      throw new Error('Campaign is not scheduled');
    }

    await db('email_campaigns').where({ id: campaignId }).update({
      status: 'draft',
      scheduled_at: null,
      updated_at: new Date()
    });

    return { success: true };
  }

  /**
   * Reschedule a campaign
   */
  async rescheduleCampaign(campaignId, newScheduledAt) {
    const campaign = await db('email_campaigns').where({ id: campaignId }).first();

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status !== 'scheduled') {
      throw new Error('Campaign is not scheduled');
    }

    const scheduleDate = new Date(newScheduledAt);
    if (scheduleDate <= new Date()) {
      throw new Error('Scheduled time must be in the future');
    }

    await db('email_campaigns').where({ id: campaignId }).update({
      scheduled_at: scheduleDate,
      updated_at: new Date()
    });

    return { success: true, scheduled_at: scheduleDate };
  }

  /**
   * Get upcoming scheduled campaigns
   */
  async getUpcomingCampaigns(workspaceId, limit = 10) {
    return db('email_campaigns')
      .where({ workspace_id: workspaceId, status: 'scheduled' })
      .where('scheduled_at', '>', new Date())
      .orderBy('scheduled_at', 'asc')
      .limit(limit);
  }

  /**
   * Calculate optimal send time for a contact
   * Based on historical engagement data
   */
  async getOptimalSendTime(contactId) {
    // Get historical open events for this contact
    const openEvents = await db('email_events')
      .where({ contact_id: contactId, event_type: 'opened' })
      .select(db.raw("EXTRACT(HOUR FROM created_at) as hour"))
      .limit(100);

    if (openEvents.length === 0) {
      // Default to 10 AM if no historical data
      return { hour: 10, confidence: 'low' };
    }

    // Calculate most common open hour
    const hourCounts = {};
    for (const event of openEvents) {
      const hour = parseInt(event.hour);
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }

    let maxHour = 10;
    let maxCount = 0;
    for (const [hour, count] of Object.entries(hourCounts)) {
      if (count > maxCount) {
        maxCount = count;
        maxHour = parseInt(hour);
      }
    }

    const confidence = openEvents.length >= 10 ? 'high' :
                       openEvents.length >= 5 ? 'medium' : 'low';

    return { hour: maxHour, confidence };
  }

  /**
   * Calculate optimal send day for a contact
   */
  async getOptimalSendDay(contactId) {
    const openEvents = await db('email_events')
      .where({ contact_id: contactId, event_type: 'opened' })
      .select(db.raw("EXTRACT(DOW FROM created_at) as day"))
      .limit(100);

    if (openEvents.length === 0) {
      // Default to Tuesday if no historical data
      return { day: 2, confidence: 'low' };
    }

    const dayCounts = {};
    for (const event of openEvents) {
      const day = parseInt(event.day);
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    }

    let maxDay = 2;
    let maxCount = 0;
    for (const [day, count] of Object.entries(dayCounts)) {
      if (count > maxCount) {
        maxCount = count;
        maxDay = parseInt(day);
      }
    }

    const confidence = openEvents.length >= 10 ? 'high' :
                       openEvents.length >= 5 ? 'medium' : 'low';

    return { day: maxDay, confidence };
  }

  /**
   * Get next optimal send window
   */
  async getNextOptimalWindow(contactId, timezone = 'UTC') {
    const optimalHour = await this.getOptimalSendTime(contactId);
    const optimalDay = await this.getOptimalSendDay(contactId);

    const now = new Date();
    let targetDate = new Date(now);

    // Find next occurrence of optimal day
    const currentDay = now.getDay();
    let daysUntilOptimal = optimalDay.day - currentDay;
    if (daysUntilOptimal < 0) daysUntilOptimal += 7;
    if (daysUntilOptimal === 0 && now.getHours() >= optimalHour.hour) {
      daysUntilOptimal = 7;
    }

    targetDate.setDate(targetDate.getDate() + daysUntilOptimal);
    targetDate.setHours(optimalHour.hour, 0, 0, 0);

    return {
      date: targetDate,
      hour: optimalHour.hour,
      day: optimalDay.day,
      confidence: optimalHour.confidence === 'high' && optimalDay.confidence === 'high'
        ? 'high'
        : optimalHour.confidence === 'low' || optimalDay.confidence === 'low'
          ? 'low'
          : 'medium'
    };
  }
}

module.exports = new EmailSchedulerService();
