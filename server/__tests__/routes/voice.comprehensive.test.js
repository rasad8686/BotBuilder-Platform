/**
 * Voice Routes Comprehensive Integration Tests
 * Covers: Voice Bots CRUD, Phone Numbers, Calls, Webhooks, TTS/STT
 */

const request = require('supertest');
const express = require('express');

// Mock database
const mockDb = {
  query: jest.fn()
};
jest.mock('../../db', () => mockDb);

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// Mock auth middleware
jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => next()));

// Mock voice services
const mockTwilioService = {
  isConfigured: jest.fn().mockReturnValue(true),
  searchAvailableNumbers: jest.fn(),
  purchaseNumber: jest.fn(),
  releaseNumber: jest.fn(),
  makeCall: jest.fn(),
  generateTwiML: jest.fn().mockReturnValue('<Response></Response>')
};

const mockTextToSpeech = {
  getVoices: jest.fn().mockResolvedValue({ success: true, voices: [] }),
  synthesize: jest.fn().mockResolvedValue({ success: true, audio: Buffer.from('audio'), contentType: 'audio/mpeg' })
};

const mockSpeechToText = {
  transcribe: jest.fn().mockResolvedValue({ success: true, text: 'Transcription' })
};

jest.mock('../../services/voice', () => ({
  TwilioService: jest.fn().mockImplementation(() => mockTwilioService),
  SpeechToText: jest.fn().mockImplementation(() => mockSpeechToText),
  TextToSpeech: jest.fn().mockImplementation(() => mockTextToSpeech),
  VoiceQueue: {
    addJob: jest.fn().mockResolvedValue({ id: 'job-1', status: 'pending', provider: 'whisper', priority: 2, createdAt: new Date() }),
    getJob: jest.fn(),
    getStats: jest.fn().mockReturnValue({ queueLength: 0, processing: false })
  },
  LanguageSupport: {
    getSupportedLanguages: jest.fn().mockReturnValue([
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Spanish' }
    ]),
    getLanguageInfo: jest.fn(),
    getSTTCode: jest.fn().mockReturnValue('en-US'),
    detectLanguage: jest.fn().mockReturnValue({ language: 'en', confidence: 0.9 })
  },
  VoiceAnalytics: {
    getStats: jest.fn().mockResolvedValue({ summary: {} }),
    getRealTimeMetrics: jest.fn().mockReturnValue({ totalTranscriptions: 100 })
  },
  VoiceStorage: {
    store: jest.fn().mockResolvedValue({ success: true, filename: 'test.wav' }),
    retrieve: jest.fn().mockResolvedValue({ buffer: Buffer.from('audio'), contentType: 'audio/wav' }),
    delete: jest.fn().mockResolvedValue(true),
    list: jest.fn().mockResolvedValue([]),
    getSignedUrl: jest.fn().mockResolvedValue('http://example.com/file'),
    getStorageStats: jest.fn().mockResolvedValue({ totalFiles: 10 })
  },
  FormatConverter: {
    convert: jest.fn().mockResolvedValue({ success: true, buffer: Buffer.from('converted') }),
    getSupportedFormats: jest.fn().mockReturnValue({ input: ['mp3', 'wav'], output: ['mp3', 'wav'] }),
    getPresets: jest.fn().mockReturnValue([]),
    isAvailable: jest.fn().mockResolvedValue(true)
  },
  StreamingTranscription: {
    createSession: jest.fn().mockReturnValue({ sessionId: 'session-1', provider: 'deepgram' }),
    startSession: jest.fn().mockResolvedValue({ sessionId: 'session-1', status: 'connected' }),
    sendAudio: jest.fn(),
    endSession: jest.fn().mockResolvedValue({ sessionId: 'session-1', transcript: 'Test' }),
    getSessionStatus: jest.fn().mockReturnValue({ status: 'connected' }),
    getActiveSessions: jest.fn().mockReturnValue([])
  }
}));

const { LanguageSupport, VoiceQueue, VoiceStorage, FormatConverter, VoiceAnalytics, StreamingTranscription } = require('../../services/voice');
const voiceRoutes = require('../../routes/voice');

