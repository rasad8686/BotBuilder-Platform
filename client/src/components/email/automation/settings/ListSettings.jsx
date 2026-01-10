import React from 'react';

const ListSettings = ({ config, onUpdate, action = 'add_to_list' }) => {
  const isAdding = action === 'add_to_list';

  // Mock lists - in real app, fetch from API
  const lists = [
    { id: 'newsletter', name: 'Newsletter Subscribers', count: 5420 },
    { id: 'customers', name: 'Customers', count: 1230 },
    { id: 'leads', name: 'Leads', count: 890 },
    { id: 'vip', name: 'VIP Members', count: 156 },
    { id: 'product_updates', name: 'Product Updates', count: 3210 },
    { id: 'beta_testers', name: 'Beta Testers', count: 245 }
  ];

  const selectedList = lists.find(l => l.id === config?.list_id);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {isAdding ? 'Add to List' : 'Remove from List'}
        </label>
        <p className="text-xs text-gray-500 mb-3">
          {isAdding
            ? 'Contact will be added to this list when they reach this step'
            : 'Contact will be removed from this list when they reach this step'}
        </p>
      </div>

      {/* List Selection */}
      <div className="space-y-2">
        {lists.map(list => (
          <button
            key={list.id}
            onClick={() => onUpdate({ list_id: list.id, list_name: list.name })}
            className={`w-full p-3 text-left rounded-lg border transition-colors ${
              config?.list_id === list.id
                ? isAdding
                  ? 'border-green-500 bg-green-50'
                  : 'border-red-500 bg-red-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{list.name}</p>
                <p className="text-sm text-gray-500">{list.count.toLocaleString()} contacts</p>
              </div>
              {config?.list_id === list.id && (
                <svg className={`w-5 h-5 ${isAdding ? 'text-green-600' : 'text-red-600'}`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Options */}
      {isAdding && (
        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Options</h4>

          <label className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              checked={config?.update_status ?? true}
              onChange={(e) => onUpdate({ update_status: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">Update subscription status to active</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config?.skip_if_member || false}
              onChange={(e) => onUpdate({ skip_if_member: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">Skip if already a member</span>
          </label>
        </div>
      )}

      {!isAdding && (
        <div className="pt-4 border-t border-gray-200">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config?.unsubscribe || false}
              onChange={(e) => onUpdate({ unsubscribe: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">Also unsubscribe from list</span>
          </label>
          <p className="ml-6 text-xs text-gray-500 mt-1">
            Contact will be marked as unsubscribed, not just removed
          </p>
        </div>
      )}

      {/* Selected Summary */}
      {selectedList && (
        <div className={`rounded-lg p-3 ${isAdding ? 'bg-green-50' : 'bg-orange-50'}`}>
          <div className="flex gap-2">
            <svg className={`w-5 h-5 flex-shrink-0 ${isAdding ? 'text-green-600' : 'text-orange-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isAdding ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              )}
            </svg>
            <p className={`text-sm ${isAdding ? 'text-green-800' : 'text-orange-800'}`}>
              {isAdding
                ? `Contacts will be added to "${selectedList.name}"`
                : `Contacts will be removed from "${selectedList.name}"`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListSettings;
