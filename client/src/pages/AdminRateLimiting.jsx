import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';

/**
 * AdminRateLimiting Page
 * Admin panel for managing rate limiting settings and blocked users
 */
export default function AdminRateLimiting() {
  const { t } = useTranslation();

  // Settings State
  const [settings, setSettings] = useState({
    enabled: true,
    max_attempts: 5,
    window_minutes: 15,
    block_duration_minutes: 15
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState({ type: '', text: '' });

  // Blocked Users State
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(true);
  const [blockedError, setBlockedError] = useState('');
  const [unblockingId, setUnblockingId] = useState(null);
  const [unblockingAll, setUnblockingAll] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadSettings();
    loadBlockedUsers();
  }, []);

  const loadSettings = async () => {
    try {
      setSettingsLoading(true);
      const response = await api.get('/api/admin/rate-limit/settings');
      if (response.data.success) {
        setSettings(response.data.settings);
      }
    } catch (error) {
      // Error loading rate limit settings - silent fail
    } finally {
      setSettingsLoading(false);
    }
  };

  const loadBlockedUsers = async () => {
    try {
      setBlockedLoading(true);
      setBlockedError('');
      const response = await api.get('/api/admin/rate-limit/blocked');
      if (response.data.success) {
        setBlockedUsers(response.data.blocked || []);
      } else {
        setBlockedError(response.data.message || 'Failed to load blocked users');
      }
    } catch (error) {
      // Error loading blocked users - silent fail
      setBlockedError(error.response?.data?.message || 'Failed to load blocked users');
    } finally {
      setBlockedLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      setSaveMessage({ type: '', text: '' });

      const response = await api.put('/api/admin/rate-limit/settings', settings);

      if (response.data.success) {
        setSettings(response.data.settings);
        setSaveMessage({ type: 'success', text: t('rateLimiting.saveSuccess') });
      }
    } catch (error) {
      // Error saving settings - silent fail
      setSaveMessage({
        type: 'error',
        text: error.response?.data?.message || t('rateLimiting.saveError')
      });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage({ type: '', text: '' }), 3000);
    }
  };

  const handleUnblock = async (id) => {
    try {
      setUnblockingId(id);
      const response = await api.delete(`/api/admin/rate-limit/blocked/${id}`);

      if (response.data.success) {
        setBlockedUsers(blockedUsers.filter(u => u.id !== id));
      }
    } catch (error) {
      // Error unblocking user - silent fail
      alert(t('rateLimiting.saveError'));
    } finally {
      setUnblockingId(null);
    }
  };

  const handleUnblockAll = async () => {
    if (!confirm(t('rateLimiting.resetAll') + '?')) {
      return;
    }

    try {
      setUnblockingAll(true);
      const response = await api.delete('/api/admin/rate-limit/blocked');

      if (response.data.success) {
        setBlockedUsers([]);
      }
    } catch (error) {
      // Error unblocking all users - silent fail
      alert(t('rateLimiting.saveError'));
    } finally {
      setUnblockingAll(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 p-4 sm:p-6 transition-colors duration-300">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-800 dark:text-white mb-2">
            {t('rateLimiting.title')}
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            {t('rateLimiting.description')}
          </p>
        </div>

        {/* Rate Limiting Controls */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 sm:p-8 mb-6 transition-colors duration-300">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">🛡️</span>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
                {t('rateLimiting.controls')}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('rateLimiting.controlsDesc')}
              </p>
            </div>
          </div>

          {settingsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                <div>
                  <p className="font-semibold text-gray-800 dark:text-white">
                    {t('rateLimiting.status')}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {settings.enabled ? t('rateLimiting.statusEnabled') : t('rateLimiting.statusDisabled')}
                  </p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                    settings.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform ${
                      settings.enabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Settings Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Max Attempts */}
                <div className="p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('rateLimiting.maxAttempts')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={settings.max_attempts}
                    onChange={(e) => setSettings({ ...settings, max_attempts: parseInt(e.target.value) || 5 })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-800 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t('rateLimiting.maxAttemptsHint')}
                  </p>
                </div>

                {/* Time Window */}
                <div className="p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('rateLimiting.timeWindow')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={settings.window_minutes}
                    onChange={(e) => setSettings({ ...settings, window_minutes: parseInt(e.target.value) || 15 })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-800 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t('rateLimiting.timeWindowHint')}
                  </p>
                </div>

                {/* Block Duration */}
                <div className="p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('rateLimiting.blockDuration')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10080"
                    value={settings.block_duration_minutes}
                    onChange={(e) => setSettings({ ...settings, block_duration_minutes: parseInt(e.target.value) || 15 })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-800 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t('rateLimiting.blockDurationHint')}
                  </p>
                </div>
              </div>

              {/* Save Message */}
              {saveMessage.text && (
                <div className={`p-3 rounded-lg ${
                  saveMessage.type === 'success'
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-400'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400'
                }`}>
                  {saveMessage.text}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-semibold transition-colors"
                >
                  {saving ? t('rateLimiting.saving') : t('rateLimiting.saveSettings')}
                </button>
                <button
                  onClick={handleUnblockAll}
                  disabled={unblockingAll || blockedUsers.length === 0}
                  className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 font-semibold transition-colors"
                >
                  {unblockingAll ? t('rateLimiting.resetting') : t('rateLimiting.resetAll')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Blocked Users Table */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 sm:p-8 transition-colors duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🚫</span>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
                  {t('rateLimiting.blockedUsers')}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('rateLimiting.blockedCount', { count: blockedUsers.length })}
                </p>
              </div>
              <button
                onClick={loadBlockedUsers}
                disabled={blockedLoading}
                className="ml-2 p-2 text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 disabled:opacity-50"
                title={t('common.refresh') || 'Refresh'}
              >
                <svg className={`w-5 h-5 ${blockedLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            {blockedUsers.length > 0 && (
              <button
                onClick={handleUnblockAll}
                disabled={unblockingAll}
                className="px-4 py-2 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {unblockingAll ? t('rateLimiting.unblocking') : t('rateLimiting.unblockAll')}
              </button>
            )}
          </div>

          {blockedLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : blockedError ? (
            <div className="text-center py-12">
              <span className="text-5xl mb-4 block">⚠️</span>
              <p className="text-red-600 dark:text-red-400 text-lg">
                {blockedError}
              </p>
              <button
                onClick={loadBlockedUsers}
                className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                {t('common.retry') || 'Retry'}
              </button>
            </div>
          ) : blockedUsers.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-5xl mb-4 block">✅</span>
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                {t('rateLimiting.noBlocked')}
              </p>
              <p className="text-gray-500 dark:text-gray-500 text-sm mt-1">
                {t('rateLimiting.noBlockedDesc')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-600">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                      {t('rateLimiting.email')}
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                      {t('rateLimiting.ipAddress')}
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                      {t('rateLimiting.blockedAt')}
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                      {t('rateLimiting.blockedUntil')}
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                      {t('rateLimiting.attempts')}
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                      {t('rateLimiting.action')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {blockedUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <span className="text-gray-800 dark:text-white">
                          {user.email || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <code className="text-sm bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded text-gray-700 dark:text-gray-300">
                          {user.ip_address}
                        </code>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(user.blocked_at)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(user.blocked_until)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400">
                          {user.attempt_count}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleUnblock(user.id)}
                          disabled={unblockingId === user.id}
                          className="px-3 py-1.5 bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-50 transition-colors text-sm font-medium"
                        >
                          {unblockingId === user.id ? t('rateLimiting.unblocking') : t('rateLimiting.unblock')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <p className="font-semibold text-blue-800 dark:text-blue-400 mb-1">
                {t('rateLimiting.howItWorks')}
              </p>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <li>• {t('rateLimiting.howItWorksDesc1')}</li>
                <li>• {t('rateLimiting.howItWorksDesc2')}</li>
                <li>• {t('rateLimiting.howItWorksDesc3')}</li>
                <li>• {t('rateLimiting.howItWorksDesc4')}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