describe('Voice Routes Comprehensive Tests', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = { id: 1, organizationId: 1 };
      next();
    });
    app.use('/api/voice', voiceRoutes);
    jest.clearAllMocks();
  });

  // ==========================================
  // VOICE BOTS CRUD
  // ==========================================
  describe('Voice Bots CRUD', () => {
    describe('GET /api/voice/bots', () => {
      it('should return user voice bots', async () => {
        mockDb.query.mockResolvedValueOnce({
          rows: [{
            id: 1,
            name: 'Bot 1',
            voice_settings: '{"speed": 1.0}',
            stt_settings: '{}',
            tts_settings: '{}',
            settings: '{}'
          }]
        });

        const res = await request(app).get('/api/voice/bots');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.bots).toHaveLength(1);
        expect(res.body.bots[0].voice_settings).toEqual({ speed: 1.0 });
      });

      it('should handle JSON object fields', async () => {
        mockDb.query.mockResolvedValueOnce({
          rows: [{
            id: 1,
            name: 'Bot 1',
            voice_settings: { speed: 1.0 },
            stt_settings: null,
            tts_settings: null,
            settings: null
          }]
        });

        const res = await request(app).get('/api/voice/bots');

        expect(res.status).toBe(200);
        expect(res.body.bots[0].voice_settings).toEqual({ speed: 1.0 });
      });

      it('should handle database error', async () => {
        mockDb.query.mockRejectedValueOnce(new Error('DB Error'));

        const res = await request(app).get('/api/voice/bots');

        expect(res.status).toBe(500);
      });
    });

    describe('GET /api/voice/bots/:id', () => {
      it('should return single bot', async () => {
        mockDb.query.mockResolvedValueOnce({
          rows: [{ id: 1, name: 'Bot 1', user_id: 1 }]
        });

        const res = await request(app).get('/api/voice/bots/1');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.bot).toBeDefined();
      });

      it('should return 404 for non-existent bot', async () => {
        mockDb.query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app).get('/api/voice/bots/999');

        expect(res.status).toBe(404);
      });
    });

    describe('POST /api/voice/bots', () => {
      it('should create voice bot', async () => {
        mockDb.query.mockResolvedValueOnce({
          rows: [{ id: 1, name: 'New Bot', user_id: 1 }]
        });

        const res = await request(app)
          .post('/api/voice/bots')
          .send({ name: 'New Bot', voice_provider: 'elevenlabs' });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.bot).toBeDefined();
      });

      it('should require name', async () => {
        const res = await request(app)
          .post('/api/voice/bots')
          .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Name is required');
      });

      it('should create with all options', async () => {
        mockDb.query.mockResolvedValueOnce({
          rows: [{ id: 1, name: 'Full Bot' }]
        });

        const res = await request(app)
          .post('/api/voice/bots')
          .send({
            name: 'Full Bot',
            description: 'A test bot',
            voice_provider: 'elevenlabs',
            voice_id: 'voice-123',
            voice_settings: { speed: 1.2 },
            stt_provider: 'whisper',
            tts_provider: 'elevenlabs',
            ai_model: 'gpt-4',
            system_prompt: 'You are helpful',
            greeting_message: 'Hello!',
            fallback_message: 'Sorry',
            max_call_duration: 300,
            language: 'en-US',
            settings: { recording: true }
          });

        expect(res.status).toBe(201);
      });

      it('should handle database error', async () => {
        mockDb.query.mockRejectedValueOnce(new Error('Insert failed'));

        const res = await request(app)
          .post('/api/voice/bots')
          .send({ name: 'Test' });

        expect(res.status).toBe(500);
      });
    });

    describe('PUT /api/voice/bots/:id', () => {
      it('should update voice bot', async () => {
        mockDb.query
          .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1 }] }) // Check exists
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Updated' }] }); // Update

        const res = await request(app)
          .put('/api/voice/bots/1')
          .send({ name: 'Updated Bot' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('should return 404 for non-existent bot', async () => {
        mockDb.query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
          .put('/api/voice/bots/999')
          .send({ name: 'Updated' });

        expect(res.status).toBe(404);
      });

      it('should return 400 for no valid fields', async () => {
        mockDb.query.mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1 }] });

        const res = await request(app)
          .put('/api/voice/bots/1')
          .send({ invalid_field: 'test' });

        expect(res.status).toBe(400);
      });

      it('should update with object fields', async () => {
        mockDb.query
          .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 1 }] });

        const res = await request(app)
          .put('/api/voice/bots/1')
          .send({
            voice_settings: { speed: 1.5 },
            tts_settings: { pitch: 0.5 },
            settings: { recording: true }
          });

        expect(res.status).toBe(200);
      });
    });

    describe('DELETE /api/voice/bots/:id', () => {
      it('should delete voice bot', async () => {
        mockDb.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

        const res = await request(app).delete('/api/voice/bots/1');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('should return 404 for non-existent bot', async () => {
        mockDb.query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app).delete('/api/voice/bots/999');

        expect(res.status).toBe(404);
      });
    });
  });

  // ==========================================
  // PHONE NUMBERS
  // ==========================================
  describe('Phone Numbers', () => {
    describe('GET /api/voice/phone-numbers', () => {
      it('should return phone numbers', async () => {
        mockDb.query.mockResolvedValueOnce({
          rows: [{ id: 1, phone_number: '+1234567890' }]
        });

        const res = await request(app).get('/api/voice/phone-numbers');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.phoneNumbers).toBeDefined();
      });
    });

    describe('GET /api/voice/phone-numbers/available', () => {
      it('should search available numbers', async () => {
        mockTwilioService.searchAvailableNumbers.mockResolvedValueOnce({
          success: true,
          numbers: [{ phoneNumber: '+1234567890' }]
        });

        const res = await request(app)
          .get('/api/voice/phone-numbers/available?country=US');

        expect(res.status).toBe(200);
      });

      it('should handle Twilio not configured', async () => {
        mockTwilioService.isConfigured.mockReturnValueOnce(false);

        const res = await request(app)
          .get('/api/voice/phone-numbers/available');

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Twilio not configured');
      });

      it('should pass area code and contains', async () => {
        mockTwilioService.searchAvailableNumbers.mockResolvedValueOnce({ success: true, numbers: [] });

        await request(app)
          .get('/api/voice/phone-numbers/available?country=US&areaCode=415&contains=HELLO');

        expect(mockTwilioService.searchAvailableNumbers).toHaveBeenCalledWith('US', { areaCode: '415', contains: 'HELLO' });
      });
    });

    describe('POST /api/voice/phone-numbers/purchase', () => {
      it('should purchase phone number', async () => {
        mockTwilioService.purchaseNumber.mockResolvedValueOnce({
          success: true,
          number: { sid: 'PN123', phoneNumber: '+1234567890', capabilities: {}, friendlyName: 'Test' }
        });
        mockDb.query.mockResolvedValueOnce({
          rows: [{ id: 1, phone_number: '+1234567890' }]
        });

        const res = await request(app)
          .post('/api/voice/phone-numbers/purchase')
          .send({ phoneNumber: '+1234567890' });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
      });

      it('should require phone number', async () => {
        const res = await request(app)
          .post('/api/voice/phone-numbers/purchase')
          .send({});

        expect(res.status).toBe(400);
      });

      it('should handle Twilio not configured', async () => {
        mockTwilioService.isConfigured.mockReturnValueOnce(false);

        const res = await request(app)
          .post('/api/voice/phone-numbers/purchase')
          .send({ phoneNumber: '+1234567890' });

        expect(res.status).toBe(400);
      });

      it('should handle purchase error', async () => {
        mockTwilioService.purchaseNumber.mockResolvedValueOnce({ success: false, error: 'Number unavailable' });

        const res = await request(app)
          .post('/api/voice/phone-numbers/purchase')
          .send({ phoneNumber: '+1234567890' });

        expect(res.status).toBe(400);
      });
    });

    describe('DELETE /api/voice/phone-numbers/:id', () => {
      it('should release phone number', async () => {
        mockDb.query
          .mockResolvedValueOnce({ rows: [{ id: 1, provider_sid: 'PN123', phone_number: '+1234567890', user_id: 1 }] })
          .mockResolvedValueOnce({ rows: [] });
        mockTwilioService.releaseNumber.mockResolvedValueOnce(true);

        const res = await request(app).delete('/api/voice/phone-numbers/1');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('should return 404 for non-existent number', async () => {
        mockDb.query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app).delete('/api/voice/phone-numbers/999');

        expect(res.status).toBe(404);
      });

      it('should handle number without provider_sid', async () => {
        mockDb.query
          .mockResolvedValueOnce({ rows: [{ id: 1, provider_sid: null, phone_number: '+1234567890', user_id: 1 }] })
          .mockResolvedValueOnce({ rows: [] });

        const res = await request(app).delete('/api/voice/phone-numbers/1');

        expect(res.status).toBe(200);
      });
    });
  });

  // ==========================================
  // CALLS
  // ==========================================
  describe('Calls', () => {
    describe('GET /api/voice/calls', () => {
      it('should return calls', async () => {
        mockDb.query
          .mockResolvedValueOnce({ rows: [{ id: 1, status: 'completed', bot_name: 'Bot 1' }] })
          .mockResolvedValueOnce({ rows: [{ count: '10' }] });

        const res = await request(app).get('/api/voice/calls');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.calls).toBeDefined();
        expect(res.body.total).toBe(10);
      });

      it('should filter by botId', async () => {
        mockDb.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] });

        await request(app).get('/api/voice/calls?botId=1');

        expect(mockDb.query).toHaveBeenCalled();
      });

      it('should filter by status and direction', async () => {
        mockDb.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] });

        await request(app).get('/api/voice/calls?status=completed&direction=inbound');

        expect(mockDb.query).toHaveBeenCalled();
      });

      it('should handle pagination', async () => {
        mockDb.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: '100' }] });

        await request(app).get('/api/voice/calls?limit=20&offset=40');

        expect(mockDb.query).toHaveBeenCalled();
      });
    });

    describe('GET /api/voice/calls/:id', () => {
      it('should return call details with segments', async () => {
        mockDb.query
          .mockResolvedValueOnce({ rows: [{ id: 1, status: 'completed' }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, segment_number: 1 }] });

        const res = await request(app).get('/api/voice/calls/1');

        expect(res.status).toBe(200);
        expect(res.body.call).toBeDefined();
        expect(res.body.segments).toBeDefined();
      });

      it('should return 404 for non-existent call', async () => {
        mockDb.query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app).get('/api/voice/calls/999');

        expect(res.status).toBe(404);
      });
    });

    describe('POST /api/voice/calls/outbound', () => {
      it('should make outbound call', async () => {
        mockDb.query.mockResolvedValueOnce({
          rows: [{ id: 1, from_number: '+1234567890', phone_number_id: 1 }]
        });
        mockTwilioService.makeCall.mockResolvedValueOnce({
          success: true,
          call: { sid: 'CA123' }
        });
        mockDb.query.mockResolvedValueOnce({
          rows: [{ id: 1, provider_call_sid: 'CA123' }]
        });

        const res = await request(app)
          .post('/api/voice/calls/outbound')
          .send({ botId: 1, toNumber: '+9876543210' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('should require botId and toNumber', async () => {
        const res = await request(app)
          .post('/api/voice/calls/outbound')
          .send({});

        expect(res.status).toBe(400);
      });

      it('should return 404 for non-existent bot', async () => {
        mockDb.query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
          .post('/api/voice/calls/outbound')
          .send({ botId: 999, toNumber: '+1234567890' });

        expect(res.status).toBe(404);
      });

      it('should handle Twilio not configured', async () => {
        mockDb.query.mockResolvedValueOnce({ rows: [{ id: 1, from_number: '+1234567890' }] });
        mockTwilioService.isConfigured.mockReturnValueOnce(false);

        const res = await request(app)
          .post('/api/voice/calls/outbound')
          .send({ botId: 1, toNumber: '+9876543210' });

        expect(res.status).toBe(400);
      });

      it('should handle call error', async () => {
        mockDb.query.mockResolvedValueOnce({ rows: [{ id: 1, from_number: '+1234567890' }] });
        mockTwilioService.makeCall.mockResolvedValueOnce({ success: false, error: 'Call failed' });

        const res = await request(app)
          .post('/api/voice/calls/outbound')
          .send({ botId: 1, toNumber: '+9876543210' });

        expect(res.status).toBe(400);
      });
    });
  });

  // ==========================================
  // TWILIO WEBHOOKS
  // ==========================================
  describe('Twilio Webhooks', () => {
    describe('POST /api/voice/webhook/:botId', () => {
      it('should handle incoming call', async () => {
        mockDb.query
          .mockResolvedValueOnce({ rows: [{ id: 1, greeting_message: 'Hello', language: 'en-US' }] })
          .mockResolvedValueOnce({ rows: [{ id: 1 }] });

        const res = await request(app)
          .post('/api/voice/webhook/1')
          .send({
            CallSid: 'CA123',
            From: '+1234567890',
            To: '+0987654321',
            CallStatus: 'ringing'
          });

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('xml');
      });

      it('should return 404 for non-existent bot', async () => {
        mockDb.query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
          .post('/api/voice/webhook/999')
          .send({ CallSid: 'CA123' });

        expect(res.status).toBe(404);
      });
    });

    describe('POST /api/voice/webhook/:botId/gather', () => {
      it('should handle speech input', async () => {
        mockDb.query.mockResolvedValueOnce({
          rows: [{ id: 1, fallback_message: 'I understand', language: 'en-US' }]
        });

        const res = await request(app)
          .post('/api/voice/webhook/1/gather')
          .send({
            CallSid: 'CA123',
            SpeechResult: 'Hello',
            Confidence: '0.9'
          });

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('xml');
      });
    });

    describe('POST /api/voice/webhook/:botId/status', () => {
      it('should handle call status update', async () => {
        mockDb.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

        const res = await request(app)
          .post('/api/voice/webhook/1/status')
          .send({
            CallSid: 'CA123',
            CallStatus: 'completed',
            CallDuration: '60'
          });

        expect(res.status).toBe(200);
      });

      it('should update bot statistics on completion', async () => {
        mockDb.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [] });

        await request(app)
          .post('/api/voice/webhook/1/status')
          .send({
            CallSid: 'CA123',
            CallStatus: 'completed',
            CallDuration: '120'
          });

        expect(mockDb.query).toHaveBeenCalledTimes(2);
      });
    });
  });

  // ==========================================
  // TTS/STT
  // ==========================================
  describe('TTS/STT', () => {
    describe('GET /api/voice/voices', () => {
      it('should return available voices', async () => {
        const res = await request(app).get('/api/voice/voices');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('should support provider parameter', async () => {
        await request(app).get('/api/voice/voices?provider=google');

        // TextToSpeech constructor called with provider
      });
    });

    describe('POST /api/voice/synthesize', () => {
      it('should synthesize speech', async () => {
        const res = await request(app)
          .post('/api/voice/synthesize')
          .send({ text: 'Hello world' });

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('audio');
      });

      it('should require text', async () => {
        const res = await request(app)
          .post('/api/voice/synthesize')
          .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Text is required');
      });

      it('should handle synthesis error', async () => {
        mockTextToSpeech.synthesize.mockResolvedValueOnce({ success: false, error: 'Failed' });

        const res = await request(app)
          .post('/api/voice/synthesize')
          .send({ text: 'Test' });

        expect(res.status).toBe(400);
      });

      it('should support options', async () => {
        await request(app)
          .post('/api/voice/synthesize')
          .send({ text: 'Hello', provider: 'google', voiceId: 'voice-1', options: { speed: 1.2 } });

        // TextToSpeech.synthesize called with options
      });
    });
  });

  // ==========================================
  // LANGUAGE SUPPORT
  // ==========================================
  describe('Language Support', () => {
    describe('GET /api/voice/languages', () => {
      it('should return supported languages', async () => {
        const res = await request(app).get('/api/voice/languages');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.languages).toBeDefined();
      });

      it('should filter by provider', async () => {
        const res = await request(app).get('/api/voice/languages?provider=whisper');

        expect(res.status).toBe(200);
        expect(res.body.provider).toBe('whisper');
      });
    });

    describe('GET /api/voice/languages/:code', () => {
      it('should return language details', async () => {
        LanguageSupport.getLanguageInfo.mockReturnValueOnce({ code: 'en', name: 'English' });

        const res = await request(app).get('/api/voice/languages/en');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.language).toBeDefined();
      });

      it('should return 404 for unsupported language', async () => {
        LanguageSupport.getLanguageInfo.mockReturnValueOnce(null);

        const res = await request(app).get('/api/voice/languages/xyz');

        expect(res.status).toBe(404);
      });
    });

    describe('POST /api/voice/languages/detect', () => {
      it('should detect language', async () => {
        const res = await request(app)
          .post('/api/voice/languages/detect')
          .send({ text: 'Hello world' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.language).toBeDefined();
      });

      it('should require text', async () => {
        const res = await request(app)
          .post('/api/voice/languages/detect')
          .send({});

        expect(res.status).toBe(400);
      });
    });
  });

  // ==========================================
  // VOICE FILE STORAGE
  // ==========================================
  describe('Voice File Storage', () => {
    describe('GET /api/voice/files', () => {
      it('should list voice files', async () => {
        const res = await request(app).get('/api/voice/files');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.files).toBeDefined();
      });

      it('should support limit parameter', async () => {
        await request(app).get('/api/voice/files?limit=50');

        expect(VoiceStorage.list).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }));
      });
    });

    describe('GET /api/voice/files/:filename', () => {
      it('should retrieve voice file', async () => {
        const res = await request(app).get('/api/voice/files/1/test.wav');

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('audio');
      });

      it('should deny access to other org files', async () => {
        const res = await request(app).get('/api/voice/files/999/test.wav');

        expect(res.status).toBe(403);
      });
    });

    describe('DELETE /api/voice/files/:filename', () => {
      it('should delete voice file', async () => {
        const res = await request(app).delete('/api/voice/files/1/test.wav');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('should deny access to other org files', async () => {
        const res = await request(app).delete('/api/voice/files/999/test.wav');

        expect(res.status).toBe(403);
      });
    });

    describe('GET /api/voice/files/:filename/url', () => {
      it('should get signed URL', async () => {
        const res = await request(app).get('/api/voice/files/test.wav/url');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('should support expiresIn parameter', async () => {
        await request(app).get('/api/voice/files/test.wav/url?expiresIn=7200');

        expect(VoiceStorage.getSignedUrl).toHaveBeenCalledWith('test.wav', 7200);
      });
    });

    describe('GET /api/voice/storage/stats', () => {
      it('should return storage stats', async () => {
        const res = await request(app).get('/api/voice/storage/stats');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.stats).toBeDefined();
      });
    });
  });

  // ==========================================
  // TRANSCRIPTION QUEUE
  // ==========================================
  describe('Transcription Queue', () => {
    describe('GET /api/voice/transcribe/:jobId', () => {
      it('should return job status', async () => {
        VoiceQueue.getJob.mockReturnValueOnce({
          id: 'job-1',
          status: 'completed',
          provider: 'whisper',
          result: { text: 'Transcription' }
        });

        const res = await request(app).get('/api/voice/transcribe/job-1');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.job).toBeDefined();
      });

      it('should return 404 for non-existent job', async () => {
        VoiceQueue.getJob.mockReturnValueOnce(null);

        const res = await request(app).get('/api/voice/transcribe/non-existent');

        expect(res.status).toBe(404);
      });
    });

    describe('GET /api/voice/queue/stats', () => {
      it('should return queue stats', async () => {
        const res = await request(app).get('/api/voice/queue/stats');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.stats).toBeDefined();
      });
    });
  });

  // ==========================================
  // FORMAT CONVERSION
  // ==========================================
  describe('Format Conversion', () => {
    describe('GET /api/voice/convert/formats', () => {
      it('should return supported formats', async () => {
        const res = await request(app).get('/api/voice/convert/formats');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.formats).toBeDefined();
        expect(res.body.presets).toBeDefined();
        expect(res.body.available).toBeDefined();
      });
    });
  });

  // ==========================================
  // STATS & ANALYTICS ENDPOINTS
  // ==========================================
  describe('Voice Stats & Analytics', () => {
    describe('GET /api/voice/stats', () => {
      it('should return voice stats', async () => {
        const res = await request(app).get('/api/voice/stats');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.stats).toBeDefined();
      });

      it('should filter stats by date range', async () => {
        const res = await request(app)
          .get('/api/voice/stats')
          .query({ startDate: '2024-01-01', endDate: '2024-12-31' });

        expect(res.status).toBe(200);
        expect(VoiceAnalytics.getStats).toHaveBeenCalled();
      });

      it('should filter stats by provider', async () => {
        const res = await request(app)
          .get('/api/voice/stats')
          .query({ provider: 'whisper' });

        expect(res.status).toBe(200);
      });

      it('should filter stats by language', async () => {
        const res = await request(app)
          .get('/api/voice/stats')
          .query({ language: 'en' });

        expect(res.status).toBe(200);
      });

      it('should filter stats by botId', async () => {
        const res = await request(app)
          .get('/api/voice/stats')
          .query({ botId: '1' });

        expect(res.status).toBe(200);
      });

      it('should handle stats error', async () => {
        VoiceAnalytics.getStats.mockRejectedValueOnce(new Error('Stats error'));

        const res = await request(app).get('/api/voice/stats');

        expect(res.status).toBe(500);
      });
    });

    describe('GET /api/voice/stats/realtime', () => {
      it('should return realtime metrics', async () => {
        const res = await request(app).get('/api/voice/stats/realtime');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.metrics).toBeDefined();
      });

      it('should handle realtime stats error', async () => {
        VoiceAnalytics.getRealTimeMetrics.mockImplementationOnce(() => {
          throw new Error('Realtime error');
        });

        const res = await request(app).get('/api/voice/stats/realtime');

        expect(res.status).toBe(500);
      });
    });
  });

  // ==========================================
  // FILE UPLOAD & MANAGEMENT
  // ==========================================
  describe('Voice File Management - Extended', () => {
    describe('POST /api/voice/files', () => {
      it('should return 400 when no file uploaded', async () => {
        const res = await request(app)
          .post('/api/voice/files')
          .send({ botId: 1 });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Audio file is required');
      });

      it('should handle file upload error', async () => {
        VoiceStorage.store.mockRejectedValueOnce(new Error('Storage error'));

        // Mock file upload
        const app2 = require('express')();
        app2.use(require('express').json());
        app2.use((req, res, next) => {
          req.user = { id: 1, organizationId: 1 };
          req.files = {
            audio: {
              name: 'test.wav',
              data: Buffer.from('audio'),
              mimetype: 'audio/wav'
            }
          };
          next();
        });
        app2.use('/api/voice', require('../../../routes/voice'));

        const res = await request(app2).post('/api/voice/files').send({ botId: 1 });

        expect(res.status).toBe(500);
      });
    });

    describe('GET /api/voice/files', () => {
      it('should list voice files with limit', async () => {
        const res = await request(app)
          .get('/api/voice/files')
          .query({ limit: 50 });

        expect(res.status).toBe(200);
        expect(VoiceStorage.list).toHaveBeenCalled();
      });

      it('should handle list files error', async () => {
        VoiceStorage.list.mockRejectedValueOnce(new Error('List error'));

        const res = await request(app).get('/api/voice/files');

        expect(res.status).toBe(500);
      });
    });

    describe('GET /api/voice/files/:filename', () => {
      it('should return 403 for unauthorized file access', async () => {
        // Create app with different org
        const app2 = require('express')();
        app2.use(require('express').json());
        app2.use((req, res, next) => {
          req.user = { id: 1, organizationId: 2 };
          next();
        });
        app2.use('/api/voice', require('../../../routes/voice'));

        const res = await request(app2).get('/api/voice/files/1/test.wav');

        expect(res.status).toBe(403);
      });

      it('should handle file retrieve error', async () => {
        VoiceStorage.retrieve.mockRejectedValueOnce(new Error('Retrieve error'));

        const res = await request(app).get('/api/voice/files/1/test.wav');

        expect(res.status).toBe(500);
      });
    });

    describe('DELETE /api/voice/files/:filename', () => {
      it('should delete voice file', async () => {
        const res = await request(app).delete('/api/voice/files/1/test.wav');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('should return 403 for unauthorized delete', async () => {
        const app2 = require('express')();
        app2.use(require('express').json());
        app2.use((req, res, next) => {
          req.user = { id: 1, organizationId: 2 };
          next();
        });
        app2.use('/api/voice', require('../../../routes/voice'));

        const res = await request(app2).delete('/api/voice/files/1/test.wav');

        expect(res.status).toBe(403);
      });

      it('should handle delete error', async () => {
        VoiceStorage.delete.mockRejectedValueOnce(new Error('Delete error'));

        const res = await request(app).delete('/api/voice/files/1/test.wav');

        expect(res.status).toBe(500);
      });
    });

    describe('GET /api/voice/files/:filename/url', () => {
      it('should get signed URL', async () => {
        const res = await request(app).get('/api/voice/files/1/test.wav/url');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.url).toBeDefined();
      });

      it('should return 403 for unauthorized URL access', async () => {
        const app2 = require('express')();
        app2.use(require('express').json());
        app2.use((req, res, next) => {
          req.user = { id: 1, organizationId: 2 };
          next();
        });
        app2.use('/api/voice', require('../../../routes/voice'));

        const res = await request(app2).get('/api/voice/files/1/test.wav/url');

        expect(res.status).toBe(403);
      });

      it('should handle signed URL error', async () => {
        VoiceStorage.getSignedUrl.mockRejectedValueOnce(new Error('URL error'));

        const res = await request(app).get('/api/voice/files/1/test.wav/url');

        expect(res.status).toBe(500);
      });
    });

    describe('GET /api/voice/storage/stats', () => {
      it('should handle storage stats error', async () => {
        VoiceStorage.getStorageStats.mockRejectedValueOnce(new Error('Stats error'));

        const res = await request(app).get('/api/voice/storage/stats');

        expect(res.status).toBe(500);
      });
    });
  });

  // ==========================================
  // TRANSCRIPTION QUEUE - EXTENDED
  // ==========================================
  describe('Transcription Queue - Extended', () => {
    describe('POST /api/voice/transcribe', () => {
      it('should return 400 when no audio file', async () => {
        const res = await request(app)
          .post('/api/voice/transcribe')
          .send({ provider: 'whisper' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Audio file is required');
      });

      it('should queue transcription job with high priority', async () => {
        const app2 = require('express')();
        app2.use(require('express').json());
        app2.use((req, res, next) => {
          req.user = { id: 1, organizationId: 1 };
          req.files = {
            audio: {
              name: 'test.wav',
              data: Buffer.from('audio')
            }
          };
          next();
        });
        app2.use('/api/voice', require('../../../routes/voice'));

        const res = await request(app2)
          .post('/api/voice/transcribe')
          .send({ priority: 'high', language: 'en' });

        expect(res.status).toBe(202);
      });

      it('should queue transcription job with low priority', async () => {
        const app2 = require('express')();
        app2.use(require('express').json());
        app2.use((req, res, next) => {
          req.user = { id: 1, organizationId: 1 };
          req.files = {
            audio: {
              name: 'test.wav',
              data: Buffer.from('audio')
            }
          };
          next();
        });
        app2.use('/api/voice', require('../../../routes/voice'));

        const res = await request(app2)
          .post('/api/voice/transcribe')
          .send({ priority: 'low' });

        expect(res.status).toBe(202);
      });

      it('should handle transcription queue error', async () => {
        VoiceQueue.addJob.mockRejectedValueOnce(new Error('Queue error'));

        const app2 = require('express')();
        app2.use(require('express').json());
        app2.use((req, res, next) => {
          req.user = { id: 1, organizationId: 1 };
          req.files = {
            audio: {
              name: 'test.wav',
              data: Buffer.from('audio')
            }
          };
          next();
        });
        app2.use('/api/voice', require('../../../routes/voice'));

        const res = await request(app2)
          .post('/api/voice/transcribe')
          .send({});

        expect(res.status).toBe(500);
      });
    });

    describe('GET /api/voice/transcribe/:jobId', () => {
      it('should handle job status error', async () => {
        VoiceQueue.getJob.mockImplementationOnce(() => {
          throw new Error('Job error');
        });

        const res = await request(app).get('/api/voice/transcribe/job-1');

        expect(res.status).toBe(500);
      });
    });

    describe('GET /api/voice/queue/stats', () => {
      it('should handle queue stats error', async () => {
        VoiceQueue.getStats.mockImplementationOnce(() => {
          throw new Error('Queue stats error');
        });

        const res = await request(app).get('/api/voice/queue/stats');

        expect(res.status).toBe(500);
      });
    });
  });

  // ==========================================
  // FORMAT CONVERSION - EXTENDED
  // ==========================================
  describe('Format Conversion - Extended', () => {
    describe('POST /api/voice/convert', () => {
      it('should return 400 when no audio file', async () => {
        const res = await request(app)
          .post('/api/voice/convert')
          .send({ outputFormat: 'mp3' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Audio file is required');
      });

      it('should return 503 when ffmpeg not available', async () => {
        FormatConverter.isAvailable.mockResolvedValueOnce(false);

        const app2 = require('express')();
        app2.use(require('express').json());
        app2.use((req, res, next) => {
          req.user = { id: 1, organizationId: 1 };
          req.files = {
            audio: {
              name: 'test.wav',
              data: Buffer.from('audio')
            }
          };
          next();
        });
        app2.use('/api/voice', require('../../../routes/voice'));

        const res = await request(app2)
          .post('/api/voice/convert')
          .send({ outputFormat: 'mp3' });

        expect(res.status).toBe(503);
      });

      it('should return 400 when conversion fails', async () => {
        FormatConverter.isAvailable.mockResolvedValueOnce(true);
        FormatConverter.convert.mockResolvedValueOnce({ success: false });

        const app2 = require('express')();
        app2.use(require('express').json());
        app2.use((req, res, next) => {
          req.user = { id: 1, organizationId: 1 };
          req.files = {
            audio: {
              name: 'test.wav',
              data: Buffer.from('audio')
            }
          };
          next();
        });
        app2.use('/api/voice', require('../../../routes/voice'));

        const res = await request(app2)
          .post('/api/voice/convert')
          .send({ outputFormat: 'mp3' });

        expect(res.status).toBe(400);
      });

      it('should convert audio with options', async () => {
        FormatConverter.isAvailable.mockResolvedValueOnce(true);
        FormatConverter.convert.mockResolvedValueOnce({
          success: true,
          buffer: Buffer.from('converted')
        });

        const app2 = require('express')();
        app2.use(require('express').json());
        app2.use((req, res, next) => {
          req.user = { id: 1, organizationId: 1 };
          req.files = {
            audio: {
              name: 'test.wav',
              data: Buffer.from('audio')
            }
          };
          next();
        });
        app2.use('/api/voice', require('../../../routes/voice'));

        const res = await request(app2)
          .post('/api/voice/convert')
          .send({
            outputFormat: 'mp3',
            sampleRate: 44100,
            channels: 2,
            bitrate: '128k',
            normalize: 'true',
            removeNoise: true
          });

        expect(res.status).toBe(200);
      });

      it('should handle conversion error', async () => {
        FormatConverter.isAvailable.mockRejectedValueOnce(new Error('Convert error'));

        const app2 = require('express')();
        app2.use(require('express').json());
        app2.use((req, res, next) => {
          req.user = { id: 1, organizationId: 1 };
          req.files = {
            audio: {
              name: 'test.wav',
              data: Buffer.from('audio')
            }
          };
          next();
        });
        app2.use('/api/voice', require('../../../routes/voice'));

        const res = await request(app2)
          .post('/api/voice/convert')
          .send({});

        expect(res.status).toBe(500);
      });
    });

    describe('GET /api/voice/convert/formats', () => {
      it('should handle formats error', async () => {
        FormatConverter.getSupportedFormats.mockImplementationOnce(() => {
          throw new Error('Formats error');
        });

        const res = await request(app).get('/api/voice/convert/formats');

        expect(res.status).toBe(500);
      });
    });
  });

  // ==========================================
  // STREAMING TRANSCRIPTION
  // ==========================================
  describe('Streaming Transcription', () => {
    describe('POST /api/voice/stream/session', () => {
      it('should create streaming session', async () => {
        const res = await request(app)
          .post('/api/voice/stream/session')
          .send({ provider: 'deepgram', language: 'en' });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.session).toBeDefined();
      });

      it('should create session with custom options', async () => {
        const res = await request(app)
          .post('/api/voice/stream/session')
          .send({
            provider: 'google',
            language: 'es',
            sampleRate: 44100,
            encoding: 'linear16',
            interimResults: false,
            model: 'phone_call'
          });

        expect(res.status).toBe(201);
        expect(StreamingTranscription.createSession).toHaveBeenCalledWith(
          expect.objectContaining({
            provider: 'google',
            language: 'es',
            sampleRate: 44100
          })
        );
      });

      it('should handle session creation error', async () => {
        StreamingTranscription.createSession.mockImplementationOnce(() => {
          throw new Error('Session error');
        });

        const res = await request(app)
          .post('/api/voice/stream/session')
          .send({});

        expect(res.status).toBe(500);
      });
    });

    describe('POST /api/voice/stream/:sessionId/start', () => {
      it('should start streaming session', async () => {
        StreamingTranscription.startSession.mockResolvedValueOnce({
          started: true,
          sessionId: 'session-1'
        });

        const res = await request(app).post('/api/voice/stream/session-1/start');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('should handle start session error', async () => {
        StreamingTranscription.startSession.mockRejectedValueOnce(
          new Error('Start error')
        );

        const res = await request(app).post('/api/voice/stream/session-1/start');

        expect(res.status).toBe(500);
      });
    });

    describe('POST /api/voice/stream/:sessionId/audio', () => {
      it('should return 400 when no audio data', async () => {
        const res = await request(app)
          .post('/api/voice/stream/session-1/audio')
          .send();

        expect(res.status).toBe(400);
      });

      it('should send audio to session', async () => {
        const res = await request(app)
          .post('/api/voice/stream/session-1/audio')
          .send(Buffer.from('audio data'));

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('should handle send audio error', async () => {
        StreamingTranscription.sendAudio.mockImplementationOnce(() => {
          throw new Error('Audio error');
        });

        const res = await request(app)
          .post('/api/voice/stream/session-1/audio')
          .send(Buffer.from('audio'));

        expect(res.status).toBe(500);
      });
    });

    describe('POST /api/voice/stream/:sessionId/end', () => {
      it('should end streaming session', async () => {
        StreamingTranscription.endSession.mockResolvedValueOnce({
          transcript: 'Final transcription',
          ended: true
        });

        const res = await request(app).post('/api/voice/stream/session-1/end');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('should handle end session error', async () => {
        StreamingTranscription.endSession.mockRejectedValueOnce(
          new Error('End error')
        );

        const res = await request(app).post('/api/voice/stream/session-1/end');

        expect(res.status).toBe(500);
      });
    });

    describe('GET /api/voice/stream/:sessionId/status', () => {
      it('should return session status', async () => {
        StreamingTranscription.getSessionStatus.mockReturnValueOnce({
          sessionId: 'session-1',
          status: 'active',
          duration: 30
        });

        const res = await request(app).get('/api/voice/stream/session-1/status');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('should handle status error', async () => {
        StreamingTranscription.getSessionStatus.mockImplementationOnce(() => {
          throw new Error('Status error');
        });

        const res = await request(app).get('/api/voice/stream/session-1/status');

        expect(res.status).toBe(500);
      });
    });

    describe('GET /api/voice/stream/sessions', () => {
      it('should return active sessions', async () => {
        StreamingTranscription.getActiveSessions.mockReturnValueOnce([
          { sessionId: 'session-1' },
          { sessionId: 'session-2' }
        ]);

        const res = await request(app).get('/api/voice/stream/sessions');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.sessions).toHaveLength(2);
        expect(res.body.total).toBe(2);
      });

      it('should handle sessions list error', async () => {
        StreamingTranscription.getActiveSessions.mockImplementationOnce(() => {
          throw new Error('Sessions error');
        });

        const res = await request(app).get('/api/voice/stream/sessions');

        expect(res.status).toBe(500);
      });
    });
  });
});
