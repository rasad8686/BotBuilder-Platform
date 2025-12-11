/**
 * ExecutionSocket Tests
 * Tests for server/websocket/executionSocket.js
 */

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const ExecutionSocket = require('../../websocket/executionSocket');

describe('ExecutionSocket', () => {
  let executionSocket;
  let mockIo;
  let mockSocket;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSocket = {
      id: 'socket-123',
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      on: jest.fn()
    };

    mockIo = {
      on: jest.fn(),
      to: jest.fn(() => ({ emit: jest.fn() })),
      emit: jest.fn()
    };

    executionSocket = new ExecutionSocket(mockIo);
  });

  describe('constructor', () => {
    it('should initialize with io instance', () => {
      expect(executionSocket.io).toBe(mockIo);
      expect(executionSocket.executionRooms).toBeInstanceOf(Map);
      expect(executionSocket.executionRooms.size).toBe(0);
    });
  });

  describe('initialize', () => {
    it('should set up connection handler', () => {
      executionSocket.initialize();

      expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('should register socket event handlers on connection', () => {
      let connectionHandler;
      mockIo.on.mockImplementation((event, handler) => {
        if (event === 'connection') {
          connectionHandler = handler;
        }
      });

      executionSocket.initialize();
      connectionHandler(mockSocket);

      expect(mockSocket.on).toHaveBeenCalledWith('execution:join', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('execution:leave', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('execution:pause', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('execution:stop', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });

    it('should handle execution:join event', () => {
      let connectionHandler;
      let joinHandler;

      mockIo.on.mockImplementation((event, handler) => {
        if (event === 'connection') connectionHandler = handler;
      });

      mockSocket.on.mockImplementation((event, handler) => {
        if (event === 'execution:join') joinHandler = handler;
      });

      executionSocket.initialize();
      connectionHandler(mockSocket);
      joinHandler('exec-123');

      expect(mockSocket.join).toHaveBeenCalledWith('execution:exec-123');
    });

    it('should handle execution:leave event', () => {
      let connectionHandler;
      let leaveHandler;

      mockIo.on.mockImplementation((event, handler) => {
        if (event === 'connection') connectionHandler = handler;
      });

      mockSocket.on.mockImplementation((event, handler) => {
        if (event === 'execution:leave') leaveHandler = handler;
      });

      executionSocket.initialize();
      connectionHandler(mockSocket);

      // First join
      executionSocket.joinExecution(mockSocket, 'exec-123');
      // Then leave
      leaveHandler('exec-123');

      expect(mockSocket.leave).toHaveBeenCalledWith('execution:exec-123');
    });

    it('should handle execution:pause event', () => {
      let connectionHandler;
      let pauseHandler;

      mockIo.on.mockImplementation((event, handler) => {
        if (event === 'connection') connectionHandler = handler;
      });

      mockSocket.on.mockImplementation((event, handler) => {
        if (event === 'execution:pause') pauseHandler = handler;
      });

      executionSocket.initialize();
      connectionHandler(mockSocket);
      pauseHandler('exec-123');

      expect(mockIo.emit).toHaveBeenCalledWith('execution:exec-123:pause');
    });

    it('should handle execution:stop event', () => {
      let connectionHandler;
      let stopHandler;

      mockIo.on.mockImplementation((event, handler) => {
        if (event === 'connection') connectionHandler = handler;
      });

      mockSocket.on.mockImplementation((event, handler) => {
        if (event === 'execution:stop') stopHandler = handler;
      });

      executionSocket.initialize();
      connectionHandler(mockSocket);
      stopHandler('exec-123');

      expect(mockIo.emit).toHaveBeenCalledWith('execution:exec-123:stop');
    });

    it('should handle disconnect event', () => {
      let connectionHandler;
      let disconnectHandler;

      mockIo.on.mockImplementation((event, handler) => {
        if (event === 'connection') connectionHandler = handler;
      });

      mockSocket.on.mockImplementation((event, handler) => {
        if (event === 'disconnect') disconnectHandler = handler;
      });

      executionSocket.initialize();
      connectionHandler(mockSocket);

      // First join an execution
      executionSocket.joinExecution(mockSocket, 'exec-123');
      expect(executionSocket.getConnectedClients('exec-123')).toBe(1);

      // Then disconnect
      disconnectHandler();

      expect(executionSocket.getConnectedClients('exec-123')).toBe(0);
    });
  });

  describe('joinExecution', () => {
    it('should join socket to execution room', () => {
      executionSocket.joinExecution(mockSocket, 'exec-123');

      expect(mockSocket.join).toHaveBeenCalledWith('execution:exec-123');
      expect(mockSocket.emit).toHaveBeenCalledWith('execution:joined', {
        executionId: 'exec-123',
        room: 'execution:exec-123'
      });
    });

    it('should add socket to executionRooms', () => {
      executionSocket.joinExecution(mockSocket, 'exec-123');

      expect(executionSocket.executionRooms.has('exec-123')).toBe(true);
      expect(executionSocket.executionRooms.get('exec-123').has('socket-123')).toBe(true);
    });

    it('should handle multiple sockets joining same execution', () => {
      const socket2 = { ...mockSocket, id: 'socket-456', join: jest.fn(), emit: jest.fn() };

      executionSocket.joinExecution(mockSocket, 'exec-123');
      executionSocket.joinExecution(socket2, 'exec-123');

      expect(executionSocket.executionRooms.get('exec-123').size).toBe(2);
    });
  });

  describe('leaveExecution', () => {
    it('should leave socket from execution room', () => {
      executionSocket.joinExecution(mockSocket, 'exec-123');
      executionSocket.leaveExecution(mockSocket, 'exec-123');

      expect(mockSocket.leave).toHaveBeenCalledWith('execution:exec-123');
    });

    it('should remove socket from executionRooms', () => {
      executionSocket.joinExecution(mockSocket, 'exec-123');
      executionSocket.leaveExecution(mockSocket, 'exec-123');

      expect(executionSocket.executionRooms.has('exec-123')).toBe(false);
    });

    it('should not remove room if other sockets remain', () => {
      const socket2 = { ...mockSocket, id: 'socket-456', join: jest.fn(), emit: jest.fn() };

      executionSocket.joinExecution(mockSocket, 'exec-123');
      executionSocket.joinExecution(socket2, 'exec-123');
      executionSocket.leaveExecution(mockSocket, 'exec-123');

      expect(executionSocket.executionRooms.has('exec-123')).toBe(true);
      expect(executionSocket.executionRooms.get('exec-123').size).toBe(1);
    });

    it('should handle leave without join', () => {
      expect(() => {
        executionSocket.leaveExecution(mockSocket, 'non-existent');
      }).not.toThrow();
    });
  });

  describe('handleDisconnect', () => {
    it('should remove socket from all execution rooms', () => {
      executionSocket.joinExecution(mockSocket, 'exec-1');
      executionSocket.joinExecution(mockSocket, 'exec-2');

      executionSocket.handleDisconnect(mockSocket);

      expect(executionSocket.executionRooms.has('exec-1')).toBe(false);
      expect(executionSocket.executionRooms.has('exec-2')).toBe(false);
    });

    it('should not affect other sockets', () => {
      const socket2 = { ...mockSocket, id: 'socket-456', join: jest.fn(), emit: jest.fn() };

      executionSocket.joinExecution(mockSocket, 'exec-123');
      executionSocket.joinExecution(socket2, 'exec-123');

      executionSocket.handleDisconnect(mockSocket);

      expect(executionSocket.executionRooms.get('exec-123').has('socket-456')).toBe(true);
      expect(executionSocket.executionRooms.get('exec-123').has('socket-123')).toBe(false);
    });
  });

  describe('handlePause', () => {
    it('should emit pause event', () => {
      executionSocket.handlePause('exec-123');

      expect(mockIo.emit).toHaveBeenCalledWith('execution:exec-123:pause');
    });
  });

  describe('handleStop', () => {
    it('should emit stop event', () => {
      executionSocket.handleStop('exec-123');

      expect(mockIo.emit).toHaveBeenCalledWith('execution:exec-123:stop');
    });
  });

  describe('broadcastToExecution', () => {
    it('should broadcast to execution room', () => {
      const mockEmit = jest.fn();
      mockIo.to.mockReturnValue({ emit: mockEmit });

      executionSocket.broadcastToExecution('exec-123', 'test:event', { data: 'test' });

      expect(mockIo.to).toHaveBeenCalledWith('execution:exec-123');
      expect(mockEmit).toHaveBeenCalledWith('test:event', expect.objectContaining({
        data: 'test',
        executionId: 'exec-123',
        timestamp: expect.any(String)
      }));
    });
  });

  describe('emitExecutionStart', () => {
    it('should emit execution start event', () => {
      const mockEmit = jest.fn();
      mockIo.to.mockReturnValue({ emit: mockEmit });

      executionSocket.emitExecutionStart('exec-123', {
        workflowId: 'wf-1',
        workflowName: 'Test Workflow',
        input: { test: true }
      });

      expect(mockEmit).toHaveBeenCalledWith('execution:start', expect.objectContaining({
        type: 'executionStart',
        workflowId: 'wf-1',
        workflowName: 'Test Workflow',
        input: { test: true }
      }));
    });
  });

  describe('emitStepStart', () => {
    it('should emit step start event', () => {
      const mockEmit = jest.fn();
      mockIo.to.mockReturnValue({ emit: mockEmit });

      executionSocket.emitStepStart('exec-123', {
        stepId: 'step-1',
        agentId: 'agent-1',
        agentName: 'Test Agent',
        agentRole: 'assistant',
        input: { prompt: 'test' },
        order: 1
      });

      expect(mockEmit).toHaveBeenCalledWith('execution:stepStart', expect.objectContaining({
        type: 'stepStart',
        stepId: 'step-1',
        agentId: 'agent-1',
        agentName: 'Test Agent',
        agentRole: 'assistant'
      }));
    });
  });

  describe('emitStepProgress', () => {
    it('should emit step progress event', () => {
      const mockEmit = jest.fn();
      mockIo.to.mockReturnValue({ emit: mockEmit });

      executionSocket.emitStepProgress('exec-123', {
        stepId: 'step-1',
        output: 'partial output'
      });

      expect(mockEmit).toHaveBeenCalledWith('execution:stepProgress', expect.objectContaining({
        type: 'stepProgress',
        stepId: 'step-1',
        output: 'partial output'
      }));
    });
  });

  describe('emitStepComplete', () => {
    it('should emit step complete event', () => {
      const mockEmit = jest.fn();
      mockIo.to.mockReturnValue({ emit: mockEmit });

      executionSocket.emitStepComplete('exec-123', {
        stepId: 'step-1',
        agentId: 'agent-1',
        agentName: 'Test Agent',
        output: 'complete output',
        duration: 1000,
        tokens: 100,
        cost: 0.01
      });

      expect(mockEmit).toHaveBeenCalledWith('execution:stepComplete', expect.objectContaining({
        type: 'stepComplete',
        stepId: 'step-1',
        duration: 1000,
        tokens: 100,
        cost: 0.01
      }));
    });
  });

  describe('emitStepFailed', () => {
    it('should emit step failed event', () => {
      const mockEmit = jest.fn();
      mockIo.to.mockReturnValue({ emit: mockEmit });

      executionSocket.emitStepFailed('exec-123', {
        stepId: 'step-1',
        agentId: 'agent-1',
        agentName: 'Test Agent',
        error: 'Test error',
        duration: 500
      });

      expect(mockEmit).toHaveBeenCalledWith('execution:stepFailed', expect.objectContaining({
        type: 'stepFailed',
        stepId: 'step-1',
        error: 'Test error'
      }));
    });
  });

  describe('emitAgentMessage', () => {
    it('should emit agent message event', () => {
      const mockEmit = jest.fn();
      mockIo.to.mockReturnValue({ emit: mockEmit });

      executionSocket.emitAgentMessage('exec-123', {
        messageId: 'msg-1',
        fromAgent: 'agent-1',
        toAgent: 'agent-2',
        messageType: 'request',
        content: 'Hello'
      });

      expect(mockEmit).toHaveBeenCalledWith('execution:agentMessage', expect.objectContaining({
        type: 'agentMessage',
        fromAgent: 'agent-1',
        toAgent: 'agent-2',
        messageType: 'request'
      }));
    });
  });

  describe('emitExecutionComplete', () => {
    it('should emit execution complete event', () => {
      const mockEmit = jest.fn();
      mockIo.to.mockReturnValue({ emit: mockEmit });

      executionSocket.emitExecutionComplete('exec-123', {
        output: 'final output',
        totalDuration: 5000,
        totalTokens: 1000,
        totalCost: 0.10,
        agentBreakdown: [{ agentId: 'agent-1', tokens: 500 }]
      });

      expect(mockEmit).toHaveBeenCalledWith('execution:complete', expect.objectContaining({
        type: 'executionComplete',
        status: 'completed',
        totalDuration: 5000
      }));
    });
  });

  describe('emitExecutionError', () => {
    it('should emit execution error event', () => {
      const mockEmit = jest.fn();
      mockIo.to.mockReturnValue({ emit: mockEmit });

      executionSocket.emitExecutionError('exec-123', {
        error: 'Fatal error',
        stepId: 'step-1',
        agentId: 'agent-1'
      });

      expect(mockEmit).toHaveBeenCalledWith('execution:error', expect.objectContaining({
        type: 'executionFailed',
        status: 'failed',
        error: 'Fatal error'
      }));
    });
  });

  describe('emitExecutionPaused', () => {
    it('should emit execution paused event', () => {
      const mockEmit = jest.fn();
      mockIo.to.mockReturnValue({ emit: mockEmit });

      executionSocket.emitExecutionPaused('exec-123');

      expect(mockEmit).toHaveBeenCalledWith('execution:paused', expect.objectContaining({
        type: 'executionPaused',
        status: 'paused'
      }));
    });
  });

  describe('emitExecutionResumed', () => {
    it('should emit execution resumed event', () => {
      const mockEmit = jest.fn();
      mockIo.to.mockReturnValue({ emit: mockEmit });

      executionSocket.emitExecutionResumed('exec-123');

      expect(mockEmit).toHaveBeenCalledWith('execution:resumed', expect.objectContaining({
        type: 'executionResumed',
        status: 'running'
      }));
    });
  });

  describe('sendStepUpdate', () => {
    it('should call emitStepStart for start status', () => {
      const spy = jest.spyOn(executionSocket, 'emitStepStart');

      executionSocket.sendStepUpdate('exec-123', 'step-1', 'start', {
        agentId: 'agent-1'
      });

      expect(spy).toHaveBeenCalledWith('exec-123', expect.objectContaining({
        stepId: 'step-1',
        agentId: 'agent-1'
      }));
    });

    it('should call emitStepProgress for progress status', () => {
      const spy = jest.spyOn(executionSocket, 'emitStepProgress');

      executionSocket.sendStepUpdate('exec-123', 'step-1', 'progress', {
        output: 'partial'
      });

      expect(spy).toHaveBeenCalled();
    });

    it('should call emitStepComplete for complete status', () => {
      const spy = jest.spyOn(executionSocket, 'emitStepComplete');

      executionSocket.sendStepUpdate('exec-123', 'step-1', 'complete', {
        output: 'done'
      });

      expect(spy).toHaveBeenCalled();
    });

    it('should call emitStepFailed for failed status', () => {
      const spy = jest.spyOn(executionSocket, 'emitStepFailed');

      executionSocket.sendStepUpdate('exec-123', 'step-1', 'failed', {
        error: 'error'
      });

      expect(spy).toHaveBeenCalled();
    });

    it('should do nothing for unknown status', () => {
      expect(() => {
        executionSocket.sendStepUpdate('exec-123', 'step-1', 'unknown', {});
      }).not.toThrow();
    });
  });

  describe('sendMessage', () => {
    it('should emit agent message with generated messageId', () => {
      const spy = jest.spyOn(executionSocket, 'emitAgentMessage');

      executionSocket.sendMessage('exec-123', 'agent-1', 'agent-2', 'request', 'Hello');

      expect(spy).toHaveBeenCalledWith('exec-123', expect.objectContaining({
        messageId: expect.stringMatching(/^msg-\d+$/),
        fromAgent: 'agent-1',
        toAgent: 'agent-2',
        messageType: 'request',
        content: 'Hello'
      }));
    });
  });

  describe('getConnectedClients', () => {
    it('should return 0 for non-existent execution', () => {
      expect(executionSocket.getConnectedClients('non-existent')).toBe(0);
    });

    it('should return correct count', () => {
      const socket2 = { ...mockSocket, id: 'socket-456', join: jest.fn(), emit: jest.fn() };

      executionSocket.joinExecution(mockSocket, 'exec-123');
      executionSocket.joinExecution(socket2, 'exec-123');

      expect(executionSocket.getConnectedClients('exec-123')).toBe(2);
    });
  });

  describe('hasConnectedClients', () => {
    it('should return false for non-existent execution', () => {
      expect(executionSocket.hasConnectedClients('non-existent')).toBe(false);
    });

    it('should return true when clients are connected', () => {
      executionSocket.joinExecution(mockSocket, 'exec-123');

      expect(executionSocket.hasConnectedClients('exec-123')).toBe(true);
    });

    it('should return false after all clients leave', () => {
      executionSocket.joinExecution(mockSocket, 'exec-123');
      executionSocket.leaveExecution(mockSocket, 'exec-123');

      expect(executionSocket.hasConnectedClients('exec-123')).toBe(false);
    });
  });
});
