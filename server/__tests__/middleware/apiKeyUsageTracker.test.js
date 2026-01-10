/**
 * API Key Usage Tracker Middleware Tests
 */

// Mock dependencies
jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../db');
const {
  apiKeyUsageTracker,
  authenticateApiToken,
  getTokenUsageStats,
  verifyApiToken
} = require('../../middleware/apiKeyUsageTracker');

describe('API Key Usage Tracker Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();

    mockReq = {
      headers: {},
      method: 'GET',
      url: '/api/test',
      originalUrl: '/api/test',
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' }
    };

    mockRes = {
      statusCode: 200,
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      end: jest.fn(),
      locals: {}
    };

    mockNext = jest.fn();
  });

  describe('verifyApiToken', () => {
    it('should return token record for valid token', async () => {
      const mockToken = {
        id: 1,
        organization_id: 100,
        bot_id: null,
        is_active: true,
        expires_at: null
      };

      db.query.mockResolvedValueOnce({ rows: [mockToken] });

      const result = await verifyApiToken('test-token-123');

      expect(result).toEqual(mockToken);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id'),
        expect.any(Array)
      );
    });

    it('should return null for non-existent token', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await verifyApiToken('invalid-token');

      expect(result).toBeNull();
    });

    it('should return null for inactive token', async () => {
      const mockToken = {
        id: 1,
        is_active: false,
        expires_at: null
      };

      db.query.mockResolvedValueOnce({ rows: [mockToken] });

      const result = await verifyApiToken('inactive-token');

      expect(result).toBeNull();
    });

    it('should return null for expired token', async () => {
      const mockToken = {
        id: 1,
        is_active: true,
        expires_at: new Date(Date.now() - 86400000) // Expired yesterday
      };

      db.query.mockResolvedValueOnce({ rows: [mockToken] });

      const result = await verifyApiToken('expired-token');

      expect(result).toBeNull();
    });
  });

  describe('apiKeyUsageTracker', () => {
    it('should skip tracking for requests without API token', async () => {
      await apiKeyUsageTracker(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should authenticate valid API token', async () => {
      mockReq.headers['authorization'] = 'Bearer valid-token-123';

      const mockToken = {
        id: 1,
        organization_id: 100,
        bot_id: null,
        is_active: true,
        expires_at: null
      };

      db.query.mockResolvedValueOnce({ rows: [mockToken] });

      await apiKeyUsageTracker(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.apiToken).toEqual(mockToken);
    });

    it('should reject invalid API token', async () => {
      mockReq.headers['authorization'] = 'Bearer invalid-token';

      db.query.mockResolvedValueOnce({ rows: [] });

      await apiKeyUsageTracker(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid or expired API token'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('authenticateApiToken', () => {
    it('should require API token', async () => {
      await authenticateApiToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('API token required')
      });
    });

    it('should authenticate and set user context', async () => {
      mockReq.headers['authorization'] = 'Bearer valid-token';

      const mockToken = {
        id: 1,
        organization_id: 100,
        is_active: true,
        expires_at: null
      };

      db.query.mockResolvedValueOnce({ rows: [mockToken] });

      await authenticateApiToken(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.organization_id).toBe(100);
      expect(mockReq.organization).toBeDefined();
      expect(mockReq.organization.id).toBe(100);
    });
  });

  describe('getTokenUsageStats', () => {
    const tokenId = 1;

    beforeEach(() => {
      // Mock summary stats
      db.query.mockResolvedValueOnce({
        rows: [{
          total_requests: '100',
          avg_response_time: '150.5',
          total_tokens: '5000',
          total_cost: '0.25',
          successful_requests: '95',
          failed_requests: '5'
        }]
      });

      // Mock time series
      db.query.mockResolvedValueOnce({
        rows: [
          { period: new Date('2025-01-01'), requests: '50', avg_response_time: '140', tokens_used: '2500', cost: '0.12' },
          { period: new Date('2025-01-02'), requests: '50', avg_response_time: '160', tokens_used: '2500', cost: '0.13' }
        ]
      });

      // Mock top endpoints
      db.query.mockResolvedValueOnce({
        rows: [
          { endpoint: '/api/chat', method: 'POST', request_count: '60', avg_response_time: '200' },
          { endpoint: '/api/bots', method: 'GET', request_count: '40', avg_response_time: '50' }
        ]
      });

      // Mock status distribution
      db.query.mockResolvedValueOnce({
        rows: [
          { status_code: 200, count: '90' },
          { status_code: 400, count: '5' },
          { status_code: 500, count: '5' }
        ]
      });
    });

    it('should return usage statistics', async () => {
      const result = await getTokenUsageStats(tokenId, { period: '30d', groupBy: 'day' });

      expect(result.summary).toBeDefined();
      expect(result.summary.totalRequests).toBe(100);
      expect(result.summary.avgResponseTime).toBe(151);
      expect(result.summary.successRate).toBe(95);
    });

    it('should return time series data', async () => {
      const result = await getTokenUsageStats(tokenId, { period: '7d', groupBy: 'day' });

      expect(result.timeSeries).toBeDefined();
      expect(result.timeSeries).toHaveLength(2);
      expect(result.timeSeries[0].requests).toBe(50);
    });

    it('should return top endpoints', async () => {
      const result = await getTokenUsageStats(tokenId, { period: '30d' });

      expect(result.topEndpoints).toBeDefined();
      expect(result.topEndpoints).toHaveLength(2);
      expect(result.topEndpoints[0].endpoint).toBe('/api/chat');
    });

    it('should return status distribution', async () => {
      const result = await getTokenUsageStats(tokenId, { period: '30d' });

      expect(result.statusDistribution).toBeDefined();
      expect(result.statusDistribution).toHaveLength(3);
    });

    it('should handle different periods', async () => {
      // Reset mocks for fresh calls
      db.query.mockReset();

      // Setup mocks again with empty results
      db.query.mockResolvedValue({ rows: [] });

      await getTokenUsageStats(tokenId, { period: '24h' });
      expect(db.query).toHaveBeenCalled();

      db.query.mockClear();
      db.query.mockResolvedValue({ rows: [] });

      await getTokenUsageStats(tokenId, { period: '90d' });
      expect(db.query).toHaveBeenCalled();
    });

    it('should handle different groupBy options', async () => {
      db.query.mockReset();
      db.query.mockResolvedValue({ rows: [] });

      await getTokenUsageStats(tokenId, { groupBy: 'hour' });
      expect(db.query).toHaveBeenCalled();

      db.query.mockClear();
      db.query.mockResolvedValue({ rows: [] });

      await getTokenUsageStats(tokenId, { groupBy: 'week' });
      expect(db.query).toHaveBeenCalled();
    });
  });
});

