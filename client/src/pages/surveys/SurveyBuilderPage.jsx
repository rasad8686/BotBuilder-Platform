import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Eye,
  Settings,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Copy,
  Play,
  Pause,
  Target,
  Calendar,
  Send,
  Palette
} from 'lucide-react';
import SurveyForm from '../../components/surveys/SurveyForm';
import QuestionBuilder from '../../components/surveys/QuestionBuilder';
import QuestionTypeSelector from '../../components/surveys/QuestionTypeSelector';
import SurveyPreview from '../../components/surveys/SurveyPreview';
import SurveyTargeting from '../../components/surveys/SurveyTargeting';
import SurveyScheduler from '../../components/surveys/SurveyScheduler';
import SurveyDelivery from '../../components/surveys/SurveyDelivery';
import SurveyStyleEditor from '../../components/surveys/SurveyStyleEditor';

const SurveyBuilderPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEditMode = !!id;
  const templateId = searchParams.get('template');

  const [activeTab, setActiveTab] = useState('settings'); // settings | questions | targeting | schedule | delivery | style
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showQuestionSelector, setShowQuestionSelector] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Survey state
  const [survey, setSurvey] = useState({
    name: '',
    description: '',
    type: 'feedback',
    status: 'draft',
    trigger: 'manual',
    trigger_delay: 0,
    trigger_conditions: [],
    settings: {
      show_progress: true,
      allow_skip: false,
      randomize_questions: false,
      one_response_per_user: true,
      show_thank_you: true,
      thank_you_message: 'Thank you for your feedback!'
    },
    questions: [],
    // FAZ 5 fields
    targeting_config: {
      enabled: false,
      rules: [],
      user_segments: [],
      page_targeting: [],
      device_targeting: ['desktop', 'mobile', 'tablet'],
      geo_targeting: []
    },
    schedule_config: {
      enabled: false,
      start_date: null,
      end_date: null,
      days_of_week: [0, 1, 2, 3, 4, 5, 6],
      time_start: '00:00',
      time_end: '23:59',
      timezone: 'UTC'
    },
    style_config: {
      theme: 'default',
      position: 'bottom-right',
      primary_color: '#3B82F6',
      background_color: '#FFFFFF',
      text_color: '#1F2937',
      border_radius: 12,
      show_branding: true,
      custom_css: ''
    },
    ab_test_enabled: false,
    ab_test_config: {
      variants: [],
      split_percentage: 50
    }
  });

  // Load survey if editing
  useEffect(() => {
    if (isEditMode) {
      // Mock data - replace with API call
      setSurvey(prev => ({
        ...prev,
        id: parseInt(id),
        name: 'Customer Satisfaction Survey',
        description: 'Measure customer satisfaction after support interaction',
        type: 'nps',
        status: 'active',
        trigger: 'after_chat',
        trigger_delay: 5,
        trigger_conditions: [],
        settings: {
          show_progress: true,
          allow_skip: false,
          randomize_questions: false,
          one_response_per_user: true,
          show_thank_you: true,
          thank_you_message: 'Thank you for your feedback!'
        },
        questions: [
          {
            id: 'q1',
            type: 'nps',
            title: 'How likely are you to recommend us to a friend or colleague?',
            required: true,
            order: 0
          },
          {
            id: 'q2',
            type: 'text',
            title: 'What could we do better?',
            required: false,
            placeholder: 'Share your thoughts...',
            order: 1
          }
        ],
        targeting_config: prev.targeting_config,
        schedule_config: prev.schedule_config,
        style_config: prev.style_config,
        ab_test_enabled: false,
        ab_test_config: prev.ab_test_config
      }));
    }
  }, [id, isEditMode]);

  // Load template if provided
  useEffect(() => {
    if (templateId && !isEditMode) {
      // API call: GET /api/surveys/templates/list
      const templates = {
        nps: {
          name: 'NPS Survey',
          type: 'nps',
          questions: [
            { id: 'q1', type: 'nps', title: 'How likely are you to recommend us to a friend or colleague?', required: true, order: 0 },
            { id: 'q2', type: 'text', title: 'What is the main reason for your score?', required: false, order: 1 }
          ]
        },
        csat: {
          name: 'Customer Satisfaction Survey',
          type: 'csat',
          questions: [
            { id: 'q1', type: 'rating', title: 'How satisfied are you with our service?', required: true, max_rating: 5, order: 0 },
            { id: 'q2', type: 'text', title: 'How can we improve?', required: false, order: 1 }
          ]
        },
        ces: {
          name: 'Customer Effort Score Survey',
          type: 'ces',
          questions: [
            { id: 'q1', type: 'scale', title: 'How easy was it to get your issue resolved?', required: true, min: 1, max: 7, min_label: 'Very Difficult', max_label: 'Very Easy', order: 0 }
          ]
        },
        feedback: {
          name: 'General Feedback Survey',
          type: 'feedback',
          questions: [
            { id: 'q1', type: 'emoji', title: 'How was your experience?', required: true, order: 0 },
            { id: 'q2', type: 'text', title: 'Any additional feedback?', required: false, order: 1 }
          ]
        },
        exit: {
          name: 'Exit Survey',
          type: 'exit_intent',
          questions: [
            { id: 'q1', type: 'single_choice', title: 'Why are you leaving?', required: true, options: ['Found what I needed', 'Couldn\'t find what I needed', 'Too expensive', 'Just browsing', 'Other'], order: 0 },
            { id: 'q2', type: 'text', title: 'Any suggestions for us?', required: false, order: 1 }
          ]
        },
        product: {
          name: 'Product Feedback Survey',
          type: 'product_feedback',
          questions: [
            { id: 'q1', type: 'rating', title: 'How would you rate this product?', required: true, max_rating: 5, order: 0 },
            { id: 'q2', type: 'multiple_choice', title: 'What do you like about this product?', required: false, options: ['Quality', 'Price', 'Design', 'Functionality', 'Customer Support'], order: 1 },
            { id: 'q3', type: 'text', title: 'Any other feedback?', required: false, order: 2 }
          ]
        }
      };

      const template = templates[templateId];
      if (template) {
        setSurvey(prev => ({
          ...prev,
          name: template.name,
          type: template.type,
          questions: template.questions
        }));
        setHasChanges(true);
      }
    }
  }, [templateId, isEditMode]);

  const handleSurveyChange = (field, value) => {
    setSurvey(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSettingsChange = (field, value) => {
    setSurvey(prev => ({
      ...prev,
      settings: { ...prev.settings, [field]: value }
    }));
    setHasChanges(true);
  };

  // FAZ 5 config handlers
  const handleTargetingChange = (config) => {
    setSurvey(prev => ({
      ...prev,
      targeting_config: { ...prev.targeting_config, ...config }
    }));
    setHasChanges(true);
  };

  const handleScheduleChange = (config) => {
    setSurvey(prev => ({
      ...prev,
      schedule_config: { ...prev.schedule_config, ...config }
    }));
    setHasChanges(true);
  };

  const handleStyleChange = (config) => {
    setSurvey(prev => ({
      ...prev,
      style_config: { ...prev.style_config, ...config }
    }));
    setHasChanges(true);
  };

  const handleDeliveryChange = (field, value) => {
    handleSurveyChange(field, value);
  };

  const handleAddQuestion = (questionType) => {
    const newQuestion = {
      id: `q${Date.now()}`,
      type: questionType,
      title: '',
      required: true,
      order: survey.questions.length,
      ...(questionType === 'single_choice' || questionType === 'multiple_choice' ? {
        options: ['Option 1', 'Option 2']
      } : {}),
      ...(questionType === 'scale' ? {
        min: 1,
        max: 10,
        min_label: 'Not at all',
        max_label: 'Very much'
      } : {}),
      ...(questionType === 'rating' ? {
        max_rating: 5
      } : {}),
      ...(questionType === 'text' ? {
        placeholder: 'Enter your answer...',
        multiline: true
      } : {})
    };

    setSurvey(prev => ({
      ...prev,
      questions: [...prev.questions, newQuestion]
    }));
    setShowQuestionSelector(false);
    setHasChanges(true);
  };

  const handleUpdateQuestion = (questionId, updates) => {
    setSurvey(prev => ({
      ...prev,
      questions: prev.questions.map(q =>
        q.id === questionId ? { ...q, ...updates } : q
      )
    }));
    setHasChanges(true);
  };

  const handleDeleteQuestion = (questionId) => {
    if (window.confirm('Are you sure you want to delete this question?')) {
      setSurvey(prev => ({
        ...prev,
        questions: prev.questions.filter(q => q.id !== questionId)
      }));
      setHasChanges(true);
    }
  };

  const handleDuplicateQuestion = (question) => {
    const newQuestion = {
      ...question,
      id: `q${Date.now()}`,
      order: survey.questions.length
    };
    setSurvey(prev => ({
      ...prev,
      questions: [...prev.questions, newQuestion]
    }));
    setHasChanges(true);
  };

  const handleReorderQuestions = (fromIndex, toIndex) => {
    const newQuestions = [...survey.questions];
    const [movedQuestion] = newQuestions.splice(fromIndex, 1);
    newQuestions.splice(toIndex, 0, movedQuestion);

    // Update order property
    const reorderedQuestions = newQuestions.map((q, idx) => ({
      ...q,
      order: idx
    }));

    setSurvey(prev => ({ ...prev, questions: reorderedQuestions }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // API call to save survey
      await new Promise(resolve => setTimeout(resolve, 1000));
      setHasChanges(false);
      if (!isEditMode) {
        navigate('/surveys');
      }
    } catch (error) {
      console.error('Error saving survey:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (survey.questions.length === 0) {
      alert('Please add at least one question before publishing.');
      return;
    }
    handleSurveyChange('status', 'active');
    await handleSave();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  if (hasChanges && !window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
                    return;
                  }
                  navigate('/surveys');
                }}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <input
                  type="text"
                  value={survey.name}
                  onChange={(e) => handleSurveyChange('name', e.target.value)}
                  placeholder="Untitled Survey"
                  className="text-xl font-bold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 w-full"
                />
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    survey.status === 'active' ? 'bg-green-100 text-green-700' :
                    survey.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {survey.status.charAt(0).toUpperCase() + survey.status.slice(1)}
                  </span>
                  {hasChanges && (
                    <span className="text-xs text-gray-500">Unsaved changes</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPreview(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <Eye className="w-4 h-4" />
                Preview
              </button>

              <button
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
                className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save Draft'}
              </button>

              {survey.status === 'draft' ? (
                <button
                  onClick={handlePublish}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Play className="w-4 h-4" />
                  Publish
                </button>
              ) : survey.status === 'active' ? (
                <button
                  onClick={() => handleSurveyChange('status', 'paused')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                >
                  <Pause className="w-4 h-4" />
                  Pause
                </button>
              ) : (
                <button
                  onClick={() => handleSurveyChange('status', 'active')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Play className="w-4 h-4" />
                  Resume
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mt-4 -mb-4 overflow-x-auto">
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'settings'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Settings className="w-4 h-4 inline-block mr-1" />
              Settings
            </button>
            <button
              onClick={() => setActiveTab('questions')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'questions'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Questions
              <span className="ml-1.5 px-1.5 py-0.5 bg-gray-100 rounded-full text-xs">
                {survey.questions.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('targeting')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'targeting'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Target className="w-4 h-4 inline-block mr-1" />
              Targeting
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'schedule'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Calendar className="w-4 h-4 inline-block mr-1" />
              Schedule
            </button>
            <button
              onClick={() => setActiveTab('delivery')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'delivery'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Send className="w-4 h-4 inline-block mr-1" />
              Delivery
            </button>
            <button
              onClick={() => setActiveTab('style')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'style'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Palette className="w-4 h-4 inline-block mr-1" />
              Style
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {activeTab === 'settings' && (
          <SurveyForm
            survey={survey}
            onChange={handleSurveyChange}
            onSettingsChange={handleSettingsChange}
          />
        )}

        {activeTab === 'questions' && (
          <div className="space-y-4">
            {/* Questions List */}
            {survey.questions.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No questions yet</h3>
                <p className="text-gray-500 mb-4">Add your first question to get started</p>
                <button
                  onClick={() => setShowQuestionSelector(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Question
                </button>
              </div>
            ) : (
              <>
                {survey.questions.map((question, index) => (
                  <QuestionBuilder
                    key={question.id}
                    question={question}
                    index={index}
                    totalQuestions={survey.questions.length}
                    onUpdate={(updates) => handleUpdateQuestion(question.id, updates)}
                    onDelete={() => handleDeleteQuestion(question.id)}
                    onDuplicate={() => handleDuplicateQuestion(question)}
                    onMoveUp={() => index > 0 && handleReorderQuestions(index, index - 1)}
                    onMoveDown={() => index < survey.questions.length - 1 && handleReorderQuestions(index, index + 1)}
                  />
                ))}

                {/* Add Question Button */}
                <button
                  onClick={() => setShowQuestionSelector(true)}
                  className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add Question
                </button>
              </>
            )}
          </div>
        )}

        {activeTab === 'targeting' && (
          <SurveyTargeting
            config={survey.targeting_config}
            onChange={handleTargetingChange}
          />
        )}

        {activeTab === 'schedule' && (
          <SurveyScheduler
            config={survey.schedule_config}
            onChange={handleScheduleChange}
          />
        )}

        {activeTab === 'delivery' && (
          <SurveyDelivery
            survey={survey}
            onChange={handleDeliveryChange}
          />
        )}

        {activeTab === 'style' && (
          <SurveyStyleEditor
            config={survey.style_config}
            onChange={handleStyleChange}
          />
        )}
      </div>

      {/* Question Type Selector Modal */}
      {showQuestionSelector && (
        <QuestionTypeSelector
          onSelect={handleAddQuestion}
          onClose={() => setShowQuestionSelector(false)}
        />
      )}

      {/* Survey Preview Modal */}
      {showPreview && (
        <SurveyPreview
          survey={survey}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
};

export default SurveyBuilderPage;
