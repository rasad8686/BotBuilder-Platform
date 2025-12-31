import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MessageSquare,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Phone,
  Instagram,
  Send,
  MessageCircle,
  X,
  CheckCircle,
  AlertCircle,
  Hash,
  Gamepad2,
  Copy,
  ExternalLink,
  Key,
  Shield,
  Globe,
  Settings,
  Zap
} from 'lucide-react';
import ChannelCard from '../components/channels/ChannelCard';
import ChannelSetup from '../components/channels/ChannelSetup';
import ConversationList from '../components/channels/ConversationList';
import ChatView from '../components/channels/ChatView';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Channels() {
  const { t } = useTranslation();
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [selectedChannelType, setSelectedChannelType] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [view, setView] = useState('list'); // list, conversations, chat
  const [showSlackWizard, setShowSlackWizard] = useState(false);
  const [showDiscordWizard, setShowDiscordWizard] = useState(false);
  const [slackStep, setSlackStep] = useState(1);
  const [discordStep, setDiscordStep] = useState(1);
  const [slackData, setSlackData] = useState({
    channelName: '',
    workspaceName: '',
    botToken: '',
    appToken: '',
    signingSecret: '',
    eventUrl: ''
  });
  const [discordData, setDiscordData] = useState({
    channelName: '',
    serverName: '',
    botToken: '',
    permissions: []
  });
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/channels`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch channels');

      const data = await response.json();
      setChannels(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddChannel = (type) => {
    setSelectedChannelType(type);
    setShowAddModal(false);

    if (type === 'slack') {
      setSlackStep(1);
      setSlackData({ channelName: '', workspaceName: '', botToken: '', appToken: '', signingSecret: '', eventUrl: '' });
      setConnectionStatus(null);
      setShowSlackWizard(true);
    } else if (type === 'discord') {
      setDiscordStep(1);
      setDiscordData({ channelName: '', serverName: '', botToken: '', permissions: [] });
      setConnectionStatus(null);
      setShowDiscordWizard(true);
    } else {
      setShowSetupWizard(true);
    }
  };

  const testSlackConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/channels/slack/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          botToken: slackData.botToken,
          appToken: slackData.appToken,
          signingSecret: slackData.signingSecret
        })
      });
      const data = await response.json();
      setConnectionStatus(response.ok ? { success: true, message: 'Connection successful!' } : { success: false, message: data.error || 'Connection failed' });
    } catch (err) {
      setConnectionStatus({ success: false, message: err.message });
    } finally {
      setTestingConnection(false);
    }
  };

  const testDiscordConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/channels/discord/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ botToken: discordData.botToken })
      });
      const data = await response.json();
      setConnectionStatus(response.ok ? { success: true, message: 'Connection successful!' } : { success: false, message: data.error || 'Connection failed' });
    } catch (err) {
      setConnectionStatus({ success: false, message: err.message });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSlackComplete = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/channels`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'slack',
          name: slackData.channelName,
          workspaceName: slackData.workspaceName,
          botToken: slackData.botToken,
          appToken: slackData.appToken,
          signingSecret: slackData.signingSecret,
          eventUrl: slackData.eventUrl
        })
      });

      if (!response.ok) throw new Error('Failed to create Slack channel');

      const newChannel = await response.json();
      setChannels([...channels, newChannel]);
      setShowSlackWizard(false);
      setSelectedChannelType(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDiscordComplete = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/channels`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'discord',
          name: discordData.channelName,
          serverName: discordData.serverName,
          botToken: discordData.botToken,
          permissions: discordData.permissions
        })
      });

      if (!response.ok) throw new Error('Failed to create Discord channel');

      const newChannel = await response.json();
      setChannels([...channels, newChannel]);
      setShowDiscordWizard(false);
      setSelectedChannelType(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const discordPermissionOptions = [
    { id: 'read_messages', label: 'Read Messages', description: 'View messages in channels' },
    { id: 'send_messages', label: 'Send Messages', description: 'Send messages in channels' },
    { id: 'manage_messages', label: 'Manage Messages', description: 'Delete or pin messages' },
    { id: 'embed_links', label: 'Embed Links', description: 'Send embedded links' },
    { id: 'attach_files', label: 'Attach Files', description: 'Upload files and images' },
    { id: 'add_reactions', label: 'Add Reactions', description: 'React to messages' },
    { id: 'use_slash_commands', label: 'Use Slash Commands', description: 'Use bot slash commands' },
    { id: 'mention_everyone', label: 'Mention Everyone', description: 'Use @everyone and @here' }
  ];

  const toggleDiscordPermission = (permId) => {
    setDiscordData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId]
    }));
  };

  const handleSetupComplete = async (channelData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/channels`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(channelData)
      });

      if (!response.ok) throw new Error('Failed to create channel');

      const newChannel = await response.json();
      setChannels([...channels, newChannel]);
      setShowSetupWizard(false);
      setSelectedChannelType(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleViewMessages = (channel) => {
    setSelectedChannel(channel);
    setView('conversations');
  };

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    setView('chat');
  };

  const handleBackToList = () => {
    setSelectedChannel(null);
    setSelectedConversation(null);
    setView('list');
  };

  const handleBackToConversations = () => {
    setSelectedConversation(null);
    setView('conversations');
  };

  const filteredChannels = channels.filter(channel => {
    const matchesSearch = channel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (channel.phone_number && channel.phone_number.includes(searchTerm)) ||
                         (channel.username && channel.username.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = filterType === 'all' || channel.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const channelTypes = [
    { id: 'whatsapp', name: 'WhatsApp Business', icon: Phone, color: 'bg-green-500', description: 'Connect via WhatsApp Business API' },
    { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'bg-pink-500', description: 'Connect Instagram Direct Messages' },
    { id: 'telegram', name: 'Telegram', icon: Send, color: 'bg-blue-500', description: 'Connect Telegram Bot' },
    { id: 'messenger', name: 'Messenger', icon: MessageCircle, color: 'bg-blue-600', description: 'Connect Facebook Messenger' },
    { id: 'slack', name: 'Slack', icon: Hash, color: 'bg-[#611f69]', description: 'Connect Slack Workspace' },
    { id: 'discord', name: 'Discord', icon: Gamepad2, color: 'bg-[#5865F2]', description: 'Connect Discord Server' }
  ];

  // Render Chat View
  if (view === 'chat' && selectedChannel && selectedConversation) {
    return (
      <ChatView
        channel={selectedChannel}
        conversation={selectedConversation}
        onBack={handleBackToConversations}
      />
    );
  }

  // Render Conversations View
  if (view === 'conversations' && selectedChannel) {
    return (
      <ConversationList
        channel={selectedChannel}
        onSelectConversation={handleSelectConversation}
        onBack={handleBackToList}
      />
    );
  }

  return (
    <div className="p-6 bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-7 h-7 text-blue-400" />
            {t('channels.title')}
          </h1>
          <p className="text-gray-400 mt-1">
            {t('channels.subtitle')}
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          {t('channels.addChannel')}
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <MessageSquare className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">{t('channels.totalChannels')}</p>
              <p className="text-xl font-bold text-white">{channels.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">{t('channels.active')}</p>
              <p className="text-xl font-bold text-white">
                {channels.filter(c => c.status === 'active').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">{t('channels.pending')}</p>
              <p className="text-xl font-bold text-white">
                {channels.filter(c => c.status === 'pending').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <MessageCircle className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">{t('channels.totalMessages')}</p>
              <p className="text-xl font-bold text-white">
                {channels.reduce((sum, c) => sum + (c.messageCount || 0), 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder={t('channels.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">{t('channels.allTypes')}</option>
            <option value="whatsapp">{t('channels.whatsapp')}</option>
            <option value="instagram">{t('channels.instagram')}</option>
            <option value="telegram">{t('channels.telegram')}</option>
            <option value="messenger">{t('channels.messenger')}</option>
            <option value="slack">Slack</option>
            <option value="discord">Discord</option>
          </select>
          <button
            onClick={fetchChannels}
            className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : filteredChannels.length === 0 ? (
        /* Empty State */
        <div className="text-center py-12">
          <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">{t('channels.noChannels')}</h3>
          <p className="text-gray-400 mb-6">
            {searchTerm || filterType !== 'all'
              ? t('channels.tryAdjusting')
              : t('channels.connectFirst')}
          </p>
          {!searchTerm && filterType === 'all' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              {t('channels.addFirstChannel')}
            </button>
          )}
        </div>
      ) : (
        /* Channel Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredChannels.map(channel => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              onViewMessages={() => handleViewMessages(channel)}
              onRefresh={fetchChannels}
            />
          ))}
        </div>
      )}

      {/* Add Channel Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg mx-4 border border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">{t('channels.addNewChannel')}</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <p className="text-gray-400 mb-6">
              {t('channels.selectPlatform')}
            </p>

            <div className="grid grid-cols-2 gap-4">
              {channelTypes.map(type => (
                <button
                  key={type.id}
                  onClick={() => handleAddChannel(type.id)}
                  className="p-4 bg-gray-700/50 rounded-lg border border-gray-600 hover:border-blue-500 hover:bg-gray-700 transition-all text-left group"
                >
                  <div className={`w-10 h-10 ${type.color} rounded-lg flex items-center justify-center mb-3`}>
                    <type.icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors">
                    {type.name}
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">{type.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Setup Wizard */}
      {showSetupWizard && selectedChannelType && (
        <ChannelSetup
          type={selectedChannelType}
          onComplete={handleSetupComplete}
          onClose={() => {
            setShowSetupWizard(false);
            setSelectedChannelType(null);
          }}
        />
      )}

      {/* Slack Setup Wizard */}
      {showSlackWizard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl mx-4 border border-gray-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#611f69] rounded-lg flex items-center justify-center">
                  <Hash className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Connect Slack</h2>
                  <p className="text-sm text-gray-400">Step {slackStep} of 4</p>
                </div>
              </div>
              <button
                onClick={() => setShowSlackWizard(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="flex gap-2 mb-6">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={`h-1 flex-1 rounded-full ${step <= slackStep ? 'bg-[#611f69]' : 'bg-gray-700'}`}
                />
              ))}
            </div>

            {/* Step 1: Basic Info */}
            {slackStep === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-[#611f69]" />
                  Basic Information
                </h3>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Channel Name</label>
                  <input
                    type="text"
                    value={slackData.channelName}
                    onChange={(e) => setSlackData({ ...slackData, channelName: e.target.value })}
                    placeholder="e.g., My Slack Bot"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#611f69]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Workspace Name</label>
                  <input
                    type="text"
                    value={slackData.workspaceName}
                    onChange={(e) => setSlackData({ ...slackData, workspaceName: e.target.value })}
                    placeholder="e.g., mycompany.slack.com"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#611f69]"
                  />
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                  <p className="text-sm text-gray-400">
                    <span className="text-white font-medium">Tip:</span> Create a Slack App at{' '}
                    <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-[#611f69] hover:underline inline-flex items-center gap-1">
                      api.slack.com/apps <ExternalLink className="w-3 h-3" />
                    </a>
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: API Credentials */}
            {slackStep === 2 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Key className="w-5 h-5 text-[#611f69]" />
                  API Credentials
                </h3>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Bot Token (xoxb-...)</label>
                  <input
                    type="password"
                    value={slackData.botToken}
                    onChange={(e) => setSlackData({ ...slackData, botToken: e.target.value })}
                    placeholder="xoxb-your-bot-token"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#611f69]"
                  />
                  <p className="text-xs text-gray-500 mt-1">Found in OAuth & Permissions section</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">App Token (xapp-...)</label>
                  <input
                    type="password"
                    value={slackData.appToken}
                    onChange={(e) => setSlackData({ ...slackData, appToken: e.target.value })}
                    placeholder="xapp-your-app-token"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#611f69]"
                  />
                  <p className="text-xs text-gray-500 mt-1">Required for Socket Mode</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Signing Secret</label>
                  <input
                    type="password"
                    value={slackData.signingSecret}
                    onChange={(e) => setSlackData({ ...slackData, signingSecret: e.target.value })}
                    placeholder="Your signing secret"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#611f69]"
                  />
                  <p className="text-xs text-gray-500 mt-1">Found in Basic Information section</p>
                </div>
              </div>
            )}

            {/* Step 3: Webhook Setup */}
            {slackStep === 3 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Globe className="w-5 h-5 text-[#611f69]" />
                  Webhook Setup
                </h3>
                <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                  <p className="text-sm text-gray-300 mb-3">
                    Configure Event Subscriptions in your Slack App with this URL:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-gray-900 rounded text-sm text-green-400 overflow-x-auto">
                      {`${API_URL}/api/webhooks/slack`}
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(`${API_URL}/api/webhooks/slack`)}
                      className="p-2 bg-gray-600 rounded hover:bg-gray-500 transition-colors"
                    >
                      <Copy className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Request URL (Optional)</label>
                  <input
                    type="text"
                    value={slackData.eventUrl}
                    onChange={(e) => setSlackData({ ...slackData, eventUrl: e.target.value })}
                    placeholder="Custom webhook URL (optional)"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#611f69]"
                  />
                </div>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-400 mb-2">Required Bot Event Subscriptions:</h4>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li>• message.channels - Messages in public channels</li>
                    <li>• message.im - Direct messages</li>
                    <li>• message.groups - Messages in private channels</li>
                    <li>• app_mention - When bot is mentioned</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Step 4: Test Connection */}
            {slackStep === 4 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-[#611f69]" />
                  Test Connection
                </h3>
                <div className="bg-gray-700/50 rounded-lg p-6 border border-gray-600 text-center">
                  <div className="w-16 h-16 bg-[#611f69]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Hash className="w-8 h-8 text-[#611f69]" />
                  </div>
                  <h4 className="text-white font-medium mb-2">Ready to Connect</h4>
                  <p className="text-gray-400 text-sm mb-4">
                    Click the button below to test your Slack connection
                  </p>
                  <button
                    onClick={testSlackConnection}
                    disabled={testingConnection}
                    className="px-6 py-2 bg-[#611f69] text-white rounded-lg hover:bg-[#4a1751] transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto"
                  >
                    {testingConnection ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        Test Connection
                      </>
                    )}
                  </button>
                  {connectionStatus && (
                    <div className={`mt-4 p-3 rounded-lg ${connectionStatus.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      <div className="flex items-center justify-center gap-2">
                        {connectionStatus.success ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        {connectionStatus.message}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-6 pt-4 border-t border-gray-700">
              <button
                onClick={() => slackStep > 1 ? setSlackStep(slackStep - 1) : setShowSlackWizard(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                {slackStep > 1 ? 'Back' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  if (slackStep < 4) {
                    setSlackStep(slackStep + 1);
                  } else {
                    handleSlackComplete();
                  }
                }}
                disabled={slackStep === 1 && (!slackData.channelName || !slackData.workspaceName)}
                className="px-6 py-2 bg-[#611f69] text-white rounded-lg hover:bg-[#4a1751] transition-colors disabled:opacity-50"
              >
                {slackStep < 4 ? 'Next' : 'Complete Setup'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discord Setup Wizard */}
      {showDiscordWizard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl mx-4 border border-gray-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#5865F2] rounded-lg flex items-center justify-center">
                  <Gamepad2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Connect Discord</h2>
                  <p className="text-sm text-gray-400">Step {discordStep} of 4</p>
                </div>
              </div>
              <button
                onClick={() => setShowDiscordWizard(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="flex gap-2 mb-6">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={`h-1 flex-1 rounded-full ${step <= discordStep ? 'bg-[#5865F2]' : 'bg-gray-700'}`}
                />
              ))}
            </div>

            {/* Step 1: Basic Info */}
            {discordStep === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-[#5865F2]" />
                  Basic Information
                </h3>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Channel Name</label>
                  <input
                    type="text"
                    value={discordData.channelName}
                    onChange={(e) => setDiscordData({ ...discordData, channelName: e.target.value })}
                    placeholder="e.g., My Discord Bot"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#5865F2]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Server Name</label>
                  <input
                    type="text"
                    value={discordData.serverName}
                    onChange={(e) => setDiscordData({ ...discordData, serverName: e.target.value })}
                    placeholder="e.g., My Community Server"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#5865F2]"
                  />
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                  <p className="text-sm text-gray-400">
                    <span className="text-white font-medium">Tip:</span> Create a Discord Application at{' '}
                    <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-[#5865F2] hover:underline inline-flex items-center gap-1">
                      Discord Developer Portal <ExternalLink className="w-3 h-3" />
                    </a>
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Bot Token */}
            {discordStep === 2 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Key className="w-5 h-5 text-[#5865F2]" />
                  Bot Token
                </h3>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Discord Bot Token</label>
                  <input
                    type="password"
                    value={discordData.botToken}
                    onChange={(e) => setDiscordData({ ...discordData, botToken: e.target.value })}
                    placeholder="Your Discord bot token"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#5865F2]"
                  />
                  <p className="text-xs text-gray-500 mt-1">Found in Bot section of your application</p>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-yellow-400 mb-2">Important:</h4>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li>• Never share your bot token publicly</li>
                    <li>• Reset the token if it gets exposed</li>
                    <li>• Enable "Message Content Intent" in Bot settings</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Step 3: Permissions Setup */}
            {discordStep === 3 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-[#5865F2]" />
                  Permissions Setup
                </h3>
                <p className="text-sm text-gray-400">Select the permissions your bot needs:</p>
                <div className="grid grid-cols-2 gap-3">
                  {discordPermissionOptions.map((perm) => (
                    <button
                      key={perm.id}
                      onClick={() => toggleDiscordPermission(perm.id)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        discordData.permissions.includes(perm.id)
                          ? 'bg-[#5865F2]/20 border-[#5865F2] text-white'
                          : 'bg-gray-700/50 border-gray-600 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                          discordData.permissions.includes(perm.id)
                            ? 'bg-[#5865F2] border-[#5865F2]'
                            : 'border-gray-500'
                        }`}>
                          {discordData.permissions.includes(perm.id) && (
                            <CheckCircle className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <span className="font-medium text-sm">{perm.label}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 ml-6">{perm.description}</p>
                    </button>
                  ))}
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                  <p className="text-sm text-gray-400">
                    <span className="text-white font-medium">Bot Invite URL:</span>
                  </p>
                  <code className="text-xs text-green-400 break-all">
                    https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=274877958144&scope=bot
                  </code>
                </div>
              </div>
            )}

            {/* Step 4: Test Connection */}
            {discordStep === 4 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-[#5865F2]" />
                  Test Connection
                </h3>
                <div className="bg-gray-700/50 rounded-lg p-6 border border-gray-600 text-center">
                  <div className="w-16 h-16 bg-[#5865F2]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Gamepad2 className="w-8 h-8 text-[#5865F2]" />
                  </div>
                  <h4 className="text-white font-medium mb-2">Ready to Connect</h4>
                  <p className="text-gray-400 text-sm mb-4">
                    Click the button below to test your Discord connection
                  </p>
                  <button
                    onClick={testDiscordConnection}
                    disabled={testingConnection}
                    className="px-6 py-2 bg-[#5865F2] text-white rounded-lg hover:bg-[#4752C4] transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto"
                  >
                    {testingConnection ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        Test Connection
                      </>
                    )}
                  </button>
                  {connectionStatus && (
                    <div className={`mt-4 p-3 rounded-lg ${connectionStatus.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      <div className="flex items-center justify-center gap-2">
                        {connectionStatus.success ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        {connectionStatus.message}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-6 pt-4 border-t border-gray-700">
              <button
                onClick={() => discordStep > 1 ? setDiscordStep(discordStep - 1) : setShowDiscordWizard(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                {discordStep > 1 ? 'Back' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  if (discordStep < 4) {
                    setDiscordStep(discordStep + 1);
                  } else {
                    handleDiscordComplete();
                  }
                }}
                disabled={discordStep === 1 && (!discordData.channelName || !discordData.serverName)}
                className="px-6 py-2 bg-[#5865F2] text-white rounded-lg hover:bg-[#4752C4] transition-colors disabled:opacity-50"
              >
                {discordStep < 4 ? 'Next' : 'Complete Setup'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
