/**
 * Call Center API Tests
 * Tests for /api/call-center endpoints
 */

const request = require('supertest');

// Mock dependencies
jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Mock voice services
jest.mock('../../services/voice', () => ({
  TwilioService: {
    makeCall: jest.fn(),
    endCall: jest.fn()
  },
  RecordingService: {
    getRecording: jest.fn(),
    listRecordings: jest.fn(),
    getRecordingStats: jest.fn(),
    transcribeRecording: jest.fn(),
    exportRecording: jest.fn(),
    deleteRecording: jest.fn(),
    startRecording: jest.fn()
  },
  TranscriptionService: {
    getAvailableProviders: jest.fn().mockReturnValue(['whisper', 'google']),
    getSupportedLanguages: jest.fn().mockReturnValue(['en', 'es', 'fr'])
  },
  SentimentAnalysis: {
    analyzeSentiment: jest.fn(),
    analyzeCallSentiment: jest.fn()
  },
  WebRTCService: {
    createSession: jest.fn(),
    getSession: jest.fn(),
    getActiveSessions: jest.fn().mockReturnValue([]),
    handleOffer: jest.fn(),
    addIceCandidate: jest.fn(),
    endSession: jest.fn(),
    setHold: jest.fn(),
    setMute: jest.fn(),
    transferCall: jest.fn(),
    getStatsSummary: jest.fn().mockReturnValue({
      totalSessions: 0,
      connected: 0,
      avgJitter: 0,
      avgPacketsLost: 0
    }),
    generateTwilioToken: jest.fn()
  },
  VoiceAnalytics: {
    getCallMetrics: jest.fn(),
    getDetailedStats: jest.fn()
  }
}));

const express = require('express');
const {
  RecordingService,
  TranscriptionService,
  SentimentAnalysis,
  WebRTCService,
  VoiceAnalytics
} = require('../../services/voice');

const app = express();
app.use(express.json());

// Mock authentication middleware
const mockAuth = (req, res, next) => {
  req.user = {
    id: 1,
    email: 'test@example.com',
    organizationId: 'org-123'
  };
  next();
};

const mockAuthorizeRole = (roles) => (req, res, next) => {
  next();
};

// Mock routes
app.use('/api/call-center', mockAuth, require('../../routes/callCenter'));

