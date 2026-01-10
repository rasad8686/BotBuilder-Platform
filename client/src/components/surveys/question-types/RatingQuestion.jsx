import React, { useState } from 'react';
import { Star } from 'lucide-react';

const RatingQuestion = ({ maxRating = 5, value, onChange, readonly = false }) => {
  const [hoverValue, setHoverValue] = useState(null);

  const displayValue = hoverValue !== null ? hoverValue : value;

  return (
    <div className="flex flex-col items-center">
      <div className="flex gap-1">
        {[...Array(maxRating)].map((_, index) => {
          const starValue = index + 1;
          const isFilled = displayValue >= starValue;

          return (
            <button
              key={index}
              type="button"
              onClick={() => !readonly && onChange?.(starValue)}
              onMouseEnter={() => !readonly && setHoverValue(starValue)}
              onMouseLeave={() => !readonly && setHoverValue(null)}
              disabled={readonly}
              className={`p-1 transition-transform ${
                !readonly && 'hover:scale-110'
              }`}
            >
              <Star
                className={`w-8 h-8 transition-colors ${
                  isFilled
                    ? 'text-orange-400 fill-orange-400'
                    : 'text-gray-300'
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Label */}
      {value && (
        <p className="mt-2 text-sm text-gray-600">
          {value === 1 && 'Poor'}
          {value === 2 && 'Fair'}
          {value === 3 && 'Good'}
          {value === 4 && 'Very Good'}
          {value === 5 && 'Excellent'}
        </p>
      )}
    </div>
  );
};

export default RatingQuestion;
