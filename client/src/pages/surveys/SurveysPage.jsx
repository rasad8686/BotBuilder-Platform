import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Copy,
  Trash2,
  BarChart3,
  Edit2,
  Eye,
  Users,
  Calendar,
  CheckCircle,
  Clock,
  Pause,
  Play,
  Grid,
  List,
  RefreshCw,
  MessageSquare,
  Star,
  ThumbsUp,
  Layout,
  X,
  ChevronRight,
  Smile,
  Target,
  LogOut,
  Package
} from 'lucide-react';
import SurveyCard from '../../components/surveys/SurveyCard';

// Templates Modal Component
const TemplatesModal = ({ isOpen, onClose, onSelect }) => {
  const templates = [
    {
      id: 'nps',
      name: 'NPS Survey',
      description: 'Measure customer loyalty with Net Promoter Score',
      icon: ThumbsUp,
      color: 'purple',
      questions: 2
    },
    {
      id: 'csat',
      name: 'Customer Satisfaction',
      description: 'Gauge satisfaction with star rating and feedback',
      icon: Star,
      color: 'orange',
      questions: 2
    },
    {
      id: 'ces',
      name: 'Customer Effort Score',
      description: 'Measure how easy it was to accomplish a task',
      icon: Target,
      color: 'blue',
      questions: 1
    },
    {
      id: 'feedback',
      name: 'General Feedback',
      description: 'Collect open-ended feedback with emoji rating',
      icon: Smile,
      color: 'green',
      questions: 2
    },
    {
      id: 'exit',
      name: 'Exit Survey',
      description: 'Understand why users are leaving your site',
      icon: LogOut,
      color: 'red',
      questions: 2
    },
    {
      id: 'product',
      name: 'Product Feedback',
      description: 'Collect detailed feedback about your product',
      icon: Package,
      color: 'indigo',
      questions: 3
    }
  ];

  const colorClasses = {
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    indigo: 'bg-indigo-50 text-indigo-600'
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />

        <div className="inline-block w-full max-w-3xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white rounded-2xl shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Layout className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Choose a Template</h3>
                <p className="text-sm text-gray-500">Start with a pre-built survey template</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Templates Grid */}
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              {templates.map((template) => {
                const Icon = template.icon;
                return (
                  <button
                    key={template.id}
                    onClick={() => onSelect(template.id)}
                    className="flex items-start gap-4 p-4 text-left border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/30 transition-colors group"
                  >
                    <div className={`p-3 rounded-lg ${colorClasses[template.color]}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 group-hover:text-blue-600">
                        {template.name}
                      </h4>
                      <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                      <p className="text-xs text-gray-400 mt-2">{template.questions} questions</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 mt-1" />
                  </button>
                );
              })}
            </div>

            {/* Start from Scratch */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={() => onSelect(null)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-gray-600 border border-dashed border-gray-300 rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Start from Scratch
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ActionDropdown component with dynamic positioning
const ActionDropdown = ({ survey, isOpen, onToggle, onEdit, onViewResponses, onViewAnalytics, onDuplicate, onDelete, navigate }) => {
  const [openUpward, setOpenUpward] = useState(false);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - buttonRect.bottom;
      const dropdownHeight = 200;
      setOpenUpward(spaceBelow < dropdownHeight);
    }
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={onToggle}
        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 z-50 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1
            ${openUpward ? 'bottom-full mb-1' : 'top-full mt-1'}`}
        >
          <button
            onClick={() => navigate(`/surveys/${survey.id}/edit`)}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={() => navigate(`/surveys/${survey.id}/responses`)}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            View Responses
          </button>
          <button
            onClick={() => navigate(`/surveys/${survey.id}/analytics`)}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <BarChart3 className="w-4 h-4" />
            Analytics
          </button>
          <button
            onClick={onDuplicate}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <Copy className="w-4 h-4" />
            Duplicate
          </button>
          <button
            onClick={onDelete}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

const SurveysPage = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('grid'); // grid | list
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);

  // Handle template selection
  const handleTemplateSelect = (templateId) => {
    setShowTemplatesModal(false);
    if (templateId) {
      navigate(`/surveys/new?template=${templateId}`);
    } else {
      navigate('/surveys/new');
    }
  };

  // Mock data - replace with API call
  const [surveys, setSurveys] = useState([
    {
      id: 1,
      name: 'Customer Satisfaction Survey',
      description: 'Measure customer satisfaction after support interaction',
      type: 'nps',
      status: 'active',
      trigger: 'after_chat',
      response_count: 156,
      avg_score: 8.4,
      created_at: '2025-01-01T10:00:00Z',
      updated_at: '2025-01-03T15:30:00Z'
    },
    {
      id: 2,
      name: 'Product Feedback',
      description: 'Collect feedback on new features',
      type: 'feedback',
      status: 'active',
      trigger: 'manual',
      response_count: 89,
      avg_score: 4.2,
      created_at: '2024-12-20T09:00:00Z',
      updated_at: '2025-01-02T11:00:00Z'
    },
    {
      id: 3,
      name: 'Exit Survey',
      description: 'Understand why users are leaving',
      type: 'exit',
      status: 'draft',
      trigger: 'on_exit',
      response_count: 0,
      avg_score: null,
      created_at: '2025-01-02T14:00:00Z',
      updated_at: '2025-01-02T14:00:00Z'
    },
    {
      id: 4,
      name: 'Onboarding Experience',
      description: 'Rate your onboarding experience',
      type: 'rating',
      status: 'paused',
      trigger: 'after_onboarding',
      response_count: 234,
      avg_score: 4.6,
      created_at: '2024-11-15T08:00:00Z',
      updated_at: '2024-12-30T16:00:00Z'
    }
  ]);

  const stats = {
    totalResponses: 479,
    avgNPS: 42,
    avgSatisfaction: 4.3,
    activeSurveys: 2
  };

  const statusTabs = [
    { id: 'all', label: 'All', count: surveys.length },
    { id: 'active', label: 'Active', count: surveys.filter(s => s.status === 'active').length },
    { id: 'draft', label: 'Draft', count: surveys.filter(s => s.status === 'draft').length },
    { id: 'paused', label: 'Paused', count: surveys.filter(s => s.status === 'paused').length }
  ];

  const filteredSurveys = surveys.filter(survey => {
    if (activeTab !== 'all' && survey.status !== activeTab) return false;
    if (typeFilter && survey.type !== typeFilter) return false;
    if (searchQuery && !survey.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-700',
      draft: 'bg-gray-100 text-gray-700',
      paused: 'bg-yellow-100 text-yellow-700',
      archived: 'bg-red-100 text-red-700'
    };

    const icons = {
      active: Play,
      draft: Edit2,
      paused: Pause,
      archived: Clock
    };

    const Icon = icons[status] || Clock;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getTypeBadge = (type) => {
    const styles = {
      nps: 'bg-purple-100 text-purple-700',
      feedback: 'bg-blue-100 text-blue-700',
      rating: 'bg-orange-100 text-orange-700',
      exit: 'bg-red-100 text-red-700'
    };

    const labels = {
      nps: 'NPS',
      feedback: 'Feedback',
      rating: 'Rating',
      exit: 'Exit Survey'
    };

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[type] || 'bg-gray-100 text-gray-700'}`}>
        {labels[type] || type}
      </span>
    );
  };

  const handleDelete = async (survey) => {
    if (window.confirm(`Are you sure you want to delete "${survey.name}"?`)) {
      setSurveys(surveys.filter(s => s.id !== survey.id));
      setSelectedSurvey(null);
    }
  };

  const handleDuplicate = async (survey) => {
    const newSurvey = {
      ...survey,
      id: Date.now(),
      name: `${survey.name} (Copy)`,
      status: 'draft',
      response_count: 0,
      avg_score: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setSurveys([newSurvey, ...surveys]);
    setSelectedSurvey(null);
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Surveys</h1>
          <p className="text-gray-500 mt-1">Create and manage feedback surveys for your users</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTemplatesModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Layout className="w-4 h-4" />
            Use Template
          </button>
          <Link
            to="/surveys/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Survey
          </Link>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <MessageSquare className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Responses</p>
              <p className="text-xl font-bold text-gray-900">{stats.totalResponses}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <ThumbsUp className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg NPS Score</p>
              <p className="text-xl font-bold text-gray-900">{stats.avgNPS}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-lg">
              <Star className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg Satisfaction</p>
              <p className="text-xl font-bold text-gray-900">{stats.avgSatisfaction}/5</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Surveys</p>
              <p className="text-xl font-bold text-gray-900">{stats.activeSurveys}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center justify-between mb-4 border-b border-gray-200">
        <div className="flex items-center gap-1">
          {statusTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 px-1.5 py-0.5 bg-gray-100 rounded-full text-xs">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search surveys..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            <option value="nps">NPS</option>
            <option value="feedback">Feedback</option>
            <option value="rating">Rating</option>
            <option value="exit">Exit Survey</option>
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="recent">Recent</option>
            <option value="responses">Most Responses</option>
            <option value="name">Name</option>
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

        {/* Extended Filters */}
        {showFilters && (
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">Trigger:</span>
              <select className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All Triggers</option>
                <option value="after_chat">After Chat</option>
                <option value="manual">Manual</option>
                <option value="on_exit">On Exit</option>
                <option value="after_onboarding">After Onboarding</option>
              </select>
            </div>
            <button
              onClick={() => {
                setTypeFilter('');
                setSearchQuery('');
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Surveys Grid/List */}
      {isLoading ? (
        <div className="p-8 text-center">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
          <p className="text-gray-500">Loading surveys...</p>
        </div>
      ) : filteredSurveys.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No surveys found</h3>
          <p className="text-gray-500 mb-4">Get started by creating your first survey</p>
          <Link
            to="/surveys/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Survey
          </Link>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSurveys.map((survey) => (
            <SurveyCard
              key={survey.id}
              survey={survey}
              onEdit={() => navigate(`/surveys/${survey.id}/edit`)}
              onViewResponses={() => navigate(`/surveys/${survey.id}/responses`)}
              onViewAnalytics={() => navigate(`/surveys/${survey.id}/analytics`)}
              onDuplicate={() => handleDuplicate(survey)}
              onDelete={() => handleDelete(survey)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-visible">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Survey</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Responses</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Avg Score</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Updated</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSurveys.map((survey) => (
                <tr key={survey.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{survey.name}</p>
                      <p className="text-sm text-gray-500 truncate max-w-xs">{survey.description}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {getTypeBadge(survey.type)}
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(survey.status)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{survey.response_count}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-medium text-gray-700">
                      {survey.avg_score !== null ? survey.avg_score.toFixed(1) : '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-500">{formatDate(survey.updated_at)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ActionDropdown
                      survey={survey}
                      isOpen={selectedSurvey === survey.id}
                      onToggle={() => setSelectedSurvey(selectedSurvey === survey.id ? null : survey.id)}
                      onDuplicate={() => handleDuplicate(survey)}
                      onDelete={() => handleDelete(survey)}
                      navigate={navigate}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Templates Modal */}
      <TemplatesModal
        isOpen={showTemplatesModal}
        onClose={() => setShowTemplatesModal(false)}
        onSelect={handleTemplateSelect}
      />
    </div>
  );
};

export default SurveysPage;
