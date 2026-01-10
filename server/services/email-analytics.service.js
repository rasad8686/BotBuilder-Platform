const { v4: uuidv4 } = require('uuid');

class EmailAnalyticsService {
  constructor(db) {
    this.db = db;
  }

  async getOverview(workspaceId, dateRange) {
    const { startDate, endDate } = dateRange;

    try {
      // Get send stats
      const sendStats = await this.db('email_sends')
        .join('email_campaigns', 'email_sends.campaign_id', 'email_campaigns.id')
        .where('email_campaigns.workspace_id', workspaceId)
        .whereBetween('email_sends.sent_at', [startDate, endDate])
        .select(
          this.db.raw('COUNT(*) as total_sent'),
          this.db.raw("COUNT(*) FILTER (WHERE email_sends.status = 'delivered') as delivered"),
          this.db.raw("COUNT(*) FILTER (WHERE email_sends.status = 'bounced') as bounced"),
          this.db.raw("COUNT(*) FILTER (WHERE email_sends.status = 'failed') as failed")
        )
        .first();

      // Get event stats
      const eventStats = await this.db('email_events')
        .join('email_sends', 'email_events.send_id', 'email_sends.id')
        .join('email_campaigns', 'email_sends.campaign_id', 'email_campaigns.id')
        .where('email_campaigns.workspace_id', workspaceId)
        .whereBetween('email_events.created_at', [startDate, endDate])
        .select(
          this.db.raw("COUNT(DISTINCT email_events.id) FILTER (WHERE email_events.event_type = 'opened') as opens"),
          this.db.raw("COUNT(DISTINCT email_events.contact_id) FILTER (WHERE email_events.event_type = 'opened') as unique_opens"),
          this.db.raw("COUNT(DISTINCT email_events.id) FILTER (WHERE email_events.event_type = 'clicked') as clicks"),
          this.db.raw("COUNT(DISTINCT email_events.contact_id) FILTER (WHERE email_events.event_type = 'clicked') as unique_clicks"),
          this.db.raw("COUNT(*) FILTER (WHERE email_events.event_type = 'unsubscribed') as unsubscribes"),
          this.db.raw("COUNT(*) FILTER (WHERE email_events.event_type = 'spam_complaint') as spam_complaints")
        )
        .first();

      // Get contact stats
      const contactStats = await this.db('email_contacts')
        .where({ workspace_id: workspaceId })
        .select(
          this.db.raw('COUNT(*) as total'),
          this.db.raw("COUNT(*) FILTER (WHERE status = 'subscribed') as subscribed"),
          this.db.raw("COUNT(*) FILTER (WHERE created_at >= ?) as new_contacts", [startDate])
        )
        .first();

      // Get list count
      const listCount = await this.db('email_lists')
        .where({ workspace_id: workspaceId })
        .count('id as count')
        .first();

      // Calculate rates
      const delivered = parseInt(sendStats.delivered) || 0;
      const totalSent = parseInt(sendStats.total_sent) || 0;
      const opens = parseInt(eventStats.unique_opens) || 0;
      const clicks = parseInt(eventStats.unique_clicks) || 0;
      const bounces = parseInt(sendStats.bounced) || 0;
      const unsubscribes = parseInt(eventStats.unsubscribes) || 0;
      const spamComplaints = parseInt(eventStats.spam_complaints) || 0;

      const deliveryRate = totalSent > 0 ? (delivered / totalSent) * 100 : 0;
      const openRate = delivered > 0 ? (opens / delivered) * 100 : 0;
      const clickRate = delivered > 0 ? (clicks / delivered) * 100 : 0;
      const bounceRate = totalSent > 0 ? (bounces / totalSent) * 100 : 0;
      const unsubscribeRate = delivered > 0 ? (unsubscribes / delivered) * 100 : 0;
      const spamRate = delivered > 0 ? (spamComplaints / delivered) * 100 : 0;

      // Get previous period for comparison
      const previousStats = await this.getPreviousPeriodStats(workspaceId, dateRange);

      return {
        totalSent,
        delivered,
        deliveryRate,
        opens,
        openRate,
        clicks,
        clickRate,
        bounces,
        bounceRate,
        unsubscribed: unsubscribes,
        unsubscribeRate,
        spamRate,
        totalContacts: parseInt(contactStats.total) || 0,
        newContacts: parseInt(contactStats.new_contacts) || 0,
        netGrowth: (parseInt(contactStats.new_contacts) || 0) - unsubscribes,
        totalLists: parseInt(listCount.count) || 0,
        trends: {
          totalSent: this.calculateTrend(totalSent, previousStats.totalSent),
          openRate: this.calculateTrend(openRate, previousStats.openRate),
          clickRate: this.calculateTrend(clickRate, previousStats.clickRate),
          deliveryRate: this.calculateTrend(deliveryRate, previousStats.deliveryRate),
          contacts: this.calculateTrend(parseInt(contactStats.new_contacts) || 0, previousStats.newContacts),
          unsubscribed: this.calculateTrend(unsubscribes, previousStats.unsubscribed),
          bounces: this.calculateTrend(bounces, previousStats.bounces)
        }
      };
    } catch (error) {
      console.error('Error getting overview:', error);
      throw error;
    }
  }

