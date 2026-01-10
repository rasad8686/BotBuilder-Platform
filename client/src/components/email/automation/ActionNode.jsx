import React from 'react';

const ActionNode = ({ step, index, isSelected, onSelect, onDelete }) => {
  const getActionInfo = (type, config) => {
    switch (type) {
      case 'send_email':
        return {
          name: 'Send Email',
          subtitle: config?.subject || 'No subject set',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          ),
          color: 'bg-purple-100 text-purple-600'
        };
      case 'add_tag':
        return {
          name: 'Add Tag',
          subtitle: config?.tag || 'No tag selected',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          ),
          color: 'bg-blue-100 text-blue-600'
        };
      case 'remove_tag':
        return {
          name: 'Remove Tag',
          subtitle: config?.tag || 'No tag selected',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          ),
          color: 'bg-red-100 text-red-600'
        };
      case 'add_to_list':
        return {
          name: 'Add to List',
          subtitle: config?.list_name || 'No list selected',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          ),
          color: 'bg-green-100 text-green-600'
        };
      case 'remove_from_list':
        return {
          name: 'Remove from List',
          subtitle: config?.list_name || 'No list selected',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          ),
          color: 'bg-orange-100 text-orange-600'
        };
      case 'notify':
        return {
          name: 'Send Notification',
          subtitle: config?.channel || 'Internal notification',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          ),
          color: 'bg-yellow-100 text-yellow-600'
        };
      case 'webhook':
        return {
          name: 'Call Webhook',
          subtitle: config?.url ? new URL(config.url).hostname : 'No URL set',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          ),
          color: 'bg-indigo-100 text-indigo-600'
        };
      default:
        return {
          name: type,
          subtitle: '',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          ),
          color: 'bg-gray-100 text-gray-600'
        };
    }
  };

  const actionInfo = getActionInfo(step.type, step.config);

  return (
    <div
      onClick={onSelect}
      className={`relative bg-white rounded-lg border-2 p-4 w-64 cursor-pointer transition-all group ${
        isSelected
          ? 'border-blue-500 shadow-lg'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
      }`}
    >
      {/* Step number */}
      <div className="absolute -top-3 -left-3 w-6 h-6 bg-blue-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
        {index + 1}
      </div>

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className={`absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center transition-opacity ${
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Content */}
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${actionInfo.color}`}>
          {actionInfo.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900">{actionInfo.name}</h4>
          <p className="text-sm text-gray-500 truncate">{actionInfo.subtitle}</p>
        </div>
      </div>

      {/* Stats */}
      {step.stats && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs text-gray-500">
          <span>Sent: {step.stats.sent || 0}</span>
          <span>Completed: {step.stats.completed || 0}</span>
        </div>
      )}

      {/* Connection point */}
      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-gray-300 rounded-full border-2 border-white"></div>
    </div>
  );
};

export default ActionNode;
