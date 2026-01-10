import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import MethodBadge from './MethodBadge';
import HeadersEditor from './HeadersEditor';

export default function RequestBuilder({
  endpoint,
  apiKey,
  onApiKeyChange,
  useTestKey,
  onUseTestKeyChange,
  headers,
  onHeadersChange,
  queryParams,
  onQueryParamsChange,
  body,
  onBodyChange,
  onSend,
  isLoading,
  baseUrl
}) {
  const [headersExpanded, setHeadersExpanded] = useState(true);
  const [paramsExpanded, setParamsExpanded] = useState(true);
  const [bodyExpanded, setBodyExpanded] = useState(true);

  const fullUrl = endpoint
    ? `${baseUrl}${endpoint.path}${queryParams.filter(p => p.enabled && p.key).length > 0
        ? '?' + queryParams
            .filter(p => p.enabled && p.key)
            .map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
            .join('&')
        : ''}`
    : '';

  const generateCurl = () => {
    if (!endpoint) return '';

    let curl = `curl -X ${endpoint.method} "${fullUrl}"`;

    // Add headers
    const allHeaders = [
      { key: 'Content-Type', value: 'application/json' },
      ...(apiKey ? [{ key: 'Authorization', value: `Bearer ${apiKey}` }] : []),
      ...headers.filter(h => h.enabled && h.key)
    ];

    allHeaders.forEach(h => {
      curl += ` \\\n  -H "${h.key}: ${h.value}"`;
    });

    // Add body for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(endpoint.method) && body) {
      curl += ` \\\n  -d '${body}'`;
    }

    return curl;
  };

  const copyCurl = () => {
    navigator.clipboard.writeText(generateCurl());
  };

  return (
    <div className="h-full flex flex-col bg-gray-850">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-3">Request Builder</h2>

        {/* API Key Input */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder="Enter your API key..."
              disabled={useTestKey}
              className={`
                w-full px-3 py-2 text-sm rounded-lg border
                bg-gray-800 border-gray-600 text-white placeholder-gray-500
                focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
                ${useTestKey ? 'opacity-50' : ''}
              `}
            />
          </div>
          <div className="flex items-center gap-2 mt-5">
            <input
              type="checkbox"
              id="useTestKey"
              checked={useTestKey}
              onChange={(e) => onUseTestKeyChange(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-500 focus:ring-purple-500"
            />
            <label htmlFor="useTestKey" className="text-sm text-gray-300">Use Test Key</label>
          </div>
        </div>

        {/* URL Display */}
        {endpoint && (
          <div className="flex items-center gap-2 p-3 bg-gray-800 rounded-lg">
            <MethodBadge method={endpoint.method} />
            <code className="text-sm text-gray-300 flex-1 truncate font-mono">
              {fullUrl}
            </code>
            <button
              onClick={copyCurl}
              className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
              title="Export as cURL"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              cURL
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!endpoint ? (
          <div className="text-center text-gray-500 py-12">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
            <p className="text-lg">Select an endpoint to get started</p>
            <p className="text-sm mt-2">Choose from the list on the left</p>
          </div>
        ) : (
          <>
            {/* Headers Section */}
            <div className="border border-gray-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setHeadersExpanded(!headersExpanded)}
                className="w-full flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-750 transition-colors"
              >
                <span className="text-sm font-medium text-gray-200">Headers</span>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${headersExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {headersExpanded && (
                <div className="p-3 bg-gray-850">
                  <HeadersEditor
                    headers={headers}
                    onChange={onHeadersChange}
                    title="Custom Headers"
                  />
                </div>
              )}
            </div>

            {/* Query Params Section */}
            <div className="border border-gray-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setParamsExpanded(!paramsExpanded)}
                className="w-full flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-750 transition-colors"
              >
                <span className="text-sm font-medium text-gray-200">Query Parameters</span>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${paramsExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {paramsExpanded && (
                <div className="p-3 bg-gray-850">
                  <HeadersEditor
                    headers={queryParams}
                    onChange={onQueryParamsChange}
                    title="Parameters"
                  />
                </div>
              )}
            </div>

            {/* Body Section (for POST/PUT/PATCH) */}
            {['POST', 'PUT', 'PATCH'].includes(endpoint.method) && (
              <div className="border border-gray-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => setBodyExpanded(!bodyExpanded)}
                  className="w-full flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-750 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-200">Request Body (JSON)</span>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${bodyExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {bodyExpanded && (
                  <div className="h-64">
                    <Editor
                      height="100%"
                      defaultLanguage="json"
                      value={body}
                      onChange={onBodyChange}
                      theme="vs-dark"
                      options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 2,
                        wordWrap: 'on',
                        formatOnPaste: true,
                        formatOnType: true
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Send Button */}
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={onSend}
          disabled={!endpoint || isLoading}
          className={`
            w-full py-3 rounded-lg font-semibold text-white
            transition-all duration-200 flex items-center justify-center gap-2
            ${!endpoint || isLoading
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700 shadow-lg hover:shadow-purple-500/25'
            }
          `}
        >
          {isLoading ? (
            <>
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Sending...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Send Request
            </>
          )}
        </button>
      </div>
    </div>
  );
}
