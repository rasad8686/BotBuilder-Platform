import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Bot, Activity, Calendar, AlertCircle } from 'lucide-react';
import StatCard from '../components/StatCard';
import ActivityTimeline from '../components/ActivityTimeline';
import { getStats } from '../api/admin';

/**
 * AdminDashboard Page
 * Main admin dashboard with statistics and activity overview
 */
const AdminDashboard = () => {
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getStats();
      setStats(response.stats);
    } catch (err) {
      // Silent fail
      setError(err.response?.data?.message || 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-gray-200">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('admin.failedToLoad')}</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchStats}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            {t('common.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.dashboard')}</h1>
        <p className="text-gray-600 mt-1">{t('admin.dashboardSubtitle')}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title={t('admin.totalMembers')}
          value={stats?.totalMembers || 0}
          icon={Users}
          color="indigo"
          loading={loading}
        />
        <StatCard
          title={t('admin.totalBots')}
          value={stats?.totalBots || 0}
          icon={Bot}
          color="green"
          loading={loading}
        />
        <StatCard
          title={t('admin.activeBots')}
          value={stats?.activeBots || 0}
          icon={Activity}
          color="blue"
          loading={loading}
        />
        <StatCard
          title={t('admin.messages30d')}
          value={stats?.messagesLast30Days || 0}
          icon={Calendar}
          color="purple"
          loading={loading}
        />
      </div>

      {/* Activity Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity Timeline */}
        <div className="lg:col-span-2">
          <ActivityTimeline days={7} limit={20} autoRefresh={true} />
        </div>

        {/* Top Users */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('admin.topActiveUsers')}</h3>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                    <div>
                      <div className="h-4 bg-gray-200 rounded w-24 mb-1"></div>
                      <div className="h-3 bg-gray-200 rounded w-16"></div>
                    </div>
                  </div>
                  <div className="h-6 bg-gray-200 rounded w-8"></div>
                </div>
              ))}
            </div>
          ) : stats?.topUsers && stats.topUsers.length > 0 ? (
            <div className="space-y-3">
              {stats.topUsers.map((user, index) => (
                <div key={user.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-indigo-600 font-semibold text-sm">
                        #{index + 1}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {user.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-indigo-600 flex-shrink-0">
                    {user.action_count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">{t('admin.noUserActivity')}</p>
          )}
        </div>
      </div>

      {/* Recent Activity Breakdown */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('admin.activityBreakdown')}</h3>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse p-4 bg-gray-50 rounded-lg">
                <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-16"></div>
              </div>
            ))}
          </div>
        ) : stats?.recentActivity && stats.recentActivity.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats.recentActivity.map((activity) => (
              <div key={activity.action} className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">{activity.action}</p>
                <p className="text-2xl font-bold text-gray-900">{activity.count}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">{t('admin.noRecentActivity')}</p>
        )}
      </div>

      {/* Organization Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('admin.organizationInfo')}</h3>
          {loading ? (
            <div className="space-y-3">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-32"></div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">{t('admin.plan')}</p>
                <p className="text-lg font-semibold text-gray-900 capitalize">
                  {stats?.planTier || t('billing.free')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">{t('admin.created')}</p>
                <p className="text-lg font-semibold text-gray-900">
                  {stats?.organizationCreatedAt
                    ? new Date(stats.organizationCreatedAt).toLocaleDateString(i18n.language, {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })
                    : '-'}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('admin.auditStatistics')}</h3>
          {loading ? (
            <div className="space-y-3">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-20"></div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">{t('admin.auditEvents30d')}</p>
                <p className="text-lg font-semibold text-gray-900">
                  {stats?.auditEventsLast30Days || 0}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
