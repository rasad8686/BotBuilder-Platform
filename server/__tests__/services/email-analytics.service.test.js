const EmailAnalyticsService = require('../../services/email-analytics.service');

describe('EmailAnalyticsService', () => {
  let service;
  let mockDb;
  let mockCacheService;

  beforeEach(() => {
    // Mock database
    mockDb = jest.fn().mockReturnThis();
    mockDb.where = jest.fn().mockReturnThis();
    mockDb.andWhere = jest.fn().mockReturnThis();
    mockDb.whereBetween = jest.fn().mockReturnThis();
    mockDb.first = jest.fn();
    mockDb.select = jest.fn().mockReturnThis();
    mockDb.orderBy = jest.fn().mockReturnThis();
    mockDb.groupBy = jest.fn().mockReturnThis();
    mockDb.limit = jest.fn().mockReturnThis();
    mockDb.raw = jest.fn((sql) => ({ sql }));
    mockDb.join = jest.fn().mockReturnThis();
    mockDb.leftJoin = jest.fn().mockReturnThis();
    mockDb.count = jest.fn().mockReturnThis();
    mockDb.sum = jest.fn().mockReturnThis();
    mockDb.avg = jest.fn().mockReturnThis();

    // Mock cache service
    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn()
    };

    service = new EmailAnalyticsService(mockDb, mockCacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with dependencies', () => {
      expect(service.db).toBe(mockDb);
      expect(service.cacheService).toBe(mockCacheService);
    });
  });

  describe('getOverview', () => {
    const workspaceId = 'workspace-1';
    const dateRange = {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31')
    };

    it('should return overview statistics', async () => {
      const mockCurrentStats = {
        total_sent: '1000',
        total_delivered: '950',
        total_opened: '400',
        total_clicked: '100',
        total_bounced: '30',
        total_unsubscribed: '20'
      };

      const mockPreviousStats = {
        total_sent: '800',
        total_delivered: '760',
        total_opened: '320',
        total_clicked: '80',
        total_bounced: '25',
        total_unsubscribed: '15'
      };

      mockDb.first.mockResolvedValueOnce(mockCurrentStats);
      mockDb.first.mockResolvedValueOnce(mockPreviousStats);

      const result = await service.getOverview(workspaceId, dateRange);

      expect(result).toHaveProperty('sent');
      expect(result).toHaveProperty('delivered');
      expect(result).toHaveProperty('opened');
      expect(result).toHaveProperty('clicked');
      expect(result).toHaveProperty('bounced');
      expect(result).toHaveProperty('unsubscribed');
      expect(result).toHaveProperty('openRate');
      expect(result).toHaveProperty('clickRate');
    });

    it('should calculate percentage changes correctly', async () => {
      const mockCurrentStats = {
        total_sent: '1000',
        total_delivered: '950',
        total_opened: '400',
        total_clicked: '100',
        total_bounced: '30',
        total_unsubscribed: '20'
      };

      const mockPreviousStats = {
        total_sent: '500', // 100% increase
        total_delivered: '475',
        total_opened: '200',
        total_clicked: '50',
        total_bounced: '15',
        total_unsubscribed: '10'
      };

      mockDb.first.mockResolvedValueOnce(mockCurrentStats);
      mockDb.first.mockResolvedValueOnce(mockPreviousStats);

      const result = await service.getOverview(workspaceId, dateRange);

      expect(result.sent.change).toBe(100); // 100% increase
    });

    it('should handle zero previous values', async () => {
      const mockCurrentStats = {
        total_sent: '1000',
        total_delivered: '950',
        total_opened: '400',
        total_clicked: '100',
        total_bounced: '30',
        total_unsubscribed: '20'
      };

      const mockPreviousStats = {
        total_sent: '0',
        total_delivered: '0',
        total_opened: '0',
        total_clicked: '0',
        total_bounced: '0',
        total_unsubscribed: '0'
      };

      mockDb.first.mockResolvedValueOnce(mockCurrentStats);
      mockDb.first.mockResolvedValueOnce(mockPreviousStats);

      const result = await service.getOverview(workspaceId, dateRange);

      expect(result.sent.value).toBe(1000);
    });
  });

  describe('getVolumeChart', () => {
    const workspaceId = 'workspace-1';
    const dateRange = {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-07')
    };

    it('should return volume data grouped by day', async () => {
      const mockData = [
        { date: '2024-01-01', sent: 100, delivered: 95, opened: 40 },
        { date: '2024-01-02', sent: 150, delivered: 142, opened: 60 },
        { date: '2024-01-03', sent: 200, delivered: 190, opened: 80 }
      ];

      mockDb.select.mockResolvedValue(mockData);

      const result = await service.getVolumeChart(workspaceId, dateRange, 'day');

      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('sent');
      expect(result[0]).toHaveProperty('delivered');
    });

    it('should support different grouping options', async () => {
      const mockData = [
        { date: '2024-W01', sent: 700, delivered: 665, opened: 280 },
        { date: '2024-W02', sent: 800, delivered: 760, opened: 320 }
      ];

      mockDb.select.mockResolvedValue(mockData);

      const result = await service.getVolumeChart(workspaceId, dateRange, 'week');

      expect(mockDb.groupBy).toHaveBeenCalled();
    });
  });

  describe('getTopCampaigns', () => {
    const workspaceId = 'workspace-1';
    const dateRange = {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31')
    };

    it('should return top campaigns by engagement', async () => {
      const mockCampaigns = [
        { id: 'c1', name: 'Welcome Email', sent: 1000, opened: 450, clicked: 150, openRate: 45, clickRate: 15 },
        { id: 'c2', name: 'Newsletter', sent: 2000, opened: 800, clicked: 200, openRate: 40, clickRate: 10 },
        { id: 'c3', name: 'Promo', sent: 1500, opened: 600, clicked: 180, openRate: 40, clickRate: 12 }
      ];

      mockDb.select.mockResolvedValue(mockCampaigns);

      const result = await service.getTopCampaigns(workspaceId, dateRange, 5);

      expect(result).toHaveLength(3);
      expect(mockDb.limit).toHaveBeenCalledWith(5);
    });

    it('should order by engagement score', async () => {
      const mockCampaigns = [];
      mockDb.select.mockResolvedValue(mockCampaigns);

      await service.getTopCampaigns(workspaceId, dateRange, 5);

      expect(mockDb.orderBy).toHaveBeenCalled();
    });
  });

  describe('getEngagementByHour', () => {
    const workspaceId = 'workspace-1';
    const dateRange = {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31')
    };

    it('should return engagement data grouped by hour', async () => {
      const mockData = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        opens: Math.floor(Math.random() * 100),
        clicks: Math.floor(Math.random() * 30)
      }));

      mockDb.select.mockResolvedValue(mockData);

      const result = await service.getEngagementByHour(workspaceId, dateRange);

      expect(result).toHaveLength(24);
      expect(result[0]).toHaveProperty('hour');
      expect(result[0]).toHaveProperty('opens');
      expect(result[0]).toHaveProperty('clicks');
    });

    it('should fill missing hours with zeros', async () => {
      const mockData = [
        { hour: 9, opens: 50, clicks: 20 },
        { hour: 14, opens: 80, clicks: 30 }
      ];

      mockDb.select.mockResolvedValue(mockData);

      const result = await service.getEngagementByHour(workspaceId, dateRange);

      // Should have all 24 hours
      expect(result).toHaveLength(24);
      expect(result[0].opens).toBe(0);
      expect(result[9].opens).toBe(50);
    });
  });

  describe('getContactGrowth', () => {
    const workspaceId = 'workspace-1';
    const dateRange = {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31')
    };

    it('should return contact growth data', async () => {
      const mockData = [
        { date: '2024-01-01', subscribed: 10, unsubscribed: 2, netGrowth: 8 },
        { date: '2024-01-02', subscribed: 15, unsubscribed: 1, netGrowth: 14 },
        { date: '2024-01-03', subscribed: 20, unsubscribed: 3, netGrowth: 17 }
      ];

      mockDb.select.mockResolvedValue(mockData);

      const result = await service.getContactGrowth(workspaceId, dateRange);

      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty('subscribed');
      expect(result[0]).toHaveProperty('unsubscribed');
      expect(result[0]).toHaveProperty('netGrowth');
    });
  });

  describe('getEngagementSegments', () => {
    const workspaceId = 'workspace-1';

    it('should return engagement segment breakdown', async () => {
      const mockSegments = [
        { segment: 'Highly Engaged', count: 500, percentage: 25 },
        { segment: 'Engaged', count: 800, percentage: 40 },
        { segment: 'Somewhat Engaged', count: 400, percentage: 20 },
        { segment: 'Inactive', count: 300, percentage: 15 }
      ];

      mockDb.select.mockResolvedValue(mockSegments);

      const result = await service.getEngagementSegments(workspaceId);

      expect(result).toHaveLength(4);
      expect(result[0]).toHaveProperty('segment');
      expect(result[0]).toHaveProperty('count');
      expect(result[0]).toHaveProperty('percentage');
    });

    it('should calculate percentages correctly', async () => {
      const mockContacts = [
        { engagement_score: 90 },
        { engagement_score: 75 },
        { engagement_score: 50 },
        { engagement_score: 20 }
      ];

      mockDb.select.mockResolvedValue(mockContacts);

      const result = await service.getEngagementSegments(workspaceId);

      const totalPercentage = result.reduce((sum, s) => sum + s.percentage, 0);
      expect(totalPercentage).toBe(100);
    });
  });

  describe('getCampaignReport', () => {
    const campaignId = 'campaign-1';

    it('should return detailed campaign report', async () => {
      const mockCampaign = {
        id: campaignId,
        name: 'Test Campaign',
        subject: 'Test Subject',
        status: 'sent',
        sent_at: new Date('2024-01-15')
      };

      const mockStats = {
        total_sent: '1000',
        total_delivered: '950',
        total_opened: '400',
        unique_opens: '350',
        total_clicked: '100',
        unique_clicks: '90',
        total_bounced: '30',
        hard_bounces: '10',
        soft_bounces: '20',
        total_unsubscribed: '5',
        total_complaints: '2'
      };

      const mockTopLinks = [
        { url: 'https://example.com/page1', clicks: 50 },
        { url: 'https://example.com/page2', clicks: 30 }
      ];

      mockDb.first.mockResolvedValueOnce(mockCampaign);
      mockDb.first.mockResolvedValueOnce(mockStats);
      mockDb.select.mockResolvedValue(mockTopLinks);

      const result = await service.getCampaignReport(campaignId);

      expect(result).toHaveProperty('campaign');
      expect(result).toHaveProperty('stats');
      expect(result).toHaveProperty('topLinks');
      expect(result.stats.openRate).toBeDefined();
      expect(result.stats.clickRate).toBeDefined();
    });

    it('should return null for non-existent campaign', async () => {
      mockDb.first.mockResolvedValue(null);

      const result = await service.getCampaignReport('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('exportReport', () => {
    const workspaceId = 'workspace-1';
    const dateRange = {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31')
    };

    it('should export report as CSV', async () => {
      const mockCampaigns = [
        { id: 'c1', name: 'Campaign 1', sent: 1000, delivered: 950, opened: 400, clicked: 100 },
        { id: 'c2', name: 'Campaign 2', sent: 2000, delivered: 1900, opened: 800, clicked: 200 }
      ];

      mockDb.select.mockResolvedValue(mockCampaigns);

      const result = await service.exportReport(workspaceId, dateRange, 'csv');

      expect(typeof result).toBe('string');
      expect(result).toContain('Campaign 1');
      expect(result).toContain('Campaign 2');
    });

    it('should export report as JSON', async () => {
      const mockCampaigns = [
        { id: 'c1', name: 'Campaign 1', sent: 1000, delivered: 950, opened: 400, clicked: 100 }
      ];

      mockDb.select.mockResolvedValue(mockCampaigns);

      const result = await service.exportReport(workspaceId, dateRange, 'json');

      const parsed = JSON.parse(result);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0]).toHaveProperty('name', 'Campaign 1');
    });
  });

  describe('calculateOpenRate', () => {
    it('should calculate open rate correctly', () => {
      const result = service.calculateOpenRate(400, 1000);
      expect(result).toBe(40);
    });

    it('should return 0 for zero sent emails', () => {
      const result = service.calculateOpenRate(0, 0);
      expect(result).toBe(0);
    });

    it('should round to 2 decimal places', () => {
      const result = service.calculateOpenRate(333, 1000);
      expect(result).toBe(33.3);
    });
  });

  describe('calculateClickRate', () => {
    it('should calculate click rate correctly', () => {
      const result = service.calculateClickRate(100, 1000);
      expect(result).toBe(10);
    });

    it('should return 0 for zero sent emails', () => {
      const result = service.calculateClickRate(0, 0);
      expect(result).toBe(0);
    });
  });

  describe('calculatePercentageChange', () => {
    it('should calculate positive change', () => {
      const result = service.calculatePercentageChange(1000, 500);
      expect(result).toBe(100); // 100% increase
    });

    it('should calculate negative change', () => {
      const result = service.calculatePercentageChange(500, 1000);
      expect(result).toBe(-50); // 50% decrease
    });

    it('should return 0 for zero previous value', () => {
      const result = service.calculatePercentageChange(100, 0);
      expect(result).toBe(0);
    });
  });

  describe('caching', () => {
    it('should use cached data when available', async () => {
      const cachedData = { sent: { value: 1000 } };
      mockCacheService.get.mockResolvedValue(cachedData);

      const result = await service.getOverview('workspace-1', {
        startDate: new Date(),
        endDate: new Date()
      });

      expect(result).toEqual(cachedData);
      expect(mockDb.first).not.toHaveBeenCalled();
    });

    it('should cache computed results', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockDb.first.mockResolvedValue({
        total_sent: '1000',
        total_delivered: '950',
        total_opened: '400',
        total_clicked: '100',
        total_bounced: '30',
        total_unsubscribed: '20'
      });

      await service.getOverview('workspace-1', {
        startDate: new Date(),
        endDate: new Date()
      });

      expect(mockCacheService.set).toHaveBeenCalled();
    });
  });
});
