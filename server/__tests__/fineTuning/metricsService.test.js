/**
 * Metrics Service Tests
 * Tests for training metrics: save, retrieve, analyze, export
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
const metricsService = require('../../services/metricsService');

describe('Metrics Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // SAVE TRAINING METRICS
  // ========================================
  describe('saveTrainingMetrics()', () => {
    it('should save metrics to database', async () => {
      const mockMetric = {
        id: 1,
        fine_tune_model_id: 1,
        job_id: 'ftjob-123',
        step: 100,
        epoch: 1,
        train_loss: 0.5,
        valid_loss: 0.6,
        train_accuracy: 0.85,
        valid_accuracy: 0.80
      };

      db.query.mockResolvedValueOnce({ rows: [mockMetric] });

      const result = await metricsService.saveTrainingMetrics(1, 'ftjob-123', {
        step: 100,
        epoch: 1,
        train_loss: 0.5,
        valid_loss: 0.6,
        train_accuracy: 0.85,
        valid_accuracy: 0.80,
        learning_rate: 0.0001,
        tokens_processed: 5000
      });

      expect(result).toEqual(mockMetric);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO fine_tuning_metrics'),
        expect.arrayContaining([1, 'ftjob-123', 100, 1, 0.5, 0.6, 0.85, 0.80, 0.0001, 5000])
      );
    });

    it('should handle missing optional fields', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await metricsService.saveTrainingMetrics(1, 'ftjob-123', {
        step: 50
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([1, 'ftjob-123', 50, 0, null, null, null, null, null, 0])
      );
    });

    it('should throw error on database failure', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        metricsService.saveTrainingMetrics(1, 'ftjob-123', { step: 100 })
      ).rejects.toThrow('DB error');
    });
  });

  // ========================================
  // SAVE BATCH METRICS
  // ========================================
  describe('saveBatchMetrics()', () => {
    it('should save multiple metrics at once', async () => {
      const mockMetrics = [
        { id: 1, step: 100 },
        { id: 2, step: 200 }
      ];

      db.query.mockResolvedValueOnce({ rows: mockMetrics });

      const result = await metricsService.saveBatchMetrics(1, 'ftjob-123', [
        { step: 100, train_loss: 0.5 },
        { step: 200, train_loss: 0.4 }
      ]);

      expect(result).toHaveLength(2);
    });

    it('should return empty array for empty input', async () => {
      const result = await metricsService.saveBatchMetrics(1, 'ftjob-123', []);

      expect(result).toEqual([]);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should return empty array for null input', async () => {
      const result = await metricsService.saveBatchMetrics(1, 'ftjob-123', null);

      expect(result).toEqual([]);
    });
  });

  // ========================================
  // GET TRAINING HISTORY
  // ========================================
  describe('getTrainingHistory()', () => {
    it('should return training history for model', async () => {
      const mockHistory = [
        { step: 100, train_loss: 0.5, train_accuracy: 0.8 },
        { step: 200, train_loss: 0.4, train_accuracy: 0.85 },
        { step: 300, train_loss: 0.3, train_accuracy: 0.9 }
      ];

      db.query.mockResolvedValueOnce({ rows: mockHistory });

      const result = await metricsService.getTrainingHistory(1);

      expect(result).toHaveLength(3);
      expect(result[0].step).toBe(100);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY step ASC'),
        [1]
      );
    });

    it('should return empty array if no history', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await metricsService.getTrainingHistory(1);

      expect(result).toEqual([]);
    });
  });

  // ========================================
  // GET LOSS HISTORY
  // ========================================
  describe('getLossHistory()', () => {
    it('should return loss history for model', async () => {
      const mockLoss = [
        { step: 100, epoch: 0, train_loss: '0.5', valid_loss: '0.55', created_at: new Date() },
        { step: 200, epoch: 1, train_loss: '0.4', valid_loss: '0.45', created_at: new Date() }
      ];

      db.query.mockResolvedValueOnce({ rows: mockLoss });

      const result = await metricsService.getLossHistory(1);

      expect(result).toHaveLength(2);
      expect(result[0].trainLoss).toBe(0.5);
      expect(result[0].validLoss).toBe(0.55);
    });

    it('should filter by jobId when provided', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await metricsService.getLossHistory(1, 'ftjob-123');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('AND job_id'),
        [1, 'ftjob-123']
      );
    });

    it('should handle null loss values', async () => {
      const mockLoss = [
        { step: 100, epoch: 0, train_loss: null, valid_loss: null, created_at: new Date() }
      ];

      db.query.mockResolvedValueOnce({ rows: mockLoss });

      const result = await metricsService.getLossHistory(1);

      expect(result[0].trainLoss).toBeNull();
      expect(result[0].validLoss).toBeNull();
    });
  });

  // ========================================
  // GET ACCURACY HISTORY
  // ========================================
  describe('getAccuracyHistory()', () => {
    it('should return accuracy history for model', async () => {
      const mockAccuracy = [
        { step: 100, epoch: 0, train_accuracy: '0.8', valid_accuracy: '0.75', created_at: new Date() },
        { step: 200, epoch: 1, train_accuracy: '0.9', valid_accuracy: '0.85', created_at: new Date() }
      ];

      db.query.mockResolvedValueOnce({ rows: mockAccuracy });

      const result = await metricsService.getAccuracyHistory(1);

      expect(result).toHaveLength(2);
      expect(result[0].trainAccuracy).toBe(0.8);
      expect(result[0].validAccuracy).toBe(0.75);
    });

    it('should filter by jobId when provided', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await metricsService.getAccuracyHistory(1, 'ftjob-456');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('AND job_id'),
        [1, 'ftjob-456']
      );
    });
  });

  // ========================================
  // CALCULATE ACCURACY
  // ========================================
  describe('calculateAccuracy()', () => {
    it('should calculate accuracy statistics', async () => {
      const mockStats = {
        avg_train_accuracy: '0.85',
        avg_valid_accuracy: '0.80',
        max_train_accuracy: '0.95',
        max_valid_accuracy: '0.90',
        final_train_accuracy: '0.92',
        final_valid_accuracy: '0.88'
      };

      db.query.mockResolvedValueOnce({ rows: [mockStats] });

      const result = await metricsService.calculateAccuracy(1);

      expect(result.average.train).toBe(0.85);
      expect(result.average.valid).toBe(0.80);
      expect(result.maximum.train).toBe(0.95);
      expect(result.maximum.valid).toBe(0.90);
      expect(result.final.train).toBe(0.92);
      expect(result.final.valid).toBe(0.88);
    });

    it('should handle null values', async () => {
      const mockStats = {
        avg_train_accuracy: null,
        avg_valid_accuracy: null,
        max_train_accuracy: null,
        max_valid_accuracy: null,
        final_train_accuracy: null,
        final_valid_accuracy: null
      };

      db.query.mockResolvedValueOnce({ rows: [mockStats] });

      const result = await metricsService.calculateAccuracy(1);

      expect(result.average.train).toBeNull();
      expect(result.final.valid).toBeNull();
    });
  });

  // ========================================
  // GET MODEL SUMMARY
  // ========================================
  describe('getModelSummary()', () => {
    it('should return comprehensive model summary', async () => {
      const mockMetrics = {
        total_steps: '300',
        total_epochs: '3',
        best_train_loss: '0.25',
        best_valid_loss: '0.30',
        best_train_accuracy: '0.95',
        best_valid_accuracy: '0.90',
        total_tokens: '50000',
        started_at: new Date(),
        ended_at: new Date()
      };

      const mockModel = {
        training_cost: '5.50',
        training_started_at: new Date('2024-01-01T10:00:00Z'),
        training_completed_at: new Date('2024-01-01T10:30:00Z'),
        metrics: { final_loss: 0.25 }
      };

      const mockFinal = {
        train_loss: '0.25',
        valid_loss: '0.30',
        train_accuracy: '0.92',
        valid_accuracy: '0.88'
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockMetrics] })
        .mockResolvedValueOnce({ rows: [mockModel] })
        .mockResolvedValueOnce({ rows: [mockFinal] });

      const result = await metricsService.getModelSummary(1);

      expect(result.totalSteps).toBe(300);
      expect(result.totalEpochs).toBe(3);
      expect(result.totalTokens).toBe(50000);
      expect(result.trainingCost).toBe(5.5);
      expect(result.trainingTime).toBe(30); // 30 minutes
      expect(result.bestLoss.train).toBe(0.25);
      expect(result.finalAccuracy.train).toBe(0.92);
    });

    it('should handle missing model data', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total_steps: '0' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await metricsService.getModelSummary(1);

      expect(result.trainingCost).toBe(0);
      expect(result.trainingTime).toBeNull();
    });
  });

  // ========================================
  // COMPARE MODELS
  // ========================================
  describe('compareModels()', () => {
    it('should compare multiple models', async () => {
      const mockComparison = [
        { id: 1, name: 'Model A', base_model: 'gpt-3.5-turbo', status: 'completed', training_cost: '3.50', best_loss: '0.25', best_accuracy: '0.92', final_loss: '0.28', final_accuracy: '0.90', total_tokens: '30000' },
        { id: 2, name: 'Model B', base_model: 'gpt-4', status: 'completed', training_cost: '15.00', best_loss: '0.20', best_accuracy: '0.95', final_loss: '0.22', final_accuracy: '0.93', total_tokens: '50000' }
      ];

      db.query.mockResolvedValueOnce({ rows: mockComparison });

      const result = await metricsService.compareModels([1, 2]);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Model A');
      expect(result[1].name).toBe('Model B');
      expect(result[0].trainingCost).toBe(3.5);
      expect(result[1].bestLoss).toBe(0.2);
    });

    it('should return empty array for empty input', async () => {
      const result = await metricsService.compareModels([]);

      expect(result).toEqual([]);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should return empty array for null input', async () => {
      const result = await metricsService.compareModels(null);

      expect(result).toEqual([]);
    });
  });

  // ========================================
  // GET USAGE STATS
  // ========================================
  describe('getUsageStats()', () => {
    it('should return usage statistics', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ model_id: 'ft:gpt-3.5-turbo:test', metrics: { loss: 0.25 } }] })
        .mockResolvedValueOnce({ rows: [{ total_jobs: '5', successful_jobs: '4' }] })
        .mockResolvedValueOnce({ rows: [{ data_points: '1000', total_tokens: '50000' }] });

      const result = await metricsService.getUsageStats(1);

      expect(result.modelId).toBe('ft:gpt-3.5-turbo:test');
      expect(result.totalJobs).toBe(5);
      expect(result.successfulJobs).toBe(4);
      expect(result.dataPoints).toBe(1000);
      expect(result.totalTokens).toBe(50000);
    });

    it('should return null if model not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await metricsService.getUsageStats(999);

      expect(result).toBeNull();
    });
  });

  // ========================================
  // EXPORT METRICS CSV
  // ========================================
  describe('exportMetricsCSV()', () => {
    it('should export metrics as CSV', async () => {
      const mockMetrics = [
        { step: 100, epoch: 0, train_loss: 0.5, valid_loss: 0.55, train_accuracy: 0.8, valid_accuracy: 0.75, learning_rate: 0.0001, tokens_processed: 5000, created_at: new Date() },
        { step: 200, epoch: 1, train_loss: 0.4, valid_loss: 0.45, train_accuracy: 0.85, valid_accuracy: 0.80, learning_rate: 0.00005, tokens_processed: 10000, created_at: new Date() }
      ];

      db.query.mockResolvedValueOnce({ rows: mockMetrics });

      const result = await metricsService.exportMetricsCSV(1);

      expect(result).toContain('step,epoch,train_loss,valid_loss');
      expect(result).toContain('100,0,0.5,0.55');
      expect(result).toContain('200,1,0.4,0.45');
    });

    it('should return headers only if no data', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await metricsService.exportMetricsCSV(1);

      expect(result).toContain('step,epoch,train_loss');
      const lines = result.trim().split('\n');
      expect(lines).toHaveLength(1);
    });
  });

  // ========================================
  // EXPORT METRICS JSON
  // ========================================
  describe('exportMetricsJSON()', () => {
    it('should export metrics as JSON', async () => {
      const mockHistory = [{ step: 100, train_loss: 0.5 }];
      const mockMetrics = { total_steps: '100' };
      const mockModel = { training_cost: '5.00' };
      const mockFinal = { train_loss: '0.25' };
      const mockAccuracy = { avg_train_accuracy: '0.85' };

      db.query
        .mockResolvedValueOnce({ rows: mockHistory })
        .mockResolvedValueOnce({ rows: [mockMetrics] })
        .mockResolvedValueOnce({ rows: [mockModel] })
        .mockResolvedValueOnce({ rows: [mockFinal] })
        .mockResolvedValueOnce({ rows: [mockAccuracy] });

      const result = await metricsService.exportMetricsJSON(1);

      expect(result.modelId).toBe(1);
      expect(result.exportedAt).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.accuracy).toBeDefined();
      expect(result.history).toBeDefined();
    });
  });

  // ========================================
  // GENERATE MOCK METRICS
  // ========================================
  describe('generateMockMetrics()', () => {
    it('should generate mock metrics for testing', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await metricsService.generateMockMetrics(1, 'mock_123', 3);

      expect(result.length).toBeGreaterThan(0);
      expect(db.query).toHaveBeenCalled();
    });

    it('should generate decreasing loss values', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await metricsService.generateMockMetrics(1, 'mock_123', 3);

      // First metric should have higher loss than last
      const firstLoss = result[0].train_loss;
      const lastLoss = result[result.length - 1].train_loss;

      expect(firstLoss).toBeGreaterThan(lastLoss);
    });

    it('should generate increasing accuracy values', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await metricsService.generateMockMetrics(1, 'mock_123', 3);

      // First metric should have lower accuracy than last
      const firstAccuracy = result[0].train_accuracy;
      const lastAccuracy = result[result.length - 1].train_accuracy;

      expect(firstAccuracy).toBeLessThan(lastAccuracy);
    });

    it('should respect epoch parameter', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await metricsService.generateMockMetrics(1, 'mock_123', 5);

      const maxEpoch = Math.max(...result.map(m => m.epoch));
      expect(maxEpoch).toBeLessThanOrEqual(5);
    });
  });
});
