import { useState, useCallback, useRef, useEffect } from 'react';
import { io } from 'socket.io-client';

const useExecutionSocket = (workflowId) => {
  const [status, setStatus] = useState('idle');
  const [currentStep, setCurrentStep] = useState(null);
  const [steps, setSteps] = useState([]);
  const [messages, setMessages] = useState([]);
  const [stats, setStats] = useState({
    totalDuration: 0,
    totalTokens: 0,
    totalCost: 0,
    successCount: 0,
    failureCount: 0,
    agentBreakdown: []
  });
  const [error, setError] = useState(null);

  const socketRef = useRef(null);
  const executionIdRef = useRef(null);

  const connect = useCallback((executionId) => {
    if (!executionId) {
      return;
    }

    executionIdRef.current = executionId;

    // Connect to Socket.IO server on backend port 5000
    const serverUrl = window.location.hostname === 'localhost'
      ? 'http://localhost:5000'
      : window.location.origin;

    try {
      socketRef.current = io(serverUrl, {
        path: '/ws',
        transports: ['websocket', 'polling']
      });

      socketRef.current.on('connect', () => {
        setError(null);
        // Join the execution room
        socketRef.current.emit('execution:join', executionId);
      });

      socketRef.current.on('execution:joined', () => {
        // Room joined successfully
      });

      // Handle step start
      socketRef.current.on('execution:stepStart', (data) => {
        handleMessage({ type: 'stepStart', ...data });
      });

      // Handle step progress
      socketRef.current.on('execution:stepProgress', (data) => {
        handleMessage({ type: 'stepProgress', ...data });
      });

      // Handle step complete
      socketRef.current.on('execution:stepComplete', (data) => {
        handleMessage({ type: 'stepComplete', ...data });
      });

      // Handle step failed
      socketRef.current.on('execution:stepFailed', (data) => {
        handleMessage({ type: 'stepFailed', ...data });
      });

      // Handle agent message
      socketRef.current.on('execution:agentMessage', (data) => {
        handleMessage({ type: 'agentMessage', ...data });
      });

      // Handle execution complete
      socketRef.current.on('execution:complete', (data) => {
        handleMessage({ type: 'executionComplete', ...data });
      });

      // Handle execution error
      socketRef.current.on('execution:error', (data) => {
        handleMessage({ type: 'executionFailed', ...data });
      });

      // Handle execution paused
      socketRef.current.on('execution:paused', (data) => {
        handleMessage({ type: 'executionPaused', ...data });
      });

      // Handle execution resumed
      socketRef.current.on('execution:resumed', (data) => {
        handleMessage({ type: 'executionResumed', ...data });
      });

      socketRef.current.on('connect_error', () => {
        setError('Connection error');
      });

      socketRef.current.on('disconnect', () => {
        // Socket disconnected
      });
    } catch (err) {
      setError('Failed to connect');
    }
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      if (executionIdRef.current) {
        socketRef.current.emit('execution:leave', executionIdRef.current);
      }
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  const handleMessage = useCallback((data) => {
    switch (data.type) {
      case 'stepStart':
        setCurrentStep({
          id: data.stepId,
          agentName: data.agentName,
          agentRole: data.agentRole,
          status: 'running',
          startTime: data.timestamp,
          input: data.input
        });
        setSteps((prev) => [
          ...prev,
          {
            id: data.stepId,
            agentName: data.agentName,
            agentRole: data.agentRole,
            status: 'running',
            startTime: data.timestamp
          }
        ]);
        break;

      case 'stepProgress':
        setCurrentStep((prev) => ({
          ...prev,
          partialOutput: data.output
        }));
        break;

      case 'stepComplete':
        setCurrentStep(null);
        setSteps((prev) =>
          prev.map((step) =>
            step.id === data.stepId
              ? {
                  ...step,
                  status: 'completed',
                  duration: data.duration,
                  tokens: data.tokens,
                  cost: data.cost,
                  output: data.output
                }
              : step
          )
        );
        setStats((prev) => ({
          ...prev,
          successCount: prev.successCount + 1,
          totalDuration: prev.totalDuration + (data.duration || 0),
          totalTokens: prev.totalTokens + (data.tokens || 0),
          totalCost: prev.totalCost + (data.cost || 0)
        }));
        break;

      case 'stepFailed':
        setCurrentStep(null);
        setSteps((prev) =>
          prev.map((step) =>
            step.id === data.stepId
              ? {
                  ...step,
                  status: 'failed',
                  duration: data.duration,
                  error: data.error
                }
              : step
          )
        );
        setStats((prev) => ({
          ...prev,
          failureCount: prev.failureCount + 1,
          totalDuration: prev.totalDuration + (data.duration || 0)
        }));
        break;

      case 'agentMessage':
        setMessages((prev) => [
          ...prev,
          {
            id: data.messageId || Date.now(),
            fromAgent: data.fromAgent,
            toAgent: data.toAgent,
            type: data.messageType,
            content: data.content,
            timestamp: data.timestamp
          }
        ]);
        break;

      case 'executionComplete':
        setStatus('completed');
        setStats((prev) => ({
          ...prev,
          totalDuration: data.totalDuration || prev.totalDuration,
          totalTokens: data.totalTokens || prev.totalTokens,
          totalCost: data.totalCost || prev.totalCost,
          agentBreakdown: data.agentBreakdown || prev.agentBreakdown
        }));
        disconnect();
        break;

      case 'executionFailed':
        setStatus('failed');
        setError(data.error);
        disconnect();
        break;

      case 'executionPaused':
        setStatus('paused');
        break;

      case 'executionResumed':
        setStatus('running');
        break;

      default:
        // Unknown message type
        break;
    }
  }, [disconnect]);

  const startExecution = useCallback(() => {
    setStatus('running');
    setSteps([]);
    setMessages([]);
    setStats({
      totalDuration: 0,
      totalTokens: 0,
      totalCost: 0,
      successCount: 0,
      failureCount: 0,
      agentBreakdown: []
    });
    setError(null);
  }, []);

  const pauseExecution = useCallback(() => {
    if (socketRef.current && socketRef.current.connected && executionIdRef.current) {
      socketRef.current.emit('execution:pause', executionIdRef.current);
    }
    setStatus('paused');
  }, []);

  const stopExecution = useCallback(() => {
    if (socketRef.current && socketRef.current.connected && executionIdRef.current) {
      socketRef.current.emit('execution:stop', executionIdRef.current);
    }
    setStatus('stopped');
    disconnect();
  }, [disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    status,
    currentStep,
    steps,
    messages,
    stats,
    error,
    connect,
    disconnect,
    startExecution,
    pauseExecution,
    stopExecution
  };
};

export default useExecutionSocket;
