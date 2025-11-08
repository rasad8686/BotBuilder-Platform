import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import aiApi from '../api/ai';

/**
 * AI Configuration Page
 * Recreated to match exact screenshots
 */
export default function AIConfiguration() {
  const { botId } = useParams();
  const [activeTab, setActiveTab] = useState('setup');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Configuration state
  const [config, setConfig] = useState({
    provider: 'openai',
    model: 'gpt-4o-mini',
    apiKey: '',
    isEnabled: true,
    systemPrompt: 'You are a helpful assistant.',
    temperature: 0.7,
    maxTokens: 1000,
    contextWindow: 10,
    enableStreaming: true
  });

  const [hasConfig, setHasConfig] = useState(false);

  useEffect(() => {
    loadConfig();
  }, [botId]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await aiApi.getConfig(botId);

      if (response.config && response.config.provider) {
        setHasConfig(true);
        setConfig({
          provider: response.config.provider || 'openai',
          model: response.config.model || 'gpt-4o-mini',
          apiKey: '',
          isEnabled: response.config.is_enabled ?? true,
          systemPrompt: response.config.system_prompt || 'You are a helpful assistant.',
          temperature: parseFloat(response.config.temperature) || 0.7,
          maxTokens: parseInt(response.config.max_tokens) || 1000,
          contextWindow: parseInt(response.config.context_window) || 10,
          enableStreaming: response.config.enable_streaming ?? true
        });
      }
    } catch (err) {
      if (err.response?.status !== 404) {
        setError(err.response?.data?.message || 'Failed to load configuration');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const configToSave = {
        provider: config.provider,
        model: config.model,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        system_prompt: config.systemPrompt,
        context_window: config.contextWindow,
        enable_streaming: config.enableStreaming,
        is_enabled: config.isEnabled
      };

      if (config.apiKey.trim()) {
        configToSave.api_key = config.apiKey;
      }

      await aiApi.configureAI(botId, configToSave);
      setSuccess('AI configuration saved successfully!');
      setHasConfig(true);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'setup', label: 'Setup', icon: '⚙️' },
    { id: 'prompt', label: 'Prompt', icon: '💬' },
    { id: 'parameters', label: 'Parameters', icon: '🎚️' },
    { id: 'test', label: 'Test', icon: '🧪' }
  ];

  const providers = [
    {
      id: 'openai',
      name: 'Openai',
      modelsCount: 3,
      description: 'GPT models from OpenAI'
    },
    {
      id: 'anthropic',
      name: 'Claude',
      modelsCount: 3,
      description: 'Claude models from Anthropic'
    }
  ];

  const openaiModels = [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      description: 'Most capable model, best for complex tasks',
      pricing: '$2.5/$10 per 1M tokens',
      maxTokens: '16,384 max tokens'
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      description: 'Fast and affordable, great for simple tasks',
      pricing: '$0.15/$0.6 per 1M tokens',
      maxTokens: '16,384 max tokens',
      recommended: true
    },
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      description: 'Previous generation flagship model',
      pricing: '$10/$30 per 1M tokens',
      maxTokens: '4,096 max tokens'
    }
  ];

  const claudeModels = [
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      description: 'Most intelligent model, best for complex tasks',
      pricing: '$3/$15 per 1M tokens',
      maxTokens: '8,192 max tokens',
      recommended: true
    },
    {
      id: 'claude-3-5-haiku-20241022',
      name: 'Claude 3.5 Haiku',
      description: 'Fastest model, great for simple tasks',
      pricing: '$0.8/$4 per 1M tokens',
      maxTokens: '8,192 max tokens'
    },
    {
      id: 'claude-3-opus-20240229',
      name: 'Claude 3 Opus',
      description: 'Previous generation flagship model',
      pricing: '$15/$75 per 1M tokens',
      maxTokens: '4,096 max tokens'
    }
  ];

  const currentModels = config.provider === 'openai' ? openaiModels : claudeModels;

  const wordCount = config.systemPrompt.trim().split(/\s+/).filter(w => w.length > 0).length;
  const charCount = config.systemPrompt.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">⏳</div>
          <div className="text-xl text-gray-600">Loading AI configuration...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <Link
          to="/mybots"
          className="inline-flex items-center text-purple-600 hover:text-purple-700 font-medium mb-4"
        >
          ← Back to My Bots
        </Link>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            AI Configuration
          </h1>
          <p className="text-gray-600">
            Configure AI capabilities for your bot
          </p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
            ✅ {success}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            ⚠️ {error}
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-lg mb-6">
          <div className="border-b border-gray-200">
            <div className="flex">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                      : 'text-gray-600 hover:text-purple-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* SETUP TAB */}
            {activeTab === 'setup' && (
              <div className="space-y-6">
                {/* AI Provider Selection */}
                <div>
                  <label className="block text-gray-900 font-semibold mb-3">
                    AI Provider <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    {providers.map((provider) => (
                      <button
                        key={provider.id}
                        onClick={() => setConfig({
                          ...config,
                          provider: provider.id,
                          model: provider.id === 'openai' ? 'gpt-4o-mini' : 'claude-3-5-sonnet-20241022'
                        })}
                        className={`relative p-4 rounded-lg border-2 transition-all text-left ${
                          config.provider === provider.id
                            ? 'border-purple-600 bg-purple-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {config.provider === provider.id && (
                          <div className="absolute top-3 right-3 text-purple-600 text-xl">✓</div>
                        )}
                        <div className="font-bold text-gray-900 mb-1">{provider.name}</div>
                        <div className="text-sm text-gray-500 mb-2">{provider.modelsCount} models available</div>
                        <div className="text-sm text-gray-600">{provider.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Model Selection */}
                <div>
                  <label className="block text-gray-900 font-semibold mb-3">
                    Model <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-3">
                    {currentModels.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => setConfig({ ...config, model: model.id })}
                        className={`relative w-full p-4 rounded-lg border-2 transition-all text-left ${
                          config.model === model.id
                            ? 'border-purple-600 bg-purple-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {config.model === model.id && (
                          <div className="absolute top-4 right-4 text-purple-600 text-xl">✓</div>
                        )}
                        <div className="flex items-start gap-2 mb-2">
                          <div className="font-bold text-gray-900">{model.name}</div>
                          {model.recommended && (
                            <span className="bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded">
                              ⚡ Recommended
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 mb-2">{model.description}</div>
                        <div className="flex gap-4 text-xs text-gray-500">
                          <span>💰 {model.pricing}</span>
                          <span>📊 {model.maxTokens}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* API Key */}
                <div>
                  <label className="block text-gray-900 font-semibold mb-2">
                    API Key (Optional)
                  </label>
                  <input
                    type="password"
                    value={config.apiKey}
                    onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="sk-... (Leave empty to use platform key)"
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    💡 Provide your own API key or leave empty to use the platform key (if configured)
                  </p>
                </div>

                {/* Enable/Disable AI */}
                <div>
                  <label className="flex items-center justify-between p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <div>
                      <span className="text-gray-900 font-semibold">Enable AI</span>
                      <p className="text-sm text-gray-500">
                        AI is currently {config.isEnabled ? 'enabled' : 'disabled'}
                      </p>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={config.isEnabled}
                        onChange={(e) => setConfig({ ...config, isEnabled: e.target.checked })}
                        className="sr-only"
                      />
                      <div className={`w-14 h-8 rounded-full transition-colors ${
                        config.isEnabled ? 'bg-purple-600' : 'bg-gray-300'
                      }`}>
                        <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out mt-1 ${
                          config.isEnabled ? 'translate-x-7 ml-1' : 'translate-x-1'
                        }`} />
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* PROMPT TAB */}
            {activeTab === 'prompt' && (
              <div className="space-y-6">
                {/* Show Templates Link */}
                <div>
                  <button className="text-purple-600 hover:text-purple-700 font-medium">
                    📋 Show Prompt Templates
                  </button>
                </div>

                {/* System Prompt */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-gray-900 font-semibold">
                      System Prompt
                    </label>
                    <span className="text-sm text-gray-500">
                      {wordCount} words · {charCount} characters
                    </span>
                  </div>
                  <textarea
                    value={config.systemPrompt}
                    onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                    rows="12"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    💡 The system prompt defines the AI's personality and behavior
                  </p>
                </div>

                {/* Tips */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">💡 Tips for good prompts:</h4>
                  <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                    <li>Be specific about the AI's role and expertise</li>
                    <li>Include tone guidelines (professional, friendly, formal)</li>
                    <li>Specify what the AI should or shouldn't do</li>
                    <li>Keep it concise but comprehensive</li>
                  </ul>
                </div>
              </div>
            )}

            {/* PARAMETERS TAB */}
            {activeTab === 'parameters' && (
              <div className="space-y-6">
                {/* Temperature */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-gray-900 font-semibold">
                      Temperature
                    </label>
                    <span className="text-gray-900 font-semibold">
                      {config.temperature.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.01"
                    value={config.temperature}
                    onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0.0 (Precise)</span>
                    <span>1.0 (Balanced)</span>
                    <span>2.0 (Creative)</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    🎨 Higher values make output more random and creative, lower values make it more focused and deterministic.
                  </p>
                </div>

                {/* Max Tokens */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-gray-900 font-semibold">
                      Max Tokens
                    </label>
                    <span className="text-gray-900 font-semibold">
                      {config.maxTokens.toLocaleString()}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="4000"
                    step="50"
                    value={config.maxTokens}
                    onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>100 (Short)</span>
                    <span>2000 (Medium)</span>
                    <span>4000 (Long)</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    📏 Maximum number of tokens to generate in the response. Higher values allow longer responses but cost more.
                  </p>
                </div>

                {/* Context Window */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-gray-900 font-semibold">
                      Context Window (Conversation Memory)
                    </label>
                    <span className="text-gray-900 font-semibold">
                      {config.contextWindow} messages
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="1"
                    value={config.contextWindow}
                    onChange={(e) => setConfig({ ...config, contextWindow: parseInt(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
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

                {/* Enable Streaming */}
                <div>
                  <label className="flex items-center justify-between p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <div>
                      <span className="text-gray-900 font-semibold">Enable Streaming</span>
                      <p className="text-sm text-gray-500">
                        Responses will stream in real-time
                      </p>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={config.enableStreaming}
                        onChange={(e) => setConfig({ ...config, enableStreaming: e.target.checked })}
                        className="sr-only"
                      />
                      <div className={`w-14 h-8 rounded-full transition-colors ${
                        config.enableStreaming ? 'bg-purple-600' : 'bg-gray-300'
                      }`}>
                        <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out mt-1 ${
                          config.enableStreaming ? 'translate-x-7 ml-1' : 'translate-x-1'
                        }`} />
                      </div>
                    </div>
                  </label>
                  <p className="text-sm text-gray-600 mt-2">
                    ⚡ Streaming provides faster perceived response times but may not be supported by all integrations.
                  </p>
                </div>

                {/* Cost Considerations */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-900 mb-2">⚠️ Cost Considerations:</h4>
                  <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                    <li>Higher max_tokens = higher maximum cost per request</li>
                    <li>Larger context_window = more input tokens = higher cost</li>
                    <li>Temperature doesn't affect cost, only response quality</li>
                    <li>Monitor your usage in the Usage tab</li>
                  </ul>
                </div>
              </div>
            )}

            {/* TEST TAB */}
            {activeTab === 'test' && (
              <div>
                {!hasConfig ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">⚙️</div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      No AI Configuration Yet
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Configure AI settings in the Setup tab first, then come back here to test.
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-600">
                    Test interface will be available after saving configuration.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="mb-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <span className="animate-spin">⏳</span>
                Saving...
              </>
            ) : (
              <>
                💾 Save Configuration
              </>
            )}
          </button>
        </div>

        {/* Quick Tips */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">💡 Quick Tips</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Start with GPT-4o Mini or Claude 3.5 Haiku for best cost/performance</li>
            <li>Lower temperature (0.3-0.5) for consistent responses, higher (0.8-1.0) for creative ones</li>
            <li>Context window controls how many previous messages the AI remembers</li>
            <li>Test your configuration before going live</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
