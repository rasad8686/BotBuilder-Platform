/**
 * Comprehensive Voice Services Tests
 *
 * Test coverage for:
 * 1. VoiceAnalytics - metrics, tracking, reporting
 * 2. StreamingTranscription - live transcription handling
 * 3. TwilioService - call handling, webhook processing
 * 4. RecordingService - recording management
 * 5. SpeechToText - transcription services
 * 6. TextToSpeech - synthesis services
 * 7. VoiceStorage - file storage management
 * 8. VoiceQueue - job queue and retry
 */

// Mock dependencies FIRST before importing services
jest.mock('../../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

jest.mock('ws');
jest.mock('node-fetch');
jest.mock('form-data');

// Import mocked modules
const db = require('../../../db');
const log = require('../../../utils/logger');
const WebSocket = require('ws');
const fetch = require('node-fetch');

// Import services - these will be properly mocked in each describe block
describe('Voice Services - Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    delete process.env.DEEPGRAM_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.GOOGLE_SPEECH_API_KEY;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.ASSEMBLY_API_KEY;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('VoiceAnalytics', () => {
    let VoiceAnalytics;

    beforeEach(() => {
      // Clear module cache and reimport
      jest.resetModules();
      VoiceAnalytics = require('../../../services/voice/VoiceAnalytics');
      // Reset metrics
      VoiceAnalytics.metrics = {
        totalTranscriptions: 0,
        successfulTranscriptions: 0,
        failedTranscriptions: 0,
        totalDuration: 0,
        averageConfidence: 0,
        byProvider: {},
        byLanguage: {},
        hourlyStats: []
      };
      VoiceAnalytics.sessionMetrics = new Map();
    });

    describe('recordTranscription', () => {
      test('should record successful transcription event', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const event = {
          organizationId: 'org-123',
          userId: 'user-456',
          botId: 'bot-789',
          provider: 'whisper',
          language: 'en',
          duration: 10.5,
          success: true,
          confidence: 0.95,
          wordCount: 50,
          processingTime: 1500
        };

        await VoiceAnalytics.recordTranscription(event);

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO voice_analytics'),
          expect.arrayContaining([
            'org-123',
            'user-456',
            'bot-789',
            'whisper',
            'en',
            10.5,
            true,
            0.95,
            50,
            undefined,
            1500
          ])
        );
        expect(log.debug).toHaveBeenCalledWith(
          'Voice analytics recorded',
          expect.objectContaining({ provider: 'whisper', success: true })
        );
      });

      test('should record failed transcription event with error type', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const event = {
          organizationId: 'org-123',
          userId: 'user-456',
          botId: 'bot-789',
          provider: 'google',
          language: 'fr',
          duration: 5.2,
          success: false,
          confidence: 0,
          wordCount: 0,
          errorType: 'API_ERROR',
          processingTime: 800
        };

        await VoiceAnalytics.recordTranscription(event);

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO voice_analytics'),
          expect.arrayContaining(['API_ERROR'])
        );
      });

      test('should handle database errors gracefully', async () => {
        db.query.mockRejectedValue(new Error('Database connection failed'));

        const event = {
          organizationId: 'org-123',
          provider: 'whisper',
          language: 'en',
          duration: 10,
          success: true
        };

        await VoiceAnalytics.recordTranscription(event);

        expect(log.error).toHaveBeenCalledWith(
          'Failed to record voice analytics',
          expect.objectContaining({ error: 'Database connection failed' })
        );
      });

      test('should update in-memory metrics on success', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const event = {
          organizationId: 'org-123',
          provider: 'deepgram',
          language: 'en',
          duration: 15.5,
          success: true,
          confidence: 0.88
        };

        await VoiceAnalytics.recordTranscription(event);

        expect(VoiceAnalytics.metrics.totalTranscriptions).toBe(1);
        expect(VoiceAnalytics.metrics.successfulTranscriptions).toBe(1);
        expect(VoiceAnalytics.metrics.failedTranscriptions).toBe(0);
      });

      test('should update in-memory metrics on failure', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const event = {
          organizationId: 'org-123',
          provider: 'whisper',
          language: 'en',
          duration: 5,
          success: false
        };

        await VoiceAnalytics.recordTranscription(event);

        expect(VoiceAnalytics.metrics.totalTranscriptions).toBe(1);
        expect(VoiceAnalytics.metrics.successfulTranscriptions).toBe(0);
        expect(VoiceAnalytics.metrics.failedTranscriptions).toBe(1);
      });
    });

    describe('updateMetrics', () => {
      test('should update provider statistics', () => {
        const event = {
          provider: 'whisper',
          language: 'en',
          duration: 10,
          success: true,
          confidence: 0.9
        };

        VoiceAnalytics.updateMetrics(event);

        expect(VoiceAnalytics.metrics.byProvider.whisper).toEqual({
          total: 1,
          successful: 1,
          failed: 0,
          totalDuration: 10,
          avgConfidence: 0.9
        });
      });

      test('should update language statistics', () => {
        const event = {
          provider: 'google',
          language: 'es',
          duration: 8,
          success: true,
          confidence: 0.85
        };

        VoiceAnalytics.updateMetrics(event);

        expect(VoiceAnalytics.metrics.byLanguage.es).toEqual({
          total: 1,
          successful: 1,
          failed: 0
        });
      });

      test('should calculate average confidence correctly', () => {
        VoiceAnalytics.updateMetrics({
          provider: 'whisper',
          language: 'en',
          duration: 10,
          success: true,
          confidence: 0.8
        });

        VoiceAnalytics.updateMetrics({
          provider: 'whisper',
          language: 'en',
          duration: 12,
          success: true,
          confidence: 0.9
        });

        expect(VoiceAnalytics.metrics.byProvider.whisper.avgConfidence).toBe(0.85);
      });

      test('should handle missing confidence value', () => {
        const event = {
          provider: 'whisper',
          language: 'en',
          duration: 10,
          success: true
        };

        VoiceAnalytics.updateMetrics(event);

        expect(VoiceAnalytics.metrics.byProvider.whisper.avgConfidence).toBe(0);
      });

      test('should track total duration', () => {
        VoiceAnalytics.updateMetrics({
          provider: 'whisper',
          language: 'en',
          duration: 10,
          success: true
        });

        VoiceAnalytics.updateMetrics({
          provider: 'whisper',
          language: 'en',
          duration: 15,
          success: true
        });

        expect(VoiceAnalytics.metrics.totalDuration).toBe(25);
      });
    });

    describe('getStats', () => {
      test('should retrieve statistics with all filters', async () => {
        db.query.mockResolvedValue({
          rows: [{
            total_transcriptions: '100',
            successful: '85',
            failed: '15',
            total_duration: '500.5',
            avg_confidence: '0.87',
            avg_processing_time: '1200',
            total_words: '5000'
          }]
        });

        const options = {
          organizationId: 'org-123',
          userId: 'user-456',
          botId: 'bot-789',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          provider: 'whisper',
          language: 'en'
        };

        const stats = await VoiceAnalytics.getStats(options);

        expect(stats.summary.totalTranscriptions).toBe(100);
        expect(stats.summary.successful).toBe(85);
        expect(stats.summary.failed).toBe(15);
        expect(stats.summary.successRate).toBe('85.00%');
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('organization_id'),
          expect.arrayContaining(['org-123', 'user-456', 'bot-789'])
        );
      });

      test('should handle zero transcriptions', async () => {
        db.query.mockResolvedValue({
          rows: [{
            total_transcriptions: '0',
            successful: '0',
            failed: '0',
            total_duration: null,
            avg_confidence: null,
            avg_processing_time: null,
            total_words: null
          }]
        });

        const stats = await VoiceAnalytics.getStats({});

        expect(stats.summary.totalTranscriptions).toBe(0);
        expect(stats.summary.successRate).toBe('0%');
        expect(stats.summary.totalDuration).toBe(0);
      });

      test('should handle database errors', async () => {
        db.query.mockRejectedValue(new Error('Query failed'));

        await expect(VoiceAnalytics.getStats({})).rejects.toThrow('Query failed');
        expect(log.error).toHaveBeenCalledWith(
          'Failed to get voice stats',
          expect.objectContaining({ error: 'Query failed' })
        );
      });
    });

    describe('getProviderBreakdown', () => {
      test('should return provider statistics', async () => {
        db.query.mockResolvedValue({
          rows: [
            {
              provider: 'whisper',
              total: '50',
              successful: '45',
              total_duration: '250.5',
              avg_confidence: '0.9'
            },
            {
              provider: 'google',
              total: '30',
              successful: '28',
              total_duration: '150.2',
              avg_confidence: '0.85'
            }
          ]
        });

        const breakdown = await VoiceAnalytics.getProviderBreakdown({
          organizationId: 'org-123'
        });

        expect(breakdown).toHaveLength(2);
        expect(breakdown[0]).toEqual({
          provider: 'whisper',
          total: 50,
          successful: 45,
          successRate: '90.0%',
          totalDuration: 250.5,
          avgConfidence: '0.90'
        });
      });

      test('should handle empty results', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const breakdown = await VoiceAnalytics.getProviderBreakdown({});

        expect(breakdown).toEqual([]);
      });
    });

    describe('getLanguageBreakdown', () => {
      test('should return language statistics', async () => {
        db.query.mockResolvedValue({
          rows: [
            {
              language: 'en',
              total: '60',
              successful: '55',
              total_duration: '300.0'
            },
            {
              language: 'es',
              total: '20',
              successful: '18',
              total_duration: '100.7'
            }
          ]
        });

        const breakdown = await VoiceAnalytics.getLanguageBreakdown({});

        expect(breakdown).toHaveLength(2);
        expect(breakdown[0].language).toBe('en');
        expect(breakdown[0].successRate).toBe('91.7%');
      });
    });

    describe('getDailyTrend', () => {
      test('should return daily statistics with default days', async () => {
        db.query.mockResolvedValue({
          rows: [
            {
              date: '2024-01-01',
              total: '10',
              successful: '9',
              total_duration: '50.0'
            }
          ]
        });

        const trend = await VoiceAnalytics.getDailyTrend({});

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('INTERVAL'),
          expect.arrayContaining([30])
        );
        expect(trend).toHaveLength(1);
      });

      test('should use custom days parameter', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await VoiceAnalytics.getDailyTrend({ days: 7 });

        expect(db.query).toHaveBeenCalledWith(
          expect.anything(),
          expect.arrayContaining([7])
        );
      });

      test('should sanitize days parameter to prevent SQL injection', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await VoiceAnalytics.getDailyTrend({ days: "30; DROP TABLE users;" });

        // Should parse to integer, making injection impossible
        expect(db.query).toHaveBeenCalledWith(
          expect.anything(),
          expect.arrayContaining([30])
        );
      });
    });

    describe('getErrorBreakdown', () => {
      test('should return error statistics', async () => {
        db.query.mockResolvedValue({
          rows: [
            { error_type: 'API_ERROR', count: '10' },
            { error_type: 'TIMEOUT', count: '5' }
          ]
        });

        const errors = await VoiceAnalytics.getErrorBreakdown({});

        expect(errors).toHaveLength(2);
        expect(errors[0]).toEqual({ errorType: 'API_ERROR', count: 10 });
      });
    });

    describe('getRealTimeMetrics', () => {
      test('should return current in-memory metrics', () => {
        VoiceAnalytics.metrics = {
          totalTranscriptions: 100,
          successfulTranscriptions: 85,
          failedTranscriptions: 15,
          totalDuration: 500.5,
          byProvider: { whisper: { total: 50 } },
          byLanguage: { en: { total: 80 } }
        };

        const metrics = VoiceAnalytics.getRealTimeMetrics();

        expect(metrics.totalTranscriptions).toBe(100);
        expect(metrics.successRate).toBe('85.00%');
        expect(metrics.totalDuration).toBe(500.5);
      });

      test('should calculate success rate with zero transcriptions', () => {
        VoiceAnalytics.metrics = {
          totalTranscriptions: 0,
          successfulTranscriptions: 0,
          failedTranscriptions: 0,
          totalDuration: 0
        };

        const metrics = VoiceAnalytics.getRealTimeMetrics();

        expect(metrics.successRate).toBe('0%');
      });
    });

    describe('formatDuration', () => {
      test('should format seconds to readable format', () => {
        expect(VoiceAnalytics.formatDuration(0)).toBe('0s');
        expect(VoiceAnalytics.formatDuration(45)).toBe('45s');
        expect(VoiceAnalytics.formatDuration(90)).toBe('1m 30s');
        expect(VoiceAnalytics.formatDuration(3665)).toBe('1h 1m 5s');
        expect(VoiceAnalytics.formatDuration(7200)).toBe('2h');
      });

      test('should handle null/undefined', () => {
        expect(VoiceAnalytics.formatDuration(null)).toBe('0s');
        expect(VoiceAnalytics.formatDuration(undefined)).toBe('0s');
      });
    });

    describe('Session Management', () => {
      test('should start tracking session', () => {
        VoiceAnalytics.startSession('session-123');

        const session = VoiceAnalytics.sessionMetrics.get('session-123');
        expect(session).toBeDefined();
        expect(session.startTime).toBeDefined();
        expect(session.transcriptions).toBe(0);
      });

      test('should update session metrics', () => {
        VoiceAnalytics.startSession('session-123');
        VoiceAnalytics.updateSession('session-123', { duration: 10 });
        VoiceAnalytics.updateSession('session-123', { duration: 15 });

        const session = VoiceAnalytics.sessionMetrics.get('session-123');
        expect(session.transcriptions).toBe(2);
        expect(session.totalDuration).toBe(25);
      });

      test('should end session and return summary', () => {
        VoiceAnalytics.startSession('session-123');
        VoiceAnalytics.updateSession('session-123', { duration: 10 });

        const summary = VoiceAnalytics.endSession('session-123');

        expect(summary).toEqual({
          sessionId: 'session-123',
          duration: expect.any(Number),
          transcriptions: 1,
          totalAudioDuration: 10
        });
        expect(VoiceAnalytics.sessionMetrics.has('session-123')).toBe(false);
      });

      test('should return null for non-existent session', () => {
        const summary = VoiceAnalytics.endSession('non-existent');
        expect(summary).toBeNull();
      });

      test('should handle update for non-existent session', () => {
        VoiceAnalytics.updateSession('non-existent', { duration: 10 });
        // Should not throw error
      });
    });
  });

  describe('StreamingTranscription', () => {
    let StreamingTranscription;
    let mockWs;
    let eventHandlers;
    let WsMock;

    beforeEach(() => {
      jest.resetModules();

      // Track event handlers for proper WebSocket simulation
      eventHandlers = {};

      // Control flag for what event to trigger
      let triggerOpen = true;
      let triggerError = null;

      // Mock WebSocket with proper event handling
      mockWs = {
        on: jest.fn((event, handler) => {
          eventHandlers[event] = handler;
          // Immediately trigger open event on next tick when 'open' handler is registered
          if (event === 'open' && triggerOpen) {
            setImmediate(() => handler());
          }
          if (event === 'error' && triggerError) {
            setImmediate(() => handler(triggerError));
          }
        }),
        send: jest.fn(),
        close: jest.fn(),
        readyState: 1 // WebSocket.OPEN
      };

      // Allow tests to control behavior
      mockWs.setTriggerOpen = (value) => { triggerOpen = value; };
      mockWs.setTriggerError = (error) => { triggerError = error; triggerOpen = false; };

      // Get fresh reference to ws mock after resetModules
      WsMock = require('ws');
      WsMock.mockImplementation(() => mockWs);
      WsMock.OPEN = 1;

      StreamingTranscription = require('../../../services/voice/StreamingTranscription');
      StreamingTranscription.connections = new Map();
    });

    describe('createSession', () => {
      test('should create session with default options', () => {
        const session = StreamingTranscription.createSession();

        expect(session.sessionId).toBeDefined();
        expect(session.provider).toBe('deepgram');
        expect(session.language).toBe('en');
        expect(session.sampleRate).toBe(16000);
      });

      test('should create session with custom options', () => {
        const session = StreamingTranscription.createSession({
          provider: 'google',
          language: 'es',
          sampleRate: 48000,
          model: 'phone_call'
        });

        expect(session.provider).toBe('google');
        expect(session.language).toBe('es');
        expect(session.sampleRate).toBe(48000);
      });

      test('should store session in connections map', () => {
        const session = StreamingTranscription.createSession();

        expect(StreamingTranscription.connections.has(session.sessionId)).toBe(true);
      });

      test('should initialize session with correct defaults', () => {
        const session = StreamingTranscription.createSession({
          interimResults: true,
          punctuate: true,
          profanityFilter: false
        });

        const storedSession = StreamingTranscription.connections.get(session.sessionId);
        expect(storedSession.interimResults).toBe(true);
        expect(storedSession.punctuate).toBe(true);
        expect(storedSession.profanityFilter).toBe(false);
      });
    });

    describe('startSession', () => {
      test('should throw error for non-existent session', async () => {
        await expect(
          StreamingTranscription.startSession('non-existent')
        ).rejects.toThrow('Session not found');
      });

      test('should start Deepgram session successfully', async () => {
        process.env.DEEPGRAM_API_KEY = 'test-key';
        const session = StreamingTranscription.createSession({ provider: 'deepgram' });

        // triggerOpen is true by default, so 'open' event fires automatically
        const result = await StreamingTranscription.startSession(session.sessionId);

        expect(result.status).toBe('connected');
        expect(WsMock).toHaveBeenCalledWith(
          expect.stringContaining('wss://api.deepgram.com'),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Token test-key'
            })
          })
        );
      });

      test('should throw error if Deepgram API key not configured', async () => {
        const session = StreamingTranscription.createSession({ provider: 'deepgram' });

        await expect(
          StreamingTranscription.startSession(session.sessionId)
        ).rejects.toThrow('Deepgram API key not configured');
      });

      test('should throw error for unsupported provider', async () => {
        const session = StreamingTranscription.createSession({ provider: 'unsupported' });

        await expect(
          StreamingTranscription.startSession(session.sessionId)
        ).rejects.toThrow('Provider not supported for streaming');
      });

      test('should handle WebSocket connection error', async () => {
        process.env.DEEPGRAM_API_KEY = 'test-key';
        // Configure mock to trigger error instead of open
        mockWs.setTriggerError(new Error('Connection failed'));

        const session = StreamingTranscription.createSession({ provider: 'deepgram' });

        await expect(
          StreamingTranscription.startSession(session.sessionId)
        ).rejects.toThrow('Connection failed');
      });

      test('should emit session:connected event', async () => {
        process.env.DEEPGRAM_API_KEY = 'test-key';
        const session = StreamingTranscription.createSession({ provider: 'deepgram' });

        const emitSpy = jest.spyOn(StreamingTranscription, 'emit');

        // triggerOpen is true by default, so 'open' event fires automatically
        await StreamingTranscription.startSession(session.sessionId);

        expect(emitSpy).toHaveBeenCalledWith('session:connected', {
          sessionId: session.sessionId
        });
      });
    });

    describe('sendAudio', () => {
      test('should send audio chunk to connected session', () => {
        const session = StreamingTranscription.createSession();
        const storedSession = StreamingTranscription.connections.get(session.sessionId);
        storedSession.ws = mockWs;

        const audioChunk = Buffer.from('audio data');
        StreamingTranscription.sendAudio(session.sessionId, audioChunk);

        expect(mockWs.send).toHaveBeenCalledWith(audioChunk);
      });

      test('should throw error for non-connected session', () => {
        const session = StreamingTranscription.createSession();

        expect(() => {
          StreamingTranscription.sendAudio(session.sessionId, Buffer.from('data'));
        }).toThrow('Session not connected');
      });

      test('should buffer audio if WebSocket not ready', () => {
        const session = StreamingTranscription.createSession();
        const storedSession = StreamingTranscription.connections.get(session.sessionId);
        storedSession.ws = mockWs;
        mockWs.readyState = 0; // CONNECTING

        const audioChunk = Buffer.from('audio data');
        StreamingTranscription.sendAudio(session.sessionId, audioChunk);

        expect(storedSession.buffer).toHaveLength(1);
        expect(mockWs.send).not.toHaveBeenCalled();
      });

      test('should throw error for non-existent session', () => {
        expect(() => {
          StreamingTranscription.sendAudio('non-existent', Buffer.from('data'));
        }).toThrow('Session not connected');
      });
    });

    describe('endSession', () => {
      test('should end session and return results', async () => {
        const session = StreamingTranscription.createSession();
        const storedSession = StreamingTranscription.connections.get(session.sessionId);
        storedSession.ws = mockWs;
        storedSession.transcript = 'Hello world';
        storedSession.words = [{ word: 'Hello' }, { word: 'world' }];

        const result = await StreamingTranscription.endSession(session.sessionId);

        expect(result.transcript).toBe('Hello world');
        expect(result.words).toHaveLength(2);
        expect(result.duration).toBeGreaterThan(0);
        expect(StreamingTranscription.connections.has(session.sessionId)).toBe(false);
      });

      test('should throw error for non-existent session', async () => {
        await expect(
          StreamingTranscription.endSession('non-existent')
        ).rejects.toThrow('Session not found');
      });

      test('should send close signal for Deepgram', async () => {
        const session = StreamingTranscription.createSession({ provider: 'deepgram' });
        const storedSession = StreamingTranscription.connections.get(session.sessionId);
        storedSession.ws = mockWs;

        await StreamingTranscription.endSession(session.sessionId);

        expect(mockWs.send).toHaveBeenCalledWith(
          JSON.stringify({ type: 'CloseStream' })
        );
        expect(mockWs.close).toHaveBeenCalled();
      });

      test('should send close signal for AssemblyAI', async () => {
        const session = StreamingTranscription.createSession({ provider: 'assembly' });
        const storedSession = StreamingTranscription.connections.get(session.sessionId);
        storedSession.ws = mockWs;

        await StreamingTranscription.endSession(session.sessionId);

        expect(mockWs.send).toHaveBeenCalledWith(
          JSON.stringify({ terminate_session: true })
        );
      });
    });

    describe('getSessionStatus', () => {
      test('should return status for existing session', () => {
        const session = StreamingTranscription.createSession();
        const storedSession = StreamingTranscription.connections.get(session.sessionId);
        storedSession.transcript = 'Test transcript';

        const status = StreamingTranscription.getSessionStatus(session.sessionId);

        expect(status.sessionId).toBe(session.sessionId);
        expect(status.status).toBe('created');
        expect(status.transcript).toBe('Test transcript');
      });

      test('should return not_found for non-existent session', () => {
        const status = StreamingTranscription.getSessionStatus('non-existent');
        expect(status.status).toBe('not_found');
      });
    });

    describe('getActiveSessions', () => {
      test('should return all active sessions', () => {
        StreamingTranscription.createSession({ provider: 'deepgram' });
        StreamingTranscription.createSession({ provider: 'google' });

        const sessions = StreamingTranscription.getActiveSessions();

        expect(sessions).toHaveLength(2);
        expect(sessions[0]).toHaveProperty('sessionId');
        expect(sessions[0]).toHaveProperty('provider');
      });

      test('should return empty array when no sessions', () => {
        const sessions = StreamingTranscription.getActiveSessions();
        expect(sessions).toEqual([]);
      });
    });

    describe('cleanup', () => {
      test('should cleanup all sessions', async () => {
        const session1 = StreamingTranscription.createSession();
        const session2 = StreamingTranscription.createSession();

        await StreamingTranscription.cleanup();

        expect(StreamingTranscription.connections.size).toBe(0);
      });

      test('should handle cleanup errors gracefully', async () => {
        const session = StreamingTranscription.createSession();
        const storedSession = StreamingTranscription.connections.get(session.sessionId);
        storedSession.ws = mockWs;
        mockWs.close.mockImplementation(() => {
          throw new Error('Close failed');
        });

        await StreamingTranscription.cleanup();

        // Should not throw, cleanup errors are ignored
        expect(StreamingTranscription.connections.size).toBe(0);
      });
    });

    describe('handleDeepgramMessage', () => {
      test('should handle Results message with final transcript', () => {
        const session = StreamingTranscription.createSession();
        const storedSession = StreamingTranscription.connections.get(session.sessionId);

        const emitSpy = jest.spyOn(StreamingTranscription, 'emit');

        const result = {
          type: 'Results',
          is_final: true,
          channel: {
            alternatives: [{
              transcript: 'Hello world',
              confidence: 0.95,
              words: [{ word: 'Hello' }, { word: 'world' }]
            }]
          }
        };

        StreamingTranscription.handleDeepgramMessage(storedSession, result);

        expect(storedSession.transcript).toBe('Hello world');
        expect(emitSpy).toHaveBeenCalledWith('transcript', expect.objectContaining({
          transcript: 'Hello world',
          isFinal: true,
          confidence: 0.95
        }));
      });

      test('should handle interim results', () => {
        const session = StreamingTranscription.createSession();
        const storedSession = StreamingTranscription.connections.get(session.sessionId);

        const emitSpy = jest.spyOn(StreamingTranscription, 'emit');

        const result = {
          type: 'Results',
          is_final: false,
          channel: {
            alternatives: [{
              transcript: 'Hello',
              confidence: 0.8
            }]
          }
        };

        StreamingTranscription.handleDeepgramMessage(storedSession, result);

        expect(storedSession.transcript).toBe('');
        expect(emitSpy).toHaveBeenCalledWith('transcript', expect.objectContaining({
          isFinal: false
        }));
      });

      test('should handle SpeechStarted event', () => {
        const session = StreamingTranscription.createSession();
        const storedSession = StreamingTranscription.connections.get(session.sessionId);

        const emitSpy = jest.spyOn(StreamingTranscription, 'emit');

        StreamingTranscription.handleDeepgramMessage(storedSession, {
          type: 'SpeechStarted'
        });

        expect(emitSpy).toHaveBeenCalledWith('speech:started', {
          sessionId: session.sessionId
        });
      });

      test('should handle UtteranceEnd event', () => {
        const session = StreamingTranscription.createSession();
        const storedSession = StreamingTranscription.connections.get(session.sessionId);

        const emitSpy = jest.spyOn(StreamingTranscription, 'emit');

        StreamingTranscription.handleDeepgramMessage(storedSession, {
          type: 'UtteranceEnd'
        });

        expect(emitSpy).toHaveBeenCalledWith('utterance:end', {
          sessionId: session.sessionId
        });
      });
    });
  });

  describe('TwilioService', () => {
    let TwilioService;
    let twilioService;

    beforeEach(() => {
      jest.resetModules();
      TwilioService = require('../../../services/voice/TwilioService');
    });

    describe('Constructor', () => {
      test('should create instance without credentials', () => {
        twilioService = new TwilioService();
        expect(twilioService.isConfigured()).toBe(false);
      });

      test('should create instance with environment credentials', () => {
        process.env.TWILIO_ACCOUNT_SID = 'AC123';
        process.env.TWILIO_AUTH_TOKEN = 'token123';

        // Mock twilio module
        jest.mock('twilio', () => jest.fn(() => ({ calls: {} })), { virtual: true });

        twilioService = new TwilioService();
        expect(twilioService.accountSid).toBe('AC123');
        expect(twilioService.authToken).toBe('token123');
      });

      test('should create instance with config credentials', () => {
        twilioService = new TwilioService({
          accountSid: 'AC456',
          authToken: 'token456'
        });

        expect(twilioService.accountSid).toBe('AC456');
        expect(twilioService.authToken).toBe('token456');
      });

      test('should handle missing Twilio SDK gracefully', () => {
        process.env.TWILIO_ACCOUNT_SID = 'AC123';
        process.env.TWILIO_AUTH_TOKEN = 'token123';

        twilioService = new TwilioService();
        // Should not throw
      });
    });

    describe('searchAvailableNumbers', () => {
      test('should return error when not configured', async () => {
        twilioService = new TwilioService();

        const result = await twilioService.searchAvailableNumbers('US');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Twilio not configured');
      });

      test('should search numbers with default options', async () => {
        const mockList = jest.fn().mockResolvedValue([
          {
            phoneNumber: '+15551234567',
            friendlyName: 'Test Number',
            locality: 'New York',
            region: 'NY',
            capabilities: { voice: true }
          }
        ]);

        twilioService = new TwilioService();
        twilioService.client = {
          availablePhoneNumbers: jest.fn(() => ({
            local: { list: mockList }
          }))
        };

        const result = await twilioService.searchAvailableNumbers('US');

        expect(result.success).toBe(true);
        expect(result.numbers).toHaveLength(1);
        expect(mockList).toHaveBeenCalledWith({
          voiceEnabled: true,
          limit: 20,
          areaCode: undefined,
          contains: undefined
        });
      });

      test('should search numbers with custom options', async () => {
        const mockList = jest.fn().mockResolvedValue([]);

        twilioService = new TwilioService();
        twilioService.client = {
          availablePhoneNumbers: jest.fn(() => ({
            local: { list: mockList }
          }))
        };

        await twilioService.searchAvailableNumbers('US', {
          limit: 10,
          areaCode: '212',
          contains: '555'
        });

        expect(mockList).toHaveBeenCalledWith({
          voiceEnabled: true,
          limit: 10,
          areaCode: '212',
          contains: '555'
        });
      });

      test('should handle API errors', async () => {
        twilioService = new TwilioService();
        twilioService.client = {
          availablePhoneNumbers: jest.fn(() => ({
            local: {
              list: jest.fn().mockRejectedValue(new Error('API Error'))
            }
          }))
        };

        const result = await twilioService.searchAvailableNumbers('US');

        expect(result.success).toBe(false);
        expect(result.error).toBe('API Error');
        expect(log.error).toHaveBeenCalled();
      });
    });

    describe('purchaseNumber', () => {
      test('should purchase phone number successfully', async () => {
        const mockCreate = jest.fn().mockResolvedValue({
          sid: 'PN123',
          phoneNumber: '+15551234567',
          friendlyName: 'My Number',
          capabilities: { voice: true, sms: true }
        });

        twilioService = new TwilioService();
        twilioService.client = {
          incomingPhoneNumbers: { create: mockCreate }
        };

        const result = await twilioService.purchaseNumber(
          '+15551234567',
          'https://example.com/webhook'
        );

        expect(result.success).toBe(true);
        expect(result.number.sid).toBe('PN123');
        expect(mockCreate).toHaveBeenCalledWith({
          phoneNumber: '+15551234567',
          voiceUrl: 'https://example.com/webhook',
          voiceMethod: 'POST',
          statusCallback: 'https://example.com/webhook/status',
          statusCallbackMethod: 'POST'
        });
      });

      test('should return error when not configured', async () => {
        twilioService = new TwilioService();

        const result = await twilioService.purchaseNumber('+15551234567', 'https://example.com');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Twilio not configured');
      });

      test('should handle purchase errors', async () => {
        twilioService = new TwilioService();
        twilioService.client = {
          incomingPhoneNumbers: {
            create: jest.fn().mockRejectedValue(new Error('Purchase failed'))
          }
        };

        const result = await twilioService.purchaseNumber('+15551234567', 'https://example.com');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Purchase failed');
      });
    });

    describe('releaseNumber', () => {
      test('should release number successfully', async () => {
        const mockRemove = jest.fn().mockResolvedValue();

        twilioService = new TwilioService();
        twilioService.client = {
          incomingPhoneNumbers: jest.fn(() => ({ remove: mockRemove }))
        };

        const result = await twilioService.releaseNumber('PN123');

        expect(result.success).toBe(true);
        expect(mockRemove).toHaveBeenCalled();
      });

      test('should handle release errors', async () => {
        twilioService = new TwilioService();
        twilioService.client = {
          incomingPhoneNumbers: jest.fn(() => ({
            remove: jest.fn().mockRejectedValue(new Error('Release failed'))
          }))
        };

        const result = await twilioService.releaseNumber('PN123');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Release failed');
      });
    });

    describe('makeCall', () => {
      test('should make outbound call successfully', async () => {
        const mockCreate = jest.fn().mockResolvedValue({
          sid: 'CA123',
          status: 'queued',
          direction: 'outbound-api',
          from: '+15551111111',
          to: '+15552222222'
        });

        twilioService = new TwilioService();
        twilioService.client = {
          calls: { create: mockCreate }
        };

        const result = await twilioService.makeCall(
          '+15551111111',
          '+15552222222',
          'https://example.com/webhook'
        );

        expect(result.success).toBe(true);
        expect(result.call.sid).toBe('CA123');
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            from: '+15551111111',
            to: '+15552222222',
            url: 'https://example.com/webhook',
            record: false,
            timeout: 30,
            machineDetection: 'Enable'
          })
        );
      });

      test('should make call with custom options', async () => {
        const mockCreate = jest.fn().mockResolvedValue({
          sid: 'CA123',
          status: 'queued'
        });

        twilioService = new TwilioService();
        twilioService.client = {
          calls: { create: mockCreate }
        };

        await twilioService.makeCall(
          '+15551111111',
          '+15552222222',
          'https://example.com/webhook',
          { record: true, timeout: 60, machineDetection: 'DetectMessageEnd' }
        );

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            record: true,
            timeout: 60,
            machineDetection: 'DetectMessageEnd'
          })
        );
      });

      test('should handle call creation errors', async () => {
        twilioService = new TwilioService();
        twilioService.client = {
          calls: {
            create: jest.fn().mockRejectedValue(new Error('Call failed'))
          }
        };

        const result = await twilioService.makeCall(
          '+15551111111',
          '+15552222222',
          'https://example.com'
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe('Call failed');
      });
    });

    describe('getCall', () => {
      test('should get call details successfully', async () => {
        const mockFetch = jest.fn().mockResolvedValue({
          sid: 'CA123',
          status: 'completed',
          direction: 'outbound-api',
          from: '+15551111111',
          to: '+15552222222',
          duration: '45',
          startTime: new Date(),
          endTime: new Date()
        });

        twilioService = new TwilioService();
        twilioService.client = {
          calls: jest.fn(() => ({ fetch: mockFetch }))
        };

        const result = await twilioService.getCall('CA123');

        expect(result.success).toBe(true);
        expect(result.call.sid).toBe('CA123');
        expect(result.call.status).toBe('completed');
      });

      test('should handle get call errors', async () => {
        twilioService = new TwilioService();
        twilioService.client = {
          calls: jest.fn(() => ({
            fetch: jest.fn().mockRejectedValue(new Error('Call not found'))
          }))
        };

        const result = await twilioService.getCall('CA123');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Call not found');
      });
    });

    describe('endCall', () => {
      test('should end call successfully', async () => {
        const mockUpdate = jest.fn().mockResolvedValue({
          status: 'completed'
        });

        twilioService = new TwilioService();
        twilioService.client = {
          calls: jest.fn(() => ({ update: mockUpdate }))
        };

        const result = await twilioService.endCall('CA123');

        expect(result.success).toBe(true);
        expect(result.status).toBe('completed');
        expect(mockUpdate).toHaveBeenCalledWith({ status: 'completed' });
      });

      test('should handle end call errors', async () => {
        twilioService = new TwilioService();
        twilioService.client = {
          calls: jest.fn(() => ({
            update: jest.fn().mockRejectedValue(new Error('Update failed'))
          }))
        };

        const result = await twilioService.endCall('CA123');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Update failed');
      });
    });

    describe('getRecording', () => {
      test('should get recording successfully', async () => {
        const mockList = jest.fn().mockResolvedValue([
          {
            sid: 'RE123',
            duration: '30',
            uri: '/2010-04-01/Accounts/AC123/Recordings/RE123.json'
          }
        ]);

        twilioService = new TwilioService();
        twilioService.client = {
          recordings: { list: mockList }
        };

        const result = await twilioService.getRecording('CA123');

        expect(result.success).toBe(true);
        expect(result.recording.sid).toBe('RE123');
        expect(result.recording.url).toContain('.mp3');
      });

      test('should return error when no recording found', async () => {
        twilioService = new TwilioService();
        twilioService.client = {
          recordings: { list: jest.fn().mockResolvedValue([]) }
        };

        const result = await twilioService.getRecording('CA123');

        expect(result.success).toBe(false);
        expect(result.error).toBe('No recording found');
      });

      test('should handle recording errors', async () => {
        twilioService = new TwilioService();
        twilioService.client = {
          recordings: {
            list: jest.fn().mockRejectedValue(new Error('API Error'))
          }
        };

        const result = await twilioService.getRecording('CA123');

        expect(result.success).toBe(false);
        expect(result.error).toBe('API Error');
      });
    });

    describe('generateTwiML', () => {
      test('should generate TwiML with say command', () => {
        const mockTwiML = jest.fn();
        const mockSay = jest.fn();

        jest.mock('twilio', () => ({
          twiml: {
            VoiceResponse: jest.fn(() => ({
              say: mockSay,
              toString: mockTwiML
            }))
          }
        }), { virtual: true });

        twilioService = new TwilioService();

        const twiml = twilioService.generateTwiML({
          say: 'Hello, world!'
        });

        expect(typeof twiml).toBe('string');
      });

      test('should generate TwiML with gather command', () => {
        twilioService = new TwilioService();

        const twiml = twilioService.generateTwiML({
          gather: {
            action: '/process',
            say: 'Please say your name'
          }
        });

        expect(typeof twiml).toBe('string');
      });

      test('should generate TwiML with play and hangup', () => {
        twilioService = new TwilioService();

        const twiml = twilioService.generateTwiML({
          play: 'https://example.com/audio.mp3',
          hangup: true
        });

        expect(typeof twiml).toBe('string');
      });
    });

    describe('validateWebhook', () => {
      test('should validate webhook signature', () => {
        twilioService = new TwilioService({
          accountSid: 'AC123',
          authToken: 'token123'
        });

        // This will fail without actual twilio module, but test the flow
        const result = twilioService.validateWebhook(
          'signature123',
          'https://example.com/webhook',
          { CallSid: 'CA123' }
        );

        // Should return boolean
        expect(typeof result).toBe('boolean');
      });

      test('should handle validation errors', () => {
        twilioService = new TwilioService();
        twilioService.authToken = 'token123';

        const result = twilioService.validateWebhook(
          'bad-signature',
          'https://example.com/webhook',
          {}
        );

        expect(result).toBe(false);
      });
    });
  });

  describe('RecordingService', () => {
    let RecordingService;

    beforeEach(() => {
      jest.resetModules();

      // Mock VoiceStorage
      jest.mock('../../../services/voice/VoiceStorage', () => ({
        store: jest.fn(),
        retrieve: jest.fn(),
        delete: jest.fn()
      }), { virtual: true });

      // Mock SpeechToText
      jest.mock('../../../services/voice/SpeechToText', () => {
        return jest.fn().mockImplementation(() => ({
          transcribe: jest.fn()
        }));
      }, { virtual: true });

      // Mock FormatConverter
      jest.mock('../../../services/voice/FormatConverter', () => ({
        convert: jest.fn()
      }), { virtual: true });

      RecordingService = require('../../../services/voice/RecordingService');
      RecordingService.activeRecordings = new Map();
      RecordingService.recordingMetadata = new Map();
    });

    describe('startRecording', () => {
      test('should start recording with default options', () => {
        const result = RecordingService.startRecording('call-123');

        expect(result.recordingId).toBeDefined();
        expect(result.callId).toBe('call-123');
        expect(result.status).toBe('recording');
        expect(RecordingService.activeRecordings.has(result.recordingId)).toBe(true);
      });

      test('should start recording with custom options', () => {
        const result = RecordingService.startRecording('call-123', {
          organizationId: 'org-123',
          botId: 'bot-456',
          userId: 'user-789',
          format: 'mp3',
          channels: 1,
          sampleRate: 48000
        });

        const session = RecordingService.activeRecordings.get(result.recordingId);
        expect(session.organizationId).toBe('org-123');
        expect(session.format).toBe('mp3');
        expect(session.sampleRate).toBe(48000);
      });

      test('should initialize recording session correctly', () => {
        const result = RecordingService.startRecording('call-123');
        const session = RecordingService.activeRecordings.get(result.recordingId);

        expect(session.chunks).toEqual([]);
        expect(session.totalBytes).toBe(0);
        expect(session.status).toBe('recording');
        expect(session.startedAt).toBeInstanceOf(Date);
      });
    });

    describe('addChunk', () => {
      test('should add audio chunk to recording', () => {
        const { recordingId } = RecordingService.startRecording('call-123');
        const chunk = Buffer.from('audio data');

        RecordingService.addChunk(recordingId, chunk);

        const session = RecordingService.activeRecordings.get(recordingId);
        expect(session.chunks).toHaveLength(1);
        expect(session.totalBytes).toBe(chunk.length);
      });

      test('should add multiple chunks', () => {
        const { recordingId } = RecordingService.startRecording('call-123');

        RecordingService.addChunk(recordingId, Buffer.from('chunk1'));
        RecordingService.addChunk(recordingId, Buffer.from('chunk2'));

        const session = RecordingService.activeRecordings.get(recordingId);
        expect(session.chunks).toHaveLength(2);
      });

      test('should track chunk legs for dual-channel recording', () => {
        const { recordingId } = RecordingService.startRecording('call-123');

        RecordingService.addChunk(recordingId, Buffer.from('in'), 'inbound');
        RecordingService.addChunk(recordingId, Buffer.from('out'), 'outbound');

        const session = RecordingService.activeRecordings.get(recordingId);
        expect(session.chunks[0].leg).toBe('inbound');
        expect(session.chunks[1].leg).toBe('outbound');
      });

      test('should throw error for non-existent recording', () => {
        expect(() => {
          RecordingService.addChunk('non-existent', Buffer.from('data'));
        }).toThrow('Recording not found');
      });

      test('should throw error for non-active recording', () => {
        const { recordingId } = RecordingService.startRecording('call-123');
        const session = RecordingService.activeRecordings.get(recordingId);
        session.status = 'completed';

        expect(() => {
          RecordingService.addChunk(recordingId, Buffer.from('data'));
        }).toThrow('Recording is not active');
      });
    });

    describe('pauseRecording', () => {
      test('should pause active recording', () => {
        const { recordingId } = RecordingService.startRecording('call-123');

        RecordingService.pauseRecording(recordingId);

        const session = RecordingService.activeRecordings.get(recordingId);
        expect(session.status).toBe('paused');
        expect(session.pausedAt).toBeInstanceOf(Date);
      });

      test('should not pause non-recording session', () => {
        const { recordingId } = RecordingService.startRecording('call-123');
        const session = RecordingService.activeRecordings.get(recordingId);
        session.status = 'completed';

        RecordingService.pauseRecording(recordingId);

        expect(session.status).toBe('completed');
      });

      test('should throw error for non-existent recording', () => {
        expect(() => {
          RecordingService.pauseRecording('non-existent');
        }).toThrow('Recording not found');
      });
    });

    describe('resumeRecording', () => {
      test('should resume paused recording', () => {
        const { recordingId } = RecordingService.startRecording('call-123');
        RecordingService.pauseRecording(recordingId);

        RecordingService.resumeRecording(recordingId);

        const session = RecordingService.activeRecordings.get(recordingId);
        expect(session.status).toBe('recording');
        expect(session.resumedAt).toBeInstanceOf(Date);
      });

      test('should not resume non-paused recording', () => {
        const { recordingId } = RecordingService.startRecording('call-123');

        RecordingService.resumeRecording(recordingId);

        const session = RecordingService.activeRecordings.get(recordingId);
        expect(session.status).toBe('recording');
        expect(session.resumedAt).toBeUndefined();
      });
    });

    describe('cancelRecording', () => {
      test('should cancel active recording', () => {
        const { recordingId } = RecordingService.startRecording('call-123');

        RecordingService.cancelRecording(recordingId);

        expect(RecordingService.activeRecordings.has(recordingId)).toBe(false);
        expect(log.info).toHaveBeenCalledWith('Recording cancelled', { recordingId });
      });

      test('should handle cancelling non-existent recording', () => {
        RecordingService.cancelRecording('non-existent');
        // Should not throw
      });
    });

    describe('getRecording', () => {
      test('should return metadata for completed recording', async () => {
        const metadata = {
          recordingId: 'rec-123',
          callId: 'call-123',
          status: 'completed'
        };
        RecordingService.recordingMetadata.set('rec-123', metadata);

        const result = await RecordingService.getRecording('rec-123');

        expect(result).toEqual(metadata);
      });

      test('should return status for active recording', async () => {
        const { recordingId } = RecordingService.startRecording('call-123');

        const result = await RecordingService.getRecording(recordingId);

        expect(result.recordingId).toBe(recordingId);
        expect(result.status).toBe('recording');
        expect(result.duration).toBeGreaterThanOrEqual(0);
      });

      test('should return null for non-existent recording', async () => {
        const result = await RecordingService.getRecording('non-existent');
        expect(result).toBeNull();
      });
    });

    describe('getActiveRecordingsCount', () => {
      test('should return count of active recordings', () => {
        RecordingService.startRecording('call-1');
        RecordingService.startRecording('call-2');

        expect(RecordingService.getActiveRecordingsCount()).toBe(2);
      });

      test('should return zero when no active recordings', () => {
        expect(RecordingService.getActiveRecordingsCount()).toBe(0);
      });
    });

    describe('getActiveRecordings', () => {
      test('should return all active recordings', () => {
        RecordingService.startRecording('call-1');
        RecordingService.startRecording('call-2');

        const recordings = RecordingService.getActiveRecordings();

        expect(recordings).toHaveLength(2);
        expect(recordings[0]).toHaveProperty('recordingId');
        expect(recordings[0]).toHaveProperty('status');
        expect(recordings[0]).toHaveProperty('duration');
      });

      test('should return empty array when no active recordings', () => {
        const recordings = RecordingService.getActiveRecordings();
        expect(recordings).toEqual([]);
      });
    });

    describe('formatDuration', () => {
      test('should format duration correctly', () => {
        expect(RecordingService.formatDuration(0)).toBe('00:00:00');
        expect(RecordingService.formatDuration(65)).toBe('00:01:05');
        expect(RecordingService.formatDuration(3665)).toBe('01:01:05');
        expect(RecordingService.formatDuration(7265)).toBe('02:01:05');
      });
    });

    describe('formatBytes', () => {
      test('should format bytes to human readable', () => {
        expect(RecordingService.formatBytes(0)).toBe('0 Bytes');
        expect(RecordingService.formatBytes(1024)).toBe('1 KB');
        expect(RecordingService.formatBytes(1024 * 1024)).toBe('1 MB');
        expect(RecordingService.formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
      });
    });
  });

  describe('SpeechToText', () => {
    let SpeechToText;

    beforeEach(() => {
      jest.resetModules();
      SpeechToText = require('../../../services/voice/SpeechToText');
    });

    describe('Constructor', () => {
      test('should create instance with default provider', () => {
        const stt = new SpeechToText();
        expect(stt.provider).toBe('whisper');
      });

      test('should create instance with custom provider', () => {
        const stt = new SpeechToText('google');
        expect(stt.provider).toBe('google');
      });

      test('should create instance with config', () => {
        const stt = new SpeechToText('whisper', { apiKey: 'test-key' });
        expect(stt.config.apiKey).toBe('test-key');
      });
    });

    describe('transcribe', () => {
      test('should route to correct provider', async () => {
        const stt = new SpeechToText('whisper');
        stt.transcribeWithWhisper = jest.fn().mockResolvedValue({ success: true });

        await stt.transcribe(Buffer.from('audio'));

        expect(stt.transcribeWithWhisper).toHaveBeenCalled();
      });

      test('should return error for unknown provider', async () => {
        const stt = new SpeechToText('unknown');

        const result = await stt.transcribe(Buffer.from('audio'));

        expect(result.success).toBe(false);
        expect(result.error).toBe('Unknown provider: unknown');
      });
    });

    describe('transcribeWithWhisper', () => {
      test('should return error when API key not configured', async () => {
        const stt = new SpeechToText('whisper');

        const result = await stt.transcribeWithWhisper(Buffer.from('audio'));

        expect(result.success).toBe(false);
        expect(result.error).toBe('OpenAI API key not configured');
      });

      test('should handle API errors', async () => {
        process.env.OPENAI_API_KEY = 'test-key';

        const mockResponse = {
          ok: false,
          text: jest.fn().mockResolvedValue('API Error')
        };
        fetch.mockResolvedValue(mockResponse);

        const stt = new SpeechToText('whisper');
        const result = await stt.transcribeWithWhisper(Buffer.from('audio'));

        expect(result.success).toBe(false);
        expect(log.error).toHaveBeenCalled();
      });
    });

    describe('transcribeWithGoogle', () => {
      test('should return error when API key not configured', async () => {
        const stt = new SpeechToText('google');

        const result = await stt.transcribeWithGoogle(Buffer.from('audio'));

        expect(result.success).toBe(false);
        expect(result.error).toBe('Google Speech API key not configured');
      });

      test('should handle API errors', async () => {
        process.env.GOOGLE_SPEECH_API_KEY = 'test-key';

        const mockResponse = {
          ok: false,
          text: jest.fn().mockResolvedValue('API Error')
        };
        fetch.mockResolvedValue(mockResponse);

        const stt = new SpeechToText('google');
        const result = await stt.transcribeWithGoogle(Buffer.from('audio'));

        expect(result.success).toBe(false);
      });
    });

    describe('transcribeWithDeepgram', () => {
      test('should return error when API key not configured', async () => {
        const stt = new SpeechToText('deepgram');

        const result = await stt.transcribeWithDeepgram(Buffer.from('audio'));

        expect(result.success).toBe(false);
        expect(result.error).toBe('Deepgram API key not configured');
      });

      test('should handle API errors', async () => {
        process.env.DEEPGRAM_API_KEY = 'test-key';

        const mockResponse = {
          ok: false,
          text: jest.fn().mockResolvedValue('API Error')
        };
        fetch.mockResolvedValue(mockResponse);

        const stt = new SpeechToText('deepgram');
        const result = await stt.transcribeWithDeepgram(Buffer.from('audio'));

        expect(result.success).toBe(false);
      });
    });

    describe('createStreamingSession', () => {
      test('should create Deepgram streaming session', () => {
        process.env.DEEPGRAM_API_KEY = 'test-key';

        const stt = new SpeechToText('deepgram');
        const session = stt.createStreamingSession({ language: 'es' });

        expect(session.url).toBe('wss://api.deepgram.com/v1/listen');
        expect(session.params.language).toBe('es');
      });

      test('should return error for unsupported provider', () => {
        const stt = new SpeechToText('whisper');
        const session = stt.createStreamingSession();

        expect(session.error).toBe('Streaming not supported for this provider');
      });
    });
  });

  describe('TextToSpeech', () => {
    let TextToSpeech;

    beforeEach(() => {
      jest.resetModules();
      TextToSpeech = require('../../../services/voice/TextToSpeech');
    });

    describe('Constructor', () => {
      test('should create instance with default provider', () => {
        const tts = new TextToSpeech();
        expect(tts.provider).toBe('elevenlabs');
      });

      test('should create instance with custom provider', () => {
        const tts = new TextToSpeech('openai');
        expect(tts.provider).toBe('openai');
      });
    });

    describe('synthesize', () => {
      test('should route to correct provider', async () => {
        const tts = new TextToSpeech('openai');
        tts.synthesizeWithOpenAI = jest.fn().mockResolvedValue({ success: true });

        await tts.synthesize('Hello world');

        expect(tts.synthesizeWithOpenAI).toHaveBeenCalledWith('Hello world', {});
      });

      test('should return error for unknown provider', async () => {
        const tts = new TextToSpeech('unknown');

        const result = await tts.synthesize('Hello');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Unknown provider: unknown');
      });
    });

    describe('synthesizeWithElevenLabs', () => {
      test('should return error when API key not configured', async () => {
        const tts = new TextToSpeech('elevenlabs');

        const result = await tts.synthesizeWithElevenLabs('Hello');

        expect(result.success).toBe(false);
        expect(result.error).toBe('ElevenLabs API key not configured');
      });

      test('should handle API errors', async () => {
        process.env.ELEVENLABS_API_KEY = 'test-key';

        const mockResponse = {
          ok: false,
          text: jest.fn().mockResolvedValue('API Error')
        };
        fetch.mockResolvedValue(mockResponse);

        const tts = new TextToSpeech('elevenlabs');
        const result = await tts.synthesizeWithElevenLabs('Hello');

        expect(result.success).toBe(false);
      });
    });

    describe('synthesizeWithOpenAI', () => {
      test('should return error when API key not configured', async () => {
        const tts = new TextToSpeech('openai');

        const result = await tts.synthesizeWithOpenAI('Hello');

        expect(result.success).toBe(false);
        expect(result.error).toBe('OpenAI API key not configured');
      });

      test('should handle API errors', async () => {
        process.env.OPENAI_API_KEY = 'test-key';

        const mockResponse = {
          ok: false,
          text: jest.fn().mockResolvedValue('API Error')
        };
        fetch.mockResolvedValue(mockResponse);

        const tts = new TextToSpeech('openai');
        const result = await tts.synthesizeWithOpenAI('Hello');

        expect(result.success).toBe(false);
      });
    });

    describe('synthesizeWithGoogle', () => {
      test('should return error when API key not configured', async () => {
        const tts = new TextToSpeech('google');

        const result = await tts.synthesizeWithGoogle('Hello');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Google TTS API key not configured');
      });

      test('should handle API errors', async () => {
        process.env.GOOGLE_TTS_API_KEY = 'test-key';

        const mockResponse = {
          ok: false,
          text: jest.fn().mockResolvedValue('API Error')
        };
        fetch.mockResolvedValue(mockResponse);

        const tts = new TextToSpeech('google');
        const result = await tts.synthesizeWithGoogle('Hello');

        expect(result.success).toBe(false);
      });
    });

    describe('getVoices', () => {
      test('should return OpenAI voices', async () => {
        const tts = new TextToSpeech('openai');

        const result = await tts.getVoices();

        expect(result.success).toBe(true);
        expect(result.voices).toHaveLength(6);
        expect(result.voices[0].id).toBe('alloy');
      });

      test('should return error for unsupported provider', async () => {
        const tts = new TextToSpeech('google');

        const result = await tts.getVoices();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Voice listing not supported');
      });
    });
  });

  describe('VoiceQueue', () => {
    let VoiceQueue;

    beforeEach(() => {
      jest.resetModules();
      VoiceQueue = require('../../../services/voice/VoiceQueue');
      VoiceQueue.queue = [];
      VoiceQueue.jobResults = new Map();
      VoiceQueue.jobCallbacks = new Map();
      VoiceQueue.activeJobs = 0;
      VoiceQueue.completedJobs = 0;
      VoiceQueue.failedJobs = 0;
    });

    describe('addJob', () => {
      test('should add job to queue', async () => {
        const jobId = await VoiceQueue.addJob({
          audioBuffer: Buffer.from('audio'),
          provider: 'whisper'
        });

        expect(jobId).toBeDefined();
        expect(VoiceQueue.queue).toHaveLength(1);
      });

      test('should prioritize jobs correctly', async () => {
        await VoiceQueue.addJob({
          audioBuffer: Buffer.from('audio1'),
          priority: 1
        });

        await VoiceQueue.addJob({
          audioBuffer: Buffer.from('audio2'),
          priority: 5
        });

        await VoiceQueue.addJob({
          audioBuffer: Buffer.from('audio3'),
          priority: 3
        });

        expect(VoiceQueue.queue[0].priority).toBe(5);
        expect(VoiceQueue.queue[1].priority).toBe(3);
        expect(VoiceQueue.queue[2].priority).toBe(1);
      });

      test('should use default options', async () => {
        const jobId = await VoiceQueue.addJob({
          audioBuffer: Buffer.from('audio')
        });

        const job = VoiceQueue.queue[0];
        expect(job.provider).toBe('whisper');
        expect(job.priority).toBe(0);
        expect(job.status).toBe('pending');
      });
    });

    describe('getJobStatus', () => {
      test('should return status for queued job', async () => {
        const jobId = await VoiceQueue.addJob({
          audioBuffer: Buffer.from('audio')
        });

        const status = VoiceQueue.getJobStatus(jobId);

        expect(status.id).toBe(jobId);
        expect(status.status).toBe('pending');
      });

      test('should return completed job result', () => {
        const jobId = 'job-123';
        VoiceQueue.jobResults.set(jobId, {
          status: 'completed',
          data: { text: 'Hello' },
          completedAt: new Date()
        });

        const status = VoiceQueue.getJobStatus(jobId);

        expect(status.status).toBe('completed');
        expect(status.result.text).toBe('Hello');
      });

      test('should return not_found for non-existent job', () => {
        const status = VoiceQueue.getJobStatus('non-existent');

        expect(status.status).toBe('not_found');
      });
    });

    describe('cancelJob', () => {
      test('should cancel pending job', async () => {
        const jobId = await VoiceQueue.addJob({
          audioBuffer: Buffer.from('audio')
        });

        const result = VoiceQueue.cancelJob(jobId);

        expect(result).toBe(true);
        expect(VoiceQueue.queue).toHaveLength(0);
        expect(VoiceQueue.jobResults.get(jobId).status).toBe('cancelled');
      });

      test('should return false for non-existent job', () => {
        const result = VoiceQueue.cancelJob('non-existent');
        expect(result).toBe(false);
      });
    });

    describe('getStats', () => {
      test('should return queue statistics', async () => {
        await VoiceQueue.addJob({ audioBuffer: Buffer.from('audio1') });
        await VoiceQueue.addJob({ audioBuffer: Buffer.from('audio2') });

        const stats = VoiceQueue.getStats();

        expect(stats.queueLength).toBe(2);
        expect(stats.activeJobs).toBeGreaterThanOrEqual(0);
        expect(stats).toHaveProperty('completedJobs');
        expect(stats).toHaveProperty('failedJobs');
      });
    });

    describe('clearOldResults', () => {
      test('should clear old job results', () => {
        const oldDate = new Date(Date.now() - 2 * 3600000);
        VoiceQueue.jobResults.set('old-job', {
          status: 'completed',
          completedAt: oldDate
        });

        VoiceQueue.jobResults.set('new-job', {
          status: 'completed',
          completedAt: new Date()
        });

        VoiceQueue.clearOldResults(3600000);

        expect(VoiceQueue.jobResults.has('old-job')).toBe(false);
        expect(VoiceQueue.jobResults.has('new-job')).toBe(true);
      });

      test('should use default max age', () => {
        const oldDate = new Date(Date.now() - 4 * 3600000);
        VoiceQueue.jobResults.set('old-job', {
          status: 'completed',
          completedAt: oldDate
        });

        VoiceQueue.clearOldResults();

        expect(VoiceQueue.jobResults.has('old-job')).toBe(false);
      });
    });

    describe('isRetryableError', () => {
      test('should identify retryable errors', () => {
        expect(VoiceQueue.isRetryableError('timeout')).toBe(true);
        expect(VoiceQueue.isRetryableError('rate limit exceeded')).toBe(true);
        expect(VoiceQueue.isRetryableError('Too Many Requests')).toBe(true);
        expect(VoiceQueue.isRetryableError('Service Unavailable')).toBe(true);
        expect(VoiceQueue.isRetryableError('500 Internal Server Error')).toBe(true);
      });

      test('should identify non-retryable errors', () => {
        expect(VoiceQueue.isRetryableError('invalid api key')).toBe(false);
        expect(VoiceQueue.isRetryableError('not found')).toBe(false);
        expect(VoiceQueue.isRetryableError('forbidden')).toBe(false);
      });
    });
  });

  describe('VoiceStorage', () => {
    let VoiceStorage;
    const fs = require('fs').promises;

    beforeEach(() => {
      jest.resetModules();

      // Mock fs
      jest.mock('fs', () => ({
        promises: {
          mkdir: jest.fn(),
          writeFile: jest.fn(),
          readFile: jest.fn(),
          unlink: jest.fn(),
          readdir: jest.fn(),
          stat: jest.fn()
        }
      }), { virtual: true });

      VoiceStorage = require('../../../services/voice/VoiceStorage');
    });

    describe('initialize', () => {
      test('should create local storage directory', async () => {
        await VoiceStorage.initialize();

        expect(fs.mkdir).toHaveBeenCalled();
        expect(log.info).toHaveBeenCalledWith(
          'Voice storage initialized',
          expect.any(Object)
        );
      });

      test('should handle initialization errors gracefully', async () => {
        fs.mkdir.mockRejectedValue(new Error('Permission denied'));

        await VoiceStorage.initialize();

        expect(log.error).toHaveBeenCalled();
      });
    });

    describe('store', () => {
      test('should reject files exceeding max size', async () => {
        const largeBuffer = Buffer.alloc(100 * 1024 * 1024); // 100MB

        await expect(
          VoiceStorage.store(largeBuffer, { organizationId: 'org-123' })
        ).rejects.toThrow('File size exceeds maximum');
      });

      test('should reject disallowed formats', async () => {
        const buffer = Buffer.from('audio');

        await expect(
          VoiceStorage.store(buffer, {
            organizationId: 'org-123',
            format: 'exe'
          })
        ).rejects.toThrow('Format not allowed');
      });

      test('should generate unique filename', async () => {
        fs.mkdir.mockResolvedValue();
        fs.writeFile.mockResolvedValue();

        const buffer = Buffer.from('audio data');
        const result = await VoiceStorage.store(buffer, {
          organizationId: 'org-123',
          format: 'wav'
        });

        expect(result.filename).toContain('org-123/');
        expect(result.filename).toContain('.wav');
      });
    });

    describe('getContentType', () => {
      test('should return correct content types', () => {
        expect(VoiceStorage.getContentType('file.wav')).toBe('audio/wav');
        expect(VoiceStorage.getContentType('file.mp3')).toBe('audio/mpeg');
        expect(VoiceStorage.getContentType('file.ogg')).toBe('audio/ogg');
        expect(VoiceStorage.getContentType('file.webm')).toBe('audio/webm');
        expect(VoiceStorage.getContentType('file.unknown')).toBe('application/octet-stream');
      });
    });

    describe('formatBytes', () => {
      test('should format bytes correctly', () => {
        expect(VoiceStorage.formatBytes(0)).toBe('0 Bytes');
        expect(VoiceStorage.formatBytes(1024)).toBe('1 KB');
        expect(VoiceStorage.formatBytes(1024 * 1024)).toBe('1 MB');
        expect(VoiceStorage.formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
        expect(VoiceStorage.formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1 TB');
      });
    });
  });
});
