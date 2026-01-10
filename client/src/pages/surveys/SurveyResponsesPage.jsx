import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  Filter,
  Download,
  RefreshCw,
  Calendar,
  User,
  Clock,
  ChevronRight,
  BarChart3,
  Eye,
  MessageSquare,
  Star,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
import ResponsesList from '../../components/surveys/ResponsesList';
import ResponseDetail from '../../components/surveys/ResponseDetail';

const SurveyResponsesPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  // Mock survey data
  const [survey, setSurvey] = useState(null);
  const [responses, setResponses] = useState([]);

  useEffect(() => {
    // Mock API call
    setTimeout(() => {
      setSurvey({
        id: parseInt(id),
        name: 'Customer Satisfaction Survey',
        type: 'nps',
        status: 'active',
        response_count: 156,
        questions: [
          { id: 'q1', type: 'nps', title: 'How likely are you to recommend us?' },
          { id: 'q2', type: 'text', title: 'What could we do better?' }
        ]
      });

      setResponses([
        {
          id: 'r1',
          respondent: { name: 'John Doe', email: 'john@example.com', avatar: null },
          submitted_at: '2025-01-03T15:30:00Z',
          score: 9,
          category: 'promoter',
          answers: [
            { question_id: 'q1', value: 9 },
            { question_id: 'q2', value: 'Great service! The team was very responsive.' }
          ]
        },
        {
          id: 'r2',
          respondent: { name: 'Jane Smith', email: 'jane@example.com', avatar: null },
          submitted_at: '2025-01-03T14:20:00Z',
          score: 7,
          category: 'passive',
          answers: [
            { question_id: 'q1', value: 7 },
            { question_id: 'q2', value: 'Good overall, but could improve response time.' }
          ]
        },
        {
          id: 'r3',
          respondent: { name: 'Bob Wilson', email: 'bob@example.com', avatar: null },
          submitted_at: '2025-01-03T12:15:00Z',
          score: 4,
          category: 'detractor',
          answers: [
            { question_id: 'q1', value: 4 },
            { question_id: 'q2', value: 'Had issues with the onboarding process.' }
          ]
        },
        {
          id: 'r4',
          respondent: { name: 'Alice Brown', email: 'alice@example.com', avatar: null },
          submitted_at: '2025-01-02T18:45:00Z',
          score: 10,
          category: 'promoter',
          answers: [
            { question_id: 'q1', value: 10 },
            { question_id: 'q2', value: 'Absolutely love it! Keep up the great work!' }
          ]
        },
        {
          id: 'r5',
          respondent: { name: 'Charlie Green', email: 'charlie@example.com', avatar: null },
          submitted_at: '2025-01-02T10:30:00Z',
          score: 8,
          category: 'passive',
          answers: [
            { question_id: 'q1', value: 8 },
            { question_id: 'q2', value: '' }
          ]
        }
      ]);

      setIsLoading(false);
    }, 500);
  }, [id]);

  const filteredResponses = responses.filter(response => {
    // Score filter
    if (scoreFilter !== 'all') {
      if (scoreFilter === 'promoter' && response.category !== 'promoter') return false;
      if (scoreFilter === 'passive' && response.category !== 'passive') return false;
      if (scoreFilter === 'detractor' && response.category !== 'detractor') return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = response.respondent.name.toLowerCase().includes(query);
      const matchesEmail = response.respondent.email.toLowerCase().includes(query);
      const matchesAnswer = response.answers.some(a =>
        typeof a.value === 'string' && a.value.toLowerCase().includes(query)
      );
      if (!matchesName && !matchesEmail && !matchesAnswer) return false;
    }

    return true;
  });

  const stats = {
    total: responses.length,
    promoters: responses.filter(r => r.category === 'promoter').length,
    passives: responses.filter(r => r.category === 'passive').length,
    detractors: responses.filter(r => r.category === 'detractor').length
  };

  const npsScore = stats.total > 0
    ? Math.round(((stats.promoters - stats.detractors) / stats.total) * 100)
    : 0;

  const handleExport = () => {
    // Export logic
    console.log('Exporting responses...');
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
              <span className="text-gray-500">Responses</span>
            </div>
            <p className="text-gray-500 mt-1">{responses.length} total responses</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to={`/surveys/${id}/analytics`}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <BarChart3 className="w-4 h-4" />
            Analytics
          </Link>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* NPS Summary */}
      {survey?.type === 'nps' && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">NPS Score</span>
              <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                npsScore >= 50 ? 'bg-green-100 text-green-700' :
                npsScore >= 0 ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
                {npsScore >= 50 ? 'Excellent' : npsScore >= 0 ? 'Good' : 'Needs Work'}
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{npsScore}</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <ThumbsUp className="w-4 h-4 text-green-600" />
              <span className="text-sm text-gray-500">Promoters (9-10)</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.promoters}</p>
            <p className="text-xs text-gray-400">{stats.total > 0 ? Math.round((stats.promoters / stats.total) * 100) : 0}%</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-4 h-4 rounded-full bg-yellow-400" />
              <span className="text-sm text-gray-500">Passives (7-8)</span>
            </div>
            <p className="text-2xl font-bold text-yellow-600">{stats.passives}</p>
            <p className="text-xs text-gray-400">{stats.total > 0 ? Math.round((stats.passives / stats.total) * 100) : 0}%</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <ThumbsDown className="w-4 h-4 text-red-600" />
              <span className="text-sm text-gray-500">Detractors (0-6)</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{stats.detractors}</p>
            <p className="text-xs text-gray-400">{stats.total > 0 ? Math.round((stats.detractors / stats.total) * 100) : 0}%</p>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search responses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {survey?.type === 'nps' && (
            <select
              value={scoreFilter}
              onChange={(e) => setScoreFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Scores</option>
              <option value="promoter">Promoters (9-10)</option>
              <option value="passive">Passives (7-8)</option>
              <option value="detractor">Detractors (0-6)</option>
            </select>
          )}

          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>
      </div>

      {/* Responses List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={selectedResponse ? 'lg:col-span-1' : 'lg:col-span-3'}>
          <ResponsesList
            responses={filteredResponses}
            survey={survey}
            selectedId={selectedResponse?.id}
            onSelect={setSelectedResponse}
          />
        </div>

        {selectedResponse && (
          <div className="lg:col-span-2">
            <ResponseDetail
              response={selectedResponse}
              survey={survey}
              onClose={() => setSelectedResponse(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default SurveyResponsesPage;
