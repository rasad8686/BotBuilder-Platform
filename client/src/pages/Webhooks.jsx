import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://botbuilder-platform.onrender.com';

export default function Webhooks() {
  const [bots, setBots] = useState([]);
  const [selectedBot, setSelectedBot] = useState(null);
  const [webhookLogs, setWebhookLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [testUrl, setTestUrl] = useState('');
  const [testResult, setTestResult] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchBots();
  }, []);

  useEffect(() => {
    if (selectedBot) {
      fetchWebhookLogs(selectedBot.id);
    }
  }, [selectedBot]);

  const fetchBots = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/bots`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setBots(response.data);
      if (response.data.length > 0) {
        setSelectedBot(response.data[0]);
      }
    } catch (error) {
      console.error('Error fetching bots:', error);
      if (error.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchWebhookLogs = async (botId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/webhooks/${botId}/logs?limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setWebhookLogs(response.data);
    } catch (error) {
      console.error('Error fetching webhook logs:', error);
    }
  };

  const handleTestWebhook = async (e) => {
    e.preventDefault();
    if (!testUrl || !selectedBot) return;

    setTestingWebhook(true);
    setTestResult(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/webhooks/${selectedBot.id}/test`,
        { webhookUrl: testUrl },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setTestResult({
        success: true,
        status: response.data.status,
        responseTime: response.data.responseTime,
        response: response.data.response
      });

      // Refresh logs
      fetchWebhookLogs(selectedBot.id);
    } catch (error) {
      setTestResult({
        success: false,
        error: error.response?.data?.error || error.message,
        status: error.response?.data?.status
      });
    } finally {
      setTestingWebhook(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const webhookUrl = selectedBot
    ? `${API_BASE_URL}/webhooks/receive/${selectedBot.id}`
    : '';

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading webhooks...</p>
        </div>
      </div>
    );
  }

  if (bots.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <div className="text-6xl mb-4">🔗</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">No Bots Yet</h2>
            <p className="text-gray-600 mb-6">Create a bot first to set up webhooks</p>
            <button
              onClick={() => navigate('/create-bot')}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Create Your First Bot
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Webhooks</h1>
          <p className="text-gray-600">Configure and monitor webhook integrations for your bots</p>
        </div>

        {/* Bot Selector */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <label className="block text-gray-700 font-semibold mb-3">Select Bot</label>
          <select
            value={selectedBot?.id || ''}
            onChange={(e) => {
              const bot = bots.find(b => b.id === parseInt(e.target.value));
              setSelectedBot(bot);
            }}
            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {bots.map((bot) => (
              <option key={bot.id} value={bot.id}>
                {bot.name} ({bot.platform})
              </option>
            ))}
          </select>
        </div>

        {selectedBot && (
          <>
            {/* Webhook URL Card */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Webhook URL</h2>
              <p className="text-gray-600 mb-4">
                Use this URL to receive webhook events from external platforms
              </p>

              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={webhookUrl}
                  readOnly
                  className="flex-1 px-4 py-3 bg-gray-50 border rounded-lg"
                />
                <button
                  onClick={() => copyToClipboard(webhookUrl)}
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  📋 Copy
                </button>
              </div>

              {selectedBot.webhook_secret && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800 mb-2">
                    <strong>Webhook Secret:</strong> {selectedBot.webhook_secret.substring(0, 20)}...
                  </p>
                  <p className="text-sm text-blue-700">
                    Use this secret to verify webhook signatures (HMAC SHA-256)
                  </p>
                </div>
              )}
            </div>

            {/* Test Webhook Card */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Test Webhook</h2>
              <p className="text-gray-600 mb-4">
                Send a test webhook to verify your endpoint is working correctly
              </p>

              <form onSubmit={handleTestWebhook} className="mb-4">
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={testUrl}
                    onChange={(e) => setTestUrl(e.target.value)}
                    placeholder="https://your-server.com/webhook"
                    required
                    className="flex-1 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="submit"
                    disabled={testingWebhook}
                    className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {testingWebhook ? 'Testing...' : 'Test'}
                  </button>
                </div>
              </form>

              {testResult && (
                <div className={`p-4 rounded-lg ${
                  testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}>
                  <p className={`font-semibold mb-2 ${
                    testResult.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {testResult.success ? '✅ Webhook Test Successful' : '❌ Webhook Test Failed'}
                  </p>
                  {testResult.success ? (
                    <div className="text-sm text-green-700">
                      <p>Status: {testResult.status}</p>
                      <p>Response Time: {testResult.responseTime}ms</p>
                    </div>
                  ) : (
                    <div className="text-sm text-red-700">
                      <p>Error: {testResult.error}</p>
                      {testResult.status && <p>Status: {testResult.status}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Integration Guides */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Integration Guides</h2>

              <div className="grid md:grid-cols-3 gap-4">
                {/* Telegram */}
                <div className="border rounded-lg p-4">
                  <div className="text-3xl mb-2">📱</div>
                  <h3 className="font-bold text-gray-800 mb-2">Telegram</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Set up Telegram bot webhook integration
                  </p>
                  <code className="text-xs bg-gray-100 p-2 rounded block overflow-x-auto">
                    curl -X POST \<br/>
                    https://api.telegram.org/bot&lt;TOKEN&gt;/setWebhook \<br/>
                    -d url={webhookUrl}
                  </code>
                </div>

                {/* WhatsApp */}
                <div className="border rounded-lg p-4">
                  <div className="text-3xl mb-2">💬</div>
                  <h3 className="font-bold text-gray-800 mb-2">WhatsApp</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Configure WhatsApp Business API
                  </p>
                  <p className="text-xs text-gray-600">
                    Use webhook URL in Meta Business Suite → WhatsApp → Configuration → Webhooks
                  </p>
                </div>

                {/* Discord */}
                <div className="border rounded-lg p-4">
                  <div className="text-3xl mb-2">🎮</div>
                  <h3 className="font-bold text-gray-800 mb-2">Discord</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Set up Discord bot interactions
                  </p>
                  <p className="text-xs text-gray-600">
                    Add interaction endpoint URL in Discord Developer Portal → Your App → General Information
                  </p>
                </div>
              </div>
            </div>

            {/* Webhook Logs */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Recent Webhook Logs</h2>
                <button
                  onClick={() => fetchWebhookLogs(selectedBot.id)}
                  className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200"
                >
                  🔄 Refresh
                </button>
              </div>

              {webhookLogs.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600">No webhook calls yet</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Webhook calls will appear here once your bot starts receiving events
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {webhookLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`border rounded-lg p-4 ${
                        log.response_status >= 200 && log.response_status < 300
                          ? 'border-green-200 bg-green-50'
                          : log.error_message
                          ? 'border-red-200 bg-red-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-800">
                              {log.request_method} {log.webhook_url}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs ${
                              log.response_status >= 200 && log.response_status < 300
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {log.response_status || 'Error'}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600">
                            <span>{new Date(log.created_at).toLocaleString()}</span>
                            {log.response_time_ms && (
                              <span className="ml-4">Response time: {log.response_time_ms}ms</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {log.error_message && (
                        <div className="mt-2 text-sm text-red-700 bg-red-100 p-2 rounded">
                          Error: {log.error_message}
                        </div>
                      )}

                      {log.request_body && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                            View Request Body
                          </summary>
                          <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                            {JSON.stringify(log.request_body, null, 2)}
                          </pre>
                        </details>
                      )}

                      {log.response_body && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                            View Response Body
                          </summary>
                          <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                            {log.response_body}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
