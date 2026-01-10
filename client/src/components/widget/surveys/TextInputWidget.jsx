import React, { useState } from 'react';

export default function TextInputWidget({
  value,
  onChange,
  placeholder = 'Cavabinizi yazin...',
  multiline = false,
  primaryColor = '#8b5cf6',
  config = {}
}) {
  const [isFocused, setIsFocused] = useState(false);

  const maxLength = config.maxLength || null;
  const minLength = config.minLength || null;
  const rows = config.rows || 4;

  const currentLength = value?.length || 0;
  const isOverLimit = maxLength && currentLength > maxLength;
  const isUnderLimit = minLength && currentLength < minLength && currentLength > 0;

  const handleChange = (e) => {
    const newValue = e.target.value;
    // Don't restrict typing, just show warning
    onChange(newValue);
  };

  const inputStyles = {
    width: '100%',
    padding: '12px 14px',
    border: `2px solid ${isFocused ? primaryColor : isOverLimit ? '#ef4444' : '#e5e7eb'}`,
    borderRadius: '10px',
    fontSize: '14px',
    resize: multiline ? 'vertical' : 'none',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    lineHeight: '1.5',
    transition: 'border-color 0.15s ease',
    backgroundColor: '#ffffff'
  };

  return (
    <div>
      {multiline ? (
        <textarea
          value={value || ''}
          onChange={handleChange}
          placeholder={placeholder}
          rows={rows}
          style={{
            ...inputStyles,
            minHeight: '80px'
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
      ) : (
        <input
          type="text"
          value={value || ''}
          onChange={handleChange}
          placeholder={placeholder}
          style={inputStyles}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
      )}

      {/* Character Counter / Validation */}
      {(maxLength || minLength) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '6px',
            fontSize: '11px'
          }}
        >
          <div>
            {isUnderLimit && (
              <span style={{ color: '#f59e0b' }}>
                Minimum {minLength} simvol olmalidir
              </span>
            )}
            {isOverLimit && (
              <span style={{ color: '#ef4444' }}>
                Maksimum {maxLength} simvol icaze verilir
              </span>
            )}
          </div>
          <div
            style={{
              color: isOverLimit ? '#ef4444' : '#9ca3af'
            }}
          >
            {currentLength}
            {maxLength && ` / ${maxLength}`}
          </div>
        </div>
      )}
    </div>
  );
}
