import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  Filter,
  Download,
  Calendar,
  User,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Star,
  MessageSquare,
  ChevronDown,
  RefreshCw,
  FileText,
  X
} from 'lucide-react';

const SurveyAllResponsesPage = () => {
  const navigate = useNavigate();
  const [responses, setResponses] = useState([]);
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSurvey, setSelectedSurvey] = useState('');
  const [dateRange, setDateRange] = useState('30d');
  const [scoreFilter, setScoreFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState(null);

  // Get auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const headers = getAuthHeaders();

        // Fetch surveys list
        const surveysRes = await fetch('/api/surveys', { headers });
        const surveysData = await surveysRes.json();
        if (surveysData.success) {
          setSurveys(surveysData.surveys || []);
        }

        // Build query params
        const params = new URLSearchParams();
        if (selectedSurvey) params.append('survey_id', selectedSurvey);
        if (dateRange) params.append('period', dateRange);
        if (scoreFilter) params.append('category', scoreFilter);

        // Fetch all responses
        const responsesRes = await fetch(`/api/surveys/responses?${params.toString()}`, { headers });
        const responsesData = await responsesRes.json();
        if (responsesData.success) {
          setResponses(responsesData.responses || []);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
        // Mock data for development
        setResponses([
          {
            id: 1,
            survey_id: 1,
            survey_name: 'Customer Satisfaction Survey',
            survey_type: 'nps',
            score: 9,
            category: 'promoter',
            respondent: { name: 'John Doe', email: 'john@example.com' },
            answers: [
              { question: 'How likely are you to recommend us?', value: 9 },
              { question: 'What is the main reason for your score?', value: 'Great service and support!' }
            ],
            submitted_at: new Date().toISOString()
          },
          {
            id: 2,
            survey_id: 1,
            survey_name: 'Customer Satisfaction Survey',
            survey_type: 'nps',
            score: 7,
            category: 'passive',
            respondent: { name: 'Jane Smith', email: 'jane@example.com' },
            answers: [
              { question: 'How likely are you to recommend us?', value: 7 },
              { question: 'What is the main reason for your score?', value: 'Good product, room for improvement' }
            ],
            submitted_at: new Date(Date.now() - 86400000).toISOString()
          },
          {
            id: 3,
            survey_id: 2,
            survey_name: 'Product Feedback',
            survey_type: 'rating',
            score: 4,
            respondent: { name: 'Bob Wilson', email: 'bob@example.com' },
            answers: [
              { question: 'How would you rate our product?', value: 4 },
              { question: 'Which features do you use?', value: ['Feature A', 'Feature C'] }
            ],
            submitted_at: new Date(Date.now() - 172800000).toISOString()
          }
        ]);
        setSurveys([
          { id: 1, name: 'Customer Satisfaction Survey', type: 'nps' },
          { id: 2, name: 'Product Feedback', type: 'rating' }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedSurvey, dateRange, scoreFilter]);

  // Filter responses
  const filteredResponses = responses.filter((response) => {
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const matchesName = response.respondent?.name?.toLowerCase().includes(searchLower);
      const matchesEmail = response.respondent?.email?.toLowerCase().includes(searchLower);
      const matchesSurvey = response.survey_name?.toLowerCase().includes(searchLower);
      if (!matchesName && !matchesEmail && !matchesSurvey) return false;
    }
    return true;
  });

  // Export to CSV
  const handleExport = () => {
    const headers = ['Survey', 'Respondent', 'Email', 'Score', 'Category', 'Submitted At'];
    const rows = filteredResponses.map((r) => [
      r.survey_name,
      r.respondent?.name || 'Anonymous',
      r.respondent?.email || '',
      r.score || '',
      r.category || '',
      new Date(r.submitted_at).toLocaleString()
    ]);

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `survey-responses-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  // Format date
  const formatDate = (date) => {
    const now = new Date();
    const responseDate = new Date(date);
    const diffMs = now - responseDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return responseDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Get category badge
  const getCategoryBadge = (category) => {
    const styles = {
      promoter: 'bg-green-100 text-green-700',
      passive: 'bg-yellow-100 text-yellow-700',
      detractor: 'bg-red-100 text-red-700'
    };

    const icons = {
      promoter: ThumbsUp,
      passive: null,
      detractor: ThumbsDown
    };

    const Icon = icons[category];

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[category] || 'bg-gray-100 text-gray-700'}`}>
        {Icon && <Icon className="w-3 h-3" />}
        {category?.charAt(0).toUpperCase() + category?.slice(1)}
      </span>
    );
  };

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
            <h1 className="text-2xl font-bold text-gray-900">All Responses</h1>
            <p className="text-gray-500 mt-1">View and export responses from all surveys</p>
          </div>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or survey..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Survey Filter */}
          <select
            value={selectedSurvey}
            onChange={(e) => setSelectedSurvey(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Surveys</option>
            {surveys.map((survey) => (
              <option key={survey.id} value={survey.id}>{survey.name}</option>
            ))}
          </select>

          {/* Date Filter */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>

          {/* Score Filter */}
          <select
            value={scoreFilter}
            onChange={(e) => setScoreFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Scores</option>
            <option value="promoter">Promoters (9-10)</option>
            <option value="passive">Passives (7-8)</option>
            <option value="detractor">Detractors (0-6)</option>
          </select>

          {/* Toggle Filters */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg border transition-colors ${
              showFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <MessageSquare className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Responses</p>
              <p className="text-xl font-bold text-gray-900">{filteredResponses.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <ThumbsUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Promoters</p>
              <p className="text-xl font-bold text-gray-900">
                {filteredResponses.filter(r => r.category === 'promoter').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-50 rounded-lg">
              <Star className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Passives</p>
              <p className="text-xl font-bold text-gray-900">
                {filteredResponses.filter(r => r.category === 'passive').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg">
              <ThumbsDown className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Detractors</p>
              <p className="text-xl font-bold text-gray-900">
                {filteredResponses.filter(r => r.category === 'detractor').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Responses Table */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
          <p className="text-gray-500">Loading responses...</p>
        </div>
      ) : filteredResponses.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No responses found</h3>
          <p className="text-gray-500">Responses will appear here as they come in</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Respondent</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Survey</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Score</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredResponses.map((response) => (
                <tr key={response.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{response.respondent?.name || 'Anonymous'}</p>
                        <p className="text-sm text-gray-500">{response.respondent?.email || 'No email'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-900">{response.survey_name}</p>
                    <p className="text-xs text-gray-500 capitalize">{response.survey_type}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {response.score !== undefined && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full text-sm font-medium">
                        {response.survey_type === 'nps' ? `${response.score}/10` : `${response.score}/5`}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {response.category && getCategoryBadge(response.category)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Clock className="w-3 h-3" />
                      {formatDate(response.submitted_at)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelectedResponse(response)}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Response Detail Modal */}
      {selectedResponse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-gray-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {selectedResponse.respondent?.name || 'Anonymous'}
                  </h3>
                  <p className="text-sm text-gray-500">{selectedResponse.respondent?.email || 'No email'}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedResponse(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-500">Survey</p>
                  <p className="font-medium text-gray-900">{selectedResponse.survey_name}</p>
                </div>
                {selectedResponse.score !== undefined && (
                  <div>
                    <p className="text-sm text-gray-500">Score</p>
                    <p className="font-medium text-gray-900">{selectedResponse.score}</p>
                  </div>
                )}
                {selectedResponse.category && (
                  <div>
                    <p className="text-sm text-gray-500">Category</p>
                    {getCategoryBadge(selectedResponse.category)}
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-500">Submitted</p>
                  <p className="font-medium text-gray-900">
                    {new Date(selectedResponse.submitted_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <h4 className="font-medium text-gray-900 mb-4">Answers</h4>
              <div className="space-y-4">
                {selectedResponse.answers?.map((answer, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-2">{answer.question}</p>
                    <p className="font-medium text-gray-900">
                      {Array.isArray(answer.value) ? answer.value.join(', ') : answer.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setSelectedResponse(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SurveyAllResponsesPage;
