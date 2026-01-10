import React, { useState } from 'react';
import {
  GripVertical,
  ChevronDown,
  ChevronUp,
  Copy,
  Trash2,
  Plus,
  X,
  Settings
} from 'lucide-react';
import QuestionPreview from './QuestionPreview';

const QuestionBuilder = ({
  question,
  index,
  totalQuestions,
  onUpdate,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const questionTypeLabels = {
    nps: 'NPS (0-10)',
    rating: 'Star Rating',
    emoji: 'Emoji Rating',
    scale: 'Scale',
    single_choice: 'Single Choice',
    multiple_choice: 'Multiple Choice',
    text: 'Text Answer'
  };

  const handleAddOption = () => {
    const options = question.options || [];
    onUpdate({
      options: [...options, `Option ${options.length + 1}`]
    });
  };

  const handleUpdateOption = (optionIndex, value) => {
    const options = [...(question.options || [])];
    options[optionIndex] = value;
    onUpdate({ options });
  };

  const handleRemoveOption = (optionIndex) => {
    const options = (question.options || []).filter((_, i) => i !== optionIndex);
    onUpdate({ options });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <button className="cursor-grab text-gray-400 hover:text-gray-600">
          <GripVertical className="w-5 h-5" />
        </button>

        <span className="text-sm font-medium text-gray-500">Q{index + 1}</span>

        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
          {questionTypeLabels[question.type] || question.type}
        </span>

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move up"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === totalQuestions - 1}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move down"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1 rounded ${showSettings ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600'}`}
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={onDuplicate}
            className="p-1 text-gray-400 hover:text-gray-600"
            title="Duplicate"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-gray-400 hover:text-red-600"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-gray-400 hover:text-gray-600 ml-2"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4">
          {/* Question Title */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Question *
            </label>
            <input
              type="text"
              value={question.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              placeholder="Enter your question..."
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Description (optional) */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              value={question.description || ''}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Additional context for this question..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Type-specific settings */}
          {(question.type === 'single_choice' || question.type === 'multiple_choice') && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Options
              </label>
              <div className="space-y-2">
                {(question.options || []).map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center gap-2">
                    <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded text-xs text-gray-500">
                      {optionIndex + 1}
                    </span>
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => handleUpdateOption(optionIndex, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => handleRemoveOption(optionIndex)}
                      className="p-1 text-gray-400 hover:text-red-600"
                      disabled={(question.options || []).length <= 2}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={handleAddOption}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Option
                </button>
              </div>
            </div>
          )}

          {question.type === 'scale' && (
            <div className="mb-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Value
                </label>
                <input
                  type="number"
                  value={question.min || 1}
                  onChange={(e) => onUpdate({ min: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Value
                </label>
                <input
                  type="number"
                  value={question.max || 10}
                  onChange={(e) => onUpdate({ max: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Label
                </label>
                <input
                  type="text"
                  value={question.min_label || ''}
                  onChange={(e) => onUpdate({ min_label: e.target.value })}
                  placeholder="e.g., Not at all"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Label
                </label>
                <input
                  type="text"
                  value={question.max_label || ''}
                  onChange={(e) => onUpdate({ max_label: e.target.value })}
                  placeholder="e.g., Very much"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {question.type === 'rating' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Rating
              </label>
              <select
                value={question.max_rating || 5}
                onChange={(e) => onUpdate({ max_rating: parseInt(e.target.value) })}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={3}>3 stars</option>
                <option value={5}>5 stars</option>
                <option value={10}>10 stars</option>
              </select>
            </div>
          )}

          {question.type === 'text' && (
            <div className="mb-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Placeholder
                </label>
                <input
                  type="text"
                  value={question.placeholder || ''}
                  onChange={(e) => onUpdate({ placeholder: e.target.value })}
                  placeholder="Enter placeholder text..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={question.multiline ?? true}
                  onChange={(e) => onUpdate({ multiline: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600"
                />
                <span className="text-sm text-gray-700">Multi-line text area</span>
              </label>
            </div>
          )}

          {/* Settings Panel */}
          {showSettings && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Question Settings</h4>
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={question.required ?? true}
                    onChange={(e) => onUpdate({ required: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span className="text-sm text-gray-700">Required</span>
                </label>
              </div>
            </div>
          )}

          {/* Preview */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-2">Preview:</p>
            <div className="bg-gray-50 rounded-lg p-4">
              <QuestionPreview question={question} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionBuilder;
