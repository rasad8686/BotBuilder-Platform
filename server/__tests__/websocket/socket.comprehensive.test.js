/**
 * Comprehensive WebSocket Tests
 * Full coverage for server/websocket/index.js
 * Tests connection handling, authentication, rooms, broadcasting, error handling
 */

// Mock dependencies before requiring the module
jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../services/ai', () => ({
  AIProviderFactory: {
    getProvider: jest.fn()
  },
  EncryptionHelper: {
    decrypt: jest.fn()
  }
}));

jest.mock('../../services/ragService', () => ({
  getContextForQuery: jest.fn(),
  buildRAGPrompt: jest.fn()
}));

jest.mock('../../services/voiceToBot/GladiaProcessor', () => {
  return jest.fn().mockImplementation(() => ({
    createStreamingRecognition: jest.fn()
  }));
});

jest.mock('../../websocket/executionSocket', () => {
  return jest.fn().mockImplementation((io) => ({
    io,
    initialize: jest.fn()
  }));
});

const db = require('../../db');
const log = require('../../utils/logger');
const { AIProviderFactory, EncryptionHelper } = require('../../services/ai');
const ragService = require('../../services/ragService');
const GladiaProcessor = require('../../services/voiceToBot/GladiaProcessor');
const ExecutionSocket = require('../../websocket/executionSocket');

// Mock socket and io instances
const mockSocket = {
  id: 'test-socket-id',
  emit: jest.fn(),
  on: jest.fn(),
  join: jest.fn(),
  leave: jest.fn(),
  to: jest.fn(() => ({ emit: jest.fn() })),
  handshake: { query: {}, auth: {} },
  disconnect: jest.fn()
};

const mockIo = {
  on: jest.fn(),
  to: jest.fn(() => ({ emit: jest.fn() })),
  emit: jest.fn(),
  use: jest.fn(),
  fetchSockets: jest.fn()
};

// Mock Server class from socket.io
jest.mock('socket.io', () => ({
  Server: jest.fn().mockImplementation(() => mockIo)
}));

const { Server } = require('socket.io');
const websocket = require('../../websocket');

