/**
 * Clone Routes Comprehensive Integration Tests
 * Covers: Clone Jobs, Voice/Style/Personality Cloning, Templates, Export/Import, Sharing, Analytics, Backup
 */

const request = require('supertest');
const express = require('express');

// Mock database
const mockDb = {
  query: jest.fn()
};
jest.mock('../../db', () => mockDb);

// Mock auth middleware
jest.mock('../../middleware/auth', () => (req, res, next) => {
  req.user = { id: 1, organization_id: 1, email: 'test@test.com' };
  next();
});

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// Mock clone services
const mockCloneService = {
  createCloneJob: jest.fn(),
  getCloneJobs: jest.fn(),
  getCloneJob: jest.fn(),
  deleteCloneJob: jest.fn(),
  addSample: jest.fn(),
  getSamples: jest.fn(),
  deleteSample: jest.fn(),
  trainVoiceClone: jest.fn(),
  synthesizeVoice: jest.fn(),
  trainStyleClone: jest.fn(),
  generateWithStyle: jest.fn(),
  trainPersonalityClone: jest.fn(),
  generateWithPersonality: jest.fn(),
  getVersions: jest.fn(),
  activateVersion: jest.fn(),
  applyToBot: jest.fn(),
  removeFromBot: jest.fn(),
  getUsageStats: jest.fn(),
  createABTest: jest.fn(),
  getABTestResults: jest.fn()
};

const mockCloneTemplates = {
  getTemplates: jest.fn(),
  getTemplate: jest.fn(),
  createFromTemplate: jest.fn(),
  createTemplate: jest.fn()
};

const mockCloneExport = {
  exportToJson: jest.fn(),
  exportToZip: jest.fn()
};

const mockCloneImport = {
  previewImport: jest.fn(),
  importFromJson: jest.fn()
};

const mockCloneSharing = {
  getCloneShares: jest.fn(),
  shareWithUser: jest.fn(),
  generateShareLink: jest.fn(),
  revokeShare: jest.fn(),
  revokeShareLink: jest.fn(),
  getSharedWithMe: jest.fn()
};

const mockCloneAnalytics = {
  getCloneAnalytics: jest.fn(),
  compareClones: jest.fn(),
  getDashboard: jest.fn()
};

const mockCloneBackup = {
  createBackup: jest.fn(),
  getBackups: jest.fn(),
  restoreFromBackup: jest.fn(),
  deleteBackup: jest.fn()
};

jest.mock('../../services/clone', () => ({
  CloneEngine: jest.fn().mockImplementation(() => ({
    generateResponse: jest.fn().mockResolvedValue({ success: true, response: 'Generated', inputTokens: 10, outputTokens: 20, latencyMs: 100 }),
    generateEmail: jest.fn().mockResolvedValue({ success: true, response: 'Email' }),
    generateMessage: jest.fn().mockResolvedValue({ success: true, response: 'Message' }),
    generateDocument: jest.fn().mockResolvedValue({ success: true, response: 'Document' }),
    refineText: jest.fn().mockResolvedValue({ success: true, response: 'Refined' }),
    calculateSimilarity: jest.fn().mockResolvedValue(0.85)
  })),
  TrainingService: jest.fn().mockImplementation(() => ({
    validateTrainingData: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
    processTrainingData: jest.fn().mockResolvedValue({ success: true, processed: [], count: 1, skipped: 0 }),
    trainClone: jest.fn().mockResolvedValue({ success: true, styleProfile: {}, trainingPrompt: '', trainingScore: 85, samplesUsed: 5 })
  })),
  StyleAnalyzer: jest.fn().mockImplementation(() => ({
    analyzeStyle: jest.fn().mockResolvedValue({ success: true, analysis: {} })
  })),
  CloneService: jest.fn().mockImplementation(() => mockCloneService),
  CloneTemplates: mockCloneTemplates,
  CloneExport: mockCloneExport,
  CloneImport: mockCloneImport,
  CloneSharing: mockCloneSharing,
  CloneAnalytics: mockCloneAnalytics,
  CloneBackup: mockCloneBackup
}));

// Mock multer
jest.mock('multer', () => {
  const multer = () => ({
    single: () => (req, res, next) => {
      req.file = { path: '/tmp/test.wav', originalname: 'test.wav', size: 1024, mimetype: 'audio/wav' };
      next();
    },
    array: () => (req, res, next) => next()
  });
  multer.diskStorage = () => ({});
  return multer;
});

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn()
}));

