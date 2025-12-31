/**
 * A/B Test Service Tests
 * Tests for server/services/abTestService.js
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
const {
  createABTest,
  getABTests,
  getABTest,
  updateABTest,
  startTest,
  stopTest,
  cancelTest,
  recordTestResult,
  updateResultFeedback,
  getTestResults,
  calculateWinner,
  declareWinner,
  selectVersionForRequest,
  deleteABTest
} = require('../../services/abTestService');

describe('A/B Test Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createABTest', () => {
    it('should create a new A/B test', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          name: 'Test Experiment',
          description: 'Testing two models',
          model_a_version_id: 1,
          model_b_version_id: 2,
          traffic_split: 50,
          status: 'draft'
        }]
      });

      const result = await createABTest({
        name: 'Test Experiment',
        description: 'Testing two models',
        model_a_version_id: 1,
        model_b_version_id: 2,
        organization_id: 1,
        created_by: 1
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO ab_tests'),
        expect.any(Array)
      );
      expect(result.id).toBe(1);
      expect(result.status).toBe('draft');
    });

    it('should use default traffic split of 50', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, traffic_split: 50 }]
      });

      await createABTest({
        name: 'Test',
        model_a_version_id: 1,
        model_b_version_id: 2
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([50])
      );
    });

    it('should throw on database error', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      await expect(createABTest({
        name: 'Test',
        model_a_version_id: 1,
        model_b_version_id: 2
      })).rejects.toThrow('DB error');
    });
  });

  describe('getABTests', () => {
    it('should return all A/B tests', async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            id: 1,
            name: 'Test 1',
            model_a_version_id: 1,
            model_b_version_id: 2,
            version_a_number: 'v1.0',
            version_b_number: 'v1.1',
            model_a_name: 'Model A',
            model_b_name: 'Model B',
            traffic_split: 50,
            status: 'running',
            total_results: '10'
          }
        ]
      });

      const result = await getABTests();

      expect(result).toHaveLength(1);
      expect(result[0].versionANumber).toBe('v1.0');
      expect(result[0].totalResults).toBe(10);
    });

    it('should filter by organization ID', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await getABTests(123);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('organization_id = $1'),
        [123]
      );
    });

    it('should return empty array if no tests', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await getABTests();

      expect(result).toEqual([]);
    });
  });

  describe('getABTest', () => {
    it('should return a single A/B test', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          name: 'Test 1',
          model_a_version_id: 1,
          model_b_version_id: 2,
          version_a_number: 'v1.0',
          version_b_number: 'v1.1',
          version_a_openai_id: 'ft:gpt-3.5:v1',
          version_b_openai_id: 'ft:gpt-3.5:v2',
          status: 'running'
        }]
      });

      const result = await getABTest(1);

      expect(result.id).toBe(1);
      expect(result.versionAOpenaiId).toBe('ft:gpt-3.5:v1');
    });

    it('should return null if test not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await getABTest(999);

      expect(result).toBeNull();
    });
  });

  describe('updateABTest', () => {
    it('should update test name', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Updated Name' }]
      });

      const result = await updateABTest(1, { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
    });

    it('should update traffic split', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, traffic_split: 70 }]
      });

      const result = await updateABTest(1, { traffic_split: 70 });

      expect(result.traffic_split).toBe(70);
    });

    it('should return existing test if no updates', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test' }]
      });

      await updateABTest(1, {});

      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('should throw if test not found or cannot be modified', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(updateABTest(1, { name: 'New' }))
        .rejects.toThrow('Test not found or cannot be modified');
    });
  });

  describe('startTest', () => {
    it('should start a draft test', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, status: 'running', started_at: new Date() }]
      });

      const result = await startTest(1);

      expect(result.status).toBe('running');
    });

    it('should throw if test not found or already started', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(startTest(1))
        .rejects.toThrow('Test not found or already started');
    });
  });

  describe('stopTest', () => {
    it('should stop a running test', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, status: 'completed', ended_at: new Date() }]
      });

      const result = await stopTest(1);

      expect(result.status).toBe('completed');
    });

    it('should throw if test not found or not running', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(stopTest(1))
        .rejects.toThrow('Test not found or not running');
    });
  });

  describe('cancelTest', () => {
    it('should cancel a test', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, status: 'cancelled', ended_at: new Date() }]
      });

      const result = await cancelTest(1);

      expect(result.status).toBe('cancelled');
    });

    it('should throw if test cannot be cancelled', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(cancelTest(1))
        .rejects.toThrow('Test not found or cannot be cancelled');
    });
  });

  describe('recordTestResult', () => {
    it('should record a test result', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, ab_test_id: 1, version_id: 1 }]
        })
        .mockResolvedValueOnce({ rows: [] }); // Update count

      const result = await recordTestResult(1, 1, {
        prompt: 'Hello',
        response: 'Hi there!',
        response_time_ms: 150,
        tokens_used: 10,
        session_id: 'session-123'
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO ab_test_results'),
        expect.any(Array)
      );
      expect(result.id).toBe(1);
    });

    it('should handle optional fields', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });

      await recordTestResult(1, 1, { prompt: 'Test' });

      expect(db.query).toHaveBeenCalled();
    });
  });

  describe('updateResultFeedback', () => {
    it('should update result feedback', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, user_rating: 5, is_preferred: true }]
      });

      const result = await updateResultFeedback(1, {
        user_rating: 5,
        is_preferred: true
      });

      expect(result.user_rating).toBe(5);
    });

    it('should return null if no updates provided', async () => {
      const result = await updateResultFeedback(1, {});

      expect(result).toBeNull();
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should return undefined if result not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await updateResultFeedback(1, { user_rating: 5 });

      expect(result).toBeUndefined();
    });
  });

  describe('getTestResults', () => {
    it('should return test results with statistics', async () => {
      db.query
        // 1. getABTest query
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            name: 'Test',
            model_a_version_id: 1,
            model_b_version_id: 2,
            version_a_number: 'v1.0',
            version_b_number: 'v1.1',
            traffic_split: 50,
            status: 'running'
          }]
        })
        // 2. statsA query
        .mockResolvedValueOnce({
          rows: [{
            total_requests: '5',
            avg_response_time: '100',
            avg_rating: '4.0',
            preference_count: '3',
            total_tokens: '500'
          }]
        })
        // 3. statsB query
        .mockResolvedValueOnce({
          rows: [{
            total_requests: '5',
            avg_response_time: '120',
            avg_rating: '4.5',
            preference_count: '2',
            total_tokens: '600'
          }]
        })
        // 4. recentResults query
        .mockResolvedValueOnce({
          rows: [
            { id: 1, version_id: 1, response_time_ms: 100, user_rating: 4 },
            { id: 2, version_id: 2, response_time_ms: 120, user_rating: 5 }
          ]
        });

      const result = await getTestResults(1);

      expect(result.versionA).toBeDefined();
      expect(result.versionB).toBeDefined();
      expect(result.recentResults).toHaveLength(2);
    });

    it('should throw if test not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(getTestResults(1)).rejects.toThrow('Test not found');
    });
  });

  describe('calculateWinner', () => {
    it('should calculate winner based on statistics', async () => {
      // Mock getABTest query
      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            name: 'Test',
            model_a_version_id: 1,
            model_b_version_id: 2,
            version_a_number: 'v1.0',
            version_b_number: 'v1.1',
            traffic_split: 50,
            status: 'running'
          }]
        })
        // Mock statsA query
        .mockResolvedValueOnce({
          rows: [{
            total_requests: '25',
            avg_response_time: '100',
            avg_rating: '4.5',
            preference_count: '15',
            total_tokens: '1000'
          }]
        })
        // Mock statsB query
        .mockResolvedValueOnce({
          rows: [{
            total_requests: '25',
            avg_response_time: '120',
            avg_rating: '4.0',
            preference_count: '10',
            total_tokens: '900'
          }]
        })
        // Mock recentResults query
        .mockResolvedValueOnce({ rows: [] });

      const result = await calculateWinner(1);

      // With 50 total requests (>= 30), winner should be calculated
      expect(result.winner).toBe('A'); // A has better rating
      expect(result.stats.versionA).toBeDefined();
      expect(result.stats.versionB).toBeDefined();
    });

    it('should return null if test not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(calculateWinner(999)).rejects.toThrow('Test not found');
    });
  });

  describe('declareWinner', () => {
    it('should declare winner for completed test', async () => {
      // Mock UPDATE query
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, winner_version_id: 1, status: 'completed' }]
      });

      const result = await declareWinner(1, 1);

      expect(result.winner_version_id).toBe(1);
      expect(result.status).toBe('completed');
    });

    it('should throw if test not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(declareWinner(1, 1))
        .rejects.toThrow('Test not found');
    });

    it('should update with provided winner version', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, winner_version_id: 99, status: 'completed' }]
      });

      const result = await declareWinner(1, 99);

      expect(result.winner_version_id).toBe(99);
    });
  });

  describe('selectVersionForRequest', () => {
    it('should select version A based on traffic split', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          name: 'Test',
          model_a_version_id: 1,
          model_b_version_id: 2,
          version_a_openai_id: 'ft:gpt-3.5:v1',
          version_b_openai_id: 'ft:gpt-3.5:v2',
          version_a_number: 'v1.0',
          version_b_number: 'v1.1',
          traffic_split: 100,
          status: 'running'
        }]
      });

      const result = await selectVersionForRequest(1);

      expect(result.versionId).toBe(1);
      expect(result.openaiModelId).toBe('ft:gpt-3.5:v1');
    });

    it('should throw if test not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(selectVersionForRequest(999))
        .rejects.toThrow('Test not found or not running');
    });
  });

  describe('deleteABTest', () => {
    it('should delete a draft test', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'draft', name: 'Test', variants: '[]', traffic_allocation: '{}' }] }) // getABTest
        .mockResolvedValueOnce({ rowCount: 1 }); // DELETE

      const result = await deleteABTest(1);

      expect(result).toBe(true);
    });

    it('should throw if test not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(deleteABTest(1))
        .rejects.toThrow('Test not found');
    });

    it('should throw if test is running', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1, status: 'running', name: 'Test', variants: '[]', traffic_allocation: '{}' }] });

      await expect(deleteABTest(1))
        .rejects.toThrow('Cannot delete a running test');
    });
  });
});