describe('WebSocket Comprehensive Tests', () => {
  let mockServer;
  let connectionHandler;
  let socketHandlers;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockServer = { listen: jest.fn() };

    // Reset socket handlers
    socketHandlers = {};
    mockSocket.on.mockImplementation((event, handler) => {
      socketHandlers[event] = handler;
      return mockSocket;
    });

    mockSocket.emit.mockClear();
    mockSocket.join.mockClear();
    mockSocket.leave.mockClear();

    // Capture connection handler
    mockIo.on.mockImplementation((event, handler) => {
      if (event === 'connection') {
        connectionHandler = handler;
      }
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ========================================
  // CONNECTION HANDLING
  // ========================================

  describe('Connection Handling', () => {
    it('should handle new socket connection', () => {
      websocket.initializeWebSocket(mockServer);
      connectionHandler(mockSocket);

      expect(log.info).toHaveBeenCalledWith(`[WebSocket] New connection: ${mockSocket.id}`);
    });

    it('should register all required event handlers on connection', () => {
      websocket.initializeWebSocket(mockServer);
      connectionHandler(mockSocket);

      expect(mockSocket.on).toHaveBeenCalledWith('ping', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('voice:start', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('voice:audio', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('voice:stop', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('widget:join', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('widget:message', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });

    it('should handle disconnect event', () => {
      websocket.initializeWebSocket(mockServer);
      connectionHandler(mockSocket);

      socketHandlers.disconnect('client namespace disconnect');

      expect(log.info).toHaveBeenCalledWith(
        `[WebSocket] Disconnected: ${mockSocket.id}, reason: client namespace disconnect`
      );
    });

    it('should handle disconnect with transport close reason', () => {
      websocket.initializeWebSocket(mockServer);
      connectionHandler(mockSocket);

      socketHandlers.disconnect('transport close');

      expect(log.info).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('transport close')
      );
    });

    it('should handle disconnect with ping timeout reason', () => {
      websocket.initializeWebSocket(mockServer);
      connectionHandler(mockSocket);

      socketHandlers.disconnect('ping timeout');

      expect(log.info).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('ping timeout')
      );
    });

    it('should cleanup voice session on disconnect', () => {
      const mockStreamingSession = {
        write: jest.fn(),
        end: jest.fn()
      };

      GladiaProcessor.mockImplementation(() => ({
        createStreamingRecognition: jest.fn(() => mockStreamingSession)
      }));

      websocket.initializeWebSocket(mockServer);
      connectionHandler(mockSocket);

      socketHandlers['voice:start']({ sessionId: 'test-session' });
      socketHandlers.disconnect('client disconnect');

      expect(mockStreamingSession.end).toHaveBeenCalled();
    });

    it('should handle multiple simultaneous connections', () => {
      websocket.initializeWebSocket(mockServer);

      const socket1 = { ...mockSocket, id: 'socket-1', on: jest.fn() };
      const socket2 = { ...mockSocket, id: 'socket-2', on: jest.fn() };

      connectionHandler(socket1);
      connectionHandler(socket2);

      expect(log.info).toHaveBeenCalledWith('[WebSocket] New connection: socket-1');
      expect(log.info).toHaveBeenCalledWith('[WebSocket] New connection: socket-2');
    });

    it('should initialize with correct Socket.IO configuration', () => {
      websocket.initializeWebSocket(mockServer);

      expect(Server).toHaveBeenCalledWith(mockServer, {
        cors: {
          origin: '*',
          methods: ['GET', 'POST'],
          credentials: true
        },
        path: '/ws',
        transports: ['websocket', 'polling']
      });
    });

    it('should use custom CLIENT_URL when provided', () => {
      const originalUrl = process.env.CLIENT_URL;
      process.env.CLIENT_URL = 'https://example.com';

      websocket.initializeWebSocket(mockServer);

      expect(Server).toHaveBeenCalledWith(mockServer, expect.objectContaining({
        cors: expect.objectContaining({
          origin: 'https://example.com'
        })
      }));

      process.env.CLIENT_URL = originalUrl;
    });

    it('should initialize ExecutionSocket on server initialization', () => {
      const result = websocket.initializeWebSocket(mockServer);

      expect(ExecutionSocket).toHaveBeenCalledWith(mockIo);
      expect(result.executionSocket.initialize).toHaveBeenCalled();
    });

    it('should log server initialization', () => {
      websocket.initializeWebSocket(mockServer);

      expect(log.info).toHaveBeenCalledWith('[WebSocket] Server initialized');
    });
  });

  // ========================================
  // PING/PONG (KEEP-ALIVE)
  // ========================================

  describe('Ping/Pong Keep-Alive', () => {
    beforeEach(() => {
      websocket.initializeWebSocket(mockServer);
      connectionHandler(mockSocket);
    });

    it('should respond to ping with pong', () => {
      socketHandlers.ping();

      expect(mockSocket.emit).toHaveBeenCalledWith('pong');
    });

    it('should handle rapid ping requests', () => {
      for (let i = 0; i < 10; i++) {
        socketHandlers.ping();
      }

      expect(mockSocket.emit).toHaveBeenCalledTimes(10);
      expect(mockSocket.emit).toHaveBeenCalledWith('pong');
    });

    it('should handle ping without errors', () => {
      expect(() => socketHandlers.ping()).not.toThrow();
    });
  });

  // ========================================
  // ROOM MANAGEMENT
  // ========================================

  describe('Room Management - Widget', () => {
    beforeEach(() => {
      websocket.initializeWebSocket(mockServer);
      connectionHandler(mockSocket);
    });

    it('should join widget room with correct format', () => {
      socketHandlers['widget:join']({ botId: 123, sessionId: 'session-abc' });

      expect(mockSocket.join).toHaveBeenCalledWith('widget:123:session-abc');
    });

    it('should log widget room join', () => {
      socketHandlers['widget:join']({ botId: 456, sessionId: 'session-xyz' });

      expect(log.info).toHaveBeenCalledWith('[WebSocket] Widget joined room: widget:456:session-xyz');
    });

    it('should handle string botId in room join', () => {
      socketHandlers['widget:join']({ botId: '789', sessionId: 'test-session' });

      expect(mockSocket.join).toHaveBeenCalledWith('widget:789:test-session');
    });

    it('should handle numeric botId in room join', () => {
      socketHandlers['widget:join']({ botId: 999, sessionId: 'numeric-session' });

      expect(mockSocket.join).toHaveBeenCalledWith('widget:999:numeric-session');
    });

    it('should handle UUID session IDs', () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      socketHandlers['widget:join']({ botId: 1, sessionId: uuid });

      expect(mockSocket.join).toHaveBeenCalledWith(`widget:1:${uuid}`);
    });

    it('should allow joining multiple widget rooms', () => {
      socketHandlers['widget:join']({ botId: 1, sessionId: 'session-1' });
      socketHandlers['widget:join']({ botId: 2, sessionId: 'session-2' });

      expect(mockSocket.join).toHaveBeenCalledTimes(2);
      expect(mockSocket.join).toHaveBeenCalledWith('widget:1:session-1');
      expect(mockSocket.join).toHaveBeenCalledWith('widget:2:session-2');
    });
  });

  // ========================================
  // VOICE STREAMING - START
  // ========================================

  describe('Voice Streaming - Start Session', () => {
    let mockStreamingSession;

    beforeEach(() => {
      mockStreamingSession = {
        write: jest.fn(),
        end: jest.fn()
      };

      GladiaProcessor.mockImplementation(() => ({
        createStreamingRecognition: jest.fn(() => mockStreamingSession)
      }));

      websocket.initializeWebSocket(mockServer);
      connectionHandler(mockSocket);
    });

    it('should start voice streaming with default language', () => {
      socketHandlers['voice:start']({ sessionId: 'test-session' });

      expect(log.info).toHaveBeenCalledWith(
        '[WebSocket] Voice streaming started',
        expect.objectContaining({ language: 'az', sessionId: 'test-session' })
      );
    });

    it('should start voice streaming with custom language', () => {
      socketHandlers['voice:start']({ language: 'en', sessionId: 'test-session' });

      expect(log.info).toHaveBeenCalledWith(
        '[WebSocket] Voice streaming started',
        expect.objectContaining({ language: 'en' })
      );
    });

    it('should emit voice:ready when session is created', () => {
      socketHandlers['voice:start']({ sessionId: 'test' });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:ready',
        expect.objectContaining({
          status: 'streaming',
          provider: 'gladia'
        })
      );
    });

    it('should include timeout in voice:ready config', () => {
      socketHandlers['voice:start']({ sessionId: 'test', timeout: 120000 });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:ready',
        expect.objectContaining({
          config: expect.objectContaining({
            timeout: 120000
          })
        })
      );
    });

    it('should enforce maximum timeout limit', () => {
      const excessiveTimeout = 60 * 60 * 1000; // 1 hour
      const maxTimeout = 30 * 60 * 1000; // 30 minutes

      socketHandlers['voice:start']({ sessionId: 'test', timeout: excessiveTimeout });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:ready',
        expect.objectContaining({
          config: expect.objectContaining({
            timeout: maxTimeout
          })
        })
      );
    });

    it('should enforce minimum timeout limit', () => {
      const tooShort = 30000; // 30 seconds
      const minTimeout = 60000; // 1 minute

      socketHandlers['voice:start']({ sessionId: 'test', timeout: tooShort });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:ready',
        expect.objectContaining({
          config: expect.objectContaining({
            timeout: minTimeout
          })
        })
      );
    });

    it('should use default timeout when not specified', () => {
      socketHandlers['voice:start']({ sessionId: 'test' });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:ready',
        expect.objectContaining({
          config: expect.objectContaining({
            timeout: 5 * 60 * 1000 // 5 minutes default
          })
        })
      );
    });

    it('should include maxRetries in config', () => {
      socketHandlers['voice:start']({ sessionId: 'test' });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:ready',
        expect.objectContaining({
          config: expect.objectContaining({
            maxRetries: 3
          })
        })
      );
    });

    it('should include redisQueueEnabled in config', () => {
      socketHandlers['voice:start']({ sessionId: 'test' });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:ready',
        expect.objectContaining({
          config: expect.objectContaining({
            redisQueueEnabled: expect.any(Boolean)
          })
        })
      );
    });

    it('should cleanup existing session before starting new one', () => {
      const firstSession = { end: jest.fn() };
      const secondSession = { write: jest.fn(), end: jest.fn() };

      GladiaProcessor.mockImplementation(() => ({
        createStreamingRecognition: jest.fn()
          .mockReturnValueOnce(firstSession)
          .mockReturnValueOnce(secondSession)
      }));

      connectionHandler(mockSocket);
      socketHandlers['voice:start']({ sessionId: 'session-1' });
      socketHandlers['voice:start']({ sessionId: 'session-2' });

      expect(firstSession.end).toHaveBeenCalled();
    });

    it('should handle errors when ending existing session', () => {
      const firstSession = {
        end: jest.fn(() => { throw new Error('Already ended'); })
      };
      const secondSession = { write: jest.fn(), end: jest.fn() };

      GladiaProcessor.mockImplementation(() => ({
        createStreamingRecognition: jest.fn()
          .mockReturnValueOnce(firstSession)
          .mockReturnValueOnce(secondSession)
      }));

      connectionHandler(mockSocket);
      socketHandlers['voice:start']({ sessionId: 'session-1' });

      expect(() => {
        socketHandlers['voice:start']({ sessionId: 'session-2' });
      }).not.toThrow();
    });

    it('should emit voice:fallback when Gladia is not available', () => {
      GladiaProcessor.mockImplementation(() => ({
        createStreamingRecognition: jest.fn(() => null)
      }));

      connectionHandler(mockSocket);
      socketHandlers['voice:start']({ sessionId: 'test' });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:fallback',
        expect.objectContaining({
          reason: expect.stringContaining('Gladia STT not available'),
          useWebSpeech: true
        })
      );
    });

    it('should warn when Gladia is unavailable', () => {
      GladiaProcessor.mockImplementation(() => ({
        createStreamingRecognition: jest.fn(() => null)
      }));

      connectionHandler(mockSocket);
      socketHandlers['voice:start']({ sessionId: 'test' });

      expect(log.warn).toHaveBeenCalledWith('[WebSocket] Gladia STT not available, check API key');
    });

    it('should reset transcript and chunk count on new session', () => {
      socketHandlers['voice:start']({ sessionId: 'session-1' });
      socketHandlers['voice:audio'](Buffer.from([1, 2, 3]));
      socketHandlers['voice:start']({ sessionId: 'session-2' });
      socketHandlers['voice:stop']();

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:complete',
        expect.objectContaining({
          audioChunksProcessed: 0
        })
      );
    });
  });

  // ========================================
  // VOICE STREAMING - TRANSCRIPT HANDLING
  // ========================================

  describe('Voice Streaming - Transcripts', () => {
    let onResultCallback;
    let mockStreamingSession;

    beforeEach(() => {
      mockStreamingSession = {
        write: jest.fn(),
        end: jest.fn()
      };

      GladiaProcessor.mockImplementation(() => ({
        createStreamingRecognition: jest.fn((config, onResult, onError) => {
          onResultCallback = onResult;
          return mockStreamingSession;
        })
      }));

      websocket.initializeWebSocket(mockServer);
      connectionHandler(mockSocket);
      socketHandlers['voice:start']({ sessionId: 'test' });
      mockSocket.emit.mockClear();
    });

    it('should emit interim transcript', () => {
      onResultCallback({
        transcript: 'hello',
        isFinal: false,
        confidence: 0.95
      });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:transcript',
        expect.objectContaining({
          transcript: 'hello',
          isFinal: false,
          confidence: 0.95
        })
      );
    });

    it('should emit final transcript with fullTranscript', () => {
      onResultCallback({
        transcript: 'hello world',
        isFinal: true,
        confidence: 0.98
      });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:transcript',
        expect.objectContaining({
          transcript: 'hello world',
          isFinal: true,
          confidence: 0.98,
          fullTranscript: 'hello world'
        })
      );
    });

    it('should accumulate multiple final transcripts', () => {
      onResultCallback({ transcript: 'hello', isFinal: true, confidence: 0.98 });
      onResultCallback({ transcript: 'world', isFinal: true, confidence: 0.97 });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:transcript',
        expect.objectContaining({
          fullTranscript: 'hello world'
        })
      );
    });

    it('should handle empty transcript', () => {
      onResultCallback({ transcript: '', isFinal: false, confidence: 0.5 });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:transcript',
        expect.objectContaining({
          transcript: ''
        })
      );
    });

    it('should handle very long transcript', () => {
      const longText = 'a'.repeat(1000);
      onResultCallback({ transcript: longText, isFinal: true, confidence: 0.9 });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:transcript',
        expect.objectContaining({
          transcript: longText
        })
      );
    });

    it('should handle low confidence scores', () => {
      onResultCallback({ transcript: 'uncertain', isFinal: false, confidence: 0.3 });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:transcript',
        expect.objectContaining({
          confidence: 0.3
        })
      );
    });

    it('should not emit transcript if streaming inactive', () => {
      socketHandlers['voice:stop']();
      mockSocket.emit.mockClear();

      onResultCallback({ transcript: 'test', isFinal: false, confidence: 0.9 });

      const transcriptCalls = mockSocket.emit.mock.calls.filter(
        call => call[0] === 'voice:transcript'
      );
      expect(transcriptCalls).toHaveLength(0);
    });

    it('should log interim transcript', () => {
      onResultCallback({ transcript: 'interim', isFinal: false, confidence: 0.85 });

      expect(log.info).toHaveBeenCalledWith(
        '[WebSocket] Sent INTERIM transcript to client',
        expect.any(Object)
      );
    });

    it('should log final transcript', () => {
      onResultCallback({ transcript: 'final', isFinal: true, confidence: 0.95 });

      expect(log.info).toHaveBeenCalledWith(
        '[WebSocket] Sent FINAL transcript to client',
        expect.any(Object)
      );
    });

    it('should log all STT results', () => {
      onResultCallback({ transcript: 'test', isFinal: false, confidence: 0.9 });

      expect(log.info).toHaveBeenCalledWith(
        '[WebSocket] STT Result received',
        expect.objectContaining({
          isFinal: false,
          confidence: 0.9
        })
      );
    });
  });

  // ========================================
  // VOICE STREAMING - AUDIO PROCESSING
  // ========================================

  describe('Voice Streaming - Audio Processing', () => {
    let mockStreamingSession;

    beforeEach(() => {
      mockStreamingSession = {
        write: jest.fn(),
        end: jest.fn()
      };

      GladiaProcessor.mockImplementation(() => ({
        createStreamingRecognition: jest.fn(() => mockStreamingSession)
      }));

      websocket.initializeWebSocket(mockServer);
      connectionHandler(mockSocket);
      socketHandlers['voice:start']({ sessionId: 'test' });
    });

    it('should write audio buffer to streaming session', () => {
      const audioBuffer = Buffer.from([1, 2, 3, 4]);
      socketHandlers['voice:audio'](audioBuffer);

      expect(mockStreamingSession.write).toHaveBeenCalledWith(audioBuffer);
    });

    it('should convert ArrayBuffer to Buffer', () => {
      const arrayBuffer = new ArrayBuffer(4);
      const uint8 = new Uint8Array(arrayBuffer);
      uint8[0] = 1;
      uint8[1] = 2;

      socketHandlers['voice:audio'](arrayBuffer);

      expect(mockStreamingSession.write).toHaveBeenCalled();
    });

    it('should not write empty buffers', () => {
      socketHandlers['voice:audio'](Buffer.alloc(0));

      expect(mockStreamingSession.write).not.toHaveBeenCalled();
    });

    it('should handle null audio data', () => {
      expect(() => {
        socketHandlers['voice:audio'](null);
      }).not.toThrow();

      expect(mockStreamingSession.write).not.toHaveBeenCalled();
    });

    it('should handle undefined audio data', () => {
      expect(() => {
        socketHandlers['voice:audio'](undefined);
      }).not.toThrow();

      expect(mockStreamingSession.write).not.toHaveBeenCalled();
    });

    it('should log debug info every 50 chunks', () => {
      for (let i = 0; i < 51; i++) {
        socketHandlers['voice:audio'](Buffer.from([1, 2, 3]));
      }

      expect(log.debug).toHaveBeenCalledWith(
        '[WebSocket] Audio chunks received',
        expect.objectContaining({ count: 50 })
      );
    });

    it('should handle write errors gracefully', () => {
      mockStreamingSession.write.mockImplementation(() => {
        throw new Error('Write failed');
      });

      socketHandlers['voice:audio'](Buffer.from([1, 2, 3]));

      expect(log.error).toHaveBeenCalledWith(
        '[WebSocket] Error writing audio chunk',
        expect.any(Object)
      );
    });

    it('should emit error when stream is destroyed', () => {
      mockStreamingSession.write.mockImplementation(() => {
        throw new Error('Stream destroyed');
      });

      socketHandlers['voice:audio'](Buffer.from([1, 2, 3]));

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:error',
        expect.objectContaining({
          error: 'Stream ended unexpectedly'
        })
      );
    });

    it('should emit error when stream has ended', () => {
      mockStreamingSession.write.mockImplementation(() => {
        throw new Error('Stream ended');
      });

      socketHandlers['voice:audio'](Buffer.from([1, 2, 3]));

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:error',
        expect.objectContaining({
          error: 'Stream ended unexpectedly'
        })
      );
    });

    it('should not write if session inactive', () => {
      socketHandlers['voice:stop']();
      mockStreamingSession.write.mockClear();

      socketHandlers['voice:audio'](Buffer.from([1, 2, 3]));

      expect(mockStreamingSession.write).not.toHaveBeenCalled();
    });

    it('should process large audio chunks', () => {
      const largeBuffer = Buffer.alloc(10000);
      socketHandlers['voice:audio'](largeBuffer);

      expect(mockStreamingSession.write).toHaveBeenCalledWith(largeBuffer);
    });
  });

  // ========================================
  // VOICE STREAMING - ERROR HANDLING
  // ========================================

  describe('Voice Streaming - Error Handling', () => {
    let onErrorCallback;
    let mockStreamingSession;

    beforeEach(() => {
      mockStreamingSession = {
        write: jest.fn(),
        end: jest.fn()
      };

      GladiaProcessor.mockImplementation(() => ({
        createStreamingRecognition: jest.fn((config, onResult, onError) => {
          onErrorCallback = onError;
          return mockStreamingSession;
        })
      }));

      websocket.initializeWebSocket(mockServer);
      connectionHandler(mockSocket);
      socketHandlers['voice:start']({ sessionId: 'test' });
      mockSocket.emit.mockClear();
    });

    it('should emit voice:error on error', () => {
      onErrorCallback(new Error('Test error'));

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:error',
        expect.objectContaining({
          error: 'Test error'
        })
      );
    });

    it('should retry on ECONNRESET errors', () => {
      const error = new Error('Connection reset');
      error.code = 'ECONNRESET';

      onErrorCallback(error);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:retrying',
        expect.objectContaining({
          attempt: 1,
          maxRetries: 3
        })
      );
    });

    it('should retry on ETIMEDOUT errors', () => {
      const error = new Error('Timeout');
      error.code = 'ETIMEDOUT';

      onErrorCallback(error);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:retrying',
        expect.objectContaining({
          attempt: 1
        })
      );
    });

    it('should retry on network errors', () => {
      onErrorCallback(new Error('network failure'));

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:retrying',
        expect.any(Object)
      );
    });

    it('should retry on connection errors', () => {
      onErrorCallback(new Error('connection lost'));

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:retrying',
        expect.any(Object)
      );
    });

    it('should not retry non-retryable errors', () => {
      onErrorCallback(new Error('Invalid API key'));

      const retryingCalls = mockSocket.emit.mock.calls.filter(
        call => call[0] === 'voice:retrying'
      );
      expect(retryingCalls).toHaveLength(0);
    });

    it('should emit voice:restart after max retries', () => {
      const error = new Error('Connection reset');
      error.code = 'ECONNRESET';

      for (let i = 0; i < 4; i++) {
        onErrorCallback(error);
        jest.advanceTimersByTime((i + 1) * 1000);
      }

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:restart',
        expect.objectContaining({
          reason: expect.stringContaining('Max retries')
        })
      );
    });

    it('should emit voice:restart on streaming limit exceeded', () => {
      const error = new Error('Streaming limit exceeded');
      error.code = 11;

      onErrorCallback(error);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:restart',
        expect.objectContaining({
          reason: 'Streaming limit exceeded'
        })
      );
    });

    it('should log error details', () => {
      onErrorCallback(new Error('Test error'));

      expect(log.error).toHaveBeenCalledWith(
        '[WebSocket] Voice streaming error',
        expect.objectContaining({
          error: 'Test error'
        })
      );
    });

    it('should include retry count in error log', () => {
      const error = new Error('Connection reset');
      error.code = 'ECONNRESET';

      onErrorCallback(error);

      expect(log.error).toHaveBeenCalledWith(
        '[WebSocket] Voice streaming error',
        expect.objectContaining({
          retryCount: 0
        })
      );
    });

    it('should log retry attempts', () => {
      const error = new Error('network issue');
      onErrorCallback(error);

      expect(log.info).toHaveBeenCalledWith(
        '[WebSocket] Retrying streaming session',
        expect.any(Object)
      );
    });
  });

  // ========================================
  // VOICE STREAMING - STOP
  // ========================================

  describe('Voice Streaming - Stop Session', () => {
    let mockStreamingSession;

    beforeEach(() => {
      mockStreamingSession = {
        write: jest.fn(),
        end: jest.fn()
      };

      GladiaProcessor.mockImplementation(() => ({
        createStreamingRecognition: jest.fn(() => mockStreamingSession)
      }));

      websocket.initializeWebSocket(mockServer);
      connectionHandler(mockSocket);
      socketHandlers['voice:start']({ sessionId: 'test' });
      mockSocket.emit.mockClear();
    });

    it('should end streaming session', () => {
      socketHandlers['voice:stop']();

      expect(mockStreamingSession.end).toHaveBeenCalled();
    });

    it('should emit voice:complete with final transcript', () => {
      socketHandlers['voice:stop']();

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:complete',
        expect.objectContaining({
          finalTranscript: '',
          audioChunksProcessed: 0
        })
      );
    });

    it('should include chunk count in voice:complete', () => {
      socketHandlers['voice:audio'](Buffer.from([1, 2, 3]));
      socketHandlers['voice:audio'](Buffer.from([4, 5, 6]));
      socketHandlers['voice:stop']();

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:complete',
        expect.objectContaining({
          audioChunksProcessed: 2
        })
      );
    });

    it('should log streaming stopped', () => {
      socketHandlers['voice:stop']();

      expect(log.info).toHaveBeenCalledWith(
        '[WebSocket] Voice streaming stopped',
        expect.any(Object)
      );
    });

    it('should handle errors when ending stream', () => {
      mockStreamingSession.end.mockImplementation(() => {
        throw new Error('Already ended');
      });

      socketHandlers['voice:stop']();

      expect(log.warn).toHaveBeenCalledWith(
        '[WebSocket] Error ending stream',
        expect.any(Object)
      );
    });

    it('should work if no session exists', () => {
      socketHandlers['voice:stop']();

      expect(() => {
        socketHandlers['voice:stop']();
      }).not.toThrow();
    });

    it('should clear timeout on stop', () => {
      socketHandlers['voice:stop']();

      // Should not throw even if timeout was set
      expect(() => {
        jest.advanceTimersByTime(5 * 60 * 1000);
      }).not.toThrow();
    });
  });

  // ========================================
  // VOICE STREAMING - TIMEOUT
  // ========================================

  describe('Voice Streaming - Timeout Handling', () => {
    let mockStreamingSession;

    beforeEach(() => {
      mockStreamingSession = {
        write: jest.fn(),
        end: jest.fn()
      };

      GladiaProcessor.mockImplementation(() => ({
        createStreamingRecognition: jest.fn(() => mockStreamingSession)
      }));

      websocket.initializeWebSocket(mockServer);
      connectionHandler(mockSocket);
    });

    it('should emit voice:timeout when timeout reached', () => {
      socketHandlers['voice:start']({ sessionId: 'test', timeout: 60000 });
      mockSocket.emit.mockClear();

      jest.advanceTimersByTime(60000);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:timeout',
        expect.objectContaining({
          reason: 'Max streaming duration reached',
          duration: 60000
        })
      );
    });

    it('should end session on timeout', () => {
      socketHandlers['voice:start']({ sessionId: 'test' });

      jest.advanceTimersByTime(5 * 60 * 1000);

      expect(mockStreamingSession.end).toHaveBeenCalled();
    });

    it('should not timeout if stopped before timeout', () => {
      socketHandlers['voice:start']({ sessionId: 'test', timeout: 60000 });

      jest.advanceTimersByTime(30000);
      socketHandlers['voice:stop']();
      mockSocket.emit.mockClear();

      jest.advanceTimersByTime(40000);

      const timeoutCalls = mockSocket.emit.mock.calls.filter(
        call => call[0] === 'voice:timeout'
      );
      expect(timeoutCalls).toHaveLength(0);
    });

    it('should log timeout event', () => {
      socketHandlers['voice:start']({ sessionId: 'test', timeout: 60000 });

      jest.advanceTimersByTime(60000);

      expect(log.info).toHaveBeenCalledWith(
        '[WebSocket] Streaming timeout reached, stopping',
        expect.any(Object)
      );
    });
  });

  // ========================================
  // WIDGET MESSAGING
  // ========================================

  describe('Widget Message Handling', () => {
    beforeEach(() => {
      websocket.initializeWebSocket(mockServer);
      connectionHandler(mockSocket);
      db.query.mockReset();
    });

    it('should emit typing indicator', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot', language: 'en' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '1',
        sessionId: 'test',
        message: 'Hello'
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('widget:typing');
    });

    it('should validate botId is numeric', async () => {
      await socketHandlers['widget:message']({
        botId: 'invalid',
        sessionId: 'test',
        message: 'Hello'
      });

      expect(log.warn).toHaveBeenCalledWith('[WebSocket] Invalid botId:', 'invalid');
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'widget:message',
        expect.objectContaining({
          message: expect.stringContaining('Bot ID is invalid')
        })
      );
    });

    it('should check if bot exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '999',
        sessionId: 'test',
        message: 'Hello'
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, name, language FROM bots'),
        [999]
      );
    });

    it('should emit error if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '999',
        sessionId: 'test',
        message: 'Hello'
      });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'widget:message',
        expect.objectContaining({
          message: expect.stringContaining('mövcud deyil')
        })
      );
    });

    it('should store user message in database', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot', language: 'en' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '1',
        sessionId: 'test',
        message: 'Hello bot'
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO widget_messages'),
        [1, 'test', 'user', 'Hello bot']
      );
    });

    it('should retrieve AI configuration', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot', language: 'en' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '1',
        sessionId: 'test',
        message: 'Hello'
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM ai_configurations'),
        [1]
      );
    });

    it('should use default message if AI not configured', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot', language: 'en' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '1',
        sessionId: 'test',
        message: 'Hello'
      });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'widget:message',
        expect.objectContaining({
          message: 'AI is not configured for this bot.'
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      db.query.mockRejectedValue(new Error('Database error'));

      await socketHandlers['widget:message']({
        botId: '1',
        sessionId: 'test',
        message: 'Hello'
      });

      expect(log.error).toHaveBeenCalledWith(
        '[WebSocket] Widget message error:',
        'Database error'
      );
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'widget:error',
        { error: 'Failed to process message' }
      );
    });
  });

  // ========================================
  // WIDGET MESSAGING - AI INTEGRATION
  // ========================================

  describe('Widget Message - AI Integration', () => {
    beforeEach(() => {
      websocket.initializeWebSocket(mockServer);
      connectionHandler(mockSocket);
      db.query.mockReset();
    });

    it('should decrypt encrypted API key', async () => {
      const mockConfig = {
        provider: 'openai',
        model: 'gpt-4',
        api_key_encrypted: 'encrypted-key',
        system_prompt: 'You are helpful',
        temperature: 0.7,
        max_tokens: 1024,
        context_window: 10
      };

      EncryptionHelper.decrypt.mockReturnValue('decrypted-key');
      AIProviderFactory.getProvider.mockReturnValue({
        chat: jest.fn().mockResolvedValue({ content: 'AI response' })
      });
      ragService.getContextForQuery.mockResolvedValue({ hasContext: false });

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot', language: 'en' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockConfig] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '1',
        sessionId: 'test',
        message: 'Hello'
      });

      expect(EncryptionHelper.decrypt).toHaveBeenCalledWith('encrypted-key');
    });

    it('should use environment API key for OpenAI', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'env-api-key';

      const mockConfig = {
        provider: 'openai',
        model: 'gpt-4',
        api_key_encrypted: null,
        system_prompt: 'You are helpful',
        temperature: 0.7,
        max_tokens: 1024,
        context_window: 10
      };

      const mockAIService = {
        chat: jest.fn().mockResolvedValue({ content: 'AI response' })
      };

      AIProviderFactory.getProvider.mockReturnValue(mockAIService);
      ragService.getContextForQuery.mockResolvedValue({ hasContext: false });

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot', language: 'en' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockConfig] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '1',
        sessionId: 'test',
        message: 'Hello'
      });

      expect(AIProviderFactory.getProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'env-api-key'
        })
      );

      process.env.OPENAI_API_KEY = originalKey;
    });

    it('should trim API key whitespace', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = '  api-key  ';

      const mockConfig = {
        provider: 'openai',
        model: 'gpt-4',
        api_key_encrypted: null,
        system_prompt: 'You are helpful',
        temperature: 0.7,
        max_tokens: 1024,
        context_window: 10
      };

      const mockAIService = {
        chat: jest.fn().mockResolvedValue({ content: 'AI response' })
      };

      AIProviderFactory.getProvider.mockReturnValue(mockAIService);
      ragService.getContextForQuery.mockResolvedValue({ hasContext: false });

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot', language: 'en' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockConfig] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '1',
        sessionId: 'test',
        message: 'Hello'
      });

      expect(AIProviderFactory.getProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'api-key'
        })
      );

      process.env.OPENAI_API_KEY = originalKey;
    });

    it('should integrate RAG context', async () => {
      const mockConfig = {
        provider: 'openai',
        model: 'gpt-4',
        api_key_encrypted: 'encrypted-key',
        system_prompt: 'You are helpful',
        temperature: 0.7,
        max_tokens: 1024,
        context_window: 10
      };

      EncryptionHelper.decrypt.mockReturnValue('api-key');
      const mockAIService = {
        chat: jest.fn().mockResolvedValue({ content: 'AI response' })
      };
      AIProviderFactory.getProvider.mockReturnValue(mockAIService);

      ragService.getContextForQuery.mockResolvedValue({
        hasContext: true,
        context: 'RAG context'
      });
      ragService.buildRAGPrompt.mockReturnValue('Enhanced prompt');

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot', language: 'en' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockConfig] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '1',
        sessionId: 'test',
        message: 'What is RAG?'
      });

      expect(ragService.getContextForQuery).toHaveBeenCalledWith(
        1,
        'What is RAG?',
        expect.objectContaining({
          maxChunks: 20,
          threshold: 0.15
        })
      );
    });

    it('should handle RAG errors gracefully', async () => {
      const mockConfig = {
        provider: 'openai',
        model: 'gpt-4',
        api_key_encrypted: 'encrypted-key',
        system_prompt: 'You are helpful',
        temperature: 0.7,
        max_tokens: 1024,
        context_window: 10
      };

      EncryptionHelper.decrypt.mockReturnValue('api-key');
      const mockAIService = {
        chat: jest.fn().mockResolvedValue({ content: 'AI response' })
      };
      AIProviderFactory.getProvider.mockReturnValue(mockAIService);
      ragService.getContextForQuery.mockRejectedValue(new Error('RAG error'));

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot', language: 'en' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockConfig] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '1',
        sessionId: 'test',
        message: 'Hello'
      });

      expect(log.error).toHaveBeenCalledWith('RAG error:', 'RAG error');
    });

    it('should add language instruction for non-English bots', async () => {
      const mockConfig = {
        provider: 'openai',
        model: 'gpt-4',
        api_key_encrypted: 'encrypted-key',
        system_prompt: 'You are helpful',
        temperature: 0.7,
        max_tokens: 1024,
        context_window: 10
      };

      EncryptionHelper.decrypt.mockReturnValue('api-key');
      const mockAIService = {
        chat: jest.fn().mockResolvedValue({ content: 'Salam' })
      };
      AIProviderFactory.getProvider.mockReturnValue(mockAIService);
      ragService.getContextForQuery.mockResolvedValue({ hasContext: false });

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot', language: 'az' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockConfig] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '1',
        sessionId: 'test',
        message: 'Salam'
      });

      expect(mockAIService.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('Azerbaijani')
            })
          ])
        })
      );
    });

    it('should retrieve conversation history', async () => {
      const mockConfig = {
        provider: 'openai',
        model: 'gpt-4',
        api_key_encrypted: 'encrypted-key',
        system_prompt: 'You are helpful',
        temperature: 0.7,
        max_tokens: 1024,
        context_window: 5
      };

      EncryptionHelper.decrypt.mockReturnValue('api-key');
      const mockAIService = {
        chat: jest.fn().mockResolvedValue({ content: 'AI response' })
      };
      AIProviderFactory.getProvider.mockReturnValue(mockAIService);
      ragService.getContextForQuery.mockResolvedValue({ hasContext: false });

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot', language: 'en' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockConfig] })
        .mockResolvedValueOnce({
          rows: [
            { role: 'user', content: 'Previous message' },
            { role: 'assistant', content: 'Previous response' }
          ]
        })
        .mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '1',
        sessionId: 'test',
        message: 'New message'
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT role, content FROM widget_messages'),
        [1, 'test', 5]
      );
    });

    it('should store bot response', async () => {
      const mockConfig = {
        provider: 'openai',
        model: 'gpt-4',
        api_key_encrypted: 'encrypted-key',
        system_prompt: 'You are helpful',
        temperature: 0.7,
        max_tokens: 1024,
        context_window: 10
      };

      EncryptionHelper.decrypt.mockReturnValue('api-key');
      const mockAIService = {
        chat: jest.fn().mockResolvedValue({ content: 'AI response text' })
      };
      AIProviderFactory.getProvider.mockReturnValue(mockAIService);
      ragService.getContextForQuery.mockResolvedValue({ hasContext: false });

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot', language: 'en' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockConfig] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '1',
        sessionId: 'test',
        message: 'Hello'
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO widget_messages'),
        [1, 'test', 'assistant', 'AI response text']
      );
    });

    it('should emit AI response to client', async () => {
      const mockConfig = {
        provider: 'openai',
        model: 'gpt-4',
        api_key_encrypted: 'encrypted-key',
        system_prompt: 'You are helpful',
        temperature: 0.7,
        max_tokens: 1024,
        context_window: 10
      };

      EncryptionHelper.decrypt.mockReturnValue('api-key');
      const mockAIService = {
        chat: jest.fn().mockResolvedValue({ content: 'AI response text' })
      };
      AIProviderFactory.getProvider.mockReturnValue(mockAIService);
      ragService.getContextForQuery.mockResolvedValue({ hasContext: false });

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bot', language: 'en' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockConfig] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '1',
        sessionId: 'test',
        message: 'Hello'
      });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'widget:message',
        { message: 'AI response text' }
      );
    });
  });

  // ========================================
  // ERROR HANDLING
  // ========================================

  describe('Error Handling', () => {
    beforeEach(() => {
      websocket.initializeWebSocket(mockServer);
      connectionHandler(mockSocket);
    });

    it('should log socket errors', () => {
      const error = new Error('Socket error');
      socketHandlers.error(error);

      expect(log.error).toHaveBeenCalledWith(
        `[WebSocket] Socket error: Socket error`
      );
    });

    it('should handle error without message property', () => {
      const error = {};
      socketHandlers.error(error);

      expect(log.error).toHaveBeenCalled();
    });

    it('should handle null error', () => {
      expect(() => {
        socketHandlers.error(null);
      }).not.toThrow();
    });

    it('should handle undefined error', () => {
      expect(() => {
        socketHandlers.error(undefined);
      }).not.toThrow();
    });
  });

  // ========================================
  // BROADCASTING
  // ========================================

  describe('Broadcasting', () => {
    it('should broadcast to all clients', () => {
      websocket.initializeWebSocket(mockServer);
      websocket.broadcast('test:event', { data: 'test' });

      expect(mockIo.emit).toHaveBeenCalledWith('test:event', { data: 'test' });
    });

    it('should not broadcast if io not initialized', () => {
      websocket.broadcast('test:event', { data: 'test' });

      expect(mockIo.emit).not.toHaveBeenCalled();
    });

    it('should broadcast to specific room', () => {
      const mockTo = { emit: jest.fn() };
      mockIo.to.mockReturnValue(mockTo);

      websocket.initializeWebSocket(mockServer);
      websocket.broadcastToRoom('room-1', 'test:event', { data: 'test' });

      expect(mockIo.to).toHaveBeenCalledWith('room-1');
      expect(mockTo.emit).toHaveBeenCalledWith('test:event', { data: 'test' });
    });

    it('should not broadcast to room if io not initialized', () => {
      websocket.broadcastToRoom('room-1', 'test:event', { data: 'test' });

      expect(mockIo.to).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // MODULE EXPORTS
  // ========================================

  describe('Module Exports', () => {
    it('should return null for getIO before initialization', () => {
      expect(websocket.getIO()).toBeNull();
    });

    it('should return io instance after initialization', () => {
      websocket.initializeWebSocket(mockServer);

      expect(websocket.getIO()).toBe(mockIo);
    });

    it('should return null for getExecutionSocket before initialization', () => {
      expect(websocket.getExecutionSocket()).toBeNull();
    });

    it('should return executionSocket after initialization', () => {
      const { executionSocket } = websocket.initializeWebSocket(mockServer);

      expect(websocket.getExecutionSocket()).toBe(executionSocket);
    });

    it('should return 0 for getConnectedClientsCount if not initialized', async () => {
      const count = await websocket.getConnectedClientsCount();

      expect(count).toBe(0);
    });

    it('should return connected clients count', async () => {
      const mockSockets = [
        { id: 'socket-1' },
        { id: 'socket-2' },
        { id: 'socket-3' }
      ];
      mockIo.fetchSockets.mockResolvedValue(mockSockets);

      websocket.initializeWebSocket(mockServer);
      const count = await websocket.getConnectedClientsCount();

      expect(count).toBe(3);
    });

    it('should call fetchSockets on io instance', async () => {
      mockIo.fetchSockets.mockResolvedValue([]);

      websocket.initializeWebSocket(mockServer);
      await websocket.getConnectedClientsCount();

      expect(mockIo.fetchSockets).toHaveBeenCalled();
    });
  });

  // ========================================
  // ENVIRONMENT CONFIGURATION
  // ========================================

  describe('Environment Configuration', () => {
    it('should use wildcard CORS origin by default', () => {
      delete process.env.CLIENT_URL;

      websocket.initializeWebSocket(mockServer);

      expect(Server).toHaveBeenCalledWith(mockServer, expect.objectContaining({
        cors: expect.objectContaining({
          origin: '*'
        })
      }));
    });

    it('should configure websocket path', () => {
      websocket.initializeWebSocket(mockServer);

      expect(Server).toHaveBeenCalledWith(mockServer, expect.objectContaining({
        path: '/ws'
      }));
    });

    it('should configure allowed transports', () => {
      websocket.initializeWebSocket(mockServer);

      expect(Server).toHaveBeenCalledWith(mockServer, expect.objectContaining({
        transports: ['websocket', 'polling']
      }));
    });

    it('should enable CORS credentials', () => {
      websocket.initializeWebSocket(mockServer);

      expect(Server).toHaveBeenCalledWith(mockServer, expect.objectContaining({
        cors: expect.objectContaining({
          credentials: true
        })
      }));
    });

    it('should allow GET and POST methods', () => {
      websocket.initializeWebSocket(mockServer);

      expect(Server).toHaveBeenCalledWith(mockServer, expect.objectContaining({
        cors: expect.objectContaining({
          methods: ['GET', 'POST']
        })
      }));
    });
  });
});
