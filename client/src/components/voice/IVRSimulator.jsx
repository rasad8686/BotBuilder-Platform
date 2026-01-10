/**
 * IVR Simulator Component
 * Interactive testing interface for IVR flows
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';

const IVRSimulator = ({ flowId, flow, onClose }) => {
  const { t } = useTranslation();

  // Simulation state
  const [simulationId, setSimulationId] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const [currentNode, setCurrentNode] = useState(null);
  const [response, setResponse] = useState(null);
  const [variables, setVariables] = useState({});
  const [navigationPath, setNavigationPath] = useState([]);
  const [inputHistory, setInputHistory] = useState([]);
  const [executionLog, setExecutionLog] = useState([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [debugMode, setDebugMode] = useState(false);
  const [showTwiML, setShowTwiML] = useState(false);
  const [twiml, setTwiml] = useState('');
  const [speechInput, setSpeechInput] = useState('');
  const [testNumber, setTestNumber] = useState('+15551234567');

  // Start simulation
  const startSimulation = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.post(`/voice/ivr/${flowId}/simulate/start`, {
        testNumber,
        debugMode
      });

      if (res.data.success) {
        setSimulationId(res.data.simulationId);
        setIsActive(true);
        setCurrentNode(res.data.currentNode);
        setResponse(res.data.response);
        setVariables(res.data.variables || {});
        setNavigationPath(res.data.navigationPath || []);
        setInputHistory([]);
        setExecutionLog([]);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start simulation');
    } finally {
      setLoading(false);
    }
  };

  // Send digit input
  const sendDigit = async (digit) => {
    if (!simulationId || !isActive) return;

    setLoading(true);
    try {
      const res = await api.post(`/voice/ivr/${flowId}/simulate/input`, {
        simulationId,
        digit,
        inputType: 'digit'
      });

      if (res.data.success) {
        updateState(res.data);
        setInputHistory(prev => [...prev, { type: 'digit', value: digit, time: new Date() }]);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send input');
    } finally {
      setLoading(false);
    }
  };

  // Send speech input
  const sendSpeech = async () => {
    if (!simulationId || !isActive || !speechInput.trim()) return;

    setLoading(true);
    try {
      const res = await api.post(`/voice/ivr/${flowId}/simulate/input`, {
        simulationId,
        speech: speechInput,
        inputType: 'speech'
      });

      if (res.data.success) {
        updateState(res.data);
        setInputHistory(prev => [...prev, { type: 'speech', value: speechInput, time: new Date() }]);
        setSpeechInput('');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send speech');
    } finally {
      setLoading(false);
    }
  };

  // End simulation
  const endSimulation = async () => {
    if (!simulationId) return;

    setLoading(true);
    try {
      await api.post(`/voice/ivr/${flowId}/simulate/end`, { simulationId });
      resetState();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to end simulation');
    } finally {
      setLoading(false);
    }
  };

  // Get TwiML preview
  const fetchTwiML = async () => {
    if (!simulationId) return;

    try {
      const res = await api.get(`/voice/ivr/${flowId}/simulate/twiml`, {
        params: { simulationId }
      });

      if (res.data.success) {
        setTwiml(res.data.twiml);
        setShowTwiML(true);
      }
    } catch (err) {
      console.error('Failed to get TwiML:', err);
    }
  };

  // Run happy path test
  const runHappyPathTest = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.post(`/voice/ivr/${flowId}/simulate/test/happy-path`, {
        maxSteps: 20
      });

      if (res.data.success) {
        alert(`Happy Path Test: ${res.data.completed ? 'Completed' : 'Incomplete'}\nNodes visited: ${res.data.nodesVisited?.length || 0}`);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Test failed');
    } finally {
      setLoading(false);
    }
  };

  // Run timeout test
  const runTimeoutTest = async () => {
    setLoading(true);
    try {
      const res = await api.post(`/voice/ivr/${flowId}/simulate/test/timeout`);
      if (res.data.success) {
        alert('Timeout test completed. Check console for details.');
        console.log('Timeout test result:', res.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Test failed');
    } finally {
      setLoading(false);
    }
  };

  // Update state from response
  const updateState = (data) => {
    setCurrentNode(data.currentNode);
    setResponse(data.response);
    setVariables(data.variables || {});
    setNavigationPath(data.navigationPath || []);

    if (data.status === 'ended') {
      setIsActive(false);
    }
  };

  // Reset state
  const resetState = () => {
    setSimulationId(null);
    setIsActive(false);
    setCurrentNode(null);
    setResponse(null);
    setVariables({});
    setNavigationPath([]);
    setInputHistory([]);
    setExecutionLog([]);
    setTwiml('');
    setShowTwiML(false);
  };

  // Keypad component
  const Keypad = () => {
    const keys = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['*', '0', '#']
    ];

    return (
      <div className="grid grid-cols-3 gap-2 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
        {keys.map((row, rowIdx) => (
          <React.Fragment key={rowIdx}>
            {row.map(key => (
              <button
                key={key}
                onClick={() => sendDigit(key)}
                disabled={!isActive || loading}
                className="w-14 h-14 rounded-full bg-white dark:bg-gray-700
                  hover:bg-gray-200 dark:hover:bg-gray-600
                  disabled:opacity-50 disabled:cursor-not-allowed
                  text-xl font-semibold shadow-sm
                  flex items-center justify-center
                  transition-colors duration-150"
              >
                {key}
              </button>
            ))}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            IVR Simulator
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {flow?.name || 'Test your IVR flow'}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Phone simulator */}
          <div className="space-y-4">
            {/* Phone display */}
            <div className="bg-gray-900 rounded-2xl p-4 text-white">
              <div className="bg-gray-800 rounded-lg p-4 min-h-[200px]">
                {!isActive ? (
                  <div className="text-center text-gray-400">
                    <p className="mb-4">Ready to simulate</p>
                    <input
                      type="text"
                      value={testNumber}
                      onChange={(e) => setTestNumber(e.target.value)}
                      placeholder="Test phone number"
                      className="w-full px-3 py-2 bg-gray-700 rounded text-white text-sm mb-4"
                    />
                    <label className="flex items-center justify-center gap-2 text-sm mb-4">
                      <input
                        type="checkbox"
                        checked={debugMode}
                        onChange={(e) => setDebugMode(e.target.checked)}
                        className="rounded"
                      />
                      Debug Mode
                    </label>
                    <button
                      onClick={startSimulation}
                      disabled={loading}
                      className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium disabled:opacity-50"
                    >
                      {loading ? 'Starting...' : 'Start Call'}
                    </button>
                  </div>
                ) : (
                  <div>
                    {/* Current node info */}
                    <div className="mb-4">
                      <span className="text-xs text-gray-400">Current Node:</span>
                      <p className="font-medium">
                        {currentNode?.name || currentNode?.type || 'Unknown'}
                      </p>
                      <span className="text-xs px-2 py-1 bg-blue-600 rounded">
                        {currentNode?.type}
                      </span>
                    </div>

                    {/* Response */}
                    {response && (
                      <div className="bg-gray-700 rounded p-3 mb-4">
                        <span className="text-xs text-gray-400 block mb-1">Response:</span>
                        {response.text && (
                          <p className="text-sm">{response.text}</p>
                        )}
                        {response.action && (
                          <span className="text-xs text-blue-400">
                            Action: {response.action}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Waiting for input indicator */}
                    {response?.waitingForInput && (
                      <div className="flex items-center gap-2 text-yellow-400 text-sm">
                        <div className="animate-pulse w-2 h-2 bg-yellow-400 rounded-full" />
                        Waiting for input...
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Keypad */}
              {isActive && (
                <div className="mt-4">
                  <Keypad />

                  {/* Speech input */}
                  <div className="mt-4 flex gap-2">
                    <input
                      type="text"
                      value={speechInput}
                      onChange={(e) => setSpeechInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendSpeech()}
                      placeholder="Speech input..."
                      className="flex-1 px-3 py-2 bg-gray-800 rounded text-white text-sm"
                    />
                    <button
                      onClick={sendSpeech}
                      disabled={!speechInput.trim() || loading}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
                    >
                      Send
                    </button>
                  </div>

                  {/* End call button */}
                  <button
                    onClick={endSimulation}
                    className="w-full mt-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium"
                  >
                    End Call
                  </button>
                </div>
              )}
            </div>

            {/* Test buttons */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={runHappyPathTest}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
              >
                Happy Path Test
              </button>
              <button
                onClick={runTimeoutTest}
                disabled={loading}
                className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50 text-sm"
              >
                Timeout Test
              </button>
              {simulationId && (
                <button
                  onClick={fetchTwiML}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
                >
                  View TwiML
                </button>
              )}
            </div>
          </div>

          {/* Right: Debug info */}
          <div className="space-y-4">
            {/* Variables */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h3 className="font-medium mb-2 text-gray-900 dark:text-white">Variables</h3>
              <div className="space-y-1 text-sm max-h-32 overflow-auto">
                {Object.entries(variables).length > 0 ? (
                  Object.entries(variables).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">{key}:</span>
                      <span className="font-mono text-gray-900 dark:text-white">
                        {JSON.stringify(value)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400">No variables set</p>
                )}
              </div>
            </div>

            {/* Navigation path */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h3 className="font-medium mb-2 text-gray-900 dark:text-white">Navigation Path</h3>
              <div className="space-y-1 text-sm max-h-40 overflow-auto">
                {navigationPath.length > 0 ? (
                  navigationPath.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{idx + 1}.</span>
                      <span className="text-gray-900 dark:text-white">
                        {item.nodeName || item.nodeType || item.nodeId?.slice(0, 8)}
                      </span>
                      {item.nodeType && (
                        <span className="text-xs px-1 bg-gray-200 dark:bg-gray-700 rounded">
                          {item.nodeType}
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400">No navigation yet</p>
                )}
              </div>
            </div>

            {/* Input history */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h3 className="font-medium mb-2 text-gray-900 dark:text-white">Input History</h3>
              <div className="space-y-1 text-sm max-h-32 overflow-auto">
                {inputHistory.length > 0 ? (
                  inputHistory.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className={`text-xs px-1 rounded ${
                        item.type === 'digit' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {item.type}
                      </span>
                      <span className="font-mono">{item.value}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400">No inputs yet</p>
                )}
              </div>
            </div>

            {/* TwiML preview */}
            {showTwiML && twiml && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium text-gray-900 dark:text-white">TwiML Preview</h3>
                  <button
                    onClick={() => setShowTwiML(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    Hide
                  </button>
                </div>
                <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded overflow-auto max-h-48">
                  {twiml}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="px-6 py-3 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
          <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};

export default IVRSimulator;
