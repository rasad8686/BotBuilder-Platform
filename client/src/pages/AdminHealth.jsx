import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Server,
  Database,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { getHealth } from '../api/admin';

/**
 * AdminHealth Page
 * System health monitoring and status
 */
const AdminHealth = () => {
  const { t } = useTranslation();
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  useEffect(() => {
    fetchHealth();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchHealth();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getHealth();
      setHealth(response.health);
      setLastChecked(new Date());
    } catch (err) {
      // Silent fail
      setError(err.response?.data?.message || 'Failed to check system health');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    if (status === 'healthy' || status === 'connected') {
      return <CheckCircle className="w-8 h-8 text-green-500" />;
    }
    if (status === 'unhealthy' || status === 'disconnected') {
      return <XCircle className="w-8 h-8 text-red-500" />;
    }
    return <AlertTriangle className="w-8 h-8 text-orange-500" />;
  };

  const getStatusColor = (status) => {
    if (status === 'healthy' || status === 'connected') {
      return 'bg-green-100 text-green-800';
    }
    if (status === 'unhealthy' || status === 'disconnected') {
      return 'bg-red-100 text-red-800';
    }
    return 'bg-orange-100 text-orange-800';
  };

  const formatUptime = (seconds) => {
    if (!seconds) return '-';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatMemory = (bytes) => {
    if (!bytes) return '-';
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.systemHealth')}</h1>
          <p className="text-gray-600 mt-1">{t('admin.systemHealthSubtitle')}</p>
        </div>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {t('common.refresh')}
        </button>
      </div>

      {/* Last Checked */}
      {lastChecked && (
        <div className="text-sm text-gray-500">
          Last checked: {lastChecked.toLocaleTimeString()}
        </div>
      )}

      {/* Overall Status */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {loading ? (
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            ) : (
              getStatusIcon(health?.status)
            )}
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {t('admin.systemStatus')}
              </h2>
              {health && (
                <span className={`inline-block mt-2 px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(health.status)}`}>
                  {health.status?.toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Health Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Server Status */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{t('admin.server')}</h3>
            <Server className="w-6 h-6 text-indigo-600" />
          </div>
          {loading ? (
            <div className="space-y-3">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-32"></div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">{t('admin.uptime')}</p>
                <p className="text-xl font-semibold text-gray-900">
                  {formatUptime(health?.uptime)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">{t('common.status')}</p>
                <p className={`text-xl font-semibold ${health?.status === 'healthy' ? 'text-green-600' : 'text-red-600'}`}>
                  {health?.status === 'healthy' ? t('admin.running') : t('common.error')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Database Status */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{t('admin.database')}</h3>
            <Database className="w-6 h-6 text-green-600" />
          </div>
          {loading ? (
            <div className="space-y-3">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-32"></div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">{t('admin.connection')}</p>
                <p className={`text-xl font-semibold ${health?.database === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
                  {health?.database === 'connected' ? t('admin.connected') : t('admin.disconnected')}
                </p>
              </div>
              {health?.databaseError && (
                <div>
                  <p className="text-sm text-gray-600">Error</p>
                  <p className="text-sm text-red-600">{health.databaseError}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{t('admin.timestamp')}</h3>
            <Clock className="w-6 h-6 text-blue-600" />
          </div>
          {loading ? (
            <div className="space-y-3">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-32"></div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">{t('admin.serverTime')}</p>
                <p className="text-lg font-semibold text-gray-900">
                  {health?.timestamp
                    ? new Date(health.timestamp).toLocaleString()
                    : '-'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Memory Usage */}
      {health?.memory && (
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{t('admin.memoryUsage')}</h3>
            <Activity className="w-6 h-6 text-purple-600" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">RSS</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatMemory(health.memory.rss)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Heap Total</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatMemory(health.memory.heapTotal)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Heap Used</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatMemory(health.memory.heapUsed)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">External</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatMemory(health.memory.external)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-red-900 mb-1">{t('admin.healthCheckFailed')}</h4>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminHealth;
