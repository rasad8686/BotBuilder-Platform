const request = require('supertest');
const express = require('express');
const emailAnalyticsRoutes = require('../../routes/email-analytics.routes');

describe('Email Analytics Routes', () => {
  let app;
  let mockDb;
  let mockAnalyticsService;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Mock database
    mockDb = jest.fn().mockReturnThis();
    mockDb.where = jest.fn().mockReturnThis();
    mockDb.andWhere = jest.fn().mockReturnThis();
    mockDb.first = jest.fn();
    mockDb.select = jest.fn().mockReturnThis();

    // Mock analytics service
    mockAnalyticsService = {
      getOverview: jest.fn(),
      getVolumeChart: jest.fn(),
      getTopCampaigns: jest.fn(),
      getEngagementByHour: jest.fn(),
      getContactGrowth: jest.fn(),
      getEngagementSegments: jest.fn(),
      getCampaignReport: jest.fn(),
      exportReport: jest.fn()
    };

    // Mock user middleware
    app.use((req, res, next) => {
      req.user = { id: 'user-1', workspace_id: 'workspace-1' };
      next();
    });

    // Mount routes
    const router = emailAnalyticsRoutes(mockDb, mockAnalyticsService);
    app.use('/api/email/analytics', router);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/email/analytics/overview', () => {
    it('should return overview stats', async () => {
      const mockOverview = {
        sent: { value: 1000, change: 10 },
        delivered: { value: 950, change: 8 },
        opened: { value: 400, change: 15 },
        clicked: { value: 100, change: 5 },
        openRate: 42.1,
        clickRate: 10.5
      };

      mockAnalyticsService.getOverview.mockResolvedValue(mockOverview);

      const response = await request(app)
        .get('/api/email/analytics/overview')
        .query({
          startDate: '2024-01-01T00:00:00.000Z',
          endDate: '2024-01-31T23:59:59.999Z'
        })
        .expect(200);

      expect(response.body).toEqual(mockOverview);
      expect(mockAnalyticsService.getOverview).toHaveBeenCalled();
    });

    it('should return 400 if date range is missing', async () => {
      const response = await request(app)
        .get('/api/email/analytics/overview')
        .expect(400);

      expect(response.body.error).toBe('startDate and endDate are required');
    });

    it('should handle errors', async () => {
      mockAnalyticsService.getOverview.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/api/email/analytics/overview')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch overview');
    });
  });

  describe('GET /api/email/analytics/volume', () => {
    it('should return volume chart data', async () => {
      const mockVolumeData = [
        { date: '2024-01-01', sent: 100, delivered: 95, opened: 40 },
        { date: '2024-01-02', sent: 150, delivered: 142, opened: 60 }
      ];

      mockAnalyticsService.getVolumeChart.mockResolvedValue(mockVolumeData);

      const response = await request(app)
        .get('/api/email/analytics/volume')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          groupBy: 'day'
        })
        .expect(200);

      expect(response.body).toEqual(mockVolumeData);
    });

    it('should use default groupBy value', async () => {
      mockAnalyticsService.getVolumeChart.mockResolvedValue([]);

      await request(app)
        .get('/api/email/analytics/volume')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
        .expect(200);

      expect(mockAnalyticsService.getVolumeChart).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'day'
      );
    });

    it('should return 400 if date range is missing', async () => {
      const response = await request(app)
        .get('/api/email/analytics/volume')
        .expect(400);

      expect(response.body.error).toBe('startDate and endDate are required');
    });
  });

  describe('GET /api/email/analytics/top-campaigns', () => {
    it('should return top campaigns', async () => {
      const mockCampaigns = [
        { id: 'c1', name: 'Welcome', openRate: 45 },
        { id: 'c2', name: 'Newsletter', openRate: 40 }
      ];

      mockAnalyticsService.getTopCampaigns.mockResolvedValue(mockCampaigns);

      const response = await request(app)
        .get('/api/email/analytics/top-campaigns')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          limit: 5
        })
        .expect(200);

      expect(response.body).toEqual(mockCampaigns);
      expect(mockAnalyticsService.getTopCampaigns).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        5
      );
    });

    it('should use default limit value', async () => {
      mockAnalyticsService.getTopCampaigns.mockResolvedValue([]);

      await request(app)
        .get('/api/email/analytics/top-campaigns')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
        .expect(200);

      expect(mockAnalyticsService.getTopCampaigns).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        5
      );
    });
  });

  describe('GET /api/email/analytics/engagement-by-hour', () => {
    it('should return engagement by hour data', async () => {
      const mockData = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        opens: Math.floor(Math.random() * 100),
        clicks: Math.floor(Math.random() * 30)
      }));

      mockAnalyticsService.getEngagementByHour.mockResolvedValue(mockData);

      const response = await request(app)
        .get('/api/email/analytics/engagement-by-hour')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
        .expect(200);

      expect(response.body).toHaveLength(24);
    });

    it('should return 400 if date range is missing', async () => {
      const response = await request(app)
        .get('/api/email/analytics/engagement-by-hour')
        .expect(400);

      expect(response.body.error).toBe('startDate and endDate are required');
    });
  });

  describe('GET /api/email/analytics/contact-growth', () => {
    it('should return contact growth data', async () => {
      const mockData = [
        { date: '2024-01-01', subscribed: 10, unsubscribed: 2 },
        { date: '2024-01-02', subscribed: 15, unsubscribed: 1 }
      ];

      mockAnalyticsService.getContactGrowth.mockResolvedValue(mockData);

      const response = await request(app)
        .get('/api/email/analytics/contact-growth')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
        .expect(200);

      expect(response.body).toEqual(mockData);
    });

    it('should return 400 if date range is missing', async () => {
      const response = await request(app)
        .get('/api/email/analytics/contact-growth')
        .expect(400);

      expect(response.body.error).toBe('startDate and endDate are required');
    });
  });

  describe('GET /api/email/analytics/engagement-segments', () => {
    it('should return engagement segments', async () => {
      const mockSegments = [
        { segment: 'Highly Engaged', count: 500, percentage: 25 },
        { segment: 'Engaged', count: 800, percentage: 40 },
        { segment: 'Inactive', count: 700, percentage: 35 }
      ];

      mockAnalyticsService.getEngagementSegments.mockResolvedValue(mockSegments);

      const response = await request(app)
        .get('/api/email/analytics/engagement-segments')
        .expect(200);

      expect(response.body).toEqual(mockSegments);
    });

    it('should not require date range', async () => {
      mockAnalyticsService.getEngagementSegments.mockResolvedValue([]);

      await request(app)
        .get('/api/email/analytics/engagement-segments')
        .expect(200);

      expect(mockAnalyticsService.getEngagementSegments).toHaveBeenCalled();
    });
  });

  describe('GET /api/email/analytics/campaigns/:id/report', () => {
    it('should return campaign report', async () => {
      const mockReport = {
        campaign: { id: 'c1', name: 'Test Campaign' },
        stats: { sent: 1000, opened: 400, clicked: 100 },
        topLinks: [{ url: 'https://example.com', clicks: 50 }]
      };

      mockAnalyticsService.getCampaignReport.mockResolvedValue(mockReport);

      const response = await request(app)
        .get('/api/email/analytics/campaigns/c1/report')
        .expect(200);

      expect(response.body).toEqual(mockReport);
    });

    it('should return 404 for non-existent campaign', async () => {
      mockAnalyticsService.getCampaignReport.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/email/analytics/campaigns/non-existent/report')
        .expect(404);

      expect(response.body.error).toBe('Campaign not found');
    });
  });

  describe('GET /api/email/analytics/export', () => {
    it('should export report as CSV', async () => {
      const mockCsv = 'name,sent,opened,clicked\nCampaign 1,1000,400,100';

      mockAnalyticsService.exportReport.mockResolvedValue(mockCsv);

      const response = await request(app)
        .get('/api/email/analytics/export')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          format: 'csv'
        })
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('email-analytics-report.csv');
      expect(response.text).toBe(mockCsv);
    });

    it('should export report as JSON', async () => {
      const mockJson = JSON.stringify([{ name: 'Campaign 1', sent: 1000 }]);

      mockAnalyticsService.exportReport.mockResolvedValue(mockJson);

      const response = await request(app)
        .get('/api/email/analytics/export')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          format: 'json'
        })
        .expect(200);

      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['content-disposition']).toContain('email-analytics-report.json');
    });

    it('should use default format (csv)', async () => {
      mockAnalyticsService.exportReport.mockResolvedValue('');

      await request(app)
        .get('/api/email/analytics/export')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
        .expect(200);

      expect(mockAnalyticsService.exportReport).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'csv'
      );
    });

    it('should return 400 if date range is missing', async () => {
      const response = await request(app)
        .get('/api/email/analytics/export')
        .expect(400);

      expect(response.body.error).toBe('startDate and endDate are required');
    });
  });

  describe('Workspace ID handling', () => {
    it('should use workspace_id from query if provided', async () => {
      mockAnalyticsService.getEngagementSegments.mockResolvedValue([]);

      await request(app)
        .get('/api/email/analytics/engagement-segments')
        .query({ workspace_id: 'custom-workspace' })
        .expect(200);

      expect(mockAnalyticsService.getEngagementSegments).toHaveBeenCalledWith('custom-workspace');
    });

    it('should use workspace_id from user if not in query', async () => {
      mockAnalyticsService.getEngagementSegments.mockResolvedValue([]);

      await request(app)
        .get('/api/email/analytics/engagement-segments')
        .expect(200);

      expect(mockAnalyticsService.getEngagementSegments).toHaveBeenCalledWith('workspace-1');
    });
  });

  describe('Error handling', () => {
    it('should handle service errors gracefully', async () => {
      mockAnalyticsService.getOverview.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/email/analytics/overview')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch overview');
    });

    it('should log errors to console', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockAnalyticsService.getOverview.mockRejectedValue(new Error('Test error'));

      await request(app)
        .get('/api/email/analytics/overview')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
        .expect(500);

      expect(consoleSpy).toHaveBeenCalledWith('Error fetching overview:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});
