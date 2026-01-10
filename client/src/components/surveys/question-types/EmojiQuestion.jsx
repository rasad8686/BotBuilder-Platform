import React from 'react';

const EmojiQuestion = ({ value, onChange, readonly = false }) => {
  const emojis = [
    { value: 'very_unsatisfied', emoji: '1F620', label: 'Very Unsatisfied' },
    { value: 'unsatisfied', emoji: '1F641', label: 'Unsatisfied' },
    { value: 'neutral', emoji: '1F610', label: 'Neutral' },
    { value: 'satisfied', emoji: '1F642', label: 'Satisfied' },
    { value: 'very_satisfied', emoji: '1F929', label: 'Very Satisfied' }
  ];

  // Convert hex code to emoji character
  const hexToEmoji = (hex) => {
    return String.fromCodePoint(parseInt(hex, 16));
  };

  return (
    <div className="flex flex-col items-center">
      <div className="flex gap-3">
        {emojis.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => !readonly && onChange?.(item.value)}
            disabled={readonly}
            className={`p-3 rounded-xl transition-all ${
              value === item.value
                ? 'bg-blue-100 ring-2 ring-blue-500 scale-110'
                : readonly
                ? 'opacity-50'
                : 'hover:bg-gray-100 hover:scale-105'
            }`}
            title={item.label}
          >
            <span className="text-4xl">{hexToEmoji(item.emoji)}</span>
          </button>
        ))}
      </div>

      {/* Labels */}
      <div className="flex justify-between w-full mt-3 text-xs text-gray-500 px-2">
        <span>Very Unsatisfied</span>
        <span>Very Satisfied</span>
      </div>

      {/* Selected Label */}
      {value && (
        <p className="mt-3 text-sm font-medium text-blue-600">
          {emojis.find(e => e.value === value)?.label}
        </p>
      )}
    </div>
  );
};

export default EmojiQuestion;
