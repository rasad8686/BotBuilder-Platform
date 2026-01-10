import React from 'react';

export default function HeadersEditor({ headers, onChange, title = 'Headers' }) {
  const addHeader = () => {
    onChange([...headers, { key: '', value: '', enabled: true }]);
  };

  const updateHeader = (index, field, value) => {
    const updated = headers.map((h, i) =>
      i === index ? { ...h, [field]: value } : h
    );
    onChange(updated);
  };

  const removeHeader = (index) => {
    onChange(headers.filter((_, i) => i !== index));
  };

  const toggleHeader = (index) => {
    updateHeader(index, 'enabled', !headers[index].enabled);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-300">{title}</h4>
        <button
          onClick={addHeader}
          className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
        >
          <span>+</span> Add
        </button>
      </div>

      {headers.length === 0 ? (
        <p className="text-xs text-gray-500 italic">No {title.toLowerCase()} added</p>
      ) : (
        <div className="space-y-2">
          {headers.map((header, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={header.enabled}
                onChange={() => toggleHeader(index)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-500 focus:ring-purple-500"
              />
              <input
                type="text"
                value={header.key}
                onChange={(e) => updateHeader(index, 'key', e.target.value)}
                placeholder="Key"
                className={`
                  flex-1 px-2 py-1.5 text-sm rounded border
                  bg-gray-800 border-gray-600 text-white placeholder-gray-500
                  focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500
                  ${!header.enabled ? 'opacity-50' : ''}
                `}
              />
              <input
                type="text"
                value={header.value}
                onChange={(e) => updateHeader(index, 'value', e.target.value)}
                placeholder="Value"
                className={`
                  flex-1 px-2 py-1.5 text-sm rounded border
                  bg-gray-800 border-gray-600 text-white placeholder-gray-500
                  focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500
                  ${!header.enabled ? 'opacity-50' : ''}
                `}
              />
              <button
                onClick={() => removeHeader(index)}
                className="text-red-400 hover:text-red-300 p-1"
                title="Remove"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
