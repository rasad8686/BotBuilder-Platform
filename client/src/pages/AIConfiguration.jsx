import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import botApi from '../api/bots';

export default function AIConfiguration() {
  const { botId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bot, setBot] = useState(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [config, setConfig] = useState({
    ai_provider: 'openai',
    ai_model: 'gpt-4',
    ai_temperature: 0.7,
    ai_max_tokens: 2000,
    ai_system_prompt: '',
    ai_enabled: false
  });

  useEffect(() => {
    fetchBotAndConfig();
  }, [botId]);

  const fetchBotAndConfig = async () => {
    try {
      setLoading(true);
      const response = await botApi.getBot(botId);

      if (response.success && response.bot) {
        setBot(response.bot);
        // Load existing AI configuration if available
        setConfig({
          ai_provider: response.bot.ai_provider || 'openai',
          ai_model: response.bot.ai_model || 'gpt-4',
          ai_temperature: response.bot.ai_temperature || 0.7,
          ai_max_tokens: response.bot.ai_max_tokens || 2000,
          ai_system_prompt: response.bot.ai_system_prompt || '',
          ai_enabled: response.bot.ai_enabled || false
        });
      }
    } catch (err) {
      console.error('Error fetching bot:', err);
      setError('Failed to load bot configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setSaving(true);

    try {
      const response = await botApi.updateBot(botId, config);

      if (response.success) {
        setSuccessMessage('AI configuration saved successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err) {
      console.error('Error saving AI config:', err);
      setError(err.response?.data?.message || 'Failed to save AI configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-gray-600">Loading AI configuration...</p>
        </div>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Bot Not Found</h2>
          <Link to="/mybots" className="text-purple-600 hover:text-purple-700">
            Return to My Bots
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <Link
          to={`/bot/${botId}/edit`}
          className="inline-flex items-center text-purple-600 hover:text-purple-700 font-medium mb-4"
        >
          ← Back to Bot Details
        </Link>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            AI Configuration
          </h1>
          <p className="text-gray-600">
            Configure AI settings for {bot.name}
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-6">
            ✅ {successMessage}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            ⚠️ {error}
          </div>
        )}

        {/* Configuration Form */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Enable AI */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Enable AI Responses
                </label>
                <p className="text-sm text-gray-600">
                  Allow this bot to use AI for generating responses
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.ai_enabled}
                  onChange={(e) => setConfig({ ...config, ai_enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            {/* AI Provider */}
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                AI Provider
              </label>
              <select
                value={config.ai_provider}
                onChange={(e) => setConfig({ ...config, ai_provider: e.target.value })}
                disabled={!config.ai_enabled}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="google">Google (Gemini)</option>
              </select>
            </div>

            {/* AI Model */}
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Model
              </label>
              <select
                value={config.ai_model}
                onChange={(e) => setConfig({ ...config, ai_model: e.target.value })}
                disabled={!config.ai_enabled}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {config.ai_provider === 'openai' && (
                  <>
                    <option value="gpt-4">GPT-4</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  </>
                )}
                {config.ai_provider === 'anthropic' && (
                  <>
                    <option value="claude-3-opus">Claude 3 Opus</option>
                    <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                    <option value="claude-3-haiku">Claude 3 Haiku</option>
                  </>
                )}
                {config.ai_provider === 'google' && (
                  <>
                    <option value="gemini-pro">Gemini Pro</option>
                    <option value="gemini-pro-vision">Gemini Pro Vision</option>
                  </>
                )}
              </select>
            </div>

            {/* Temperature */}
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Temperature: {config.ai_temperature}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={config.ai_temperature}
                onChange={(e) => setConfig({ ...config, ai_temperature: parseFloat(e.target.value) })}
                disabled={!config.ai_enabled}
                className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-sm text-gray-600 mt-1">
                Lower values make responses more focused, higher values make them more creative
              </p>
            </div>

            {/* Max Tokens */}
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Max Tokens
              </label>
              <input
                type="number"
                min="100"
                max="4000"
                value={config.ai_max_tokens}
                onChange={(e) => setConfig({ ...config, ai_max_tokens: parseInt(e.target.value) })}
                disabled={!config.ai_enabled}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-sm text-gray-600 mt-1">
                Maximum length of AI responses (100-4000)
              </p>
            </div>

            {/* System Prompt */}
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                System Prompt
              </label>
              <textarea
                value={config.ai_system_prompt}
                onChange={(e) => setConfig({ ...config, ai_system_prompt: e.target.value })}
                disabled={!config.ai_enabled}
                rows="6"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Define the AI's behavior, personality, and guidelines..."
              />
              <p className="text-sm text-gray-600 mt-1">
                Instructions that define how the AI should behave and respond
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4">
              <button
                type="submit"
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
              <Link
                to={`/bot/${botId}/edit`}
                className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors text-center"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
