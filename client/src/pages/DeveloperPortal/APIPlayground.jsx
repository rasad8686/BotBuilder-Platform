/**
 * API Playground - Interactive API Testing UI
 * Features:
 * - Endpoint selection from OpenAPI spec
 * - Request builder with headers, body, params
 * - Response viewer with syntax highlighting
 * - Code generation (cURL, JavaScript, Python)
 */

import React, { useState, useEffect, useCallback } from 'react';

const styles = {
  container: {
    display: 'flex',
    height: 'calc(100vh - 64px)',
    backgroundColor: '#0f172a',
    color: '#e2e8f0'
  },

  // Left Panel - Endpoint Selection
  leftPanel: {
    width: '280px',
    borderRight: '1px solid #334155',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#1e293b'
  },
  searchBox: {
    padding: '12px',
    borderBottom: '1px solid #334155'
  },
  searchInput: {
    width: '100%',
    padding: '8px 12px',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '6px',
    color: '#e2e8f0',
    fontSize: '14px',
    outline: 'none'
  },
  endpointList: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px'
  },
  tagGroup: {
    marginBottom: '8px'
  },
  tagHeader: {
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  endpointItem: {
    padding: '8px 12px',
    cursor: 'pointer',
    borderRadius: '6px',
    marginBottom: '2px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    transition: 'background-color 0.15s'
  },
  endpointItemHover: {
    backgroundColor: '#334155'
  },
  endpointItemActive: {
    backgroundColor: '#3b82f6',
    color: '#ffffff'
  },
  methodBadge: {
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: '700',
    textTransform: 'uppercase',
    minWidth: '40px',
    textAlign: 'center'
  },
  methodGet: { backgroundColor: '#22c55e', color: '#fff' },
  methodPost: { backgroundColor: '#3b82f6', color: '#fff' },
  methodPut: { backgroundColor: '#f59e0b', color: '#fff' },
  methodDelete: { backgroundColor: '#ef4444', color: '#fff' },
  methodPatch: { backgroundColor: '#8b5cf6', color: '#fff' },

  // Center Panel - Request Builder
  centerPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid #334155'
  },
  requestHeader: {
    padding: '16px',
    borderBottom: '1px solid #334155',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  urlInput: {
    flex: 1,
    padding: '10px 14px',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '6px',
    color: '#e2e8f0',
    fontSize: '14px',
    fontFamily: 'monospace',
    outline: 'none'
  },
  sendButton: {
    padding: '10px 24px',
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.15s'
  },
  sendButtonHover: {
    backgroundColor: '#2563eb'
  },
  sendButtonLoading: {
    backgroundColor: '#64748b',
    cursor: 'not-allowed'
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #334155',
    backgroundColor: '#1e293b'
  },
  tab: {
    padding: '12px 20px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    color: '#94a3b8',
    borderBottom: '2px solid transparent',
    transition: 'all 0.15s'
  },
  tabActive: {
    color: '#3b82f6',
    borderBottomColor: '#3b82f6'
  },
  tabContent: {
    flex: 1,
    padding: '16px',
    overflowY: 'auto'
  },
  textarea: {
    width: '100%',
    minHeight: '200px',
    padding: '12px',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '6px',
    color: '#e2e8f0',
    fontSize: '13px',
    fontFamily: 'monospace',
    resize: 'vertical',
    outline: 'none'
  },
  paramRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '8px',
    alignItems: 'center'
  },
  paramInput: {
    flex: 1,
    padding: '8px 12px',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '6px',
    color: '#e2e8f0',
    fontSize: '13px',
    outline: 'none'
  },
  paramCheckbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer'
  },
  addParamButton: {
    padding: '8px 16px',
    backgroundColor: 'transparent',
    border: '1px dashed #334155',
    borderRadius: '6px',
    color: '#94a3b8',
    fontSize: '13px',
    cursor: 'pointer',
    marginTop: '8px'
  },

  // Right Panel - Response
  rightPanel: {
    width: '45%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#1e293b'
  },
  responseHeader: {
    padding: '16px',
    borderBottom: '1px solid #334155',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  statusBadge: {
    padding: '4px 12px',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: '600'
  },
  statusSuccess: { backgroundColor: '#22c55e20', color: '#22c55e' },
  statusError: { backgroundColor: '#ef444420', color: '#ef4444' },
  statusWarning: { backgroundColor: '#f59e0b20', color: '#f59e0b' },
  responseTime: {
    fontSize: '12px',
    color: '#94a3b8'
  },
  responseBody: {
    flex: 1,
    padding: '16px',
    overflowY: 'auto',
    fontFamily: 'monospace',
    fontSize: '13px',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  },
  codeGenPanel: {
    borderTop: '1px solid #334155',
    padding: '12px 16px'
  },
  codeGenButtons: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px'
  },
  codeGenButton: {
    padding: '6px 12px',
    backgroundColor: '#334155',
    border: 'none',
    borderRadius: '4px',
    color: '#e2e8f0',
    fontSize: '12px',
    cursor: 'pointer'
  },
  codeGenButtonActive: {
    backgroundColor: '#3b82f6'
  },
  codeOutput: {
    backgroundColor: '#0f172a',
    padding: '12px',
    borderRadius: '6px',
    fontFamily: 'monospace',
    fontSize: '12px',
    maxHeight: '150px',
    overflowY: 'auto',
    position: 'relative'
  },
  copyButton: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    padding: '4px 8px',
    backgroundColor: '#334155',
    border: 'none',
    borderRadius: '4px',
    color: '#e2e8f0',
    fontSize: '11px',
    cursor: 'pointer'
  },

  // API Key Selector
  apiKeySelector: {
    padding: '12px 16px',
    borderBottom: '1px solid #334155',
    backgroundColor: '#1e293b'
  },
  select: {
    width: '100%',
    padding: '8px 12px',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '6px',
    color: '#e2e8f0',
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer'
  },
  label: {
    display: 'block',
    fontSize: '12px',
    color: '#94a3b8',
    marginBottom: '6px'
  },

  // Empty states
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#64748b',
    textAlign: 'center',
    padding: '40px'
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px'
  }
};

