/**
 * CloneService Tests
 * Comprehensive tests for the main clone orchestration service
 */

// Mock db
const mockQuery = jest.fn();
jest.mock('../../../db', () => ({
  query: (...args) => mockQuery(...args)
}));

// Mock logger - keep reference so we can check calls
const mockLog = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};
jest.mock('../../../utils/logger', () => mockLog);

// Mock clone engines
jest.mock('../../../services/clone/VoiceCloneEngine', () => {
  return jest.fn().mockImplementation(() => ({
    processAudioSample: jest.fn().mockResolvedValue({
      success: true,
      qualityScore: 0.9,
      features: { duration: 30 },
      processedPath: '/processed/audio.wav'
    }),
    trainVoiceClone: jest.fn().mockResolvedValue({
      success: true,
      voiceId: 'voice-123',
      providerVoiceId: 'provider-voice-123',
      modelPath: '/models/voice-123',
      settings: { stability: 0.5 },
      metrics: { quality: 0.92 }
    }),
    synthesize: jest.fn().mockResolvedValue({
      success: true,
      audioUrl: 'https://example.com/audio.mp3',
      latencyMs: 500
    })
  }));
});

jest.mock('../../../services/clone/StyleCloneEngine', () => {
  return jest.fn().mockImplementation(() => ({
    analyzeText: jest.fn().mockResolvedValue({
      success: true,
      analysis: { formality: 'neutral', tone: 'professional' },
      qualityScore: 0.85
    }),
    trainStyleClone: jest.fn().mockResolvedValue({
      success: true,
      styleProfile: {
        formalityLevel: 'neutral',
        tone: 'professional',
        vocabularyComplexity: 'medium',
        avgSentenceLength: 15,
        avgParagraphLength: 4
      },
      metrics: { accuracy: 0.88 }
    }),
    generateWithStyle: jest.fn().mockResolvedValue({
      success: true,
      text: 'Generated text content',
      tokensUsed: 50,
      latencyMs: 200
    })
  }));
});

jest.mock('../../../services/clone/PersonalityEngine', () => {
  return jest.fn().mockImplementation(() => ({
    analyzeConversations: jest.fn().mockResolvedValue({
      success: true,
      analysis: {
        traits: { openness: 0.8, extraversion: 0.6 },
        patterns: {
          greetings: ['Hello'],
          farewells: ['Goodbye'],
          acknowledgments: ['I understand']
        },
        confidence: 85
      }
    }),
    createPersonalityProfile: jest.fn().mockResolvedValue({
      success: true,
      profile: {
        traits: { friendliness: 8, formality: 5 },
        toneSettings: { primaryTone: 'friendly' },
        responsePatterns: { greetings: ['Hi!'] },
        systemPrompt: 'You are a friendly assistant.',
        personalityPrompt: 'Be warm and welcoming.'
      },
      metrics: { consistency: 0.9 }
    }),
    generateResponse: jest.fn().mockResolvedValue({
      success: true,
      response: 'Personality-based response',
      tokensUsed: 100,
      latencyMs: 150
    })
  }));
});

jest.mock('../../../services/clone/CloneEngine', () => {
  return jest.fn().mockImplementation(() => ({
    generateResponse: jest.fn().mockResolvedValue({
      success: true,
      response: 'Generated response',
      latencyMs: 100
    })
  }));
});

jest.mock('../../../services/clone/TrainingService', () => {
  return jest.fn().mockImplementation(() => ({
    queueTraining: jest.fn().mockResolvedValue({ success: true }),
    getTrainingStatus: jest.fn().mockResolvedValue({ status: 'completed' })
  }));
});