const cloneRouter = require('../../routes/clone');

describe('Clone Routes Comprehensive Tests', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/clones', cloneRouter);
    jest.clearAllMocks();
  });

  // ==========================================
  // CLONE JOBS API
  // ==========================================
  describe('Clone Jobs API', () => {
    describe('POST /api/clones/jobs', () => {
      it('should create clone job', async () => {
        mockCloneService.createCloneJob.mockResolvedValueOnce({
          success: true,
          job: { id: 1, name: 'Voice Clone', type: 'voice', status: 'pending' }
        });

        const res = await request(app)
          .post('/api/clones/jobs')
          .send({ name: 'Voice Clone', type: 'voice', botId: 1 });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.job).toBeDefined();
      });

      it('should require name and type', async () => {
        const res = await request(app)
          .post('/api/clones/jobs')
          .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('required');
      });

      it('should validate clone type', async () => {
        const res = await request(app)
          .post('/api/clones/jobs')
          .send({ name: 'Test', type: 'invalid' });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Invalid clone type');
      });

      it('should handle service error', async () => {
        mockCloneService.createCloneJob.mockResolvedValueOnce({ success: false, error: 'Failed' });

        const res = await request(app)
          .post('/api/clones/jobs')
          .send({ name: 'Test', type: 'voice' });

        expect(res.status).toBe(500);
      });
    });

    describe('GET /api/clones/jobs', () => {
      it('should return clone jobs', async () => {
        mockCloneService.getCloneJobs.mockResolvedValueOnce({
          success: true,
          jobs: [{ id: 1, name: 'Job 1' }]
        });

        const res = await request(app).get('/api/clones/jobs');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.jobs).toBeDefined();
      });

      it('should handle filters', async () => {
        mockCloneService.getCloneJobs.mockResolvedValueOnce({ success: true, jobs: [] });

        await request(app).get('/api/clones/jobs?type=voice&status=ready&limit=10&offset=5');

        expect(mockCloneService.getCloneJobs).toHaveBeenCalledWith(1, {
          type: 'voice',
          status: 'ready',
          limit: 10,
          offset: 5
        });
      });
    });

    describe('GET /api/clones/jobs/:id', () => {
      it('should return clone job', async () => {
        mockCloneService.getCloneJob.mockResolvedValueOnce({
          success: true,
          job: { id: 1, name: 'Test Job' }
        });

        const res = await request(app).get('/api/clones/jobs/1');

        expect(res.status).toBe(200);
        expect(res.body.job).toBeDefined();
      });

      it('should return 404 for non-existent job', async () => {
        mockCloneService.getCloneJob.mockResolvedValueOnce({ success: false, error: 'Not found' });

        const res = await request(app).get('/api/clones/jobs/999');

        expect(res.status).toBe(404);
      });
    });

    describe('DELETE /api/clones/jobs/:id', () => {
      it('should delete clone job', async () => {
        mockCloneService.deleteCloneJob.mockResolvedValueOnce({ success: true });

        const res = await request(app).delete('/api/clones/jobs/1');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('should return 404 for non-existent job', async () => {
        mockCloneService.deleteCloneJob.mockResolvedValueOnce({ success: false, error: 'Not found' });

        const res = await request(app).delete('/api/clones/jobs/999');

        expect(res.status).toBe(404);
      });
    });
  });

  // ==========================================
  // SAMPLE MANAGEMENT
  // ==========================================
  describe('Sample Management', () => {
    describe('POST /api/clones/jobs/:id/samples', () => {
      it('should add text sample', async () => {
        mockCloneService.getCloneJob.mockResolvedValueOnce({ success: true, job: { id: 1 } });
        mockCloneService.addSample.mockResolvedValueOnce({ success: true, sample: { id: 1 } });

        const res = await request(app)
          .post('/api/clones/jobs/1/samples')
          .send({ content: 'Sample text', type: 'text' });

        expect(res.status).toBe(201);
      });

      it('should return 404 for non-existent job', async () => {
        mockCloneService.getCloneJob.mockResolvedValueOnce({ success: false });

        const res = await request(app)
          .post('/api/clones/jobs/999/samples')
          .send({ content: 'Test' });

        expect(res.status).toBe(404);
      });
    });

    describe('GET /api/clones/jobs/:id/samples', () => {
      it('should return samples', async () => {
        mockCloneService.getCloneJob.mockResolvedValueOnce({ success: true, job: { id: 1 } });
        mockCloneService.getSamples.mockResolvedValueOnce({
          success: true,
          samples: [{ id: 1, type: 'text' }]
        });

        const res = await request(app).get('/api/clones/jobs/1/samples');

        expect(res.status).toBe(200);
        expect(res.body.samples).toBeDefined();
      });

      it('should filter by type', async () => {
        mockCloneService.getCloneJob.mockResolvedValueOnce({ success: true, job: { id: 1 } });
        mockCloneService.getSamples.mockResolvedValueOnce({ success: true, samples: [] });

        await request(app).get('/api/clones/jobs/1/samples?type=audio');

        expect(mockCloneService.getSamples).toHaveBeenCalledWith(1, 'audio');
      });
    });

    describe('DELETE /api/clones/jobs/:id/samples/:sampleId', () => {
      it('should delete sample', async () => {
        mockCloneService.getCloneJob.mockResolvedValueOnce({ success: true, job: { id: 1 } });
        mockCloneService.deleteSample.mockResolvedValueOnce({ success: true });

        const res = await request(app).delete('/api/clones/jobs/1/samples/1');

        expect(res.status).toBe(200);
      });
    });
  });

  // ==========================================
  // VOICE CLONING
  // ==========================================
  describe('Voice Cloning', () => {
    describe('POST /api/clones/voice', () => {
      it('should create voice clone job', async () => {
        mockCloneService.createCloneJob.mockResolvedValueOnce({
          success: true,
          job: { id: 1, type: 'voice' }
        });

        const res = await request(app)
          .post('/api/clones/voice')
          .send({ name: 'My Voice', language: 'en' });

        expect(res.status).toBe(201);
      });

      it('should require name', async () => {
        const res = await request(app)
          .post('/api/clones/voice')
          .send({});

        expect(res.status).toBe(400);
      });
    });

    describe('POST /api/clones/voice/:id/train', () => {
      it('should train voice clone', async () => {
        mockCloneService.trainVoiceClone.mockResolvedValueOnce({
          success: true,
          voiceId: 'voice-123'
        });

        const res = await request(app).post('/api/clones/voice/1/train');

        expect(res.status).toBe(200);
        expect(res.body.voiceId).toBeDefined();
      });

      it('should handle training error', async () => {
        mockCloneService.trainVoiceClone.mockResolvedValueOnce({ success: false, error: 'Not enough samples' });

        const res = await request(app).post('/api/clones/voice/1/train');

        expect(res.status).toBe(500);
      });
    });

    describe('POST /api/clones/voice/:id/synthesize', () => {
      it('should synthesize speech', async () => {
        mockCloneService.synthesizeVoice.mockResolvedValueOnce({
          success: true,
          audioUrl: 'http://example.com/audio.mp3'
        });

        const res = await request(app)
          .post('/api/clones/voice/1/synthesize')
          .send({ text: 'Hello world' });

        expect(res.status).toBe(200);
      });

      it('should require text', async () => {
        const res = await request(app)
          .post('/api/clones/voice/1/synthesize')
          .send({});

        expect(res.status).toBe(400);
      });

      it('should return audio buffer', async () => {
        mockCloneService.synthesizeVoice.mockResolvedValueOnce({
          success: true,
          audioBuffer: Buffer.from('audio')
        });

        const res = await request(app)
          .post('/api/clones/voice/1/synthesize')
          .send({ text: 'Hello' });

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('audio');
      });
    });
  });

  // ==========================================
  // STYLE CLONING
  // ==========================================
  describe('Style Cloning', () => {
    describe('POST /api/clones/style', () => {
      it('should create style clone job', async () => {
        mockCloneService.createCloneJob.mockResolvedValueOnce({
          success: true,
          job: { id: 1, type: 'style' }
        });

        const res = await request(app)
          .post('/api/clones/style')
          .send({ name: 'Formal Style', formalityLevel: 'high' });

        expect(res.status).toBe(201);
      });
    });

    describe('POST /api/clones/style/:id/train', () => {
      it('should train style clone', async () => {
        mockCloneService.trainStyleClone.mockResolvedValueOnce({
          success: true,
          styleProfile: { formality: 0.8, tone: 'professional' }
        });

        const res = await request(app).post('/api/clones/style/1/train');

        expect(res.status).toBe(200);
        expect(res.body.styleProfile).toBeDefined();
      });
    });

    describe('POST /api/clones/style/:id/generate', () => {
      it('should generate with style', async () => {
        mockCloneService.generateWithStyle.mockResolvedValueOnce({
          success: true,
          text: 'Generated text',
          tokensUsed: 50
        });

        const res = await request(app)
          .post('/api/clones/style/1/generate')
          .send({ prompt: 'Write an email' });

        expect(res.status).toBe(200);
        expect(res.body.text).toBeDefined();
      });

      it('should require prompt', async () => {
        const res = await request(app)
          .post('/api/clones/style/1/generate')
          .send({});

        expect(res.status).toBe(400);
      });
    });
  });

  // ==========================================
  // PERSONALITY CLONING
  // ==========================================
  describe('Personality Cloning', () => {
    describe('POST /api/clones/personality', () => {
      it('should create personality clone job', async () => {
        mockCloneService.createCloneJob.mockResolvedValueOnce({
          success: true,
          job: { id: 1, type: 'personality' }
        });

        const res = await request(app)
          .post('/api/clones/personality')
          .send({ name: 'Friendly Bot' });

        expect(res.status).toBe(201);
      });
    });

    describe('POST /api/clones/personality/:id/train', () => {
      it('should train personality clone', async () => {
        mockCloneService.trainPersonalityClone.mockResolvedValueOnce({
          success: true,
          profile: { traits: ['friendly', 'helpful'] }
        });

        const res = await request(app).post('/api/clones/personality/1/train');

        expect(res.status).toBe(200);
        expect(res.body.profile).toBeDefined();
      });
    });

    describe('POST /api/clones/personality/:id/chat', () => {
      it('should chat with personality', async () => {
        mockCloneService.generateWithPersonality.mockResolvedValueOnce({
          success: true,
          response: 'Hello! How can I help you?',
          tokensUsed: 20
        });

        const res = await request(app)
          .post('/api/clones/personality/1/chat')
          .send({ message: 'Hi there' });

        expect(res.status).toBe(200);
        expect(res.body.response).toBeDefined();
      });

      it('should require message', async () => {
        const res = await request(app)
          .post('/api/clones/personality/1/chat')
          .send({});

        expect(res.status).toBe(400);
      });

      it('should support conversation history', async () => {
        mockCloneService.generateWithPersonality.mockResolvedValueOnce({
          success: true,
          response: 'I see, thanks for clarifying'
        });

        const res = await request(app)
          .post('/api/clones/personality/1/chat')
          .send({
            message: 'What about that?',
            conversationHistory: [
              { role: 'user', content: 'Hi' },
              { role: 'assistant', content: 'Hello!' }
            ]
          });

        expect(res.status).toBe(200);
      });
    });
  });

  // ==========================================
  // VERSION MANAGEMENT
  // ==========================================
  describe('Version Management', () => {
    describe('GET /api/clones/jobs/:id/versions', () => {
      it('should return versions', async () => {
        mockCloneService.getCloneJob.mockResolvedValueOnce({ success: true, job: { id: 1 } });
        mockCloneService.getVersions.mockResolvedValueOnce({
          success: true,
          versions: [{ id: 1, version: 1, is_active: true }]
        });

        const res = await request(app).get('/api/clones/jobs/1/versions');

        expect(res.status).toBe(200);
        expect(res.body.versions).toBeDefined();
      });
    });

    describe('POST /api/clones/jobs/:id/versions/:versionId/activate', () => {
      it('should activate version', async () => {
        mockCloneService.getCloneJob.mockResolvedValueOnce({ success: true, job: { id: 1 } });
        mockCloneService.activateVersion.mockResolvedValueOnce({
          success: true,
          version: { id: 2, is_active: true }
        });

        const res = await request(app).post('/api/clones/jobs/1/versions/2/activate');

        expect(res.status).toBe(200);
      });
    });
  });

  // ==========================================
  // BOT APPLICATION
  // ==========================================
  describe('Bot Application', () => {
    describe('POST /api/clones/jobs/:id/apply/:botId', () => {
      it('should apply clone to bot', async () => {
        mockCloneService.applyToBot.mockResolvedValueOnce({
          success: true,
          application: { id: 1, bot_id: 5, clone_job_id: 1 }
        });

        const res = await request(app).post('/api/clones/jobs/1/apply/5');

        expect(res.status).toBe(200);
        expect(res.body.application).toBeDefined();
      });
    });

    describe('DELETE /api/clones/applications/:applicationId', () => {
      it('should remove clone from bot', async () => {
        mockCloneService.removeFromBot.mockResolvedValueOnce({ success: true });

        const res = await request(app).delete('/api/clones/applications/1');

        expect(res.status).toBe(200);
      });
    });
  });

  // ==========================================
  // USAGE & ANALYTICS
  // ==========================================
  describe('Usage & Analytics', () => {
    describe('GET /api/clones/jobs/:id/usage', () => {
      it('should return usage stats', async () => {
        mockCloneService.getCloneJob.mockResolvedValueOnce({ success: true, job: { id: 1 } });
        mockCloneService.getUsageStats.mockResolvedValueOnce({
          success: true,
          stats: { totalCalls: 100, totalTokens: 5000 }
        });

        const res = await request(app).get('/api/clones/jobs/1/usage');

        expect(res.status).toBe(200);
        expect(res.body.stats).toBeDefined();
      });

      it('should support date range', async () => {
        mockCloneService.getCloneJob.mockResolvedValueOnce({ success: true, job: { id: 1 } });
        mockCloneService.getUsageStats.mockResolvedValueOnce({ success: true, stats: {} });

        await request(app).get('/api/clones/jobs/1/usage?startDate=2024-01-01&endDate=2024-01-31');

        expect(mockCloneService.getUsageStats).toHaveBeenCalledWith(1, {
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        });
      });
    });
  });

  // ==========================================
  // A/B TESTING
  // ==========================================
  describe('A/B Testing', () => {
    describe('POST /api/clones/ab-tests', () => {
      it('should create A/B test', async () => {
        mockCloneService.createABTest.mockResolvedValueOnce({
          success: true,
          test: { id: 1, name: 'Test A vs B' }
        });

        const res = await request(app)
          .post('/api/clones/ab-tests')
          .send({
            name: 'Test A vs B',
            botId: 1,
            variantACloneId: 1,
            variantBCloneId: 2
          });

        expect(res.status).toBe(201);
      });

      it('should require all fields', async () => {
        const res = await request(app)
          .post('/api/clones/ab-tests')
          .send({ name: 'Test' });

        expect(res.status).toBe(400);
      });
    });

    describe('GET /api/clones/ab-tests/:id/results', () => {
      it('should return test results', async () => {
        mockCloneService.getABTestResults.mockResolvedValueOnce({
          success: true,
          test: { id: 1, name: 'Test' },
          results: { variantA: { conversions: 50 }, variantB: { conversions: 60 } }
        });

        const res = await request(app).get('/api/clones/ab-tests/1/results');

        expect(res.status).toBe(200);
        expect(res.body.results).toBeDefined();
      });
    });
  });

  // ==========================================
  // CLONE STATUS
  // ==========================================
  describe('GET /api/clones/status/:id', () => {
    it('should return clone status', async () => {
      mockCloneService.getCloneJob.mockResolvedValueOnce({
        success: true,
        job: { id: 1, status: 'ready', training_progress: 100 }
      });

      const res = await request(app).get('/api/clones/status/1');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.isReady).toBe(true);
    });
  });

  // ==========================================
  // TEMPLATES API
  // ==========================================
  describe('Templates API', () => {
    describe('GET /api/clones/templates', () => {
      it('should return templates', async () => {
        mockCloneTemplates.getTemplates.mockResolvedValueOnce({
          success: true,
          templates: [{ id: 1, name: 'Professional Writer' }]
        });

        const res = await request(app).get('/api/clones/templates');

        expect(res.status).toBe(200);
      });

      it('should filter by category', async () => {
        mockCloneTemplates.getTemplates.mockResolvedValueOnce({ success: true, templates: [] });

        await request(app).get('/api/clones/templates?category=business');

        expect(mockCloneTemplates.getTemplates).toHaveBeenCalledWith(
          expect.objectContaining({ category: 'business' })
        );
      });
    });

    describe('GET /api/clones/templates/:id', () => {
      it('should return template', async () => {
        mockCloneTemplates.getTemplate.mockResolvedValueOnce({
          success: true,
          template: { id: 1, name: 'Template' }
        });

        const res = await request(app).get('/api/clones/templates/1');

        expect(res.status).toBe(200);
      });

      it('should return 404 for non-existent', async () => {
        mockCloneTemplates.getTemplate.mockResolvedValueOnce({ success: false, error: 'Not found' });

        const res = await request(app).get('/api/clones/templates/999');

        expect(res.status).toBe(404);
      });
    });

    describe('POST /api/clones/templates/:id/create', () => {
      it('should create from template', async () => {
        mockCloneTemplates.createFromTemplate.mockResolvedValueOnce({
          success: true,
          clone: { id: 1, name: 'My Clone' }
        });

        const res = await request(app)
          .post('/api/clones/templates/1/create')
          .send({ name: 'My Clone' });

        expect(res.status).toBe(201);
      });
    });

    describe('POST /api/clones/templates', () => {
      it('should create custom template', async () => {
        mockCloneTemplates.createTemplate.mockResolvedValueOnce({
          success: true,
          template: { id: 1, name: 'Custom Template' }
        });

        const res = await request(app)
          .post('/api/clones/templates')
          .send({ cloneId: 1, name: 'Custom Template', category: 'business' });

        expect(res.status).toBe(201);
      });

      it('should require cloneId', async () => {
        const res = await request(app)
          .post('/api/clones/templates')
          .send({ name: 'Template' });

        expect(res.status).toBe(400);
      });
    });
  });

  // ==========================================
  // EXPORT/IMPORT API
  // ==========================================
  describe('Export/Import API', () => {
    describe('POST /api/clones/:id/export', () => {
      it('should export clone as JSON', async () => {
        mockCloneExport.exportToJson.mockResolvedValueOnce({
          success: true,
          data: { clone: {}, trainingData: [] }
        });

        const res = await request(app)
          .post('/api/clones/1/export')
          .send({ format: 'json' });

        expect(res.status).toBe(200);
      });

      it('should export as ZIP', async () => {
        mockCloneExport.exportToZip.mockResolvedValueOnce({
          success: true,
          zipPath: '/tmp/export.zip'
        });

        const res = await request(app)
          .post('/api/clones/1/export')
          .send({ format: 'zip', includeTrainingData: true });

        expect(res.status).toBe(200);
      });
    });

    describe('POST /api/clones/import/preview', () => {
      it('should preview import', async () => {
        mockCloneImport.previewImport.mockResolvedValueOnce({
          success: true,
          preview: { name: 'Clone', trainingDataCount: 10 }
        });

        const res = await request(app)
          .post('/api/clones/import/preview')
          .send({ data: { clone: {} } });

        expect(res.status).toBe(200);
      });
    });

    describe('POST /api/clones/import', () => {
      it('should import clone', async () => {
        mockCloneImport.importFromJson.mockResolvedValueOnce({
          success: true,
          clone: { id: 1, name: 'Imported Clone' }
        });

        const res = await request(app)
          .post('/api/clones/import')
          .send({ data: { clone: {} }, options: {} });

        expect(res.status).toBe(201);
      });
    });
  });

  // ==========================================
  // SHARING API
  // ==========================================
  describe('Sharing API', () => {
    describe('GET /api/clones/:id/shares', () => {
      it('should return shares', async () => {
        mockCloneSharing.getCloneShares.mockResolvedValueOnce({
          success: true,
          shares: [{ id: 1, shared_with_user_id: 2 }]
        });

        const res = await request(app).get('/api/clones/1/shares');

        expect(res.status).toBe(200);
      });
    });

    describe('POST /api/clones/:id/share/user', () => {
      it('should share with user', async () => {
        mockDb.query.mockResolvedValueOnce({ rows: [{ id: 2 }] });
        mockCloneSharing.shareWithUser.mockResolvedValueOnce({
          success: true,
          share: { id: 1 }
        });

        const res = await request(app)
          .post('/api/clones/1/share/user')
          .send({ email: 'user@test.com', permissionLevel: 'view' });

        expect(res.status).toBe(200);
      });

      it('should return 404 for non-existent user', async () => {
        mockDb.query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
          .post('/api/clones/1/share/user')
          .send({ email: 'nonexistent@test.com' });

        expect(res.status).toBe(404);
      });
    });

    describe('POST /api/clones/:id/share/link', () => {
      it('should generate share link', async () => {
        mockCloneSharing.generateShareLink.mockResolvedValueOnce({
          success: true,
          link: 'http://example.com/share/abc123'
        });

        const res = await request(app)
          .post('/api/clones/1/share/link')
          .send({ permissionLevel: 'view' });

        expect(res.status).toBe(200);
        expect(res.body.link).toBeDefined();
      });
    });

    describe('DELETE /api/clones/:id/shares/:shareId', () => {
      it('should revoke share', async () => {
        mockCloneSharing.revokeShare.mockResolvedValueOnce({ success: true });

        const res = await request(app).delete('/api/clones/1/shares/1');

        expect(res.status).toBe(200);
      });
    });

    describe('DELETE /api/clones/:id/share/links/:linkId', () => {
      it('should revoke share link', async () => {
        mockCloneSharing.revokeShareLink.mockResolvedValueOnce({ success: true });

        const res = await request(app).delete('/api/clones/1/share/links/1');

        expect(res.status).toBe(200);
      });
    });

    describe('GET /api/clones/shared-with-me', () => {
      it('should return shared clones', async () => {
        mockCloneSharing.getSharedWithMe.mockResolvedValueOnce({
          success: true,
          clones: [{ id: 1, name: 'Shared Clone' }]
        });

        const res = await request(app).get('/api/clones/shared-with-me');

        expect(res.status).toBe(200);
      });
    });
  });

  // ==========================================
  // ANALYTICS API
  // ==========================================
  describe('Analytics API', () => {
    describe('GET /api/clones/:id/analytics', () => {
      it('should return analytics', async () => {
        mockCloneAnalytics.getCloneAnalytics.mockResolvedValueOnce({
          success: true,
          analytics: { usage: {}, performance: {} }
        });

        const res = await request(app).get('/api/clones/1/analytics');

        expect(res.status).toBe(200);
      });

      it('should support granularity', async () => {
        mockCloneAnalytics.getCloneAnalytics.mockResolvedValueOnce({ success: true, analytics: {} });

        await request(app).get('/api/clones/1/analytics?granularity=daily');

        expect(mockCloneAnalytics.getCloneAnalytics).toHaveBeenCalledWith(1, 1,
          expect.objectContaining({ granularity: 'daily' })
        );
      });
    });

    describe('GET /api/clones/:id/compare/:otherId', () => {
      it('should compare clones', async () => {
        mockCloneAnalytics.compareClones.mockResolvedValueOnce({
          success: true,
          comparison: { clone1: {}, clone2: {} }
        });

        const res = await request(app).get('/api/clones/1/compare/2');

        expect(res.status).toBe(200);
      });
    });

    describe('GET /api/clones/dashboard', () => {
      it('should return dashboard', async () => {
        mockCloneAnalytics.getDashboard.mockResolvedValueOnce({
          success: true,
          dashboard: { totalClones: 5, activeClones: 3 }
        });

        const res = await request(app).get('/api/clones/dashboard');

        expect(res.status).toBe(200);
      });
    });
  });

  // ==========================================
  // BACKUP API
  // ==========================================
  describe('Backup API', () => {
    describe('POST /api/clones/:id/backup', () => {
      it('should create backup', async () => {
        mockCloneBackup.createBackup.mockResolvedValueOnce({
          success: true,
          backup: { id: 1, name: 'Backup 1' }
        });

        const res = await request(app)
          .post('/api/clones/1/backup')
          .send({ name: 'Backup 1' });

        expect(res.status).toBe(201);
      });
    });

    describe('GET /api/clones/:id/backups', () => {
      it('should return backups', async () => {
        mockCloneBackup.getBackups.mockResolvedValueOnce({
          success: true,
          backups: [{ id: 1, name: 'Backup 1' }]
        });

        const res = await request(app).get('/api/clones/1/backups');

        expect(res.status).toBe(200);
      });
    });

    describe('POST /api/clones/:id/restore', () => {
      it('should restore from backup', async () => {
        mockCloneBackup.restoreFromBackup.mockResolvedValueOnce({
          success: true,
          clone: { id: 2, name: 'Restored Clone' }
        });

        const res = await request(app)
          .post('/api/clones/1/restore')
          .send({ backupId: 1 });

        expect(res.status).toBe(200);
      });
    });

    describe('DELETE /api/clones/backups/:backupId', () => {
      it('should delete backup', async () => {
        mockCloneBackup.deleteBackup.mockResolvedValueOnce({ success: true });

        const res = await request(app).delete('/api/clones/backups/1');

        expect(res.status).toBe(200);
      });
    });
  });
});
