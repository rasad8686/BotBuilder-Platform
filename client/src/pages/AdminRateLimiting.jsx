import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle, Plus, X, Edit2, Trash2 } from 'lucide-react';
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

  // Rules State
  const [rules, setRules] = useState([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleForm, setRuleForm] = useState({
    endpoint: '/api/auth/login',
    max_attempts: 5,
    window_minutes: 15,
    block_duration_minutes: 30,
    enabled: true
  });
  const [savingRule, setSavingRule] = useState(false);
  const [deletingRuleId, setDeletingRuleId] = useState(null);

  // Available endpoints for dropdown
  const endpointOptions = [
    { value: '/api/auth/login', label: 'Login' },
    { value: '/api/auth/register', label: 'Register' },
    { value: '/api/auth/forgot-password', label: 'Forgot Password' },
    { value: '/api/auth/reset-password', label: 'Reset Password' },
    { value: '/api/bots', label: 'Bots API' },
    { value: '/api/ai', label: 'AI API' },
    { value: '/api/messages', label: 'Messages API' },
    { value: '/api/widget', label: 'Widget API' },
    { value: '*', label: 'All Endpoints (Global)' }
  ];

  // Load data on mount
  useEffect(() => {
    loadSettings();
    loadBlockedUsers();
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      setRulesLoading(true);
      const response = await api.get('/api/admin/rate-limit/rules');
      if (response.data.success) {
        setRules(response.data.rules || []);
      }
    } catch (error) {
      // Error loading rules - silent fail
    } finally {
      setRulesLoading(false);
    }
  };

  const openAddRuleModal = () => {
    setEditingRule(null);
    setRuleForm({
      endpoint: '/api/auth/login',
      max_attempts: 5,
      window_minutes: 15,
      block_duration_minutes: 30,
      enabled: true
    });
    setShowRuleModal(true);
  };

  const openEditRuleModal = (rule) => {
    setEditingRule(rule);
    setRuleForm({
      endpoint: rule.endpoint,
      max_attempts: rule.max_attempts,
      window_minutes: rule.window_minutes,
      block_duration_minutes: rule.block_duration_minutes,
      enabled: rule.enabled
    });
    setShowRuleModal(true);
  };

  const handleSaveRule = async () => {
    try {
      setSavingRule(true);
      let response;
      if (editingRule) {
        response = await api.put(`/api/admin/rate-limit/rules/${editingRule.id}`, ruleForm);
      } else {
        response = await api.post('/api/admin/rate-limit/rules', ruleForm);
      }
      if (response.data.success) {
        loadRules();
        setShowRuleModal(false);
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to save rule');
    } finally {
      setSavingRule(false);
    }
  };

  const handleDeleteRule = async (id) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    try {
      setDeletingRuleId(id);
      const response = await api.delete(`/api/admin/rate-limit/rules/${id}`);
      if (response.data.success) {
        setRules(rules.filter(r => r.id !== id));
      }
    } catch (error) {
      alert('Failed to delete rule');
    } finally {
      setDeletingRuleId(null);
    }
  };

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

        {/* Rate Limit Rules Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 sm:p-8 mb-6 transition-colors duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📋</span>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
                  {t('rateLimiting.rules', 'Rate Limit Rules')}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('rateLimiting.rulesDesc', 'Custom rules for specific endpoints')}
                </p>
              </div>
            </div>
            <button
              onClick={openAddRuleModal}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('rateLimiting.addRule', 'Add Rule')}
            </button>
          </div>

          {rulesLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {t('rateLimiting.noRules', 'No custom rules defined. Click "Add Rule" to create one.')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-600">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Endpoint</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Max Attempts</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Window</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Block Duration</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Status</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id} className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                      <td className="py-3 px-4">
                        <code className="text-sm bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded">
                          {rule.endpoint}
                        </code>
                      </td>
                      <td className="py-3 px-4 text-gray-800 dark:text-white">{rule.max_attempts}</td>
                      <td className="py-3 px-4 text-gray-800 dark:text-white">{rule.window_minutes} min</td>
                      <td className="py-3 px-4 text-gray-800 dark:text-white">{rule.block_duration_minutes} min</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          rule.enabled
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}>
                          {rule.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditRuleModal(rule)}
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            disabled={deletingRuleId === rule.id}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
              <span className="block mb-4"><AlertTriangle size={48} className="mx-auto text-amber-500" /></span>
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
              <span className="block mb-4"><CheckCircle size={48} className="mx-auto text-green-500" /></span>
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

      {/* Add/Edit Rule Modal */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowRuleModal(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-xl shadow-2xl">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {editingRule ? t('rateLimiting.editRule', 'Edit Rule') : t('rateLimiting.addRule', 'Add Rule')}
                </h3>
                <button
                  onClick={() => setShowRuleModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4">
                {/* Endpoint */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Endpoint
                  </label>
                  <select
                    value={ruleForm.endpoint}
                    onChange={(e) => setRuleForm({ ...ruleForm, endpoint: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-purple-500"
                  >
                    {endpointOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label} ({opt.value})</option>
                    ))}
                  </select>
                </div>

                {/* Max Attempts */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Max Attempts
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={ruleForm.max_attempts}
                    onChange={(e) => setRuleForm({ ...ruleForm, max_attempts: parseInt(e.target.value) || 5 })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Time Window */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Time Window (minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={ruleForm.window_minutes}
                    onChange={(e) => setRuleForm({ ...ruleForm, window_minutes: parseInt(e.target.value) || 15 })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Block Duration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Block Duration (minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10080"
                    value={ruleForm.block_duration_minutes}
                    onChange={(e) => setRuleForm({ ...ruleForm, block_duration_minutes: parseInt(e.target.value) || 30 })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Enabled Toggle */}
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enabled</span>
                  <button
                    type="button"
                    onClick={() => setRuleForm({ ...ruleForm, enabled: !ruleForm.enabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      ruleForm.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-slate-600'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      ruleForm.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-slate-700">
                <button
                  onClick={() => setShowRuleModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRule}
                  disabled={savingRule}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {savingRule ? 'Saving...' : editingRule ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