describe('API Key Usage - Integration Scenarios', () => {
  describe('Usage data recording', () => {
    it('should record usage with all fields', async () => {
      const { recordUsage } = require('../../middleware/apiKeyUsageTracker');

      db.query.mockResolvedValue({ rows: [] });

      await recordUsage({
        api_token_id: 1,
        endpoint: '/api/chat',
        method: 'POST',
        status_code: 200,
        response_time_ms: 150,
        tokens_used: 100,
        cost_usd: 0.002,
        ip_address: '192.168.1.1',
        user_agent: 'Test/1.0'
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO api_key_usage'),
        expect.arrayContaining([1, '/api/chat', 'POST', 200, 150, 100, 0.002, '192.168.1.1', 'Test/1.0'])
      );
    });

    it('should handle partial usage data', async () => {
      const { recordUsage } = require('../../middleware/apiKeyUsageTracker');

      db.query.mockResolvedValue({ rows: [] });

      await recordUsage({
        api_token_id: 1,
        endpoint: '/api/test',
        method: 'GET',
        status_code: 200,
        response_time_ms: 50
      });

      expect(db.query).toHaveBeenCalled();
    });
  });

  describe('Token validation edge cases', () => {
    it('should handle database errors gracefully', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const result = await verifyApiToken('test-token');

      expect(result).toBeNull();
    });

    it('should validate token that expires in the future', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 30); // 30 days from now
      const mockToken = {
        id: 1,
        is_active: true,
        expires_at: futureDate
      };

      db.query.mockResolvedValueOnce({ rows: [mockToken] });

      const result = await verifyApiToken('valid-future-token');

      expect(result).toEqual(mockToken);
    });
  });
});
