import React from 'react';

const ScaleQuestion = ({
  min = 1,
  max = 10,
  minLabel = '',
  maxLabel = '',
  value,
  onChange,
  readonly = false
}) => {
  const range = [];
  for (let i = min; i <= max; i++) {
    range.push(i);
  }

  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-wrap gap-2 justify-center">
        {range.map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => !readonly && onChange?.(num)}
            disabled={readonly}
            className={`w-10 h-10 rounded-lg border-2 font-semibold transition-all ${
              value === num
                ? 'bg-blue-600 border-blue-600 text-white'
                : readonly
                ? 'border-gray-200 bg-gray-50 text-gray-400'
                : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-gray-700'
            }`}
          >
            {num}
          </button>
        ))}
      </div>

      {/* Labels */}
      {(minLabel || maxLabel) && (
        <div className="flex justify-between w-full mt-2 text-xs text-gray-500 px-1">
          <span>{minLabel || min}</span>
          <span>{maxLabel || max}</span>
        </div>
      )}

      {/* Value indicator */}
      {value !== undefined && value !== null && (
        <div className="mt-3 text-center">
          <span className="text-2xl font-bold text-blue-600">{value}</span>
          <span className="text-gray-400 text-sm"> / {max}</span>
        </div>
      )}
    </div>
  );
};

export default ScaleQuestion;
