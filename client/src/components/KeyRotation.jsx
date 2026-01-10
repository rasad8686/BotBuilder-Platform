/**
 * KeyRotation Component
 *
 * Provides API key rotation functionality including:
 * - Manual rotation with overlap period
 * - Scheduled automatic rotation
 * - Rotation history view
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import axiosInstance from '../api/axios';

/**
 * KeyRotation Modal Component
 */
export default function KeyRotation({ token, onClose, onRotationComplete }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('rotate'); // 'rotate', 'schedule', 'history'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newToken, setNewToken] = useState(null);
  const [rotationHistory, setRotationHistory] = useState(null);

  // Form states
  const [overlapHours, setOverlapHours] = useState(24);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  /**
   * Handle immediate rotation
   */
  const handleRotate = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await axiosInstance.post(`/api/api-tokens/${token.id}/rotate`, {
        overlapHours
      });

      if (response.data.success) {
        setNewToken(response.data.data.newToken);
        setSuccess('Token rotated successfully! Make sure to copy the new token.');
        if (onRotationComplete) {
          onRotationComplete();
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to rotate token');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle schedule rotation
   */
  const handleScheduleRotation = async () => {
    if (!scheduledDate || !scheduledTime) {
      setError('Please select both date and time');
      return;
    }

    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`);
    if (scheduledAt <= new Date()) {
      setError('Scheduled time must be in the future');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await axiosInstance.post(`/api/api-tokens/${token.id}/schedule-rotation`, {
        scheduledAt: scheduledAt.toISOString()
      });

      if (response.data.success) {
        setSuccess(`Rotation scheduled for ${scheduledAt.toLocaleString()}`);
        if (onRotationComplete) {
          onRotationComplete();
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to schedule rotation');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle cancel scheduled rotation
   */
  const handleCancelSchedule = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await axiosInstance.delete(`/api/api-tokens/${token.id}/cancel-rotation`);

      if (response.data.success) {
        setSuccess('Scheduled rotation cancelled');
        if (onRotationComplete) {
          onRotationComplete();
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel rotation');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load rotation history
   */
  const loadHistory = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get(`/api/api-tokens/${token.id}/rotation-history`);
      if (response.data.success) {
        setRotationHistory(response.data.data);
      }
    } catch (err) {
      setError('Failed to load rotation history');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Copy token to clipboard
   */
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  // Load history when switching to history tab
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setError('');
    setSuccess('');
    if (tab === 'history' && !rotationHistory) {
      loadHistory();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b dark:border-slate-700">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">
              Key Rotation: {token.token_name}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              X
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => handleTabChange('rotate')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === 'rotate'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              Rotate Now
            </button>
            <button
              onClick={() => handleTabChange('schedule')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === 'schedule'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              Schedule
            </button>
            <button
              onClick={() => handleTabChange('history')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === 'history'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              History
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Error/Success Messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg">
              {success}
            </div>
          )}

          {/* Rotate Now Tab */}
          {activeTab === 'rotate' && (
            <div>
              {newToken ? (
                <div>
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
                    <p className="text-green-800 dark:text-green-200 font-semibold mb-2">New Token Created!</p>
                    <p className="text-sm text-green-700 dark:text-green-300 mb-4">
                      Copy this token now. You won't be able to see it again!
                    </p>
                    <div className="bg-white dark:bg-slate-700 p-3 rounded border border-green-300 dark:border-green-700 mb-3">
                      <code className="text-sm break-all dark:text-gray-300">{newToken.token}</code>
                    </div>
                    <button
                      onClick={() => copyToClipboard(newToken.token)}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Copy New Token
                    </button>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <p className="text-amber-800 dark:text-amber-200 font-semibold mb-2">Old Token Overlap Period</p>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      Your old token will continue working until:
                      <br />
                      <strong>{new Date(newToken.oldTokenValidUntil || Date.now() + overlapHours * 3600000).toLocaleString()}</strong>
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Rotating a key creates a new token and sets an overlap period during which both old and new tokens work.
                  </p>

                  <div className="mb-6">
                    <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-2">
                      Overlap Period (Hours)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="168"
                      value={overlapHours}
                      onChange={(e) => setOverlapHours(parseInt(e.target.value) || 24)}
                      className="w-full px-4 py-2 border dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white"
                    />
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      During this period, both old and new tokens will work (1-168 hours)
                    </p>
                  </div>

                  <button
                    onClick={handleRotate}
                    disabled={loading}
                    className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Rotating...' : 'Rotate Key Now'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Schedule Tab */}
          {activeTab === 'schedule' && (
            <div>
              {token.rotation_scheduled_at ? (
                <div>
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
                    <p className="text-amber-800 dark:text-amber-200 font-semibold mb-2">Rotation Scheduled</p>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      This token is scheduled to rotate on:
                      <br />
                      <strong>{new Date(token.rotation_scheduled_at).toLocaleString()}</strong>
                    </p>
                  </div>
                  <button
                    onClick={handleCancelSchedule}
                    disabled={loading}
                    className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {loading ? 'Cancelling...' : 'Cancel Scheduled Rotation'}
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Schedule automatic rotation for a future date. You'll receive an email notification when the rotation occurs.
                  </p>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-2">
                        Date
                      </label>
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-4 py-2 border dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-2">
                        Time
                      </label>
                      <input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="w-full px-4 py-2 border dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleScheduleRotation}
                    disabled={loading}
                    className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {loading ? 'Scheduling...' : 'Schedule Rotation'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                  <p className="text-gray-500 dark:text-gray-400 mt-2">Loading history...</p>
                </div>
              ) : rotationHistory ? (
                <div className="space-y-4">
                  {/* Current Token */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-blue-800 dark:text-blue-200 font-semibold mb-2">Current Token</p>
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                      <p><strong>Name:</strong> {rotationHistory.current?.token_name}</p>
                      <p><strong>Created:</strong> {new Date(rotationHistory.current?.created_at).toLocaleString()}</p>
                      <p><strong>Preview:</strong> {rotationHistory.current?.token_preview}</p>
                    </div>
                  </div>

                  {/* Rotated From (Parent) */}
                  {rotationHistory.rotatedFrom && (
                    <div className="bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg p-4">
                      <p className="text-gray-800 dark:text-gray-200 font-semibold mb-2">Rotated From</p>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <p><strong>Name:</strong> {rotationHistory.rotatedFrom.token_name}</p>
                        <p><strong>Created:</strong> {new Date(rotationHistory.rotatedFrom.created_at).toLocaleString()}</p>
                        <p><strong>Status:</strong> {rotationHistory.rotatedFrom.is_active ? 'Active' : 'Inactive'}</p>
                      </div>
                    </div>
                  )}

                  {/* Rotated To (Children) */}
                  {rotationHistory.rotatedTo && rotationHistory.rotatedTo.length > 0 && (
                    <div>
                      <p className="text-gray-700 dark:text-gray-300 font-semibold mb-2">Rotation Chain</p>
                      {rotationHistory.rotatedTo.map((child, index) => (
                        <div key={child.id} className="bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg p-4 mb-2">
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            <p><strong>Name:</strong> {child.token_name}</p>
                            <p><strong>Created:</strong> {new Date(child.created_at).toLocaleString()}</p>
                            <p><strong>Status:</strong> {child.is_active ? 'Active' : 'Inactive'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!rotationHistory.rotatedFrom && (!rotationHistory.rotatedTo || rotationHistory.rotatedTo.length === 0) && (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                      This token has no rotation history.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                  No rotation history available.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 dark:bg-slate-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Rotation Button - Inline button to trigger rotation modal
 */
export function RotationButton({ onClick, hasScheduled }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
        hasScheduled
          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/50'
          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-900/50'
      }`}
      title={hasScheduled ? 'Rotation scheduled' : 'Rotate key'}
    >
      {hasScheduled ? 'Scheduled' : 'Rotate'}
    </button>
  );
}
