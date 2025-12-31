import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';

export default function DiscordChannel() {
  const { t } = useTranslation();
  const [channels, setChannels] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('channels');

  // Form state
  const [botToken, setBotToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Slash Commands modal state
  const [commandsModal, setCommandsModal] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [customCommands, setCustomCommands] = useState([]);
  const [newCommand, setNewCommand] = useState({ name: '', description: '' });
  const [savingCommands, setSavingCommands] = useState(false);

  // Embed Builder modal state
  const [embedModal, setEmbedModal] = useState(false);
  const [embedConfig, setEmbedConfig] = useState({
    title: '',
    description: '',
    color: '#7289DA',
    thumbnail: '',
    image: '',
    fields: []
  });
  const [sendingEmbed, setSendingEmbed] = useState(false);
  const [targetChannelId, setTargetChannelId] = useState('');

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
      const response = await api.get('/api/channels/discord');
      setChannels(response.data.data || []);
    } catch (err) {
      setError('Failed to load Discord channels');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/api/channels/discord/stats');
      setStats(response.data.data);
    } catch (err) {
      // Failed to load stats - silent fail
    }
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const response = await api.get(`/api/channels/discord/analytics?range=${dateRange}`);
      setAnalyticsData(response.data.data);
    } catch (err) {
      // Failed to load analytics - silent fail
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleTestToken = async () => {
    if (!botToken.trim() || !clientId.trim()) return;

    setTesting(true);
    setTestResult(null);

    try {
      const response = await api.post('/api/channels/discord/test', {
        botToken,
        clientId
      });
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
    if (!botToken.trim() || !clientId.trim()) return;

    setConnecting(true);
    setError(null);

    try {
      const response = await api.post('/api/channels/discord/connect', {
        botToken,
        clientId,
        publicKey
      });
      setChannels([response.data.data, ...channels]);
      setBotToken('');
      setClientId('');
      setPublicKey('');
      setTestResult(null);
      fetchStats();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to connect Discord bot');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (channelId) => {
    if (!confirm('Are you sure you want to disconnect this Discord bot?')) return;

    try {
      await api.delete(`/api/channels/discord/${channelId}`);
      setChannels(channels.filter(c => c.id !== channelId));
      fetchStats();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to disconnect');
    }
  };

  const handleToggleActive = async (channel) => {
    try {
      await api.put(`/api/channels/discord/${channel.id}`, {
        isActive: !channel.isActive
      });
      setChannels(channels.map(c =>
        c.id === channel.id ? { ...c, isActive: !c.isActive } : c
      ));
    } catch (err) {
      setError('Failed to update channel');
    }
  };

  // Slash Commands
  const openCommandsModal = (channel) => {
    setSelectedChannel(channel);
    setCustomCommands(channel.registeredCommands || []);
    setCommandsModal(true);
  };

  const handleAddCommand = () => {
    if (!newCommand.name.trim() || !newCommand.description.trim()) return;
    setCustomCommands([...customCommands, { ...newCommand }]);
    setNewCommand({ name: '', description: '' });
  };

  const handleRemoveCommand = (index) => {
    setCustomCommands(customCommands.filter((_, i) => i !== index));
  };

  const handleSaveCommands = async () => {
    setSavingCommands(true);
    try {
      await api.post(`/api/channels/discord/${selectedChannel.id}/register-commands`, {
        commands: customCommands
      });
      setChannels(channels.map(c =>
        c.id === selectedChannel.id ? { ...c, registeredCommands: customCommands } : c
      ));
      setCommandsModal(false);
      alert('Slash commands registered successfully!');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to register commands');
    } finally {
      setSavingCommands(false);
    }
  };

  // Embed Builder
  const openEmbedModal = (channel) => {
    setSelectedChannel(channel);
    setEmbedConfig({
      title: '',
      description: '',
      color: '#7289DA',
      thumbnail: '',
      image: '',
      fields: []
    });
    setEmbedModal(true);
  };

  const handleAddField = () => {
    setEmbedConfig({
      ...embedConfig,
      fields: [...embedConfig.fields, { name: '', value: '', inline: false }]
    });
  };

  const handleRemoveField = (index) => {
    setEmbedConfig({
      ...embedConfig,
      fields: embedConfig.fields.filter((_, i) => i !== index)
    });
  };

  const handleFieldChange = (index, key, value) => {
    const updatedFields = [...embedConfig.fields];
    updatedFields[index][key] = value;
    setEmbedConfig({ ...embedConfig, fields: updatedFields });
  };

  const handleSendEmbed = async () => {
    if (!targetChannelId.trim()) {
      alert('Please enter a Discord channel ID');
      return;
    }

    setSendingEmbed(true);
    try {
      await api.post(`/api/channels/discord/${selectedChannel.id}/send-embed`, {
        channelId: targetChannelId,
        embed: embedConfig
      });
      alert('Embed sent successfully!');
      setEmbedModal(false);
      setTargetChannelId('');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send embed');
    } finally {
      setSendingEmbed(false);
    }
  };

  // Settings
  const openSettingsModal = (channel) => {
    setSelectedChannel(channel);
    setChannelSettings(channel.settings || {
      welcomeMessage: '',
      fallbackMessage: 'I could not understand your message. Please try again.',
      enableSlashCommands: true,
      enableMentionResponse: true,
      enableDMResponse: true,
      enableThreadSupport: true,
      aiEnabled: true,
      maxMessagesPerMinute: 30
    });
    setSettingsModal(true);
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.put(`/api/channels/discord/${selectedChannel.id}/settings`, {
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
        <h1 className="text-2xl font-bold text-gray-900">Discord Integration</h1>
        <p className="text-gray-600 mt-1">Connect your bots to Discord with slash commands, embeds, and more</p>
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
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-500">Total Bots</div>
                <div className="text-2xl font-bold text-gray-900">{stats.totals?.totalChannels || 0}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-500">Active Bots</div>
                <div className="text-2xl font-bold text-green-600">{stats.totals?.activeChannels || 0}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-500">Total Servers</div>
                <div className="text-2xl font-bold text-indigo-600">{stats.totals?.totalGuilds || 0}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-500">Total Messages</div>
                <div className="text-2xl font-bold text-purple-600">{stats.totals?.totalMessages || 0}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-500">Commands Used</div>
                <div className="text-2xl font-bold text-orange-600">{stats.totals?.totalCommands || 0}</div>
              </div>
            </div>
          )}

          {/* Connect New Bot */}
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Connect New Discord Bot</h2>
              <p className="text-sm text-gray-500 mt-1">
                Get your bot credentials from the <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Discord Developer Portal</a>
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bot Token <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder="Your bot token"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="Application Client ID"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Public Key (for Interactions Endpoint)
                </label>
                <input
                  type="text"
                  value={publicKey}
                  onChange={(e) => setPublicKey(e.target.value)}
                  placeholder="Application Public Key"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">Required for slash commands and interactions</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleTestToken}
                  disabled={!botToken.trim() || !clientId.trim() || testing}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  {testing ? 'Testing...' : 'Test Connection'}
                </button>
                <button
                  onClick={handleConnect}
                  disabled={!botToken.trim() || !clientId.trim() || connecting}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {connecting ? 'Connecting...' : 'Connect Bot'}
                </button>
              </div>

              {/* Test Result */}
              {testResult && (
                <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  {testResult.success ? (
                    <div>
                      <div className="flex items-center gap-2 text-green-700 font-medium">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Connection Successful!
                      </div>
                      <div className="mt-2 text-sm text-green-600">
                        <p><strong>Bot:</strong> {testResult.data.bot.username}#{testResult.data.bot.discriminator}</p>
                        <p><strong>Bot ID:</strong> {testResult.data.bot.id}</p>
                        <p><strong>Servers:</strong> {testResult.data.guilds || 0}</p>
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

          {/* Connected Bots */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Connected Bots</h2>
            </div>

            {channels.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p>No Discord bots connected yet</p>
                <p className="text-sm mt-1">Connect your first bot using the form above</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {channels.map((channel) => (
                  <div key={channel.id} className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#5865F2] rounded-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                          </svg>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{channel.botUsername}</div>
                          <div className="text-sm text-gray-500">
                            {channel.guildCount || 0} servers | Connected {new Date(channel.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${channel.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                          {channel.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Slash Commands */}
                        <button
                          onClick={() => openCommandsModal(channel)}
                          className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                          title="Manage Slash Commands"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </button>

                        {/* Embed Builder */}
                        <button
                          onClick={() => openEmbedModal(channel)}
                          className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                          title="Send Embed Message"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                          </svg>
                        </button>

                        {/* Settings */}
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

                        {/* Toggle Active */}
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

                        {/* Disconnect */}
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

                    {/* Registered Commands */}
                    {channel.registeredCommands && channel.registeredCommands.length > 0 && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <div className="text-xs text-gray-500 mb-2">Registered Slash Commands</div>
                        <div className="flex flex-wrap gap-2">
                          {channel.registeredCommands.map((cmd, idx) => (
                            <span key={idx} className="px-2 py-1 bg-indigo-100 text-indigo-700 text-sm rounded">
                              /{cmd.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-8 bg-indigo-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-indigo-900 mb-4">How to Connect Your Discord Bot</h3>
            <ol className="list-decimal list-inside space-y-2 text-indigo-800">
              <li>Go to the <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="font-medium underline">Discord Developer Portal</a></li>
              <li>Create a new application or select an existing one</li>
              <li>Go to "Bot" section and create a bot if you haven't</li>
              <li>Copy the Bot Token (keep it secret!)</li>
              <li>Copy the Application ID (Client ID) from General Information</li>
              <li>For slash commands, copy the Public Key as well</li>
              <li>Paste the credentials above and click "Connect Bot"</li>
              <li>Invite the bot to your server using the OAuth2 URL Generator</li>
            </ol>
            <div className="mt-4 p-3 bg-indigo-100 rounded-lg">
              <p className="text-sm text-indigo-800">
                <strong>Required Bot Permissions:</strong> Send Messages, Read Messages, Use Slash Commands, Embed Links, Add Reactions, Create Public Threads
              </p>
            </div>
          </div>
        </>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Discord Analytics</h2>
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-sm text-gray-500">Total Messages</div>
                  <div className="text-2xl font-bold text-gray-900">{analyticsData.totalMessages || 0}</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-sm text-gray-500">Slash Commands</div>
                  <div className="text-2xl font-bold text-indigo-600">{analyticsData.totalCommands || 0}</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-sm text-gray-500">Active Users</div>
                  <div className="text-2xl font-bold text-purple-600">{analyticsData.activeUsers || 0}</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-sm text-gray-500">Threads Created</div>
                  <div className="text-2xl font-bold text-green-600">{analyticsData.threadsCreated || 0}</div>
                </div>
              </div>

              {/* Command Usage */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Commands</h3>
                <div className="space-y-3">
                  {(analyticsData.topCommands || []).slice(0, 5).map((cmd, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-white font-medium">
                          {index + 1}
                        </div>
                        <div className="font-medium text-gray-900">/{cmd.name}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-gray-900">{cmd.count}</div>
                        <div className="text-xs text-gray-500">uses</div>
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

      {/* Slash Commands Modal */}
      {commandsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Slash Commands</h3>
              <p className="text-sm text-gray-500">{selectedChannel?.botUsername}</p>
            </div>
            <div className="p-6 space-y-4">
              {/* Default Commands Info */}
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-sm text-blue-800">
                  <strong>Default commands:</strong> /help, /ask, /status, /clear, /info
                </div>
              </div>

              {/* Custom Commands List */}
              <div className="space-y-2">
                {customCommands.map((cmd, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">/{cmd.name}</div>
                      <div className="text-sm text-gray-500">{cmd.description}</div>
                    </div>
                    <button
                      onClick={() => handleRemoveCommand(index)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              {/* Add New Command */}
              <div className="border-t pt-4">
                <div className="text-sm font-medium text-gray-700 mb-2">Add Custom Command</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCommand.name}
                    onChange={(e) => setNewCommand({ ...newCommand, name: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                    placeholder="command"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    value={newCommand.description}
                    onChange={(e) => setNewCommand({ ...newCommand, description: e.target.value })}
                    placeholder="Description"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    onClick={handleAddCommand}
                    disabled={!newCommand.name || !newCommand.description}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setCommandsModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCommands}
                disabled={savingCommands}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingCommands ? 'Registering...' : 'Register Commands'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Embed Builder Modal */}
      {embedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Embed Builder</h3>
              <p className="text-sm text-gray-500">Create and send rich embed messages</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Channel ID
                </label>
                <input
                  type="text"
                  value={targetChannelId}
                  onChange={(e) => setTargetChannelId(e.target.value)}
                  placeholder="Enter Discord channel ID"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={embedConfig.title}
                    onChange={(e) => setEmbedConfig({ ...embedConfig, title: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <input
                    type="color"
                    value={embedConfig.color}
                    onChange={(e) => setEmbedConfig({ ...embedConfig, color: e.target.value })}
                    className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={embedConfig.description}
                  onChange={(e) => setEmbedConfig({ ...embedConfig, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="Supports **bold**, *italic*, `code`, and more..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Thumbnail URL</label>
                  <input
                    type="text"
                    value={embedConfig.thumbnail}
                    onChange={(e) => setEmbedConfig({ ...embedConfig, thumbnail: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                  <input
                    type="text"
                    value={embedConfig.image}
                    onChange={(e) => setEmbedConfig({ ...embedConfig, image: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Fields */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Fields</label>
                  <button
                    onClick={handleAddField}
                    className="text-sm text-indigo-600 hover:text-indigo-700"
                  >
                    + Add Field
                  </button>
                </div>
                <div className="space-y-2">
                  {embedConfig.fields.map((field, index) => (
                    <div key={index} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={field.name}
                          onChange={(e) => handleFieldChange(index, 'name', e.target.value)}
                          placeholder="Field name"
                          className="px-3 py-2 border border-gray-300 rounded text-sm"
                        />
                        <input
                          type="text"
                          value={field.value}
                          onChange={(e) => handleFieldChange(index, 'value', e.target.value)}
                          placeholder="Field value"
                          className="px-3 py-2 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      <label className="flex items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          checked={field.inline}
                          onChange={(e) => handleFieldChange(index, 'inline', e.target.checked)}
                        />
                        Inline
                      </label>
                      <button
                        onClick={() => handleRemoveField(index)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Preview</label>
                <div
                  className="p-4 rounded-lg border-l-4"
                  style={{ borderColor: embedConfig.color, backgroundColor: '#2f3136' }}
                >
                  <div className="text-white">
                    {embedConfig.title && <div className="font-semibold text-lg">{embedConfig.title}</div>}
                    {embedConfig.description && <div className="text-gray-300 mt-2">{embedConfig.description}</div>}
                    {embedConfig.fields.length > 0 && (
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        {embedConfig.fields.map((field, idx) => (
                          <div key={idx} className={field.inline ? '' : 'col-span-2'}>
                            <div className="font-medium text-sm">{field.name}</div>
                            <div className="text-gray-300 text-sm">{field.value}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setEmbedModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmbed}
                disabled={sendingEmbed || !targetChannelId}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {sendingEmbed ? 'Sending...' : 'Send Embed'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {settingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Bot Settings</h3>
              <p className="text-sm text-gray-500">{selectedChannel?.botUsername}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Welcome Message
                </label>
                <textarea
                  value={channelSettings.welcomeMessage || ''}
                  onChange={(e) => setChannelSettings({ ...channelSettings, welcomeMessage: e.target.value })}
                  placeholder="Message sent when bot joins a server..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={channelSettings.enableSlashCommands !== false}
                    onChange={(e) => setChannelSettings({ ...channelSettings, enableSlashCommands: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">Enable slash commands</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={channelSettings.enableMentionResponse !== false}
                    onChange={(e) => setChannelSettings({ ...channelSettings, enableMentionResponse: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">Respond when mentioned (@bot)</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={channelSettings.enableDMResponse !== false}
                    onChange={(e) => setChannelSettings({ ...channelSettings, enableDMResponse: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">Respond to direct messages</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={channelSettings.enableThreadSupport !== false}
                    onChange={(e) => setChannelSettings({ ...channelSettings, enableThreadSupport: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">Enable thread support</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={channelSettings.aiEnabled !== false}
                    onChange={(e) => setChannelSettings({ ...channelSettings, aiEnabled: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">Enable AI responses</span>
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
