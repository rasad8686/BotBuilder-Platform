import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';

export default function TelegramChannel() {
  const { t } = useTranslation();
  const [channels, setChannels] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('channels');

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

  // Settings modal state
  const [settingsModal, setSettingsModal] = useState(false);
  const [channelSettings, setChannelSettings] = useState({});
  const [savingSettings, setSavingSettings] = useState(false);

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [dateRange, setDateRange] = useState('7d');

  useEffect(() => {
    fetchChannels();
    fetchStats();
  }, []);

  useEffect(() => {
    if (activeTab === 'analytics') {
      fetchAnalytics();
    }
  }, [activeTab, dateRange]);

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

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const response = await api.get(`/api/channels/telegram/analytics?range=${dateRange}`);
      setAnalyticsData(response.data.data);
    } catch (err) {
      // Failed to load analytics - silent fail
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const openSettingsModal = (channel) => {
    setSelectedChannel(channel);
    setChannelSettings(channel.settings || {
      welcomeMessage: '',
      fallbackMessage: 'I could not understand your message. Please try again.',
      handleMedia: true,
      enableCommands: true,
      enableInlineMode: false,
      aiEnabled: true,
      maxMessagesPerMinute: 30
    });
    setSettingsModal(true);
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.put(`/api/channels/telegram/${selectedChannel.id}/settings`, {
        settings: channelSettings
      });
      setChannels(channels.map(c =>
        c.id === selectedChannel.id ? { ...c, settings: channelSettings } : c
      ));
      setSettingsModal(false);
      alert('Settings saved successfully!');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSetCommands = async (channel) => {
    const commands = prompt('Enter commands (format: command1:description1, command2:description2)');
    if (!commands) return;

    try {
      const commandList = commands.split(',').map(cmd => {
        const [command, description] = cmd.trim().split(':');
        return { command: command.replace('/', ''), description: description || '' };
      });

      await api.post(`/api/channels/telegram/${channel.id}/set-commands`, { commands: commandList });
      alert('Commands set successfully!');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to set commands');
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

      {/* Tab Navigation */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('channels')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'channels'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Channels
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'analytics'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Analytics
          </button>
        </nav>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
          <button onClick={() => setError(null)} className="float-right">&times;</button>
        </div>
      )}

      {activeTab === 'channels' && (
        <>

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
                      onClick={() => openSettingsModal(channel)}
                      className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                      title="Bot Settings"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleSetCommands(channel)}
                      className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                      title="Set Bot Commands"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </button>
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
        </>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Date Range Selector */}
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Message Analytics</h2>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
          </div>

          {analyticsLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : analyticsData ? (
            <>
              {/* Analytics Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-sm text-gray-500">Total Messages</div>
                  <div className="text-2xl font-bold text-gray-900">{analyticsData.totalMessages || 0}</div>
                  <div className="text-xs text-green-600 mt-1">
                    +{analyticsData.messageGrowth || 0}% from previous period
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-sm text-gray-500">Active Users</div>
                  <div className="text-2xl font-bold text-indigo-600">{analyticsData.activeUsers || 0}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Unique conversations
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-sm text-gray-500">Avg Response Time</div>
                  <div className="text-2xl font-bold text-purple-600">{analyticsData.avgResponseTime || '0'}ms</div>
                  <div className="text-xs text-gray-500 mt-1">
                    AI processing time
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-sm text-gray-500">Success Rate</div>
                  <div className="text-2xl font-bold text-green-600">{analyticsData.successRate || 100}%</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Messages processed
                  </div>
                </div>
              </div>

              {/* Message Types Chart */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Message Types</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(analyticsData.messageTypes || {}).map(([type, count]) => (
                    <div key={type} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        type === 'text' ? 'bg-blue-100 text-blue-600' :
                        type === 'photo' ? 'bg-green-100 text-green-600' :
                        type === 'video' ? 'bg-purple-100 text-purple-600' :
                        type === 'audio' ? 'bg-orange-100 text-orange-600' :
                        type === 'document' ? 'bg-red-100 text-red-600' :
                        type === 'sticker' ? 'bg-yellow-100 text-yellow-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {type === 'text' && (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                          </svg>
                        )}
                        {type === 'photo' && (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        )}
                        {type === 'video' && (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                        {type === 'audio' && (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        )}
                        {type === 'document' && (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                        {type === 'sticker' && (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 capitalize">{type}</div>
                        <div className="text-sm text-gray-500">{count} messages</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Daily Activity */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Activity</h3>
                <div className="h-64 flex items-end justify-between gap-2">
                  {(analyticsData.dailyActivity || []).map((day, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-indigo-500 rounded-t"
                        style={{ height: `${Math.max(day.percentage || 0, 5)}%` }}
                      ></div>
                      <div className="text-xs text-gray-500 mt-2">{day.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Users */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Active Users</h3>
                <div className="space-y-3">
                  {(analyticsData.topUsers || []).slice(0, 5).map((user, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-white font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">@{user.username || 'Unknown'}</div>
                          <div className="text-sm text-gray-500">{user.firstName || ''}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-gray-900">{user.messageCount}</div>
                        <div className="text-xs text-gray-500">messages</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              No analytics data available
            </div>
          )}
        </div>
      )}

      {/* Settings Modal */}
      {settingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Bot Settings</h3>
              <p className="text-sm text-gray-500">@{selectedChannel?.botUsername}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Welcome Message
                </label>
                <textarea
                  value={channelSettings.welcomeMessage || ''}
                  onChange={(e) => setChannelSettings({ ...channelSettings, welcomeMessage: e.target.value })}
                  placeholder="Message sent when user starts the bot..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fallback Message
                </label>
                <textarea
                  value={channelSettings.fallbackMessage || ''}
                  onChange={(e) => setChannelSettings({ ...channelSettings, fallbackMessage: e.target.value })}
                  placeholder="Message sent when AI cannot process..."
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Messages Per Minute
                </label>
                <input
                  type="number"
                  value={channelSettings.maxMessagesPerMinute || 30}
                  onChange={(e) => setChannelSettings({ ...channelSettings, maxMessagesPerMinute: parseInt(e.target.value) })}
                  min={1}
                  max={60}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={channelSettings.handleMedia !== false}
                    onChange={(e) => setChannelSettings({ ...channelSettings, handleMedia: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">Process media messages (photos, videos, etc.)</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={channelSettings.enableCommands !== false}
                    onChange={(e) => setChannelSettings({ ...channelSettings, enableCommands: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">Enable bot commands (/start, /help, etc.)</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={channelSettings.aiEnabled !== false}
                    onChange={(e) => setChannelSettings({ ...channelSettings, aiEnabled: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">Enable AI responses</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={channelSettings.enableInlineMode || false}
                    onChange={(e) => setChannelSettings({ ...channelSettings, enableInlineMode: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">Enable inline mode (@bot query)</span>
                </label>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setSettingsModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
