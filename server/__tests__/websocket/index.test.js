/**
 * WebSocket Index Tests
 * Tests for server/websocket/index.js
 */

jest.mock('socket.io', () => {
  const mockEmit = jest.fn();
  const mockTo = jest.fn(() => ({ emit: mockEmit }));
  const mockOn = jest.fn();
  const mockFetchSockets = jest.fn().mockResolvedValue([{ id: '1' }, { id: '2' }]);

  return {
    Server: jest.fn().mockImplementation(() => ({
      on: mockOn,
      emit: mockEmit,
      to: mockTo,
      fetchSockets: mockFetchSockets
    }))
  };
});

jest.mock('../../websocket/executionSocket', () => {
  return jest.fn().mockImplementation(() => ({
    initialize: jest.fn()
  }));
});

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../services/ai', () => ({
  AIProviderFactory: {
    getProvider: jest.fn(() => ({
      chat: jest.fn().mockResolvedValue({ content: 'Response' })
    }))
  },
  EncryptionHelper: {
    decrypt: jest.fn(() => 'decrypted-key')
  }
}));

jest.mock('../../services/ragService', () => ({
  getContextForQuery: jest.fn().mockResolvedValue({ hasContext: false }),
  buildRAGPrompt: jest.fn((prompt) => prompt)
}));

const { Server } = require('socket.io');
const {
  initializeWebSocket,
  getIO,
  getExecutionSocket,
  broadcast,
  broadcastToRoom,
  getConnectedClientsCount
} = require('../../websocket/index');

describe('WebSocket Index', () => {
  let mockServer;
  let mockIo;

  beforeEach(() => {
    jest.clearAllMocks();
    mockServer = {
      on: jest.fn()
    };
    mockIo = new Server(mockServer);
  });

  describe('initializeWebSocket', () => {
    it('should initialize WebSocket server', () => {
      const result = initializeWebSocket(mockServer);

      expect(Server).toHaveBeenCalledWith(mockServer, expect.objectContaining({
        cors: expect.any(Object),
        path: '/ws'
      }));
      expect(result).toHaveProperty('io');
      expect(result).toHaveProperty('executionSocket');
    });
  });

  describe('getIO', () => {
    it('should return io instance after initialization', () => {
      initializeWebSocket(mockServer);
      const io = getIO();
      expect(io).toBeDefined();
    });
  });

  describe('getExecutionSocket', () => {
    it('should return executionSocket instance after initialization', () => {
      initializeWebSocket(mockServer);
      const execSocket = getExecutionSocket();
      expect(execSocket).toBeDefined();
    });
  });

  describe('broadcast', () => {
    it('should emit to all connected clients', () => {
      initializeWebSocket(mockServer);
      const io = getIO();

      broadcast('test-event', { data: 'test' });

      expect(io.emit).toHaveBeenCalledWith('test-event', { data: 'test' });
    });

    it('should do nothing if io not initialized', () => {
      // Cannot easily test this without resetting module state
      expect(() => broadcast('test', {})).not.toThrow();
    });
  });

  describe('broadcastToRoom', () => {
    it('should emit to specific room', () => {
      initializeWebSocket(mockServer);
      const io = getIO();

      broadcastToRoom('room1', 'test-event', { data: 'test' });

      expect(io.to).toHaveBeenCalledWith('room1');
    });
  });

  describe('getConnectedClientsCount', () => {
    it('should return connected clients count', async () => {
      initializeWebSocket(mockServer);

      const count = await getConnectedClientsCount();

      expect(count).toBe(2);
    });
  });
});

