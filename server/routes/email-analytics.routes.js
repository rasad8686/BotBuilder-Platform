const express = require('express');
const router = express.Router();

module.exports = (db, emailAnalyticsService) => {
  // Get overview stats
  router.get('/overview', async (req, res) => {
    try {
      const workspace_id = req.query.workspace_id || req.user?.workspace_id;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate and endDate are required' });
      }

      const overview = await emailAnalyticsService.getOverview(workspace_id, {
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      });

      res.json(overview);
    } catch (error) {
      console.error('Error fetching overview:', error);
      res.status(500).json({ error: 'Failed to fetch overview' });
    }
  });

  // Get volume chart data
  router.get('/volume', async (req, res) => {
    try {
      const workspace_id = req.query.workspace_id || req.user?.workspace_id;
      const { startDate, endDate, groupBy = 'day' } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate and endDate are required' });
      }

      const volumeData = await emailAnalyticsService.getVolumeChart(
        workspace_id,
        { startDate: new Date(startDate), endDate: new Date(endDate) },
        groupBy
      );

      res.json(volumeData);
    } catch (error) {
      console.error('Error fetching volume data:', error);
      res.status(500).json({ error: 'Failed to fetch volume data' });
    }
  });

  // Get top campaigns
  router.get('/top-campaigns', async (req, res) => {
    try {
      const workspace_id = req.query.workspace_id || req.user?.workspace_id;
      const { startDate, endDate, limit = 5 } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate and endDate are required' });
      }

      const campaigns = await emailAnalyticsService.getTopCampaigns(
        workspace_id,
        { startDate: new Date(startDate), endDate: new Date(endDate) },
        parseInt(limit)
      );

      res.json(campaigns);
    } catch (error) {
      console.error('Error fetching top campaigns:', error);
      res.status(500).json({ error: 'Failed to fetch top campaigns' });
    }
  });

  // Get engagement by hour
  router.get('/engagement-by-hour', async (req, res) => {
    try {
      const workspace_id = req.query.workspace_id || req.user?.workspace_id;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate and endDate are required' });
      }

      const engagementData = await emailAnalyticsService.getEngagementByHour(
        workspace_id,
        { startDate: new Date(startDate), endDate: new Date(endDate) }
      );

      res.json(engagementData);
    } catch (error) {
      console.error('Error fetching engagement data:', error);
      res.status(500).json({ error: 'Failed to fetch engagement data' });
    }
  });

  // Get contact growth
  router.get('/contact-growth', async (req, res) => {
    try {
      const workspace_id = req.query.workspace_id || req.user?.workspace_id;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate and endDate are required' });
      }

      const growthData = await emailAnalyticsService.getContactGrowth(
        workspace_id,
        { startDate: new Date(startDate), endDate: new Date(endDate) }
      );

      res.json(growthData);
    } catch (error) {
      console.error('Error fetching contact growth:', error);
      res.status(500).json({ error: 'Failed to fetch contact growth' });
    }
  });

  // Get engagement segments
  router.get('/engagement-segments', async (req, res) => {
    try {
      const workspace_id = req.query.workspace_id || req.user?.workspace_id;

      const segments = await emailAnalyticsService.getEngagementSegments(workspace_id);

      res.json(segments);
    } catch (error) {
      console.error('Error fetching engagement segments:', error);
      res.status(500).json({ error: 'Failed to fetch engagement segments' });
    }
  });

  // Get campaign report
  router.get('/campaigns/:id/report', async (req, res) => {
    try {
      const report = await emailAnalyticsService.getCampaignReport(req.params.id);

      if (!report) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      res.json(report);
    } catch (error) {
      console.error('Error fetching campaign report:', error);
      res.status(500).json({ error: 'Failed to fetch campaign report' });
    }
  });

  // Export report
  router.get('/export', async (req, res) => {
    try {
      const workspace_id = req.query.workspace_id || req.user?.workspace_id;
      const { startDate, endDate, format = 'csv' } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate and endDate are required' });
      }

      const report = await emailAnalyticsService.exportReport(
        workspace_id,
        { startDate: new Date(startDate), endDate: new Date(endDate) },
        format
      );

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=email-analytics-report.csv');
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=email-analytics-report.json');
      }

      res.send(report);
    } catch (error) {
      console.error('Error exporting report:', error);
      res.status(500).json({ error: 'Failed to export report' });
    }
  });

  return router;
};
