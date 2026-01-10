import React from 'react';
import ColorPicker from './ColorPicker';
import AlignmentPicker from './AlignmentPicker';

const ButtonSettings = ({ block, settings, onSettingsChange }) => {
  return (
    <div className="space-y-4">
      {/* Button Text */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Button Text
        </label>
        <input
          type="text"
          value={settings.text || ''}
          onChange={(e) => onSettingsChange('text', e.target.value)}
          placeholder="Click Here"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        />
      </div>

      {/* URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Link URL
        </label>
        <input
          type="text"
          value={settings.url || ''}
          onChange={(e) => onSettingsChange('url', e.target.value)}
          placeholder="https://example.com"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        />
      </div>

      {/* Background Color */}
      <ColorPicker
        label="Button Color"
        value={settings.backgroundColor || '#7C3AED'}
        onChange={(value) => onSettingsChange('backgroundColor', value)}
      />

      {/* Text Color */}
      <ColorPicker
        label="Text Color"
        value={settings.textColor || '#FFFFFF'}
        onChange={(value) => onSettingsChange('textColor', value)}
      />

      {/* Font Size */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Font Size
        </label>
        <select
          value={settings.fontSize || '16px'}
          onChange={(e) => onSettingsChange('fontSize', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="12px">Small (12px)</option>
          <option value="14px">Medium Small (14px)</option>
          <option value="16px">Medium (16px)</option>
          <option value="18px">Medium Large (18px)</option>
          <option value="20px">Large (20px)</option>
        </select>
      </div>

      {/* Font Weight */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Font Weight
        </label>
        <select
          value={settings.fontWeight || 'bold'}
          onChange={(e) => onSettingsChange('fontWeight', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="normal">Normal</option>
          <option value="medium">Medium</option>
          <option value="semibold">Semi Bold</option>
          <option value="bold">Bold</option>
        </select>
      </div>

      {/* Border Radius */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Border Radius
        </label>
        <select
          value={settings.borderRadius || '6px'}
          onChange={(e) => onSettingsChange('borderRadius', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="0px">None (0px)</option>
          <option value="4px">Small (4px)</option>
          <option value="6px">Medium (6px)</option>
          <option value="8px">Large (8px)</option>
          <option value="12px">Extra Large (12px)</option>
          <option value="9999px">Pill</option>
        </select>
      </div>

      {/* Alignment */}
      <AlignmentPicker
        value={settings.align || 'center'}
        onChange={(value) => onSettingsChange('align', value)}
      />

      {/* Full Width */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Full Width
        </label>
        <button
          onClick={() => onSettingsChange('fullWidth', !settings.fullWidth)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            settings.fullWidth ? 'bg-purple-600' : 'bg-gray-200 dark:bg-gray-700'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              settings.fullWidth ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Preview */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Preview
        </label>
        <div className={`text-${settings.align || 'center'}`}>
          <span
            style={{
              display: settings.fullWidth ? 'block' : 'inline-block',
              backgroundColor: settings.backgroundColor || '#7C3AED',
              color: settings.textColor || '#FFFFFF',
              fontSize: settings.fontSize || '16px',
              fontWeight: settings.fontWeight || 'bold',
              padding: '12px 24px',
              borderRadius: settings.borderRadius || '6px',
              textAlign: 'center'
            }}
          >
            {settings.text || 'Click Here'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ButtonSettings;
