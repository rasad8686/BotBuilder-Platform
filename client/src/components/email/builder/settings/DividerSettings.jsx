import React from 'react';
import ColorPicker from './ColorPicker';

const DividerSettings = ({ block, settings, onSettingsChange }) => {
  return (
    <div className="space-y-4">
      {/* Style */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Line Style
        </label>
        <select
          value={settings.style || 'solid'}
          onChange={(e) => onSettingsChange('style', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
        </select>
      </div>

      {/* Color */}
      <ColorPicker
        label="Line Color"
        value={settings.color || '#E5E7EB'}
        onChange={(value) => onSettingsChange('color', value)}
      />

      {/* Thickness */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Thickness
        </label>
        <select
          value={settings.thickness || '1px'}
          onChange={(e) => onSettingsChange('thickness', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="1px">1px</option>
          <option value="2px">2px</option>
          <option value="3px">3px</option>
          <option value="4px">4px</option>
          <option value="5px">5px</option>
        </select>
      </div>

      {/* Width */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Width
        </label>
        <select
          value={settings.width || '100%'}
          onChange={(e) => onSettingsChange('width', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="25%">25%</option>
          <option value="50%">50%</option>
          <option value="75%">75%</option>
          <option value="100%">100%</option>
        </select>
      </div>

      {/* Preview */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Preview
        </label>
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <hr
            style={{
              border: 'none',
              borderTop: `${settings.thickness || '1px'} ${settings.style || 'solid'} ${settings.color || '#E5E7EB'}`,
              width: settings.width || '100%',
              margin: '0 auto'
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default DividerSettings;
