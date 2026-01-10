import React, { useState, useRef, useEffect } from 'react';
import { Check } from 'lucide-react';

const DEFAULT_PRESETS = [
  '#000000', '#333333', '#666666', '#999999', '#CCCCCC', '#FFFFFF',
  '#7C3AED', '#8B5CF6', '#A78BFA', '#C4B5FD',
  '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD',
  '#059669', '#10B981', '#34D399', '#6EE7B7',
  '#DC2626', '#EF4444', '#F87171', '#FCA5A5',
  '#D97706', '#F59E0B', '#FBBF24', '#FCD34D'
];

const ColorPicker = ({
  label,
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  showTransparent = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customColor, setCustomColor] = useState(value || '#000000');
  const pickerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setCustomColor(value || '#000000');
  }, [value]);

  const handlePresetClick = (color) => {
    onChange(color);
    setCustomColor(color);
    setIsOpen(false);
  };

  const handleCustomChange = (e) => {
    const color = e.target.value;
    setCustomColor(color);
    onChange(color);
  };

  const isSelected = (color) => {
    return value?.toLowerCase() === color.toLowerCase();
  };

  return (
    <div className="relative" ref={pickerRef}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-left"
      >
        <div
          className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600"
          style={{
            backgroundColor: value === 'transparent' ? 'transparent' : value,
            backgroundImage: value === 'transparent'
              ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)'
              : 'none',
            backgroundSize: '8px 8px',
            backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px'
          }}
        />
        <span className="flex-1 text-sm text-gray-900 dark:text-white">
          {value === 'transparent' ? 'Transparent' : value}
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-2 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 w-64">
          {/* Presets */}
          <div className="grid grid-cols-6 gap-1 mb-3">
            {showTransparent && (
              <button
                type="button"
                onClick={() => handlePresetClick('transparent')}
                className={`w-8 h-8 rounded border-2 relative ${
                  value === 'transparent'
                    ? 'border-purple-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
                style={{
                  backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
                  backgroundSize: '8px 8px',
                  backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px'
                }}
                title="Transparent"
              >
                {value === 'transparent' && (
                  <Check className="w-4 h-4 text-gray-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                )}
              </button>
            )}
            {presets.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => handlePresetClick(color)}
                className={`w-8 h-8 rounded border-2 relative transition-transform hover:scale-110 ${
                  isSelected(color)
                    ? 'border-purple-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              >
                {isSelected(color) && (
                  <Check
                    className="w-4 h-4 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                    style={{ color: isLightColor(color) ? '#000' : '#fff' }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Custom Color */}
          <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
            <input
              type="color"
              value={customColor}
              onChange={handleCustomChange}
              className="w-10 h-10 rounded cursor-pointer"
            />
            <input
              type="text"
              value={customColor}
              onChange={(e) => {
                setCustomColor(e.target.value);
                if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                  onChange(e.target.value);
                }
              }}
              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
              placeholder="#000000"
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Helper to determine if color is light
function isLightColor(color) {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155;
}

export default ColorPicker;
