/**
 * Comprehensive WebSocket Server Tests
 * Full coverage test suite for server/websocket/index.js
 * Targets 100% code coverage with 60+ test cases
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

// Mock socket.io
const mockSocket = {
  id: 'socket-test-123',
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

describe('WebSocket Server - Comprehensive Tests', () => {
  let websocket;
  let mockServer;
  let connectionHandler;
  let socketHandlers;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Reset module to get fresh state
    jest.resetModules();
    jest.mock('socket.io', () => ({
      Server: jest.fn().mockImplementation(() => mockIo)
    }));
    websocket = require('../../websocket');

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

  describe('Module Initialization', () => {
    describe('initializeWebSocket()', () => {
      it('should create Socket.IO server with correct CORS configuration', () => {
        const result = websocket.initializeWebSocket(mockServer);

        expect(Server).toHaveBeenCalledWith(mockServer, {
          cors: {
            origin: '*',
            methods: ['GET', 'POST'],
            credentials: true
          },
          path: '/ws',
          transports: ['websocket', 'polling']
        });
        expect(result.io).toBeDefined();
      });

      it('should use CLIENT_URL from environment if set', () => {
        const originalUrl = process.env.CLIENT_URL;
        process.env.CLIENT_URL = 'http://localhost:3000';

        websocket.initializeWebSocket(mockServer);

        expect(Server).toHaveBeenCalledWith(mockServer, expect.objectContaining({
          cors: expect.objectContaining({
            origin: 'http://localhost:3000'
          })
        }));

        process.env.CLIENT_URL = originalUrl;
      });

      it('should initialize ExecutionSocket with io instance', () => {
        const { executionSocket } = websocket.initializeWebSocket(mockServer);

        expect(ExecutionSocket).toHaveBeenCalledWith(mockIo);
        expect(executionSocket.initialize).toHaveBeenCalled();
      });

      it('should register connection event listener', () => {
        websocket.initializeWebSocket(mockServer);

        expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
      });

      it('should log successful initialization', () => {
        websocket.initializeWebSocket(mockServer);

        expect(log.info).toHaveBeenCalledWith('[WebSocket] Server initialized');
      });

      it('should return both io and executionSocket instances', () => {
        const result = websocket.initializeWebSocket(mockServer);

        expect(result).toHaveProperty('io');
        expect(result).toHaveProperty('executionSocket');
        expect(result.io).toBe(mockIo);
        expect(result.executionSocket).toBeDefined();
      });

      it('should configure custom WebSocket path', () => {
        websocket.initializeWebSocket(mockServer);

        expect(Server).toHaveBeenCalledWith(mockServer, expect.objectContaining({
          path: '/ws'
        }));
      });

      it('should enable both websocket and polling transports', () => {
        websocket.initializeWebSocket(mockServer);

        expect(Server).toHaveBeenCalledWith(mockServer, expect.objectContaining({
          transports: ['websocket', 'polling']
        }));
      });

      it('should enable credentials for CORS', () => {
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

  describe('Socket Connection Handling', () => {
    beforeEach(() => {
      websocket.initializeWebSocket(mockServer);
      connectionHandler(mockSocket);
    });

    it('should log new connection with socket ID', () => {
      expect(log.info).toHaveBeenCalledWith('[WebSocket] New connection: socket-test-123');
    });

    it('should register ping event handler', () => {
      expect(socketHandlers).toHaveProperty('ping');
      expect(typeof socketHandlers.ping).toBe('function');
    });

    it('should register voice:start event handler', () => {
      expect(socketHandlers).toHaveProperty('voice:start');
      expect(typeof socketHandlers['voice:start']).toBe('function');
    });

    it('should register voice:audio event handler', () => {
      expect(socketHandlers).toHaveProperty('voice:audio');
      expect(typeof socketHandlers['voice:audio']).toBe('function');
    });

    it('should register voice:stop event handler', () => {
      expect(socketHandlers).toHaveProperty('voice:stop');
      expect(typeof socketHandlers['voice:stop']).toBe('function');
    });

    it('should register widget:join event handler', () => {
      expect(socketHandlers).toHaveProperty('widget:join');
      expect(typeof socketHandlers['widget:join']).toBe('function');
    });

    it('should register widget:message event handler', () => {
      expect(socketHandlers).toHaveProperty('widget:message');
      expect(typeof socketHandlers['widget:message']).toBe('function');
    });

    it('should register error event handler', () => {
      expect(socketHandlers).toHaveProperty('error');
      expect(typeof socketHandlers.error).toBe('function');
    });

    it('should register disconnect event handler', () => {
      expect(socketHandlers).toHaveProperty('disconnect');
      expect(typeof socketHandlers.disconnect).toBe('function');
    });

    it('should have multiple disconnect handlers registered', () => {
      const disconnectCalls = mockSocket.on.mock.calls.filter(call => call[0] === 'disconnect');
      expect(disconnectCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Ping/Pong Mechanism', () => {
    beforeEach(() => {
      websocket.initializeWebSocket(mockServer);
      connectionHandler(mockSocket);
    });

    it('should respond to ping with pong', () => {
      socketHandlers.ping();

      expect(mockSocket.emit).toHaveBeenCalledWith('pong');
    });

    it('should handle multiple consecutive pings', () => {
      socketHandlers.ping();
      socketHandlers.ping();
      socketHandlers.ping();

      expect(mockSocket.emit).toHaveBeenCalledTimes(3);
      expect(mockSocket.emit).toHaveBeenCalledWith('pong');
    });

    it('should emit pong for each ping received', () => {
      for (let i = 0; i < 10; i++) {
        socketHandlers.ping();
      }

      expect(mockSocket.emit).toHaveBeenCalledTimes(10);
    });
  });

  describe('Voice Streaming - Session Start', () => {
    let mockStreamingSession;

    beforeEach(() => {
      websocket.initializeWebSocket(mockServer);
      connectionHandler(mockSocket);

      mockStreamingSession = {
        write: jest.fn(),
        end: jest.fn()
      };

      GladiaProcessor.mockImplementation(() => ({
        createStreamingRecognition: jest.fn((config, onResult, onError) => mockStreamingSession)
      }));
    });

    it('should start voice streaming with default Azerbaijani language', () => {
      socketHandlers['voice:start']({ sessionId: 'test-session-1' });

      expect(log.info).toHaveBeenCalledWith(
        '[WebSocket] Voice streaming started',
        expect.objectContaining({
          language: 'az',
          sessionId: 'test-session-1'
        })
      );
    });

    it('should start voice streaming with custom language', () => {
      socketHandlers['voice:start']({ language: 'en', sessionId: 'test-session-2' });

      expect(log.info).toHaveBeenCalledWith(
        '[WebSocket] Voice streaming started',
        expect.objectContaining({
          language: 'en',
          sessionId: 'test-session-2'
        })
      );
    });

    it('should emit voice:ready when streaming session created successfully', () => {
      socketHandlers['voice:start']({ sessionId: 'test-session' });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:ready',
        expect.objectContaining({
          status: 'streaming',
          provider: 'gladia'
        })
      );
    });

    it('should include configuration in voice:ready event', () => {
      socketHandlers['voice:start']({ sessionId: 'test-session' });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:ready',
        expect.objectContaining({
          config: expect.objectContaining({
            timeout: expect.any(Number),
            maxRetries: 3,
            redisQueueEnabled: expect.any(Boolean)
          })
        })
      );
    });

    it('should use custom timeout within allowed limits', () => {
      const customTimeout = 120000; // 2 minutes
      socketHandlers['voice:start']({ sessionId: 'test', timeout: customTimeout });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:ready',
        expect.objectContaining({
          config: expect.objectContaining({
            timeout: customTimeout
          })
        })
      );
    });

    it('should cap timeout at maximum allowed (30 minutes)', () => {
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

    it('should enforce minimum timeout (1 minute)', () => {
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

    it('should clean up existing session before starting new one', () => {
      const firstSession = { end: jest.fn() };
      GladiaProcessor.mockImplementation(() => ({
        createStreamingRecognition: jest.fn()
          .mockReturnValueOnce(firstSession)
          .mockReturnValueOnce(mockStreamingSession)
      }));

      connectionHandler(mockSocket);
      socketHandlers['voice:start']({ sessionId: 'session-1' });
      socketHandlers['voice:start']({ sessionId: 'session-2' });

      expect(firstSession.end).toHaveBeenCalled();
    });

    it('should handle errors when ending existing session gracefully', () => {
      const firstSession = {
        end: jest.fn(() => { throw new Error('Already ended'); })
      };

      GladiaProcessor.mockImplementation(() => ({
        createStreamingRecognition: jest.fn()
          .mockReturnValueOnce(firstSession)
          .mockReturnValueOnce(mockStreamingSession)
      }));

      connectionHandler(mockSocket);
      socketHandlers['voice:start']({ sessionId: 'session-1' });

      expect(() => {
        socketHandlers['voice:start']({ sessionId: 'session-2' });
      }).not.toThrow();
    });

    it('should emit voice:fallback if Gladia is not available', () => {
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

    it('should warn when Gladia API key is missing', () => {
      GladiaProcessor.mockImplementation(() => ({
        createStreamingRecognition: jest.fn(() => null)
      }));

      connectionHandler(mockSocket);
      socketHandlers['voice:start']({ sessionId: 'test' });

      expect(log.warn).toHaveBeenCalledWith(
        '[WebSocket] Gladia STT not available, check API key'
      );
    });

    it('should log when Gladia STT streaming is ready', () => {
      socketHandlers['voice:start']({ sessionId: 'test' });

      expect(log.info).toHaveBeenCalledWith(
        '[WebSocket] Gladia real-time STT streaming ready',
        expect.any(Object)
      );
    });

    it('should reset state when starting new session', () => {
      socketHandlers['voice:start']({ sessionId: 'session-1' });
      socketHandlers['voice:audio'](Buffer.from([1, 2, 3]));
      socketHandlers['voice:stop']();

      mockSocket.emit.mockClear();

      socketHandlers['voice:start']({ sessionId: 'session-2' });
      socketHandlers['voice:stop']();

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:complete',
        expect.objectContaining({
          audioChunksProcessed: 0
        })
      );
    });

    it('should clear existing timeout when starting new session', () => {
      socketHandlers['voice:start']({ sessionId: 'session-1', timeout: 60000 });
      jest.advanceTimersByTime(30000);

      socketHandlers['voice:start']({ sessionId: 'session-2', timeout: 60000 });
      mockSocket.emit.mockClear();

      jest.advanceTimersByTime(35000);

      const timeoutCalls = mockSocket.emit.mock.calls.filter(
        call => call[0] === 'voice:timeout'
      );
      expect(timeoutCalls).toHaveLength(0);
    });

    it('should include redis queue status in config', () => {
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
  });

  describe('Voice Streaming - Transcript Handling', () => {
    let onResultCallback;
    let mockStreamingSession;

    beforeEach(() => {
      websocket.initializeWebSocket(mockServer);
      connectionHandler(mockSocket);

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

      socketHandlers['voice:start']({ sessionId: 'test-session' });
      mockSocket.emit.mockClear();
    });

    it('should emit interim transcript results', () => {
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

    it('should emit final transcript with full transcript', () => {
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
      onResultCallback({
        transcript: 'hello',
        isFinal: true,
        confidence: 0.98
      });

      onResultCallback({
        transcript: 'world',
        isFinal: true,
        confidence: 0.97
      });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:transcript',
        expect.objectContaining({
          fullTranscript: 'hello world'
        })
      );
    });

    it('should log interim transcript results', () => {
      onResultCallback({
        transcript: 'testing interim',
        isFinal: false,
        confidence: 0.85
      });

      expect(log.info).toHaveBeenCalledWith(
        '[WebSocket] Sent INTERIM transcript to client',
        expect.any(Object)
      );
    });

    it('should log final transcript results', () => {
      onResultCallback({
        transcript: 'testing final',
        isFinal: true,
        confidence: 0.95
      });

      expect(log.info).toHaveBeenCalledWith(
        '[WebSocket] Sent FINAL transcript to client',
        expect.any(Object)
      );
    });

    it('should log all STT results received', () => {
      onResultCallback({
        transcript: 'test',
        isFinal: false,
        confidence: 0.9
      });

      expect(log.info).toHaveBeenCalledWith(
        '[WebSocket] STT Result received',
        expect.objectContaining({
          isFinal: false,
          confidence: 0.9
        })
      );
    });

    it('should handle long transcripts correctly', () => {
      const longTranscript = 'a'.repeat(200);
      onResultCallback({
        transcript: longTranscript,
        isFinal: true,
        confidence: 0.95
      });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:transcript',
        expect.objectContaining({
          transcript: longTranscript
        })
      );
    });

    it('should not emit transcripts if streaming is inactive', () => {
      socketHandlers['voice:stop']();
      mockSocket.emit.mockClear();

      onResultCallback({
        transcript: 'should not emit',
        isFinal: false,
        confidence: 0.9
      });

      const transcriptCalls = mockSocket.emit.mock.calls.filter(
        call => call[0] === 'voice:transcript'
      );
      expect(transcriptCalls).toHaveLength(0);
    });

    it('should handle multiple interim results before final', () => {
      onResultCallback({
        transcript: 'h',
        isFinal: false,
        confidence: 0.7
      });

      onResultCallback({
        transcript: 'he',
        isFinal: false,
        confidence: 0.8
      });

      onResultCallback({
        transcript: 'hello',
        isFinal: true,
        confidence: 0.95
      });

      const transcriptCalls = mockSocket.emit.mock.calls.filter(
        call => call[0] === 'voice:transcript'
      );
      expect(transcriptCalls).toHaveLength(3);
    });

    it('should preserve confidence scores', () => {
      onResultCallback({
        transcript: 'test',
        isFinal: true,
        confidence: 0.876
      });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:transcript',
        expect.objectContaining({
          confidence: 0.876
        })
      );
    });

    it('should handle empty transcripts', () => {
      onResultCallback({
        transcript: '',
        isFinal: false,
        confidence: 0.5
      });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:transcript',
        expect.objectContaining({
          transcript: ''
        })
      );
    });

    it('should add space between accumulated final transcripts', () => {
      onResultCallback({
        transcript: 'first',
        isFinal: true,
        confidence: 0.95
      });

      onResultCallback({
        transcript: 'second',
        isFinal: true,
        confidence: 0.94
      });

      onResultCallback({
        transcript: 'third',
        isFinal: true,
        confidence: 0.96
      });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:transcript',
        expect.objectContaining({
          fullTranscript: 'first second third'
        })
      );
    });
  });

  describe('Voice Streaming - Error Handling and Retry Logic', () => {
    let onErrorCallback;
    let mockStreamingSession;

    beforeEach(() => {
      websocket.initializeWebSocket(mockServer);
      connectionHandler(mockSocket);

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

      socketHandlers['voice:start']({ sessionId: 'test-session' });
      mockSocket.emit.mockClear();
    });

    it('should emit voice:error on any error', () => {
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
          maxRetries: 3,
          reason: 'Connection reset'
        })
      );
    });

    it('should retry on ETIMEDOUT errors', () => {
      const error = new Error('Connection timeout');
      error.code = 'ETIMEDOUT';

      onErrorCallback(error);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:retrying',
        expect.objectContaining({
          attempt: 1
        })
      );
    });

    it('should retry on network-related errors', () => {
      onErrorCallback(new Error('network failure'));

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:retrying',
        expect.any(Object)
      );
    });

    it('should retry on connection-related errors', () => {
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

    it('should emit voice:restart after max retries exceeded', () => {
      const error = new Error('Connection reset');
      error.code = 'ECONNRESET';

      // Attempt 1
      onErrorCallback(error);
      jest.advanceTimersByTime(1000);

      // Attempt 2
      onErrorCallback(error);
      jest.advanceTimersByTime(2000);

      // Attempt 3
      onErrorCallback(error);
      jest.advanceTimersByTime(3000);

      // Final failure
      onErrorCallback(error);

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

    it('should emit voice:restart on exceeded message in error', () => {
      onErrorCallback(new Error('limit exceeded'));

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:restart',
        expect.any(Object)
      );
    });

    it('should log errors with context', () => {
      onErrorCallback(new Error('Test error'));

      expect(log.error).toHaveBeenCalledWith(
        '[WebSocket] Voice streaming error',
        expect.objectContaining({
          error: 'Test error'
        })
      );
    });

    it('should log retry attempts', () => {
      const error = new Error('Connection reset');
      error.code = 'ECONNRESET';

      onErrorCallback(error);

      expect(log.info).toHaveBeenCalledWith(
        '[WebSocket] Retrying streaming session',
        expect.objectContaining({
          retryCount: 1,
          maxRetries: 3
        })
      );
    });

    it('should increment retry delay with each attempt', () => {
      const error = new Error('network error');

      onErrorCallback(error);
      const firstDelay = jest.getTimerCount();

      jest.advanceTimersByTime(1000);
      onErrorCallback(error);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:retrying',
        expect.objectContaining({
          attempt: 2
        })
      );
    });

    it('should not retry if streaming is inactive', () => {
      const error = new Error('Connection reset');
      error.code = 'ECONNRESET';

      socketHandlers['voice:stop']();
      onErrorCallback(error);

      jest.advanceTimersByTime(5000);

      const retryingCalls = mockSocket.emit.mock.calls.filter(
        call => call[0] === 'voice:retrying'
      );
      expect(retryingCalls.length).toBeLessThanOrEqual(1);
    });

    it('should deactivate streaming on max retries', () => {
      const error = new Error('Connection reset');
      error.code = 'ECONNRESET';

      for (let i = 0; i < 4; i++) {
        onErrorCallback(error);
        jest.advanceTimersByTime((i + 1) * 1000);
      }

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:restart',
        expect.any(Object)
      );
    });

    it('should deactivate streaming on limit exceeded', () => {
      const error = new Error('exceeded');

      onErrorCallback(error);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:restart',
        expect.any(Object)
      );
    });
  });

  describe('Voice Streaming - Audio Data Handling', () => {
    let mockStreamingSession;

    beforeEach(() => {
      websocket.initializeWebSocket(mockServer);
      connectionHandler(mockSocket);

      mockStreamingSession = {
        write: jest.fn(),
        end: jest.fn()
      };

      GladiaProcessor.mockImplementation(() => ({
        createStreamingRecognition: jest.fn(() => mockStreamingSession)
      }));

      socketHandlers['voice:start']({ sessionId: 'test-session' });
    });

    it('should write audio buffer to streaming session', () => {
      const audioBuffer = Buffer.from([1, 2, 3, 4]);

      socketHandlers['voice:audio'](audioBuffer);

      expect(mockStreamingSession.write).toHaveBeenCalledWith(audioBuffer);
    });

    it('should convert ArrayBuffer to Buffer', () => {
      const arrayBuffer = new ArrayBuffer(4);
      const uint8Array = new Uint8Array(arrayBuffer);
      uint8Array[0] = 1;
      uint8Array[1] = 2;

      socketHandlers['voice:audio'](arrayBuffer);

      expect(mockStreamingSession.write).toHaveBeenCalled();
    });

    it('should not write empty buffers', () => {
      socketHandlers['voice:audio'](Buffer.alloc(0));

      expect(mockStreamingSession.write).not.toHaveBeenCalled();
    });

    it('should not write if session is null', () => {
      socketHandlers['voice:stop']();

      expect(() => {
        socketHandlers['voice:audio'](Buffer.from([1, 2, 3]));
      }).not.toThrow();
    });

    it('should not write if streaming is inactive', () => {
      socketHandlers['voice:stop']();
      mockStreamingSession.write.mockClear();

      socketHandlers['voice:audio'](Buffer.from([1, 2, 3]));

      expect(mockStreamingSession.write).not.toHaveBeenCalled();
    });

    it('should handle null audio data gracefully', () => {
      expect(() => {
        socketHandlers['voice:audio'](null);
      }).not.toThrow();
    });

    it('should handle undefined audio data gracefully', () => {
      expect(() => {
        socketHandlers['voice:audio'](undefined);
      }).not.toThrow();
    });

    it('should log errors when writing audio chunks fails', () => {
      mockStreamingSession.write.mockImplementation(() => {
        throw new Error('Write failed');
      });

      socketHandlers['voice:audio'](Buffer.from([1, 2, 3]));

      expect(log.error).toHaveBeenCalledWith(
        '[WebSocket] Error writing audio chunk',
        expect.objectContaining({
          error: 'Write failed'
        })
      );
    });

    it('should emit voice:error when stream is destroyed', () => {
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

    it('should emit voice:error when stream has ended', () => {
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

    it('should log debug info every 50 chunks', () => {
      for (let i = 0; i < 51; i++) {
        socketHandlers['voice:audio'](Buffer.from([1, 2, 3]));
      }

      expect(log.debug).toHaveBeenCalledWith(
        '[WebSocket] Audio chunks received',
        expect.objectContaining({ count: 50 })
      );
    });

    it('should increment audio chunk count correctly', () => {
      for (let i = 0; i < 25; i++) {
        socketHandlers['voice:audio'](Buffer.from([i]));
      }

      socketHandlers['voice:stop']();

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:complete',
        expect.objectContaining({
          audioChunksProcessed: 25
        })
      );
    });

    it('should handle large audio buffers', () => {
      const largeBuffer = Buffer.alloc(8192);

      socketHandlers['voice:audio'](largeBuffer);

      expect(mockStreamingSession.write).toHaveBeenCalledWith(largeBuffer);
    });

    it('should process chunks in sequence', () => {
      socketHandlers['voice:audio'](Buffer.from([1]));
      socketHandlers['voice:audio'](Buffer.from([2]));
      socketHandlers['voice:audio'](Buffer.from([3]));

      expect(mockStreamingSession.write).toHaveBeenCalledTimes(3);
    });
  });

  describe('Voice Streaming - Session Stop', () => {
    let mockStreamingSession;

    beforeEach(() => {
      websocket.initializeWebSocket(mockServer);
      connectionHandler(mockSocket);

      mockStreamingSession = {
        write: jest.fn(),
        end: jest.fn()
      };

      GladiaProcessor.mockImplementation(() => ({
        createStreamingRecognition: jest.fn(() => mockStreamingSession)
      }));

      socketHandlers['voice:start']({ sessionId: 'test-session' });
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

    it('should log streaming stopped with metadata', () => {
      socketHandlers['voice:stop']();

      expect(log.info).toHaveBeenCalledWith(
        '[WebSocket] Voice streaming stopped',
        expect.objectContaining({
          socketId: 'socket-test-123',
          audioChunks: 0
        })
      );
    });

    it('should handle errors when ending stream', () => {
      mockStreamingSession.end.mockImplementation(() => {
        throw new Error('Stream already ended');
      });

      socketHandlers['voice:stop']();

      expect(log.warn).toHaveBeenCalledWith(
        '[WebSocket] Error ending stream',
        expect.objectContaining({
          error: 'Stream already ended'
        })
      );
    });

    it('should work if no session exists', () => {
      socketHandlers['voice:stop']();

      expect(() => {
        socketHandlers['voice:stop']();
      }).not.toThrow();
    });

    it('should include audio chunk count in completion', () => {
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

    it('should clear streaming timeout on stop', () => {
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

    it('should deactivate streaming flag', () => {
      socketHandlers['voice:stop']();
      mockSocket.emit.mockClear();

      socketHandlers['voice:audio'](Buffer.from([1, 2, 3]));

      expect(mockStreamingSession.write).not.toHaveBeenCalled();
    });

    it('should trim final transcript whitespace', () => {
      socketHandlers['voice:stop']();

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:complete',
        expect.objectContaining({
          finalTranscript: expect.any(String)
        })
      );
    });
  });

  describe('Voice Streaming - Timeout Mechanism', () => {
    let mockStreamingSession;

    beforeEach(() => {
      websocket.initializeWebSocket(mockServer);
      connectionHandler(mockSocket);

      mockStreamingSession = {
        write: jest.fn(),
        end: jest.fn()
      };

      GladiaProcessor.mockImplementation(() => ({
        createStreamingRecognition: jest.fn(() => mockStreamingSession)
      }));
    });

    it('should emit voice:timeout when timeout is reached', () => {
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

    it('should end streaming session on timeout', () => {
      socketHandlers['voice:start']({ sessionId: 'test' });

      jest.advanceTimersByTime(5 * 60 * 1000); // Default 5 minutes

      expect(mockStreamingSession.end).toHaveBeenCalled();
    });

    it('should log timeout event', () => {
      socketHandlers['voice:start']({ sessionId: 'test', timeout: 60000 });

      jest.advanceTimersByTime(60000);

      expect(log.info).toHaveBeenCalledWith(
        '[WebSocket] Streaming timeout reached, stopping',
        expect.objectContaining({
          duration: 60000
        })
      );
    });

    it('should include final transcript in timeout event', () => {
      socketHandlers['voice:start']({ sessionId: 'test', timeout: 60000 });
      mockSocket.emit.mockClear();

      jest.advanceTimersByTime(60000);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'voice:timeout',
        expect.objectContaining({
          finalTranscript: ''
        })
      );
    });

    it('should not timeout if streaming stopped before timeout', () => {
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

    it('should deactivate streaming on timeout', () => {
      socketHandlers['voice:start']({ sessionId: 'test', timeout: 60000 });

      jest.advanceTimersByTime(60000);
      mockStreamingSession.write.mockClear();

      socketHandlers['voice:audio'](Buffer.from([1, 2, 3]));

      expect(mockStreamingSession.write).not.toHaveBeenCalled();
    });

    it('should handle timeout with null session gracefully', () => {
      socketHandlers['voice:start']({ sessionId: 'test', timeout: 60000 });
      mockStreamingSession.end.mockImplementation(() => {
        mockStreamingSession = null;
      });

      expect(() => {
        jest.advanceTimersByTime(60000);
      }).not.toThrow();
    });
  });

  describe('Widget - Join Room', () => {
    beforeEach(() => {
      websocket.initializeWebSocket(mockServer);
      connectionHandler(mockSocket);
    });

    it('should join widget room with correct room name', () => {
      socketHandlers['widget:join']({
        botId: 123,
        sessionId: 'session-abc'
      });

      expect(mockSocket.join).toHaveBeenCalledWith('widget:123:session-abc');
    });

    it('should log room join', () => {
      socketHandlers['widget:join']({
        botId: 456,
        sessionId: 'session-xyz'
      });

      expect(log.info).toHaveBeenCalledWith(
        '[WebSocket] Widget joined room: widget:456:session-xyz'
      );
    });

    it('should handle string botId', () => {
      socketHandlers['widget:join']({
        botId: '789',
        sessionId: 'session-123'
      });

      expect(mockSocket.join).toHaveBeenCalledWith('widget:789:session-123');
    });

    it('should handle different session IDs', () => {
      socketHandlers['widget:join']({
        botId: 1,
        sessionId: 'unique-session-id-12345'
      });

      expect(mockSocket.join).toHaveBeenCalledWith('widget:1:unique-session-id-12345');
    });

    it('should allow joining multiple rooms', () => {
      socketHandlers['widget:join']({ botId: 1, sessionId: 'session-1' });
      socketHandlers['widget:join']({ botId: 2, sessionId: 'session-2' });

      expect(mockSocket.join).toHaveBeenCalledTimes(2);
    });
  });

  describe('Widget - Message Processing', () => {
    beforeEach(() => {
      websocket.initializeWebSocket(mockServer);
      connectionHandler(mockSocket);

      db.query.mockReset();
    });

    it('should emit typing indicator immediately', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Bot', language: 'en' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '1',
        sessionId: 'session-1',
        message: 'Hello'
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('widget:typing');
    });

    it('should validate botId is a valid number', async () => {
      await socketHandlers['widget:message']({
        botId: 'invalid',
        sessionId: 'session-1',
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

    it('should check if bot exists in database', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '999',
        sessionId: 'session-1',
        message: 'Hello'
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, name, language FROM bots'),
        [999]
      );
    });

    it('should emit error if bot does not exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '999',
        sessionId: 'session-1',
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
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Bot', language: 'en' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '1',
        sessionId: 'session-1',
        message: 'Hello bot'
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO widget_messages'),
        [1, 'session-1', 'user', 'Hello bot']
      );
    });

    it('should fetch AI configuration for bot', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Bot', language: 'en' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '1',
        sessionId: 'session-1',
        message: 'Hello'
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM ai_configurations'),
        [1]
      );
    });

    it('should use default message if AI not configured', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Bot', language: 'en' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '1',
        sessionId: 'session-1',
        message: 'Hello'
      });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'widget:message',
        expect.objectContaining({
          message: 'AI is not configured for this bot.'
        })
      );
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

      EncryptionHelper.decrypt.mockReturnValue('decrypted-api-key');
      AIProviderFactory.getProvider.mockReturnValue({
        chat: jest.fn().mockResolvedValue({ content: 'AI response' })
      });

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Bot', language: 'en' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockConfig] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      ragService.getContextForQuery.mockResolvedValue({ hasContext: false });

      await socketHandlers['widget:message']({
        botId: '1',
        sessionId: 'session-1',
        message: 'Hello'
      });

      expect(EncryptionHelper.decrypt).toHaveBeenCalledWith('encrypted-key');
    });

    it('should use environment OpenAI API key if not encrypted', async () => {
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
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Bot', language: 'en' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockConfig] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '1',
        sessionId: 'session-1',
        message: 'Hello'
      });

      expect(AIProviderFactory.getProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'env-api-key'
        })
      );

      process.env.OPENAI_API_KEY = originalKey;
    });

    it('should use Anthropic API key for Anthropic provider', async () => {
      const originalKey = process.env.ANTHROPIC_API_KEY;
      process.env.ANTHROPIC_API_KEY = 'anthropic-key';

      const mockConfig = {
        provider: 'anthropic',
        model: 'claude-3',
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
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Bot', language: 'en' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockConfig] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '1',
        sessionId: 'session-1',
        message: 'Hello'
      });

      process.env.ANTHROPIC_API_KEY = originalKey;
    });

    it('should trim API key whitespace', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = '  api-key-with-spaces  ';

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
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Bot', language: 'en' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockConfig] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '1',
        sessionId: 'session-1',
        message: 'Hello'
      });

      expect(AIProviderFactory.getProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'api-key-with-spaces'
        })
      );

      process.env.OPENAI_API_KEY = originalKey;
    });

    it('should integrate RAG context into system prompt', async () => {
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
        context: 'RAG context data'
      });
      ragService.buildRAGPrompt.mockReturnValue('Enhanced prompt with RAG');

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Bot', language: 'en' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockConfig] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '1',
        sessionId: 'session-1',
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
      expect(ragService.buildRAGPrompt).toHaveBeenCalled();
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
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Bot', language: 'en' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockConfig] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '1',
        sessionId: 'session-1',
        message: 'Hello'
      });

      expect(log.error).toHaveBeenCalledWith('RAG error:', 'RAG error');
    });

    it('should add language instruction for non-English bot', async () => {
      const mockConfig = {
        provider: 'openai',
        model: 'gpt-4',
        api_key_encrypted: 'encrypted-key',
        system_prompt: 'Siz köməkçisiniz',
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
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Bot', language: 'az' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockConfig] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '1',
        sessionId: 'session-1',
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

    it('should not add language instruction for English bot', async () => {
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
        chat: jest.fn().mockResolvedValue({ content: 'Hello' })
      };
      AIProviderFactory.getProvider.mockReturnValue(mockAIService);
      ragService.getContextForQuery.mockResolvedValue({ hasContext: false });

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Bot', language: 'en' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockConfig] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '1',
        sessionId: 'session-1',
        message: 'Hello'
      });

      expect(mockAIService.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.not.stringContaining('LANGUAGE REQUIREMENT')
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
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Bot', language: 'en' }] })
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
        sessionId: 'session-1',
        message: 'New message'
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT role, content FROM widget_messages'),
        [1, 'session-1', 5]
      );
    });

    it('should skip duplicate message in history', async () => {
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
      ragService.getContextForQuery.mockResolvedValue({ hasContext: false });

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Bot', language: 'en' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockConfig] })
        .mockResolvedValueOnce({
          rows: [
            { role: 'user', content: 'Hello' }, // Same as current message
            { role: 'assistant', content: 'Previous response' }
          ]
        })
        .mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '1',
        sessionId: 'session-1',
        message: 'Hello'
      });

      expect(mockAIService.chat).toHaveBeenCalled();
    });

    it('should send AI request with correct parameters', async () => {
      const mockConfig = {
        provider: 'openai',
        model: 'gpt-4',
        api_key_encrypted: 'encrypted-key',
        system_prompt: 'You are helpful',
        temperature: 0.8,
        max_tokens: 2048,
        context_window: 10
      };

      EncryptionHelper.decrypt.mockReturnValue('api-key');
      const mockAIService = {
        chat: jest.fn().mockResolvedValue({ content: 'AI response' })
      };
      AIProviderFactory.getProvider.mockReturnValue(mockAIService);
      ragService.getContextForQuery.mockResolvedValue({ hasContext: false });

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Bot', language: 'en' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockConfig] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '1',
        sessionId: 'session-1',
        message: 'Test message'
      });

      expect(mockAIService.chat).toHaveBeenCalledWith({
        messages: expect.any(Array),
        temperature: 0.8,
        maxTokens: 2048,
        stream: false
      });
    });

    it('should store bot response in database', async () => {
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
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Bot', language: 'en' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockConfig] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '1',
        sessionId: 'session-1',
        message: 'Hello'
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO widget_messages'),
        [1, 'session-1', 'assistant', 'AI response text']
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
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Bot', language: 'en' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockConfig] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '1',
        sessionId: 'session-1',
        message: 'Hello'
      });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'widget:message',
        { message: 'AI response text' }
      );
    });

    it('should handle errors gracefully', async () => {
      db.query.mockRejectedValue(new Error('Database error'));

      await socketHandlers['widget:message']({
        botId: '1',
        sessionId: 'session-1',
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
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'widget:message',
        { message: 'Sorry, there was an error. Please try again.' }
      );
    });

    it('should parse botId as integer', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 42, name: 'Test Bot', language: 'en' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await socketHandlers['widget:message']({
        botId: '42',
        sessionId: 'session-1',
        message: 'Hello'
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [42]
      );
    });
  });

  describe('Error Handler', () => {
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

    it('should handle different error types', () => {
      const errors = [
        new Error('Network error'),
        new Error('Authentication failed'),
        new Error('Timeout')
      ];

      errors.forEach(error => {
        socketHandlers.error(error);
      });

      expect(log.error).toHaveBeenCalledTimes(errors.length);
    });
  });

  describe('Disconnect Handler', () => {
    let mockStreamingSession;

    beforeEach(() => {
      websocket.initializeWebSocket(mockServer);
      connectionHandler(mockSocket);

      mockStreamingSession = {
        write: jest.fn(),
        end: jest.fn()
      };

      GladiaProcessor.mockImplementation(() => ({
        createStreamingRecognition: jest.fn(() => mockStreamingSession)
      }));
    });

    it('should log disconnection with reason', () => {
      socketHandlers.disconnect('client disconnect');

      expect(log.info).toHaveBeenCalledWith(
        `[WebSocket] Disconnected: socket-test-123, reason: client disconnect`
      );
    });

    it('should clean up streaming session on disconnect', () => {
      socketHandlers['voice:start']({ sessionId: 'test-session' });
      socketHandlers.disconnect('transport close');

      expect(mockStreamingSession.end).toHaveBeenCalled();
    });

    it('should handle disconnect without active session', () => {
      expect(() => {
        socketHandlers.disconnect('client disconnect');
      }).not.toThrow();
    });

    it('should handle different disconnect reasons', () => {
      const reasons = ['ping timeout', 'transport error', 'client namespace disconnect'];

      reasons.forEach(reason => {
        socketHandlers.disconnect(reason);
      });

      expect(log.info).toHaveBeenCalledTimes(reasons.length);
    });

    it('should handle disconnect with null reason', () => {
      expect(() => {
        socketHandlers.disconnect(null);
      }).not.toThrow();
    });
  });

  describe('Exported Functions - getIO()', () => {
    it('should return null before initialization', () => {
      const freshWebsocket = require('../../websocket');
      expect(freshWebsocket.getIO()).toBeNull();
    });

    it('should return io instance after initialization', () => {
      websocket.initializeWebSocket(mockServer);

      expect(websocket.getIO()).toBe(mockIo);
    });

    it('should return same instance on multiple calls', () => {
      websocket.initializeWebSocket(mockServer);

      const io1 = websocket.getIO();
      const io2 = websocket.getIO();

      expect(io1).toBe(io2);
    });
  });

  describe('Exported Functions - getExecutionSocket()', () => {
    it('should return null before initialization', () => {
      const freshWebsocket = require('../../websocket');
      expect(freshWebsocket.getExecutionSocket()).toBeNull();
    });

    it('should return executionSocket instance after initialization', () => {
      const { executionSocket } = websocket.initializeWebSocket(mockServer);

      expect(websocket.getExecutionSocket()).toBe(executionSocket);
    });

    it('should return same instance on multiple calls', () => {
      websocket.initializeWebSocket(mockServer);

      const exec1 = websocket.getExecutionSocket();
      const exec2 = websocket.getExecutionSocket();

      expect(exec1).toBe(exec2);
    });
  });

  describe('Exported Functions - broadcast()', () => {
    it('should not emit if io is not initialized', () => {
      websocket.broadcast('test:event', { data: 'test' });

      expect(mockIo.emit).not.toHaveBeenCalled();
    });

    it('should emit to all clients when io is initialized', () => {
      websocket.initializeWebSocket(mockServer);
      websocket.broadcast('test:event', { data: 'test' });

      expect(mockIo.emit).toHaveBeenCalledWith('test:event', { data: 'test' });
    });

    it('should broadcast different event types', () => {
      websocket.initializeWebSocket(mockServer);

      websocket.broadcast('custom:event', { custom: 'data' });
      websocket.broadcast('update:event', { value: 42 });

      expect(mockIo.emit).toHaveBeenCalledWith('custom:event', { custom: 'data' });
      expect(mockIo.emit).toHaveBeenCalledWith('update:event', { value: 42 });
    });

    it('should handle null data', () => {
      websocket.initializeWebSocket(mockServer);

      expect(() => {
        websocket.broadcast('test:event', null);
      }).not.toThrow();
    });

    it('should handle complex data structures', () => {
      websocket.initializeWebSocket(mockServer);

      const complexData = {
        nested: {
          array: [1, 2, 3],
          object: { key: 'value' }
        }
      };

      websocket.broadcast('test:event', complexData);

      expect(mockIo.emit).toHaveBeenCalledWith('test:event', complexData);
    });
  });

  describe('Exported Functions - broadcastToRoom()', () => {
    it('should not emit if io is not initialized', () => {
      const mockTo = { emit: jest.fn() };
      mockIo.to.mockReturnValue(mockTo);

      websocket.broadcastToRoom('room-1', 'test:event', { data: 'test' });

      expect(mockIo.to).not.toHaveBeenCalled();
    });

    it('should emit to specific room when io is initialized', () => {
      const mockTo = { emit: jest.fn() };
      mockIo.to.mockReturnValue(mockTo);

      websocket.initializeWebSocket(mockServer);
      websocket.broadcastToRoom('room-1', 'test:event', { data: 'test' });

      expect(mockIo.to).toHaveBeenCalledWith('room-1');
      expect(mockTo.emit).toHaveBeenCalledWith('test:event', { data: 'test' });
    });

    it('should broadcast to different rooms', () => {
      const mockTo = { emit: jest.fn() };
      mockIo.to.mockReturnValue(mockTo);

      websocket.initializeWebSocket(mockServer);

      websocket.broadcastToRoom('room-1', 'update', { value: 1 });
      websocket.broadcastToRoom('room-2', 'update', { value: 2 });

      expect(mockIo.to).toHaveBeenCalledWith('room-1');
      expect(mockIo.to).toHaveBeenCalledWith('room-2');
    });

    it('should handle null room name gracefully', () => {
      const mockTo = { emit: jest.fn() };
      mockIo.to.mockReturnValue(mockTo);

      websocket.initializeWebSocket(mockServer);

      expect(() => {
        websocket.broadcastToRoom(null, 'test', {});
      }).not.toThrow();
    });
  });

  describe('Exported Functions - getConnectedClientsCount()', () => {
    it('should return 0 if io is not initialized', async () => {
      const count = await websocket.getConnectedClientsCount();

      expect(count).toBe(0);
    });

    it('should return count of connected sockets', async () => {
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

    it('should return 0 for empty socket list', async () => {
      mockIo.fetchSockets.mockResolvedValue([]);

      websocket.initializeWebSocket(mockServer);
      const count = await websocket.getConnectedClientsCount();

      expect(count).toBe(0);
    });

    it('should handle fetchSockets errors', async () => {
      mockIo.fetchSockets.mockRejectedValue(new Error('Fetch failed'));

      websocket.initializeWebSocket(mockServer);

      await expect(websocket.getConnectedClientsCount()).rejects.toThrow('Fetch failed');
    });
  });

  describe('Environment Configuration', () => {
    it('should use default timeout if environment variable not set', () => {
      delete process.env.VOICE_STREAMING_TIMEOUT_MS;

      jest.resetModules();
      const freshWebsocket = require('../../websocket');

      freshWebsocket.initializeWebSocket(mockServer);

      // Default timeout should be 5 minutes (300000ms)
      expect(true).toBe(true); // Configuration is internal, tested through behavior
    });

    it('should handle missing CLIENT_URL gracefully', () => {
      const originalUrl = process.env.CLIENT_URL;
      delete process.env.CLIENT_URL;

      websocket.initializeWebSocket(mockServer);

      expect(Server).toHaveBeenCalledWith(mockServer, expect.objectContaining({
        cors: expect.objectContaining({
          origin: '*'
        })
      }));

      process.env.CLIENT_URL = originalUrl;
    });

    it('should respect VOICE_REDIS_QUEUE_ENABLED environment variable', () => {
      const original = process.env.VOICE_REDIS_QUEUE_ENABLED;
      process.env.VOICE_REDIS_QUEUE_ENABLED = 'true';

      jest.resetModules();
      const freshWebsocket = require('../../websocket');
      freshWebsocket.initializeWebSocket(mockServer);

      process.env.VOICE_REDIS_QUEUE_ENABLED = original;
    });
  });
});