  async getPreviousPeriodStats(workspaceId, dateRange) {
    const { startDate, endDate } = dateRange;
    const duration = new Date(endDate) - new Date(startDate);
    const previousStart = new Date(new Date(startDate) - duration);
    const previousEnd = new Date(startDate);

    try {
      const sendStats = await this.db('email_sends')
        .join('email_campaigns', 'email_sends.campaign_id', 'email_campaigns.id')
        .where('email_campaigns.workspace_id', workspaceId)
        .whereBetween('email_sends.sent_at', [previousStart, previousEnd])
        .select(
          this.db.raw('COUNT(*) as total_sent'),
          this.db.raw("COUNT(*) FILTER (WHERE email_sends.status = 'delivered') as delivered"),
          this.db.raw("COUNT(*) FILTER (WHERE email_sends.status = 'bounced') as bounced")
        )
        .first();

      const eventStats = await this.db('email_events')
        .join('email_sends', 'email_events.send_id', 'email_sends.id')
        .join('email_campaigns', 'email_sends.campaign_id', 'email_campaigns.id')
        .where('email_campaigns.workspace_id', workspaceId)
        .whereBetween('email_events.created_at', [previousStart, previousEnd])
        .select(
          this.db.raw("COUNT(DISTINCT email_events.contact_id) FILTER (WHERE email_events.event_type = 'opened') as unique_opens"),
          this.db.raw("COUNT(DISTINCT email_events.contact_id) FILTER (WHERE email_events.event_type = 'clicked') as unique_clicks"),
          this.db.raw("COUNT(*) FILTER (WHERE email_events.event_type = 'unsubscribed') as unsubscribes")
        )
        .first();

      const contactStats = await this.db('email_contacts')
        .where({ workspace_id: workspaceId })
        .whereBetween('created_at', [previousStart, previousEnd])
        .count('id as new_contacts')
        .first();

      const delivered = parseInt(sendStats.delivered) || 0;
      const totalSent = parseInt(sendStats.total_sent) || 0;
      const opens = parseInt(eventStats.unique_opens) || 0;
      const clicks = parseInt(eventStats.unique_clicks) || 0;

      return {
        totalSent,
        delivered,
        deliveryRate: totalSent > 0 ? (delivered / totalSent) * 100 : 0,
        openRate: delivered > 0 ? (opens / delivered) * 100 : 0,
        clickRate: delivered > 0 ? (clicks / delivered) * 100 : 0,
        newContacts: parseInt(contactStats.new_contacts) || 0,
        unsubscribed: parseInt(eventStats.unsubscribes) || 0,
        bounces: parseInt(sendStats.bounced) || 0
      };
    } catch (error) {
      console.error('Error getting previous period stats:', error);
      return {
        totalSent: 0,
        openRate: 0,
        clickRate: 0,
        deliveryRate: 0,
        newContacts: 0,
        unsubscribed: 0,
        bounces: 0
      };
    }
  }

