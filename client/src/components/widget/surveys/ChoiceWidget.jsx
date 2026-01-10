import React from 'react';
import { Check } from 'lucide-react';

export default function ChoiceWidget({
  value,
  onChange,
  options = [],
  multiple = false,
  primaryColor = '#8b5cf6',
  config = {}
}) {
  const layout = config.layout || 'vertical'; // 'vertical' or 'horizontal'
  const showIcons = config.showIcons !== false;

  // Handle selection
  const handleSelect = (optionValue) => {
    if (multiple) {
      // Multiple selection - toggle in array
      const currentValues = Array.isArray(value) ? value : [];
      const newValues = currentValues.includes(optionValue)
        ? currentValues.filter(v => v !== optionValue)
        : [...currentValues, optionValue];
      onChange(newValues);
    } else {
      // Single selection
      onChange(optionValue);
    }
  };

  // Check if option is selected
  const isSelected = (optionValue) => {
    if (multiple) {
      return Array.isArray(value) && value.includes(optionValue);
    }
    return value === optionValue;
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: layout === 'horizontal' ? 'row' : 'column',
        gap: '8px',
        flexWrap: layout === 'horizontal' ? 'wrap' : 'nowrap'
      }}
    >
      {options.map((option, index) => {
        const optionValue = typeof option === 'string' ? option : option.value;
        const optionLabel = typeof option === 'string' ? option : option.label;
        const optionIcon = typeof option === 'object' ? option.icon : null;
        const selected = isSelected(optionValue);

        return (
          <button
            key={optionValue || index}
            onClick={() => handleSelect(optionValue)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              backgroundColor: selected ? `${primaryColor}10` : '#ffffff',
              border: `2px solid ${selected ? primaryColor : '#e5e7eb'}`,
              borderRadius: '10px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease',
              flex: layout === 'horizontal' ? '1 1 auto' : 'none',
              minWidth: layout === 'horizontal' ? '120px' : 'auto'
            }}
            onMouseOver={(e) => {
              if (!selected) {
                e.currentTarget.style.borderColor = primaryColor;
                e.currentTarget.style.backgroundColor = '#f9fafb';
              }
            }}
            onMouseOut={(e) => {
              if (!selected) {
                e.currentTarget.style.borderColor = '#e5e7eb';
                e.currentTarget.style.backgroundColor = '#ffffff';
              }
            }}
          >
            {/* Selection Indicator */}
            {showIcons && (
              <div
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: multiple ? '6px' : '50%',
                  border: `2px solid ${selected ? primaryColor : '#d1d5db'}`,
                  backgroundColor: selected ? primaryColor : '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }}
              >
                {selected && (
                  <Check size={14} color="#ffffff" strokeWidth={3} />
                )}
              </div>
            )}

            {/* Option Icon (if provided) */}
            {optionIcon && (
              <span style={{ fontSize: '20px' }}>{optionIcon}</span>
            )}

            {/* Option Label */}
            <span
              style={{
                fontSize: '14px',
                color: selected ? primaryColor : '#374151',
                fontWeight: selected ? '500' : '400'
              }}
            >
              {optionLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}
