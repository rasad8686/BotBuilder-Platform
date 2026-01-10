import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  ThumbsUp,
  ThumbsDown,
  Star,
  MessageSquare,
  Users,
  Clock,
  RefreshCw,
  BarChart3,
  ArrowUpRight,
  Calendar
} from 'lucide-react';

const SurveyOverviewAnalyticsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');
  const [stats, setStats] = useState(null);
  const [topSurveys, setTopSurveys] = useState([]);
  const [recentResponses, setRecentResponses] = useState([]);
  const [trendData, setTrendData] = useState([]);

  // Get auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  // Fetch analytics data
  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const headers = getAuthHeaders();

        // Fetch overview analytics
        const response = await fetch(`/api/surveys/analytics/overview?period=${period}`, { headers });
        const data = await response.json();

        if (data.success) {
          setStats(data.stats);
          setTopSurveys(data.topSurveys || []);
          setRecentResponses(data.recentResponses || []);
          setTrendData(data.trend || []);
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
        // Mock data for development
        setStats({
          totalResponses: 1247,
          responseChange: 12.5,
          avgNPS: 42,
          npsChange: 5.2,
          avgCSAT: 4.3,
          csatChange: -2.1,
          responseRate: 34.5,
          rateChange: 8.3,
          promoters: 456,
          passives: 321,
          detractors: 167
        });
        setTopSurveys([
          { id: 1, name: 'Customer Satisfaction Survey', type: 'nps', responses: 456, avgScore: 8.4 },
          { id: 2, name: 'Product Feedback', type: 'rating', responses: 234, avgScore: 4.2 },
          { id: 3, name: 'Onboarding Experience', type: 'csat', responses: 189, avgScore: 4.5 },
          { id: 4, name: 'Support Ticket Feedback', type: 'rating', responses: 156, avgScore: 4.1 },
          { id: 5, name: 'Exit Survey', type: 'exit', responses: 98, avgScore: null }
        ]);
        setRecentResponses([
          { id: 1, surveyName: 'Customer Satisfaction Survey', respondent: 'John Doe', score: 9, category: 'promoter', submittedAt: new Date().toISOString() },
          { id: 2, surveyName: 'Product Feedback', respondent: 'Jane Smith', score: 4, category: null, submittedAt: new Date(Date.now() - 3600000).toISOString() },
          { id: 3, surveyName: 'Customer Satisfaction Survey', respondent: 'Bob Wilson', score: 6, category: 'detractor', submittedAt: new Date(Date.now() - 7200000).toISOString() },
          { id: 4, surveyName: 'Onboarding Experience', respondent: 'Alice Brown', score: 5, category: null, submittedAt: new Date(Date.now() - 10800000).toISOString() },
          { id: 5, surveyName: 'Support Ticket Feedback', respondent: 'Charlie Davis', score: 4, category: null, submittedAt: new Date(Date.now() - 14400000).toISOString() }
        ]);
        setTrendData([
          { date: '2025-01-01', responses: 45 },
          { date: '2025-01-02', responses: 52 },
          { date: '2025-01-03', responses: 48 },
          { date: '2025-01-04', responses: 61 },
          { date: '2025-01-05', responses: 55 },
          { date: '2025-01-06', responses: 67 },
          { date: '2025-01-07', responses: 72 }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [period]);

  // Format date
  const formatDate = (date) => {
    const now = new Date();
    const responseDate = new Date(date);
    const diffMs = now - responseDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return responseDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Get category color
  const getCategoryColor = (category) => {
    switch (category) {
      case 'promoter': return 'text-green-600';
      case 'passive': return 'text-yellow-600';
      case 'detractor': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  // Get change indicator
  const getChangeIndicator = (change) => {
    if (change > 0) {
      return (
        <span className="inline-flex items-center gap-1 text-green-600 text-sm">
          <TrendingUp className="w-4 h-4" />
          +{change}%
        </span>
      );
    } else if (change < 0) {
      return (
        <span className="inline-flex items-center gap-1 text-red-600 text-sm">
          <TrendingDown className="w-4 h-4" />
          {change}%
        </span>
      );
    }
    return <span className="text-gray-500 text-sm">0%</span>;
  };

  // Calculate max for chart
  const maxResponses = Math.max(...trendData.map(d => d.responses), 1);

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/surveys')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Survey Analytics</h1>
            <p className="text-gray-500 mt-1">Overview of all survey performance</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
          <p className="text-gray-500">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/surveys')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Survey Analytics</h1>
            <p className="text-gray-500 mt-1">Overview of all survey performance</p>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {['7d', '30d', '90d'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                period === p
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <MessageSquare className="w-5 h-5 text-blue-600" />
            </div>
            {stats && getChangeIndicator(stats.responseChange)}
          </div>
          <p className="text-sm text-gray-500">Total Responses</p>
          <p className="text-2xl font-bold text-gray-900">{stats?.totalResponses?.toLocaleString() || 0}</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-purple-50 rounded-lg">
              <ThumbsUp className="w-5 h-5 text-purple-600" />
            </div>
            {stats && getChangeIndicator(stats.npsChange)}
          </div>
          <p className="text-sm text-gray-500">Average NPS</p>
          <p className="text-2xl font-bold text-gray-900">{stats?.avgNPS || 0}</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-orange-50 rounded-lg">
              <Star className="w-5 h-5 text-orange-600" />
            </div>
            {stats && getChangeIndicator(stats.csatChange)}
          </div>
          <p className="text-sm text-gray-500">Average CSAT</p>
          <p className="text-2xl font-bold text-gray-900">{stats?.avgCSAT || 0}/5</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-green-50 rounded-lg">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            {stats && getChangeIndicator(stats.rateChange)}
          </div>
          <p className="text-sm text-gray-500">Response Rate</p>
          <p className="text-2xl font-bold text-gray-900">{stats?.responseRate || 0}%</p>
        </div>
      </div>

      {/* Charts and Tables Row */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Response Trend Chart */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Response Trend</h3>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Calendar className="w-4 h-4" />
              Last {period === '7d' ? '7 days' : period === '30d' ? '30 days' : '90 days'}
            </div>
          </div>

          {/* Simple Bar Chart */}
          <div className="h-48 flex items-end gap-2">
            {trendData.map((item, index) => (
              <div
                key={index}
                className="flex-1 flex flex-col items-center"
              >
                <div
                  className="w-full bg-blue-500 rounded-t-sm transition-all hover:bg-blue-600"
                  style={{ height: `${(item.responses / maxResponses) * 100}%`, minHeight: '4px' }}
                />
                <span className="text-xs text-gray-400 mt-2">
                  {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* NPS Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-4">NPS Breakdown</h3>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">Promoters (9-10)</span>
                <span className="text-sm font-medium text-green-600">{stats?.promoters || 0}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${((stats?.promoters || 0) / (stats?.totalResponses || 1)) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">Passives (7-8)</span>
                <span className="text-sm font-medium text-yellow-600">{stats?.passives || 0}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-500 rounded-full"
                  style={{ width: `${((stats?.passives || 0) / (stats?.totalResponses || 1)) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">Detractors (0-6)</span>
                <span className="text-sm font-medium text-red-600">{stats?.detractors || 0}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full"
                  style={{ width: `${((stats?.detractors || 0) / (stats?.totalResponses || 1)) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100">
            <div className="text-center">
              <p className="text-sm text-gray-500">Net Promoter Score</p>
              <p className={`text-3xl font-bold ${(stats?.avgNPS || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stats?.avgNPS || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Top Performing Surveys */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Top Performing Surveys</h3>
            <button
              onClick={() => navigate('/surveys')}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View all
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            {topSurveys.map((survey, index) => (
              <div
                key={survey.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                onClick={() => navigate(`/surveys/${survey.id}/analytics`)}
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">{survey.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{survey.type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">{survey.responses}</p>
                  <p className="text-xs text-gray-500">responses</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Responses */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Recent Responses</h3>
            <button
              onClick={() => navigate('/surveys/responses')}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View all
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            {recentResponses.map((response) => (
              <div
                key={response.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                    <Users className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{response.respondent}</p>
                    <p className="text-xs text-gray-500">{response.surveyName}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-medium ${getCategoryColor(response.category)}`}>
                    {response.score !== null ? response.score : '-'}
                  </p>
                  <p className="text-xs text-gray-500">{formatDate(response.submittedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SurveyOverviewAnalyticsPage;
