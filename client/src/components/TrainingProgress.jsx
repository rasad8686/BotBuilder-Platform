/**
 * Training Progress Component
 *
 * Real-time training status display with:
 * - Progress indicator
 * - Training events log
 * - Cancel training option
 * - Model testing after completion
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Square,
  Play,
  Send,
  Clock,
  Zap,
  MessageSquare,
  Bot,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Status configurations
const statusConfig = {
  pending: {
    icon: Clock,
    color: 'text-gray-500',
    bg: 'bg-gray-100 dark:bg-gray-800',
    label: 'Pending'
  },
  validating_files: {
    icon: RefreshCw,
    color: 'text-blue-500',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    label: 'Validating Files',
    animate: true
  },
  queued: {
    icon: Clock,
    color: 'text-yellow-500',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    label: 'Queued'
  },
  running: {
    icon: Loader2,
    color: 'text-purple-500',
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    label: 'Training',
    animate: true
  },
  succeeded: {
    icon: CheckCircle,
    color: 'text-green-500',
    bg: 'bg-green-100 dark:bg-green-900/30',
    label: 'Completed'
  },
  failed: {
    icon: XCircle,
    color: 'text-red-500',
    bg: 'bg-red-100 dark:bg-red-900/30',
    label: 'Failed'
  },
  cancelled: {
    icon: Square,
    color: 'text-gray-500',
    bg: 'bg-gray-100 dark:bg-gray-800',
    label: 'Cancelled'
  }
};

export default function TrainingProgress({ model, onStatusChange, onClose }) {
  const { t } = useTranslation();
  const token = localStorage.getItem('token');

  // States
  const [status, setStatus] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState(null);
  const [showEvents, setShowEvents] = useState(true);

  // Test model states
  const [showTest, setShowTest] = useState(false);
  const [testPrompt, setTestPrompt] = useState('');
  const [testResponse, setTestResponse] = useState(null);
  const [testing, setTesting] = useState(false);

  const pollIntervalRef = useRef(null);

  // Fetch training status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/fine-tuning/models/${model.id}/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();

      if (data.success) {
        setStatus(data);

        // Notify parent of status change
        if (onStatusChange && data.model_status !== model.status) {
          onStatusChange(data.model_status);
        }

        // Stop polling if training is complete
        if (['completed', 'failed', 'cancelled'].includes(data.model_status)) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
  }, [model.id, model.status, token, onStatusChange]);

  // Fetch training events
  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/fine-tuning/models/${model.id}/events`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();

      if (data.success) {
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error('Failed to fetch events:', err);
    }
  }, [model.id, token]);

  // Initial fetch and polling setup
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      await Promise.all([fetchStatus(), fetchEvents()]);
      setLoading(false);
    };

    fetchAll();

    // Start polling if training is active
    if (['training', 'uploading', 'validating'].includes(model.status)) {
      pollIntervalRef.current = setInterval(() => {
        fetchStatus();
        fetchEvents();
      }, 5000); // Poll every 5 seconds
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [model.id, model.status, fetchStatus, fetchEvents]);

  // Cancel training
  const handleCancel = async () => {
    if (!confirm(t('trainingProgress.confirmCancel', 'Are you sure you want to cancel training?'))) {
      return;
    }

    setCancelling(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/fine-tuning/models/${model.id}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();

      if (data.success) {
        fetchStatus();
        if (onStatusChange) {
          onStatusChange('cancelled');
        }
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelling(false);
    }
  };

  // Test model
  const handleTest = async () => {
    if (!testPrompt.trim()) return;

    setTesting(true);
    setError(null);
    setTestResponse(null);

    try {
      const res = await fetch(`${API_URL}/api/fine-tuning/models/${model.id}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt: testPrompt })
      });

      const data = await res.json();

      if (data.success) {
        setTestResponse(data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  };

  // Get current status config
  const currentStatus = status?.job?.status || model.status;
  const config = statusConfig[currentStatus] || statusConfig.pending;
  const StatusIcon = config.icon;

  // Calculate progress (approximate)
  const getProgress = () => {
    if (!status?.job) return 0;

    switch (status.job.status) {
      case 'pending': return 5;
      case 'validating_files': return 15;
      case 'queued': return 25;
      case 'running': return 60;
      case 'succeeded': return 100;
      case 'failed':
      case 'cancelled': return 0;
      default: return 0;
    }
  };

  const progress = getProgress();
  const isActive = ['pending', 'queued', 'running', 'validating_files'].includes(currentStatus);
  const isComplete = currentStatus === 'succeeded';
  const hasFailed = currentStatus === 'failed';

  // Format timestamp
  const formatTime = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-100 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.bg}`}>
              <StatusIcon className={`w-5 h-5 ${config.color} ${config.animate ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {t('trainingProgress.title', 'Training Progress')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t(`trainingProgress.status.${currentStatus}`, config.label)}
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-5 pt-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {isComplete ? t('trainingProgress.completed', 'Training Complete') :
             hasFailed ? t('trainingProgress.failed', 'Training Failed') :
             t('trainingProgress.inProgress', 'Training in Progress...')}
          </span>
          <span className="text-sm font-medium text-purple-600">{progress}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all duration-500 ${
              hasFailed ? 'bg-red-500' :
              isComplete ? 'bg-green-500' :
              'bg-purple-600'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      {status?.job && (
        <div className="px-5 py-4 grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('trainingProgress.epochs', 'Epochs')}</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{status.job.epochs || 3}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('trainingProgress.tokens', 'Trained Tokens')}</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {status.job.trained_tokens?.toLocaleString() || '-'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('trainingProgress.provider', 'Provider')}</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
              {status.job.provider || 'OpenAI'}
            </p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {(error || status?.job?.error_message) && (
        <div className="mx-5 mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">
              {error || status?.job?.error_message}
            </p>
          </div>
        </div>
      )}

      {/* Training Events */}
      <div className="px-5 pb-4">
        <button
          onClick={() => setShowEvents(!showEvents)}
          className="w-full flex items-center justify-between py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <span className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            {t('trainingProgress.events', 'Training Events')} ({events.length})
          </span>
          {showEvents ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showEvents && events.length > 0 && (
          <div className="mt-2 max-h-48 overflow-y-auto bg-gray-50 dark:bg-slate-900 rounded-lg p-3 space-y-2">
            {events.map((event, idx) => (
              <div key={event.id || idx} className="flex items-start gap-2 text-sm">
                <span className="text-gray-400 text-xs whitespace-nowrap">
                  {formatTime(event.created_at)}
                </span>
                <span className={`${
                  event.level === 'error' ? 'text-red-500' :
                  event.level === 'warning' ? 'text-yellow-500' :
                  'text-gray-600 dark:text-gray-400'
                }`}>
                  {event.message}
                </span>
              </div>
            ))}
          </div>
        )}

        {showEvents && events.length === 0 && (
          <div className="mt-2 text-center py-4 text-sm text-gray-500 dark:text-gray-400">
            {t('trainingProgress.noEvents', 'No events yet')}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-5 border-t border-gray-100 dark:border-slate-700 space-y-3">
        {/* Cancel Button (during training) */}
        {isActive && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 disabled:opacity-50"
          >
            {cancelling ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            {t('trainingProgress.cancel', 'Cancel Training')}
          </button>
        )}

        {/* Test Model Button (after completion) */}
        {isComplete && (
          <>
            <button
              onClick={() => setShowTest(!showTest)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Zap className="w-4 h-4" />
              {t('trainingProgress.testModel', 'Test Model')}
            </button>

            {/* Test Interface */}
            {showTest && (
              <div className="mt-4 space-y-3">
                <div className="relative">
                  <textarea
                    value={testPrompt}
                    onChange={(e) => setTestPrompt(e.target.value)}
                    placeholder={t('trainingProgress.testPlaceholder', 'Enter a test prompt...')}
                    rows={3}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleTest}
                    disabled={testing || !testPrompt.trim()}
                    className="absolute right-2 bottom-2 p-2 text-purple-600 hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {testing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>

                {/* Test Response */}
                {testResponse && (
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Bot className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-1">
                          {t('trainingProgress.response', 'Model Response')}
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-400 whitespace-pre-wrap">
                          {testResponse.response}
                        </p>
                        {testResponse.usage && (
                          <p className="text-xs text-green-600 dark:text-green-500 mt-2">
                            Tokens: {testResponse.usage.total_tokens}
                          </p>
                        )}
                        {testResponse.simulation && (
                          <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                            ⚠️ {t('trainingProgress.simulationMode', 'Simulation mode - OpenAI not configured')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Model ID Display */}
            {status?.model_id || model.model_id ? (
              <div className="mt-3 p-3 bg-gray-50 dark:bg-slate-900 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  {t('trainingProgress.fineTunedModelId', 'Fine-tuned Model ID')}
                </p>
                <p className="text-sm font-mono text-purple-600 dark:text-purple-400 break-all">
                  {status?.model_id || model.model_id}
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