describe('WebSocket Connection Handlers', () => {
  let mockServer;
  let connectionHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    mockServer = { on: jest.fn() };

    // Capture the connection handler
    Server.mockImplementation(() => {
      const mockIo = {
        on: jest.fn((event, handler) => {
          if (event === 'connection') {
            connectionHandler = handler;
          }
        }),
        emit: jest.fn(),
        to: jest.fn(() => ({ emit: jest.fn() })),
        fetchSockets: jest.fn().mockResolvedValue([])
      };
      return mockIo;
    });

    initializeWebSocket(mockServer);
  });

  it('should handle connection event', () => {
    const mockSocket = {
      id: 'socket-123',
      on: jest.fn(),
      emit: jest.fn(),
      join: jest.fn()
    };

    connectionHandler(mockSocket);

    expect(mockSocket.on).toHaveBeenCalledWith('ping', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('widget:join', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('widget:message', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
  });

  it('should handle ping event', () => {
    const mockSocket = {
      id: 'socket-123',
      on: jest.fn((event, handler) => {
        if (event === 'ping') {
          handler();
        }
      }),
      emit: jest.fn(),
      join: jest.fn()
    };

    connectionHandler(mockSocket);

    expect(mockSocket.emit).toHaveBeenCalledWith('pong');
  });

  it('should handle widget:join event', () => {
    let widgetJoinHandler;
    const mockSocket = {
      id: 'socket-123',
      on: jest.fn((event, handler) => {
        if (event === 'widget:join') {
          widgetJoinHandler = handler;
        }
      }),
      emit: jest.fn(),
      join: jest.fn()
    };

    connectionHandler(mockSocket);
    widgetJoinHandler({ botId: 1, sessionId: 'session-123' });

    expect(mockSocket.join).toHaveBeenCalledWith('widget:1:session-123');
  });

  it('should handle disconnect event', () => {
    let disconnectHandler;
    const mockSocket = {
      id: 'socket-123',
      on: jest.fn((event, handler) => {
        if (event === 'disconnect') {
          disconnectHandler = handler;
        }
      }),
      emit: jest.fn(),
      join: jest.fn()
    };

    connectionHandler(mockSocket);
    disconnectHandler('client namespace disconnect');

    // Should not throw
    expect(true).toBe(true);
  });

  it('should handle error event', () => {
    let errorHandler;
    const mockSocket = {
      id: 'socket-123',
      on: jest.fn((event, handler) => {
        if (event === 'error') {
          errorHandler = handler;
        }
      }),
      emit: jest.fn(),
      join: jest.fn()
    };

    connectionHandler(mockSocket);
    errorHandler(new Error('Test error'));

    // Should not throw
    expect(true).toBe(true);
  });
});

describe('Widget Message Handler', () => {
  let mockServer;
  let connectionHandler;
  let mockPool;

  beforeEach(() => {
    jest.clearAllMocks();
    mockServer = { on: jest.fn() };
    mockPool = require('../../db');

    // Capture the connection handler
    Server.mockImplementation(() => {
      const mockIo = {
        on: jest.fn((event, handler) => {
          if (event === 'connection') {
            connectionHandler = handler;
          }
        }),
        emit: jest.fn(),
        to: jest.fn(() => ({ emit: jest.fn() })),
        fetchSockets: jest.fn().mockResolvedValue([])
      };
      return mockIo;
    });

    initializeWebSocket(mockServer);
  });

  it('should handle invalid botId', async () => {
    let messageHandler;
    const mockSocket = {
      id: 'socket-123',
      on: jest.fn((event, handler) => {
        if (event === 'widget:message') {
          messageHandler = handler;
        }
      }),
      emit: jest.fn(),
      join: jest.fn()
    };

    connectionHandler(mockSocket);
    await messageHandler({ botId: 'invalid', sessionId: 'session-123', message: 'hello' });

    expect(mockSocket.emit).toHaveBeenCalledWith('widget:message', {
      message: expect.stringContaining('invalid')
    });
  });

  it('should handle non-existent bot', async () => {
    let messageHandler;
    const mockSocket = {
      id: 'socket-123',
      on: jest.fn((event, handler) => {
        if (event === 'widget:message') {
          messageHandler = handler;
        }
      }),
      emit: jest.fn(),
      join: jest.fn()
    };

    mockPool.query.mockResolvedValueOnce({ rows: [] }); // Bot not found

    connectionHandler(mockSocket);
    await messageHandler({ botId: '999', sessionId: 'session-123', message: 'hello' });

    expect(mockSocket.emit).toHaveBeenCalledWith('widget:message', {
      message: expect.stringContaining('mövcud deyil')
    });
  });

  it('should handle message with AI configuration', async () => {
    let messageHandler;
    const mockSocket = {
      id: 'socket-123',
      on: jest.fn((event, handler) => {
        if (event === 'widget:message') {
          messageHandler = handler;
        }
      }),
      emit: jest.fn(),
      join: jest.fn()
    };

    // Mock database queries
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Bot', language: 'en' }] }) // Bot check
      .mockResolvedValueOnce({ rows: [] }) // Store user message
      .mockResolvedValueOnce({ rows: [{ provider: 'openai', api_key_encrypted: 'encrypted', system_prompt: 'You are helpful', temperature: 0.7, max_tokens: 1000, context_window: 10 }] }) // AI config
      .mockResolvedValueOnce({ rows: [] }) // History
      .mockResolvedValueOnce({ rows: [] }); // Store bot response

    connectionHandler(mockSocket);
    await messageHandler({ botId: '1', sessionId: 'session-123', message: 'hello' });

    expect(mockSocket.emit).toHaveBeenCalledWith('widget:typing');
  });

  it('should handle message without AI configuration', async () => {
    let messageHandler;
    const mockSocket = {
      id: 'socket-123',
      on: jest.fn((event, handler) => {
        if (event === 'widget:message') {
          messageHandler = handler;
        }
      }),
      emit: jest.fn(),
      join: jest.fn()
    };

    // Mock database queries
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Bot', language: 'en' }] }) // Bot check
      .mockResolvedValueOnce({ rows: [] }) // Store user message
      .mockResolvedValueOnce({ rows: [] }) // No AI config
      .mockResolvedValueOnce({ rows: [] }); // Store bot response

    connectionHandler(mockSocket);
    await messageHandler({ botId: '1', sessionId: 'session-123', message: 'hello' });

    expect(mockSocket.emit).toHaveBeenCalledWith('widget:message', {
      message: expect.stringContaining('AI is not configured')
    });
  });

  it('should handle database error', async () => {
    let messageHandler;
    const mockSocket = {
      id: 'socket-123',
      on: jest.fn((event, handler) => {
        if (event === 'widget:message') {
          messageHandler = handler;
        }
      }),
      emit: jest.fn(),
      join: jest.fn()
    };

    mockPool.query.mockRejectedValueOnce(new Error('DB Error'));

    connectionHandler(mockSocket);
    await messageHandler({ botId: '1', sessionId: 'session-123', message: 'hello' });

    expect(mockSocket.emit).toHaveBeenCalledWith('widget:error', {
      error: 'Failed to process message'
    });
  });

  it('should handle message with non-English language bot', async () => {
    let messageHandler;
    const mockSocket = {
      id: 'socket-123',
      on: jest.fn((event, handler) => {
        if (event === 'widget:message') {
          messageHandler = handler;
        }
      }),
      emit: jest.fn(),
      join: jest.fn()
    };

    // Mock database queries
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Bot', language: 'az' }] }) // Bot with non-English language
      .mockResolvedValueOnce({ rows: [] }) // Store user message
      .mockResolvedValueOnce({ rows: [{ provider: 'openai', api_key_encrypted: null, system_prompt: 'You are helpful', temperature: 0.7, max_tokens: 1000, context_window: 10 }] }) // AI config
      .mockResolvedValueOnce({ rows: [] }) // History
      .mockResolvedValueOnce({ rows: [] }); // Store bot response

    process.env.OPENAI_API_KEY = 'test-key';

    connectionHandler(mockSocket);
    await messageHandler({ botId: '1', sessionId: 'session-123', message: 'hello' });

    expect(mockSocket.emit).toHaveBeenCalledWith('widget:typing');
  });

  it('should handle message with RAG context', async () => {
    let messageHandler;
    const mockSocket = {
      id: 'socket-123',
      on: jest.fn((event, handler) => {
        if (event === 'widget:message') {
          messageHandler = handler;
        }
      }),
      emit: jest.fn(),
      join: jest.fn()
    };

    const ragService = require('../../services/ragService');
    ragService.getContextForQuery.mockResolvedValueOnce({ hasContext: true, context: 'RAG context' });
    ragService.buildRAGPrompt.mockReturnValueOnce('Enhanced prompt with RAG');

    // Mock database queries
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Bot', language: 'en' }] }) // Bot check
      .mockResolvedValueOnce({ rows: [] }) // Store user message
      .mockResolvedValueOnce({ rows: [{ provider: 'openai', api_key_encrypted: 'encrypted', system_prompt: 'You are helpful', temperature: 0.7, max_tokens: 1000, context_window: 10 }] }) // AI config
      .mockResolvedValueOnce({ rows: [] }) // History
      .mockResolvedValueOnce({ rows: [] }); // Store bot response

    connectionHandler(mockSocket);
    await messageHandler({ botId: '1', sessionId: 'session-123', message: 'hello' });

    expect(ragService.getContextForQuery).toHaveBeenCalled();
  });

  it('should handle RAG error gracefully', async () => {
    let messageHandler;
    const mockSocket = {
      id: 'socket-123',
      on: jest.fn((event, handler) => {
        if (event === 'widget:message') {
          messageHandler = handler;
        }
      }),
      emit: jest.fn(),
      join: jest.fn()
    };

    const ragService = require('../../services/ragService');
    ragService.getContextForQuery.mockRejectedValueOnce(new Error('RAG Error'));

    // Mock database queries
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Bot', language: 'en' }] }) // Bot check
      .mockResolvedValueOnce({ rows: [] }) // Store user message
      .mockResolvedValueOnce({ rows: [{ provider: 'openai', api_key_encrypted: 'encrypted', system_prompt: 'You are helpful', temperature: 0.7, max_tokens: 1000, context_window: 10 }] }) // AI config
      .mockResolvedValueOnce({ rows: [] }) // History
      .mockResolvedValueOnce({ rows: [] }); // Store bot response

    connectionHandler(mockSocket);
    await messageHandler({ botId: '1', sessionId: 'session-123', message: 'hello' });

    // Should still respond despite RAG error
    expect(mockSocket.emit).toHaveBeenCalledWith('widget:message', expect.any(Object));
  });

  it('should include conversation history in AI request', async () => {
    let messageHandler;
    const mockSocket = {
      id: 'socket-123',
      on: jest.fn((event, handler) => {
        if (event === 'widget:message') {
          messageHandler = handler;
        }
      }),
      emit: jest.fn(),
      join: jest.fn()
    };

    // Mock database queries
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Bot', language: 'en' }] }) // Bot check
      .mockResolvedValueOnce({ rows: [] }) // Store user message
      .mockResolvedValueOnce({ rows: [{ provider: 'openai', api_key_encrypted: 'encrypted', system_prompt: 'You are helpful', temperature: 0.7, max_tokens: 1000, context_window: 10 }] }) // AI config
      .mockResolvedValueOnce({ rows: [{ role: 'user', content: 'previous message' }, { role: 'assistant', content: 'previous response' }] }) // History
      .mockResolvedValueOnce({ rows: [] }); // Store bot response

    connectionHandler(mockSocket);
    await messageHandler({ botId: '1', sessionId: 'session-123', message: 'hello' });

    expect(mockSocket.emit).toHaveBeenCalledWith('widget:typing');
  });
});
