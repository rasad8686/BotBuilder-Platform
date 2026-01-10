import React from 'react';

const ConditionSettings = ({ config, onUpdate }) => {
  const conditionTypes = [
    { value: 'opened_email', label: 'Opened email' },
    { value: 'clicked_link', label: 'Clicked any link' },
    { value: 'clicked_specific_link', label: 'Clicked specific link' },
    { value: 'has_tag', label: 'Has tag' },
    { value: 'in_segment', label: 'Is in segment' },
    { value: 'field_value', label: 'Contact field value' }
  ];

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Condition Type
        </label>
        <select
          value={config?.type || 'opened_email'}
          onChange={(e) => onUpdate({ type: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {conditionTypes.map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>

      {/* Email-based conditions */}
      {(config?.type === 'opened_email' || config?.type === 'clicked_link' || config?.type === 'clicked_specific_link') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Which email?
          </label>
          <select
            value={config?.email_reference || 'previous'}
            onChange={(e) => onUpdate({ email_reference: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="previous">Previous email in workflow</option>
            <option value="any">Any email in workflow</option>
            <option value="specific">Specific email step</option>
          </select>
        </div>
      )}

      {config?.type === 'clicked_specific_link' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Link URL contains
          </label>
          <input
            type="text"
            value={config?.link_url || ''}
            onChange={(e) => onUpdate({ link_url: e.target.value })}
            placeholder="e.g., /pricing or product-name"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}

      {config?.type === 'has_tag' && (
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

      {config?.type === 'in_segment' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Segment
          </label>
          <select
            value={config?.segment_id || ''}
            onChange={(e) => onUpdate({ segment_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select segment</option>
            <option value="active_users">Active Users</option>
            <option value="inactive_30d">Inactive 30 Days</option>
            <option value="high_value">High Value Customers</option>
            <option value="new_subscribers">New Subscribers</option>
          </select>
        </div>
      )}

      {config?.type === 'field_value' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contact Field
            </label>
            <select
              value={config?.field || ''}
              onChange={(e) => onUpdate({ field: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select field</option>
              <option value="first_name">First Name</option>
              <option value="last_name">Last Name</option>
              <option value="company">Company</option>
              <option value="country">Country</option>
              <option value="custom_field_1">Custom Field 1</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Operator
            </label>
            <select
              value={config?.operator || 'equals'}
              onChange={(e) => onUpdate({ operator: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="equals">Equals</option>
              <option value="not_equals">Does not equal</option>
              <option value="contains">Contains</option>
              <option value="not_contains">Does not contain</option>
              <option value="is_set">Is set</option>
              <option value="is_not_set">Is not set</option>
            </select>
          </div>
          {config?.operator !== 'is_set' && config?.operator !== 'is_not_set' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Value
              </label>
              <input
                type="text"
                value={config?.field_value || ''}
                onChange={(e) => onUpdate({ field_value: e.target.value })}
                placeholder="Enter value"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}
        </>
      )}

      {/* Wait for condition */}
      <div className="pt-4 border-t border-gray-200">
        <label className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={config?.wait_for_condition || false}
            onChange={(e) => onUpdate({ wait_for_condition: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Wait for condition before checking</span>
        </label>

        {config?.wait_for_condition && (
          <div className="ml-6 space-y-3">
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                value={config?.wait_value || 24}
                onChange={(e) => onUpdate({ wait_value: parseInt(e.target.value) })}
                className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={config?.wait_unit || 'hours'}
                onChange={(e) => onUpdate({ wait_unit: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
            <p className="text-xs text-gray-500">
              Wait this long before evaluating the condition
            </p>
          </div>
        )}
      </div>

      {/* Branch Preview */}
      <div className="bg-gray-50 rounded-lg p-3">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Branches</h4>
        <div className="flex gap-4">
          <div className="flex-1 p-2 bg-green-50 rounded border border-green-200">
            <span className="text-xs font-medium text-green-700">YES branch</span>
            <p className="text-xs text-green-600">Condition is true</p>
          </div>
          <div className="flex-1 p-2 bg-red-50 rounded border border-red-200">
            <span className="text-xs font-medium text-red-700">NO branch</span>
            <p className="text-xs text-red-600">Condition is false</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConditionSettings;
