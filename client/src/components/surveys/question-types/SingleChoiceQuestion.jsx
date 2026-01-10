import React from 'react';
import { Circle, CheckCircle } from 'lucide-react';

const SingleChoiceQuestion = ({ options = [], value, onChange, readonly = false }) => {
  return (
    <div className="space-y-2">
      {options.map((option, index) => {
        const isSelected = value === option;

        return (
          <button
            key={index}
            type="button"
            onClick={() => !readonly && onChange?.(option)}
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
              <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
            ) : (
              <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" />
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
    </div>
  );
};

export default SingleChoiceQuestion;
