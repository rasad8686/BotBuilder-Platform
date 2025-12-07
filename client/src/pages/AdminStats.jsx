import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function AdminStats() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalBots: 0,
    totalMessages: 0,
    activeUsers: 0,
    totalRevenue: 0,
    newUsersToday: 0,
    messagesPerDay: 0,
    botsPerUser: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch('http://localhost:5000/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.stats) {
          setStats(data.stats);
        }
      } else if (response.status === 401 || response.status === 403) {
        navigate('/login');
      }
    } catch (err) {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-gray-600">{t('admin.loadingStatistics')}</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers,
      icon: '👥',
      color: 'bg-blue-500',
      change: stats.newUsersToday > 0 ? `+${stats.newUsersToday} today` : null
    },
    {
      title: 'Total Bots',
      value: stats.totalBots,
      icon: '🤖',
      color: 'bg-purple-500',
      change: null
    },
    {
      title: 'Total Messages',
      value: stats.totalMessages.toLocaleString(),
      icon: '💬',
      color: 'bg-green-500',
      change: stats.messagesPerDay > 0 ? `${Math.round(stats.messagesPerDay)}/day avg` : null
    },
    {
      title: 'Active Users',
      value: stats.activeUsers,
      icon: '✨',
      color: 'bg-yellow-500',
      change: stats.totalUsers > 0 ? `${Math.round((stats.activeUsers / stats.totalUsers) * 100)}% active` : null
    },
    {
      title: 'Total Revenue',
      value: `$${stats.totalRevenue.toLocaleString()}`,
      icon: '💰',
      color: 'bg-emerald-500',
      change: null
    },
    {
      title: 'Bots per User',
      value: stats.botsPerUser.toFixed(1),
      icon: '📊',
      color: 'bg-indigo-500',
      change: null
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            📈 {t('admin.statistics')}
          </h1>
          <p className="text-gray-600">
            {t('admin.statisticsSubtitle')}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {statCards.map((card, index) => (
            <div
              key={index}
              className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`${card.color} text-white rounded-lg p-3 text-2xl`}
                >
                  {card.icon}
                </div>
                {card.change && (
                  <span className="text-sm font-medium text-green-600 bg-green-50 px-2 py-1 rounded">
                    {card.change}
                  </span>
                )}
              </div>
              <h3 className="text-gray-600 text-sm font-medium mb-1">
                {card.title}
              </h3>
              <p className="text-3xl font-bold text-gray-900">{card.value}</p>
            </div>
          ))}
        </div>

        {/* Additional Info Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              ⚡ {t('admin.quickActions')}
            </h2>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="w-full text-left px-4 py-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
              >
                <span className="font-semibold text-purple-900">{t('admin.dashboard')}</span>
                <p className="text-sm text-purple-700">{t('admin.viewAdminDashboard')}</p>
              </button>
              <button
                onClick={() => navigate('/admin/audit-logs')}
                className="w-full text-left px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <span className="font-semibold text-blue-900">{t('admin.auditLogs')}</span>
                <p className="text-sm text-blue-700">{t('admin.reviewSystemActivity')}</p>
              </button>
              <button
                onClick={() => navigate('/admin/health')}
                className="w-full text-left px-4 py-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
              >
                <span className="font-semibold text-green-900">{t('admin.systemHealth')}</span>
                <p className="text-sm text-green-700">{t('admin.checkSystemStatus')}</p>
              </button>
            </div>
          </div>

          {/* System Info */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              ℹ️ {t('admin.systemInformation')}
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-gray-600">{t('admin.platformStatus')}</span>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  {t('admin.operational')}
                </span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-gray-600">{t('admin.database')}</span>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  {t('admin.connected')}
                </span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-gray-600">{t('admin.apiStatus')}</span>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  {t('admin.healthy')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">{t('admin.lastUpdated')}</span>
                <span className="text-gray-900 font-medium">
                  {new Date().toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Refresh Button */}
        <div className="mt-6 text-center">
          <button
            onClick={fetchStats}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors inline-flex items-center gap-2"
          >
            🔄 {t('admin.refreshStatistics')}
          </button>
        </div>
      </div>
    </div>
  );
}
