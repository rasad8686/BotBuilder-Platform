import React, { useState } from 'react';
import Editor from '@monaco-editor/react';

const statusColors = {
  success: 'bg-green-500 text-white',
  redirect: 'bg-blue-500 text-white',
  clientError: 'bg-orange-500 text-white',
  serverError: 'bg-red-500 text-white'
};

function getStatusColor(status) {
  if (status >= 200 && status < 300) return statusColors.success;
  if (status >= 300 && status < 400) return statusColors.redirect;
  if (status >= 400 && status < 500) return statusColors.clientError;
  return statusColors.serverError;
}

function getStatusText(status) {
  const texts = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable'
  };
  return texts[status] || '';
}

export default function ResponseViewer({ response, responseTime, error, history, onHistorySelect }) {
  const [headersExpanded, setHeadersExpanded] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const copyResponse = () => {
    if (response?.body) {
      navigator.clipboard.writeText(
        typeof response.body === 'string' ? response.body : JSON.stringify(response.body, null, 2)
      );
    }
  };

  const formatBody = (body) => {
    if (typeof body === 'string') {
      try {
        return JSON.stringify(JSON.parse(body), null, 2);
      } catch {
        return body;
      }
    }
    return JSON.stringify(body, null, 2);
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 border-l border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Response</h2>
          {response && (
            <button
              onClick={copyResponse}
              className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy Response
            </button>
          )}
        </div>

        {/* Status & Time */}
        {response && (
          <div className="flex items-center gap-3">
            <span className={`px-2 py-1 text-sm font-bold rounded ${getStatusColor(response.status)}`}>
              {response.status} {getStatusText(response.status)}
            </span>
            <span className="text-sm text-gray-400">
              {responseTime}ms
            </span>
          </div>
        )}

        {/* History Dropdown */}
        {history.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setHistoryExpanded(!historyExpanded)}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Request History ({history.length})
              <svg
                className={`w-3 h-3 transition-transform ${historyExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {historyExpanded && (
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                {history.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => onHistorySelect(item)}
                    className="w-full flex items-center gap-2 p-2 text-left rounded bg-gray-800 hover:bg-gray-750 transition-colors"
                  >
                    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${getStatusColor(item.response.status)}`}>
                      {item.response.status}
                    </span>
                    <span className="text-xs text-gray-300 truncate flex-1">
                      {item.endpoint.method} {item.endpoint.path}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {!response && !error ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-lg">No response yet</p>
              <p className="text-sm mt-2">Send a request to see the response</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 p-4">
            <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg">
              <div className="flex items-center gap-2 text-red-400 mb-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-semibold">Error</span>
              </div>
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Response Headers */}
            {response.headers && Object.keys(response.headers).length > 0 && (
              <div className="border-b border-gray-700">
                <button
                  onClick={() => setHeadersExpanded(!headersExpanded)}
                  className="w-full flex items-center justify-between p-3 bg-gray-850 hover:bg-gray-800 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-300">Response Headers</span>
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
                  <div className="p-3 bg-gray-850 max-h-40 overflow-y-auto">
                    <table className="w-full text-sm">
                      <tbody>
                        {Object.entries(response.headers).map(([key, value]) => (
                          <tr key={key} className="border-b border-gray-700 last:border-0">
                            <td className="py-1 pr-3 text-purple-400 font-mono">{key}</td>
                            <td className="py-1 text-gray-300 font-mono break-all">{value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Response Body */}
            <div className="flex-1">
              <Editor
                height="100%"
                defaultLanguage="json"
                value={formatBody(response.body)}
                theme="vs-dark"
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  wordWrap: 'on',
                  folding: true
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