// Method colors helper
const getMethodStyle = (method) => {
  const m = method.toLowerCase();
  if (m === 'get') return styles.methodGet;
  if (m === 'post') return styles.methodPost;
  if (m === 'put') return styles.methodPut;
  if (m === 'delete') return styles.methodDelete;
  if (m === 'patch') return styles.methodPatch;
  return { backgroundColor: '#64748b', color: '#fff' };
};

// Status color helper
const getStatusStyle = (status) => {
  if (status >= 200 && status < 300) return styles.statusSuccess;
  if (status >= 400 && status < 500) return styles.statusWarning;
  if (status >= 500) return styles.statusError;
  return {};
};

const APIPlayground = () => {
  // State
  const [openApiSpec, setOpenApiSpec] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTags, setExpandedTags] = useState({});
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [activeTab, setActiveTab] = useState('body');
  const [requestUrl, setRequestUrl] = useState('');
  const [requestMethod, setRequestMethod] = useState('GET');
  const [requestBody, setRequestBody] = useState('{\n  \n}');
  const [requestHeaders, setRequestHeaders] = useState([
    { key: 'Content-Type', value: 'application/json', enabled: true },
    { key: 'Authorization', value: '', enabled: true }
  ]);
  const [queryParams, setQueryParams] = useState([]);
  const [response, setResponse] = useState(null);
  const [responseTime, setResponseTime] = useState(null);
  const [loading, setLoading] = useState(false);
  const [codeGenLang, setCodeGenLang] = useState('curl');
  const [apiKeys, setApiKeys] = useState([]);
  const [selectedApiKey, setSelectedApiKey] = useState('');
  const [copied, setCopied] = useState(false);

  // Fetch OpenAPI spec
  useEffect(() => {
    fetch('/api/docs/openapi.json')
      .then(res => res.json())
      .then(spec => {
        setOpenApiSpec(spec);
        // Expand all tags by default
        const tags = {};
        spec.tags?.forEach(t => { tags[t.name] = true; });
        setExpandedTags(tags);
      })
      .catch(err => console.error('Failed to load OpenAPI spec:', err));
  }, []);

  // Fetch API keys
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetch('/api/users/api-keys', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.keys) setApiKeys(data.keys);
        })
        .catch(() => {});
    }
  }, []);

  // Update authorization header when API key changes
  useEffect(() => {
    if (selectedApiKey) {
      setRequestHeaders(prev => prev.map(h =>
        h.key === 'Authorization' ? { ...h, value: `Bearer ${selectedApiKey}` } : h
      ));
    }
  }, [selectedApiKey]);

  // Group endpoints by tag
  const groupedEndpoints = useCallback(() => {
    if (!openApiSpec?.paths) return {};

    const groups = {};
    Object.entries(openApiSpec.paths).forEach(([path, methods]) => {
      Object.entries(methods).forEach(([method, spec]) => {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
          const tag = spec.tags?.[0] || 'Other';
          if (!groups[tag]) groups[tag] = [];

          // Filter by search
          const searchLower = searchQuery.toLowerCase();
          if (searchQuery &&
              !path.toLowerCase().includes(searchLower) &&
              !spec.summary?.toLowerCase().includes(searchLower)) {
            return;
          }

          groups[tag].push({
            path,
            method: method.toUpperCase(),
            summary: spec.summary,
            description: spec.description,
            parameters: spec.parameters,
            requestBody: spec.requestBody,
            responses: spec.responses,
            security: spec.security
          });
        }
      });
    });

    return groups;
  }, [openApiSpec, searchQuery]);

  // Handle endpoint selection
  const handleSelectEndpoint = (endpoint) => {
    setSelectedEndpoint(endpoint);
    setRequestMethod(endpoint.method);
    setRequestUrl(`/api${endpoint.path}`);
    setResponse(null);
    setResponseTime(null);

    // Extract query params
    const qParams = endpoint.parameters?.filter(p => p.in === 'query') || [];

    setQueryParams(qParams.map(p => ({
      key: p.name,
      value: p.schema?.default || '',
      enabled: !p.schema?.default,
      required: p.required
    })));

    // Set example body if POST/PUT
    if (endpoint.requestBody?.content?.['application/json']?.schema) {
      const schema = endpoint.requestBody.content['application/json'].schema;
      const example = generateExampleFromSchema(schema);
      setRequestBody(JSON.stringify(example, null, 2));
    } else {
      setRequestBody('{\n  \n}');
    }
  };

  // Generate example from schema
  const generateExampleFromSchema = (schema) => {
    if (!schema) return {};
    const obj = {};
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([key, prop]) => {
        if (prop.example !== undefined) {
          obj[key] = prop.example;
        } else if (prop.type === 'string') {
          obj[key] = prop.format === 'email' ? 'user@example.com' : '';
        } else if (prop.type === 'integer' || prop.type === 'number') {
          obj[key] = prop.minimum || 0;
        } else if (prop.type === 'boolean') {
          obj[key] = prop.default || false;
        } else if (prop.type === 'array') {
          obj[key] = [];
        } else if (prop.type === 'object') {
          obj[key] = {};
        }
      });
    }
    return obj;
  };

  // Build final URL with query params
  const buildUrl = () => {
    let url = requestUrl;
    const enabledParams = queryParams.filter(p => p.enabled && p.value);
    if (enabledParams.length > 0) {
      const queryString = enabledParams.map(p =>
        `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`
      ).join('&');
      url += `?${queryString}`;
    }
    return url;
  };

  // Send request
  const sendRequest = async () => {
    setLoading(true);
    const startTime = Date.now();

    try {
      const headers = {};
      requestHeaders.filter(h => h.enabled && h.key).forEach(h => {
        headers[h.key] = h.value;
      });

      const options = {
        method: requestMethod,
        headers
      };

      if (['POST', 'PUT', 'PATCH'].includes(requestMethod) && requestBody.trim()) {
        options.body = requestBody;
      }

      const res = await fetch(buildUrl(), options);
      const endTime = Date.now();
      setResponseTime(endTime - startTime);

      const contentType = res.headers.get('content-type');
      let data;
      if (contentType?.includes('application/json')) {
        data = await res.json();
      } else {
        data = await res.text();
      }

      setResponse({
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        body: data
      });
    } catch (error) {
      setResponse({
        status: 0,
        statusText: 'Network Error',
        body: { error: error.message }
      });
      setResponseTime(Date.now() - startTime);
    }

    setLoading(false);
  };

  // Generate code
  const generateCode = () => {
    const url = buildUrl();
    const headers = requestHeaders.filter(h => h.enabled && h.key);
    const hasBody = ['POST', 'PUT', 'PATCH'].includes(requestMethod) && requestBody.trim();

    if (codeGenLang === 'curl') {
      let cmd = `curl -X ${requestMethod} "${window.location.origin}${url}"`;
      headers.forEach(h => {
        cmd += ` \\\n  -H "${h.key}: ${h.value}"`;
      });
      if (hasBody) {
        cmd += ` \\\n  -d '${requestBody.replace(/\n/g, '')}'`;
      }
      return cmd;
    }

    if (codeGenLang === 'javascript') {
      let code = `const response = await fetch("${url}", {\n`;
      code += `  method: "${requestMethod}",\n`;
      code += `  headers: {\n`;
      headers.forEach((h, i) => {
        code += `    "${h.key}": "${h.value}"${i < headers.length - 1 ? ',' : ''}\n`;
      });
      code += `  }`;
      if (hasBody) {
        code += `,\n  body: JSON.stringify(${requestBody})`;
      }
      code += `\n});\n\nconst data = await response.json();`;
      return code;
    }

    if (codeGenLang === 'python') {
      let code = `import requests\n\n`;
      code += `response = requests.${requestMethod.toLowerCase()}(\n`;
      code += `    "${window.location.origin}${url}",\n`;
      code += `    headers={\n`;
      headers.forEach((h, i) => {
        code += `        "${h.key}": "${h.value}"${i < headers.length - 1 ? ',' : ''}\n`;
      });
      code += `    }`;
      if (hasBody) {
        code += `,\n    json=${requestBody}`;
      }
      code += `\n)\n\ndata = response.json()`;
      return code;
    }

    return '';
  };

  // Copy to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Add param row
  const addHeader = () => {
    setRequestHeaders([...requestHeaders, { key: '', value: '', enabled: true }]);
  };

  const addQueryParam = () => {
    setQueryParams([...queryParams, { key: '', value: '', enabled: true }]);
  };

  const updateHeader = (index, field, value) => {
    const newHeaders = [...requestHeaders];
    newHeaders[index][field] = value;
    setRequestHeaders(newHeaders);
  };

  const updateQueryParam = (index, field, value) => {
    const newParams = [...queryParams];
    newParams[index][field] = value;
    setQueryParams(newParams);
  };

  const removeHeader = (index) => {
    setRequestHeaders(requestHeaders.filter((_, i) => i !== index));
  };

  const removeQueryParam = (index) => {
    setQueryParams(queryParams.filter((_, i) => i !== index));
  };

  const groups = groupedEndpoints();

  return (
    <div style={styles.container}>
      {/* Left Panel - Endpoint Selection */}
      <div style={styles.leftPanel}>
        <div style={styles.apiKeySelector}>
          <label style={styles.label}>API Key</label>
          <select
            style={styles.select}
            value={selectedApiKey}
            onChange={(e) => setSelectedApiKey(e.target.value)}
          >
            <option value="">Use JWT Token</option>
            {apiKeys.map((key, i) => (
              <option key={i} value={key.key}>{key.name}</option>
            ))}
          </select>
        </div>

        <div style={styles.searchBox}>
          <input
            type="text"
            placeholder="Search endpoints..."
            style={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={styles.endpointList}>
          {Object.entries(groups).map(([tag, endpoints]) => (
            <div key={tag} style={styles.tagGroup}>
              <div
                style={styles.tagHeader}
                onClick={() => setExpandedTags(prev => ({ ...prev, [tag]: !prev[tag] }))}
              >
                <span>{tag}</span>
                <span>{expandedTags[tag] ? '-' : '+'}</span>
              </div>

              {expandedTags[tag] && endpoints.map((ep, i) => (
                <div
                  key={`${ep.path}-${ep.method}-${i}`}
                  style={{
                    ...styles.endpointItem,
                    ...(selectedEndpoint?.path === ep.path && selectedEndpoint?.method === ep.method
                      ? styles.endpointItemActive
                      : {})
                  }}
                  onClick={() => handleSelectEndpoint(ep)}
                >
                  <span style={{ ...styles.methodBadge, ...getMethodStyle(ep.method) }}>
                    {ep.method}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ep.path}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Center Panel - Request Builder */}
      <div style={styles.centerPanel}>
        <div style={styles.requestHeader}>
          <span style={{ ...styles.methodBadge, ...getMethodStyle(requestMethod), fontSize: '12px' }}>
            {requestMethod}
          </span>
          <input
            type="text"
            style={styles.urlInput}
            value={requestUrl}
            onChange={(e) => setRequestUrl(e.target.value)}
            placeholder="/api/endpoint"
          />
          <button
            style={{
              ...styles.sendButton,
              ...(loading ? styles.sendButtonLoading : {})
            }}
            onClick={sendRequest}
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </div>

        <div style={styles.tabs}>
          {['body', 'headers', 'params'].map(tab => (
            <div
              key={tab}
              style={{
                ...styles.tab,
                ...(activeTab === tab ? styles.tabActive : {})
              }}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'params' && queryParams.length > 0 && ` (${queryParams.length})`}
            </div>
          ))}
        </div>

        <div style={styles.tabContent}>
          {activeTab === 'body' && (
            <textarea
              style={styles.textarea}
              value={requestBody}
              onChange={(e) => setRequestBody(e.target.value)}
              placeholder="Request body (JSON)"
            />
          )}

          {activeTab === 'headers' && (
            <div>
              {requestHeaders.map((header, i) => (
                <div key={i} style={styles.paramRow}>
                  <input
                    type="checkbox"
                    style={styles.paramCheckbox}
                    checked={header.enabled}
                    onChange={(e) => updateHeader(i, 'enabled', e.target.checked)}
                  />
                  <input
                    type="text"
                    style={styles.paramInput}
                    value={header.key}
                    onChange={(e) => updateHeader(i, 'key', e.target.value)}
                    placeholder="Header name"
                  />
                  <input
                    type="text"
                    style={{ ...styles.paramInput, flex: 2 }}
                    value={header.value}
                    onChange={(e) => updateHeader(i, 'value', e.target.value)}
                    placeholder="Value"
                  />
                  <button
                    style={{ ...styles.codeGenButton, backgroundColor: '#ef4444' }}
                    onClick={() => removeHeader(i)}
                  >
                    X
                  </button>
                </div>
              ))}
              <button style={styles.addParamButton} onClick={addHeader}>
                + Add Header
              </button>
            </div>
          )}

          {activeTab === 'params' && (
            <div>
              {queryParams.map((param, i) => (
                <div key={i} style={styles.paramRow}>
                  <input
                    type="checkbox"
                    style={styles.paramCheckbox}
                    checked={param.enabled}
                    onChange={(e) => updateQueryParam(i, 'enabled', e.target.checked)}
                  />
                  <input
                    type="text"
                    style={styles.paramInput}
                    value={param.key}
                    onChange={(e) => updateQueryParam(i, 'key', e.target.value)}
                    placeholder="Param name"
                  />
                  <input
                    type="text"
                    style={{ ...styles.paramInput, flex: 2 }}
                    value={param.value}
                    onChange={(e) => updateQueryParam(i, 'value', e.target.value)}
                    placeholder="Value"
                  />
                  <button
                    style={{ ...styles.codeGenButton, backgroundColor: '#ef4444' }}
                    onClick={() => removeQueryParam(i)}
                  >
                    X
                  </button>
                </div>
              ))}
              <button style={styles.addParamButton} onClick={addQueryParam}>
                + Add Parameter
              </button>
            </div>
          )}

          {selectedEndpoint && (
            <div style={{ marginTop: '20px', padding: '12px', backgroundColor: '#0f172a', borderRadius: '6px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
                {selectedEndpoint.summary}
              </div>
              {selectedEndpoint.description && (
                <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                  {selectedEndpoint.description}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Response */}
      <div style={styles.rightPanel}>
        <div style={styles.responseHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontWeight: '600' }}>Response</span>
            {response && (
              <span style={{ ...styles.statusBadge, ...getStatusStyle(response.status) }}>
                {response.status} {response.statusText}
              </span>
            )}
          </div>
          {responseTime !== null && (
            <span style={styles.responseTime}>{responseTime}ms</span>
          )}
        </div>

        <div style={styles.responseBody}>
          {!response ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>&#128640;</div>
              <div>Send a request to see the response</div>
            </div>
          ) : (
            <pre style={{ margin: 0 }}>
              {typeof response.body === 'object'
                ? JSON.stringify(response.body, null, 2)
                : response.body
              }
            </pre>
          )}
        </div>

        {/* Code Generation */}
        <div style={styles.codeGenPanel}>
          <div style={styles.codeGenButtons}>
            {['curl', 'javascript', 'python'].map(lang => (
              <button
                key={lang}
                style={{
                  ...styles.codeGenButton,
                  ...(codeGenLang === lang ? styles.codeGenButtonActive : {})
                }}
                onClick={() => setCodeGenLang(lang)}
              >
                {lang === 'curl' ? 'cURL' : lang.charAt(0).toUpperCase() + lang.slice(1)}
              </button>
            ))}
          </div>
          <div style={{ ...styles.codeOutput, position: 'relative' }}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{generateCode()}</pre>
            <button
              style={styles.copyButton}
              onClick={() => copyToClipboard(generateCode())}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default APIPlayground;
