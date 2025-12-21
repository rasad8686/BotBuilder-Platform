import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axiosInstance from '../api/axios';
import { SkeletonDashboard } from '../components/SkeletonLoader';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

// Chart color palette
const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
const MESSAGE_TYPE_COLORS = {
  user_message: '#3b82f6',
  response: '#10b981',
  greeting: '#f59e0b',
  fallback: '#ef4444'
};

function Analytics() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState(30);
  const [selectedBot, setSelectedBot] = useState('all');
  const [bots, setBots] = useState([]);

  // Analytics data
  const [overview, setOverview] = useState({
    totalMessages: 0,
    totalSessions: 0,
    activeBots: 0
  });
  const [dailyTrend, setDailyTrend] = useState([]);
  const [hourlyDistribution, setHourlyDistribution] = useState([]);
  const [messageTypes, setMessageTypes] = useState([]);
  const [botStats, setBotStats] = useState([]);
  const [topQuestions, setTopQuestions] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [responseMetrics, setResponseMetrics] = useState({
    successRate: 100,
    fallbackRate: 0,
    uniqueSessions: 0
  });

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch comprehensive data
      const params = new URLSearchParams({ days: dateRange });
      if (selectedBot !== 'all') {
        params.append('botId', selectedBot);
      }

      const [comprehensiveRes, topQuestionsRes, recentRes, metricsRes] = await Promise.all([
        axiosInstance.get(`/api/analytics/comprehensive?${params}`),
        axiosInstance.get(`/api/analytics/top-questions?limit=10`),
        axiosInstance.get(`/api/analytics/recent-activity`),
        axiosInstance.get(`/api/analytics/response-metrics`)
      ]);

      if (comprehensiveRes.data.success) {
        const data = comprehensiveRes.data.data;
        setOverview(data.overview);
        setDailyTrend(data.dailyTrend);
        setHourlyDistribution(data.hourlyDistribution);
        setMessageTypes(data.messageTypes);
        setBotStats(data.botStats);
        setBots(data.botStats.map(b => ({ id: b.id, name: b.name })));
      }

      if (topQuestionsRes.data.success) {
        setTopQuestions(topQuestionsRes.data.data);
      }

      if (recentRes.data.success) {
        setRecentActivity(recentRes.data.data);
      }

      if (metricsRes.data.success) {
        setResponseMetrics(metricsRes.data.data);
      }

    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedBot]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Export handlers
  const handleExportCSV = async (type = 'messages') => {
    try {
      const response = await axiosInstance.get(
        `/api/analytics/export?type=${type}&days=${dateRange}`,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Export failed. Please try again.');
    }
  };

  // Format date for display
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' });
  };

  // Format hour for display
  const formatHour = (hour) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
  };

  if (loading) {
    return <SkeletonDashboard />;
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header with Filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('analytics.title', 'Analytics Dashboard')}</h1>
          <p className="text-gray-500 mt-1">{t('analytics.subtitle', 'Monitor your bot performance and user engagement')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Range Filter */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value={7}>{t('analytics.last7Days', 'Last 7 days')}</option>
            <option value={30}>{t('analytics.last30Days', 'Last 30 days')}</option>
            <option value={90}>{t('analytics.last90Days', 'Last 90 days')}</option>
          </select>

          {/* Bot Filter */}
          <select
            value={selectedBot}
            onChange={(e) => setSelectedBot(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="all">{t('analytics.allBots', 'All Bots')}</option>
            {bots.map(bot => (
              <option key={bot.id} value={bot.id}>{bot.name}</option>
            ))}
          </select>

          {/* Export Button */}
          <div className="relative group">
            <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {t('analytics.export', 'Export')}
            </button>
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button
                onClick={() => handleExportCSV('messages')}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 rounded-t-lg"
              >
                {t('analytics.exportMessages', 'Export Messages (CSV)')}
              </button>
              <button
                onClick={() => handleExportCSV('daily')}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 rounded-b-lg"
              >
                {t('analytics.exportDaily', 'Export Daily Stats (CSV)')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{t('analytics.totalMessages', 'Total Messages')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{overview.totalMessages.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{t('analytics.uniqueSessions', 'Unique Sessions')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{overview.totalSessions.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-cyan-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{t('analytics.successRate', 'Success Rate')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{responseMetrics.successRate}%</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{t('analytics.activeBots', 'Active Bots')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{overview.activeBots}</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 1: Daily Trend + Hourly Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Messages Trend - Line Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('analytics.messagesTrend', 'Messages Trend')}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dailyTrend}>
              <defs>
                <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="#9ca3af"
                fontSize={12}
              />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip
                labelFormatter={(value) => new Date(value).toLocaleDateString()}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#8b5cf6"
                strokeWidth={2}
                fill="url(#colorMessages)"
                name={t('analytics.messages', 'Messages')}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Hourly Activity - Bar Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('analytics.hourlyActivity', 'Hourly Activity')}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={hourlyDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="hour"
                tickFormatter={formatHour}
                stroke="#9ca3af"
                fontSize={10}
                interval={2}
              />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip
                labelFormatter={(value) => formatHour(value)}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Bar
                dataKey="count"
                fill="#06b6d4"
                radius={[4, 4, 0, 0]}
                name={t('analytics.messages', 'Messages')}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2: Message Types + Bot Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Message Types - Pie Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('analytics.messageTypes', 'Message Types')}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={messageTypes}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="count"
                nameKey="type"
                label={({ type, percent }) => `${type}: ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {messageTypes.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={MESSAGE_TYPE_COLORS[entry.type] || COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Bot Performance - Bar Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('analytics.botPerformance', 'Bot Performance')}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={botStats.slice(0, 5)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" stroke="#9ca3af" fontSize={12} />
              <YAxis
                type="category"
                dataKey="name"
                width={100}
                stroke="#9ca3af"
                fontSize={12}
              />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Bar
                dataKey="messageCount"
                fill="#10b981"
                radius={[0, 4, 4, 0]}
                name={t('analytics.messages', 'Messages')}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Questions Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('analytics.topQuestions', 'Top Questions')}</h3>
          {topQuestions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">{t('analytics.noData', 'No data available')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">{t('analytics.question', 'Question')}</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-gray-500">{t('analytics.count', 'Count')}</th>
                  </tr>
                </thead>
                <tbody>
                  {topQuestions.map((item, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-2 text-sm text-gray-700 truncate max-w-xs" title={item.question}>
                        {item.question}
                      </td>
                      <td className="py-3 px-2 text-sm text-gray-900 font-medium text-right">
                        {item.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Activity Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('analytics.recentActivity', 'Recent Activity')}</h3>
          {recentActivity.length === 0 ? (
            <p className="text-gray-500 text-center py-8">{t('analytics.noData', 'No data available')}</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                >
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    activity.messageType === 'user_message' ? 'bg-blue-500' :
                    activity.messageType === 'response' ? 'bg-green-500' :
                    activity.messageType === 'greeting' ? 'bg-amber-500' :
                    'bg-red-500'
                  }`}></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-900">{activity.botName}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(activity.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 truncate">{activity.content}</p>
                    <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded ${
                      activity.messageType === 'user_message' ? 'bg-blue-100 text-blue-700' :
                      activity.messageType === 'response' ? 'bg-green-100 text-green-700' :
                      activity.messageType === 'greeting' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {activity.messageType}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => navigate('/create-bot')}
          className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 transition"
        >
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div className="text-left">
            <p className="font-semibold">{t('analytics.createBot', 'Create New Bot')}</p>
            <p className="text-sm opacity-80">{t('analytics.createBotDesc', 'Build a new chatbot')}</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/my-bots')}
          className="flex items-center gap-4 p-4 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-xl hover:from-cyan-600 hover:to-cyan-700 transition"
        >
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </div>
          <div className="text-left">
            <p className="font-semibold">{t('analytics.manageBots', 'Manage Bots')}</p>
            <p className="text-sm opacity-80">{t('analytics.manageBotsDesc', 'View all your bots')}</p>
          </div>
        </button>

        <button
          onClick={() => handleExportCSV('daily')}
          className="flex items-center gap-4 p-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition"
        >
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="text-left">
            <p className="font-semibold">{t('analytics.downloadReport', 'Download Report')}</p>
            <p className="text-sm opacity-80">{t('analytics.downloadReportDesc', 'Export daily stats')}</p>
          </div>
        </button>
      </div>
    </div>
  );
}

export default Analytics;
