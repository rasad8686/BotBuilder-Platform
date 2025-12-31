/**
 * OpenAI Fine-Tuning Service Tests
 * Tests for server/services/openaiFineTuning.js
 */

// Store original env
const originalEnv = process.env;

// Shared mock objects - defined in outer scope so they persist across resetModules
const mockFiles = {
  create: jest.fn(),
  retrieve: jest.fn(),
  del: jest.fn()
};

const mockFineTuning = {
  jobs: {
    create: jest.fn(),
    retrieve: jest.fn(),
    cancel: jest.fn(),
    list: jest.fn(),
    listEvents: jest.fn()
  }
};

const mockChat = {
  completions: {
    create: jest.fn()
  }
};

const mockModels = {
  del: jest.fn()
};

// Mock OpenAI before requiring the module
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    files: mockFiles,
    fineTuning: mockFineTuning,
    chat: mockChat,
    models: mockModels
  }));
});

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  createReadStream: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('OpenAI Fine-Tuning Service', () => {
  let openaiFineTuning;
  let fs;

  beforeEach(() => {
    // Clear all mocks but keep implementations
    jest.clearAllMocks();
    jest.resetModules();

    // Set up environment
    process.env = { ...originalEnv, OPENAI_API_KEY: 'test-api-key' };

    // Re-require fs after resetModules
    fs = require('fs');

    // Re-require the module to get fresh state
    openaiFineTuning = require('../../services/openaiFineTuning');
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isAvailable', () => {
    it('should return true when API key is configured', () => {
      const result = openaiFineTuning.isAvailable();
      expect(result).toBe(true);
    });
  });

  describe('uploadFile', () => {
    it('should upload file to OpenAI', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.createReadStream.mockReturnValue({ pipe: jest.fn() });
      mockFiles.create.mockResolvedValue({
        id: 'file-123',
        filename: 'data.jsonl'
      });

      const result = await openaiFineTuning.uploadFile('/path/to/data.jsonl');

      expect(result.id).toBe('file-123');
      expect(fs.createReadStream).toHaveBeenCalledWith('/path/to/data.jsonl');
    });

    it('should throw if file not found', async () => {
      fs.existsSync.mockReturnValue(false);

      await expect(openaiFineTuning.uploadFile('/path/to/missing.jsonl'))
        .rejects.toThrow('File not found');
    });

    it('should throw if file is not JSONL', async () => {
      fs.existsSync.mockReturnValue(true);

      await expect(openaiFineTuning.uploadFile('/path/to/data.csv'))
        .rejects.toThrow('File must be in JSONL format');
    });

    it('should throw on upload error', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.createReadStream.mockReturnValue({ pipe: jest.fn() });
      mockFiles.create.mockRejectedValue(new Error('Upload failed'));

      await expect(openaiFineTuning.uploadFile('/path/to/data.jsonl'))
        .rejects.toThrow('OpenAI file upload failed');
    });
  });

  describe('createFineTuneJob', () => {
    it('should create fine-tuning job', async () => {
      mockFineTuning.jobs.create.mockResolvedValue({
        id: 'ftjob-123',
        status: 'queued'
      });

      const result = await openaiFineTuning.createFineTuneJob('file-123', 'gpt-3.5-turbo', {
        epochs: 3
      });

      expect(result.id).toBe('ftjob-123');
      expect(mockFineTuning.jobs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          training_file: 'file-123',
          model: 'gpt-3.5-turbo',
          hyperparameters: { n_epochs: 3 }
        })
      );
    });

    it('should use gpt-4-0613 for gpt-4 models', async () => {
      mockFineTuning.jobs.create.mockResolvedValue({ id: 'ftjob-123' });

      await openaiFineTuning.createFineTuneJob('file-123', 'gpt-4');

      expect(mockFineTuning.jobs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4-0613'
        })
      );
    });

    it('should include validation file if provided', async () => {
      mockFineTuning.jobs.create.mockResolvedValue({ id: 'ftjob-123' });

      await openaiFineTuning.createFineTuneJob('file-123', 'gpt-3.5-turbo', {
        validation_file: 'file-val-123'
      });

      expect(mockFineTuning.jobs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          validation_file: 'file-val-123'
        })
      );
    });

    it('should include suffix if provided', async () => {
      mockFineTuning.jobs.create.mockResolvedValue({ id: 'ftjob-123' });

      await openaiFineTuning.createFineTuneJob('file-123', 'gpt-3.5-turbo', {
        suffix: 'my-model'
      });

      expect(mockFineTuning.jobs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          suffix: 'my-model'
        })
      );
    });

    it('should throw on creation error', async () => {
      mockFineTuning.jobs.create.mockRejectedValue(new Error('Creation failed'));

      await expect(openaiFineTuning.createFineTuneJob('file-123'))
        .rejects.toThrow('OpenAI fine-tuning job creation failed');
    });
  });

  describe('getJobStatus', () => {
    it('should return job status', async () => {
      mockFineTuning.jobs.retrieve.mockResolvedValue({
        id: 'ftjob-123',
        status: 'running',
        model: 'gpt-3.5-turbo',
        fine_tuned_model: null,
        trained_tokens: 5000
      });

      const result = await openaiFineTuning.getJobStatus('ftjob-123');

      expect(result.id).toBe('ftjob-123');
      expect(result.status).toBe('running');
      expect(result.trained_tokens).toBe(5000);
    });

    it('should throw on retrieval error', async () => {
      mockFineTuning.jobs.retrieve.mockRejectedValue(new Error('Not found'));

      await expect(openaiFineTuning.getJobStatus('invalid'))
        .rejects.toThrow('Failed to get job status');
    });
  });

  describe('listJobEvents', () => {
    it('should return job events', async () => {
      mockFineTuning.jobs.listEvents.mockResolvedValue({
        data: [
          { id: 'evt-1', level: 'info', message: 'Training started', created_at: 1234567890 },
          { id: 'evt-2', level: 'info', message: 'Epoch 1 complete', created_at: 1234567900 }
        ]
      });

      const result = await openaiFineTuning.listJobEvents('ftjob-123');

      expect(result).toHaveLength(2);
      expect(result[0].message).toBe('Training started');
    });

    it('should respect limit parameter', async () => {
      mockFineTuning.jobs.listEvents.mockResolvedValue({ data: [] });

      await openaiFineTuning.listJobEvents('ftjob-123', 50);

      expect(mockFineTuning.jobs.listEvents).toHaveBeenCalledWith('ftjob-123', { limit: 50 });
    });
  });

  describe('cancelJob', () => {
    it('should cancel job', async () => {
      mockFineTuning.jobs.cancel.mockResolvedValue({
        id: 'ftjob-123',
        status: 'cancelled'
      });

      const result = await openaiFineTuning.cancelJob('ftjob-123');

      expect(result.status).toBe('cancelled');
    });

    it('should throw on cancel error', async () => {
      mockFineTuning.jobs.cancel.mockRejectedValue(new Error('Cancel failed'));

      await expect(openaiFineTuning.cancelJob('ftjob-123'))
        .rejects.toThrow('Failed to cancel job');
    });
  });

  describe('deleteModel', () => {
    it('should delete fine-tuned model', async () => {
      mockModels.del.mockResolvedValue({
        deleted: true
      });

      const result = await openaiFineTuning.deleteModel('ft:gpt-3.5-turbo:custom');

      expect(result.deleted).toBe(true);
    });

    it('should throw for invalid model ID', async () => {
      await expect(openaiFineTuning.deleteModel('gpt-3.5-turbo'))
        .rejects.toThrow('Invalid fine-tuned model ID');
    });

    it('should throw for null model ID', async () => {
      await expect(openaiFineTuning.deleteModel(null))
        .rejects.toThrow('Invalid fine-tuned model ID');
    });
  });

  describe('deleteFile', () => {
    it('should delete file', async () => {
      mockFiles.del.mockResolvedValue({
        deleted: true
      });

      const result = await openaiFineTuning.deleteFile('file-123');

      expect(result.deleted).toBe(true);
    });

    it('should throw on delete error', async () => {
      mockFiles.del.mockRejectedValue(new Error('Delete failed'));

      await expect(openaiFineTuning.deleteFile('file-123'))
        .rejects.toThrow('Failed to delete file');
    });
  });

  describe('testModel', () => {
    it('should test model with prompt', async () => {
      mockChat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Hello!' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 }
      });

      const result = await openaiFineTuning.testModel('ft:gpt-3.5-turbo:custom', 'Hi');

      expect(result.response).toBe('Hello!');
      expect(result.usage.total_tokens).toBe(8);
    });

    it('should include system message if provided', async () => {
      mockChat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Response' } }],
        usage: {}
      });

      await openaiFineTuning.testModel('ft:gpt-3.5-turbo:custom', 'Hi', {
        systemMessage: 'You are a helpful assistant'
      });

      expect(mockChat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            { role: 'system', content: 'You are a helpful assistant' }
          ])
        })
      );
    });

    it('should throw if model ID missing', async () => {
      await expect(openaiFineTuning.testModel(null, 'Hi'))
        .rejects.toThrow('Model ID is required');
    });

    it('should throw if prompt missing', async () => {
      await expect(openaiFineTuning.testModel('ft:model', null))
        .rejects.toThrow('Prompt is required');
    });

    it('should use custom options', async () => {
      mockChat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Response' } }],
        usage: {}
      });

      await openaiFineTuning.testModel('ft:model', 'Hi', {
        maxTokens: 100,
        temperature: 0.5
      });

      expect(mockChat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 100,
          temperature: 0.5
        })
      );
    });
  });

  describe('listJobs', () => {
    it('should list fine-tuning jobs', async () => {
      mockFineTuning.jobs.list.mockResolvedValue({
        data: [
          { id: 'ftjob-1', status: 'succeeded' },
          { id: 'ftjob-2', status: 'running' }
        ]
      });

      const result = await openaiFineTuning.listJobs();

      expect(result).toHaveLength(2);
    });

    it('should respect limit parameter', async () => {
      mockFineTuning.jobs.list.mockResolvedValue({ data: [] });

      await openaiFineTuning.listJobs(10);

      expect(mockFineTuning.jobs.list).toHaveBeenCalledWith({ limit: 10 });
    });
  });

  describe('getFile', () => {
    it('should retrieve file info', async () => {
      mockFiles.retrieve.mockResolvedValue({
        id: 'file-123',
        filename: 'data.jsonl',
        bytes: 1024
      });

      const result = await openaiFineTuning.getFile('file-123');

      expect(result.id).toBe('file-123');
      expect(result.filename).toBe('data.jsonl');
    });

    it('should throw on retrieval error', async () => {
      mockFiles.retrieve.mockRejectedValue(new Error('Not found'));

      await expect(openaiFineTuning.getFile('invalid'))
        .rejects.toThrow('Failed to get file');
    });
  });

  describe('estimateTrainingCost', () => {
    it('should estimate cost for gpt-3.5-turbo', () => {
      const result = openaiFineTuning.estimateTrainingCost(10000, 3, 'gpt-3.5-turbo');

      expect(result.token_count).toBe(10000);
      expect(result.epochs).toBe(3);
      expect(result.total_tokens).toBe(30000);
      expect(result.price_per_1k).toBe(0.008);
      expect(result.estimated_cost).toBe(0.24);
      expect(result.formatted).toBe('$0.24');
    });

    it('should estimate cost for gpt-4', () => {
      const result = openaiFineTuning.estimateTrainingCost(10000, 3, 'gpt-4');

      expect(result.price_per_1k).toBe(0.03);
      expect(result.estimated_cost).toBe(0.9);
    });

    it('should use default model pricing for unknown models', () => {
      const result = openaiFineTuning.estimateTrainingCost(10000, 3, 'unknown-model');

      expect(result.price_per_1k).toBe(0.008); // gpt-3.5-turbo default
    });

    it('should use default epochs if not specified', () => {
      const result = openaiFineTuning.estimateTrainingCost(10000);

      expect(result.epochs).toBe(3);
    });
  });
});
