import React, { useState } from 'react';

const DEFAULT_EMOJIS = [
  { value: 1, emoji: '😠', label: 'Cox pis' },
  { value: 2, emoji: '😐', label: 'Pis' },
  { value: 3, emoji: '😊', label: 'Normal' },
  { value: 4, emoji: '😍', label: 'Yaxsi' },
  { value: 5, emoji: '🤩', label: 'Ela' }
];

export default function EmojiRatingWidget({
  value,
  onChange,
  primaryColor = '#8b5cf6',
  config = {}
}) {
  const [hoverValue, setHoverValue] = useState(null);

  const emojis = config.emojis || DEFAULT_EMOJIS;
  const showLabels = config.showLabels !== false;
  const size = config.size || 40;

  return (
    <div>
      {/* Emoji Container */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '12px'
        }}
      >
        {emojis.map((item) => {
          const isSelected = value === item.value;
          const isHovered = hoverValue === item.value;

          return (
            <button
              key={item.value}
              onClick={() => onChange(item.value)}
              onMouseEnter={() => setHoverValue(item.value)}
              onMouseLeave={() => setHoverValue(null)}
              style={{
                background: isSelected ? `${primaryColor}20` : 'transparent',
                border: isSelected ? `2px solid ${primaryColor}` : '2px solid transparent',
                borderRadius: '12px',
                cursor: 'pointer',
                padding: '12px',
                transition: 'all 0.15s ease',
                transform: isHovered || isSelected ? 'scale(1.1)' : 'scale(1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px'
              }}
              aria-label={item.label}
            >
              <span
                style={{
                  fontSize: `${size}px`,
                  lineHeight: 1,
                  filter: isSelected || isHovered ? 'none' : 'grayscale(0.3)',
                  transition: 'filter 0.15s ease'
                }}
              >
                {item.emoji}
              </span>
              {showLabels && (
                <span
                  style={{
                    fontSize: '11px',
                    color: isSelected ? primaryColor : '#6b7280',
                    fontWeight: isSelected ? '500' : '400',
                    marginTop: '4px'
                  }}
                >
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Label (when labels are hidden) */}
      {!showLabels && value && (
        <div
          style={{
            textAlign: 'center',
            marginTop: '12px',
            fontSize: '14px',
            color: primaryColor,
            fontWeight: '500'
          }}
        >
          {emojis.find(e => e.value === value)?.label}
        </div>
      )}
    </div>
  );
}
