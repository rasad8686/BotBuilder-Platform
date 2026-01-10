import React from 'react';
import { Columns, Grid2X2, Grid3X3 } from 'lucide-react';

const ColumnsSettings = ({ block, settings, onSettingsChange }) => {
  return (
    <div className="space-y-4">
      {/* Number of Columns */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Number of Columns
        </label>
        <div className="flex gap-2">
          {[2, 3, 4].map(num => (
            <button
              key={num}
              onClick={() => onSettingsChange('columns', num)}
              className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors ${
                settings.columns === num
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-600'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {num === 2 ? (
                <Grid2X2 className="w-5 h-5" />
              ) : num === 3 ? (
                <Grid3X3 className="w-5 h-5" />
              ) : (
                <Columns className="w-5 h-5" />
              )}
              <span className="text-xs">{num} Cols</span>
            </button>
          ))}
        </div>
      </div>

      {/* Column Gap */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Column Gap
        </label>
        <select
          value={settings.columnGap || '20px'}
          onChange={(e) => onSettingsChange('columnGap', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="0px">None (0px)</option>
          <option value="10px">Small (10px)</option>
          <option value="15px">Medium (15px)</option>
          <option value="20px">Large (20px)</option>
          <option value="30px">Extra Large (30px)</option>
        </select>
      </div>

      {/* Stack on Mobile */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Stack on Mobile
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Columns will stack vertically on small screens
          </p>
        </div>
        <button
          onClick={() => onSettingsChange('stackOnMobile', !settings.stackOnMobile)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            settings.stackOnMobile !== false ? 'bg-purple-600' : 'bg-gray-200 dark:bg-gray-700'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              settings.stackOnMobile !== false ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Preview */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Preview
        </label>
        <div
          className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4"
          style={{
            display: 'flex',
            gap: settings.columnGap || '20px'
          }}
        >
          {Array.from({ length: settings.columns || 2 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 h-16 bg-purple-100 dark:bg-purple-900/30 rounded border-2 border-dashed border-purple-300 dark:border-purple-600 flex items-center justify-center"
            >
              <span className="text-xs text-purple-600 dark:text-purple-400">
                Column {i + 1}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          Tip: Drag content blocks directly into each column in the canvas to add content.
        </p>
      </div>
    </div>
  );
};

export default ColumnsSettings;
