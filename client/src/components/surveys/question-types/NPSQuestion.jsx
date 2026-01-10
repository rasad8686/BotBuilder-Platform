import React from 'react';

const NPSQuestion = ({ value, onChange, readonly = false }) => {
  const scores = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  const getScoreColor = (score) => {
    if (score <= 6) return 'border-red-300 bg-red-50 hover:bg-red-100 text-red-700';
    if (score <= 8) return 'border-yellow-300 bg-yellow-50 hover:bg-yellow-100 text-yellow-700';
    return 'border-green-300 bg-green-50 hover:bg-green-100 text-green-700';
  };

  const getSelectedColor = (score) => {
    if (score <= 6) return 'bg-red-500 border-red-500 text-white';
    if (score <= 8) return 'bg-yellow-500 border-yellow-500 text-white';
    return 'bg-green-500 border-green-500 text-white';
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 justify-center">
        {scores.map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => !readonly && onChange?.(score)}
            disabled={readonly}
            className={`w-10 h-10 rounded-lg border-2 font-semibold transition-all ${
              value === score
                ? getSelectedColor(score)
                : readonly
                ? 'border-gray-200 bg-gray-50 text-gray-400'
                : getScoreColor(score)
            }`}
          >
            {score}
          </button>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-xs text-gray-500 px-1">
        <span>Not at all likely</span>
        <span>Extremely likely</span>
      </div>

      {/* Category Legend */}
      <div className="flex justify-center gap-4 mt-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-500" />
          <span className="text-gray-500">Detractors (0-6)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-yellow-500" />
          <span className="text-gray-500">Passives (7-8)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span className="text-gray-500">Promoters (9-10)</span>
        </div>
      </div>
    </div>
  );
};

export default NPSQuestion;
