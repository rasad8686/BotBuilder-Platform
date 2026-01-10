import { useState, useRef } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import aiApi from '../../api/ai';

/**
 * AI Chat Tester
 * Test chat functionality with the configured AI
 * Supports both streaming and non-streaming modes
 */
export default function AIChatTester({ botId, hasConfig, testResult, onTest, testing }) {
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [useStreaming, setUseStreaming] = useState(true);
  const [sessionId] = useState(`test_${Date.now()}`);
  const abortStreamRef = useRef(null);

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const userMessage = message.trim();
    setMessage('');

    // Add user message to chat
    setChatHistory(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    }]);

    setSending(true);

    if (useStreaming) {
      // Streaming mode - real-time response
      setStreamingText('');

      abortStreamRef.current = aiApi.sendChatStream(
        botId,
        { message: userMessage, sessionId: sessionId },
        // onChunk - called for each piece of text
        (chunk) => {
          setStreamingText(chunk.fullContent);
        },
        // onComplete - called when streaming finishes
        (result) => {
          setStreamingText('');
          setChatHistory(prev => [...prev, {
            role: 'assistant',
            content: result.content,
            usage: result.usage,
            cost: result.cost,
            responseTime: result.responseTime,
            timestamp: new Date()
          }]);
          setSending(false);
          abortStreamRef.current = null;
        },
        // onError - called on error
        (error) => {
          setStreamingText('');
          setChatHistory(prev => [...prev, {
            role: 'error',
            content: error.message || 'Streaming failed',
            timestamp: new Date()
          }]);
          setSending(false);
          abortStreamRef.current = null;
        }
      );
    } else {
      // Non-streaming mode - wait for full response
      try {
        const response = await aiApi.sendChat(botId, {
          message: userMessage,
          sessionId: sessionId
        });

        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: response.response,
          usage: response.usage,
          cost: response.cost,
          responseTime: response.responseTime,
          timestamp: new Date()
        }]);
      } catch (err) {
        setChatHistory(prev => [...prev, {
          role: 'error',
          content: err.response?.data?.message || 'Failed to get AI response',
          timestamp: new Date()
        }]);
      } finally {
        setSending(false);
      }
    }
  };

  const handleStopStreaming = () => {
    if (abortStreamRef.current) {
      abortStreamRef.current();
      abortStreamRef.current = null;
      setStreamingText('');
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setChatHistory([]);
  };

  if (!hasConfig) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">⚙️</div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          No AI Configuration Yet
        </h3>
        <p className="text-gray-600 mb-4">
          Configure AI settings in the Setup tab first, then come back here to test.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Connection Test */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Connection Test</h3>
          <button
            onClick={onTest}
            disabled={testing}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
          >
            {testing ? '⏳ Testing...' : '🧪 Test Connection'}
          </button>
        </div>

        {testResult && (
          <div className={`p-3 rounded-lg ${
            testResult.success
              ? 'bg-green-100 text-green-800 border border-green-200'
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            {testResult.success ? (
              <div>
                <div className="font-semibold mb-1 flex items-center gap-1"><CheckCircle size={16} /> Connection Successful!</div>
                <div className="text-sm">Provider: {testResult.provider} · Model: {testResult.model}</div>
                {testResult.testResponse && (
                  <div className="text-sm mt-1">Response: "{testResult.testResponse}"</div>
                )}
              </div>
            ) : (
              <div>
                <div className="font-semibold mb-1 flex items-center gap-1"><XCircle size={16} /> Connection Failed</div>
                <div className="text-sm">{testResult.error || 'Unknown error'}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chat Tester */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Chat Header */}
        <div className="bg-purple-600 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">💬</span>
            <span className="font-semibold">Chat Tester</span>
            {/* Streaming Toggle */}
            <label className="flex items-center gap-2 ml-4 cursor-pointer">
              <input
                type="checkbox"
                checked={useStreaming}
                onChange={(e) => setUseStreaming(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm">⚡ Streaming</span>
            </label>
          </div>
          <div className="flex items-center gap-2">
            {sending && useStreaming && (
              <button
                onClick={handleStopStreaming}
                className="text-sm bg-red-600 hover:bg-red-700 px-3 py-1 rounded transition-colors"
              >
                ⏹️ Stop
              </button>
            )}
            {chatHistory.length > 0 && (
              <button
                onClick={clearChat}
                className="text-sm bg-purple-700 hover:bg-purple-800 px-3 py-1 rounded transition-colors"
              >
                🗑️ Clear
              </button>
            )}
          </div>
        </div>

        {/* Chat Messages */}
        <div className="bg-gray-50 p-4 h-96 overflow-y-auto">
          {chatHistory.length === 0 ? (
            <div className="text-center text-gray-500 mt-20">
              <div className="text-4xl mb-2">👋</div>
              <p>Send a message to start testing your AI configuration</p>
            </div>
          ) : (
            <div className="space-y-4">
              {chatHistory.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      msg.role === 'user'
                        ? 'bg-purple-600 text-white'
                        : msg.role === 'error'
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : 'bg-white border border-gray-200'
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words">
                      {msg.content}
                    </div>

                    {msg.role === 'assistant' && msg.usage && (
                      <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200">
                        <div className="flex gap-3">
                          <span>📊 {msg.usage.totalTokens} tokens</span>
                          <span>💰 ${msg.cost.toFixed(6)}</span>
                          <span>⏱️ {msg.responseTime}ms</span>
                        </div>
                      </div>
                    )}

                    <div className="text-xs opacity-60 mt-1">
                      {msg.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}

              {sending && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 max-w-[80%]">
                    {streamingText ? (
                      // Show streaming text in real-time
                      <div>
                        <div className="whitespace-pre-wrap break-words">
                          {streamingText}
                          <span className="inline-block w-2 h-4 bg-purple-600 ml-1 animate-pulse"></span>
                        </div>
                        <div className="text-xs text-purple-600 mt-2 flex items-center gap-1">
                          <span className="animate-pulse">⚡</span> Streaming...
                        </div>
                      </div>
                    ) : (
                      // Show thinking indicator
                      <div className="flex items-center gap-2 text-gray-600">
                        <span className="animate-pulse">●</span>
                        <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>●</span>
                        <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>●</span>
                        <span className="ml-2">AI is thinking...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chat Input */}
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="flex gap-2">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
              rows="2"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              disabled={sending}
            />
            <button
              onClick={handleSendMessage}
              disabled={!message.trim() || sending}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              {sending ? '⏳' : '📤'} Send
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-2">
            💡 This chat maintains context based on your context_window setting. Clear chat to start fresh.
          </p>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">💡 Testing Tips:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Test your system prompt by asking role-specific questions</li>
          <li>• Verify context window by referencing earlier messages</li>
          <li>• Check temperature by asking the same question multiple times</li>
          <li>• Monitor token usage and costs for budget planning</li>
        </ul>
      </div>
    </div>
  );
}
