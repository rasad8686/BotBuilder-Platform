import React from 'react';

export default function SurveyProgress({
  current,
  total,
  primaryColor = '#8b5cf6'
}) {
  const percentage = (current / total) * 100;

  return (
    <div
      style={{
        padding: '12px 20px',
        backgroundColor: '#f9fafb',
        borderBottom: '1px solid #e5e7eb'
      }}
    >
      {/* Progress Info */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px'
        }}
      >
        <span
          style={{
            fontSize: '12px',
            color: '#6b7280'
          }}
        >
          Sual {current} / {total}
        </span>
        <span
          style={{
            fontSize: '12px',
            color: primaryColor,
            fontWeight: '500'
          }}
        >
          {Math.round(percentage)}%
        </span>
      </div>

      {/* Progress Bar */}
      <div
        style={{
          height: '6px',
          backgroundColor: '#e5e7eb',
          borderRadius: '3px',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${percentage}%`,
            backgroundColor: primaryColor,
            borderRadius: '3px',
            transition: 'width 0.3s ease'
          }}
        />
      </div>
    </div>
  );
}
