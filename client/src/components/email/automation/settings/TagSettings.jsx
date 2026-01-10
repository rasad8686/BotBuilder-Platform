import React, { useState } from 'react';

const TagSettings = ({ config, onUpdate, action = 'add_tag' }) => {
  const [newTag, setNewTag] = useState('');
  const isAdding = action === 'add_tag';

  // Mock existing tags - in real app, fetch from API
  const existingTags = [
    'VIP',
    'Customer',
    'Lead',
    'Newsletter',
    'Engaged',
    'Inactive',
    'Trial',
    'Premium'
  ];

  const handleAddNewTag = () => {
    if (newTag.trim()) {
      onUpdate({ tag: newTag.trim() });
      setNewTag('');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {isAdding ? 'Tag to Add' : 'Tag to Remove'}
        </label>
        <p className="text-xs text-gray-500 mb-3">
          {isAdding
            ? 'This tag will be added to the contact when they reach this step'
            : 'This tag will be removed from the contact when they reach this step'}
        </p>
      </div>

      {/* Current Selection */}
      {config?.tag && (
        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
          <span className={`px-2 py-1 rounded text-sm ${
            isAdding ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
          }`}>
            {config.tag}
          </span>
          <button
            onClick={() => onUpdate({ tag: '' })}
            className="ml-auto text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Existing Tags */}
      <div>
        <label className="block text-sm text-gray-600 mb-2">
          Select from existing tags:
        </label>
        <div className="flex flex-wrap gap-2">
          {existingTags.map(tag => (
            <button
              key={tag}
              onClick={() => onUpdate({ tag })}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                config?.tag === tag
                  ? isAdding
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-red-500 bg-red-50 text-red-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Create New Tag */}
      <div className="pt-4 border-t border-gray-200">
        <label className="block text-sm text-gray-600 mb-2">
          Or create a new tag:
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Enter new tag name"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            onKeyPress={(e) => e.key === 'Enter' && handleAddNewTag()}
          />
          <button
            onClick={handleAddNewTag}
            disabled={!newTag.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Use
          </button>
        </div>
      </div>

      {/* Info */}
      <div className={`rounded-lg p-3 ${isAdding ? 'bg-blue-50' : 'bg-orange-50'}`}>
        <div className="flex gap-2">
          <svg className={`w-5 h-5 flex-shrink-0 ${isAdding ? 'text-blue-600' : 'text-orange-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className={`text-sm ${isAdding ? 'text-blue-800' : 'text-orange-800'}`}>
            {isAdding
              ? 'Tags help you segment and organize your contacts. You can use tags to trigger other automations or filter campaigns.'
              : 'Removing a tag can affect other automations that depend on this tag. Make sure this is intentional.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TagSettings;