  async getVolumeChart(workspaceId, dateRange, groupBy = 'day') {
    const { startDate, endDate } = dateRange;

    try {
      // Get send data grouped by period
      const sendData = await this.db('email_sends')
        .join('email_campaigns', 'email_sends.campaign_id', 'email_campaigns.id')
        .where('email_campaigns.workspace_id', workspaceId)
        .whereBetween('email_sends.sent_at', [startDate, endDate])
        .select(
          this.db.raw(`DATE_TRUNC('${groupBy}', sent_at) as date`),
          this.db.raw('COUNT(*) as sent'),
          this.db.raw("COUNT(*) FILTER (WHERE email_sends.status = 'delivered') as delivered")
        )
        .groupBy('date')
        .orderBy('date');

      // Get event data for each period
      const result = [];
      for (const row of sendData) {
        const events = await this.db('email_events')
          .join('email_sends', 'email_events.send_id', 'email_sends.id')
          .join('email_campaigns', 'email_sends.campaign_id', 'email_campaigns.id')
          .where('email_campaigns.workspace_id', workspaceId)
          .whereRaw(`DATE_TRUNC('${groupBy}', email_events.created_at) = ?`, [row.date])
          .select(
            this.db.raw("COUNT(DISTINCT email_events.contact_id) FILTER (WHERE event_type = 'opened') as opens"),
            this.db.raw("COUNT(DISTINCT email_events.contact_id) FILTER (WHERE event_type = 'clicked') as clicks")
          )
          .first();

        result.push({
          date: row.date,
          sent: parseInt(row.sent) || 0,
          delivered: parseInt(row.delivered) || 0,
          opened: parseInt(events.opens) || 0,
          clicked: parseInt(events.clicks) || 0
        });
      }

      return result;
    } catch (error) {
      console.error('Error getting volume chart:', error);
      throw error;
    }
  }

  async getTopCampaigns(workspaceId, dateRange, limit = 5) {
    const { startDate, endDate } = dateRange;

    try {
      const campaigns = await this.db('email_campaigns')
        .where({ workspace_id: workspaceId, status: 'sent' })
        .whereBetween('completed_at', [startDate, endDate])
        .select('*')
        .limit(limit * 2); // Get more to calculate rates

      const result = [];
      for (const campaign of campaigns) {
        const stats = await this.db('email_sends')
          .where({ campaign_id: campaign.id })
          .select(
            this.db.raw('COUNT(*) as sent'),
            this.db.raw("COUNT(*) FILTER (WHERE status = 'delivered') as delivered")
          )
          .first();

        const events = await this.db('email_events')
          .where({ campaign_id: campaign.id })
          .select(
            this.db.raw("COUNT(DISTINCT contact_id) FILTER (WHERE event_type = 'opened') as opens"),
            this.db.raw("COUNT(DISTINCT contact_id) FILTER (WHERE event_type = 'clicked') as clicks")
          )
          .first();

        const delivered = parseInt(stats.delivered) || 0;
        const opens = parseInt(events.opens) || 0;
        const clicks = parseInt(events.clicks) || 0;

        result.push({
          id: campaign.id,
          name: campaign.name,
          sent: parseInt(stats.sent) || 0,
          openRate: delivered > 0 ? ((opens / delivered) * 100).toFixed(1) : 0,
          clickRate: delivered > 0 ? ((clicks / delivered) * 100).toFixed(1) : 0
        });
      }

      // Sort by open rate and return top results
      return result
        .sort((a, b) => parseFloat(b.openRate) - parseFloat(a.openRate))
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting top campaigns:', error);
      throw error;
    }
  }

  async getEngagementByHour(workspaceId, dateRange) {
    const { startDate, endDate } = dateRange;

    try {
      // Get opens by hour and day of week
      const data = await this.db('email_events')
        .join('email_sends', 'email_events.send_id', 'email_sends.id')
        .join('email_campaigns', 'email_sends.campaign_id', 'email_campaigns.id')
        .where('email_campaigns.workspace_id', workspaceId)
        .where('email_events.event_type', 'opened')
        .whereBetween('email_events.created_at', [startDate, endDate])
        .select(
          this.db.raw('EXTRACT(DOW FROM email_events.created_at) as day_of_week'),
          this.db.raw('EXTRACT(HOUR FROM email_events.created_at) as hour'),
          this.db.raw('COUNT(*) as count')
        )
        .groupBy('day_of_week', 'hour');

      // Transform into heatmap format
      const heatmap = {};
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      for (const row of data) {
        const key = `${days[row.day_of_week]}_${row.hour}`;
        heatmap[key] = parseInt(row.count) || 0;
      }

      // Find max value for normalization
      const maxCount = Math.max(...Object.values(heatmap), 1);

      // Normalize to 0-100
      const normalizedHeatmap = {};
      for (const [key, value] of Object.entries(heatmap)) {
        normalizedHeatmap[key] = Math.round((value / maxCount) * 100);
      }

      // Calculate by day summary
      const byDay = days.map((day, index) => {
        const dayOpens = data
          .filter(d => parseInt(d.day_of_week) === index)
          .reduce((sum, d) => sum + parseInt(d.count), 0);

        return {
          day,
          opens: dayOpens,
          rate: 0 // Would need total sends to calculate rate
        };
      });

      return {
        heatmap: normalizedHeatmap,
        byDay
      };
    } catch (error) {
      console.error('Error getting engagement by hour:', error);
      throw error;
    }
  }

