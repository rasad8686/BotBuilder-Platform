import React, { useState } from 'react';
import {
  FileText,
  Star,
  ThumbsUp,
  TrendingUp,
  Package,
  HeartHandshake,
  Users,
  Zap,
  MessageSquare,
  CheckCircle,
  Eye,
  Copy,
  Search,
  Filter
} from 'lucide-react';

const SurveyTemplates = ({ onSelect, onPreview }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [previewTemplate, setPreviewTemplate] = useState(null);

  const categories = [
    { id: 'all', label: 'All Templates', icon: FileText },
    { id: 'satisfaction', label: 'Satisfaction', icon: ThumbsUp },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
    { id: 'experience', label: 'Experience', icon: Star },
    { id: 'product', label: 'Product', icon: Package },
    { id: 'employee', label: 'Employee', icon: Users }
  ];

  const templates = [
    {
      id: 'nps',
      name: 'Net Promoter Score (NPS)',
      description: 'Measure customer loyalty with the classic NPS question',
      category: 'satisfaction',
      icon: TrendingUp,
      color: 'blue',
      popular: true,
      questions: [
        {
          type: 'nps',
          question: 'How likely are you to recommend us to a friend or colleague?',
          required: true
        },
        {
          type: 'text',
          question: 'What is the main reason for your score?',
          required: false
        }
      ]
    },
    {
      id: 'csat',
      name: 'Customer Satisfaction (CSAT)',
      description: 'Measure customer satisfaction with your product or service',
      category: 'satisfaction',
      icon: ThumbsUp,
      color: 'green',
      popular: true,
      questions: [
        {
          type: 'rating',
          question: 'How satisfied are you with our service?',
          required: true,
          maxRating: 5
        },
        {
          type: 'single_choice',
          question: 'Which aspect of our service impressed you the most?',
          options: ['Product Quality', 'Customer Support', 'Ease of Use', 'Value for Money', 'Other'],
          required: false
        },
        {
          type: 'text',
          question: 'How can we improve your experience?',
          required: false
        }
      ]
    },
    {
      id: 'ces',
      name: 'Customer Effort Score (CES)',
      description: 'Measure how easy it is to interact with your company',
      category: 'experience',
      icon: Zap,
      color: 'purple',
      popular: true,
      questions: [
        {
          type: 'scale',
          question: 'How easy was it to resolve your issue today?',
          required: true,
          minLabel: 'Very Difficult',
          maxLabel: 'Very Easy',
          min: 1,
          max: 7
        },
        {
          type: 'text',
          question: 'What made your experience easy or difficult?',
          required: false
        }
      ]
    },
    {
      id: 'product_feedback',
      name: 'Product Feedback',
      description: 'Collect detailed feedback about your product',
      category: 'product',
      icon: Package,
      color: 'orange',
      questions: [
        {
          type: 'rating',
          question: 'How would you rate the overall quality of our product?',
          required: true,
          maxRating: 5
        },
        {
          type: 'multiple_choice',
          question: 'Which features do you use the most?',
          options: ['Feature A', 'Feature B', 'Feature C', 'Feature D'],
          required: true
        },
        {
          type: 'single_choice',
          question: 'How often do you use our product?',
          options: ['Daily', 'Weekly', 'Monthly', 'Rarely'],
          required: true
        },
        {
          type: 'text',
          question: 'What features would you like to see added?',
          required: false
        }
      ]
    },
    {
      id: 'onboarding',
      name: 'Onboarding Experience',
      description: 'Evaluate new user onboarding process',
      category: 'experience',
      icon: CheckCircle,
      color: 'teal',
      questions: [
        {
          type: 'scale',
          question: 'How easy was the onboarding process?',
          required: true,
          min: 1,
          max: 5,
          minLabel: 'Very Difficult',
          maxLabel: 'Very Easy'
        },
        {
          type: 'single_choice',
          question: 'Did you find the documentation helpful?',
          options: ['Very Helpful', 'Somewhat Helpful', 'Not Helpful', 'Did not use documentation'],
          required: true
        },
        {
          type: 'emoji',
          question: 'How do you feel about getting started with our product?',
          required: true
        },
        {
          type: 'text',
          question: 'What would have made your onboarding easier?',
          required: false
        }
      ]
    },
    {
      id: 'support_feedback',
      name: 'Support Ticket Feedback',
      description: 'Collect feedback after support interactions',
      category: 'feedback',
      icon: HeartHandshake,
      color: 'pink',
      questions: [
        {
          type: 'rating',
          question: 'How satisfied are you with the support you received?',
          required: true,
          maxRating: 5
        },
        {
          type: 'single_choice',
          question: 'Was your issue resolved?',
          options: ['Yes, completely', 'Partially', 'No', 'Still in progress'],
          required: true
        },
        {
          type: 'scale',
          question: 'How knowledgeable was the support agent?',
          required: true,
          min: 1,
          max: 5,
          minLabel: 'Not at all',
          maxLabel: 'Very knowledgeable'
        },
        {
          type: 'text',
          question: 'Any additional comments about your support experience?',
          required: false
        }
      ]
    },
    {
      id: 'feature_request',
      name: 'Feature Request',
      description: 'Gather feature requests and prioritize development',
      category: 'product',
      icon: Zap,
      color: 'indigo',
      questions: [
        {
          type: 'text',
          question: 'What feature would you like to see added?',
          required: true
        },
        {
          type: 'single_choice',
          question: 'How important is this feature to you?',
          options: ['Critical - I cannot work without it', 'Important - Would significantly improve my workflow', 'Nice to have', 'Just a suggestion'],
          required: true
        },
        {
          type: 'text',
          question: 'How would this feature help you?',
          required: false
        }
      ]
    },
    {
      id: 'employee_engagement',
      name: 'Employee Engagement',
      description: 'Measure employee satisfaction and engagement',
      category: 'employee',
      icon: Users,
      color: 'cyan',
      questions: [
        {
          type: 'nps',
          question: 'How likely are you to recommend this company as a great place to work?',
          required: true
        },
        {
          type: 'rating',
          question: 'How satisfied are you with your work-life balance?',
          required: true,
          maxRating: 5
        },
        {
          type: 'single_choice',
          question: 'Do you feel your work is valued?',
          options: ['Always', 'Usually', 'Sometimes', 'Rarely', 'Never'],
          required: true
        },
        {
          type: 'text',
          question: 'What would make this a better place to work?',
          required: false
        }
      ]
    },
    {
      id: 'website_feedback',
      name: 'Website Feedback',
      description: 'Collect feedback about your website experience',
      category: 'feedback',
      icon: Eye,
      color: 'amber',
      questions: [
        {
          type: 'emoji',
          question: 'How would you rate your experience on our website?',
          required: true
        },
        {
          type: 'single_choice',
          question: 'Did you find what you were looking for?',
          options: ['Yes, easily', 'Yes, but it took some time', 'No', 'Partially'],
          required: true
        },
        {
          type: 'scale',
          question: 'How easy is our website to navigate?',
          required: true,
          min: 1,
          max: 5,
          minLabel: 'Very Difficult',
          maxLabel: 'Very Easy'
        },
        {
          type: 'text',
          question: 'Any suggestions for improving our website?',
          required: false
        }
      ]
    },
    {
      id: 'event_feedback',
      name: 'Event Feedback',
      description: 'Collect feedback after events or webinars',
      category: 'feedback',
      icon: Star,
      color: 'rose',
      questions: [
        {
          type: 'rating',
          question: 'How would you rate the overall event?',
          required: true,
          maxRating: 5
        },
        {
          type: 'single_choice',
          question: 'How relevant was the content to you?',
          options: ['Very Relevant', 'Somewhat Relevant', 'Not Very Relevant', 'Not Relevant at All'],
          required: true
        },
        {
          type: 'nps',
          question: 'How likely are you to attend our future events?',
          required: true
        },
        {
          type: 'text',
          question: 'What topics would you like covered in future events?',
          required: false
        }
      ]
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-100 text-blue-600 border-blue-200',
      green: 'bg-green-100 text-green-600 border-green-200',
      purple: 'bg-purple-100 text-purple-600 border-purple-200',
      orange: 'bg-orange-100 text-orange-600 border-orange-200',
      teal: 'bg-teal-100 text-teal-600 border-teal-200',
      pink: 'bg-pink-100 text-pink-600 border-pink-200',
      indigo: 'bg-indigo-100 text-indigo-600 border-indigo-200',
      cyan: 'bg-cyan-100 text-cyan-600 border-cyan-200',
      amber: 'bg-amber-100 text-amber-600 border-amber-200',
      rose: 'bg-rose-100 text-rose-600 border-rose-200'
    };
    return colors[color] || colors.blue;
  };

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSelect = (template) => {
    onSelect?.(template);
  };

  const handlePreview = (template) => {
    setPreviewTemplate(template);
    onPreview?.(template);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Survey Templates</h3>
            <p className="text-sm text-gray-500">Start with a pre-built template or create from scratch</p>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="p-4 border-b border-gray-200 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
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
                    ? 'bg-indigo-100 text-indigo-700'
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
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Blank Template */}
          <button
            onClick={() => handleSelect({ id: 'blank', name: 'Blank Survey', questions: [] })}
            className="group p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-all text-left"
          >
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-3 group-hover:bg-indigo-100">
              <FileText className="w-6 h-6 text-gray-400 group-hover:text-indigo-600" />
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
                className="group relative p-4 border border-gray-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all"
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
                  <span>•</span>
                  <span className="capitalize">{template.category}</span>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => handlePreview(template)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    Preview
                  </button>
                  <button
                    onClick={() => handleSelect(template)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
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
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h4 className="font-medium text-gray-900">No templates found</h4>
            <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filter criteria</p>
          </div>
        )}
      </div>

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
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <p className="text-gray-600 mb-6">{previewTemplate.description}</p>

              <h4 className="font-medium text-gray-900 mb-4">Questions</h4>
              <div className="space-y-4">
                {previewTemplate.questions.map((q, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
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
                  handleSelect(previewTemplate);
                  setPreviewTemplate(null);
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
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

export default SurveyTemplates;
