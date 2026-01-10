import React from 'react';

const TriggerNode = ({ config, isSelected, onSelect }) => {
  const getTriggerInfo = (type) => {
    switch (type) {
      case 'subscribes':
        return {
          name: 'When someone subscribes',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          ),
          color: 'bg-green-100 text-green-600'
        };
      case 'tag_added':
        return {
          name: 'When tag is added',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          ),
          color: 'bg-blue-100 text-blue-600'
        };
      case 'date_based':
        return {
          name: 'On a specific date',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ),
          color: 'bg-purple-100 text-purple-600'
        };
      case 'custom_event':
        return {
          name: 'On custom event',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          ),
          color: 'bg-yellow-100 text-yellow-600'
        };
      case 'enters_segment':
        return {
          name: 'When entering segment',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ),
          color: 'bg-indigo-100 text-indigo-600'
        };
      default:
        return {
          name: 'Trigger',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ),
          color: 'bg-gray-100 text-gray-600'
        };
    }
  };

  const triggerInfo = getTriggerInfo(config?.type);

  return (
    <div
      onClick={onSelect}
      className={`relative bg-white rounded-lg border-2 p-4 w-64 cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-500 shadow-lg'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
      }`}
    >
      {/* Trigger Badge */}
      <div className="absolute -top-3 left-4 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded">
        TRIGGER
      </div>

      {/* Content */}
      <div className="flex items-center gap-3 mt-2">
        <div className={`p-2 rounded-lg ${triggerInfo.color}`}>
          {triggerInfo.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900">{triggerInfo.name}</h4>
          {config?.list_name && (
            <p className="text-sm text-gray-500 truncate">List: {config.list_name}</p>
          )}
          {config?.tag && (
            <p className="text-sm text-gray-500 truncate">Tag: {config.tag}</p>
          )}
        </div>
      </div>

      {/* Entry count */}
      {config?.entry_count > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
          {config.entry_count.toLocaleString()} contacts entered
        </div>
      )}

      {/* Connection point */}
      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-gray-300 rounded-full border-2 border-white"></div>
    </div>
  );
};

export default TriggerNode;