describe('Call Center API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/call-center/dashboard', () => {
    it('should return dashboard metrics', async () => {
      VoiceAnalytics.getCallMetrics.mockResolvedValue({
        totalCalls: 100,
        inboundCalls: 60,
        outboundCalls: 40,
        missedCalls: 5,
        avgWaitTime: 30,
        avgCallDuration: 180,
        successRate: 95
      });

      RecordingService.getRecordingStats.mockResolvedValue({
        totalRecordings: 50,
        totalDuration: 9000
      });

      const response = await request(app)
        .get('/api/call-center/dashboard')
        .query({ timeRange: '24h' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.metrics.totalCalls).toBe(100);
      expect(response.body.data.metrics.activeCalls).toBe(0);
    });

    it('should handle different time ranges', async () => {
      VoiceAnalytics.getCallMetrics.mockResolvedValue({ totalCalls: 0 });
      RecordingService.getRecordingStats.mockResolvedValue({ totalRecordings: 0 });

      const timeRanges = ['1h', '24h', '7d', '30d'];

      for (const range of timeRanges) {
        const response = await request(app)
          .get('/api/call-center/dashboard')
          .query({ timeRange: range });

        expect(response.status).toBe(200);
        expect(response.body.data.timeRange).toBe(range);
      }
    });
  });

  describe('GET /api/call-center/active-calls', () => {
    it('should return active calls list', async () => {
      WebRTCService.getActiveSessions.mockReturnValue([
        {
          sessionId: 'session-1',
          callType: 'inbound',
          status: 'connected',
          duration: 120
        }
      ]);

      const response = await request(app)
        .get('/api/call-center/active-calls');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.calls).toHaveLength(1);
      expect(response.body.data.total).toBe(1);
    });

    it('should filter by botId', async () => {
      WebRTCService.getActiveSessions.mockReturnValue([]);

      const response = await request(app)
        .get('/api/call-center/active-calls')
        .query({ botId: 'bot-123' });

      expect(response.status).toBe(200);
      expect(WebRTCService.getActiveSessions).toHaveBeenCalledWith(
        expect.objectContaining({ botId: 'bot-123' })
      );
    });
  });

  describe('GET /api/call-center/queue', () => {
    it('should return queue status', async () => {
      WebRTCService.getActiveSessions.mockReturnValue([]);

      const response = await request(app)
        .get('/api/call-center/queue');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.queue.waitingCalls).toBe(0);
    });

    it('should calculate wait times for queued calls', async () => {
      const fiveMinutesAgo = new Date(Date.now() - 300000);
      WebRTCService.getActiveSessions.mockReturnValue([
        { createdAt: fiveMinutesAgo, status: 'waiting' }
      ]);

      const response = await request(app)
        .get('/api/call-center/queue');

      expect(response.status).toBe(200);
      expect(response.body.data.queue.waitingCalls).toBe(1);
      expect(response.body.data.queue.avgWaitTime).toBeGreaterThan(0);
    });
  });

  describe('POST /api/call-center/calls/:callId/transfer', () => {
    it('should transfer call successfully', async () => {
      WebRTCService.transferCall.mockResolvedValue({
        success: true,
        sessionId: 'session-1',
        destination: '+1234567890'
      });

      const response = await request(app)
        .post('/api/call-center/calls/session-1/transfer')
        .send({ destination: '+1234567890', type: 'blind' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(WebRTCService.transferCall).toHaveBeenCalledWith(
        'session-1',
        '+1234567890',
        'blind'
      );
    });

    it('should require destination', async () => {
      const response = await request(app)
        .post('/api/call-center/calls/session-1/transfer')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Destination is required');
    });
  });

  describe('POST /api/call-center/calls/:callId/hold', () => {
    it('should put call on hold', async () => {
      const response = await request(app)
        .post('/api/call-center/calls/session-1/hold')
        .send({ held: true });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.held).toBe(true);
      expect(WebRTCService.setHold).toHaveBeenCalledWith('session-1', true);
    });

    it('should take call off hold', async () => {
      const response = await request(app)
        .post('/api/call-center/calls/session-1/hold')
        .send({ held: false });

      expect(response.status).toBe(200);
      expect(response.body.data.held).toBe(false);
    });
  });

  describe('POST /api/call-center/calls/:callId/mute', () => {
    it('should mute call', async () => {
      const response = await request(app)
        .post('/api/call-center/calls/session-1/mute')
        .send({ muted: true });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(WebRTCService.setMute).toHaveBeenCalledWith('session-1', true);
    });
  });

  describe('POST /api/call-center/calls/:callId/end', () => {
    it('should end call successfully', async () => {
      WebRTCService.endSession.mockReturnValue({
        duration: 180
      });

      const response = await request(app)
        .post('/api/call-center/calls/session-1/end')
        .send({ reason: 'completed' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.duration).toBe(180);
      expect(WebRTCService.endSession).toHaveBeenCalledWith('session-1', 'completed');
    });
  });

  describe('GET /api/call-center/recordings', () => {
    it('should list recordings', async () => {
      RecordingService.listRecordings.mockResolvedValue({
        recordings: [
          { recordingId: 'rec-1', duration: 120 },
          { recordingId: 'rec-2', duration: 180 }
        ],
        total: 2
      });

      const response = await request(app)
        .get('/api/call-center/recordings');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.recordings).toHaveLength(2);
    });

    it('should filter by date range', async () => {
      RecordingService.listRecordings.mockResolvedValue({
        recordings: [],
        total: 0
      });

      const response = await request(app)
        .get('/api/call-center/recordings')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        });

      expect(response.status).toBe(200);
      expect(RecordingService.listRecordings).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date)
        })
      );
    });
  });

  describe('GET /api/call-center/recordings/:recordingId', () => {
    it('should get recording details', async () => {
      RecordingService.getRecording.mockResolvedValue({
        recordingId: 'rec-1',
        callId: 'call-1',
        duration: 120,
        transcription: { text: 'Hello, how can I help?' }
      });

      const response = await request(app)
        .get('/api/call-center/recordings/rec-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.recordingId).toBe('rec-1');
    });

    it('should return 404 for missing recording', async () => {
      RecordingService.getRecording.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/call-center/recordings/not-found');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Recording not found');
    });
  });

  describe('POST /api/call-center/recordings/:recordingId/transcribe', () => {
    it('should transcribe recording', async () => {
      RecordingService.transcribeRecording.mockResolvedValue({
        text: 'Hello, how can I help you today?',
        segments: [
          { start: 0, end: 2, text: 'Hello', speaker: 'Agent' }
        ]
      });

      const response = await request(app)
        .post('/api/call-center/recordings/rec-1/transcribe')
        .send({ language: 'en', speakerDiarization: true });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.text).toBeDefined();
    });
  });

  describe('POST /api/call-center/recordings/:recordingId/analyze', () => {
    it('should analyze recording sentiment', async () => {
      RecordingService.getRecording.mockResolvedValue({
        recordingId: 'rec-1',
        transcription: {
          segments: [{ text: 'Great service!' }]
        }
      });

      SentimentAnalysis.analyzeCallSentiment.mockResolvedValue({
        overall: { sentiment: 'positive', score: 0.8 },
        timeline: []
      });

      const response = await request(app)
        .post('/api/call-center/recordings/rec-1/analyze');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.overall.sentiment).toBe('positive');
    });
  });

  describe('GET /api/call-center/recordings/:recordingId/export', () => {
    it('should export recording as JSON', async () => {
      RecordingService.exportRecording.mockResolvedValue({
        contentType: 'application/json',
        filename: 'rec-1.json',
        data: JSON.stringify({ recordingId: 'rec-1' })
      });

      const response = await request(app)
        .get('/api/call-center/recordings/rec-1/export')
        .query({ format: 'json' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should export recording as SRT', async () => {
      RecordingService.exportRecording.mockResolvedValue({
        contentType: 'text/srt',
        filename: 'rec-1.srt',
        data: '1\n00:00:00,000 --> 00:00:02,000\nHello'
      });

      const response = await request(app)
        .get('/api/call-center/recordings/rec-1/export')
        .query({ format: 'srt' });

      expect(response.status).toBe(200);
    });
  });

  describe('DELETE /api/call-center/recordings/:recordingId', () => {
    it('should delete recording', async () => {
      RecordingService.deleteRecording.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/call-center/recordings/rec-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(RecordingService.deleteRecording).toHaveBeenCalledWith('rec-1');
    });
  });

  describe('POST /api/call-center/webrtc/session', () => {
    it('should create WebRTC session', async () => {
      WebRTCService.createSession.mockReturnValue({
        sessionId: 'ws_123',
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      const response = await request(app)
        .post('/api/call-center/webrtc/session')
        .send({
          botId: 'bot-123',
          callType: 'outbound',
          destination: '+1234567890'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.sessionId).toBeDefined();
    });

    it('should start recording if requested', async () => {
      WebRTCService.createSession.mockReturnValue({
        sessionId: 'ws_123'
      });

      await request(app)
        .post('/api/call-center/webrtc/session')
        .send({
          botId: 'bot-123',
          callType: 'outbound',
          destination: '+1234567890',
          recordCall: true
        });

      expect(RecordingService.startRecording).toHaveBeenCalled();
    });
  });

  describe('POST /api/call-center/webrtc/session/:sessionId/offer', () => {
    it('should handle WebRTC offer', async () => {
      WebRTCService.handleOffer.mockResolvedValue({
        type: 'answer',
        sdp: 'v=0\r\n...'
      });

      const response = await request(app)
        .post('/api/call-center/webrtc/session/ws_123/offer')
        .send({
          offer: { type: 'offer', sdp: 'v=0\r\n...' }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.answer).toBeDefined();
    });
  });

  describe('POST /api/call-center/webrtc/session/:sessionId/ice', () => {
    it('should add ICE candidate', async () => {
      const response = await request(app)
        .post('/api/call-center/webrtc/session/ws_123/ice')
        .send({
          candidate: {
            candidate: 'candidate:...',
            sdpMid: 'audio',
            sdpMLineIndex: 0
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(WebRTCService.addIceCandidate).toHaveBeenCalled();
    });
  });

  describe('GET /api/call-center/webrtc/token', () => {
    it('should generate Twilio token', async () => {
      WebRTCService.generateTwilioToken.mockResolvedValue({
        token: 'jwt_token_here',
        identity: '1',
        expires: new Date()
      });

      const response = await request(app)
        .get('/api/call-center/webrtc/token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
    });
  });

  describe('POST /api/call-center/sentiment/analyze', () => {
    it('should analyze text sentiment', async () => {
      SentimentAnalysis.analyzeSentiment.mockResolvedValue({
        sentiment: 'positive',
        score: 0.8,
        confidence: 0.9
      });

      const response = await request(app)
        .post('/api/call-center/sentiment/analyze')
        .send({
          text: 'This is great service!',
          detailed: true,
          includeEmotions: true
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.sentiment).toBe('positive');
    });

    it('should require text', async () => {
      const response = await request(app)
        .post('/api/call-center/sentiment/analyze')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Text is required');
    });
  });

  describe('GET /api/call-center/transcription/providers', () => {
    it('should return available providers', async () => {
      const response = await request(app)
        .get('/api/call-center/transcription/providers');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.providers).toContain('whisper');
      expect(response.body.data.languages).toContain('en');
    });
  });

  describe('GET /api/call-center/stats', () => {
    it('should return call statistics', async () => {
      VoiceAnalytics.getDetailedStats.mockResolvedValue({
        totalCalls: 100,
        byDay: [
          { date: '2024-01-01', calls: 20 }
        ]
      });

      const response = await request(app)
        .get('/api/call-center/stats')
        .query({ startDate: '2024-01-01', groupBy: 'day' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
