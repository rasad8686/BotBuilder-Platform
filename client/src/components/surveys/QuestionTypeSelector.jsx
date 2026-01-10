import React from 'react';
import {
  X,
  ThumbsUp,
  Star,
  Smile,
  Sliders,
  CircleDot,
  CheckSquare,
  Type
} from 'lucide-react';

const QuestionTypeSelector = ({ onSelect, onClose }) => {
  const questionTypes = [
    {
      type: 'nps',
      icon: ThumbsUp,
      label: 'NPS (Net Promoter Score)',
      description: '0-10 scale to measure customer loyalty',
      color: 'purple'
    },
    {
      type: 'rating',
      icon: Star,
      label: 'Star Rating',
      description: 'Classic 1-5 star rating',
      color: 'orange'
    },
    {
      type: 'emoji',
      icon: Smile,
      label: 'Emoji Rating',
      description: 'Visual emoji-based feedback',
      color: 'yellow'
    },
    {
      type: 'scale',
      icon: Sliders,
      label: 'Custom Scale',
      description: 'Customizable numeric scale',
      color: 'blue'
    },
    {
      type: 'single_choice',
      icon: CircleDot,
      label: 'Single Choice',
      description: 'Select one option from a list',
      color: 'green'
    },
    {
      type: 'multiple_choice',
      icon: CheckSquare,
      label: 'Multiple Choice',
      description: 'Select multiple options',
      color: 'teal'
    },
    {
      type: 'text',
      icon: Type,
      label: 'Text Answer',
      description: 'Open-ended text response',
      color: 'gray'
    }
  ];

  const colorClasses = {
    purple: 'bg-purple-50 text-purple-600 group-hover:bg-purple-100',
    orange: 'bg-orange-50 text-orange-600 group-hover:bg-orange-100',
    yellow: 'bg-yellow-50 text-yellow-600 group-hover:bg-yellow-100',
    blue: 'bg-blue-50 text-blue-600 group-hover:bg-blue-100',
    green: 'bg-green-50 text-green-600 group-hover:bg-green-100',
    teal: 'bg-teal-50 text-teal-600 group-hover:bg-teal-100',
    gray: 'bg-gray-50 text-gray-600 group-hover:bg-gray-100'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Add Question</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-500 mb-4">Select a question type to add to your survey</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {questionTypes.map((qt) => {
              const Icon = qt.icon;
              return (
                <button
                  key={qt.type}
                  onClick={() => onSelect(qt.type)}
                  className="group flex items-start gap-4 p-4 border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all text-left"
                >
                  <div className={`p-3 rounded-lg transition-colors ${colorClasses[qt.color]}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{qt.label}</p>
                    <p className="text-sm text-gray-500">{qt.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full py-2 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestionTypeSelector;
