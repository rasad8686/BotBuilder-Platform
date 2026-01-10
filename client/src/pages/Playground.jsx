import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Gamepad2 } from 'lucide-react';
import EndpointSelector from '../components/playground/EndpointSelector';
import RequestBuilder from '../components/playground/RequestBuilder';
import ResponseViewer from '../components/playground/ResponseViewer';

const TEST_API_KEY = 'test_sk_demo_1234567890abcdef';
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const HISTORY_KEY = 'playground_history';
const MAX_HISTORY = 10;

export default function Playground() {
  const { t } = useTranslation();

  // State
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [useTestKey, setUseTestKey] = useState(false);
  const [headers, setHeaders] = useState([]);
  const [queryParams, setQueryParams] = useState([]);
  const [body, setBody] = useState('{\n  \n}');
  const [response, setResponse] = useState(null);
  const [responseTime, setResponseTime] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 1024);

  // Load history from localStorage
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(HISTORY_KEY);
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  }, []);

  // Handle resize for responsive layout
  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Save history to localStorage
  const saveToHistory = useCallback((endpoint, response, responseTime) => {
    const newEntry = {
      endpoint,
      response,
      responseTime,
      timestamp: new Date().toISOString()
    };

    setHistory(prev => {
      const updated = [newEntry, ...prev].slice(0, MAX_HISTORY);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Handle endpoint selection
  const handleEndpointSelect = (endpoint) => {
    setSelectedEndpoint(endpoint);
    setResponse(null);
    setError(null);

    // Set default body based on endpoint
    if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
      setBody(getDefaultBody(endpoint));
    }
  };

  // Get default body for endpoint
  const getDefaultBody = (endpoint) => {
    const defaults = {
      'POST /api/bots': JSON.stringify({
        name: 'My Bot',
        description: 'A helpful chatbot',
        model: 'gpt-4'
      }, null, 2),
      'POST /api/messages': JSON.stringify({
        botId: 1,
        message: 'Hello, how can I help you?',
        sessionId: 'session_123'
      }, null, 2),
      'POST /api/agents': JSON.stringify({
        name: 'Research Agent',
        type: 'research',
        instructions: 'You are a helpful research assistant.'
      }, null, 2),
      'POST /api/knowledge': JSON.stringify({
        name: 'Document Name',
        content: 'Document content goes here...',
        type: 'text'
      }, null, 2),
      'POST /api/workflows': JSON.stringify({
        name: 'My Workflow',
        steps: []
      }, null, 2),
      'POST /api/webhooks': JSON.stringify({
        url: 'https://example.com/webhook',
        events: ['message.received', 'bot.response']
      }, null, 2)
    };

    return defaults[`${endpoint.method} ${endpoint.path}`] || '{\n  \n}';
  };

  // Replace path parameters
  const buildUrl = (path) => {
    // Replace :id, :botId etc with placeholder values
    return path
      .replace(/:id/g, '1')
      .replace(/:botId/g, '1')
      .replace(/:workflowId/g, '1')
      .replace(/:userId/g, '1');
  };

  // Send request
  const handleSend = async () => {
    if (!selectedEndpoint) return;

    setIsLoading(true);
    setError(null);
    setResponse(null);

    const startTime = performance.now();

    try {
      const url = new URL(buildUrl(selectedEndpoint.path), BASE_URL);

      // Add query params
      queryParams
        .filter(p => p.enabled && p.key)
        .forEach(p => url.searchParams.append(p.key, p.value));

      // Build headers
      const requestHeaders = {
        'Content-Type': 'application/json'
      };

      // Add API key
      const activeApiKey = useTestKey ? TEST_API_KEY : apiKey;
      if (activeApiKey) {
        requestHeaders['Authorization'] = `Bearer ${activeApiKey}`;
      }

      // Add custom headers
      headers
        .filter(h => h.enabled && h.key)
        .forEach(h => {
          requestHeaders[h.key] = h.value;
        });

      // Build request options
      const options = {
        method: selectedEndpoint.method,
        headers: requestHeaders
      };

      // Add body for POST/PUT/PATCH
      if (['POST', 'PUT', 'PATCH'].includes(selectedEndpoint.method) && body) {
        try {
          options.body = JSON.stringify(JSON.parse(body));
        } catch {
          options.body = body;
        }
      }

      const res = await fetch(url.toString(), options);
      const endTime = performance.now();
      const time = Math.round(endTime - startTime);

      // Parse response
      let responseBody;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        responseBody = await res.json();
      } else {
        responseBody = await res.text();
      }

      // Extract headers
      const responseHeaders = {};
      res.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const responseData = {
        status: res.status,
        headers: responseHeaders,
        body: responseBody
      };

      setResponse(responseData);
      setResponseTime(time);
      saveToHistory(selectedEndpoint, responseData, time);
    } catch (err) {
      const endTime = performance.now();
      setResponseTime(Math.round(endTime - startTime));
      setError(err.message || 'Failed to send request');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle history selection
  const handleHistorySelect = (item) => {
    setSelectedEndpoint(item.endpoint);
    setResponse(item.response);
    setResponseTime(item.responseTime);
    setError(null);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-700 bg-gray-850">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Gamepad2 className="w-8 h-8 text-purple-400" />
              API Playground
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Test and explore the API endpoints interactively
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              API Docs
            </a>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 overflow-hidden ${isMobileView ? 'flex flex-col' : 'flex'}`}>
        {/* Left Panel - Endpoint Selector */}
        <div className={`${isMobileView ? 'h-64' : 'w-[300px]'} flex-shrink-0`}>
          <EndpointSelector
            selectedEndpoint={selectedEndpoint}
            onSelect={handleEndpointSelect}
          />
        </div>

        {/* Middle Panel - Request Builder */}
        <div className={`${isMobileView ? 'flex-1' : 'flex-1 min-w-0'}`}>
          <RequestBuilder
            endpoint={selectedEndpoint}
            apiKey={apiKey}
            onApiKeyChange={setApiKey}
            useTestKey={useTestKey}
            onUseTestKeyChange={setUseTestKey}
            headers={headers}
            onHeadersChange={setHeaders}
            queryParams={queryParams}
            onQueryParamsChange={setQueryParams}
            body={body}
            onBodyChange={setBody}
            onSend={handleSend}
            isLoading={isLoading}
            baseUrl={BASE_URL}
          />
        </div>

        {/* Right Panel - Response Viewer */}
        <div className={`${isMobileView ? 'h-96' : 'w-[450px]'} flex-shrink-0`}>
          <ResponseViewer
            response={response}
            responseTime={responseTime}
            error={error}
            history={history}
            onHistorySelect={handleHistorySelect}
          />
        </div>
      </div>
    </div>
  );
}
