import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { BarChart3, TrendingUp, Key, RefreshCw, Zap, CheckCircle, DollarSign } from 'lucide-react';
import APIKeyList from './APIKeyList';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const STATUS_COLORS = {
  '2xx': '#10b981',
  '3xx': '#3b82f6',
  '4xx': '#f59e0b',
  '5xx': '#ef4444'
};

export default function APIUsageDashboard() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apiKeys, setApiKeys] = useState([]);
  const [selectedKeyId, setSelectedKeyId] = useState('all');
  const [dateRange, setDateRange] = useState('7d');
  const [customDates, setCustomDates] = useState({ start: '', end: '' });
  const [activeTab, setActiveTab] = useState('dashboard');

  // Usage data
  const [usageData, setUsageData] = useState({
    summary: {
      totalRequests: 0,
      avgResponseTime: 0,
      successRate: 0,
      totalCost: 0
    },
    requestsOverTime: [],
    responseTimeTrend: [],
    statusCodes: [],
    topEndpoints: []
  });

  const token = localStorage.getItem('token');

  // Fetch API keys
  const fetchApiKeys = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/api-tokens`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setApiKeys(data.tokens || data || []);
      }
    } catch (err) {
      // Silent fail
    }
  }, [token]);

  // Fetch usage data
  const fetchUsageData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let url = `${API_URL}/api/api-tokens`;
      if (selectedKeyId !== 'all') {
        url += `/${selectedKeyId}`;
      }
      url += `/usage?range=${dateRange}`;

      if (dateRange === 'custom' && customDates.start && customDates.end) {
        url += `&start=${customDates.start}&end=${customDates.end}`;
      }

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Failed to fetch usage data');
      }

      const data = await res.json();

      // Transform data for charts
      setUsageData({
        summary: data.summary || {
          totalRequests: data.totalRequests || 0,
          avgResponseTime: data.avgResponseTime || 0,
          successRate: data.successRate || 100,
          totalCost: data.totalCost || 0
        },
        requestsOverTime: data.requestsOverTime || generateMockTimeData(),
        responseTimeTrend: data.responseTimeTrend || generateMockResponseTimeData(),
        statusCodes: data.statusCodes || generateMockStatusCodes(),
        topEndpoints: data.topEndpoints || generateMockEndpoints()
      });
    } catch (err) {
      setError(err.message);
      // Use mock data for demo
      setUsageData({
        summary: {
          totalRequests: 15420,
          avgResponseTime: 245,
          successRate: 98.5,
          totalCost: 12.45
        },
        requestsOverTime: generateMockTimeData(),
        responseTimeTrend: generateMockResponseTimeData(),
        statusCodes: generateMockStatusCodes(),
        topEndpoints: generateMockEndpoints()
      });
    } finally {
      setLoading(false);
    }
  }, [selectedKeyId, dateRange, customDates, token]);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  useEffect(() => {
    fetchUsageData();
  }, [fetchUsageData]);

  // Mock data generators
  function generateMockTimeData() {
    const data = [];
    const days = dateRange === 'today' ? 24 : dateRange === '7d' ? 7 : 30;
    const isHourly = dateRange === 'today';

    for (let i = 0; i < days; i++) {
      const date = new Date();
      if (isHourly) {
        date.setHours(date.getHours() - (days - 1 - i));
        data.push({
          date: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          requests: Math.floor(Math.random() * 500) + 100
        });
      } else {
        date.setDate(date.getDate() - (days - 1 - i));
        data.push({
          date: date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
          requests: Math.floor(Math.random() * 2000) + 500
        });
      }
    }
    return data;
  }

  function generateMockResponseTimeData() {
    const data = [];
    const points = dateRange === 'today' ? 24 : dateRange === '7d' ? 7 : 30;

    for (let i = 0; i < points; i++) {
      const date = new Date();
      if (dateRange === 'today') {
        date.setHours(date.getHours() - (points - 1 - i));
        data.push({
          time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          responseTime: Math.floor(Math.random() * 200) + 150
        });
      } else {
        date.setDate(date.getDate() - (points - 1 - i));
        data.push({
          time: date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
          responseTime: Math.floor(Math.random() * 200) + 150
        });
      }
    }
    return data;
  }

  function generateMockStatusCodes() {
    return [
      { name: '2xx', value: 14250, color: STATUS_COLORS['2xx'] },
      { name: '3xx', value: 320, color: STATUS_COLORS['3xx'] },
      { name: '4xx', value: 680, color: STATUS_COLORS['4xx'] },
      { name: '5xx', value: 170, color: STATUS_COLORS['5xx'] }
    ];
  }

  function generateMockEndpoints() {
    return [
      { endpoint: '/api/bots', requests: 4520 },
      { endpoint: '/api/messages', requests: 3890 },
      { endpoint: '/api/analytics', requests: 2340 },
      { endpoint: '/api/users', requests: 1980 },
      { endpoint: '/api/webhooks', requests: 1450 }
    ];
  }

  const handleKeyCreated = () => {
    fetchApiKeys();
  };

  const handleKeyDeleted = () => {
    fetchApiKeys();
    if (selectedKeyId !== 'all') {
      setSelectedKeyId('all');
    }
  };

  if (loading && activeTab === 'dashboard') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6" role="status" aria-busy="true" aria-label="Loading usage data">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" aria-hidden="true"></div>
              <p className="text-gray-600 dark:text-gray-400">{t('common.loading')}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <BarChart3 size={32} aria-hidden="true" />
            {t('developer.usageDashboard', 'API Usage Dashboard')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {t('developer.usageDescription', 'Monitor your API usage, performance metrics, and costs')}
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700" role="tablist" aria-label="Dashboard navigation">
          <nav className="flex gap-4">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'dashboard'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
              role="tab"
              aria-selected={activeTab === 'dashboard'}
              aria-controls="panel-dashboard"
            >
              <TrendingUp size={16} aria-hidden="true" style={{ display: 'inline', marginRight: '4px' }} /> {t('developer.usageStats', 'Usage Statistics')}
            </button>
            <button
              onClick={() => setActiveTab('keys')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'keys'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
              role="tab"
              aria-selected={activeTab === 'keys'}
              aria-controls="panel-keys"
            >
              <Key size={16} aria-hidden="true" style={{ display: 'inline', marginRight: '4px' }} /> {t('developer.apiKeys', 'API Keys')}
            </button>
          </nav>
        </div>

        {activeTab === 'dashboard' && (
          <div id="panel-dashboard" role="tabpanel">
            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6 flex flex-wrap gap-4 items-end">
              {/* API Key Select */}
              <div>
                <label htmlFor="api-key-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('developer.apiKey', 'API Key')}
                </label>
                <select
                  id="api-key-select"
                  value={selectedKeyId}
                  onChange={(e) => setSelectedKeyId(e.target.value)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">{t('developer.allKeys', 'All Keys')}</option>
                  {apiKeys.map(key => (
                    <option key={key.id} value={key.id}>
                      {key.name} ({key.token_preview || key.key?.slice(-8) || '***'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range Select */}
              <div>
                <label htmlFor="date-range-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('developer.dateRange', 'Date Range')}
                </label>
                <select
                  id="date-range-select"
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="today">{t('developer.today', 'Today')}</option>
                  <option value="7d">{t('developer.last7Days', 'Last 7 Days')}</option>
                  <option value="30d">{t('developer.last30Days', 'Last 30 Days')}</option>
                  <option value="custom">{t('developer.custom', 'Custom')}</option>
                </select>
              </div>

              {/* Custom Date Inputs */}
              {dateRange === 'custom' && (
                <>
                  <div>
                    <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('developer.startDate', 'Start Date')}
                    </label>
                    <input
                      id="start-date"
                      type="date"
                      value={customDates.start}
                      onChange={(e) => setCustomDates(prev => ({ ...prev, start: e.target.value }))}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('developer.endDate', 'End Date')}
                    </label>
                    <input
                      id="end-date"
                      type="date"
                      value={customDates.end}
                      onChange={(e) => setCustomDates(prev => ({ ...prev, end: e.target.value }))}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </>
              )}

              {/* Refresh Button */}
              <button
                onClick={fetchUsageData}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                aria-label={t('common.refresh', 'Refresh data')}
              >
                <RefreshCw size={16} aria-hidden="true" />
                {t('common.refresh', 'Refresh')}
              </button>
            </div>

            {error && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6" role="alert">
                <p className="text-yellow-800 dark:text-yellow-200">
                  {t('developer.usingDemoData', 'Using demo data. Connect to API for real metrics.')}
                </p>
              </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <SummaryCard
                title={t('developer.totalRequests', 'Total Requests')}
                value={usageData.summary.totalRequests.toLocaleString()}
                Icon={BarChart3}
                color="blue"
              />
              <SummaryCard
                title={t('developer.avgResponseTime', 'Avg Response Time')}
                value={`${usageData.summary.avgResponseTime}ms`}
                Icon={Zap}
                color="green"
              />
              <SummaryCard
                title={t('developer.successRate', 'Success Rate')}
                value={`${usageData.summary.successRate}%`}
                Icon={CheckCircle}
                color="emerald"
              />
              <SummaryCard
                title={t('developer.totalCost', 'Total Cost')}
                value={`$${usageData.summary.totalCost.toFixed(2)}`}
                Icon={DollarSign}
                color="purple"
              />
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Requests Over Time */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  {t('developer.requestsOverTime', 'Requests Over Time')}
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={usageData.requestsOverTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#fff'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="requests"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Response Time Trend */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  {t('developer.responseTimeTrend', 'Response Time Trend')}
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={usageData.responseTimeTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="time" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" unit="ms" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#fff'
                      }}
                      formatter={(value) => [`${value}ms`, 'Response Time']}
                    />
                    <Line
                      type="monotone"
                      dataKey="responseTime"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Status Codes Breakdown */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  {t('developer.statusCodes', 'Status Codes Breakdown')}
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={usageData.statusCodes}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {usageData.statusCodes.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#fff'
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Top Endpoints */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  {t('developer.topEndpoints', 'Top Endpoints')}
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={usageData.topEndpoints} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <YAxis
                      type="category"
                      dataKey="endpoint"
                      tick={{ fontSize: 11 }}
                      stroke="#9ca3af"
                      width={120}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#fff'
                      }}
                    />
                    <Bar dataKey="requests" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'keys' && (
          <div id="panel-keys" role="tabpanel">
            <APIKeyList
              apiKeys={apiKeys}
              onKeyCreated={handleKeyCreated}
              onKeyDeleted={handleKeyDeleted}
              onRefresh={fetchApiKeys}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Summary Card Component
function SummaryCard({ title, value, Icon, color }) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`} aria-hidden="true">
          {Icon && <Icon size={24} />}
        </div>
      </div>
    </div>
  );
}
