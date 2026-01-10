import React from 'react';

const GoalSettings = ({ config, onUpdate }) => {
  const goalTypes = [
    { value: 'tag_added', label: 'Tag is added' },
    { value: 'purchase', label: 'Makes a purchase' },
    { value: 'page_visit', label: 'Visits a page' },
    { value: 'email_reply', label: 'Replies to email' },
    { value: 'form_submit', label: 'Submits a form' },
    { value: 'custom_event', label: 'Custom event' }
  ];

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Goal Name
        </label>
        <input
          type="text"
          value={config?.name || ''}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="e.g., Made First Purchase"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Goal Type
        </label>
        <select
          value={config?.goal_type || 'tag_added'}
          onChange={(e) => onUpdate({ goal_type: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {goalTypes.map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>

      {config?.goal_type === 'tag_added' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tag Name
          </label>
          <input
            type="text"
            value={config?.tag || ''}
            onChange={(e) => onUpdate({ tag: e.target.value })}
            placeholder="e.g., Customer"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}

      {config?.goal_type === 'page_visit' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Page URL Contains
          </label>
          <input
            type="text"
            value={config?.page_url || ''}
            onChange={(e) => onUpdate({ page_url: e.target.value })}
            placeholder="e.g., /thank-you or /purchase-complete"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}

      {config?.goal_type === 'custom_event' && (
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
        </div>
      )}

      {config?.goal_type === 'purchase' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Minimum Purchase Amount (optional)
          </label>
          <div className="flex gap-2">
            <span className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-l-lg">$</span>
            <input
              type="number"
              min="0"
              value={config?.min_amount || ''}
              onChange={(e) => onUpdate({ min_amount: e.target.value })}
              placeholder="0"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      )}

      {/* Goal Behavior */}
      <div className="pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">When Goal is Achieved</h4>

        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="goal_action"
              checked={config?.on_goal === 'continue' || !config?.on_goal}
              onChange={() => onUpdate({ on_goal: 'continue' })}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">Continue to next step</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="goal_action"
              checked={config?.on_goal === 'end'}
              onChange={() => onUpdate({ on_goal: 'end' })}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">End automation (mark as completed)</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="goal_action"
              checked={config?.on_goal === 'jump'}
              onChange={() => onUpdate({ on_goal: 'jump' })}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">Jump to specific step</span>
          </label>
        </div>

        {config?.on_goal === 'jump' && (
          <div className="mt-3 ml-6">
            <select
              value={config?.jump_to_step || ''}
              onChange={(e) => onUpdate({ jump_to_step: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select step...</option>
              <option value="step_1">Step 1: Welcome Email</option>
              <option value="step_2">Step 2: Wait 2 Days</option>
              <option value="step_3">Step 3: Follow-up Email</option>
            </select>
          </div>
        )}
      </div>

      {/* Goal Options */}
      <div className="pt-4 border-t border-gray-200">
        <label className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={config?.can_achieve_anywhere ?? true}
            onChange={(e) => onUpdate({ can_achieve_anywhere: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600">Can be achieved at any step</span>
        </label>
        <p className="ml-6 text-xs text-gray-500">
          If enabled, the goal can be achieved regardless of which step the contact is at
        </p>
      </div>

      {/* Info */}
      <div className="bg-green-50 rounded-lg p-3">
        <div className="flex gap-2">
          <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
          <p className="text-sm text-green-800">
            Goals help you track conversion rates and measure the success of your automation.
          </p>
        </div>
      </div>
    </div>
  );
};

export default GoalSettings;
