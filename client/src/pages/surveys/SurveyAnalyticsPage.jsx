import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Calendar,
  TrendingUp,
  TrendingDown,
  Users,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Star,
  BarChart3,
  PieChart,
  Eye
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPie,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

const SurveyAnalyticsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState('30days');
  const [isLoading, setIsLoading] = useState(true);
  const [survey, setSurvey] = useState(null);
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    // Mock API call
    setTimeout(() => {
      setSurvey({
        id: parseInt(id),
        name: 'Customer Satisfaction Survey',
        type: 'nps',
        status: 'active',
        response_count: 156
      });

      setAnalytics({
        summary: {
          total_responses: 156,
          completion_rate: 78.5,
          avg_completion_time: 45, // seconds
          nps_score: 42
        },
        nps_breakdown: {
          promoters: 68,
          passives: 52,
          detractors: 36
        },
        trend: [
          { date: 'Dec 1', responses: 12, nps: 38 },
          { date: 'Dec 8', responses: 18, nps: 42 },
          { date: 'Dec 15', responses: 24, nps: 45 },
          { date: 'Dec 22', responses: 31, nps: 40 },
          { date: 'Dec 29', responses: 28, nps: 44 },
          { date: 'Jan 5', responses: 43, nps: 42 }
        ],
        question_stats: [
          {
            id: 'q1',
            title: 'How likely are you to recommend us?',
            type: 'nps',
            responses: 156,
            avg_score: 7.8,
            distribution: [
              { score: '0', count: 2 },
              { score: '1', count: 3 },
              { score: '2', count: 4 },
              { score: '3', count: 5 },
              { score: '4', count: 8 },
              { score: '5', count: 10 },
              { score: '6', count: 4 },
              { score: '7', count: 25 },
              { score: '8', count: 27 },
              { score: '9', count: 38 },
              { score: '10', count: 30 }
            ]
          },
          {
            id: 'q2',
            title: 'What could we do better?',
            type: 'text',
            responses: 98,
            word_cloud: [
              { text: 'response time', count: 24 },
              { text: 'support', count: 18 },
              { text: 'pricing', count: 15 },
              { text: 'features', count: 12 },
              { text: 'documentation', count: 10 }
            ]
          }
        ],
        top_feedback: [
          { text: 'Great customer service!', count: 12, sentiment: 'positive' },
          { text: 'Would love faster response times', count: 8, sentiment: 'neutral' },
          { text: 'Amazing product, easy to use', count: 7, sentiment: 'positive' },
          { text: 'Pricing could be more competitive', count: 5, sentiment: 'negative' }
        ]
      });

      setIsLoading(false);
    }, 500);
  }, [id, dateRange]);

  const npsColors = {
    promoters: '#22c55e',
    passives: '#eab308',
    detractors: '#ef4444'
  };

  const pieData = analytics ? [
    { name: 'Promoters', value: analytics.nps_breakdown.promoters, color: npsColors.promoters },
    { name: 'Passives', value: analytics.nps_breakdown.passives, color: npsColors.passives },
    { name: 'Detractors', value: analytics.nps_breakdown.detractors, color: npsColors.detractors }
  ] : [];

  const handleExport = () => {
    console.log('Exporting analytics...');
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
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
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{survey?.name}</h1>
              <ChevronRight className="w-5 h-5 text-gray-400" />
              <span className="text-gray-500">Analytics</span>
            </div>
            <p className="text-gray-500 mt-1">Survey performance and insights</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7days">Last 7 days</option>
            <option value="30days">Last 30 days</option>
            <option value="90days">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          <Link
            to={`/surveys/${id}/responses`}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <Eye className="w-4 h-4" />
            Responses
          </Link>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <MessageSquare className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Responses</p>
              <p className="text-2xl font-bold text-gray-900">{analytics?.summary.total_responses}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Completion Rate</p>
              <p className="text-2xl font-bold text-gray-900">{analytics?.summary.completion_rate}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg. Completion Time</p>
              <p className="text-2xl font-bold text-gray-900">{analytics?.summary.avg_completion_time}s</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              analytics?.summary.nps_score >= 50 ? 'bg-green-50' :
              analytics?.summary.nps_score >= 0 ? 'bg-yellow-50' : 'bg-red-50'
            }`}>
              <ThumbsUp className={`w-5 h-5 ${
                analytics?.summary.nps_score >= 50 ? 'text-green-600' :
                analytics?.summary.nps_score >= 0 ? 'text-yellow-600' : 'text-red-600'
              }`} />
            </div>
            <div>
              <p className="text-sm text-gray-500">NPS Score</p>
              <p className="text-2xl font-bold text-gray-900">{analytics?.summary.nps_score}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Response Trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Response Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={analytics?.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="responses"
                stroke="#3b82f6"
                fill="#93c5fd"
                fillOpacity={0.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* NPS Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">NPS Distribution</h3>
          <div className="flex items-center">
            <ResponsiveContainer width="50%" height={200}>
              <RechartsPie>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPie>
            </ResponsiveContainer>
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm text-gray-600">Promoters (9-10)</span>
                </div>
                <span className="font-semibold text-gray-900">{analytics?.nps_breakdown.promoters}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-sm text-gray-600">Passives (7-8)</span>
                </div>
                <span className="font-semibold text-gray-900">{analytics?.nps_breakdown.passives}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-sm text-gray-600">Detractors (0-6)</span>
                </div>
                <span className="font-semibold text-gray-900">{analytics?.nps_breakdown.detractors}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Question Analytics */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Question Performance</h3>
        <div className="space-y-6">
          {analytics?.question_stats.map((question, index) => (
            <div key={question.id} className="border-b border-gray-100 pb-6 last:border-0 last:pb-0">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-medium text-gray-900">Q{index + 1}. {question.title}</p>
                  <p className="text-sm text-gray-500">{question.responses} responses</p>
                </div>
                {question.avg_score && (
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Avg Score</p>
                    <p className="text-lg font-semibold text-gray-900">{question.avg_score}</p>
                  </div>
                )}
              </div>

              {question.type === 'nps' && question.distribution && (
                <ResponsiveContainer width="100%" height={100}>
                  <BarChart data={question.distribution} layout="horizontal">
                    <XAxis dataKey="score" tick={{ fontSize: 10 }} />
                    <YAxis hide />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      radius={[4, 4, 0, 0]}
                    >
                      {question.distribution.map((entry, i) => {
                        const score = parseInt(entry.score);
                        let color = '#ef4444'; // detractor
                        if (score >= 9) color = '#22c55e'; // promoter
                        else if (score >= 7) color = '#eab308'; // passive
                        return <Cell key={`cell-${i}`} fill={color} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}

              {question.type === 'text' && question.word_cloud && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {question.word_cloud.map((word, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700"
                      style={{
                        fontSize: `${Math.min(16 + word.count, 24)}px`,
                        opacity: 0.5 + (word.count / 30)
                      }}
                    >
                      {word.text} ({word.count})
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Top Feedback */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Feedback Themes</h3>
        <div className="space-y-3">
          {analytics?.top_feedback.map((feedback, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  feedback.sentiment === 'positive' ? 'bg-green-500' :
                  feedback.sentiment === 'negative' ? 'bg-red-500' :
                  'bg-yellow-500'
                }`} />
                <span className="text-gray-700">{feedback.text}</span>
              </div>
              <span className="text-sm text-gray-500">{feedback.count} mentions</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SurveyAnalyticsPage;
