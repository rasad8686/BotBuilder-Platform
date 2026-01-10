import React, { useState } from 'react';

const WebhookSettings = ({ config, onUpdate }) => {
  const [testStatus, setTestStatus] = useState(null);

  const handleAddHeader = () => {
    const headers = config?.headers || {};
    const newKey = `header_${Object.keys(headers).length + 1}`;
    onUpdate({ headers: { ...headers, [newKey]: '' } });
  };

  const handleUpdateHeader = (oldKey, newKey, value) => {
    const headers = { ...config?.headers };
    if (oldKey !== newKey) {
      delete headers[oldKey];
    }
    headers[newKey] = value;
    onUpdate({ headers });
  };

  const handleRemoveHeader = (key) => {
    const headers = { ...config?.headers };
    delete headers[key];
    onUpdate({ headers });
  };

  const handleTest = async () => {
    setTestStatus('testing');
    // Simulate test
    setTimeout(() => {
      setTestStatus('success');
      setTimeout(() => setTestStatus(null), 3000);
    }, 1500);
  };

  return (
    <div className="space-y-4">
      {/* URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Webhook URL
        </label>
        <input
          type="url"
          value={config?.url || ''}
          onChange={(e) => onUpdate({ url: e.target.value })}
          placeholder="https://api.example.com/webhook"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Method */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          HTTP Method
        </label>
        <select
          value={config?.method || 'POST'}
          onChange={(e) => onUpdate({ method: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="POST">POST</option>
          <option value="GET">GET</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
        </select>
      </div>

      {/* Headers */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Headers
          </label>
          <button
            onClick={handleAddHeader}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            + Add Header
          </button>
        </div>
        <div className="space-y-2">
          {Object.entries(config?.headers || {}).map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <input
                type="text"
                value={key}
                onChange={(e) => handleUpdateHeader(key, e.target.value, value)}
                placeholder="Header name"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={value}
                onChange={(e) => handleUpdateHeader(key, key, e.target.value)}
                placeholder="Header value"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => handleRemoveHeader(key)}
                className="p-2 text-red-500 hover:bg-red-50 rounded"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          {Object.keys(config?.headers || {}).length === 0 && (
            <p className="text-sm text-gray-500 py-2">No custom headers</p>
          )}
        </div>
      </div>

      {/* Payload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Payload (JSON)
        </label>
        <textarea
          value={config?.payload || '{\n  "contact_email": "{{email}}",\n  "contact_name": "{{first_name}}"\n}'}
          onChange={(e) => onUpdate({ payload: e.target.value })}
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Use {"{{field_name}}"} to include contact data
        </p>
      </div>

      {/* Available Variables */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Available Variables
        </label>
        <div className="flex flex-wrap gap-2">
          {['email', 'first_name', 'last_name', 'phone', 'company', 'tags'].map(variable => (
            <code
              key={variable}
              className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs cursor-pointer hover:bg-gray-200"
              onClick={() => {
                const payload = config?.payload || '';
                onUpdate({ payload: payload + `{{${variable}}}` });
              }}
            >
              {`{{${variable}}}`}
            </code>
          ))}
        </div>
      </div>

      {/* Retry Settings */}
      <div className="pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Retry Settings</h4>

        <label className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={config?.retry_on_failure ?? true}
            onChange={(e) => onUpdate({ retry_on_failure: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600">Retry on failure</span>
        </label>

        {config?.retry_on_failure !== false && (
          <div className="ml-6">
            <label className="block text-sm text-gray-600 mb-1">Max retries</label>
            <select
              value={config?.max_retries || 3}
              onChange={(e) => onUpdate({ max_retries: parseInt(e.target.value) })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>1 retry</option>
              <option value={3}>3 retries</option>
              <option value={5}>5 retries</option>
            </select>
          </div>
        )}
      </div>

      {/* Test Button */}
      <div className="pt-4 border-t border-gray-200">
        <button
          onClick={handleTest}
          disabled={!config?.url || testStatus === 'testing'}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {testStatus === 'testing' ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
              Testing...
            </>
          ) : testStatus === 'success' ? (
            <>
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Test Successful
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Test Webhook
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default WebhookSettings;
