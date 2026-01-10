import React from 'react';
import ColorPicker from './ColorPicker';

const FooterSettings = ({ block, settings, onSettingsChange }) => {
  return (
    <div className="space-y-4">
      {/* Company Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Company Name
        </label>
        <input
          type="text"
          value={settings.companyName || ''}
          onChange={(e) => onSettingsChange('companyName', e.target.value)}
          placeholder="{{company_name}}"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
          Use {`{{company_name}}`} for dynamic content
        </p>
      </div>

      {/* Address */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Company Address
        </label>
        <textarea
          value={settings.address || ''}
          onChange={(e) => onSettingsChange('address', e.target.value)}
          placeholder="{{company_address}}"
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none"
        />
      </div>

      {/* Show Unsubscribe */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Show Unsubscribe Link
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Required by email regulations
          </p>
        </div>
        <button
          onClick={() => onSettingsChange('showUnsubscribe', !settings.showUnsubscribe)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            settings.showUnsubscribe !== false ? 'bg-purple-600' : 'bg-gray-200 dark:bg-gray-700'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              settings.showUnsubscribe !== false ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Unsubscribe Text */}
      {settings.showUnsubscribe !== false && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Unsubscribe Text
          </label>
          <input
            type="text"
            value={settings.unsubscribeText || ''}
            onChange={(e) => onSettingsChange('unsubscribeText', e.target.value)}
            placeholder="Unsubscribe"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
        </div>
      )}

      {/* Show View in Browser */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Show "View in Browser" Link
        </label>
        <button
          onClick={() => onSettingsChange('showViewInBrowser', !settings.showViewInBrowser)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            settings.showViewInBrowser ? 'bg-purple-600' : 'bg-gray-200 dark:bg-gray-700'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              settings.showViewInBrowser ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Background Color */}
      <ColorPicker
        label="Background Color"
        value={settings.backgroundColor || '#F9FAFB'}
        onChange={(value) => onSettingsChange('backgroundColor', value)}
      />

      {/* Text Color */}
      <ColorPicker
        label="Text Color"
        value={settings.textColor || '#6B7280'}
        onChange={(value) => onSettingsChange('textColor', value)}
      />

      {/* Font Size */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Font Size
        </label>
        <select
          value={settings.fontSize || '12px'}
          onChange={(e) => onSettingsChange('fontSize', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="10px">10px</option>
          <option value="11px">11px</option>
          <option value="12px">12px</option>
          <option value="13px">13px</option>
          <option value="14px">14px</option>
        </select>
      </div>

      {/* Info */}
      <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
        <p className="text-xs text-yellow-700 dark:text-yellow-300">
          Important: Including an unsubscribe link is required by CAN-SPAM, GDPR, and other email regulations.
        </p>
      </div>
    </div>
  );
};

export default FooterSettings;
