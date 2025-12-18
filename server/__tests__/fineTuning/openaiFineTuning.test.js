/**
 * OpenAI Fine-Tuning Service Tests
 * Tests for OpenAI API integration: file upload, job management, model testing
 */

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Mock OpenAI SDK
const mockOpenAIClient = {
  files: {
    create: jest.fn(),
    retrieve: jest.fn(),
    del: jest.fn()
  },
  fineTuning: {
    jobs: {
      create: jest.fn(),
      retrieve: jest.fn(),
      list: jest.fn(),
      listEvents: jest.fn(),
      cancel: jest.fn()
    }
  },
  chat: {
    completions: {
      create: jest.fn()
    }
  },
  models: {
    del: jest.fn()
  }
};

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => mockOpenAIClient);
});

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  createReadStream: jest.fn().mockReturnValue({
    pipe: jest.fn()
  })
}));

// Set env before requiring the module
process.env.OPENAI_API_KEY = 'test-api-key';

const openaiFineTuning = require('../../services/openaiFineTuning');
const fs = require('fs');

describe('OpenAI Fine-Tuning Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // IS AVAILABLE
  // ========================================
  describe('isAvailable()', () => {
    it('should return true when OpenAI is configured', () => {
      expect(openaiFineTuning.isAvailable()).toBe(true);
    });
  });

  // ========================================
  // UPLOAD FILE
  // ========================================
  describe('uploadFile()', () => {
    it('should upload file to OpenAI', async () => {
      const mockFile = {
        id: 'file-123',
        filename: 'training.jsonl',
        purpose: 'fine-tune'
      };

      mockOpenAIClient.files.create.mockResolvedValueOnce(mockFile);

      const result = await openaiFineTuning.uploadFile('/path/to/file.jsonl');

      expect(result).toEqual(mockFile);
      expect(mockOpenAIClient.files.create).toHaveBeenCalledWith({
        file: expect.any(Object),
        purpose: 'fine-tune'
      });
    });

    it('should throw error if file not found', async () => {
      fs.existsSync.mockReturnValueOnce(false);

      await expect(
        openaiFineTuning.uploadFile('/nonexistent/file.jsonl')
      ).rejects.toThrow('File not found');
    });

    it('should throw error for non-JSONL files', async () => {
      await expect(
        openaiFineTuning.uploadFile('/path/to/file.csv')
      ).rejects.toThrow('File must be in JSONL format');
    });

    it('should throw error on API failure', async () => {
      mockOpenAIClient.files.create.mockRejectedValueOnce(
        new Error('API error')
      );

      await expect(
        openaiFineTuning.uploadFile('/path/to/file.jsonl')
      ).rejects.toThrow('OpenAI file upload failed');
    });
  });

  // ========================================
  // CREATE FINE-TUNE JOB
  // ========================================
  describe('createFineTuneJob()', () => {
    it('should create fine-tuning job', async () => {
      const mockJob = {
        id: 'ftjob-123',
        model: 'gpt-3.5-turbo',
        status: 'validating_files'
      };

      mockOpenAIClient.fineTuning.jobs.create.mockResolvedValueOnce(mockJob);

      const result = await openaiFineTuning.createFineTuneJob(
        'file-123',
        'gpt-3.5-turbo',
        { n_epochs: 3 }
      );

      expect(result).toEqual(mockJob);
      expect(mockOpenAIClient.fineTuning.jobs.create).toHaveBeenCalledWith({
        training_file: 'file-123',
        model: 'gpt-3.5-turbo',
        hyperparameters: { n_epochs: 3 }
      });
    });

    it('should use gpt-4-0613 for gpt-4 models', async () => {
      const mockJob = { id: 'ftjob-456', status: 'validating_files' };
      mockOpenAIClient.fineTuning.jobs.create.mockResolvedValueOnce(mockJob);

      await openaiFineTuning.createFineTuneJob('file-123', 'gpt-4');

      expect(mockOpenAIClient.fineTuning.jobs.create).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-4-0613' })
      );
    });

    it('should include validation file if provided', async () => {
      const mockJob = { id: 'ftjob-789', status: 'validating_files' };
      mockOpenAIClient.fineTuning.jobs.create.mockResolvedValueOnce(mockJob);

      await openaiFineTuning.createFineTuneJob('file-123', 'gpt-3.5-turbo', {
        validation_file: 'file-456'
      });

      expect(mockOpenAIClient.fineTuning.jobs.create).toHaveBeenCalledWith(
        expect.objectContaining({ validation_file: 'file-456' })
      );
    });

    it('should include suffix if provided', async () => {
      const mockJob = { id: 'ftjob-101', status: 'validating_files' };
      mockOpenAIClient.fineTuning.jobs.create.mockResolvedValueOnce(mockJob);

      await openaiFineTuning.createFineTuneJob('file-123', 'gpt-3.5-turbo', {
        suffix: 'custom-model'
      });

      expect(mockOpenAIClient.fineTuning.jobs.create).toHaveBeenCalledWith(
        expect.objectContaining({ suffix: 'custom-model' })
      );
    });

    it('should throw error on API failure', async () => {
      mockOpenAIClient.fineTuning.jobs.create.mockRejectedValueOnce(
        new Error('Invalid file')
      );

      await expect(
        openaiFineTuning.createFineTuneJob('file-123', 'gpt-3.5-turbo')
      ).rejects.toThrow('OpenAI fine-tuning job creation failed');
    });
  });

  // ========================================
  // GET JOB STATUS
  // ========================================
  describe('getJobStatus()', () => {
    it('should return job status', async () => {
      const mockStatus = {
        id: 'ftjob-123',
        status: 'running',
        model: 'gpt-3.5-turbo',
        fine_tuned_model: null,
        created_at: 1699000000,
        finished_at: null,
        trained_tokens: 1500,
        error: null,
        hyperparameters: { n_epochs: 3 },
        result_files: [],
        training_file: 'file-123'
      };

      mockOpenAIClient.fineTuning.jobs.retrieve.mockResolvedValueOnce(mockStatus);

      const result = await openaiFineTuning.getJobStatus('ftjob-123');

      expect(result.id).toBe('ftjob-123');
      expect(result.status).toBe('running');
      expect(result.trained_tokens).toBe(1500);
    });

    it('should return completed job with model', async () => {
      const mockStatus = {
        id: 'ftjob-123',
        status: 'succeeded',
        fine_tuned_model: 'ft:gpt-3.5-turbo:org:model:id',
        trained_tokens: 5000
      };

      mockOpenAIClient.fineTuning.jobs.retrieve.mockResolvedValueOnce(mockStatus);

      const result = await openaiFineTuning.getJobStatus('ftjob-123');

      expect(result.status).toBe('succeeded');
      expect(result.fine_tuned_model).toBe('ft:gpt-3.5-turbo:org:model:id');
    });

    it('should throw error on API failure', async () => {
      mockOpenAIClient.fineTuning.jobs.retrieve.mockRejectedValueOnce(
        new Error('Job not found')
      );

      await expect(
        openaiFineTuning.getJobStatus('invalid-id')
      ).rejects.toThrow('Failed to get job status');
    });
  });

  // ========================================
  // LIST JOB EVENTS
  // ========================================
  describe('listJobEvents()', () => {
    it('should return job events', async () => {
      const mockEvents = {
        data: [
          { id: 'evt-1', level: 'info', message: 'Training started', created_at: 1699000000 },
          { id: 'evt-2', level: 'info', message: 'Step 100', created_at: 1699001000 }
        ]
      };

      mockOpenAIClient.fineTuning.jobs.listEvents.mockResolvedValueOnce(mockEvents);

      const result = await openaiFineTuning.listJobEvents('ftjob-123');

      expect(result).toHaveLength(2);
      expect(result[0].message).toBe('Training started');
    });

    it('should respect limit parameter', async () => {
      mockOpenAIClient.fineTuning.jobs.listEvents.mockResolvedValueOnce({ data: [] });

      await openaiFineTuning.listJobEvents('ftjob-123', 50);

      expect(mockOpenAIClient.fineTuning.jobs.listEvents).toHaveBeenCalledWith(
        'ftjob-123',
        { limit: 50 }
      );
    });

    it('should throw error on API failure', async () => {
      mockOpenAIClient.fineTuning.jobs.listEvents.mockRejectedValueOnce(
        new Error('API error')
      );

      await expect(
        openaiFineTuning.listJobEvents('ftjob-123')
      ).rejects.toThrow('Failed to list job events');
    });
  });

  // ========================================
  // CANCEL JOB
  // ========================================
  describe('cancelJob()', () => {
    it('should cancel running job', async () => {
      const mockCancelled = {
        id: 'ftjob-123',
        status: 'cancelled'
      };

      mockOpenAIClient.fineTuning.jobs.cancel.mockResolvedValueOnce(mockCancelled);

      const result = await openaiFineTuning.cancelJob('ftjob-123');

      expect(result.status).toBe('cancelled');
    });

    it('should throw error on API failure', async () => {
      mockOpenAIClient.fineTuning.jobs.cancel.mockRejectedValueOnce(
        new Error('Cannot cancel completed job')
      );

      await expect(
        openaiFineTuning.cancelJob('ftjob-123')
      ).rejects.toThrow('Failed to cancel job');
    });
  });

  // ========================================
  // TEST MODEL
  // ========================================
  describe('testModel()', () => {
    it('should test fine-tuned model', async () => {
      const mockCompletion = {
        choices: [
          {
            message: { content: 'Test response' },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15
        }
      };

      mockOpenAIClient.chat.completions.create.mockResolvedValueOnce(mockCompletion);

      const result = await openaiFineTuning.testModel(
        'ft:gpt-3.5-turbo:org:model:id',
        'Hello, how are you?'
      );

      expect(result.model_id).toBe('ft:gpt-3.5-turbo:org:model:id');
      expect(result.response).toBe('Test response');
      expect(result.usage.total_tokens).toBe(15);
    });

    it('should include system message if provided', async () => {
      mockOpenAIClient.chat.completions.create.mockResolvedValueOnce({
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { total_tokens: 20 }
      });

      await openaiFineTuning.testModel(
        'ft:gpt-3.5-turbo:org:model:id',
        'Test prompt',
        { systemMessage: 'You are a helpful assistant.' }
      );

      expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            { role: 'system', content: 'You are a helpful assistant.' }
          ])
        })
      );
    });

    it('should use custom max tokens and temperature', async () => {
      mockOpenAIClient.chat.completions.create.mockResolvedValueOnce({
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { total_tokens: 20 }
      });

      await openaiFineTuning.testModel(
        'ft:gpt-3.5-turbo:org:model:id',
        'Test prompt',
        { maxTokens: 1000, temperature: 0.5 }
      );

      expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 1000,
          temperature: 0.5
        })
      );
    });

    it('should throw error if model ID missing', async () => {
      await expect(
        openaiFineTuning.testModel(null, 'Test prompt')
      ).rejects.toThrow('Model ID is required');
    });

    it('should throw error if prompt missing', async () => {
      await expect(
        openaiFineTuning.testModel('ft:gpt-3.5-turbo:org:model:id', null)
      ).rejects.toThrow('Prompt is required');
    });

    it('should throw error on API failure', async () => {
      mockOpenAIClient.chat.completions.create.mockRejectedValueOnce(
        new Error('Model not found')
      );

      await expect(
        openaiFineTuning.testModel('ft:gpt-3.5-turbo:org:model:id', 'Test')
      ).rejects.toThrow('Failed to test model');
    });
  });

  // ========================================
  // ESTIMATE TRAINING COST
  // ========================================
  describe('estimateTrainingCost()', () => {
    it('should calculate cost for gpt-3.5-turbo', () => {
      const result = openaiFineTuning.estimateTrainingCost(10000, 3, 'gpt-3.5-turbo');

      expect(result.token_count).toBe(10000);
      expect(result.epochs).toBe(3);
      expect(result.total_tokens).toBe(30000);
      expect(result.price_per_1k).toBe(0.008);
      expect(result.estimated_cost).toBe(0.24);
      expect(result.formatted).toBe('$0.24');
    });

    it('should calculate cost for gpt-4', () => {
      const result = openaiFineTuning.estimateTrainingCost(10000, 3, 'gpt-4');

      expect(result.price_per_1k).toBe(0.03);
      expect(result.estimated_cost).toBe(0.9);
    });

    it('should use default model if not specified', () => {
      const result = openaiFineTuning.estimateTrainingCost(5000);

      expect(result.epochs).toBe(3);
      expect(result.total_tokens).toBe(15000);
    });

    it('should handle custom epochs', () => {
      const result = openaiFineTuning.estimateTrainingCost(10000, 5);

      expect(result.epochs).toBe(5);
      expect(result.total_tokens).toBe(50000);
    });
  });

  // ========================================
  // DELETE MODEL
  // ========================================
  describe('deleteModel()', () => {
    it('should delete fine-tuned model', async () => {
      mockOpenAIClient.models.del.mockResolvedValueOnce({
        id: 'ft:gpt-3.5-turbo:org:model:id',
        deleted: true
      });

      const result = await openaiFineTuning.deleteModel('ft:gpt-3.5-turbo:org:model:id');

      expect(result.deleted).toBe(true);
    });

    it('should throw error for invalid model ID', async () => {
      await expect(
        openaiFineTuning.deleteModel('invalid-model-id')
      ).rejects.toThrow('Invalid fine-tuned model ID');
    });

    it('should throw error for null model ID', async () => {
      await expect(
        openaiFineTuning.deleteModel(null)
      ).rejects.toThrow('Invalid fine-tuned model ID');
    });
  });

  // ========================================
  // DELETE FILE
  // ========================================
  describe('deleteFile()', () => {
    it('should delete file from OpenAI', async () => {
      mockOpenAIClient.files.del.mockResolvedValueOnce({
        id: 'file-123',
        deleted: true
      });

      const result = await openaiFineTuning.deleteFile('file-123');

      expect(result.deleted).toBe(true);
    });

    it('should throw error on API failure', async () => {
      mockOpenAIClient.files.del.mockRejectedValueOnce(
        new Error('File not found')
      );

      await expect(
        openaiFineTuning.deleteFile('invalid-file')
      ).rejects.toThrow('Failed to delete file');
    });
  });

  // ========================================
  // LIST JOBS
  // ========================================
  describe('listJobs()', () => {
    it('should list fine-tuning jobs', async () => {
      const mockJobs = {
        data: [
          { id: 'ftjob-1', status: 'succeeded' },
          { id: 'ftjob-2', status: 'running' }
        ]
      };

      mockOpenAIClient.fineTuning.jobs.list.mockResolvedValueOnce(mockJobs);

      const result = await openaiFineTuning.listJobs(20);

      expect(result).toHaveLength(2);
      expect(mockOpenAIClient.fineTuning.jobs.list).toHaveBeenCalledWith({ limit: 20 });
    });
  });

  // ========================================
  // GET FILE
  // ========================================
  describe('getFile()', () => {
    it('should retrieve file info', async () => {
      const mockFile = {
        id: 'file-123',
        filename: 'training.jsonl',
        purpose: 'fine-tune',
        bytes: 10240
      };

      mockOpenAIClient.files.retrieve.mockResolvedValueOnce(mockFile);

      const result = await openaiFineTuning.getFile('file-123');

      expect(result.id).toBe('file-123');
      expect(result.purpose).toBe('fine-tune');
    });

    it('should throw error on API failure', async () => {
      mockOpenAIClient.files.retrieve.mockRejectedValueOnce(
        new Error('File not found')
      );

      await expect(
        openaiFineTuning.getFile('invalid-file')
      ).rejects.toThrow('Failed to get file');
    });
  });
});
