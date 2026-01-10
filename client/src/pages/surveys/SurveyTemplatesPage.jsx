import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  ArrowLeft,
  Search,
  Filter,
  Star,
  ThumbsUp,
  Target,
  Smile,
  LogOut,
  Package,
  MessageSquare,
  Users,
  Eye,
  Copy,
  X,
  Zap,
  HeartHandshake,
  CheckCircle
} from 'lucide-react';

const SurveyTemplatesPage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [previewTemplate, setPreviewTemplate] = useState(null);

  const categories = [
    { id: 'all', label: 'All Templates', icon: FileText },
    { id: 'nps', label: 'NPS', icon: ThumbsUp },
    { id: 'csat', label: 'CSAT', icon: Star },
    { id: 'ces', label: 'CES', icon: Target },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
    { id: 'exit', label: 'Exit', icon: LogOut },
    { id: 'product', label: 'Product', icon: Package }
  ];

  const templates = [
    {
      id: 'nps',
      name: 'Net Promoter Score (NPS)',
      description: 'Measure customer loyalty with the classic NPS question',
      category: 'nps',
      icon: ThumbsUp,
      color: 'purple',
      popular: true,
      questions: [
        { type: 'nps', question: 'How likely are you to recommend us to a friend or colleague?', required: true },
        { type: 'text', question: 'What is the main reason for your score?', required: false }
      ]
    },
    {
      id: 'csat',
      name: 'Customer Satisfaction (CSAT)',
      description: 'Measure customer satisfaction with your product or service',
      category: 'csat',
      icon: Star,
      color: 'orange',
      popular: true,
      questions: [
        { type: 'rating', question: 'How satisfied are you with our service?', required: true, maxRating: 5 },
        { type: 'single_choice', question: 'Which aspect impressed you the most?', options: ['Product Quality', 'Customer Support', 'Ease of Use', 'Value for Money'], required: false },
        { type: 'text', question: 'How can we improve your experience?', required: false }
      ]
    },
    {
      id: 'ces',
      name: 'Customer Effort Score (CES)',
      description: 'Measure how easy it is to interact with your company',
      category: 'ces',
      icon: Target,
      color: 'blue',
      popular: true,
      questions: [
        { type: 'scale', question: 'How easy was it to resolve your issue today?', required: true, min: 1, max: 7, minLabel: 'Very Difficult', maxLabel: 'Very Easy' },
        { type: 'text', question: 'What made your experience easy or difficult?', required: false }
      ]
    },
    {
      id: 'general_feedback',
      name: 'General Feedback',
      description: 'Collect open-ended feedback with emoji rating',
      category: 'feedback',
      icon: Smile,
      color: 'green',
      questions: [
        { type: 'emoji', question: 'How would you rate your overall experience?', required: true },
        { type: 'text', question: 'Please share any additional feedback', required: false }
      ]
    },
    {
      id: 'exit_survey',
      name: 'Exit Survey',
      description: 'Understand why users are leaving your site',
      category: 'exit',
      icon: LogOut,
      color: 'red',
      questions: [
        { type: 'single_choice', question: 'Why are you leaving today?', options: ['Found what I needed', 'Didn\'t find what I was looking for', 'Too expensive', 'Just browsing', 'Other'], required: true },
        { type: 'text', question: 'Any suggestions for improvement?', required: false }
      ]
    },
    {
      id: 'product_feedback',
      name: 'Product Feedback',
      description: 'Collect detailed feedback about your product',
      category: 'product',
      icon: Package,
      color: 'indigo',
      questions: [
        { type: 'rating', question: 'How would you rate the overall quality of our product?', required: true, maxRating: 5 },
        { type: 'multiple_choice', question: 'Which features do you use the most?', options: ['Feature A', 'Feature B', 'Feature C', 'Feature D'], required: true },
        { type: 'single_choice', question: 'How often do you use our product?', options: ['Daily', 'Weekly', 'Monthly', 'Rarely'], required: true },
        { type: 'text', question: 'What features would you like to see added?', required: false }
      ]
    },
    {
      id: 'onboarding',
      name: 'Onboarding Experience',
      description: 'Evaluate new user onboarding process',
      category: 'feedback',
      icon: CheckCircle,
      color: 'teal',
      questions: [
        { type: 'scale', question: 'How easy was the onboarding process?', required: true, min: 1, max: 5, minLabel: 'Very Difficult', maxLabel: 'Very Easy' },
        { type: 'single_choice', question: 'Did you find the documentation helpful?', options: ['Very Helpful', 'Somewhat Helpful', 'Not Helpful', 'Did not use'], required: true },
        { type: 'text', question: 'What would have made your onboarding easier?', required: false }
      ]
    },
    {
      id: 'support_feedback',
      name: 'Support Ticket Feedback',
      description: 'Collect feedback after support interactions',
      category: 'csat',
      icon: HeartHandshake,
      color: 'pink',
      questions: [
        { type: 'rating', question: 'How satisfied are you with the support you received?', required: true, maxRating: 5 },
        { type: 'single_choice', question: 'Was your issue resolved?', options: ['Yes, completely', 'Partially', 'No', 'Still in progress'], required: true },
        { type: 'text', question: 'Any additional comments?', required: false }
      ]
    },
    {
      id: 'feature_request',
      name: 'Feature Request',
      description: 'Gather feature requests and prioritize development',
      category: 'product',
      icon: Zap,
      color: 'yellow',
      questions: [
        { type: 'text', question: 'What feature would you like to see added?', required: true },
        { type: 'single_choice', question: 'How important is this feature to you?', options: ['Critical', 'Important', 'Nice to have', 'Just a suggestion'], required: true },
        { type: 'text', question: 'How would this feature help you?', required: false }
      ]
    },
    {
      id: 'employee_engagement',
      name: 'Employee Engagement',
      description: 'Measure employee satisfaction and engagement',
      category: 'nps',
      icon: Users,
      color: 'cyan',
      questions: [
        { type: 'nps', question: 'How likely are you to recommend this company as a great place to work?', required: true },
        { type: 'rating', question: 'How satisfied are you with your work-life balance?', required: true, maxRating: 5 },
        { type: 'text', question: 'What would make this a better place to work?', required: false }
      ]
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      purple: 'bg-purple-100 text-purple-600 border-purple-200',
      orange: 'bg-orange-100 text-orange-600 border-orange-200',
      blue: 'bg-blue-100 text-blue-600 border-blue-200',
      green: 'bg-green-100 text-green-600 border-green-200',
      red: 'bg-red-100 text-red-600 border-red-200',
      indigo: 'bg-indigo-100 text-indigo-600 border-indigo-200',
      teal: 'bg-teal-100 text-teal-600 border-teal-200',
      pink: 'bg-pink-100 text-pink-600 border-pink-200',
      yellow: 'bg-yellow-100 text-yellow-600 border-yellow-200',
      cyan: 'bg-cyan-100 text-cyan-600 border-cyan-200'
    };
    return colors[color] || colors.blue;
  };

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSelectTemplate = (template) => {
    navigate(`/surveys/new?template=${template.id}`);
  };

  const handlePreviewTemplate = (template) => {
    setPreviewTemplate(template);
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
            <h1 className="text-2xl font-bold text-gray-900">Survey Templates</h1>
            <p className="text-gray-500 mt-1">Choose a template to get started quickly</p>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {category.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Blank Template */}
        <button
          onClick={() => navigate('/surveys/new')}
          className="group p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all text-left bg-white"
        >
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-3 group-hover:bg-blue-100">
            <FileText className="w-6 h-6 text-gray-400 group-hover:text-blue-600" />
          </div>
          <h4 className="font-medium text-gray-900">Start from Scratch</h4>
          <p className="text-sm text-gray-500 mt-1">Create a blank survey and add your own questions</p>
        </button>

        {/* Template Cards */}
        {filteredTemplates.map((template) => {
          const Icon = template.icon;
          return (
            <div
              key={template.id}
              className="group relative p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all"
            >
              {template.popular && (
                <span className="absolute top-2 right-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                  Popular
                </span>
              )}

              <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-3 ${getColorClasses(template.color)}`}>
                <Icon className="w-6 h-6" />
              </div>

              <h4 className="font-medium text-gray-900">{template.name}</h4>
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{template.description}</p>

              <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
                <span>{template.questions.length} questions</span>
                <span>-</span>
                <span className="capitalize">{template.category}</span>
              </div>

              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                <button
                  onClick={() => handlePreviewTemplate(template)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
                <button
                  onClick={() => handleSelectTemplate(template)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  Use
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h4 className="font-medium text-gray-900">No templates found</h4>
          <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filter criteria</p>
        </div>
      )}

      {/* Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getColorClasses(previewTemplate.color)}`}>
                  {React.createElement(previewTemplate.icon, { className: 'w-5 h-5' })}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{previewTemplate.name}</h3>
                  <p className="text-sm text-gray-500">{previewTemplate.questions.length} questions</p>
                </div>
              </div>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <p className="text-gray-600 mb-6">{previewTemplate.description}</p>

              <h4 className="font-medium text-gray-900 mb-4">Questions</h4>
              <div className="space-y-4">
                {previewTemplate.questions.map((q, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{q.question}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs">
                          <span className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded capitalize">
                            {q.type.replace('_', ' ')}
                          </span>
                          {q.required && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded">Required</span>
                          )}
                        </div>
                        {q.options && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {q.options.map((opt, i) => (
                              <span key={i} className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs text-gray-600">
                                {opt}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setPreviewTemplate(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleSelectTemplate(previewTemplate);
                  setPreviewTemplate(null);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Use This Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SurveyTemplatesPage;
