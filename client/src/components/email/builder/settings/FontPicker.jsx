import React from 'react';

const WEB_SAFE_FONTS = [
  { name: 'Arial', value: 'Arial, sans-serif' },
  { name: 'Arial Black', value: '"Arial Black", sans-serif' },
  { name: 'Comic Sans MS', value: '"Comic Sans MS", cursive' },
  { name: 'Courier New', value: '"Courier New", monospace' },
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { name: 'Impact', value: 'Impact, sans-serif' },
  { name: 'Lucida Console', value: '"Lucida Console", monospace' },
  { name: 'Palatino Linotype', value: '"Palatino Linotype", serif' },
  { name: 'Tahoma', value: 'Tahoma, sans-serif' },
  { name: 'Times New Roman', value: '"Times New Roman", serif' },
  { name: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
  { name: 'Verdana', value: 'Verdana, sans-serif' }
];

const FontPicker = ({ label = 'Font Family', value, onChange }) => {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <select
        value={value || 'Arial, sans-serif'}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        style={{ fontFamily: value }}
      >
        {WEB_SAFE_FONTS.map(font => (
          <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>
            {font.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-gray-500 mt-1">
        Web-safe fonts work across all email clients
      </p>
    </div>
  );
};

export default FontPicker;
