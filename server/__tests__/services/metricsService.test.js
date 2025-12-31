/**
 * Metrics Service Tests
 * Tests for server/services/metricsService.js
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
  saveTrainingMetrics,
  saveBatchMetrics,
  getTrainingHistory,
  getLossHistory,
  getAccuracyHistory,
  calculateAccuracy,
  getModelSummary,
  compareModels,
  getUsageStats,
  exportMetricsCSV,
  exportMetricsJSON,
  generateMockMetrics
} = require('../../services/metricsService');

describe('Metrics Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveTrainingMetrics', () => {
    it('should save training metrics', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, fine_tune_model_id: 1, step: 10 }]
      });

      const result = await saveTrainingMetrics(1, 'job-123', {
        step: 10,
        epoch: 1,
        train_loss: 0.5,
        valid_loss: 0.6
      });

      expect(db.query).toHaveBeenCalled();
      expect(result.id).toBe(1);
    });

    it('should handle missing values', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1 }] });

      await saveTrainingMetrics(1, 'job-123', {});

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([1, 'job-123', 0, 0])
      );
    });

    it('should throw on database error', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      await expect(saveTrainingMetrics(1, 'job-123', {}))
        .rejects.toThrow('DB error');
    });
  });

  describe('saveBatchMetrics', () => {
    it('should return empty array for empty input', async () => {
      const result = await saveBatchMetrics(1, 'job-123', []);
      expect(result).toEqual([]);
    });

    it('should return empty array for null input', async () => {
      const result = await saveBatchMetrics(1, 'job-123', null);
      expect(result).toEqual([]);
    });

    it('should save batch of metrics', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1 }, { id: 2 }]
      });

      const metrics = [
        { step: 10, train_loss: 0.5 },
        { step: 20, train_loss: 0.4 }
      ];

      const result = await saveBatchMetrics(1, 'job-123', metrics);

      expect(db.query).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('should throw on database error', async () => {
      db.query.mockRejectedValue(new Error('Batch insert failed'));

      await expect(saveBatchMetrics(1, 'job-123', [{ step: 10 }]))
        .rejects.toThrow('Batch insert failed');
    });
  });

  describe('getTrainingHistory', () => {
    it('should return training history', async () => {
      db.query.mockResolvedValue({
        rows: [
          { step: 0, train_loss: 1.0 },
          { step: 10, train_loss: 0.8 }
        ]
      });

      const result = await getTrainingHistory(1);

      expect(result).toHaveLength(2);
      expect(result[0].step).toBe(0);
    });

    it('should return empty array if no history', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await getTrainingHistory(1);

      expect(result).toEqual([]);
    });
  });

  describe('getLossHistory', () => {
    it('should return loss history', async () => {
      db.query.mockResolvedValue({
        rows: [
          { step: 0, epoch: 0, train_loss: '1.0', valid_loss: '1.1', created_at: new Date() },
          { step: 10, epoch: 0, train_loss: '0.8', valid_loss: '0.9', created_at: new Date() }
        ]
      });

      const result = await getLossHistory(1);

      expect(result).toHaveLength(2);
      expect(result[0].trainLoss).toBe(1.0);
      expect(result[0].validLoss).toBe(1.1);
    });

    it('should filter by jobId', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await getLossHistory(1, 'job-123');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('job_id'),
        [1, 'job-123']
      );
    });
  });

  describe('getAccuracyHistory', () => {
    it('should return accuracy history', async () => {
      db.query.mockResolvedValue({
        rows: [
          { step: 0, epoch: 0, train_accuracy: '0.5', valid_accuracy: '0.4', created_at: new Date() }
        ]
      });

      const result = await getAccuracyHistory(1);

      expect(result).toHaveLength(1);
      expect(result[0].trainAccuracy).toBe(0.5);
    });

    it('should filter by jobId', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await getAccuracyHistory(1, 'job-123');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('job_id'),
        [1, 'job-123']
      );
    });
  });

  describe('calculateAccuracy', () => {
    it('should calculate accuracy metrics', async () => {
      db.query.mockResolvedValue({
        rows: [{
          avg_train_accuracy: '0.85',
          avg_valid_accuracy: '0.80',
          max_train_accuracy: '0.95',
          max_valid_accuracy: '0.90',
          final_train_accuracy: '0.92',
          final_valid_accuracy: '0.88'
        }]
      });

      const result = await calculateAccuracy(1);

      expect(result.average.train).toBe(0.85);
      expect(result.average.valid).toBe(0.80);
      expect(result.maximum.train).toBe(0.95);
      expect(result.final.train).toBe(0.92);
    });

    it('should handle null values', async () => {
      db.query.mockResolvedValue({
        rows: [{
          avg_train_accuracy: null,
          avg_valid_accuracy: null,
          max_train_accuracy: null,
          max_valid_accuracy: null,
          final_train_accuracy: null,
          final_valid_accuracy: null
        }]
      });

      const result = await calculateAccuracy(1);

      expect(result.average.train).toBeNull();
      expect(result.final.valid).toBeNull();
    });
  });

  describe('getModelSummary', () => {
    it('should return model summary', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            total_steps: '100',
            total_epochs: '3',
            best_train_loss: '0.3',
            best_valid_loss: '0.35',
            best_train_accuracy: '0.95',
            best_valid_accuracy: '0.90',
            total_tokens: '5000',
            started_at: new Date(),
            ended_at: new Date()
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            training_cost: '2.50',
            training_started_at: new Date('2024-01-01T00:00:00Z'),
            training_completed_at: new Date('2024-01-01T01:00:00Z'),
            metrics: { loss: 0.3 }
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            train_loss: '0.32',
            valid_loss: '0.38',
            train_accuracy: '0.94',
            valid_accuracy: '0.89'
          }]
        });

      const result = await getModelSummary(1);

      expect(result.totalSteps).toBe(100);
      expect(result.totalEpochs).toBe(3);
      expect(result.totalTokens).toBe(5000);
      expect(result.trainingCost).toBe(2.50);
      expect(result.trainingTime).toBe(60); // 60 minutes
      expect(result.bestLoss.train).toBe(0.3);
    });

    it('should handle missing model data', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ total_steps: '0', total_epochs: '0' }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await getModelSummary(1);

      expect(result.totalSteps).toBe(0);
      expect(result.trainingCost).toBe(0);
    });
  });

  describe('compareModels', () => {
    it('should return empty array for empty input', async () => {
      const result = await compareModels([]);
      expect(result).toEqual([]);
    });

    it('should return empty array for null input', async () => {
      const result = await compareModels(null);
      expect(result).toEqual([]);
    });

    it('should compare multiple models', async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            id: 1,
            name: 'Model 1',
            base_model: 'gpt-3.5-turbo',
            status: 'completed',
            training_cost: '2.50',
            training_completed_at: new Date(),
            best_loss: '0.3',
            best_accuracy: '0.95',
            final_loss: '0.32',
            final_accuracy: '0.94',
            total_tokens: '5000'
          },
          {
            id: 2,
            name: 'Model 2',
            base_model: 'gpt-3.5-turbo',
            status: 'completed',
            training_cost: '3.00',
            training_completed_at: new Date(),
            best_loss: '0.25',
            best_accuracy: '0.96',
            final_loss: '0.27',
            final_accuracy: '0.95',
            total_tokens: '6000'
          }
        ]
      });

      const result = await compareModels([1, 2]);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Model 1');
      expect(result[1].bestAccuracy).toBe(0.96);
    });
  });

  describe('getUsageStats', () => {
    it('should return null if model not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await getUsageStats(999);

      expect(result).toBeNull();
    });

    it('should return usage statistics', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ model_id: 'ft:gpt-3.5', metrics: { loss: 0.3 } }]
        })
        .mockResolvedValueOnce({
          rows: [{ total_jobs: '3', successful_jobs: '2' }]
        })
        .mockResolvedValueOnce({
          rows: [{ data_points: '100', total_tokens: '5000' }]
        });

      const result = await getUsageStats(1);

      expect(result.modelId).toBe('ft:gpt-3.5');
      expect(result.totalJobs).toBe(3);
      expect(result.successfulJobs).toBe(2);
      expect(result.dataPoints).toBe(100);
    });
  });

  describe('exportMetricsCSV', () => {
    it('should return header only for empty history', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await exportMetricsCSV(1);

      expect(result).toContain('step,epoch,train_loss');
      // Header line with newline at end
      expect(result.split('\n').filter(l => l.trim()).length).toBe(1);
    });

    it('should export metrics as CSV', async () => {
      db.query.mockResolvedValue({
        rows: [
          { step: 0, epoch: 0, train_loss: 1.0, valid_loss: 1.1, tokens_processed: 100, created_at: new Date() },
          { step: 10, epoch: 0, train_loss: 0.8, valid_loss: 0.9, tokens_processed: 200, created_at: new Date() }
        ]
      });

      const result = await exportMetricsCSV(1);

      const lines = result.split('\n');
      expect(lines).toHaveLength(3); // header + 2 data rows
      expect(lines[0]).toContain('step');
    });
  });

  describe('exportMetricsJSON', () => {
    it('should export metrics as JSON', async () => {
      // Mock all queries - Promise.all makes order unpredictable, use mockImplementation
      db.query.mockImplementation((sql) => {
        if (sql.includes('AVG(train_accuracy)')) {
          return Promise.resolve({ rows: [{
            avg_train_accuracy: null,
            avg_valid_accuracy: null,
            max_train_accuracy: null,
            max_valid_accuracy: null,
            final_train_accuracy: null,
            final_valid_accuracy: null
          }] });
        }
        if (sql.includes('fine_tuning_metrics') && sql.includes('ORDER BY step')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('MAX(step)') || sql.includes('total_steps')) {
          return Promise.resolve({ rows: [{ total_steps: '0', total_epochs: '0' }] });
        }
        if (sql.includes('fine_tune_models')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const result = await exportMetricsJSON(1);

      expect(result.modelId).toBe(1);
      expect(result.exportedAt).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.accuracy).toBeDefined();
      expect(result.history).toBeDefined();
    });
  });

  describe('generateMockMetrics', () => {
    it('should generate mock metrics', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await generateMockMetrics(1, 'sim_123', 3);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('step');
      expect(result[0]).toHaveProperty('train_loss');
      expect(result[0]).toHaveProperty('train_accuracy');
    });

    it('should generate metrics for default epochs', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await generateMockMetrics(1, 'sim_123');

      expect(result.length).toBeGreaterThan(0);
    });
  });
});
