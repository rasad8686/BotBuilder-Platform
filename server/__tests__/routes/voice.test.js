/**
 * Voice Routes Tests
 * Tests for server/routes/voice.js
 */

// Mock database - must be defined before jest.mock calls
jest.mock('../../db', () => ({
  query: jest.fn()
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

// Mock auth middleware
jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => next()));

// Mock voice services - define mocks inside the factory function
jest.mock('../../services/voice', () => {
  const mockLanguageSupport = {
    getSupportedLanguages: jest.fn().mockReturnValue([
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'az', name: 'Azerbaijani', nativeName: 'Azərbaycan dili' },
      { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
      { code: 'ru', name: 'Russian', nativeName: 'Русский' }
    ]),
    getLanguageInfo: jest.fn().mockReturnValue({ code: 'en', name: 'English' }),
    getSTTCode: jest.fn().mockReturnValue('en-US'),
    detectLanguage: jest.fn().mockReturnValue({ language: 'en', confidence: 0.9 })
  };

  const mockVoiceAnalytics = {
    getStats: jest.fn().mockResolvedValue({
      summary: { totalTranscriptions: 100 },
      byProvider: [],
      byLanguage: [],
      dailyTrend: []
    }),
    getRealTimeMetrics: jest.fn().mockReturnValue({
      totalTranscriptions: 100,
      successRate: '95%'
    })
  };

  const mockVoiceStorage = {
    store: jest.fn().mockResolvedValue({ success: true, filename: 'test.wav', size: 1024 }),
    retrieve: jest.fn().mockResolvedValue({ buffer: Buffer.from('audio'), contentType: 'audio/wav' }),
    delete: jest.fn().mockResolvedValue(true),
    list: jest.fn().mockResolvedValue([]),
    getSignedUrl: jest.fn().mockResolvedValue('http://example.com/file'),
    getStorageStats: jest.fn().mockResolvedValue({ totalFiles: 10, totalSize: 10240 })
  };

  const mockFormatConverter = {
    convert: jest.fn().mockResolvedValue({ success: true, buffer: Buffer.from('converted'), format: 'wav' }),
    getSupportedFormats: jest.fn().mockReturnValue({ input: ['mp3', 'wav'], output: ['mp3', 'wav'] }),
    getPresets: jest.fn().mockReturnValue([{ name: 'speech', sampleRate: 16000 }]),
    isAvailable: jest.fn().mockResolvedValue(true)
  };

  const mockVoiceQueue = {
    addJob: jest.fn().mockResolvedValue({ id: 'job-1', status: 'pending', provider: 'whisper', priority: 2, createdAt: new Date() }),
    getJob: jest.fn(),
    getStats: jest.fn().mockReturnValue({ queueLength: 0, processing: false })
  };

  const mockStreamingTranscription = {
    createSession: jest.fn().mockReturnValue({ sessionId: 'session-1', provider: 'deepgram' }),
    startSession: jest.fn().mockResolvedValue({ sessionId: 'session-1', status: 'connected' }),
    sendAudio: jest.fn(),
    endSession: jest.fn().mockResolvedValue({ sessionId: 'session-1', transcript: 'Test', duration: 10 }),
    getSessionStatus: jest.fn().mockReturnValue({ status: 'connected' }),
    getActiveSessions: jest.fn().mockReturnValue([])
  };

  return {
    TwilioService: jest.fn().mockImplementation(() => ({
      isConfigured: jest.fn().mockReturnValue(true),
      searchAvailableNumbers: jest.fn().mockResolvedValue({ success: true, numbers: [] }),
      purchaseNumber: jest.fn().mockResolvedValue({ success: true, number: { sid: 'PN123', phoneNumber: '+1234567890' } }),
      releaseNumber: jest.fn().mockResolvedValue(true),
      makeCall: jest.fn().mockResolvedValue({ success: true, call: { sid: 'CA123' } }),
      generateTwiML: jest.fn().mockReturnValue('<Response></Response>')
    })),
    SpeechToText: jest.fn().mockImplementation(() => ({
      transcribe: jest.fn().mockResolvedValue({ success: true, text: 'Test transcription' })
    })),
    TextToSpeech: jest.fn().mockImplementation(() => ({
      getVoices: jest.fn().mockResolvedValue({ success: true, voices: [] }),
      synthesize: jest.fn().mockResolvedValue({ success: true, audio: Buffer.from('audio'), contentType: 'audio/mpeg' })
    })),
    VoiceQueue: mockVoiceQueue,
    LanguageSupport: mockLanguageSupport,
    VoiceAnalytics: mockVoiceAnalytics,
    VoiceStorage: mockVoiceStorage,
    FormatConverter: mockFormatConverter,
    StreamingTranscription: mockStreamingTranscription
  };
});

const express = require('express');
const request = require('supertest');
const voiceRoutes = require('../../routes/voice');
const db = require('../../db');
const {
  LanguageSupport,
  VoiceAnalytics,
  VoiceStorage,
  FormatConverter,
  VoiceQueue,
  StreamingTranscription
} = require('../../services/voice');

// Create test app
const app = express();
app.use(express.json());

// Mock auth middleware
app.use((req, res, next) => {
  req.user = { id: 1, organizationId: 1 };
  next();
});

app.use('/api/voice', voiceRoutes);

describe('Voice Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // LANGUAGE SUPPORT ROUTES
  // ==========================================

  describe('GET /api/voice/languages', () => {
    it('should return supported languages', async () => {
      const response = await request(app)
        .get('/api/voice/languages')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.languages).toBeInstanceOf(Array);
      expect(response.body.total).toBeGreaterThan(0);
    });

    it('should filter by provider when specified', async () => {
      const response = await request(app)
        .get('/api/voice/languages?provider=whisper')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.provider).toBe('whisper');
    });
  });

  describe('GET /api/voice/languages/:code', () => {
    it('should return language details', async () => {
      const response = await request(app)
        .get('/api/voice/languages/en')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.language).toBeDefined();
    });

    it('should return 404 for unsupported language', async () => {
      LanguageSupport.getLanguageInfo.mockReturnValueOnce(null);

      const response = await request(app)
        .get('/api/voice/languages/xyz')
        .expect(404);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/voice/languages/detect', () => {
    it('should detect language from text', async () => {
      const response = await request(app)
        .post('/api/voice/languages/detect')
        .send({ text: 'Hello, how are you?' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.language).toBeDefined();
    });

    it('should return 400 if text is missing', async () => {
      const response = await request(app)
        .post('/api/voice/languages/detect')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Text is required');
    });
  });

  // ==========================================
  // VOICE ANALYTICS ROUTES
  // ==========================================

  describe('GET /api/voice/stats', () => {
    it('should return voice statistics', async () => {
      const response = await request(app)
        .get('/api/voice/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.stats).toBeDefined();
    });

    it('should pass query parameters to service', async () => {
      await request(app)
        .get('/api/voice/stats?provider=whisper&language=en')
        .expect(200);

      expect(VoiceAnalytics.getStats).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'whisper',
          language: 'en'
        })
      );
    });
  });

  describe('GET /api/voice/stats/realtime', () => {
    it('should return realtime metrics', async () => {
      const response = await request(app)
        .get('/api/voice/stats/realtime')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metrics).toBeDefined();
    });
  });

  // ==========================================
  // FORMAT CONVERSION ROUTES
  // ==========================================

  describe('GET /api/voice/convert/formats', () => {
    it('should return supported formats', async () => {
      const response = await request(app)
        .get('/api/voice/convert/formats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.formats).toBeDefined();
      expect(response.body.presets).toBeDefined();
    });
  });

  // ==========================================
  // VOICE STORAGE ROUTES
  // ==========================================

  describe('GET /api/voice/files', () => {
    it('should list voice files', async () => {
      const response = await request(app)
        .get('/api/voice/files')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.files).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/voice/storage/stats', () => {
    it('should return storage statistics', async () => {
      const response = await request(app)
        .get('/api/voice/storage/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.stats).toBeDefined();
    });
  });

  // ==========================================
  // TRANSCRIPTION QUEUE ROUTES
  // ==========================================

  describe('GET /api/voice/transcribe/:jobId', () => {
    it('should return job status', async () => {
      VoiceQueue.getJob.mockReturnValueOnce({
        id: 'job-1',
        status: 'completed',
        provider: 'whisper',
        result: { text: 'Hello' }
      });

      const response = await request(app)
        .get('/api/voice/transcribe/job-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.job).toBeDefined();
    });

    it('should return 404 for non-existent job', async () => {
      VoiceQueue.getJob.mockReturnValueOnce(null);

      const response = await request(app)
        .get('/api/voice/transcribe/non-existent')
        .expect(404);

      expect(response.body.error).toBe('Job not found');
    });
  });

  describe('GET /api/voice/queue/stats', () => {
    it('should return queue statistics', async () => {
      const response = await request(app)
        .get('/api/voice/queue/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.stats).toBeDefined();
    });
  });

  // ==========================================
  // STREAMING TRANSCRIPTION ROUTES
  // ==========================================

  describe('POST /api/voice/stream/session', () => {
    it('should create streaming session', async () => {
      const response = await request(app)
        .post('/api/voice/stream/session')
        .send({ provider: 'deepgram', language: 'en' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.session).toBeDefined();
    });

    it('should use default values', async () => {
      const response = await request(app)
        .post('/api/voice/stream/session')
        .send({})
        .expect(201);

      expect(StreamingTranscription.createSession).toHaveBeenCalled();
    });
  });

  describe('POST /api/voice/stream/:sessionId/start', () => {
    it('should start streaming session', async () => {
      const response = await request(app)
        .post('/api/voice/stream/session-1/start')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('connected');
    });
  });

  describe('POST /api/voice/stream/:sessionId/end', () => {
    it('should end streaming session', async () => {
      const response = await request(app)
        .post('/api/voice/stream/session-1/end')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.transcript).toBeDefined();
    });
  });

  describe('GET /api/voice/stream/:sessionId/status', () => {
    it('should return session status', async () => {
      const response = await request(app)
        .get('/api/voice/stream/session-1/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status).toBeDefined();
    });
  });

  describe('GET /api/voice/stream/sessions', () => {
    it('should return active sessions', async () => {
      const response = await request(app)
        .get('/api/voice/stream/sessions')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.sessions).toBeInstanceOf(Array);
    });
  });

  // ==========================================
  // VOICE BOTS ROUTES
  // ==========================================

  describe('GET /api/voice/bots', () => {
    it('should return user voice bots', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/voice/bots')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.bots).toBeInstanceOf(Array);
    });
  });

  describe('POST /api/voice/bots', () => {
    it('should create voice bot', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Test Bot', user_id: 1 }]
      });

      const response = await request(app)
        .post('/api/voice/bots')
        .send({ name: 'Test Bot' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.bot).toBeDefined();
    });

    it('should require name', async () => {
      const response = await request(app)
        .post('/api/voice/bots')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Name is required');
    });
  });

  // ==========================================
  // TTS/STT ROUTES
  // ==========================================

  describe('GET /api/voice/voices', () => {
    it('should return available voices', async () => {
      const response = await request(app)
        .get('/api/voice/voices')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/voice/synthesize', () => {
    it('should synthesize speech', async () => {
      const response = await request(app)
        .post('/api/voice/synthesize')
        .send({ text: 'Hello world' })
        .expect(200);

      expect(response.headers['content-type']).toContain('audio');
    });

    it('should require text', async () => {
      const response = await request(app)
        .post('/api/voice/synthesize')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Text is required');
    });
  });
});
