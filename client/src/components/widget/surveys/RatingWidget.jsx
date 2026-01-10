import React, { useState } from 'react';
import { Star } from 'lucide-react';

export default function RatingWidget({
  value,
  onChange,
  primaryColor = '#8b5cf6',
  maxRating = 5,
  config = {}
}) {
  const [hoverValue, setHoverValue] = useState(null);

  const starColor = config.starColor || '#fbbf24'; // Default gold color
  const emptyColor = config.emptyColor || '#e5e7eb';
  const size = config.size || 32;

  const displayValue = hoverValue !== null ? hoverValue : value;

  return (
    <div>
      {/* Stars Container */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px'
        }}
      >
        {Array.from({ length: maxRating }, (_, index) => {
          const starValue = index + 1;
          const isFilled = displayValue >= starValue;

          return (
            <button
              key={starValue}
              onClick={() => onChange(starValue)}
              onMouseEnter={() => setHoverValue(starValue)}
              onMouseLeave={() => setHoverValue(null)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                transition: 'transform 0.15s ease',
                transform: hoverValue === starValue ? 'scale(1.2)' : 'scale(1)'
              }}
              aria-label={`${starValue} ulduz`}
            >
              <Star
                size={size}
                fill={isFilled ? starColor : 'none'}
                color={isFilled ? starColor : emptyColor}
                strokeWidth={1.5}
                style={{
                  transition: 'all 0.15s ease'
                }}
              />
            </button>
          );
        })}
      </div>

      {/* Rating Text */}
      {value && (
        <div
          style={{
            textAlign: 'center',
            marginTop: '12px',
            fontSize: '14px',
            color: '#4b5563'
          }}
        >
          {value} / {maxRating} ulduz
        </div>
      )}

      {/* Rating Labels (if configured) */}
      {config.labels && config.labels.length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '8px',
            fontSize: '11px',
            color: '#6b7280'
          }}
        >
          {config.labels.map((label, index) => (
            <span key={index}>{label}</span>
          ))}
        </div>
      )}
    </div>
  );
}