  async getContactGrowth(workspaceId, dateRange) {
    const { startDate, endDate } = dateRange;

    try {
      const data = await this.db('email_contacts')
        .where({ workspace_id: workspaceId })
        .whereBetween('created_at', [startDate, endDate])
        .select(
          this.db.raw('DATE(created_at) as date'),
          this.db.raw("COUNT(*) FILTER (WHERE status = 'subscribed') as subscribed"),
          this.db.raw("COUNT(*) FILTER (WHERE status = 'unsubscribed') as unsubscribed")
        )
        .groupBy('date')
        .orderBy('date');

      return data.map(row => ({
        date: row.date,
        subscribed: parseInt(row.subscribed) || 0,
        unsubscribed: parseInt(row.unsubscribed) || 0
      }));
    } catch (error) {
      console.error('Error getting contact growth:', error);
      throw error;
    }
  }

  async getEngagementSegments(workspaceId) {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      // Total contacts
      const totalResult = await this.db('email_contacts')
        .where({ workspace_id: workspaceId, status: 'subscribed' })
        .count('id as count')
        .first();

      const totalContacts = parseInt(totalResult.count) || 0;

      // Highly engaged: opened in last 30 days
      const highlyEngagedResult = await this.db('email_events')
        .join('email_sends', 'email_events.send_id', 'email_sends.id')
        .join('email_campaigns', 'email_sends.campaign_id', 'email_campaigns.id')
        .where('email_campaigns.workspace_id', workspaceId)
        .where('email_events.event_type', 'opened')
        .where('email_events.created_at', '>=', thirtyDaysAgo)
        .countDistinct('email_events.contact_id as count')
        .first();

      const highlyEngaged = parseInt(highlyEngagedResult.count) || 0;

      // Engaged: opened in last 60 days but not in last 30
      const engagedResult = await this.db('email_events')
        .join('email_sends', 'email_events.send_id', 'email_sends.id')
        .join('email_campaigns', 'email_sends.campaign_id', 'email_campaigns.id')
        .where('email_campaigns.workspace_id', workspaceId)
        .where('email_events.event_type', 'opened')
        .whereBetween('email_events.created_at', [sixtyDaysAgo, thirtyDaysAgo])
        .countDistinct('email_events.contact_id as count')
        .first();

      const engaged = parseInt(engagedResult.count) || 0;

      // Inactive: no activity in 60+ days
      const inactive = Math.max(0, totalContacts - highlyEngaged - engaged);

      return {
        highlyEngaged: {
          count: highlyEngaged,
          percentage: totalContacts > 0 ? Math.round((highlyEngaged / totalContacts) * 100) : 0
        },
        engaged: {
          count: engaged,
          percentage: totalContacts > 0 ? Math.round((engaged / totalContacts) * 100) : 0
        },
        inactive: {
          count: inactive,
          percentage: totalContacts > 0 ? Math.round((inactive / totalContacts) * 100) : 0
        }
      };
    } catch (error) {
      console.error('Error getting engagement segments:', error);
      throw error;
    }
  }

  async getCampaignReport(campaignId) {
    try {
      const campaign = await this.db('email_campaigns')
        .where({ id: campaignId })
        .first();

      if (!campaign) return null;

      // Get send stats
      const sendStats = await this.db('email_sends')
        .where({ campaign_id: campaignId })
        .select(
          this.db.raw('COUNT(*) as total'),
          this.db.raw("COUNT(*) FILTER (WHERE status = 'sent') as sent"),
          this.db.raw("COUNT(*) FILTER (WHERE status = 'delivered') as delivered"),
          this.db.raw("COUNT(*) FILTER (WHERE status = 'bounced') as bounced"),
          this.db.raw("COUNT(*) FILTER (WHERE status = 'failed') as failed")
        )
        .first();

      // Get event stats
      const eventStats = await this.db('email_events')
        .where({ campaign_id: campaignId })
        .select(
          this.db.raw("COUNT(*) FILTER (WHERE event_type = 'opened') as opens"),
          this.db.raw("COUNT(DISTINCT contact_id) FILTER (WHERE event_type = 'opened') as unique_opens"),
          this.db.raw("COUNT(*) FILTER (WHERE event_type = 'clicked') as clicks"),
          this.db.raw("COUNT(DISTINCT contact_id) FILTER (WHERE event_type = 'clicked') as unique_clicks"),
          this.db.raw("COUNT(*) FILTER (WHERE event_type = 'unsubscribed') as unsubscribes")
        )
        .first();

      // Get link clicks
      const linkClicks = await this.db('email_events')
        .where({ campaign_id: campaignId, event_type: 'clicked' })
        .select('link_url')
        .count('* as clicks')
        .groupBy('link_url')
        .orderBy('clicks', 'desc')
        .limit(10);

      // Get opens by hour
      const opensByHour = await this.db('email_events')
        .where({ campaign_id: campaignId, event_type: 'opened' })
        .select(
          this.db.raw('EXTRACT(HOUR FROM created_at) as hour'),
          this.db.raw('COUNT(*) as count')
        )
        .groupBy('hour')
        .orderBy('hour');

      const delivered = parseInt(sendStats.delivered) || 0;
      const total = parseInt(sendStats.total) || 0;
      const uniqueOpens = parseInt(eventStats.unique_opens) || 0;
      const uniqueClicks = parseInt(eventStats.unique_clicks) || 0;

      return {
        campaign,
        stats: {
          total,
          sent: parseInt(sendStats.sent) || 0,
          delivered,
          bounced: parseInt(sendStats.bounced) || 0,
          failed: parseInt(sendStats.failed) || 0,
          opens: parseInt(eventStats.opens) || 0,
          uniqueOpens,
          clicks: parseInt(eventStats.clicks) || 0,
          uniqueClicks,
          unsubscribes: parseInt(eventStats.unsubscribes) || 0,
          openRate: delivered > 0 ? ((uniqueOpens / delivered) * 100).toFixed(1) : 0,
          clickRate: delivered > 0 ? ((uniqueClicks / delivered) * 100).toFixed(1) : 0,
          bounceRate: total > 0 ? ((parseInt(sendStats.bounced) / total) * 100).toFixed(1) : 0,
          unsubscribeRate: delivered > 0 ? ((parseInt(eventStats.unsubscribes) / delivered) * 100).toFixed(2) : 0
        },
        linkClicks: linkClicks.map(l => ({
          url: l.link_url,
          clicks: parseInt(l.clicks) || 0
        })),
        opensByHour: opensByHour.map(h => ({
          hour: parseInt(h.hour),
          count: parseInt(h.count) || 0
        }))
      };
    } catch (error) {
      console.error('Error getting campaign report:', error);
      throw error;
    }
  }

  async exportReport(workspaceId, dateRange, format = 'csv') {
    const data = await this.getOverview(workspaceId, dateRange);
    const campaigns = await this.getTopCampaigns(workspaceId, dateRange, 100);

    if (format === 'csv') {
      return this.generateCSV(data, campaigns);
    } else {
      return this.generatePDF(data, campaigns);
    }
  }

  generateCSV(data, campaigns) {
    const lines = [];

    // Summary
    lines.push('Email Analytics Report');
    lines.push('');
    lines.push('Summary');
    lines.push(`Total Sent,${data.totalSent}`);
    lines.push(`Delivered,${data.delivered}`);
    lines.push(`Delivery Rate,${data.deliveryRate.toFixed(1)}%`);
    lines.push(`Open Rate,${data.openRate.toFixed(1)}%`);
    lines.push(`Click Rate,${data.clickRate.toFixed(1)}%`);
    lines.push('');

    // Campaigns
    lines.push('Campaigns');
    lines.push('Name,Sent,Open Rate,Click Rate');
    for (const campaign of campaigns) {
      lines.push(`"${campaign.name}",${campaign.sent},${campaign.openRate}%,${campaign.clickRate}%`);
    }

    return lines.join('\n');
  }

  generatePDF(data, campaigns) {
    // This would generate a PDF report
    // Simplified implementation returns JSON
    return JSON.stringify({ data, campaigns }, null, 2);
  }

  calculateTrend(current, previous) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }
}

module.exports = EmailAnalyticsService;
