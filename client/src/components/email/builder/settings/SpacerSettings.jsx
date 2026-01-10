import React from 'react';

const SpacerSettings = ({ block, settings, onSettingsChange }) => {
  const presetHeights = ['20px', '40px', '60px', '80px', '100px'];

  return (
    <div className="space-y-4">
      {/* Height */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Height
        </label>
        <input
          type="text"
          value={settings.height || '40px'}
          onChange={(e) => onSettingsChange('height', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        />
      </div>

      {/* Preset Heights */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Quick Select
        </label>
        <div className="flex flex-wrap gap-2">
          {presetHeights.map((height) => (
            <button
              key={height}
              onClick={() => onSettingsChange('height', height)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                settings.height === height
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-600'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {height}
            </button>
          ))}
        </div>
      </div>

      {/* Height Slider */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Adjust Height
        </label>
        <input
          type="range"
          min="10"
          max="200"
          value={parseInt(settings.height) || 40}
          onChange={(e) => onSettingsChange('height', `${e.target.value}px`)}
          className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>10px</span>
          <span>200px</span>
        </div>
      </div>

      {/* Preview */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Preview
        </label>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
          <div className="p-2 bg-gray-200 dark:bg-gray-700 text-xs text-gray-500 text-center">
            Content above
          </div>
          <div
            style={{ height: settings.height || '40px' }}
            className="bg-purple-100 dark:bg-purple-900/30 border-l-4 border-purple-500 flex items-center justify-center"
          >
            <span className="text-xs text-purple-600 dark:text-purple-400">
              {settings.height || '40px'}
            </span>
          </div>
          <div className="p-2 bg-gray-200 dark:bg-gray-700 text-xs text-gray-500 text-center">
            Content below
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpacerSettings;
