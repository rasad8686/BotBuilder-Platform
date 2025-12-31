/**
 * Fine-Tuning Service Tests
 * Tests for server/services/fineTuningService.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue(''),
    unlink: jest.fn().mockResolvedValue(undefined)
  },
  createReadStream: jest.fn()
}));

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    files: {
      create: jest.fn().mockResolvedValue({ id: 'file-123' })
    },
    fineTuning: {
      jobs: {
        create: jest.fn().mockResolvedValue({ id: 'ftjob-123' }),
        retrieve: jest.fn().mockResolvedValue({ status: 'running' }),
        cancel: jest.fn().mockResolvedValue({ status: 'cancelled' })
      }
    }
  }));
});

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../db');
const fs = require('fs');
const {
  createModel,
  getModels,
  getModelById,
  updateModel,
  deleteModel,
  uploadDataset,
  validateDataset,
  startTraining,
  getTrainingStatus,
  cancelTraining,
  getModelMetrics,
  getDatasetById,
  getDatasets,
  updateDataset,
  deleteDataset,
  estimateTrainingCost,
  getTrainingProgress,
  TRAINING_COSTS
} = require('../../services/fineTuningService');

describe('Fine-Tuning Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('TRAINING_COSTS', () => {
    it('should export training costs for different models', () => {
      expect(TRAINING_COSTS['gpt-3.5-turbo']).toBeDefined();
      expect(TRAINING_COSTS['gpt-3.5-turbo'].training).toBe(0.008);
      expect(TRAINING_COSTS['gpt-4'].training).toBe(0.03);
      expect(TRAINING_COSTS['claude-3-haiku'].training).toBe(0.0004);
    });
  });

  describe('createModel', () => {
    it('should create a new fine-tune model', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          name: 'Test Model',
          base_model: 'gpt-3.5-turbo',
          status: 'pending'
        }]
      });

      const result = await createModel(1, 1, {
        name: 'Test Model',
        description: 'A test model',
        base_model: 'gpt-3.5-turbo'
      });

      expect(result.id).toBe(1);
      expect(result.name).toBe('Test Model');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO fine_tune_models'),
        [1, 1, 'Test Model', 'A test model', 'gpt-3.5-turbo']
      );
    });

    it('should throw if name is missing', async () => {
      await expect(createModel(1, 1, { base_model: 'gpt-3.5-turbo' }))
        .rejects.toThrow('Name and base_model are required');
    });

    it('should throw if base_model is missing', async () => {
      await expect(createModel(1, 1, { name: 'Test' }))
        .rejects.toThrow('Name and base_model are required');
    });

    it('should throw for invalid base model', async () => {
      await expect(createModel(1, 1, { name: 'Test', base_model: 'invalid-model' }))
        .rejects.toThrow('Invalid base model');
    });

    it('should accept Claude models', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, base_model: 'claude-3-sonnet' }]
      });

      const result = await createModel(1, 1, {
        name: 'Claude Model',
        base_model: 'claude-3-sonnet'
      });

      expect(result.base_model).toBe('claude-3-sonnet');
    });
  });

  describe('getModels', () => {
    it('should return all models for organization', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, name: 'Model 1', dataset_count: '2', job_count: '1' },
          { id: 2, name: 'Model 2', dataset_count: '1', job_count: '0' }
        ]
      });

      const result = await getModels(1);

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('organization_id = $1'),
        expect.arrayContaining([1])
      );
    });

    it('should filter by status', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await getModels(1, { status: 'completed' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('m.status = $'),
        expect.arrayContaining(['completed'])
      );
    });

    it('should apply limit and offset', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await getModels(1, { limit: 10, offset: 20 });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([10, 20])
      );
    });
  });

  describe('getModelById', () => {
    it('should return model with datasets and jobs', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          name: 'Test Model',
          datasets: [{ id: 1, file_name: 'data.jsonl' }],
          jobs: [{ id: 1, status: 'completed' }]
        }]
      });

      const result = await getModelById(1, 1);

      expect(result.id).toBe(1);
      expect(result.datasets).toHaveLength(1);
      expect(result.jobs).toHaveLength(1);
    });

    it('should throw if model not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(getModelById(999, 1)).rejects.toThrow('Model not found');
    });
  });

  describe('updateModel', () => {
    it('should update model name', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Updated Name' }]
      });

      const result = await updateModel(1, 1, { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
    });

    it('should update model description', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, description: 'New description' }]
      });

      const result = await updateModel(1, 1, { description: 'New description' });

      expect(result.description).toBe('New description');
    });

    it('should update settings as JSON', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, settings: { epochs: 5 } }]
      });

      await updateModel(1, 1, { settings: { epochs: 5 } });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([JSON.stringify({ epochs: 5 })])
      );
    });

    it('should throw if no fields to update', async () => {
      await expect(updateModel(1, 1, {})).rejects.toThrow('No fields to update');
    });

    it('should throw if model not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(updateModel(999, 1, { name: 'Test' }))
        .rejects.toThrow('Model not found');
    });
  });

  describe('deleteModel', () => {
    it('should delete model and associated files', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, status: 'completed', datasets: null, jobs: null }]
        })
        .mockResolvedValueOnce({
          rows: [{ file_path: '/uploads/dataset1.jsonl' }]
        })
        .mockResolvedValueOnce({ rowCount: 1 });

      const result = await deleteModel(1, 1);

      expect(result.success).toBe(true);
      expect(fs.promises.unlink).toHaveBeenCalled();
    });

    it('should throw if model is currently training', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, status: 'training', datasets: null, jobs: null }]
      });

      await expect(deleteModel(1, 1))
        .rejects.toThrow('Cannot delete a model that is currently training');
    });
  });

  describe('uploadDataset', () => {
    it('should upload and save dataset', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, status: 'pending', datasets: null, jobs: null }]
        })
        .mockResolvedValueOnce({
          rows: [{ id: 10, file_name: 'data.jsonl', status: 'processing' }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const file = {
        originalname: 'data.jsonl',
        size: 1024,
        buffer: Buffer.from('test data')
      };

      const result = await uploadDataset(1, 1, file);

      expect(result.id).toBe(10);
      expect(fs.promises.mkdir).toHaveBeenCalled();
      expect(fs.promises.writeFile).toHaveBeenCalled();
    });

    it('should throw if no file provided', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, datasets: null, jobs: null }]
      });

      await expect(uploadDataset(1, 1, null))
        .rejects.toThrow('No file provided');
    });

    it('should throw for invalid file format', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, datasets: null, jobs: null }]
      });

      const file = {
        originalname: 'data.txt',
        size: 1024,
        buffer: Buffer.from('test')
      };

      await expect(uploadDataset(1, 1, file))
        .rejects.toThrow('Invalid file format');
    });
  });

  describe('validateDataset', () => {
    it('should validate JSONL format', async () => {
      const validJsonl = '{"messages":[{"role":"user","content":"Hi"},{"role":"assistant","content":"Hello"}]}\n' +
        '{"messages":[{"role":"user","content":"How are you?"},{"role":"assistant","content":"Good"}]}\n';

      fs.promises.readFile.mockResolvedValue(validJsonl.repeat(5));
      db.query.mockResolvedValue({ rows: [{ fine_tune_model_id: 1 }] });

      const result = await validateDataset(1, '/path/to/file.jsonl', 'jsonl');

      expect(result.rowCount).toBe(10);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing messages array', async () => {
      const invalidJsonl = '{"prompt":"Hi","completion":"Hello"}\n'.repeat(10);
      fs.promises.readFile.mockResolvedValue(invalidJsonl);
      db.query.mockResolvedValue({ rows: [{ fine_tune_model_id: 1 }] });

      const result = await validateDataset(1, '/path/to/file.jsonl', 'jsonl');

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect invalid JSON', async () => {
      const invalidJsonl = 'not valid json\n'.repeat(10);
      fs.promises.readFile.mockResolvedValue(invalidJsonl);
      db.query.mockResolvedValue({ rows: [{ fine_tune_model_id: 1 }] });

      const result = await validateDataset(1, '/path/to/file.jsonl', 'jsonl');

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate JSON format', async () => {
      const validJson = JSON.stringify([
        { messages: [{ role: 'user', content: 'Hi' }, { role: 'assistant', content: 'Hello' }] }
      ].concat(Array(9).fill({ messages: [{ role: 'user', content: 'Test' }, { role: 'assistant', content: 'Reply' }] })));

      fs.promises.readFile.mockResolvedValue(validJson);
      db.query.mockResolvedValue({ rows: [{ fine_tune_model_id: 1 }] });

      const result = await validateDataset(1, '/path/to/file.json', 'json');

      expect(result.rowCount).toBe(10);
    });

    it('should require minimum training examples', async () => {
      const fewExamples = '{"messages":[{"role":"user","content":"Hi"},{"role":"assistant","content":"Hello"}]}';
      fs.promises.readFile.mockResolvedValue(fewExamples);
      db.query.mockResolvedValue({ rows: [{ fine_tune_model_id: 1 }] });

      const result = await validateDataset(1, '/path/to/file.jsonl', 'jsonl');

      expect(result.errors).toContainEqual(
        expect.objectContaining({ error: expect.stringContaining('at least 10') })
      );
    });
  });

  describe('startTraining', () => {
    it('should start training with ready dataset', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, status: 'pending', base_model: 'gpt-3.5-turbo', datasets: null, jobs: null }]
        })
        .mockResolvedValueOnce({
          rows: [{ id: 10, file_path: '/uploads/data.jsonl' }]
        })
        .mockResolvedValueOnce({
          rows: [{ id: 100, status: 'pending' }]
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = await startTraining(1, 1, { epochs: 3 });

      expect(result.id).toBe(100);
    });

    it('should throw if model is already training', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, status: 'training', datasets: null, jobs: null }]
      });

      await expect(startTraining(1, 1)).rejects.toThrow('already training');
    });

    it('should throw if no valid dataset', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, status: 'pending', base_model: 'gpt-3.5-turbo', datasets: null, jobs: null }]
        })
        .mockResolvedValueOnce({ rows: [] });

      await expect(startTraining(1, 1))
        .rejects.toThrow('No valid dataset available');
    });
  });

  describe('getTrainingStatus', () => {
    it('should return training status', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, status: 'training', metrics: { loss: 0.5 }, datasets: null, jobs: null }]
        })
        .mockResolvedValueOnce({
          rows: [{ id: 100, status: 'running', progress: 50 }]
        });

      const result = await getTrainingStatus(1, 1);

      expect(result.model_status).toBe('training');
      expect(result.job.status).toBe('running');
    });
  });

  describe('cancelTraining', () => {
    it('should cancel training', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, status: 'training', datasets: null, jobs: null }]
        })
        .mockResolvedValueOnce({
          rows: [{ id: 100, status: 'running' }]
        })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 1 });

      const result = await cancelTraining(1, 1);

      expect(result.success).toBe(true);
    });

    it('should throw if model is not training', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, status: 'completed', datasets: null, jobs: null }]
      });

      await expect(cancelTraining(1, 1))
        .rejects.toThrow('Model is not currently training');
    });
  });

  describe('getModelMetrics', () => {
    it('should return model metrics with jobs', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            status: 'completed',
            base_model: 'gpt-3.5-turbo',
            model_id: 'ft:gpt-3.5-turbo:custom',
            metrics: { loss: 0.25 },
            training_cost: 2.50,
            datasets: null,
            jobs: null
          }]
        })
        .mockResolvedValueOnce({
          rows: [{ id: 100, status: 'succeeded' }]
        });

      const result = await getModelMetrics(1, 1);

      expect(result.model_id).toBe(1);
      expect(result.fine_tuned_model).toBe('ft:gpt-3.5-turbo:custom');
      expect(result.jobs).toHaveLength(1);
    });
  });

  describe('getDatasetById', () => {
    it('should return dataset by ID', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 10, file_name: 'data.jsonl' }]
      });

      const result = await getDatasetById(10, 1);

      expect(result.id).toBe(10);
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await getDatasetById(999, 1);

      expect(result).toBeNull();
    });
  });

  describe('getDatasets', () => {
    it('should return all datasets for model', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, file_name: 'data1.jsonl' },
          { id: 2, file_name: 'data2.jsonl' }
        ]
      });

      const result = await getDatasets(1);

      expect(result).toHaveLength(2);
    });
  });

  describe('updateDataset', () => {
    it('should update dataset fields', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, status: 'ready' }]
      });

      const result = await updateDataset(1, { status: 'ready' });

      expect(result.status).toBe('ready');
    });

    it('should return null if no updates', async () => {
      const result = await updateDataset(1, {});

      expect(result).toBeNull();
    });
  });

  describe('deleteDataset', () => {
    it('should delete dataset', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, file_name: 'data.jsonl' }]
      });

      const result = await deleteDataset(1, 1);

      expect(result.success).toBe(true);
    });

    it('should throw if dataset not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(deleteDataset(999, 1))
        .rejects.toThrow('Dataset not found');
    });
  });

  describe('estimateTrainingCost', () => {
    it('should estimate training cost', async () => {
      const content = '{"messages":[{"role":"user","content":"Hi"},{"role":"assistant","content":"Hello"}]}\n'.repeat(100);

      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, base_model: 'gpt-3.5-turbo', datasets: null, jobs: null }]
        })
        .mockResolvedValueOnce({
          rows: [{ id: 10, file_path: '/path/to/file', file_size: 10000 }]
        });

      fs.promises.readFile.mockResolvedValue(content);

      const result = await estimateTrainingCost(1, 1, { epochs: 3 });

      expect(result.base_model).toBe('gpt-3.5-turbo');
      expect(result.epochs).toBe(3);
      expect(result.estimated_training_cost).toBeGreaterThan(0);
      expect(result.currency).toBe('USD');
    });

    it('should throw if no valid dataset', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, base_model: 'gpt-3.5-turbo', datasets: null, jobs: null }]
        })
        .mockResolvedValueOnce({ rows: [] });

      await expect(estimateTrainingCost(1, 1))
        .rejects.toThrow('No valid dataset available');
    });
  });

  describe('getTrainingProgress', () => {
    it('should return progress for training model', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, status: 'training', datasets: null, jobs: null }]
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 100,
            status: 'running',
            progress: 50,
            started_at: new Date(),
            trained_tokens: 5000,
            estimated_cost: 0.50,
            training_metrics: { epoch: 2, step: 50, total_steps: 100, loss: 0.4 }
          }]
        });

      const result = await getTrainingProgress(1, 1);

      expect(result.status).toBe('running');
      expect(result.progress).toBe(50);
      expect(result.metrics.epoch).toBe(2);
    });

    it('should return completed status', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, status: 'completed', datasets: null, jobs: null }]
      });

      const result = await getTrainingProgress(1, 1);

      expect(result.status).toBe('completed');
      expect(result.progress).toBe(100);
    });

    it('should return unknown if no active job', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, status: 'training', datasets: null, jobs: null }]
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = await getTrainingProgress(1, 1);

      expect(result.status).toBe('unknown');
    });
  });
});
