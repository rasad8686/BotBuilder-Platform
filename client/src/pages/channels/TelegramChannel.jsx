import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';

export default function TelegramChannel() {
  const { t } = useTranslation();
  const [channels, setChannels] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form state
  const [botToken, setBotToken] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Test message state
  const [testMessageModal, setTestMessageModal] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [testChatId, setTestChatId] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    fetchChannels();
    fetchStats();
  }, []);

  const fetchChannels = async () => {
    try {
      const response = await api.get('/api/channels/telegram');
      setChannels(response.data.data || []);
    } catch (err) {
      setError(t('errors.loadTelegramChannels'));
      // Error loading Telegram channels - silent fail
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/api/channels/telegram/stats');
      setStats(response.data.data);
    } catch (err) {
      // Failed to load stats - silent fail
    }
  };

  const handleTestToken = async () => {
    if (!botToken.trim()) return;

    setTesting(true);
    setTestResult(null);

    try {
      const response = await api.post('/api/channels/telegram/test', { botToken });
      setTestResult({ success: true, data: response.data.data });
    } catch (err) {
      setTestResult({
        success: false,
        error: err.response?.data?.error || 'Connection test failed'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleConnect = async () => {
    if (!botToken.trim()) return;

    setConnecting(true);
    setError(null);

    try {
      const response = await api.post('/api/channels/telegram/connect', { botToken });
      setChannels([response.data.data, ...channels]);
      setBotToken('');
      setTestResult(null);
      fetchStats();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to connect Telegram bot');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (channelId) => {
    if (!confirm('Are you sure you want to disconnect this Telegram bot?')) return;

    try {
      await api.delete(`/api/channels/telegram/${channelId}`);
      setChannels(channels.filter(c => c.id !== channelId));
      fetchStats();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to disconnect');
    }
  };

  const handleToggleActive = async (channel) => {
    try {
      await api.put(`/api/channels/telegram/${channel.id}`, {
        isActive: !channel.isActive
      });
      setChannels(channels.map(c =>
        c.id === channel.id ? { ...c, isActive: !c.isActive } : c
      ));
    } catch (err) {
      setError(t('errors.updateChannel'));
    }
  };

  const handleRefreshWebhook = async (channelId) => {
    try {
      await api.post(`/api/channels/telegram/${channelId}/refresh-webhook`);
      fetchChannels();
    } catch (err) {
      setError(t('errors.refreshWebhook'));
    }
  };

  const handleSendTestMessage = async () => {
    if (!testChatId.trim() || !testMessage.trim()) return;

    setSendingTest(true);
    try {
      await api.post(`/api/channels/telegram/${selectedChannel.id}/send-test`, {
        chatId: testChatId,
        message: testMessage
      });
      alert('Test message sent successfully!');
      setTestMessageModal(false);
      setTestChatId('');
      setTestMessage('');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send test message');
    } finally {
      setSendingTest(false);
    }
  };

  const openTestMessageModal = (channel) => {
    setSelectedChannel(channel);
    setTestMessageModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Telegram Integration</h1>
        <p className="text-gray-600 mt-1">Connect your bots to Telegram</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
          <button onClick={() => setError(null)} className="float-right">&times;</button>
        </div>
      )}

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Total Channels</div>
            <div className="text-2xl font-bold text-gray-900">{stats.totals?.totalChannels || 0}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Active Channels</div>
            <div className="text-2xl font-bold text-green-600">{stats.totals?.activeChannels || 0}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Total Messages</div>
            <div className="text-2xl font-bold text-indigo-600">{stats.totals?.totalMessages || 0}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Unique Users</div>
            <div className="text-2xl font-bold text-purple-600">{stats.totals?.totalUniqueUsers || 0}</div>
          </div>
        </div>
      )}

      {/* Connect New Bot */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Connect New Telegram Bot</h2>
          <p className="text-sm text-gray-500 mt-1">
            Get your bot token from <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">@BotFather</a>
          </p>
        </div>
        <div className="p-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bot Token
              </label>
              <input
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={handleTestToken}
                disabled={!botToken.trim() || testing}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                {testing ? 'Testing...' : 'Test'}
              </button>
              <button
                onClick={handleConnect}
                disabled={!botToken.trim() || connecting}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {connecting ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={`mt-4 p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              {testResult.success ? (
                <div>
                  <div className="flex items-center gap-2 text-green-700 font-medium">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Connection Successful!
                  </div>
                  <div className="mt-2 text-sm text-green-600">
                    <p><strong>Bot:</strong> @{testResult.data.bot.username}</p>
                    <p><strong>Name:</strong> {testResult.data.bot.firstName}</p>
                    <p><strong>Can join groups:</strong> {testResult.data.bot.canJoinGroups ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              ) : (
                <div className="text-red-700">
                  <strong>Connection Failed:</strong> {testResult.error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Connected Channels */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Connected Bots</h2>
        </div>

        {channels.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p>No Telegram bots connected yet</p>
            <p className="text-sm mt-1">Connect your first bot using the form above</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {channels.map((channel) => (
              <div key={channel.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295l.213-3.054 5.56-5.022c.242-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.828.94z"/>
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">@{channel.botUsername}</div>
                      <div className="text-sm text-gray-500">
                        Connected {new Date(channel.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${channel.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                      {channel.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openTestMessageModal(channel)}
                      className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                      title="Send Test Message"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleRefreshWebhook(channel.id)}
                      className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                      title="Refresh Webhook"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleToggleActive(channel)}
                      className={`p-2 rounded ${channel.isActive ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}`}
                      title={channel.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {channel.isActive ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => handleDisconnect(channel.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded"
                      title="Disconnect"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Webhook Status */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Webhook URL</div>
                  <div className="text-sm text-gray-700 font-mono break-all">{channel.webhookUrl}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Test Message Modal */}
      {testMessageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Send Test Message</h3>
              <p className="text-sm text-gray-500">@{selectedChannel?.botUsername}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Chat ID
                </label>
                <input
                  type="text"
                  value={testChatId}
                  onChange={(e) => setTestChatId(e.target.value)}
                  placeholder="Enter chat ID or username"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  You can get your chat ID by messaging @userinfobot on Telegram
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Enter your test message..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Supports HTML formatting: &lt;b&gt;bold&lt;/b&gt;, &lt;i&gt;italic&lt;/i&gt;
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setTestMessageModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSendTestMessage}
                disabled={!testChatId.trim() || !testMessage.trim() || sendingTest}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {sendingTest ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-8 bg-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">How to Connect Your Telegram Bot</h3>
        <ol className="list-decimal list-inside space-y-2 text-blue-800">
          <li>Open Telegram and search for <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="font-medium underline">@BotFather</a></li>
          <li>Send <code className="bg-blue-100 px-1 rounded">/newbot</code> to create a new bot</li>
          <li>Follow the instructions to set a name and username</li>
          <li>Copy the bot token provided by BotFather</li>
          <li>Paste the token above and click "Connect"</li>
        </ol>
        <div className="mt-4 p-3 bg-blue-100 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Make sure your bot has privacy mode disabled if you want it to receive all messages in groups.
            Send <code className="bg-blue-200 px-1 rounded">/setprivacy</code> to @BotFather and select "Disable".
          </p>
        </div>
      </div>
    </div>
  );
}
