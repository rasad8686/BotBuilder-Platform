import React from 'react';

const WaitSettings = ({ config, onUpdate }) => {
  const presetOptions = [
    { value: 1, unit: 'hours', label: '1 hour' },
    { value: 4, unit: 'hours', label: '4 hours' },
    { value: 1, unit: 'days', label: '1 day' },
    { value: 2, unit: 'days', label: '2 days' },
    { value: 3, unit: 'days', label: '3 days' },
    { value: 7, unit: 'days', label: '1 week' },
    { value: 14, unit: 'days', label: '2 weeks' },
    { value: 30, unit: 'days', label: '1 month' }
  ];

  const isPresetSelected = (preset) => {
    return config?.value === preset.value && config?.unit === preset.unit;
  };

  const handlePresetSelect = (preset) => {
    onUpdate({ value: preset.value, unit: preset.unit });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Wait Duration
        </label>

        {/* Preset Options */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {presetOptions.map((preset, index) => (
            <button
              key={index}
              onClick={() => handlePresetSelect(preset)}
              className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                isPresetSelected(preset)
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Custom Duration */}
        <div className="pt-4 border-t border-gray-200">
          <label className="block text-sm text-gray-600 mb-2">
            Or set custom duration:
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              value={config?.value || 1}
              onChange={(e) => onUpdate({ value: parseInt(e.target.value) || 1 })}
              className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <select
              value={config?.unit || 'days'}
              onChange={(e) => onUpdate({ unit: e.target.value })}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
              <option value="weeks">Weeks</option>
            </select>
          </div>
        </div>
      </div>

      {/* Wait Until Specific Time */}
      <div className="pt-4 border-t border-gray-200">
        <label className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={config?.wait_until_time || false}
            onChange={(e) => onUpdate({ wait_until_time: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Wait until specific time of day</span>
        </label>

        {config?.wait_until_time && (
          <div className="ml-6 space-y-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Time</label>
              <input
                type="time"
                value={config?.target_time || '09:00'}
                onChange={(e) => onUpdate({ target_time: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Timezone</label>
              <select
                value={config?.timezone || 'contact'}
                onChange={(e) => onUpdate({ timezone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="contact">Contact's timezone</option>
                <option value="account">Account timezone (UTC+4)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Weekday Only Option */}
      <div className="pt-4 border-t border-gray-200">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config?.weekdays_only || false}
            onChange={(e) => onUpdate({ weekdays_only: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Only proceed on weekdays</span>
        </label>
        <p className="ml-6 text-xs text-gray-500 mt-1">
          If wait ends on weekend, proceed on Monday
        </p>
      </div>

      {/* Info */}
      <div className="bg-blue-50 rounded-lg p-3">
        <div className="flex gap-2">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-blue-800">
            Contacts will pause at this step for the specified duration before continuing to the next step.
          </p>
        </div>
      </div>
    </div>
  );
};

export default WaitSettings;
