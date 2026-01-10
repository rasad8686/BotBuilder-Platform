import React from 'react';
import { AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react';

const AlignmentPicker = ({ label = 'Alignment', value, onChange, showJustify = false }) => {
  const options = [
    { value: 'left', icon: AlignLeft },
    { value: 'center', icon: AlignCenter },
    { value: 'right', icon: AlignRight },
    ...(showJustify ? [{ value: 'justify', icon: AlignJustify }] : [])
  ];

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
        {options.map(({ value: optValue, icon: Icon }) => (
          <button
            key={optValue}
            type="button"
            onClick={() => onChange(optValue)}
            className={`flex-1 p-2 flex items-center justify-center transition-colors ${
              value === optValue
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600'
                : 'bg-white dark:bg-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
            title={optValue.charAt(0).toUpperCase() + optValue.slice(1)}
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default AlignmentPicker;
