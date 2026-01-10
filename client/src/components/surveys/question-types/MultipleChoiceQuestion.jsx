import React from 'react';
import { Square, CheckSquare } from 'lucide-react';

const MultipleChoiceQuestion = ({ options = [], value = [], onChange, readonly = false }) => {
  const selectedValues = Array.isArray(value) ? value : [];

  const toggleOption = (option) => {
    if (readonly) return;

    let newValues;
    if (selectedValues.includes(option)) {
      newValues = selectedValues.filter(v => v !== option);
    } else {
      newValues = [...selectedValues, option];
    }
    onChange?.(newValues);
  };

  return (
    <div className="space-y-2">
      {options.map((option, index) => {
        const isSelected = selectedValues.includes(option);

        return (
          <button
            key={index}
            type="button"
            onClick={() => toggleOption(option)}
            disabled={readonly}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
              isSelected
                ? 'border-blue-500 bg-blue-50'
                : readonly
                ? 'border-gray-200 bg-gray-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            {isSelected ? (
              <CheckSquare className="w-5 h-5 text-blue-600 flex-shrink-0" />
            ) : (
              <Square className="w-5 h-5 text-gray-300 flex-shrink-0" />
            )}
            <span className={`text-sm ${isSelected ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>
              {option}
            </span>
          </button>
        );
      })}

      {options.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">No options defined</p>
      )}

      {/* Selection count */}
      {selectedValues.length > 0 && (
        <p className="text-xs text-gray-500 text-center mt-2">
          {selectedValues.length} option{selectedValues.length !== 1 ? 's' : ''} selected
        </p>
      )}
    </div>
  );
};

export default MultipleChoiceQuestion;
