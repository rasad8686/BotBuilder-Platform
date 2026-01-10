import React from 'react';

const TriggerSettings = ({ config, onUpdate }) => {
  const triggerTypes = [
    { value: 'subscribes', label: 'When someone subscribes' },
    { value: 'tag_added', label: 'When tag is added' },
    { value: 'date_based', label: 'On a specific date' },
    { value: 'custom_event', label: 'On custom event' },
    { value: 'enters_segment', label: 'When entering segment' }
  ];

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Trigger Type
        </label>
        <select
          value={config?.type || 'subscribes'}
          onChange={(e) => onUpdate({ type: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {triggerTypes.map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>

      {config?.type === 'subscribes' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            From List (optional)
          </label>
          <select
            value={config?.list_id || ''}
            onChange={(e) => onUpdate({ list_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All lists</option>
            <option value="newsletter">Newsletter</option>
            <option value="customers">Customers</option>
            <option value="leads">Leads</option>
          </select>
        </div>
      )}

      {config?.type === 'tag_added' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tag Name
          </label>
          <input
            type="text"
            value={config?.tag || ''}
            onChange={(e) => onUpdate({ tag: e.target.value })}
            placeholder="Enter tag name"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}

      {config?.type === 'date_based' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date Field
            </label>
            <select
              value={config?.date_field || 'birthday'}
              onChange={(e) => onUpdate({ date_field: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="birthday">Birthday</option>
              <option value="anniversary">Anniversary</option>
              <option value="signup_date">Signup Date</option>
              <option value="custom">Custom Field</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Days Before/After
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={config?.days_offset || 0}
                onChange={(e) => onUpdate({ days_offset: parseInt(e.target.value) })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <select
                value={config?.offset_type || 'on'}
                onChange={(e) => onUpdate({ offset_type: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="before">days before</option>
                <option value="on">on the day</option>
                <option value="after">days after</option>
              </select>
            </div>
          </div>
        </>
      )}

      {config?.type === 'custom_event' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Event Name
          </label>
          <input
            type="text"
            value={config?.event_name || ''}
            onChange={(e) => onUpdate({ event_name: e.target.value })}
            placeholder="e.g., purchase_completed"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Trigger via API: POST /api/email/events
          </p>
        </div>
      )}

      {config?.type === 'enters_segment' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Segment
          </label>
          <select
            value={config?.segment_id || ''}
            onChange={(e) => onUpdate({ segment_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select a segment</option>
            <option value="active_users">Active Users</option>
            <option value="inactive_30d">Inactive 30 Days</option>
            <option value="high_value">High Value Customers</option>
          </select>
        </div>
      )}

      {/* Common Options */}
      <div className="pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Options</h4>

        <label className="flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            checked={config?.allow_reentry || false}
            onChange={(e) => onUpdate({ allow_reentry: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600">Allow contacts to re-enter</span>
        </label>

        {config?.allow_reentry && (
          <div className="ml-6">
            <label className="block text-sm text-gray-600 mb-1">
              Minimum wait between entries
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={config?.reentry_delay || 7}
                onChange={(e) => onUpdate({ reentry_delay: parseInt(e.target.value) })}
                className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <span className="py-2 text-sm text-gray-600">days</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TriggerSettings;
