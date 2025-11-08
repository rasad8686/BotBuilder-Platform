import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import aiApi from '../../api/ai';
import AIProviderSelector from './AIProviderSelector';
import AIModelSelector from './AIModelSelector';
import AIPromptEditor from './AIPromptEditor';
import AIParametersPanel from './AIParametersPanel';
import AIChatTester from './AIChatTester';

/**
 * AI Configuration Panel
 * Main component for configuring AI for a bot
 */
export default function AIConfigPanel() {
  const { botId } = useParams();
  const [activeTab, setActiveTab] = useState('setup');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Configuration state
  const [config, setConfig] = useState({
    provider: 'openai',
    model: 'gpt-4o-mini',
    api_key: '',
    temperature: 0.7,
    max_tokens: 1000,
    system_prompt: 'You are a helpful assistant.',
    context_window: 10,
    enable_streaming: true,
    is_enabled: true
  });

  const [providers, setProviders] = useState([]);
  const [hasExistingConfig, setHasExistingConfig] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    loadProviders();
    loadConfig();
  }, [botId]);

  const loadProviders = async () => {
    try {
      const response = await aiApi.getProviders();
      setProviders(response.providers);
    } catch (err) {
      console.error('Failed to load providers:', err);
    }
  };

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await aiApi.getConfig(botId);

      // Check if config exists and has required fields
      if (response.config && response.config.provider) {
        setHasExistingConfig(true);
        setConfig({
          provider: response.config.provider,
          model: response.config.model,
          api_key: '', // Don't load API key for security
          temperature: parseFloat(response.config.temperature),
          max_tokens: parseInt(response.config.max_tokens),
          system_prompt: response.config.system_prompt,
          context_window: parseInt(response.config.context_window),
          enable_streaming: response.config.enable_streaming,
          is_enabled: response.config.is_enabled
        });
      } else {
        // Response came back but no valid config
        setHasExistingConfig(false);
      }

      setError('');
    } catch (err) {
      if (err.response?.status === 404) {
        // No config exists yet - use defaults
        setHasExistingConfig(false);
        setError('');
      } else {
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

      // Prepare config (only include api_key if provided)
      const configToSave = { ...config };
      if (!configToSave.api_key.trim()) {
        delete configToSave.api_key;
      }

      await aiApi.configureAI(botId, configToSave);

      setSuccess('AI configuration saved successfully!');
      setHasExistingConfig(true);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      setError('');

      const response = await aiApi.testConnection(botId);

      setTestResult(response.test);

      if (response.test.success) {
        setSuccess('Connection test successful!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Connection test failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to test connection');
      setTestResult({ success: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const tabs = [
    { id: 'setup', label: 'Setup', icon: '⚙️' },
    { id: 'prompt', label: 'Prompt', icon: '💭' },
    { id: 'parameters', label: 'Parameters', icon: '🎛️' },
    { id: 'test', label: 'Test', icon: '🧪' }
  ];

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
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <Link
          to="/mybots"
          className="inline-flex items-center text-purple-600 hover:text-purple-700 font-medium mb-4"
        >
          ← Back to My Bots
        </Link>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            🤖 AI Configuration
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
            {activeTab === 'setup' && (
              <div className="space-y-6">
                <AIProviderSelector
                  providers={providers}
                  selectedProvider={config.provider}
                  onProviderChange={(provider) => setConfig({ ...config, provider })}
                />

                <AIModelSelector
                  provider={config.provider}
                  selectedModel={config.model}
                  onModelChange={(model) => setConfig({ ...config, model })}
                />

                {/* API Key */}
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    API Key (Optional)
                  </label>
                  <input
                    type="password"
                    value={config.api_key}
                    onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="sk-... (Leave empty to use platform key)"
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    💡 Provide your own API key or leave empty to use the platform key (if configured)
                  </p>
                </div>

                {/* Enable/Disable */}
                <div>
                  <label className="flex items-center justify-between p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <div>
                      <span className="text-gray-700 font-semibold">Enable AI</span>
                      <p className="text-sm text-gray-500">
                        {config.is_enabled ? 'AI is currently enabled' : 'AI is currently disabled'}
                      </p>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={config.is_enabled}
                        onChange={(e) => setConfig({ ...config, is_enabled: e.target.checked })}
                        className="sr-only"
                      />
                      <div className={`w-14 h-8 rounded-full transition-colors ${
                        config.is_enabled ? 'bg-green-500' : 'bg-gray-300'
                      }`}>
                        <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out mt-1 ${
                          config.is_enabled ? 'translate-x-7 ml-1' : 'translate-x-1'
                        }`} />
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'prompt' && (
              <AIPromptEditor
                systemPrompt={config.system_prompt}
                onPromptChange={(prompt) => setConfig({ ...config, system_prompt: prompt })}
              />
            )}

            {activeTab === 'parameters' && (
              <AIParametersPanel
                temperature={config.temperature}
                maxTokens={config.max_tokens}
                contextWindow={config.context_window}
                enableStreaming={config.enable_streaming}
                onTemperatureChange={(temp) => setConfig({ ...config, temperature: temp })}
                onMaxTokensChange={(tokens) => setConfig({ ...config, max_tokens: tokens })}
                onContextWindowChange={(window) => setConfig({ ...config, context_window: window })}
                onStreamingChange={(streaming) => setConfig({ ...config, enable_streaming: streaming })}
              />
            )}

            {activeTab === 'test' && (
              <AIChatTester
                botId={botId}
                hasConfig={hasExistingConfig}
                testResult={testResult}
                onTest={handleTest}
                testing={testing}
              />
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

          {hasExistingConfig && (
            <button
              onClick={handleTest}
              disabled={testing}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testing ? (
                <>
                  <span className="animate-spin">⏳</span> Testing...
                </>
              ) : (
                '🧪 Test Connection'
              )}
            </button>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">💡 Quick Tips</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Start with GPT-4o Mini or Claude 3.5 Haiku for best cost/performance</li>
            <li>• Lower temperature (0.3-0.5) for consistent responses, higher (0.8-1.0) for creative ones</li>
            <li>• Context window controls how many previous messages the AI remembers</li>
            <li>• Test your configuration before going live</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
