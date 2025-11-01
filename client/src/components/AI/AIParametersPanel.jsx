/**
 * AI Parameters Panel
 * Advanced configuration parameters
 */
export default function AIParametersPanel({
  temperature,
  maxTokens,
  contextWindow,
  enableStreaming,
  onTemperatureChange,
  onMaxTokensChange,
  onContextWindowChange,
  onStreamingChange
}) {
  return (
    <div className="space-y-6">
      {/* Temperature */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-gray-700 font-semibold">
            Temperature
          </label>
          <span className="text-sm text-gray-600 font-mono bg-gray-100 px-3 py-1 rounded">
            {temperature.toFixed(2)}
          </span>
        </div>

        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={temperature}
          onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #9333ea 0%, #9333ea ${(temperature / 2) * 100}%, #e5e7eb ${(temperature / 2) * 100}%, #e5e7eb 100%)`
          }}
        />

        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0.0 (Precise)</span>
          <span>1.0 (Balanced)</span>
          <span>2.0 (Creative)</span>
        </div>

        <p className="text-sm text-gray-600 mt-2">
          🎯 Higher values make output more random and creative, lower values make it more focused and deterministic.
        </p>
      </div>

      {/* Max Tokens */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-gray-700 font-semibold">
            Max Tokens
          </label>
          <span className="text-sm text-gray-600 font-mono bg-gray-100 px-3 py-1 rounded">
            {maxTokens.toLocaleString()}
          </span>
        </div>

        <input
          type="range"
          min="100"
          max="4000"
          step="100"
          value={maxTokens}
          onChange={(e) => onMaxTokensChange(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #9333ea 0%, #9333ea ${((maxTokens - 100) / 3900) * 100}%, #e5e7eb ${((maxTokens - 100) / 3900) * 100}%, #e5e7eb 100%)`
          }}
        />

        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>100 (Short)</span>
          <span>2000 (Medium)</span>
          <span>4000 (Long)</span>
        </div>

        <p className="text-sm text-gray-600 mt-2">
          📝 Maximum number of tokens to generate in the response. Higher values allow longer responses but cost more.
        </p>
      </div>

      {/* Context Window */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-gray-700 font-semibold">
            Context Window (Conversation Memory)
          </label>
          <span className="text-sm text-gray-600 font-mono bg-gray-100 px-3 py-1 rounded">
            {contextWindow} {contextWindow === 1 ? 'message' : 'messages'}
          </span>
        </div>

        <input
          type="range"
          min="0"
          max="50"
          step="1"
          value={contextWindow}
          onChange={(e) => onContextWindowChange(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #9333ea 0%, #9333ea ${(contextWindow / 50) * 100}%, #e5e7eb ${(contextWindow / 50) * 100}%, #e5e7eb 100%)`
          }}
        />

        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0 (No memory)</span>
          <span>10 (Default)</span>
          <span>50 (Long memory)</span>
        </div>

        <p className="text-sm text-gray-600 mt-2">
          🧠 Number of previous messages the AI can remember. Higher values maintain more context but use more tokens.
        </p>
      </div>

      {/* Streaming */}
      <div>
        <label className="flex items-center justify-between p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
          <div>
            <span className="text-gray-700 font-semibold">Enable Streaming</span>
            <p className="text-sm text-gray-500">
              {enableStreaming
                ? 'Responses will stream in real-time'
                : 'Responses will be sent all at once'}
            </p>
          </div>
          <div className="relative">
            <input
              type="checkbox"
              checked={enableStreaming}
              onChange={(e) => onStreamingChange(e.target.checked)}
              className="sr-only"
            />
            <div className={`w-14 h-8 rounded-full transition-colors ${
              enableStreaming ? 'bg-purple-600' : 'bg-gray-300'
            }`}>
              <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out mt-1 ${
                enableStreaming ? 'translate-x-7 ml-1' : 'translate-x-1'
              }`} />
            </div>
          </div>
        </label>
        <p className="text-sm text-gray-600 mt-2">
          ⚡ Streaming provides faster perceived response times but may not be supported by all integrations.
        </p>
      </div>

      {/* Info Panel */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-900 mb-2">⚠️ Cost Considerations:</h4>
        <ul className="text-sm text-yellow-800 space-y-1">
          <li>• Higher max_tokens = higher maximum cost per request</li>
          <li>• Larger context_window = more input tokens = higher cost</li>
          <li>• Temperature doesn't affect cost, only response quality</li>
          <li>• Monitor your usage in the Usage tab</li>
        </ul>
      </div>
    </div>
  );
}
