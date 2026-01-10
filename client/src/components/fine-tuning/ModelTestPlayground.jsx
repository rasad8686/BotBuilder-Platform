import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';

/**
 * Model Test Playground Component
 * Allows testing fine-tuned models with custom prompts
 * Includes side-by-side comparison and deployment features
 */
export default function ModelTestPlayground({ modelId, models = [], onDeploy }) {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState('');
  const [systemMessage, setSystemMessage] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(500);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [testHistory, setTestHistory] = useState([]);
  const [selectedModel, setSelectedModel] = useState(modelId);
  const [compareMode, setCompareMode] = useState(false);
  const [compareModelId, setCompareModelId] = useState(null);
  const [compareResponse, setCompareResponse] = useState(null);
  const [deploymentStatus, setDeploymentStatus] = useState(null);
  const [bots, setBots] = useState([]);
  const [selectedBot, setSelectedBot] = useState('');
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    if (selectedModel) {
      loadTestHistory();
      loadDeploymentStatus();
    }
    loadBots();
  }, [selectedModel]);

  const loadTestHistory = async () => {
    try {
      const res = await api.get(`/fine-tuning/models/${selectedModel}/test-history?limit=10`);
      if (res.data.success) {
        setTestHistory(res.data.tests || []);
      }
    } catch (err) {
      console.error('Failed to load test history:', err);
    }
  };

  const loadDeploymentStatus = async () => {
    try {
      const res = await api.get(`/fine-tuning/models/${selectedModel}/deployment-status`);
      if (res.data.success) {
        setDeploymentStatus(res.data);
      }
    } catch (err) {
      console.error('Failed to load deployment status:', err);
    }
  };

  const loadBots = async () => {
    try {
      const res = await api.get('/bots');
      if (res.data.bots) {
        setBots(res.data.bots);
      }
    } catch (err) {
      console.error('Failed to load bots:', err);
    }
  };

  const handleTest = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setResponse(null);
    setCompareResponse(null);

    try {
      // Test primary model
      const res = await api.post(`/fine-tuning/models/${selectedModel}/test-playground`, {
        prompt,
        systemMessage,
        temperature,
        maxTokens
      });

      if (res.data.success) {
        setResponse(res.data);
      }

      // If compare mode, test second model
      if (compareMode && compareModelId) {
        const compareRes = await api.post(`/fine-tuning/models/${compareModelId}/test-playground`, {
          prompt,
          systemMessage,
          temperature,
          maxTokens
        });

        if (compareRes.data.success) {
          setCompareResponse(compareRes.data);
        }
      }

      loadTestHistory();
    } catch (err) {
      setError(err.response?.data?.error || 'Test failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDeploy = async () => {
    if (!selectedBot) return;

    setDeploying(true);
    try {
      const res = await api.post(`/fine-tuning/models/${selectedModel}/deploy`, {
        botId: selectedBot
      });

      if (res.data.success) {
        loadDeploymentStatus();
        if (onDeploy) onDeploy(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Deployment failed');
    } finally {
      setDeploying(false);
    }
  };

  const handleUndeploy = async (botId) => {
    try {
      await api.delete(`/fine-tuning/models/${selectedModel}/deploy`, {
        data: { botId }
      });
      loadDeploymentStatus();
    } catch (err) {
      setError(err.response?.data?.error || 'Undeploy failed');
    }
  };

  const handleSetDefault = async () => {
    try {
      await api.post(`/fine-tuning/models/${selectedModel}/set-default`);
      loadDeploymentStatus();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to set default');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {t('fineTuning.testPlayground', 'Model Test Playground')}
        </h2>
        <div className="flex items-center space-x-2">
          <label className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={compareMode}
              onChange={(e) => setCompareMode(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>{t('fineTuning.compareMode', 'Compare Mode')}</span>
          </label>
        </div>
      </div>

      {/* Model Selection */}
      <div className={`grid ${compareMode ? 'grid-cols-2' : 'grid-cols-1'} gap-4 mb-6`}>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('fineTuning.selectModel', 'Select Model')}
          </label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name} ({model.base_model})
              </option>
            ))}
          </select>
        </div>

        {compareMode && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('fineTuning.compareWith', 'Compare With')}
            </label>
            <select
              value={compareModelId || ''}
              onChange={(e) => setCompareModelId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">{t('fineTuning.selectModel', 'Select Model')}</option>
              {models.filter(m => m.id !== parseInt(selectedModel)).map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} ({model.base_model})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* System Message */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('fineTuning.systemMessage', 'System Message (Optional)')}
        </label>
        <textarea
          value={systemMessage}
          onChange={(e) => setSystemMessage(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder={t('fineTuning.systemMessagePlaceholder', 'You are a helpful assistant...')}
        />
      </div>

      {/* Test Prompt */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('fineTuning.testPrompt', 'Test Prompt')}
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder={t('fineTuning.enterPrompt', 'Enter your test prompt here...')}
        />
      </div>

      {/* Parameters */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('fineTuning.temperature', 'Temperature')}: {temperature}
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('fineTuning.maxTokens', 'Max Tokens')}: {maxTokens}
          </label>
          <input
            type="range"
            min="50"
            max="2000"
            step="50"
            value={maxTokens}
            onChange={(e) => setMaxTokens(parseInt(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      {/* Test Button */}
      <button
        onClick={handleTest}
        disabled={loading || !prompt.trim()}
        className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors mb-6"
      >
        {loading ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {t('fineTuning.testing', 'Testing...')}
          </span>
        ) : (
          t('fineTuning.runTest', 'Run Test')
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Response */}
      {(response || compareResponse) && (
        <div className={`grid ${compareMode && compareResponse ? 'grid-cols-2' : 'grid-cols-1'} gap-4 mb-6`}>
          {response && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {response.model?.name || 'Model A'}
                </h3>
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <span>{response.latencyMs}ms</span>
                  <span>{response.tokensUsed} tokens</span>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded p-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {response.response}
              </div>
            </div>
          )}

          {compareMode && compareResponse && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {compareResponse.model?.name || 'Model B'}
                </h3>
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <span>{compareResponse.latencyMs}ms</span>
                  <span>{compareResponse.tokensUsed} tokens</span>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded p-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {compareResponse.response}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Deployment Section */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          {t('fineTuning.deployment', 'Deployment')}
        </h3>

        {/* Deployment Status */}
        {deploymentStatus && (
          <div className="mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                deploymentStatus.activeDeployments > 0
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
              }`}>
                {deploymentStatus.activeDeployments} {t('fineTuning.activeDeployments', 'Active Deployments')}
              </span>
            </div>

            {deploymentStatus.deployments?.filter(d => d.is_active).map((deployment) => (
              <div key={deployment.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 rounded p-2 mb-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {deployment.bot_name}
                </span>
                <button
                  onClick={() => handleUndeploy(deployment.bot_id)}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  {t('fineTuning.undeploy', 'Undeploy')}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Deploy to Bot */}
        <div className="flex items-center space-x-2">
          <select
            value={selectedBot}
            onChange={(e) => setSelectedBot(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">{t('fineTuning.selectBot', 'Select Bot to Deploy')}</option>
            {bots.map((bot) => (
              <option key={bot.id} value={bot.id}>
                {bot.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleDeploy}
            disabled={!selectedBot || deploying}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
          >
            {deploying ? t('fineTuning.deploying', 'Deploying...') : t('fineTuning.deploy', 'Deploy')}
          </button>
          <button
            onClick={handleSetDefault}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
          >
            {t('fineTuning.setDefault', 'Set Default')}
          </button>
        </div>
      </div>

      {/* Test History */}
      {testHistory.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            {t('fineTuning.recentTests', 'Recent Tests')}
          </h3>
          <div className="space-y-2">
            {testHistory.map((test) => (
              <div
                key={test.id}
                className="bg-gray-50 dark:bg-gray-900 rounded p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => setPrompt(test.test_prompt)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">
                    {new Date(test.created_at).toLocaleString()}
                  </span>
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <span>{test.latency_ms}ms</span>
                    <span>{test.tokens_used} tokens</span>
                  </div>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                  {test.test_prompt}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
