import React from 'react';
import {
  Settings,
  Zap,
  Clock,
  MessageSquare,
  Users,
  CheckCircle,
  XCircle,
  Shuffle,
  Eye
} from 'lucide-react';

const SurveyForm = ({ survey, onChange, onSettingsChange }) => {
  const surveyTypes = [
    { value: 'nps', label: 'NPS Survey', description: 'Net Promoter Score (0-10)' },
    { value: 'feedback', label: 'Feedback', description: 'General feedback collection' },
    { value: 'rating', label: 'Rating', description: 'Star rating surveys' },
    { value: 'exit', label: 'Exit Survey', description: 'Understand why users leave' }
  ];

  const triggerTypes = [
    { value: 'manual', label: 'Manual', description: 'Trigger via API or button' },
    { value: 'after_chat', label: 'After Chat', description: 'Show after chat session ends' },
    { value: 'on_exit', label: 'On Exit', description: 'Show when user is leaving' },
    { value: 'after_onboarding', label: 'After Onboarding', description: 'Show after user completes onboarding' },
    { value: 'time_based', label: 'Time Based', description: 'Show after X seconds on page' },
    { value: 'scroll_depth', label: 'Scroll Depth', description: 'Show after scrolling X%' }
  ];

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-500" />
          Basic Information
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Survey Name *
            </label>
            <input
              type="text"
              value={survey.name}
              onChange={(e) => onChange('name', e.target.value)}
              placeholder="e.g., Customer Satisfaction Survey"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={survey.description}
              onChange={(e) => onChange('description', e.target.value)}
              placeholder="Brief description of this survey's purpose..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Survey Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {surveyTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => onChange('type', type.value)}
                  className={`p-4 border rounded-lg text-left transition-all ${
                    survey.type === type.value
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-medium text-gray-900">{type.label}</p>
                  <p className="text-sm text-gray-500">{type.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Trigger Settings */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-gray-500" />
          Trigger Settings
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              When to show this survey
            </label>
            <div className="grid grid-cols-2 gap-3">
              {triggerTypes.map((trigger) => (
                <button
                  key={trigger.value}
                  type="button"
                  onClick={() => onChange('trigger', trigger.value)}
                  className={`p-3 border rounded-lg text-left transition-all ${
                    survey.trigger === trigger.value
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-medium text-gray-900 text-sm">{trigger.label}</p>
                  <p className="text-xs text-gray-500">{trigger.description}</p>
                </button>
              ))}
            </div>
          </div>

          {(survey.trigger === 'time_based' || survey.trigger === 'after_chat') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delay (seconds)
              </label>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <input
                  type="number"
                  min="0"
                  max="300"
                  value={survey.trigger_delay || 0}
                  onChange={(e) => onChange('trigger_delay', parseInt(e.target.value) || 0)}
                  className="w-24 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-500">seconds after trigger</span>
              </div>
            </div>
          )}

          {survey.trigger === 'scroll_depth' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Scroll Percentage
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="10"
                  max="100"
                  value={survey.scroll_percentage || 50}
                  onChange={(e) => onChange('scroll_percentage', parseInt(e.target.value) || 50)}
                  className="w-24 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-500">% of page scrolled</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Display Settings */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Eye className="w-5 h-5 text-gray-500" />
          Display Settings
        </h3>

        <div className="space-y-4">
          <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900">Show Progress Bar</p>
                <p className="text-sm text-gray-500">Display survey completion progress</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={survey.settings?.show_progress ?? true}
              onChange={(e) => onSettingsChange('show_progress', e.target.checked)}
              className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
            <div className="flex items-center gap-3">
              <XCircle className="w-5 h-5 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900">Allow Skip Questions</p>
                <p className="text-sm text-gray-500">Let users skip non-required questions</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={survey.settings?.allow_skip ?? false}
              onChange={(e) => onSettingsChange('allow_skip', e.target.checked)}
              className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
            <div className="flex items-center gap-3">
              <Shuffle className="w-5 h-5 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900">Randomize Questions</p>
                <p className="text-sm text-gray-500">Show questions in random order</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={survey.settings?.randomize_questions ?? false}
              onChange={(e) => onSettingsChange('randomize_questions', e.target.checked)}
              className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900">One Response Per User</p>
                <p className="text-sm text-gray-500">Prevent duplicate submissions</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={survey.settings?.one_response_per_user ?? true}
              onChange={(e) => onSettingsChange('one_response_per_user', e.target.checked)}
              className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
            />
          </label>
        </div>
      </div>

      {/* Thank You Settings */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-gray-500" />
          Thank You Message
        </h3>

        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={survey.settings?.show_thank_you ?? true}
              onChange={(e) => onSettingsChange('show_thank_you', e.target.checked)}
              className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Show thank you message after submission</span>
          </label>

          {survey.settings?.show_thank_you && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message
              </label>
              <textarea
                value={survey.settings?.thank_you_message || ''}
                onChange={(e) => onSettingsChange('thank_you_message', e.target.value)}
                placeholder="Thank you for your feedback!"
                rows={2}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SurveyForm;
