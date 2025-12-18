/**
 * A/B Test Service Tests
 * Tests for A/B testing: create, start, stop, record results, calculate winner
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../db');
const abTestService = require('../../services/abTestService');

describe('A/B Test Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // CREATE A/B TEST
  // ========================================
  describe('createABTest()', () => {
    it('should create a new A/B test', async () => {
      const mockTest = {
        id: 1,
        name: 'Model Comparison',
        description: 'Compare v1 and v2',
        model_a_version_id: 1,
        model_b_version_id: 2,
        traffic_split: 50,
        status: 'draft'
      };

      db.query.mockResolvedValueOnce({ rows: [mockTest] });

      const result = await abTestService.createABTest({
        organization_id: 1,
        name: 'Model Comparison',
        description: 'Compare v1 and v2',
        model_a_version_id: 1,
        model_b_version_id: 2,
        created_by: 1
      });

      expect(result).toEqual(mockTest);
      expect(result.status).toBe('draft');
    });

    it('should use default traffic split of 50', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, traffic_split: 50 }]
      });

      await abTestService.createABTest({
        name: 'Test',
        model_a_version_id: 1,
        model_b_version_id: 2
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([50])
      );
    });

    it('should use custom traffic split', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, traffic_split: 70 }]
      });

      await abTestService.createABTest({
        name: 'Test',
        model_a_version_id: 1,
        model_b_version_id: 2,
        traffic_split: 70
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([70])
      );
    });

    it('should throw error on database failure', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        abTestService.createABTest({
          name: 'Test',
          model_a_version_id: 1,
          model_b_version_id: 2
        })
      ).rejects.toThrow('DB error');
    });
  });

  // ========================================
  // GET A/B TESTS
  // ========================================
  describe('getABTests()', () => {
    it('should return all tests for organization', async () => {
      const mockTests = [
        {
          id: 1,
          name: 'Test 1',
          status: 'running',
          model_a_version_id: 1,
          model_b_version_id: 2,
          version_a_number: 'v1.0',
          version_b_number: 'v1.1',
          total_results: '100'
        },
        {
          id: 2,
          name: 'Test 2',
          status: 'completed',
          model_a_version_id: 3,
          model_b_version_id: 4,
          version_a_number: 'v2.0',
          version_b_number: 'v2.1',
          total_results: '500'
        }
      ];

      db.query.mockResolvedValueOnce({ rows: mockTests });

      const result = await abTestService.getABTests(1);

      expect(result).toHaveLength(2);
      expect(result[0].totalResults).toBe(100);
    });

    it('should return all tests when no org specified', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await abTestService.getABTests();

      // Should not have organization filter in WHERE clause
      // Note: subquery contains WHERE but main query should not have organization filter
      expect(db.query).toHaveBeenCalledWith(
        expect.not.stringContaining('WHERE t.organization_id'),
        []
      );
    });

    it('should filter by organization', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await abTestService.getABTests(5);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE t.organization_id'),
        [5]
      );
    });
  });

  // ========================================
  // GET A/B TEST
  // ========================================
  describe('getABTest()', () => {
    it('should return single test with details', async () => {
      const mockTest = {
        id: 1,
        name: 'Test',
        model_a_version_id: 1,
        model_b_version_id: 2,
        version_a_number: 'v1.0',
        version_b_number: 'v1.1',
        version_a_openai_id: 'ft:gpt-3.5:v1',
        version_b_openai_id: 'ft:gpt-3.5:v2',
        traffic_split: 50,
        status: 'running'
      };

      db.query.mockResolvedValueOnce({ rows: [mockTest] });

      const result = await abTestService.getABTest(1);

      expect(result.id).toBe(1);
      expect(result.versionAOpenaiId).toBe('ft:gpt-3.5:v1');
      expect(result.versionBOpenaiId).toBe('ft:gpt-3.5:v2');
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await abTestService.getABTest(999);

      expect(result).toBeNull();
    });
  });

  // ========================================
  // UPDATE A/B TEST
  // ========================================
  describe('updateABTest()', () => {
    it('should update test name', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Updated Name' }]
      });

      const result = await abTestService.updateABTest(1, {
        name: 'Updated Name'
      });

      expect(result.name).toBe('Updated Name');
    });

    it('should update traffic split', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, traffic_split: 60 }]
      });

      const result = await abTestService.updateABTest(1, {
        traffic_split: 60
      });

      expect(result.traffic_split).toBe(60);
    });

    it('should throw error if test not found or not draft', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        abTestService.updateABTest(1, { name: 'Test' })
      ).rejects.toThrow('Test not found or cannot be modified');
    });

    it('should return existing test if no updates', async () => {
      const mockTest = { id: 1, name: 'Test' };
      db.query.mockResolvedValueOnce({ rows: [mockTest] });

      const result = await abTestService.updateABTest(1, {});

      expect(result).toEqual(mockTest);
    });
  });

  // ========================================
  // START TEST
  // ========================================
  describe('startTest()', () => {
    it('should start a draft test', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'running', started_at: new Date() }]
      });

      const result = await abTestService.startTest(1);

      expect(result.status).toBe('running');
    });

    it('should throw error if test not found or already started', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        abTestService.startTest(1)
      ).rejects.toThrow('Test not found or already started');
    });
  });

  // ========================================
  // STOP TEST
  // ========================================
  describe('stopTest()', () => {
    it('should stop a running test', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'completed', ended_at: new Date() }]
      });

      const result = await abTestService.stopTest(1);

      expect(result.status).toBe('completed');
    });

    it('should throw error if test not running', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        abTestService.stopTest(1)
      ).rejects.toThrow('Test not found or not running');
    });
  });

  // ========================================
  // CANCEL TEST
  // ========================================
  describe('cancelTest()', () => {
    it('should cancel a test', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'cancelled' }]
      });

      const result = await abTestService.cancelTest(1);

      expect(result.status).toBe('cancelled');
    });

    it('should throw error if test cannot be cancelled', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        abTestService.cancelTest(1)
      ).rejects.toThrow('Test not found or cannot be cancelled');
    });
  });

  // ========================================
  // RECORD TEST RESULT
  // ========================================
  describe('recordTestResult()', () => {
    it('should record test result', async () => {
      const mockResult = {
        id: 1,
        ab_test_id: 1,
        version_id: 1,
        prompt: 'Test prompt',
        response: 'Test response',
        response_time_ms: 150,
        tokens_used: 50
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockResult] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const result = await abTestService.recordTestResult(1, 1, {
        prompt: 'Test prompt',
        response: 'Test response',
        response_time_ms: 150,
        tokens_used: 50,
        session_id: 'session-123'
      });

      expect(result).toEqual(mockResult);
    });

    it('should increment total_requests', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      await abTestService.recordTestResult(1, 1, {
        prompt: 'Test'
      });

      expect(db.query).toHaveBeenLastCalledWith(
        expect.stringContaining('total_requests = total_requests + 1'),
        [1]
      );
    });
  });

  // ========================================
  // UPDATE RESULT FEEDBACK
  // ========================================
  describe('updateResultFeedback()', () => {
    it('should update user rating', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, user_rating: 5 }]
      });

      const result = await abTestService.updateResultFeedback(1, {
        user_rating: 5
      });

      expect(result.user_rating).toBe(5);
    });

    it('should update is_preferred', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, is_preferred: true }]
      });

      const result = await abTestService.updateResultFeedback(1, {
        is_preferred: true
      });

      expect(result.is_preferred).toBe(true);
    });

    it('should return null if no updates', async () => {
      const result = await abTestService.updateResultFeedback(1, {});

      expect(result).toBeNull();
      expect(db.query).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // GET TEST RESULTS
  // ========================================
  describe('getTestResults()', () => {
    it('should return test results with statistics', async () => {
      const mockTest = {
        id: 1,
        name: 'Test',
        model_a_version_id: 1,
        model_b_version_id: 2,
        version_a_number: 'v1.0',
        version_b_number: 'v1.1'
      };

      const mockStatsA = {
        total_requests: '100',
        avg_response_time: '150',
        avg_rating: '4.5',
        preference_count: '60',
        total_tokens: '5000'
      };

      const mockStatsB = {
        total_requests: '100',
        avg_response_time: '120',
        avg_rating: '4.2',
        preference_count: '40',
        total_tokens: '4500'
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockTest] })
        .mockResolvedValueOnce({ rows: [mockStatsA] })
        .mockResolvedValueOnce({ rows: [mockStatsB] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await abTestService.getTestResults(1);

      expect(result.versionA.totalRequests).toBe(100);
      expect(result.versionB.avgResponseTime).toBe(120);
      expect(result.versionA.preferenceCount).toBe(60);
    });

    it('should throw error if test not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        abTestService.getTestResults(999)
      ).rejects.toThrow('Test not found');
    });
  });

  // ========================================
  // CALCULATE WINNER
  // ========================================
  describe('calculateWinner()', () => {
    it('should calculate winner based on scores', async () => {
      const mockTest = {
        id: 1,
        model_a_version_id: 1,
        model_b_version_id: 2,
        version_a_number: 'v1.0',
        version_b_number: 'v1.1'
      };

      const mockStatsA = {
        total_requests: '50',
        avg_response_time: '200',
        avg_rating: '4.0',
        preference_count: '15',
        total_tokens: '5000'
      };

      const mockStatsB = {
        total_requests: '50',
        avg_response_time: '120',
        avg_rating: '4.8',
        preference_count: '35',
        total_tokens: '4500'
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockTest] })
        .mockResolvedValueOnce({ rows: [mockStatsA] })
        .mockResolvedValueOnce({ rows: [mockStatsB] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await abTestService.calculateWinner(1);

      expect(result.winner).toBe('B');
      expect(result.winnerId).toBe(2);
      expect(result.scoreB).toBeGreaterThan(result.scoreA);
    });

    it('should require minimum 30 requests', async () => {
      const mockTest = {
        id: 1,
        model_a_version_id: 1,
        model_b_version_id: 2
      };

      const mockStatsA = { total_requests: '10' };
      const mockStatsB = { total_requests: '10' };

      db.query
        .mockResolvedValueOnce({ rows: [mockTest] })
        .mockResolvedValueOnce({ rows: [mockStatsA] })
        .mockResolvedValueOnce({ rows: [mockStatsB] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await abTestService.calculateWinner(1);

      expect(result.winner).toBeNull();
      expect(result.confidence).toBe(0);
      expect(result.reason).toContain('Not enough data');
    });

    it('should return no winner if scores are equal', async () => {
      const mockTest = {
        id: 1,
        model_a_version_id: 1,
        model_b_version_id: 2
      };

      const mockStats = {
        total_requests: '50',
        avg_response_time: '150',
        avg_rating: '4.5',
        preference_count: '25',
        total_tokens: '5000'
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockTest] })
        .mockResolvedValueOnce({ rows: [mockStats] })
        .mockResolvedValueOnce({ rows: [mockStats] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await abTestService.calculateWinner(1);

      expect(result.winner).toBeNull();
      expect(result.reason).toContain('too close');
    });
  });

  // ========================================
  // DECLARE WINNER
  // ========================================
  describe('declareWinner()', () => {
    it('should declare specified winner', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, winner_version_id: 2, status: 'completed' }]
      });

      const result = await abTestService.declareWinner(1, 2);

      expect(result.winner_version_id).toBe(2);
      expect(result.status).toBe('completed');
    });

    it('should auto-calculate winner if not specified', async () => {
      const mockTest = {
        id: 1,
        model_a_version_id: 1,
        model_b_version_id: 2
      };

      const mockStatsA = {
        total_requests: '50',
        avg_response_time: '200',
        avg_rating: '4.0',
        preference_count: '15',
        total_tokens: '5000'
      };

      const mockStatsB = {
        total_requests: '50',
        avg_response_time: '120',
        avg_rating: '4.8',
        preference_count: '35',
        total_tokens: '4500'
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockTest] })
        .mockResolvedValueOnce({ rows: [mockStatsA] })
        .mockResolvedValueOnce({ rows: [mockStatsB] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1, winner_version_id: 2 }] });

      const result = await abTestService.declareWinner(1);

      expect(result.winner_version_id).toBe(2);
    });

    it('should throw error if winner cannot be determined', async () => {
      const mockTest = {
        id: 1,
        model_a_version_id: 1,
        model_b_version_id: 2
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockTest] })
        .mockResolvedValueOnce({ rows: [{ total_requests: '5' }] })
        .mockResolvedValueOnce({ rows: [{ total_requests: '5' }] })
        .mockResolvedValueOnce({ rows: [] });

      await expect(
        abTestService.declareWinner(1)
      ).rejects.toThrow('Cannot determine winner');
    });
  });

  // ========================================
  // SELECT VERSION FOR REQUEST
  // ========================================
  describe('selectVersionForRequest()', () => {
    it('should select version based on traffic split', async () => {
      const mockTest = {
        id: 1,
        status: 'running',
        traffic_split: 50,
        model_a_version_id: 1,
        model_b_version_id: 2,
        version_a_openai_id: 'ft:v1',
        version_b_openai_id: 'ft:v2',
        version_a_number: 'v1.0',
        version_b_number: 'v1.1'
      };

      db.query.mockResolvedValueOnce({ rows: [mockTest] });

      // Mock Math.random
      const originalRandom = Math.random;
      Math.random = () => 0.3; // Should select A (30 < 50)

      const result = await abTestService.selectVersionForRequest(1);

      expect(result.selectedVersion).toBe('A');
      expect(result.versionId).toBe(1);
      expect(result.openaiModelId).toBe('ft:v1');

      Math.random = originalRandom;
    });

    it('should select version B when random > split', async () => {
      const mockTest = {
        id: 1,
        status: 'running',
        traffic_split: 50,
        model_a_version_id: 1,
        model_b_version_id: 2,
        version_a_openai_id: 'ft:v1',
        version_b_openai_id: 'ft:v2',
        version_a_number: 'v1.0',
        version_b_number: 'v1.1'
      };

      db.query.mockResolvedValueOnce({ rows: [mockTest] });

      const originalRandom = Math.random;
      Math.random = () => 0.7; // Should select B (70 >= 50)

      const result = await abTestService.selectVersionForRequest(1);

      expect(result.selectedVersion).toBe('B');
      expect(result.versionId).toBe(2);

      Math.random = originalRandom;
    });

    it('should throw error if test not running', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        abTestService.selectVersionForRequest(1)
      ).rejects.toThrow('Test not found or not running');
    });

    it('should throw error for completed test', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'completed' }]
      });

      await expect(
        abTestService.selectVersionForRequest(1)
      ).rejects.toThrow('Test not found or not running');
    });
  });

  // ========================================
  // DELETE A/B TEST
  // ========================================
  describe('deleteABTest()', () => {
    it('should delete a test', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'draft' }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const result = await abTestService.deleteABTest(1);

      expect(result).toBe(true);
    });

    it('should throw error if test not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        abTestService.deleteABTest(999)
      ).rejects.toThrow('Test not found');
    });

    it('should throw error if test is running', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'running' }]
      });

      await expect(
        abTestService.deleteABTest(1)
      ).rejects.toThrow('Cannot delete a running test');
    });

    it('should allow deleting completed test', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'completed' }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const result = await abTestService.deleteABTest(1);

      expect(result).toBe(true);
    });

    it('should allow deleting cancelled test', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'cancelled' }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const result = await abTestService.deleteABTest(1);

      expect(result).toBe(true);
    });
  });
});
