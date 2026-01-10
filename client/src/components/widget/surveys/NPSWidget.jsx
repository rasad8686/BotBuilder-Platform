import React from 'react';

const NPS_COLORS = {
  detractor: '#ef4444', // 0-6 Red
  passive: '#f59e0b',   // 7-8 Yellow
  promoter: '#22c55e'   // 9-10 Green
};

const getScoreColor = (score) => {
  if (score <= 6) return NPS_COLORS.detractor;
  if (score <= 8) return NPS_COLORS.passive;
  return NPS_COLORS.promoter;
};

export default function NPSWidget({
  value,
  onChange,
  primaryColor = '#8b5cf6',
  config = {}
}) {
  const minLabel = config.minLabel || 'Hec tovsiye etmerem';
  const maxLabel = config.maxLabel || 'Mutleq tovsiye ederem';

  return (
    <div>
      {/* Score Buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '4px',
          marginBottom: '8px'
        }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => {
          const isSelected = value === score;
          const scoreColor = getScoreColor(score);

          return (
            <button
              key={score}
              onClick={() => onChange(score)}
              style={{
                flex: 1,
                minWidth: '28px',
                height: '40px',
                border: isSelected ? `2px solid ${scoreColor}` : '1px solid #e5e7eb',
                borderRadius: '8px',
                backgroundColor: isSelected ? scoreColor : '#ffffff',
                color: isSelected ? '#ffffff' : '#374151',
                fontSize: '14px',
                fontWeight: isSelected ? '600' : '400',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseOver={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                  e.currentTarget.style.borderColor = scoreColor;
                }
              }}
              onMouseOut={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }
              }}
            >
              {score}
            </button>
          );
        })}
      </div>

      {/* Labels */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: '#6b7280'
        }}
      >
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>

      {/* Score Category Indicator */}
      {value !== undefined && value !== null && (
        <div
          style={{
            marginTop: '12px',
            padding: '8px 12px',
            borderRadius: '8px',
            backgroundColor: `${getScoreColor(value)}15`,
            color: getScoreColor(value),
            fontSize: '13px',
            textAlign: 'center',
            fontWeight: '500'
          }}
        >
          {value <= 6 && 'Detractor'}
          {value >= 7 && value <= 8 && 'Passive'}
          {value >= 9 && 'Promoter'}
        </div>
      )}
    </div>
  );
}
