/**
 * Fine-Tuning Service Tests
 * Tests for fineTuningService functions: model CRUD, dataset management, training
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

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue('{"messages":[{"role":"user","content":"test"},{"role":"assistant","content":"response"}]}'),
    unlink: jest.fn().mockResolvedValue(undefined)
  }
}));

const db = require('../../db');
const fineTuningService = require('../../services/fineTuningService');

describe('Fine-Tuning Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // CREATE MODEL
  // ========================================
  describe('createModel()', () => {
    it('should create a model with valid data', async () => {
      const mockModel = {
        id: 1,
        user_id: 1,
        organization_id: 1,
        name: 'Test Model',
        description: 'A test model',
        base_model: 'gpt-3.5-turbo',
        status: 'pending'
      };

      db.query.mockResolvedValueOnce({ rows: [mockModel] });

      const result = await fineTuningService.createModel(1, 1, {
        name: 'Test Model',
        description: 'A test model',
        base_model: 'gpt-3.5-turbo'
      });

      expect(result).toEqual(mockModel);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO fine_tune_models'),
        [1, 1, 'Test Model', 'A test model', 'gpt-3.5-turbo']
      );
    });

    it('should throw error if name is missing', async () => {
      await expect(
        fineTuningService.createModel(1, 1, { base_model: 'gpt-3.5-turbo' })
      ).rejects.toThrow('Name and base_model are required');
    });

    it('should throw error if base_model is missing', async () => {
      await expect(
        fineTuningService.createModel(1, 1, { name: 'Test' })
      ).rejects.toThrow('Name and base_model are required');
    });

    it('should throw error for invalid base model', async () => {
      await expect(
        fineTuningService.createModel(1, 1, {
          name: 'Test',
          base_model: 'invalid-model'
        })
      ).rejects.toThrow('Invalid base model');
    });

    it('should accept all valid base models', async () => {
      const validModels = ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus'];

      for (const baseModel of validModels) {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, base_model: baseModel }] });

        const result = await fineTuningService.createModel(1, 1, {
          name: 'Test',
          base_model: baseModel
        });

        expect(result.base_model).toBe(baseModel);
      }
    });

    it('should set default description to empty string', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, description: '' }] });

      await fineTuningService.createModel(1, 1, {
        name: 'Test',
        base_model: 'gpt-3.5-turbo'
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([''])
      );
    });
  });

  // ========================================
  // GET MODELS
  // ========================================
  describe('getModels()', () => {
    it('should return models for organization', async () => {
      const mockModels = [
        { id: 1, name: 'Model 1', dataset_count: 2, job_count: 1 },
        { id: 2, name: 'Model 2', dataset_count: 1, job_count: 0 }
      ];

      db.query.mockResolvedValueOnce({ rows: mockModels });

      const result = await fineTuningService.getModels(1);

      expect(result).toEqual(mockModels);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('organization_id'),
        expect.arrayContaining([1])
      );
    });

    it('should filter by status when provided', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await fineTuningService.getModels(1, { status: 'training' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('status'),
        expect.arrayContaining([1, 'training'])
      );
    });

    it('should apply limit and offset', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await fineTuningService.getModels(1, { limit: 10, offset: 20 });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([1, 10, 20])
      );
    });

    it('should use default limit and offset', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await fineTuningService.getModels(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([1, 50, 0])
      );
    });
  });

  // ========================================
  // GET MODEL BY ID
  // ========================================
  describe('getModelById()', () => {
    it('should return model with datasets and jobs', async () => {
      const mockModel = {
        id: 1,
        name: 'Test Model',
        datasets: [{ id: 1 }],
        jobs: [{ id: 1 }]
      };

      db.query.mockResolvedValueOnce({ rows: [mockModel] });

      const result = await fineTuningService.getModelById(1, 1);

      expect(result).toEqual(mockModel);
    });

    it('should throw error if model not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        fineTuningService.getModelById(999, 1)
      ).rejects.toThrow('Model not found');
    });

    it('should query with both modelId and organizationId', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 5 }] });

      await fineTuningService.getModelById(5, 10);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE m.id = $1 AND m.organization_id = $2'),
        [5, 10]
      );
    });
  });

  // ========================================
  // UPDATE MODEL
  // ========================================
  describe('updateModel()', () => {
    it('should update model name', async () => {
      const mockUpdated = { id: 1, name: 'New Name' };

      db.query.mockResolvedValueOnce({ rows: [mockUpdated] });

      const result = await fineTuningService.updateModel(1, 1, {
        name: 'New Name'
      });

      expect(result.name).toBe('New Name');
    });

    it('should update model description', async () => {
      const mockUpdated = { id: 1, description: 'New Description' };

      db.query.mockResolvedValueOnce({ rows: [mockUpdated] });

      const result = await fineTuningService.updateModel(1, 1, {
        description: 'New Description'
      });

      expect(result.description).toBe('New Description');
    });

    it('should update model settings', async () => {
      const mockUpdated = { id: 1, settings: { epochs: 5 } };

      db.query.mockResolvedValueOnce({ rows: [mockUpdated] });

      const result = await fineTuningService.updateModel(1, 1, {
        settings: { epochs: 5 }
      });

      expect(result.settings).toEqual({ epochs: 5 });
    });

    it('should throw error if no fields to update', async () => {
      await expect(
        fineTuningService.updateModel(1, 1, {})
      ).rejects.toThrow('No fields to update');
    });

    it('should throw error if model not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        fineTuningService.updateModel(999, 1, { name: 'Test' })
      ).rejects.toThrow('Model not found');
    });
  });

  // ========================================
  // DELETE MODEL
  // ========================================
  describe('deleteModel()', () => {
    it('should delete model and associated files', async () => {
      // Mock getModelById
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'completed', datasets: null, jobs: null }]
      });
      // Mock get datasets
      db.query.mockResolvedValueOnce({
        rows: [{ file_path: '/uploads/test.jsonl' }]
      });
      // Mock delete
      db.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await fineTuningService.deleteModel(1, 1);

      expect(result).toEqual({ success: true });
    });

    it('should throw error if model is training', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'training' }]
      });

      await expect(
        fineTuningService.deleteModel(1, 1)
      ).rejects.toThrow('Cannot delete a model that is currently training');
    });

    it('should throw error if model not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        fineTuningService.deleteModel(999, 1)
      ).rejects.toThrow('Model not found');
    });
  });

  // ========================================
  // UPLOAD DATASET
  // ========================================
  describe('uploadDataset()', () => {
    it('should upload and save dataset', async () => {
      const mockDataset = {
        id: 1,
        file_name: 'test.jsonl',
        file_size: 1024,
        format: 'jsonl',
        status: 'processing'
      };

      // Mock getModelById
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      // Mock insert dataset
      db.query.mockResolvedValueOnce({ rows: [mockDataset] });
      // Mock update file path
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      // Mock update model status
      db.query.mockResolvedValueOnce({ rowCount: 1 });

      const mockFile = {
        originalname: 'test.jsonl',
        size: 1024,
        buffer: Buffer.from('test data')
      };

      const result = await fineTuningService.uploadDataset(1, 1, mockFile);

      expect(result.id).toBe(1);
      expect(result.file_name).toBe('test.jsonl');
    });

    it('should throw error if no file provided', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await expect(
        fineTuningService.uploadDataset(1, 1, null)
      ).rejects.toThrow('No file provided');
    });

    it('should throw error for invalid file format', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const mockFile = {
        originalname: 'test.txt',
        size: 1024,
        buffer: Buffer.from('test data')
      };

      await expect(
        fineTuningService.uploadDataset(1, 1, mockFile)
      ).rejects.toThrow('Invalid file format');
    });

    it('should accept JSONL format', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, format: 'jsonl' }] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 1 });

      const mockFile = {
        originalname: 'data.jsonl',
        size: 1024,
        buffer: Buffer.from('{"messages":[]}')
      };

      const result = await fineTuningService.uploadDataset(1, 1, mockFile);
      expect(result.format).toBe('jsonl');
    });

    it('should accept CSV format', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, format: 'csv' }] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 1 });

      const mockFile = {
        originalname: 'data.csv',
        size: 1024,
        buffer: Buffer.from('user,assistant\ntest,response')
      };

      const result = await fineTuningService.uploadDataset(1, 1, mockFile);
      expect(result.format).toBe('csv');
    });

    it('should accept JSON format', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, format: 'json' }] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 1 });

      const mockFile = {
        originalname: 'data.json',
        size: 1024,
        buffer: Buffer.from('[{"messages":[]}]')
      };

      const result = await fineTuningService.uploadDataset(1, 1, mockFile);
      expect(result.format).toBe('json');
    });
  });

  // ========================================
  // START TRAINING
  // ========================================
  describe('startTraining()', () => {
    it('should start training with valid dataset', async () => {
      const mockJob = {
        id: 1,
        fine_tune_model_id: 1,
        status: 'pending',
        epochs: 3
      };

      // Mock getModelById
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'pending', base_model: 'gpt-3.5-turbo' }]
      });
      // Mock get datasets
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, file_path: '/test.jsonl', status: 'ready' }]
      });
      // Mock create job
      db.query.mockResolvedValueOnce({ rows: [mockJob] });
      // Mock update model status
      db.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await fineTuningService.startTraining(1, 1);

      expect(result.id).toBe(1);
      expect(result.status).toBe('pending');
    });

    it('should throw error if model is already training', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'training' }]
      });

      await expect(
        fineTuningService.startTraining(1, 1)
      ).rejects.toThrow('Model is already training');
    });

    it('should throw error if no valid dataset', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'pending' }]
      });
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        fineTuningService.startTraining(1, 1)
      ).rejects.toThrow('No valid dataset available');
    });

    it('should use custom training config', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'pending', base_model: 'gpt-3.5-turbo' }]
      });
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, file_path: '/test.jsonl', status: 'ready' }]
      });
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, epochs: 5, batch_size: 2, learning_rate: 0.001 }]
      });
      db.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await fineTuningService.startTraining(1, 1, {
        epochs: 5,
        batch_size: 2,
        learning_rate: 0.001
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO fine_tune_jobs'),
        expect.arrayContaining([1, 5, 2, 0.001])
      );
    });
  });

  // ========================================
  // GET TRAINING STATUS
  // ========================================
  describe('getTrainingStatus()', () => {
    it('should return training status with job', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'training', metrics: { loss: 0.5 } }]
      });
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'running', trained_tokens: 5000 }]
      });

      const result = await fineTuningService.getTrainingStatus(1, 1);

      expect(result.model_status).toBe('training');
      expect(result.job).toBeDefined();
      expect(result.job.status).toBe('running');
    });

    it('should return null job if no training jobs', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'pending' }]
      });
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await fineTuningService.getTrainingStatus(1, 1);

      expect(result.job).toBeNull();
    });
  });

  // ========================================
  // CANCEL TRAINING
  // ========================================
  describe('cancelTraining()', () => {
    it('should cancel active training', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'training' }]
      });
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, job_id: 'ftjob-123', status: 'running' }]
      });
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      db.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await fineTuningService.cancelTraining(1, 1);

      expect(result.success).toBe(true);
    });

    it('should throw error if model not training', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'completed' }]
      });

      await expect(
        fineTuningService.cancelTraining(1, 1)
      ).rejects.toThrow('Model is not currently training');
    });
  });

  // ========================================
  // GET MODEL METRICS
  // ========================================
  describe('getModelMetrics()', () => {
    it('should return model metrics with jobs', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          status: 'completed',
          base_model: 'gpt-3.5-turbo',
          model_id: 'ft:gpt-3.5-turbo:test',
          metrics: { loss: 0.25, accuracy: 0.92 },
          training_cost: 5.50,
          training_started_at: new Date(),
          training_completed_at: new Date()
        }]
      });
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, status: 'succeeded' },
          { id: 2, status: 'failed' }
        ]
      });

      const result = await fineTuningService.getModelMetrics(1, 1);

      expect(result.model_id).toBe(1);
      expect(result.status).toBe('completed');
      expect(result.jobs).toHaveLength(2);
    });
  });

  // ========================================
  // DATASET OPERATIONS
  // ========================================
  describe('getDatasetById()', () => {
    it('should return dataset', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, file_name: 'test.jsonl' }]
      });

      const result = await fineTuningService.getDatasetById(1, 1);

      expect(result.id).toBe(1);
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await fineTuningService.getDatasetById(999, 1);

      expect(result).toBeNull();
    });
  });

  describe('getDatasets()', () => {
    it('should return datasets for model', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, file_name: 'train.jsonl' },
          { id: 2, file_name: 'valid.jsonl' }
        ]
      });

      const result = await fineTuningService.getDatasets(1);

      expect(result).toHaveLength(2);
    });
  });

  describe('updateDataset()', () => {
    it('should update dataset fields', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'ready', row_count: 100 }]
      });

      const result = await fineTuningService.updateDataset(1, {
        status: 'ready',
        row_count: 100
      });

      expect(result.status).toBe('ready');
      expect(result.row_count).toBe(100);
    });

    it('should return null if no fields to update', async () => {
      const result = await fineTuningService.updateDataset(1, {});

      expect(result).toBeNull();
    });
  });

  describe('deleteDataset()', () => {
    it('should delete dataset', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1 }]
      });

      const result = await fineTuningService.deleteDataset(1, 1);

      expect(result.success).toBe(true);
    });

    it('should throw error if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        fineTuningService.deleteDataset(999, 1)
      ).rejects.toThrow('Dataset not found');
    });
  });
});
