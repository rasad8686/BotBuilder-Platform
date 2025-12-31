/**
 * Fine-Tuning Controller Tests
 * Tests for server/controllers/fineTuningController.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../services/openaiFineTuning', () => ({
  isAvailable: jest.fn(),
  uploadFile: jest.fn(),
  createFineTuneJob: jest.fn(),
  getJobStatus: jest.fn(),
  listJobEvents: jest.fn(),
  cancelJob: jest.fn(),
  testModel: jest.fn()
}));

jest.mock('../../services/datasetValidator', () => ({
  convertCSVtoJSONL: jest.fn(),
  convertJSONtoJSONL: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn()
  }
}));

const db = require('../../db');
const openaiFineTuning = require('../../services/openaiFineTuning');
const datasetValidator = require('../../services/datasetValidator');
const {
  startTraining,
  updateJobStatus,
  getTrainingEvents,
  cancelTraining,
  testModel
} = require('../../controllers/fineTuningController');

describe('Fine-Tuning Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('startTraining', () => {
    it('should throw error if model not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(startTraining(1, 1, {}))
        .rejects.toThrow('Model not found');
    });

    it('should throw error if model is already training', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, status: 'training' }]
      });

      await expect(startTraining(1, 1, {}))
        .rejects.toThrow('Model is already in training');
    });

    it('should throw error if no dataset available', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'draft', base_model: 'gpt-3.5-turbo' }] })
        .mockResolvedValueOnce({ rows: [] });

      await expect(startTraining(1, 1, {}))
        .rejects.toThrow('No valid dataset available');
    });

    it('should start simulated training when OpenAI not available', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'draft', base_model: 'gpt-3.5-turbo' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, file_path: '/test/data.jsonl', status: 'ready' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, job_id: 'sim_123' }] })
        .mockResolvedValue({});

      openaiFineTuning.isAvailable.mockReturnValue(false);

      const result = await startTraining(1, 1, { epochs: 3 });

      expect(result.simulation).toBe(true);
      expect(result.job).toBeDefined();
    });

    it('should start real training with OpenAI', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'draft', base_model: 'gpt-3.5-turbo' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, file_path: '/test/data.jsonl', status: 'ready' }] })
        .mockResolvedValue({ rows: [{ id: 1 }] });

      openaiFineTuning.isAvailable.mockReturnValue(true);
      openaiFineTuning.uploadFile.mockResolvedValue({ id: 'file-123' });
      openaiFineTuning.createFineTuneJob.mockResolvedValue({ id: 'ftjob-123', status: 'pending' });

      const result = await startTraining(1, 1, { epochs: 3 });

      expect(result.openai_job).toBeDefined();
      expect(openaiFineTuning.uploadFile).toHaveBeenCalled();
      expect(openaiFineTuning.createFineTuneJob).toHaveBeenCalled();
    });

    it('should convert CSV to JSONL before training', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'draft', base_model: 'gpt-3.5-turbo' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, file_path: '/test/data.csv', status: 'ready' }] })
        .mockResolvedValue({ rows: [{ id: 1 }] });

      openaiFineTuning.isAvailable.mockReturnValue(false);
      datasetValidator.convertCSVtoJSONL.mockResolvedValue();

      await startTraining(1, 1, {});

      expect(datasetValidator.convertCSVtoJSONL).toHaveBeenCalled();
    });

    it('should convert JSON to JSONL before training', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'draft', base_model: 'gpt-3.5-turbo' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, file_path: '/test/data.json', status: 'ready' }] })
        .mockResolvedValue({ rows: [{ id: 1 }] });

      openaiFineTuning.isAvailable.mockReturnValue(false);
      datasetValidator.convertJSONtoJSONL.mockResolvedValue();

      await startTraining(1, 1, {});

      expect(datasetValidator.convertJSONtoJSONL).toHaveBeenCalled();
    });

    it('should throw error on unsupported file format', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'draft', base_model: 'gpt-3.5-turbo' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, file_path: '/test/data.txt', status: 'ready' }] });

      openaiFineTuning.isAvailable.mockReturnValue(true);

      await expect(startTraining(1, 1, {}))
        .rejects.toThrow('Unsupported file format');
    });

    it('should handle OpenAI upload failure', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'draft', base_model: 'gpt-3.5-turbo' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, file_path: '/test/data.jsonl', status: 'ready' }] })
        .mockResolvedValue({});

      openaiFineTuning.isAvailable.mockReturnValue(true);
      openaiFineTuning.uploadFile.mockRejectedValue(new Error('Upload failed'));

      await expect(startTraining(1, 1, {}))
        .rejects.toThrow('Failed to upload file to OpenAI');
    });

    it('should handle OpenAI job creation failure', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'draft', base_model: 'gpt-3.5-turbo' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, file_path: '/test/data.jsonl', status: 'ready' }] })
        .mockResolvedValue({});

      openaiFineTuning.isAvailable.mockReturnValue(true);
      openaiFineTuning.uploadFile.mockResolvedValue({ id: 'file-123' });
      openaiFineTuning.createFineTuneJob.mockRejectedValue(new Error('Job creation failed'));

      await expect(startTraining(1, 1, {}))
        .rejects.toThrow('Failed to create fine-tuning job');
    });
  });

  describe('updateJobStatus', () => {
    it('should skip update for simulation', async () => {
      openaiFineTuning.isAvailable.mockReturnValue(false);

      const result = await updateJobStatus('job-123', 1, 1);

      expect(result).toBeUndefined();
      expect(openaiFineTuning.getJobStatus).not.toHaveBeenCalled();
    });

    it('should update job status from OpenAI', async () => {
      openaiFineTuning.isAvailable.mockReturnValue(true);
      openaiFineTuning.getJobStatus.mockResolvedValue({
        status: 'running',
        trained_tokens: 1000
      });
      db.query.mockResolvedValue({});

      const result = await updateJobStatus('job-123', 1, 1);

      expect(result.status).toBe('running');
      expect(db.query).toHaveBeenCalled();
    });

    it('should update model on job success', async () => {
      openaiFineTuning.isAvailable.mockReturnValue(true);
      openaiFineTuning.getJobStatus.mockResolvedValue({
        status: 'succeeded',
        trained_tokens: 5000,
        fine_tuned_model: 'ft:gpt-3.5-turbo:org:model-1'
      });
      db.query.mockResolvedValue({});

      await updateJobStatus('job-123', 1, 1);

      expect(db.query).toHaveBeenCalledTimes(2);
    });

    it('should update model on job failure', async () => {
      openaiFineTuning.isAvailable.mockReturnValue(true);
      openaiFineTuning.getJobStatus.mockResolvedValue({
        status: 'failed',
        error: { message: 'Training failed' }
      });
      db.query.mockResolvedValue({});

      await updateJobStatus('job-123', 1, 1);

      expect(db.query).toHaveBeenCalledTimes(2);
    });

    it('should update model on job cancellation', async () => {
      openaiFineTuning.isAvailable.mockReturnValue(true);
      openaiFineTuning.getJobStatus.mockResolvedValue({
        status: 'cancelled'
      });
      db.query.mockResolvedValue({});

      await updateJobStatus('job-123', 1, 1);

      expect(db.query).toHaveBeenCalledTimes(2);
    });

    it('should handle status update errors', async () => {
      openaiFineTuning.isAvailable.mockReturnValue(true);
      openaiFineTuning.getJobStatus.mockRejectedValue(new Error('API error'));

      await expect(updateJobStatus('job-123', 1, 1))
        .rejects.toThrow('API error');
    });
  });

  describe('getTrainingEvents', () => {
    it('should throw error if model not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(getTrainingEvents(1, 1))
        .rejects.toThrow('Model not found');
    });

    it('should return empty array if no jobs', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await getTrainingEvents(1, 1);

      expect(result).toEqual([]);
    });

    it('should return mock events for simulation', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            provider: 'simulation',
            status: 'succeeded',
            started_at: new Date(),
            result_model_id: 'ft:gpt-3.5-turbo:simulation:123'
          }]
        });

      const result = await getTrainingEvents(1, 1);

      expect(result.length).toBeGreaterThan(0);
    });

    it('should return events from OpenAI', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            provider: 'openai',
            job_id: 'ftjob-123',
            status: 'running'
          }]
        });

      openaiFineTuning.isAvailable.mockReturnValue(true);
      openaiFineTuning.listJobEvents.mockResolvedValue([
        { id: 'evt_1', message: 'Training started' }
      ]);

      const result = await getTrainingEvents(1, 1);

      expect(result).toHaveLength(1);
    });

    it('should return empty array on OpenAI error', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            provider: 'openai',
            job_id: 'ftjob-123'
          }]
        });

      openaiFineTuning.isAvailable.mockReturnValue(true);
      openaiFineTuning.listJobEvents.mockRejectedValue(new Error('API error'));

      const result = await getTrainingEvents(1, 1);

      expect(result).toEqual([]);
    });
  });

  describe('cancelTraining', () => {
    it('should throw error if model not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(cancelTraining(1, 1))
        .rejects.toThrow('Model not found');
    });

    it('should throw error if model is not training', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, status: 'draft' }]
      });

      await expect(cancelTraining(1, 1))
        .rejects.toThrow('Model is not currently training');
    });

    it('should throw error if no active job', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'training' }] })
        .mockResolvedValueOnce({ rows: [] });

      await expect(cancelTraining(1, 1))
        .rejects.toThrow('No active training job found');
    });

    it('should cancel OpenAI job', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'training' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, provider: 'openai', job_id: 'ftjob-123' }] })
        .mockResolvedValue({});

      openaiFineTuning.isAvailable.mockReturnValue(true);
      openaiFineTuning.cancelJob.mockResolvedValue({});

      const result = await cancelTraining(1, 1);

      expect(result.success).toBe(true);
      expect(openaiFineTuning.cancelJob).toHaveBeenCalledWith('ftjob-123');
    });

    it('should cancel simulation job without OpenAI call', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'training' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, provider: 'simulation', job_id: 'sim_123' }] })
        .mockResolvedValue({});

      const result = await cancelTraining(1, 1);

      expect(result.success).toBe(true);
      expect(openaiFineTuning.cancelJob).not.toHaveBeenCalled();
    });

    it('should handle OpenAI cancel error gracefully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'training' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, provider: 'openai', job_id: 'ftjob-123' }] })
        .mockResolvedValue({});

      openaiFineTuning.isAvailable.mockReturnValue(true);
      openaiFineTuning.cancelJob.mockRejectedValue(new Error('Cancel failed'));

      const result = await cancelTraining(1, 1);

      expect(result.success).toBe(true); // Still succeeds even if OpenAI fails
    });
  });

  describe('testModel', () => {
    it('should throw error if model not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(testModel(1, 1, 'Hello'))
        .rejects.toThrow('Model not found');
    });

    it('should throw error if model not trained', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, model_id: null }]
      });

      await expect(testModel(1, 1, 'Hello'))
        .rejects.toThrow('Model has not been trained yet');
    });

    it('should throw error if model not completed', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, model_id: 'ft:model', status: 'training' }]
      });

      await expect(testModel(1, 1, 'Hello'))
        .rejects.toThrow('Model training is not complete');
    });

    it('should return mock response for simulation model', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          model_id: 'ft:gpt-3.5-turbo:simulation:123',
          status: 'completed'
        }]
      });

      const result = await testModel(1, 1, 'Hello');

      expect(result.simulation).toBe(true);
      expect(result.response).toContain('Simulated response');
    });

    it('should throw error if OpenAI not available for real model', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          model_id: 'ft:gpt-3.5-turbo:org:real-model',
          status: 'completed'
        }]
      });

      openaiFineTuning.isAvailable.mockReturnValue(false);

      await expect(testModel(1, 1, 'Hello'))
        .rejects.toThrow('OpenAI API is not available');
    });

    it('should test with OpenAI', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          model_id: 'ft:gpt-3.5-turbo:org:real-model',
          status: 'completed'
        }]
      });

      openaiFineTuning.isAvailable.mockReturnValue(true);
      openaiFineTuning.testModel.mockResolvedValue({
        response: 'Hello back!',
        usage: { total_tokens: 10 }
      });

      const result = await testModel(1, 1, 'Hello');

      expect(result.response).toBe('Hello back!');
    });
  });
});
