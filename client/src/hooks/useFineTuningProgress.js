/**
 * useFineTuningProgress Hook
 *
 * React hook for real-time fine-tuning training progress updates.
 * Supports both WebSocket and SSE (Server-Sent Events) connections.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * Hook for tracking fine-tuning progress in real-time
 *
 * @param {string} jobId - OpenAI job ID
 * @param {Object} options - Configuration options
 * @param {boolean} options.useSSE - Use SSE instead of WebSocket (default: false)
 * @param {boolean} options.autoConnect - Auto-connect on mount (default: true)
 * @param {Function} options.onProgress - Callback for progress updates
 * @param {Function} options.onComplete - Callback when training completes
 * @param {Function} options.onError - Callback for errors
 * @param {Function} options.onStatusChange - Callback for status changes
 * @returns {Object} - Progress state and control functions
 */
export function useFineTuningProgress(jobId, options = {}) {
  const {
    useSSE = false,
    autoConnect = true,
    onProgress,
    onComplete,
    onError,
    onStatusChange
  } = options;

  // State
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [trainedTokens, setTrainedTokens] = useState(0);
  const [estimatedTotalTokens, setEstimatedTotalTokens] = useState(0);
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [totalEpochs, setTotalEpochs] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [metrics, setMetrics] = useState({});
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [fineTunedModel, setFineTunedModel] = useState(null);

  // Refs
  const socketRef = useRef(null);
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Connect via WebSocket
  const connectWebSocket = useCallback(() => {
    if (!jobId) return;

    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      timeout: 10000
    });

    socket.on('connect', () => {
      setIsConnected(true);
      setError(null);
      // Join the training room
      socket.emit('training:join', { jobId });
    });

    socket.on('training:joined', (data) => {
      console.log('Joined training room:', data.room);
    });

    socket.on('training:progress', (data) => {
      if (data.jobId === jobId) {
        setProgress(data.progress || 0);
        setTrainedTokens(data.trainedTokens || 0);
        setEstimatedTotalTokens(data.estimatedTotalTokens || 0);
        setStatus(data.status || status);
        onProgress?.(data);
      }
    });

    socket.on('training:status', (data) => {
      if (data.jobId === jobId) {
        setStatus(data.status);
        onStatusChange?.(data.status, data.previousStatus);
      }
    });

    socket.on('training:started', (data) => {
      if (data.jobId === jobId) {
        setStatus('running');
        onStatusChange?.('running', 'pending');
      }
    });

    socket.on('training:epoch', (data) => {
      if (data.jobId === jobId) {
        setCurrentEpoch(data.currentEpoch);
        setTotalEpochs(data.totalEpochs);
        setProgress(data.progress || 0);
        if (data.metrics) {
          setMetrics(prev => ({ ...prev, ...data.metrics }));
        }
      }
    });

    socket.on('training:step', (data) => {
      if (data.jobId === jobId) {
        setCurrentStep(data.step);
        setTotalSteps(data.totalSteps);
        if (data.metrics) {
          setMetrics(prev => ({ ...prev, ...data.metrics }));
        }
      }
    });

    socket.on('training:metrics', (data) => {
      if (data.jobId === jobId) {
        setMetrics(prev => ({ ...prev, ...data.metrics }));
      }
    });

    socket.on('training:validating', (data) => {
      if (data.jobId === jobId) {
        setStatus('validating');
        onStatusChange?.('validating', status);
      }
    });

    socket.on('training:complete', (data) => {
      if (data.jobId === jobId) {
        setStatus('succeeded');
        setProgress(100);
        setFineTunedModel(data.fineTunedModel);
        onComplete?.(data);
      }
    });

    socket.on('training:error', (data) => {
      if (data.jobId === jobId) {
        setStatus('failed');
        setError(data.message || 'Training failed');
        onError?.(data);
      }
    });

    socket.on('training:cancelled', (data) => {
      if (data.jobId === jobId) {
        setStatus('cancelled');
        onStatusChange?.('cancelled', status);
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      // Attempt reconnection after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        if (socketRef.current) {
          socketRef.current.connect();
        }
      }, 3000);
    });

    socket.on('connect_error', (err) => {
      setError(`Connection error: ${err.message}`);
      setIsConnected(false);
    });

    socketRef.current = socket;

    return socket;
  }, [jobId, onProgress, onComplete, onError, onStatusChange, status]);

  // Connect via SSE
  const connectSSE = useCallback(() => {
    if (!jobId) return;

    const eventSource = new EventSource(`${API_URL}/api/fine-tuning/${jobId}/stream`, {
      withCredentials: true
    });

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    eventSource.addEventListener('connected', (event) => {
      const data = JSON.parse(event.data);
      console.log('SSE Connected:', data.message);
    });

    eventSource.addEventListener('status', (event) => {
      const data = JSON.parse(event.data);
      setStatus(data.status);
      onStatusChange?.(data.status, data.previousStatus);
    });

    eventSource.addEventListener('progress', (event) => {
      const data = JSON.parse(event.data);
      setProgress(data.progress || 0);
      setTrainedTokens(data.trainedTokens || 0);
      setEstimatedTotalTokens(data.estimatedTotalTokens || 0);
      onProgress?.(data);
    });

    eventSource.addEventListener('metrics', (event) => {
      const data = JSON.parse(event.data);
      setMetrics(prev => ({ ...prev, ...data.metrics }));
    });

    eventSource.addEventListener('succeeded', (event) => {
      const data = JSON.parse(event.data);
      setStatus('succeeded');
      setProgress(100);
      setFineTunedModel(data.fineTunedModel);
      onComplete?.(data);
      eventSource.close();
    });

    eventSource.addEventListener('failed', (event) => {
      const data = JSON.parse(event.data);
      setStatus('failed');
      setError(data.error?.message || 'Training failed');
      onError?.(data);
      eventSource.close();
    });

    eventSource.addEventListener('cancelled', (event) => {
      const data = JSON.parse(event.data);
      setStatus('cancelled');
      onStatusChange?.('cancelled', status);
      eventSource.close();
    });

    eventSource.addEventListener('error', (event) => {
      if (event.data) {
        const data = JSON.parse(event.data);
        if (!data.temporary) {
          setError(data.error);
        }
      }
    });

    eventSource.onerror = (err) => {
      setIsConnected(false);
      // SSE will auto-reconnect, but we can set error state
      console.error('SSE error:', err);
    };

    eventSourceRef.current = eventSource;

    return eventSource;
  }, [jobId, onProgress, onComplete, onError, onStatusChange, status]);

  // Connect function
  const connect = useCallback(() => {
    if (useSSE) {
      return connectSSE();
    } else {
      return connectWebSocket();
    }
  }, [useSSE, connectSSE, connectWebSocket]);

  // Disconnect function
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (socketRef.current) {
      socketRef.current.emit('training:leave', { jobId });
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setIsConnected(false);
  }, [jobId]);

  // Reset state
  const reset = useCallback(() => {
    setStatus('idle');
    setProgress(0);
    setTrainedTokens(0);
    setEstimatedTotalTokens(0);
    setCurrentEpoch(0);
    setTotalEpochs(0);
    setCurrentStep(0);
    setTotalSteps(0);
    setMetrics({});
    setError(null);
    setFineTunedModel(null);
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && jobId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, jobId, connect, disconnect]);

  // Calculate derived values
  const isTraining = ['pending', 'queued', 'running', 'validating_files', 'validating'].includes(status);
  const isComplete = status === 'succeeded';
  const isFailed = status === 'failed';
  const isCancelled = status === 'cancelled';
  const isTerminal = isComplete || isFailed || isCancelled;

  return {
    // State
    status,
    progress,
    trainedTokens,
    estimatedTotalTokens,
    currentEpoch,
    totalEpochs,
    currentStep,
    totalSteps,
    metrics,
    error,
    isConnected,
    fineTunedModel,

    // Derived state
    isTraining,
    isComplete,
    isFailed,
    isCancelled,
    isTerminal,

    // Actions
    connect,
    disconnect,
    reset
  };
}

/**
 * Hook for tracking fine-tuning progress by model ID
 *
 * @param {number} modelId - Database model ID
 * @param {Object} options - Same options as useFineTuningProgress
 * @returns {Object} - Progress state and control functions
 */
export function useModelTrainingProgress(modelId, options = {}) {
  const [jobId, setJobId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch active job for model
  useEffect(() => {
    if (!modelId) {
      setLoading(false);
      return;
    }

    const fetchJob = async () => {
      try {
        const response = await fetch(`${API_URL}/api/fine-tuning/models/${modelId}/status`, {
          credentials: 'include'
        });
        const data = await response.json();

        if (data.success && data.job?.job_id) {
          setJobId(data.job.job_id);
        }
      } catch (error) {
        console.error('Failed to fetch job:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [modelId]);

  const progress = useFineTuningProgress(jobId, {
    ...options,
    autoConnect: !!jobId && options.autoConnect !== false
  });

  return {
    ...progress,
    loading,
    modelId,
    jobId
  };
}

export default useFineTuningProgress;
