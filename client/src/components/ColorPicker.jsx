import { useState } from 'react';
import { RotateCcw } from 'lucide-react';

/**
 * Color Picker Component
 * Allows users to pick colors for white-label branding
 */

export default function ColorPicker({ label, value, onChange, defaultValue, description }) {
  const [localValue, setLocalValue] = useState(value || defaultValue || '#8b5cf6');

  const handleChange = (e) => {
    const newColor = e.target.value;
    setLocalValue(newColor);
    if (onChange) {
      onChange(newColor);
    }
  };

  const handleReset = () => {
    setLocalValue(defaultValue);
    if (onChange) {
      onChange(defaultValue);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label}
      </label>

      <div className="flex items-center gap-3">
        {/* Color preview box */}
        <div
          className="w-12 h-12 rounded-lg border-2 border-gray-200 shadow-sm"
          style={{ backgroundColor: localValue }}
        />

        {/* Native color input */}
        <input
          type="color"
          value={localValue}
          onChange={handleChange}
          className="w-20 h-12 cursor-pointer border-2 border-gray-200 rounded-lg"
        />

        {/* Hex value input */}
        <input
          type="text"
          value={localValue}
          onChange={handleChange}
          placeholder="#8b5cf6"
          maxLength={7}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
        />

        {/* Reset button */}
        {defaultValue && localValue !== defaultValue && (
          <button
            type="button"
            onClick={handleReset}
            className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
            title="Reset to default"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        )}
      </div>

      {description && (
        <p className="text-xs text-gray-500">{description}</p>
      )}
    </div>
  );
}
