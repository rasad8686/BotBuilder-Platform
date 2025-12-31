/**
 * CloneAnalytics Service Tests
 */

const CloneAnalytics = require('../../../services/clone/CloneAnalytics');

// Mock dependencies
jest.mock('../../../config/database', () => ({
  query: jest.fn()
}));

const db = require('../../../config/database');

describe('CloneAnalytics Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCloneAnalytics', () => {
    const mockClone = {
      id: 'clone-123',
      user_id: 'user-456',
      name: 'Test Clone',
      type: 'personality'
    };

    const mockMetrics = {
      total_responses: 1500,
      avg_rating: 4.2,
      avg_latency: 250,
      avg_similarity: 0.85,
      usage_rate: 0.75,
      edit_rate: 0.15
    };

    it('should return clone analytics', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [mockClone] })
        .mockResolvedValueOnce({ rows: [mockMetrics] })
        .mockResolvedValueOnce({ rows: [] }); // Time series

      const result = await CloneAnalytics.getCloneAnalytics('clone-123', 'user-456', {});

      expect(result.success).toBe(true);
      expect(result.analytics).toBeDefined();
      expect(result.analytics.totalResponses).toBe(1500);
      expect(result.analytics.avgRating).toBe(4.2);
    });

    it('should include time series data when requested', async () => {
      const timeSeries = [
        { date: '2025-01-01', responses: 100, avg_rating: 4.0 },
        { date: '2025-01-02', responses: 120, avg_rating: 4.3 }
      ];

      db.query
        .mockResolvedValueOnce({ rows: [mockClone] })
        .mockResolvedValueOnce({ rows: [mockMetrics] })
        .mockResolvedValueOnce({ rows: timeSeries });

      const result = await CloneAnalytics.getCloneAnalytics('clone-123', 'user-456', {
        includeTimeSeries: true,
        period: '7d'
      });

      expect(result.success).toBe(true);
      expect(result.analytics.timeSeries).toBeDefined();
      expect(result.analytics.timeSeries).toHaveLength(2);
    });

    it('should reject for non-owned clone', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await CloneAnalytics.getCloneAnalytics('clone-123', 'wrong-user', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle different time periods', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [mockClone] })
        .mockResolvedValueOnce({ rows: [mockMetrics] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await CloneAnalytics.getCloneAnalytics('clone-123', 'user-456', {
        period: '30d'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('getQualityMetrics', () => {
    const mockQuality = {
      accuracy: 0.88,
      relevance: 0.92,
      style_match: 0.85,
      fluency: 0.90,
      consistency: 0.87
    };

    it('should return quality metrics', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'clone-123', user_id: 'user-456' }] })
        .mockResolvedValueOnce({ rows: [mockQuality] });

      const result = await CloneAnalytics.getQualityMetrics('clone-123', 'user-456');

      expect(result.success).toBe(true);
      expect(result.quality).toBeDefined();
      expect(result.quality.accuracy).toBe(0.88);
      expect(result.quality.overallScore).toBeDefined();
    });

    it('should calculate overall score correctly', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'clone-123', user_id: 'user-456' }] })
        .mockResolvedValueOnce({ rows: [mockQuality] });

      const result = await CloneAnalytics.getQualityMetrics('clone-123', 'user-456');

      expect(result.success).toBe(true);
      // Overall score should be average of all metrics
      const expectedScore = (0.88 + 0.92 + 0.85 + 0.90 + 0.87) / 5;
      expect(result.quality.overallScore).toBeCloseTo(expectedScore, 2);
    });
  });

  describe('getTrainingProgress', () => {
    const mockProgress = {
      total_samples: 500,
      processed_samples: 350,
      current_epoch: 3,
      total_epochs: 10,
      loss: 0.25,
      accuracy: 0.82
    };

    it('should return training progress', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'clone-123', user_id: 'user-456' }] })
        .mockResolvedValueOnce({ rows: [mockProgress] });

      const result = await CloneAnalytics.getTrainingProgress('clone-123', 'user-456');

      expect(result.success).toBe(true);
      expect(result.progress).toBeDefined();
      expect(result.progress.percentComplete).toBe(70); // 350/500 * 100
      expect(result.progress.currentEpoch).toBe(3);
    });

    it('should handle clone not in training', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'clone-123', user_id: 'user-456', status: 'active' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await CloneAnalytics.getTrainingProgress('clone-123', 'user-456');

      expect(result.success).toBe(true);
      expect(result.progress.status).toBe('not_training');
    });
  });

  describe('compareClones', () => {
    const cloneA = {
      id: 'clone-a',
      user_id: 'user-456',
      name: 'Clone A',
      type: 'personality'
    };

    const cloneB = {
      id: 'clone-b',
      user_id: 'user-456',
      name: 'Clone B',
      type: 'personality'
    };

    const metricsA = { avg_rating: 4.2, avg_latency: 200, total_responses: 1000 };
    const metricsB = { avg_rating: 3.8, avg_latency: 300, total_responses: 800 };

    it('should compare two clones', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [cloneA] })
        .mockResolvedValueOnce({ rows: [cloneB] })
        .mockResolvedValueOnce({ rows: [metricsA] })
        .mockResolvedValueOnce({ rows: [metricsB] });

      const result = await CloneAnalytics.compareClones('clone-a', 'clone-b', 'user-456');

      expect(result.success).toBe(true);
      expect(result.comparison).toBeDefined();
      expect(result.comparison.cloneA.name).toBe('Clone A');
      expect(result.comparison.cloneB.name).toBe('Clone B');
      expect(result.comparison.differences).toBeDefined();
    });

    it('should calculate differences correctly', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [cloneA] })
        .mockResolvedValueOnce({ rows: [cloneB] })
        .mockResolvedValueOnce({ rows: [metricsA] })
        .mockResolvedValueOnce({ rows: [metricsB] });

      const result = await CloneAnalytics.compareClones('clone-a', 'clone-b', 'user-456');

      expect(result.success).toBe(true);
      expect(result.comparison.differences.rating).toBeCloseTo(0.4, 2);
      expect(result.comparison.winner).toBe('clone-a');
    });

    it('should reject comparing clones of different types', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [cloneA] })
        .mockResolvedValueOnce({ rows: [{ ...cloneB, type: 'voice' }] });

      const result = await CloneAnalytics.compareClones('clone-a', 'clone-b', 'user-456');

      expect(result.success).toBe(false);
      expect(result.error).toContain('same type');
    });

    it('should reject comparing non-owned clone', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [cloneA] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await CloneAnalytics.compareClones('clone-a', 'clone-b', 'user-456');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('getDashboardStats', () => {
    const mockStats = {
      total_clones: 5,
      active_clones: 3,
      total_responses: 5000,
      avg_rating: 4.1
    };

    it('should return dashboard statistics', async () => {
      db.query.mockResolvedValueOnce({ rows: [mockStats] });

      const result = await CloneAnalytics.getDashboardStats('user-456');

      expect(result.success).toBe(true);
      expect(result.stats).toBeDefined();
      expect(result.stats.totalClones).toBe(5);
      expect(result.stats.activeClones).toBe(3);
    });

    it('should include top performing clones', async () => {
      const topClones = [
        { id: 'clone-1', name: 'Top Clone', avg_rating: 4.8 },
        { id: 'clone-2', name: 'Second Clone', avg_rating: 4.5 }
      ];

      db.query
        .mockResolvedValueOnce({ rows: [mockStats] })
        .mockResolvedValueOnce({ rows: topClones });

      const result = await CloneAnalytics.getDashboardStats('user-456', { includeTopClones: true });

      expect(result.success).toBe(true);
      expect(result.stats.topClones).toBeDefined();
      expect(result.stats.topClones).toHaveLength(2);
    });
  });

  describe('recordUsage', () => {
    it('should record usage event', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'usage-1' }] });

      const result = await CloneAnalytics.recordUsage('clone-123', {
        responseTime: 250,
        rating: 4,
        similarity: 0.85,
        tokensUsed: 150
      });

      expect(result.success).toBe(true);
      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['clone-123', 250, 4, 0.85, 150])
      );
    });

    it('should handle partial usage data', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'usage-2' }] });

      const result = await CloneAnalytics.recordUsage('clone-123', {
        responseTime: 200
      });

      expect(result.success).toBe(true);
    });
  });

  describe('getUsageTrends', () => {
    it('should return usage trends', async () => {
      const trends = [
        { period: '2025-W01', total_responses: 500, avg_rating: 4.0 },
        { period: '2025-W02', total_responses: 600, avg_rating: 4.2 },
        { period: '2025-W03', total_responses: 700, avg_rating: 4.3 }
      ];

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'clone-123', user_id: 'user-456' }] })
        .mockResolvedValueOnce({ rows: trends });

      const result = await CloneAnalytics.getUsageTrends('clone-123', 'user-456', {
        granularity: 'week',
        periods: 4
      });

      expect(result.success).toBe(true);
      expect(result.trends).toHaveLength(3);
      expect(result.trends[2].growth).toBeDefined();
    });
  });
});
