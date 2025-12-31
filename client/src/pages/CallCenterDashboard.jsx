/**
 * Call Center Dashboard
 * Real-time monitoring of voice calls, agents, and performance metrics
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Users,
  Clock,
  TrendingUp,
  Activity,
  Headphones,
  BarChart3,
  AlertCircle,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  Volume2,
  Mic,
  Settings,
  RefreshCw,
  Download,
  Filter,
  Calendar,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import api from '../services/api';

const CallCenterDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState('today');

  // Dashboard metrics
  const [metrics, setMetrics] = useState({
    totalCalls: 0,
    activeCalls: 0,
    inboundCalls: 0,
    outboundCalls: 0,
    missedCalls: 0,
    avgWaitTime: 0,
    avgCallDuration: 0,
    callsPerHour: 0,
    successRate: 0,
    customerSatisfaction: 0
  });

  // Active calls
  const [activeCalls, setActiveCalls] = useState([]);

  // Recent calls
  const [recentCalls, setRecentCalls] = useState([]);

  // Agents status
  const [agents, setAgents] = useState([]);

  // Performance data for charts
  const [hourlyData, setHourlyData] = useState([]);

  // Queue statistics
  const [queueStats, setQueueStats] = useState({
    waiting: 0,
    avgWaitTime: 0,
    longestWait: 0
  });

  const fetchDashboardData = useCallback(async () => {
    try {
      setRefreshing(true);

      const [metricsRes, callsRes, agentsRes, queueRes] = await Promise.all([
        api.get(`/api/voice/call-center/metrics?range=${dateRange}`),
        api.get('/api/voice/call-center/calls/active'),
        api.get('/api/voice/call-center/agents'),
        api.get('/api/voice/call-center/queue')
      ]);

      if (metricsRes.data) {
        setMetrics(metricsRes.data.metrics || metrics);
        setHourlyData(metricsRes.data.hourlyData || []);
        setRecentCalls(metricsRes.data.recentCalls || []);
      }

      if (callsRes.data) {
        setActiveCalls(callsRes.data.calls || []);
      }

      if (agentsRes.data) {
        setAgents(agentsRes.data.agents || []);
      }

      if (queueRes.data) {
        setQueueStats(queueRes.data);
      }

      setError(null);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchDashboardData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      ringing: 'bg-yellow-100 text-yellow-800',
      on_hold: 'bg-blue-100 text-blue-800',
      completed: 'bg-gray-100 text-gray-800',
      failed: 'bg-red-100 text-red-800',
      available: 'bg-green-100 text-green-800',
      busy: 'bg-red-100 text-red-800',
      away: 'bg-yellow-100 text-yellow-800',
      offline: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const MetricCard = ({ title, value, subtitle, icon: Icon, trend, trendUp }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className="p-3 bg-purple-100 rounded-xl">
          <Icon className="w-6 h-6 text-purple-600" />
        </div>
      </div>
      {trend !== undefined && (
        <div className={`flex items-center mt-3 text-sm ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
          {trendUp ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
          <span>{trend}% vs last period</span>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Call Center Dashboard</h1>
          <p className="text-gray-600 mt-1">Real-time monitoring and analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
          <button
            onClick={fetchDashboardData}
            disabled={refreshing}
            className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => navigate('/voice/settings')}
            className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Live Queue Alert */}
      {queueStats.waiting > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5 animate-pulse" />
            <span className="font-medium">{queueStats.waiting} calls waiting in queue</span>
            <span className="text-yellow-600">
              (Avg wait: {formatDuration(queueStats.avgWaitTime)})
            </span>
          </div>
          <button
            onClick={() => navigate('/voice/calls')}
            className="text-yellow-700 hover:text-yellow-900 font-medium flex items-center gap-1"
          >
            View Queue <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Total Calls"
          value={metrics.totalCalls.toLocaleString()}
          subtitle="All calls today"
          icon={Phone}
          trend={12}
          trendUp={true}
        />
        <MetricCard
          title="Active Calls"
          value={metrics.activeCalls}
          subtitle="Currently in progress"
          icon={Headphones}
        />
        <MetricCard
          title="Inbound"
          value={metrics.inboundCalls}
          subtitle="Incoming calls"
          icon={PhoneIncoming}
        />
        <MetricCard
          title="Outbound"
          value={metrics.outboundCalls}
          subtitle="Outgoing calls"
          icon={PhoneOutgoing}
        />
        <MetricCard
          title="Missed"
          value={metrics.missedCalls}
          subtitle="Unanswered calls"
          icon={PhoneMissed}
          trend={5}
          trendUp={false}
        />
      </div>

      {/* Second Row Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Avg Wait Time"
          value={formatDuration(metrics.avgWaitTime)}
          icon={Clock}
        />
        <MetricCard
          title="Avg Call Duration"
          value={formatDuration(metrics.avgCallDuration)}
          icon={Activity}
        />
        <MetricCard
          title="Success Rate"
          value={`${metrics.successRate}%`}
          icon={CheckCircle}
          trend={3}
          trendUp={true}
        />
        <MetricCard
          title="Satisfaction"
          value={`${metrics.customerSatisfaction}/5`}
          icon={TrendingUp}
        />
      </div>

      {/* Active Calls & Agents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Calls */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <h2 className="text-lg font-semibold text-gray-900">Active Calls</h2>
              <span className="text-sm text-gray-500">({activeCalls.length})</span>
            </div>
            <button
              onClick={() => navigate('/voice/calls')}
              className="text-purple-600 hover:text-purple-700 text-sm font-medium"
            >
              View All
            </button>
          </div>
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {activeCalls.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Phone className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p>No active calls</p>
              </div>
            ) : (
              activeCalls.map((call) => (
                <div key={call.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${call.direction === 'inbound' ? 'bg-blue-100' : 'bg-green-100'}`}>
                        {call.direction === 'inbound' ? (
                          <PhoneIncoming className="w-4 h-4 text-blue-600" />
                        ) : (
                          <PhoneOutgoing className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{call.callerNumber || call.from}</p>
                        <p className="text-sm text-gray-500">{call.botName || 'Unknown Bot'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(call.status)}`}>
                        {call.status}
                      </span>
                      <p className="text-sm text-gray-500 mt-1">{formatDuration(call.duration)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Agent Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Voice Bots</h2>
              <span className="text-sm text-gray-500">({agents.length})</span>
            </div>
            <button
              onClick={() => navigate('/voice/bots')}
              className="text-purple-600 hover:text-purple-700 text-sm font-medium"
            >
              Manage Bots
            </button>
          </div>
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {agents.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p>No voice bots configured</p>
              </div>
            ) : (
              agents.map((agent) => (
                <div key={agent.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                        <Mic className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{agent.name}</p>
                        <p className="text-sm text-gray-500">{agent.language || 'English'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(agent.status)}`}>
                        {agent.status}
                      </span>
                      <p className="text-sm text-gray-500 mt-1">{agent.activeCalls || 0} calls</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Calls Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Calls</h2>
          <div className="flex items-center gap-2">
            <button className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
              <Filter className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Call
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bot
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sentiment
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentCalls.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No recent calls
                  </td>
                </tr>
              ) : (
                recentCalls.slice(0, 10).map((call) => (
                  <tr
                    key={call.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/voice/calls/${call.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {call.direction === 'inbound' ? (
                          <PhoneIncoming className="w-4 h-4 text-blue-600" />
                        ) : (
                          <PhoneOutgoing className="w-4 h-4 text-green-600" />
                        )}
                        <span className="font-medium text-gray-900">{call.from || call.callerNumber}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {call.botName || '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {formatDuration(call.duration)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(call.status)}`}>
                        {call.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {formatTime(call.startTime)}
                    </td>
                    <td className="px-6 py-4">
                      {call.sentiment ? (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          call.sentiment === 'positive' ? 'bg-green-100 text-green-800' :
                          call.sentiment === 'negative' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {call.sentiment}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {recentCalls.length > 10 && (
          <div className="px-6 py-4 border-t border-gray-200 text-center">
            <button
              onClick={() => navigate('/voice/calls')}
              className="text-purple-600 hover:text-purple-700 font-medium"
            >
              View All Calls
            </button>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <button
          onClick={() => navigate('/voice/bots/new')}
          className="p-4 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
        >
          <Mic className="w-5 h-5" />
          Create Voice Bot
        </button>
        <button
          onClick={() => navigate('/voice/ivr')}
          className="p-4 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
        >
          <Activity className="w-5 h-5" />
          IVR Builder
        </button>
        <button
          onClick={() => navigate('/voice/phone-numbers')}
          className="p-4 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
        >
          <Phone className="w-5 h-5" />
          Phone Numbers
        </button>
        <button
          onClick={() => navigate('/voice/analytics')}
          className="p-4 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
        >
          <BarChart3 className="w-5 h-5" />
          Analytics
        </button>
      </div>
    </div>
  );
};

export default CallCenterDashboard;
