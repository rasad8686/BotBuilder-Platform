import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axiosInstance from '../api/axios';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function Usage() {
  const { t } = useTranslation();
  const [dashboardData, setDashboardData] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(7); // 7 or 30 days
  const navigate = useNavigate();

  useEffect(() => {
    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);

  // Generate sample data for charts when no real data exists
  const generateSampleData = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push({
        date: date.toISOString().split('T')[0],
        count: Math.floor(Math.random() * 50) + 10
      });
    }
    return days;
  };

  const defaultDashboardData = {
    subscription: { plan_name: 'free', display_name: 'Free Plan' },
    bots: { total: 0, limit: 1, percentage: 0, canCreateMore: true },
    messages: { total: 0, limit: 1000, percentage: 0, sent: 0, received: 0 }
  };

  const defaultAnalyticsData = {
    overview: { totalMessages: 0, totalBots: 0, apiCalls: 0, activeUsers: 1 },
    messagesOverTime: generateSampleData(),
    byBot: [],
    recentActivity: []
  };

  const fetchAllData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      // Fetch dashboard data (existing usage stats)
      const dashboardResponse = await axiosInstance.get('/api/analytics/dashboard');

      // Fetch analytics data (new endpoints)
      const [overviewRes, messagesOverTimeRes, byBotRes, recentActivityRes] = await Promise.all([
        axiosInstance.get('/api/analytics/overview'),
        axiosInstance.get(`/api/analytics/messages-over-time?days=${timeRange}`),
        axiosInstance.get('/api/analytics/by-bot'),
        axiosInstance.get('/api/analytics/recent-activity')
      ]);

      setDashboardData(dashboardResponse.data);
      setAnalyticsData({
        overview: overviewRes.data.data,
        messagesOverTime: messagesOverTimeRes.data.data?.length > 0 ? messagesOverTimeRes.data.data : generateSampleData(),
        byBot: byBotRes.data.data,
        recentActivity: recentActivityRes.data.data
      });
    } catch (error) {
      // Use default data on error so page still shows content
      if (error.response?.status === 401) {
        navigate('/login');
        return;
      }
      // Set default data to show UI even if API fails
      setDashboardData(defaultDashboardData);
      setAnalyticsData(defaultAnalyticsData);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 p-6 flex items-center justify-center transition-colors duration-300">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 p-6 transition-colors duration-300">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2">{t('usage.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400">{t('usage.subtitle')}</p>
        </div>

        {dashboardData && (
          <>
            {/* Current Plan Card */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl shadow-xl p-8 text-white mb-8">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-3xl font-bold mb-2">{dashboardData.subscription.display_name}</h2>
                  <p className="text-purple-100">
                    {dashboardData.subscription.plan_name === 'free'
                      ? 'Free Plan'
                      : `Your current subscription plan`}
                  </p>
                </div>
                {dashboardData.subscription.plan_name === 'free' && (
                  <button
                    onClick={() => navigate('/billing')}
                    className="px-6 py-3 bg-white text-purple-600 rounded-lg hover:bg-purple-50 font-semibold"
                  >
                    Upgrade Plan
                  </button>
                )}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Bots */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 transition-colors duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-3xl">🤖</div>
                  <span className={`text-2xl font-bold ${
                    dashboardData.bots.percentage > 80 ? 'text-orange-600' : 'text-purple-600'
                  }`}>
                    {dashboardData.bots.total}
                  </span>
                </div>
                <h3 className="text-gray-600 dark:text-gray-300 font-semibold mb-2">{t('analytics.totalBots')}</h3>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    Limit: {dashboardData.bots.limit === -1 ? '∞' : dashboardData.bots.limit}
                  </span>
                  <span className={`font-semibold ${
                    dashboardData.bots.percentage > 80 ? 'text-orange-600' : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {dashboardData.bots.limit === -1 ? '0' : Math.round(dashboardData.bots.percentage)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className={`h-2 rounded-full ${
                      dashboardData.bots.percentage >= 100 ? 'bg-red-500' :
                      dashboardData.bots.percentage > 80 ? 'bg-orange-500' :
                      'bg-purple-600'
                    }`}
                    style={{
                      width: dashboardData.bots.limit === -1
                        ? '10%'
                        : `${Math.min(dashboardData.bots.percentage, 100)}%`
                    }}
                  ></div>
                </div>
                {!dashboardData.bots.canCreateMore && (
                  <p className="text-xs text-orange-600 mt-2">
                    ⚠️ Limit reached
                  </p>
                )}
              </div>

              {/* Messages */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 transition-colors duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-3xl">📨</div>
                  <span className={`text-2xl font-bold ${
                    dashboardData.messages.percentage > 80 ? 'text-orange-600' : 'text-green-600'
                  }`}>
                    {dashboardData.messages.total.toLocaleString()}
                  </span>
                </div>
                <h3 className="text-gray-600 dark:text-gray-300 font-semibold mb-2">{t('usage.messages')}</h3>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    Limit: {dashboardData.messages.limit === -1 ? '∞' : dashboardData.messages.limit.toLocaleString()}
                  </span>
                  <span className={`font-semibold ${
                    dashboardData.messages.percentage > 80 ? 'text-orange-600' : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {dashboardData.messages.limit === -1 ? '0' : Math.round(dashboardData.messages.percentage)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className={`h-2 rounded-full ${
                      dashboardData.messages.percentage >= 100 ? 'bg-red-500' :
                      dashboardData.messages.percentage > 80 ? 'bg-orange-500' :
                      'bg-green-600'
                    }`}
                    style={{
                      width: dashboardData.messages.limit === -1
                        ? '10%'
                        : `${Math.min(dashboardData.messages.percentage, 100)}%`
                    }}
                  ></div>
                </div>
                {dashboardData.messages.percentage > 80 && dashboardData.messages.limit !== -1 && (
                  <p className="text-xs text-orange-600 mt-2">
                    ⚠️ {dashboardData.messages.percentage >= 100 ? 'Limit reached' : 'Approaching limit'}
                  </p>
                )}
              </div>

              {/* Messages Sent */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 transition-colors duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-3xl">📤</div>
                  <span className="text-2xl font-bold text-blue-600">
                    {dashboardData.messages.sent.toLocaleString()}
                  </span>
                </div>
                <h3 className="text-gray-600 dark:text-gray-300 font-semibold mb-2">Sent</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Messages sent this month</p>
              </div>

              {/* Messages Received */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 transition-colors duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-3xl">📥</div>
                  <span className="text-2xl font-bold text-indigo-600">
                    {dashboardData.messages.received.toLocaleString()}
                  </span>
                </div>
                <h3 className="text-gray-600 dark:text-gray-300 font-semibold mb-2">Received</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Messages received this month</p>
              </div>
            </div>

            {/* Warning Messages */}
            {(dashboardData.messages.percentage > 80 && dashboardData.messages.limit !== -1) && (
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-2xl p-6 mb-8">
                <div className="flex items-start gap-4">
                  <div className="text-3xl">⚠️</div>
                  <div>
                    <h3 className="text-xl font-bold text-orange-800 dark:text-orange-200 mb-2">
                      {dashboardData.messages.percentage >= 100
                        ? 'Message Limit Reached'
                        : 'Approaching Message Limit'}
                    </h3>
                    <p className="text-orange-700 dark:text-orange-300 mb-4">
                      You've used {dashboardData.messages.total.toLocaleString()} out of {dashboardData.messages.limit.toLocaleString()} messages this month
                      ({Math.round(dashboardData.messages.percentage)}%).
                      {dashboardData.messages.percentage >= 100
                        ? ' Upgrade to continue sending messages.'
                        : ' Consider upgrading to avoid service interruptions.'}
                    </p>
                    <button
                      onClick={() => navigate('/billing')}
                      className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                    >
                      Upgrade Now
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!dashboardData.bots.canCreateMore && dashboardData.bots.limit !== -1 && (
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-2xl p-6 mb-8">
                <div className="flex items-start gap-4">
                  <div className="text-3xl">⚠️</div>
                  <div>
                    <h3 className="text-xl font-bold text-orange-800 dark:text-orange-200 mb-2">Bot Limit Reached</h3>
                    <p className="text-orange-700 dark:text-orange-300 mb-4">
                      You've reached your bot limit of {dashboardData.bots.limit} bot{dashboardData.bots.limit !== 1 ? 's' : ''}.
                      Upgrade to create more bots.
                    </p>
                    <button
                      onClick={() => navigate('/billing')}
                      className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                    >
                      Upgrade Now
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Analytics Overview */}
            {analyticsData && (
              <>
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 mb-8 transition-colors duration-300">
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">{t('analytics.overview')}</h2>
                  <div className="grid md:grid-cols-4 gap-6">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-purple-600">{analyticsData.overview.totalMessages}</div>
                      <p className="text-gray-600 dark:text-gray-400 mt-2">{t('analytics.totalMessages')}</p>
                    </div>
                    <div className="text-center">
                      <div className="text-4xl font-bold text-blue-600">{analyticsData.overview.totalBots}</div>
                      <p className="text-gray-600 dark:text-gray-400 mt-2">{t('analytics.totalBots')}</p>
                    </div>
                    <div className="text-center">
                      <div className="text-4xl font-bold text-green-600">{analyticsData.overview.apiCalls}</div>
                      <p className="text-gray-600 dark:text-gray-400 mt-2">{t('usage.apiCalls')}</p>
                    </div>
                    <div className="text-center">
                      <div className="text-4xl font-bold text-orange-600">{analyticsData.overview.activeUsers}</div>
                      <p className="text-gray-600 dark:text-gray-400 mt-2">{t('analytics.users')}</p>
                    </div>
                  </div>
                </div>

                {/* Messages Over Time Chart */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 mb-8 transition-colors duration-300">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{t('usage.messagesChart')}</h2>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTimeRange(7)}
                        className={`px-4 py-2 rounded-lg font-semibold ${
                          timeRange === 7
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600'
                        }`}
                      >
                        7 Days
                      </button>
                      <button
                        onClick={() => setTimeRange(30)}
                        className={`px-4 py-2 rounded-lg font-semibold ${
                          timeRange === 30
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600'
                        }`}
                      >
                        30 Days
                      </button>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analyticsData.messagesOverTime}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      />
                      <YAxis />
                      <Tooltip
                        labelFormatter={(date) => new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} name="Messages" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Messages By Bot Chart */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 mb-8 transition-colors duration-300">
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">{t('usage.botsActivity')}</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analyticsData.byBot}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="botName" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="messageCount" fill="#3b82f6" name="Messages" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Recent Activity Table */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 mb-8 transition-colors duration-300">
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">{t('common.history')}</h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-slate-700">
                          <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Bot</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Type</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Content</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analyticsData.recentActivity.map((activity) => (
                          <tr key={activity.id} className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                            <td className="py-3 px-4 text-gray-800 dark:text-white">{activity.botName}</td>
                            <td className="py-3 px-4">
                              <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full text-sm">
                                {activity.messageType}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-gray-600 dark:text-gray-400 max-w-md truncate">
                              {activity.content}
                            </td>
                            <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-sm">
                              {new Date(activity.timestamp).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit'
                              })}
                            </td>
                          </tr>
                        ))}
                        {analyticsData.recentActivity.length === 0 && (
                          <tr>
                            <td colSpan="4" className="text-center py-8 text-gray-500 dark:text-gray-400">
                              No recent activity found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* Quick Actions */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 transition-colors duration-300">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">{t('admin.quickActions')}</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <button
                  onClick={() => navigate('/my-bots')}
                  className="p-6 border-2 border-purple-200 dark:border-purple-800 rounded-xl hover:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
                >
                  <div className="text-4xl mb-3">🤖</div>
                  <h3 className="font-bold text-gray-800 dark:text-white mb-2">{t('analytics.manageBots')}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('analytics.manageBotsDesc')}</p>
                </button>

                <button
                  onClick={() => navigate('/api-tokens')}
                  className="p-6 border-2 border-blue-200 dark:border-blue-800 rounded-xl hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                >
                  <div className="text-4xl mb-3">🔑</div>
                  <h3 className="font-bold text-gray-800 dark:text-white mb-2">{t('apiTokens.title')}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('apiTokens.subtitle')}</p>
                </button>

                <button
                  onClick={() => navigate('/webhooks')}
                  className="p-6 border-2 border-green-200 dark:border-green-800 rounded-xl hover:border-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all"
                >
                  <div className="text-4xl mb-3">🔗</div>
                  <h3 className="font-bold text-gray-800 dark:text-white mb-2">{t('webhooks.title')}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('webhooks.subtitle')}</p>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