describe('CloneService', () => {
  let CloneService;
  let service;

  beforeEach(() => {
    // Clear all mocks
    Object.values(mockLog).forEach(fn => fn.mockClear());
    mockQuery.mockClear();

    jest.resetModules();
    CloneService = require('../../../services/clone/cloneService');
    service = new CloneService();
  });

  describe('constructor', () => {
    it('should initialize all engines', () => {
      expect(service.voiceEngine).toBeDefined();
      expect(service.styleEngine).toBeDefined();
      expect(service.personalityEngine).toBeDefined();
      expect(service.cloneEngine).toBeDefined();
      expect(service.trainingService).toBeDefined();
    });
  });

  describe('createCloneJob', () => {
    it('should create a clone job successfully', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: 'Test Clone', type: 'voice', status: 'pending' }]
        })
        .mockResolvedValueOnce({ rows: [] }); // createTypeProfile

      const result = await service.createCloneJob({
        organizationId: 1,
        userId: 1,
        botId: 1,
        name: 'Test Clone',
        description: 'Test description',
        type: 'voice',
        config: { language: 'en' }
      });

      expect(result.success).toBe(true);
      expect(result.job).toBeDefined();
      expect(result.job.name).toBe('Test Clone');
      expect(mockLog.info).toHaveBeenCalledWith('Clone job created', expect.any(Object));
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      const result = await service.createCloneJob({
        organizationId: 1,
        userId: 1,
        name: 'Test',
        type: 'voice'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
      expect(mockLog.error).toHaveBeenCalled();
    });
  });

  describe('createTypeProfile', () => {
    it('should create voice profile', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.createTypeProfile(1, 'voice', { language: 'en' });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('voice_clone_profiles'),
        [1, 'en', 'elevenlabs']
      );
    });

    it('should create style profile', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.createTypeProfile(1, 'style', { formalityLevel: 'formal' });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('style_clone_profiles'),
        [1, 'formal', 'professional']
      );
    });

    it('should create personality profile', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.createTypeProfile(1, 'personality', { personalityName: 'Custom' });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('personality_clone_profiles'),
        [1, 'Custom']
      );
    });

    it('should create all profiles for full type', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await service.createTypeProfile(1, 'full', {});

      expect(mockQuery).toHaveBeenCalledTimes(3);
    });

    it('should throw on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.createTypeProfile(1, 'voice', {})).rejects.toThrow('DB error');
    });
  });

  describe('getCloneJob', () => {
    it('should return clone job by ID', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Test Job', type: 'voice' }]
      });

      const result = await service.getCloneJob(1);

      expect(result.success).toBe(true);
      expect(result.job.name).toBe('Test Job');
    });

    it('should return error for non-existent job', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.getCloneJob(999);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Clone job not found');
    });

    it('should filter by userId when provided', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Test Job' }]
      });

      await service.getCloneJob(1, 5);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('user_id = $2'),
        [1, 5]
      );
    });

    it('should handle database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await service.getCloneJob(1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
    });
  });

  describe('getCloneJobs', () => {
    it('should return all jobs for organization', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Job 1' },
          { id: 2, name: 'Job 2' }
        ]
      });

      const result = await service.getCloneJobs(1);

      expect(result.success).toBe(true);
      expect(result.jobs).toHaveLength(2);
    });

    it('should filter by type', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.getCloneJobs(1, { type: 'voice' });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('type = $2'),
        expect.arrayContaining([1, 'voice'])
      );
    });

    it('should filter by status', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.getCloneJobs(1, { status: 'ready' });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('status = $'),
        expect.arrayContaining([1, 'ready'])
      );
    });

    it('should apply pagination', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.getCloneJobs(1, { limit: 10, offset: 20 });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([1, 10, 20])
      );
    });

    it('should handle database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Query failed'));

      const result = await service.getCloneJobs(1);

      expect(result.success).toBe(false);
    });
  });

  describe('updateJobStatus', () => {
    it('should update job status', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'training' }]
      });

      const result = await service.updateJobStatus(1, 'training');

      expect(result.success).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE clone_jobs'),
        expect.arrayContaining([1, 'training'])
      );
    });

    it('should update training progress', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await service.updateJobStatus(1, 'training', { trainingProgress: 50 });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('training_progress'),
        expect.arrayContaining([1, 'training', 50])
      );
    });

    it('should update error message', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await service.updateJobStatus(1, 'failed', { errorMessage: 'Something went wrong' });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('error_message'),
        expect.arrayContaining([1, 'failed', 'Something went wrong'])
      );
    });

    it('should update model path', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await service.updateJobStatus(1, 'ready', { modelPath: '/models/123' });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('model_path'),
        expect.arrayContaining(['/models/123'])
      );
    });

    it('should update metrics', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await service.updateJobStatus(1, 'ready', { metrics: { accuracy: 0.95 } });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('metrics'),
        expect.any(Array)
      );
    });

    it('should set training_started_at for training status', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await service.updateJobStatus(1, 'training');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('training_started_at'),
        expect.any(Array)
      );
    });

    it('should set training_completed_at for ready status', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await service.updateJobStatus(1, 'ready');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('training_completed_at'),
        expect.any(Array)
      );
    });

    it('should skip timestamp when specified', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await service.updateJobStatus(1, 'training', { skipTimestamp: true });

      expect(mockQuery).not.toHaveBeenCalledWith(
        expect.stringContaining('training_started_at = NOW()'),
        expect.any(Array)
      );
    });
  });

  describe('addSample', () => {
    it('should add sample successfully', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, type: 'audio', file_path: '/uploads/audio.wav' }]
      });

      const result = await service.addSample({
        cloneJobId: 1,
        type: 'audio',
        filePath: '/uploads/audio.wav',
        fileName: 'audio.wav',
        fileSize: 1024,
        mimeType: 'audio/wav',
        durationSeconds: 30
      });

      expect(result.success).toBe(true);
      expect(result.sample).toBeDefined();
    });

    it('should handle text content', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, type: 'text', content: 'Sample text' }]
      });

      const result = await service.addSample({
        cloneJobId: 1,
        type: 'text',
        content: 'Sample text content'
      });

      expect(result.success).toBe(true);
    });

    it('should handle metadata', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await service.addSample({
        cloneJobId: 1,
        type: 'audio',
        metadata: { source: 'upload', quality: 'high' }
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([expect.stringContaining('source')])
      );
    });

    it('should handle database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Insert failed'));

      const result = await service.addSample({
        cloneJobId: 1,
        type: 'audio'
      });

      expect(result.success).toBe(false);
    });
  });

  describe('getSamples', () => {
    it('should return all samples for job', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 1, type: 'audio' },
          { id: 2, type: 'text' }
        ]
      });

      const result = await service.getSamples(1);

      expect(result.success).toBe(true);
      expect(result.samples).toHaveLength(2);
    });

    it('should filter by type', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, type: 'audio' }]
      });

      await service.getSamples(1, 'audio');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('type = $2'),
        [1, 'audio']
      );
    });

    it('should handle database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Query failed'));

      const result = await service.getSamples(1);

      expect(result.success).toBe(false);
    });
  });

  describe('deleteSample', () => {
    it('should delete sample successfully', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await service.deleteSample(1, 1);

      expect(result.success).toBe(true);
    });

    it('should return error for non-existent sample', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.deleteSample(999, 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Sample not found');
    });

    it('should handle database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Delete failed'));

      const result = await service.deleteSample(1, 1);

      expect(result.success).toBe(false);
    });
  });

  describe('trainVoiceClone', () => {
    it('should train voice clone successfully', async () => {
      // Mock getCloneJob
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, type: 'voice', name: 'Voice Clone' }]
      });
      // Mock getSamples
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, file_path: '/audio.wav', type: 'audio' }]
      });
      // Mock updateJobStatus (processing)
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      // Mock update sample
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Mock updateJobStatus (training)
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      // Mock update voice profile
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Mock getVersions
      mockQuery.mockResolvedValueOnce({ rows: [{ max_version: 0 }] });
      // Mock createVersion
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, version: 1 }] });
      // Mock deactivate previous versions
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Mock updateJobStatus (ready)
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await service.trainVoiceClone(1, 1);

      expect(result.success).toBe(true);
      expect(result.voiceId).toBe('voice-123');
    });

    it('should return error for wrong job type', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, type: 'personality' }]
      });

      const result = await service.trainVoiceClone(1, 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid job type');
    });

    it('should return error for insufficient samples', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, type: 'voice' }]
      });
      mockQuery.mockResolvedValueOnce({ rows: [] }); // No samples

      const result = await service.trainVoiceClone(1, 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('At least 1 audio sample required');
    });

    it('should handle job not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.trainVoiceClone(999, 1);

      expect(result.success).toBe(false);
    });
  });

  describe('synthesizeVoice', () => {
    it('should synthesize voice successfully', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'ready', voice_id: 'voice-123' }]
      });
      mockQuery.mockResolvedValueOnce({ rows: [] }); // logUsage

      const result = await service.synthesizeVoice(1, 'Hello world');

      expect(result.success).toBe(true);
      expect(result.audioUrl).toBeDefined();
    });

    it('should return error if clone not ready', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'training' }]
      });

      const result = await service.synthesizeVoice(1, 'Hello');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not ready');
    });

    it('should handle job not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.synthesizeVoice(999, 'Hello');

      expect(result.success).toBe(false);
    });
  });

  describe('trainStyleClone', () => {
    it('should train style clone successfully', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, type: 'style' }]
      });
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 1, type: 'text', content: 'Sample 1' },
          { id: 2, type: 'email', content: 'Sample 2' },
          { id: 3, type: 'document', content: 'Sample 3' }
        ]
      });
      // Mock various updates
      mockQuery.mockResolvedValue({ rows: [{ id: 1 }] });

      const result = await service.trainStyleClone(1, 1);

      expect(result.success).toBe(true);
    });

    it('should return error for wrong job type', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, type: 'voice' }]
      });

      const result = await service.trainStyleClone(1, 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid job type');
    });

    it('should return error for insufficient samples', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, type: 'style' }]
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, type: 'text', content: 'Only one' }]
      });

      const result = await service.trainStyleClone(1, 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('At least 3 text samples');
    });
  });

  describe('generateWithStyle', () => {
    it('should generate text with style', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'ready' }]
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          formality_level: 'neutral',
          tone: 'professional'
        }]
      });
      mockQuery.mockResolvedValueOnce({ rows: [] }); // logUsage

      const result = await service.generateWithStyle(1, 'Write a greeting');

      expect(result.success).toBe(true);
      expect(result.text).toBeDefined();
    });

    it('should return error if clone not ready', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'training' }]
      });

      const result = await service.generateWithStyle(1, 'Hello');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not ready');
    });

    it('should return error if profile not found', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'ready' }]
      });
      mockQuery.mockResolvedValueOnce({ rows: [] }); // No profile

      const result = await service.generateWithStyle(1, 'Hello');

      expect(result.success).toBe(false);
      expect(result.error).toContain('profile not found');
    });
  });

  describe('trainPersonalityClone', () => {
    it('should train personality clone successfully', async () => {
      // Mock getCloneJob
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, type: 'personality', name: 'Test' }]
      });
      // Mock getSamples
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 1, type: 'chat_history', content: JSON.stringify([{ role: 'user', content: 'Hi' }]) },
          { id: 2, type: 'text', content: 'Sample 2' },
          { id: 3, type: 'text', content: 'Sample 3' },
          { id: 4, type: 'email', content: 'Sample 4' },
          { id: 5, type: 'email', content: 'Sample 5' }
        ]
      });
      // Mock various updates
      mockQuery.mockResolvedValue({ rows: [{ id: 1 }] });

      const result = await service.trainPersonalityClone(1, 1);

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();
    });

    it('should return error for wrong job type', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, type: 'voice' }]
      });

      const result = await service.trainPersonalityClone(1, 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid job type');
    });

    it('should return error for insufficient samples', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, type: 'personality' }]
      });
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 1, type: 'text', content: 'Sample 1' },
          { id: 2, type: 'text', content: 'Sample 2' }
        ]
      });

      const result = await service.trainPersonalityClone(1, 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('At least 5 conversation samples');
    });
  });

  describe('generateWithPersonality', () => {
    it('should generate response with personality', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'ready' }]
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          system_prompt: 'You are helpful',
          traits: JSON.stringify({ friendliness: 8 }),
          response_patterns: JSON.stringify({ greetings: ['Hi'] })
        }]
      });
      mockQuery.mockResolvedValueOnce({ rows: [] }); // logUsage

      const result = await service.generateWithPersonality(1, 'Hello');

      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
    });

    it('should return error if clone not ready', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'training' }]
      });

      const result = await service.generateWithPersonality(1, 'Hello');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not ready');
    });

    it('should return error if profile not found', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'ready' }]
      });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.generateWithPersonality(1, 'Hello');

      expect(result.success).toBe(false);
      expect(result.error).toContain('profile not found');
    });
  });

  describe('createVersion', () => {
    it('should create version successfully', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ max_version: 2 }]
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, version: 3 }]
      });
      mockQuery.mockResolvedValueOnce({ rows: [] }); // deactivate previous

      const result = await service.createVersion(1, {
        modelPath: '/models/v3',
        config: { setting: 'value' },
        metrics: { accuracy: 0.95 },
        samplesCount: 10
      });

      expect(result.success).toBe(true);
      expect(result.version.version).toBe(3);
    });

    it('should create first version', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ max_version: null }]
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, version: 1 }]
      });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.createVersion(1, {});

      expect(result.success).toBe(true);
      expect(result.version.version).toBe(1);
    });
  });

  describe('getVersions', () => {
    it('should return all versions', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 1, version: 2 },
          { id: 2, version: 1 }
        ]
      });

      const result = await service.getVersions(1);

      expect(result.success).toBe(true);
      expect(result.versions).toHaveLength(2);
    });
  });

  describe('activateVersion', () => {
    it('should activate version', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // deactivate all
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, is_active: true }]
      });

      const result = await service.activateVersion(1, 1);

      expect(result.success).toBe(true);
      expect(result.version.is_active).toBe(true);
    });

    it('should return error if version not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.activateVersion(1, 999);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Version not found');
    });
  });

  describe('applyToBot', () => {
    it('should apply clone to bot', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'ready', type: 'voice' }]
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, config: JSON.stringify({ setting: 'value' }) }]
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1 }]
      });
      // Mock applyCloneToBot queries
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await service.applyToBot(1, 'bot-1', 'user-1');

      expect(result.success).toBe(true);
      expect(result.application).toBeDefined();
    });

    it('should return error if clone not ready', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'training' }]
      });

      const result = await service.applyToBot(1, 'bot-1', 'user-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not ready');
    });
  });

  describe('removeFromBot', () => {
    it('should remove clone from bot', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1 }]
      });

      const result = await service.removeFromBot(1, 'user-1');

      expect(result.success).toBe(true);
    });

    it('should return error if application not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.removeFromBot(999, 'user-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Application not found');
    });
  });

  describe('getUsageStats', () => {
    it('should return usage statistics', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          total_uses: 100,
          total_tokens: 5000,
          avg_latency: 250,
          avg_similarity: 0.85,
          unique_sessions: 25
        }]
      });

      const result = await service.getUsageStats(1);

      expect(result.success).toBe(true);
      expect(result.stats.total_uses).toBe(100);
    });

    it('should filter by date range', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ total_uses: 50 }]
      });

      await service.getUsageStats(1, {
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('created_at >='),
        expect.arrayContaining([1, '2024-01-01', '2024-12-31'])
      );
    });
  });

  describe('createABTest', () => {
    it('should create A/B test', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Test A/B' }]
      });

      const result = await service.createABTest({
        organizationId: 1,
        name: 'Test A/B',
        description: 'Testing variants',
        botId: 1,
        variantACloneId: 1,
        variantBCloneId: 2,
        trafficSplit: 50,
        createdBy: 'user-1'
      });

      expect(result.success).toBe(true);
      expect(result.test.name).toBe('Test A/B');
    });
  });

  describe('getABTestResults', () => {
    it('should return A/B test results', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, variant_a_clone_id: 1, variant_b_clone_id: 2, start_date: '2024-01-01', end_date: '2024-12-31' }]
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ total_uses: 100, total_tokens: 5000 }]
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ total_uses: 150, total_tokens: 6000 }]
      });

      const result = await service.getABTestResults(1);

      expect(result.success).toBe(true);
      expect(result.test).toBeDefined();
      expect(result.results.variantA).toBeDefined();
      expect(result.results.variantB).toBeDefined();
    });

    it('should return error if test not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.getABTestResults(999);

      expect(result.success).toBe(false);
      expect(result.error).toBe('A/B test not found');
    });
  });

  describe('deleteCloneJob', () => {
    it('should delete clone job', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1 }]
      });

      const result = await service.deleteCloneJob(1, 'user-1');

      expect(result.success).toBe(true);
      expect(mockLog.info).toHaveBeenCalledWith('Clone job deleted', { jobId: 1 });
    });

    it('should return error if job not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.deleteCloneJob(999, 'user-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Clone job not found');
    });
  });
});
