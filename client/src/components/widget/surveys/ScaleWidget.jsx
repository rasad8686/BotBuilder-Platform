import React, { useState } from 'react';

export default function ScaleWidget({
  value,
  onChange,
  primaryColor = '#8b5cf6',
  min = 1,
  max = 10,
  minLabel,
  maxLabel,
  config = {}
}) {
  const [isDragging, setIsDragging] = useState(false);

  const step = config.step || 1;
  const showValue = config.showValue !== false;
  const showTicks = config.showTicks !== false;

  const range = max - min;
  const percentage = value !== undefined ? ((value - min) / range) * 100 : 0;

  // Generate tick marks
  const ticks = [];
  for (let i = min; i <= max; i += step) {
    ticks.push(i);
  }

  const handleSliderChange = (e) => {
    const newValue = parseInt(e.target.value, 10);
    onChange(newValue);
  };

  const handleTickClick = (tickValue) => {
    onChange(tickValue);
  };

  return (
    <div>
      {/* Current Value Display */}
      {showValue && value !== undefined && (
        <div
          style={{
            textAlign: 'center',
            marginBottom: '16px'
          }}
        >
          <span
            style={{
              display: 'inline-block',
              padding: '8px 20px',
              backgroundColor: primaryColor,
              color: '#ffffff',
              borderRadius: '20px',
              fontSize: '18px',
              fontWeight: '600'
            }}
          >
            {value}
          </span>
        </div>
      )}

      {/* Slider Container */}
      <div style={{ position: 'relative', padding: '10px 0' }}>
        {/* Track Background */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: '8px',
            backgroundColor: '#e5e7eb',
            borderRadius: '4px',
            transform: 'translateY(-50%)'
          }}
        />

        {/* Track Fill */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            width: `${percentage}%`,
            height: '8px',
            backgroundColor: primaryColor,
            borderRadius: '4px',
            transform: 'translateY(-50%)',
            transition: isDragging ? 'none' : 'width 0.15s ease'
          }}
        />

        {/* Range Input */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value || min}
          onChange={handleSliderChange}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onTouchStart={() => setIsDragging(true)}
          onTouchEnd={() => setIsDragging(false)}
          style={{
            width: '100%',
            height: '24px',
            appearance: 'none',
            background: 'transparent',
            cursor: 'pointer',
            position: 'relative',
            zIndex: 2,
            margin: 0
          }}
        />

        <style>
          {`
            input[type="range"]::-webkit-slider-thumb {
              appearance: none;
              width: 24px;
              height: 24px;
              background: ${primaryColor};
              border-radius: 50%;
              cursor: pointer;
              border: 3px solid #ffffff;
              box-shadow: 0 2px 6px rgba(0,0,0,0.2);
              transition: transform 0.15s ease;
            }
            input[type="range"]::-webkit-slider-thumb:hover {
              transform: scale(1.1);
            }
            input[type="range"]::-moz-range-thumb {
              width: 24px;
              height: 24px;
              background: ${primaryColor};
              border-radius: 50%;
              cursor: pointer;
              border: 3px solid #ffffff;
              box-shadow: 0 2px 6px rgba(0,0,0,0.2);
            }
          `}
        </style>
      </div>

      {/* Tick Marks */}
      {showTicks && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '8px',
            padding: '0 4px'
          }}
        >
          {ticks.map((tick) => (
            <button
              key={tick}
              onClick={() => handleTickClick(tick)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px',
                fontSize: '12px',
                color: value === tick ? primaryColor : '#6b7280',
                fontWeight: value === tick ? '600' : '400',
                transition: 'color 0.15s ease'
              }}
            >
              {tick}
            </button>
          ))}
        </div>
      )}

      {/* Min/Max Labels */}
      {(minLabel || maxLabel) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '8px',
            fontSize: '11px',
            color: '#6b7280'
          }}
        >
          <span>{minLabel || min}</span>
          <span>{maxLabel || max}</span>
        </div>
      )}
    </div>
  );
}
