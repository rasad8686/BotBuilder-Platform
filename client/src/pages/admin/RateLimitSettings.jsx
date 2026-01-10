import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Shield, Settings, Ban, FileText, BarChart3, RefreshCw, Plus, Trash2, Check, X,
  AlertTriangle, Clock, Globe, Activity, Edit2
} from 'lucide-react';
import api from '../../api/axios';

/**
 * RateLimitSettings - Professional Rate Limiting Admin Panel
 */
export default function RateLimitSettings() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('settings');

  // Settings State
  const [settings, setSettings] = useState([]);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [saveMessage, setSaveMessage] = useState({ type: '', text: '' });
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [newRule, setNewRule] = useState({
    key: 'custom',
    max_attempts: 10,
    window_ms: 900000,
    block_duration_ms: 1800000,
    is_enabled: true
  });

  // Blocked IPs State
  const [blockedIps, setBlockedIps] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(true);
  const [blockedPagination, setBlockedPagination] = useState({ page: 1, totalPages: 1 });
  const [unblockingId, setUnblockingId] = useState(null);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [newBlock, setNewBlock] = useState({ ip_address: '', reason: 'manual', duration_hours: 1, is_permanent: false });
  const [showEditBlockModal, setShowEditBlockModal] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null);
  const [deletingBlockId, setDeletingBlockId] = useState(null);

  // Audit Logs State
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsPagination, setLogsPagination] = useState({ page: 1, totalPages: 1 });
  const [logsFilter, setLogsFilter] = useState({ action: '', endpoint: '' });

  // Stats State
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Load data on mount and tab change
  useEffect(() => {
    if (activeTab === 'settings') loadSettings();
    if (activeTab === 'blocked') loadBlockedIps();
    if (activeTab === 'logs') loadLogs();
    if (activeTab === 'stats') loadStats();
  }, [activeTab]);

  const loadSettings = async () => {
    try {
      setSettingsLoading(true);
      const response = await api.get('/api/admin/rate-limit/settings');
      if (response.data.success) {
        setSettings(response.data.settings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setSettingsLoading(false);
    }
  };

  const loadBlockedIps = async (page = 1) => {
    try {
      setBlockedLoading(true);
      const response = await api.get(`/api/admin/rate-limit/blocked?page=${page}&limit=20`);
      if (response.data.success) {
        setBlockedIps(response.data.blocked);
        setBlockedPagination(response.data.pagination);
      }
    } catch (error) {
      console.error('Error loading blocked IPs:', error);
    } finally {
      setBlockedLoading(false);
    }
  };

  const loadLogs = async (page = 1) => {
    try {
      setLogsLoading(true);
      const params = new URLSearchParams({ page, limit: 50 });
      if (logsFilter.action) params.append('action', logsFilter.action);
      if (logsFilter.endpoint) params.append('endpoint', logsFilter.endpoint);

      const response = await api.get(`/api/admin/rate-limit/logs?${params}`);
      if (response.data.success) {
        setLogs(response.data.logs);
        setLogsPagination(response.data.pagination);
      }
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLogsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      setStatsLoading(true);
      const response = await api.get('/api/admin/rate-limit/stats');
      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleSaveSetting = async (key) => {
    const setting = settings.find(s => s.key === key);
    if (!setting) return;

    try {
      setSaving({ ...saving, [key]: true });
      const response = await api.put(`/api/admin/rate-limit/settings/${key}`, {
        max_attempts: setting.max_attempts,
        window_ms: setting.window_ms,
        block_duration_ms: setting.block_duration_ms,
        is_enabled: setting.is_enabled
      });

      if (response.data.success) {
        setSaveMessage({ type: 'success', text: t('rateLimit.settingsSaved', 'Settings saved successfully') });
        setTimeout(() => setSaveMessage({ type: '', text: '' }), 3000);
      }
    } catch (error) {
      setSaveMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save' });
    } finally {
      setSaving({ ...saving, [key]: false });
    }
  };

  const handleUnblock = async (id) => {
    try {
      setUnblockingId(id);
      const response = await api.delete(`/api/admin/rate-limit/blocked/${id}`);
      if (response.data.success) {
        setBlockedIps(blockedIps.filter(ip => ip.id !== id));
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to unblock');
    } finally {
      setUnblockingId(null);
    }
  };

  const handleManualBlock = async () => {
    try {
      const response = await api.post('/api/admin/rate-limit/block', {
        ip_address: newBlock.ip_address,
        reason: newBlock.reason,
        duration_ms: newBlock.is_permanent ? null : newBlock.duration_hours * 3600000,
        is_permanent: newBlock.is_permanent
      });

      if (response.data.success) {
        setShowBlockModal(false);
        setNewBlock({ ip_address: '', reason: 'manual', duration_hours: 1, is_permanent: false });
        loadBlockedIps();
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to block IP');
    }
  };

  const handleEditBlock = (block) => {
    setEditingBlock({
      id: block.id,
      ip_address: block.ip_address,
      reason: block.reason || 'manual',
      duration_hours: block.is_permanent ? 1 : Math.ceil((new Date(block.expires_at) - new Date()) / 3600000),
      is_permanent: block.is_permanent
    });
    setShowEditBlockModal(true);
  };

  const handleUpdateBlock = async () => {
    try {
      const response = await api.put(`/api/admin/rate-limit/blocked/${editingBlock.id}`, {
        reason: editingBlock.reason,
        duration_ms: editingBlock.is_permanent ? null : editingBlock.duration_hours * 3600000,
        is_permanent: editingBlock.is_permanent
      });

      if (response.data.success) {
        setShowEditBlockModal(false);
        setEditingBlock(null);
        loadBlockedIps();
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update block');
    }
  };

  const handleDeleteBlock = async (id) => {
    if (!confirm(t('rateLimit.confirmDeleteBlock', 'Are you sure you want to delete this block record?'))) return;
    try {
      setDeletingBlockId(id);
      const response = await api.delete(`/api/admin/rate-limit/blocked/${id}`);
      if (response.data.success) {
        setBlockedIps(blockedIps.filter(ip => ip.id !== id));
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete block');
    } finally {
      setDeletingBlockId(null);
    }
  };

  const updateSetting = (key, field, value) => {
    setSettings(settings.map(s =>
      s.key === key ? { ...s, [field]: value } : s
    ));
  };

  const handleAddRule = async () => {
    try {
      const response = await api.post('/api/admin/rate-limit/settings', newRule);
      if (response.data.success) {
        setShowAddRuleModal(false);
        setNewRule({ key: 'custom', max_attempts: 10, window_ms: 900000, block_duration_ms: 1800000, is_enabled: true });
        setEditingRule(null);
        loadSettings();
        setSaveMessage({ type: 'success', text: t('rateLimit.ruleAdded', 'Rule added successfully') });
        setTimeout(() => setSaveMessage({ type: '', text: '' }), 3000);
      }
    } catch (error) {
      setSaveMessage({ type: 'error', text: error.response?.data?.message || 'Failed to add rule' });
    }
  };

  const handleUpdateRule = async () => {
    try {
      const response = await api.put(`/api/admin/rate-limit/settings/${editingRule.key}`, newRule);
      if (response.data.success) {
        setShowAddRuleModal(false);
        setNewRule({ key: 'custom', max_attempts: 10, window_ms: 900000, block_duration_ms: 1800000, is_enabled: true });
        setEditingRule(null);
        loadSettings();
        setSaveMessage({ type: 'success', text: t('rateLimit.ruleUpdated', 'Rule updated successfully') });
        setTimeout(() => setSaveMessage({ type: '', text: '' }), 3000);
      }
    } catch (error) {
      setSaveMessage({ type: 'error', text: error.response?.data?.message || 'Failed to update rule' });
    }
  };

  const handleDeleteRule = async (key) => {
    if (!confirm(t('rateLimit.confirmDelete', 'Are you sure you want to delete this rule?'))) return;
    try {
      const response = await api.delete(`/api/admin/rate-limit/settings/${key}`);
      if (response.data.success) {
        loadSettings();
        setSaveMessage({ type: 'success', text: t('rateLimit.ruleDeleted', 'Rule deleted successfully') });
        setTimeout(() => setSaveMessage({ type: '', text: '' }), 3000);
      }
    } catch (error) {
      setSaveMessage({ type: 'error', text: error.response?.data?.message || 'Failed to delete rule' });
    }
  };

  const openEditModal = (setting) => {
    setEditingRule(setting);
    setNewRule({
      key: setting.key,
      max_attempts: setting.max_attempts,
      window_ms: setting.window_ms,
      block_duration_ms: setting.block_duration_ms,
      is_enabled: setting.is_enabled
    });
    setShowAddRuleModal(true);
  };

  const formatMs = (ms) => {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    return `${Math.round(ms / 3600000)}h`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  const formatLogDetails = (details, action) => {
    if (!details) return '-';

    // Parse if string
    let d;
    try {
      d = typeof details === 'string' ? JSON.parse(details) : details;
    } catch (e) {
      return String(details);
    }

    if (action === 'attempt') {
      return `${d.attempt_number || d.attempts || 1}. cəhd`;
    }

    if (action === 'blocked') {
      // Manual block: reason + duration_ms
      if (d.reason) {
        const duration = d.duration_ms ? formatMs(d.duration_ms) : (d.is_permanent ? 'Permanent' : '?');
        return `${d.reason} / ${duration}`;
      }
      // Login block: attempts + block_duration_ms
      const attempts = d.attempts || d.attempt_count || '?';
      const duration = d.block_duration_ms || d.duration_ms;
      return `${attempts} cəhd / ${duration ? formatMs(duration) : '?'} blok`;
    }

    if (action === 'block_updated') {
      const reason = d.reason || '-';
      const duration = d.is_permanent ? 'Permanent' : (d.expires_at ? formatDate(d.expires_at) : '-');
      return `${reason} / ${duration}`;
    }

    if (action === 'setting_updated') {
      const parts = [];
      if (d.max_attempts) parts.push(`${d.max_attempts} cəhd`);
      if (d.window_ms) parts.push(`${formatMs(d.window_ms)} pəncərə`);
      if (d.block_duration_ms) parts.push(`${formatMs(d.block_duration_ms)} blok`);
      return parts.length > 0 ? parts.join(' / ') : '-';
    }

    if (action === 'unblocked') {
      return d.original_reason ? `Səbəb: ${d.original_reason}` : 'Manual unblock';
    }

    // Fallback to simple key-value display
    return Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(', ');
  };

  const tabs = [
    { id: 'settings', label: t('rateLimit.settings', 'Settings'), icon: Settings },
    { id: 'blocked', label: t('rateLimit.blockedIps', 'Blocked IPs'), icon: Ban },
    { id: 'logs', label: t('rateLimit.auditLogs', 'Audit Logs'), icon: FileText },
    { id: 'stats', label: t('rateLimit.stats', 'Statistics'), icon: BarChart3 }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-purple-600" />
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">
              {t('rateLimit.title', 'Rate Limiting')}
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            {t('rateLimit.description', 'Manage rate limiting settings, blocked IPs, and view audit logs')}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-slate-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Save Message */}
        {saveMessage.text && (
          <div className={`mb-4 p-3 rounded-lg ${
            saveMessage.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400'
          }`}>
            {saveMessage.text}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                {t('rateLimit.settings', 'Rate Limit Settings')}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => loadSettings()}
                  className="p-2 text-gray-500 hover:text-purple-600 dark:text-gray-400"
                >
                  <RefreshCw className={`w-5 h-5 ${settingsLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => {
                    setEditingRule(null);
                    setNewRule({ key: '', max_attempts: 10, window_ms: 900000, block_duration_ms: 1800000, is_enabled: true });
                    setShowAddRuleModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  <Plus className="w-4 h-4" />
                  {t('rateLimit.addRule', 'Add Rule')}
                </button>
              </div>
            </div>
            {settingsLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-slate-700">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {t('rateLimit.endpoint', 'Endpoint')}
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {t('rateLimit.maxAttempts', 'Max Attempts')}
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {t('rateLimit.window', 'Time Window')}
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {t('rateLimit.blockDuration', 'Block Duration')}
                      </th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {t('rateLimit.enabled', 'Enabled')}
                      </th>
                      <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {t('common.actions', 'Actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-slate-600">
                    {Array.isArray(settings) && settings.map(setting => (
                      <tr key={setting.key} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                        <td className="px-6 py-4">
                          <span className="font-medium text-gray-800 dark:text-white capitalize">
                            {setting.key.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="number"
                            min="1"
                            max="1000"
                            value={setting.max_attempts}
                            onChange={(e) => updateSetting(setting.key, 'max_attempts', parseInt(e.target.value) || 1)}
                            className="w-20 px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-800 dark:text-white text-sm"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={setting.window_ms}
                            onChange={(e) => updateSetting(setting.key, 'window_ms', parseInt(e.target.value))}
                            className="px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-800 dark:text-white text-sm"
                          >
                            <option value={60000}>1 min</option>
                            <option value={300000}>5 min</option>
                            <option value={600000}>10 min</option>
                            <option value={900000}>15 min</option>
                            <option value={1800000}>30 min</option>
                            <option value={3600000}>1 hour</option>
                            <option value={86400000}>24 hours</option>
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={setting.block_duration_ms}
                            onChange={(e) => updateSetting(setting.key, 'block_duration_ms', parseInt(e.target.value))}
                            className="px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-800 dark:text-white text-sm"
                          >
                            <option value={60000}>1 min</option>
                            <option value={300000}>5 min</option>
                            <option value={600000}>10 min</option>
                            <option value={900000}>15 min</option>
                            <option value={1800000}>30 min</option>
                            <option value={3600000}>1 hour</option>
                            <option value={86400000}>24 hours</option>
                            <option value={604800000}>7 days</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => updateSetting(setting.key, 'is_enabled', !setting.is_enabled)}
                            className={`w-12 h-6 rounded-full transition-colors ${
                              setting.is_enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-slate-600'
                            }`}
                          >
                            <span className={`block w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                              setting.is_enabled ? 'translate-x-6' : 'translate-x-0.5'
                            }`} />
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleSaveSetting(setting.key)}
                              disabled={saving[setting.key]}
                              className="px-4 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
                            >
                              {saving[setting.key] ? <RefreshCw className="w-4 h-4 animate-spin" /> : t('common.save', 'Save')}
                            </button>
                            <button
                              onClick={() => openEditModal(setting)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                              title={t('common.edit', 'Edit')}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteRule(setting.key)}
                              className="p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                              title={t('common.delete', 'Delete')}
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
        )}

        {/* Blocked IPs Tab */}
        {activeTab === 'blocked' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                {t('rateLimit.blockedIps', 'Blocked IPs')}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => loadBlockedIps()}
                  className="p-2 text-gray-500 hover:text-purple-600 dark:text-gray-400"
                >
                  <RefreshCw className={`w-5 h-5 ${blockedLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setShowBlockModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <Plus className="w-4 h-4" />
                  {t('rateLimit.manualBlock', 'Manual Block')}
                </button>
              </div>
            </div>

            {blockedLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
              </div>
            ) : blockedIps.length === 0 ? (
              <div className="text-center py-12">
                <Check className="w-12 h-12 mx-auto text-green-500 mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  {t('rateLimit.noBlocked', 'No blocked IPs')}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-slate-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                          {t('rateLimit.ipAddress', 'IP Address')}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                          {t('rateLimit.reason', 'Reason')}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-[180px]">
                          {t('rateLimit.blockedAt', 'Blocked At')}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-[180px]">
                          {t('rateLimit.expiresAt', 'Expires At')}
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                          {t('common.actions', 'Actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-slate-600">
                      {blockedIps.map(ip => (
                        <tr key={ip.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                          <td className="px-4 py-3">
                            <code className="text-sm bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded">
                              {ip.ip_address}
                            </code>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 capitalize">
                              {ip.reason}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {formatDate(ip.blocked_at)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {ip.is_permanent ? (
                              <span className="text-red-600 dark:text-red-400 font-medium">Permanent</span>
                            ) : formatDate(ip.expires_at)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleEditBlock(ip)}
                                className="p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                                title={t('common.edit', 'Edit')}
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteBlock(ip.id)}
                                disabled={deletingBlockId === ip.id}
                                className="p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 disabled:opacity-50"
                                title={t('common.delete', 'Delete')}
                              >
                                {deletingBlockId === ip.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => handleUnblock(ip.id)}
                                disabled={unblockingId === ip.id}
                                className="px-3 py-1.5 bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-50 text-sm font-medium"
                              >
                                {unblockingId === ip.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : t('rateLimit.unblock', 'Unblock')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {blockedPagination.totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-4">
                    {Array.from({ length: blockedPagination.totalPages }, (_, i) => (
                      <button
                        key={i + 1}
                        onClick={() => loadBlockedIps(i + 1)}
                        className={`px-3 py-1 rounded ${
                          blockedPagination.page === i + 1
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Audit Logs Tab */}
        {activeTab === 'logs' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                {t('rateLimit.auditLogs', 'Audit Logs')}
              </h2>
              <div className="flex gap-2">
                <select
                  value={logsFilter.action}
                  onChange={(e) => { setLogsFilter({ ...logsFilter, action: e.target.value }); loadLogs(1); }}
                  className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm"
                >
                  <option value="">{t('rateLimit.allActions', 'All Actions')}</option>
                  <option value="attempt">Attempt</option>
                  <option value="blocked">Blocked</option>
                  <option value="unblocked">Unblocked</option>
                </select>
                <select
                  value={logsFilter.endpoint}
                  onChange={(e) => { setLogsFilter({ ...logsFilter, endpoint: e.target.value }); loadLogs(1); }}
                  className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm"
                >
                  <option value="">{t('rateLimit.allEndpoints', 'All Endpoints')}</option>
                  <option value="login">Login</option>
                  <option value="register">Register</option>
                  <option value="api">API</option>
                  <option value="password_reset">Password Reset</option>
                </select>
                <button
                  onClick={() => loadLogs()}
                  className="p-2 text-gray-500 hover:text-purple-600 dark:text-gray-400"
                >
                  <RefreshCw className={`w-5 h-5 ${logsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {logsLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  {t('rateLimit.noLogs', 'No audit logs')}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-slate-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Time</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">IP</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Endpoint</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Action</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-slate-600">
                      {logs.map(log => (
                        <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                            {formatDate(log.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <code className="text-xs bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded">
                              {log.ip_address || '-'}
                            </code>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 capitalize">
                            {log.endpoint || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              log.action === 'blocked'
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                                : log.action === 'unblocked'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                            {log.details ? formatLogDetails(log.details, log.action) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {logsPagination.totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-4">
                    {Array.from({ length: Math.min(logsPagination.totalPages, 10) }, (_, i) => (
                      <button
                        key={i + 1}
                        onClick={() => loadLogs(i + 1)}
                        className={`px-3 py-1 rounded ${
                          logsPagination.page === i + 1
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            {statsLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
              </div>
            ) : stats ? (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <Ban className="w-8 h-8 text-red-500" />
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Blocked (24h)</p>
                        <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.totalBlockedLast24h}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <AlertTriangle className="w-8 h-8 text-orange-500" />
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Active Blocks</p>
                        <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.activeBlocks}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* By Endpoint */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                    Blocks by Endpoint (24h)
                  </h3>
                  <div className="space-y-3">
                    {stats.byEndpoint.map(item => (
                      <div key={item.endpoint} className="flex items-center gap-4">
                        <span className="w-32 text-sm text-gray-700 dark:text-gray-300 capitalize">
                          {item.endpoint || 'Unknown'}
                        </span>
                        <div className="flex-1 bg-gray-200 dark:bg-slate-700 rounded-full h-4">
                          <div
                            className="bg-purple-600 h-4 rounded-full"
                            style={{ width: `${Math.min(100, (item.count / Math.max(...stats.byEndpoint.map(e => e.count))) * 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-gray-800 dark:text-white w-12 text-right">
                          {item.count}
                        </span>
                      </div>
                    ))}
                    {stats.byEndpoint.length === 0 && (
                      <p className="text-gray-500 dark:text-gray-400">No blocks in the last 24 hours</p>
                    )}
                  </div>
                </div>

                {/* Top Blocked IPs */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                    Top Blocked IPs (24h)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-slate-700">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">IP Address</th>
                          <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Block Count</th>
                          <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Last Blocked</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-slate-600">
                        {stats.topBlockedIps.map((ip, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2">
                              <code className="text-sm bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded">
                                {ip.ip_address}
                              </code>
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                              {ip.block_count}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                              {formatDate(ip.last_blocked)}
                            </td>
                          </tr>
                        ))}
                        {stats.topBlockedIps.length === 0 && (
                          <tr>
                            <td colSpan={3} className="px-4 py-4 text-center text-gray-500 dark:text-gray-400">
                              No blocked IPs in the last 24 hours
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Failed to load statistics</p>
              </div>
            )}
          </div>
        )}

        {/* Manual Block Modal */}
        {showBlockModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                  {t('rateLimit.manualBlock', 'Manual Block')}
                </h3>
                <button onClick={() => setShowBlockModal(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('rateLimit.ipAddress', 'IP Address')}
                  </label>
                  <input
                    type="text"
                    value={newBlock.ip_address}
                    onChange={(e) => setNewBlock({ ...newBlock, ip_address: e.target.value })}
                    placeholder="192.168.1.1"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('rateLimit.reason', 'Reason')}
                  </label>
                  <select
                    value={newBlock.reason}
                    onChange={(e) => setNewBlock({ ...newBlock, reason: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
                  >
                    <option value="manual">Manual</option>
                    <option value="abuse">Abuse</option>
                    <option value="spam">Spam</option>
                    <option value="security">Security</option>
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="permanent"
                    checked={newBlock.is_permanent}
                    onChange={(e) => setNewBlock({ ...newBlock, is_permanent: e.target.checked })}
                    className="w-4 h-4 text-purple-600"
                  />
                  <label htmlFor="permanent" className="text-sm text-gray-700 dark:text-gray-300">
                    Permanent block
                  </label>
                </div>

                {!newBlock.is_permanent && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Duration (hours)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={newBlock.duration_hours}
                      onChange={(e) => setNewBlock({ ...newBlock, duration_hours: parseInt(e.target.value) || 1 })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowBlockModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={handleManualBlock}
                  disabled={!newBlock.ip_address}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {t('rateLimit.block', 'Block IP')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Block Modal */}
        {showEditBlockModal && editingBlock && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                  {t('rateLimit.editBlock', 'Edit Block')}
                </h3>
                <button
                  onClick={() => { setShowEditBlockModal(false); setEditingBlock(null); }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('rateLimit.ipAddress', 'IP Address')}
                  </label>
                  <input
                    type="text"
                    value={editingBlock.ip_address}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-100 dark:bg-slate-700 opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('rateLimit.reason', 'Reason')}
                  </label>
                  <select
                    value={editingBlock.reason}
                    onChange={(e) => setEditingBlock({ ...editingBlock, reason: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
                  >
                    <option value="manual">Manual</option>
                    <option value="login">Login</option>
                    <option value="register">Register</option>
                    <option value="api">API</option>
                    <option value="abuse">Abuse</option>
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="editPermanent"
                    checked={editingBlock.is_permanent}
                    onChange={(e) => setEditingBlock({ ...editingBlock, is_permanent: e.target.checked })}
                    className="w-4 h-4 text-red-600"
                  />
                  <label htmlFor="editPermanent" className="text-sm text-gray-700 dark:text-gray-300">
                    {t('rateLimit.permanentBlock', 'Permanent Block')}
                  </label>
                </div>

                {!editingBlock.is_permanent && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('rateLimit.duration', 'Duration (hours)')}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="8760"
                      value={editingBlock.duration_hours}
                      onChange={(e) => setEditingBlock({ ...editingBlock, duration_hours: parseInt(e.target.value) || 1 })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => { setShowEditBlockModal(false); setEditingBlock(null); }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={handleUpdateBlock}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  {t('common.save', 'Save')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Rule Modal */}
        {showAddRuleModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                  {editingRule
                    ? t('rateLimit.editRule', 'Edit Rule')
                    : t('rateLimit.addRule', 'Add Rule')}
                </h3>
                <button
                  onClick={() => {
                    setShowAddRuleModal(false);
                    setEditingRule(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('rateLimit.ruleKey', 'Rule Key')}
                  </label>
                  <input
                    type="text"
                    value={newRule.key}
                    onChange={(e) => setNewRule({ ...newRule, key: e.target.value })}
                    placeholder="e.g., login, register, api_general"
                    disabled={!!editingRule}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 disabled:opacity-50"
                  />
                  {!editingRule && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {t('rateLimit.keyHint', 'Unique identifier for this rate limit rule')}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('rateLimit.maxAttempts', 'Max Attempts')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={newRule.max_attempts}
                    onChange={(e) => setNewRule({ ...newRule, max_attempts: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('rateLimit.window', 'Time Window')}
                  </label>
                  <select
                    value={newRule.window_ms}
                    onChange={(e) => setNewRule({ ...newRule, window_ms: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
                  >
                    <option value={60000}>1 min</option>
                    <option value={300000}>5 min</option>
                    <option value={600000}>10 min</option>
                    <option value={900000}>15 min</option>
                    <option value={1800000}>30 min</option>
                    <option value={3600000}>1 hour</option>
                    <option value={86400000}>24 hours</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('rateLimit.blockDuration', 'Block Duration')}
                  </label>
                  <select
                    value={newRule.block_duration_ms}
                    onChange={(e) => setNewRule({ ...newRule, block_duration_ms: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
                  >
                    <option value={60000}>1 min</option>
                    <option value={300000}>5 min</option>
                    <option value={600000}>10 min</option>
                    <option value={900000}>15 min</option>
                    <option value={1800000}>30 min</option>
                    <option value={3600000}>1 hour</option>
                    <option value={86400000}>24 hours</option>
                    <option value={604800000}>7 days</option>
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="ruleEnabled"
                    checked={newRule.is_enabled}
                    onChange={(e) => setNewRule({ ...newRule, is_enabled: e.target.checked })}
                    className="w-4 h-4 text-purple-600"
                  />
                  <label htmlFor="ruleEnabled" className="text-sm text-gray-700 dark:text-gray-300">
                    {t('rateLimit.enabled', 'Enabled')}
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddRuleModal(false);
                    setEditingRule(null);
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={editingRule ? handleUpdateRule : handleAddRule}
                  disabled={!newRule.key}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {editingRule
                    ? t('common.save', 'Save')
                    : t('rateLimit.addRule', 'Add Rule')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
