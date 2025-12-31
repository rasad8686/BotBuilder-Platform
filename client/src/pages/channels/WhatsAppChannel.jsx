import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';

export default function WhatsAppChannel() {
  const { t } = useTranslation();
  const [channels, setChannels] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Form state
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [businessAccountId, setBusinessAccountId] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Test message state
  const [testMessageModal, setTestMessageModal] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  // Template modal state
  const [templateModal, setTemplateModal] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Conversation modal state
  const [conversationModal, setConversationModal] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [conversationMessages, setConversationMessages] = useState([]);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/channels?type=whatsapp');
      setChannels(response.data || []);

      // Calculate stats from channels
      if (response.data && response.data.length > 0) {
        const totalMessages = response.data.reduce((sum, c) => sum + (c.messageCount || 0), 0);
        const activeChannels = response.data.filter(c => c.is_active).length;
        setStats({
          totalChannels: response.data.length,
          activeChannels,
          totalMessages,
          totalContacts: response.data.reduce((sum, c) => sum + (c.inboundCount || 0), 0)
        });
      }
    } catch (err) {
      setError(t('errors.loadChannels') || 'Failed to load WhatsApp channels');
    } finally {
      setLoading(false);
    }
  };

  const handleTestCredentials = async () => {
    if (!phoneNumberId.trim() || !accessToken.trim()) return;

    setTesting(true);
    setTestResult(null);

    try {
      const response = await api.post('/api/channels/test', {
        type: 'whatsapp',
        credentials: {
          phone_number_id: phoneNumberId,
          access_token: accessToken
        }
      });

      setTestResult(response.data);
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
    if (!phoneNumberId.trim() || !accessToken.trim()) return;

    setConnecting(true);
    setError(null);

    try {
      const response = await api.post('/api/channels', {
        type: 'whatsapp',
        name: testResult?.details?.verifiedName || `WhatsApp - ${testResult?.details?.phoneNumber || phoneNumberId}`,
        credentials: {
          phone_number_id: phoneNumberId,
          access_token: accessToken,
          business_account_id: businessAccountId
        },
        phone_number: testResult?.details?.phoneNumber
      });

      setChannels([response.data, ...channels]);
      setPhoneNumberId('');
      setAccessToken('');
      setBusinessAccountId('');
      setTestResult(null);
      setShowConnectForm(false);
      setSuccessMessage('WhatsApp channel connected successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      fetchChannels();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to connect WhatsApp channel');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (channelId) => {
    if (!confirm('Are you sure you want to disconnect this WhatsApp channel?')) return;

    try {
      await api.delete(`/api/channels/${channelId}`);
      setChannels(channels.filter(c => c.id !== channelId));
      setSuccessMessage('WhatsApp channel disconnected successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to disconnect channel');
    }
  };

  const handleToggleActive = async (channel) => {
    try {
      await api.put(`/api/channels/${channel.id}`, {
        is_active: !channel.is_active
      });
      setChannels(channels.map(c =>
        c.id === channel.id ? { ...c, is_active: !c.is_active } : c
      ));
    } catch (err) {
      setError(t('errors.updateChannel') || 'Failed to update channel');
    }
  };

  const handleSendTestMessage = async () => {
    if (!testPhoneNumber.trim() || !testMessage.trim()) return;

    setSendingTest(true);
    try {
      await api.post(`/api/channels/${selectedChannel.id}/send`, {
        to: testPhoneNumber.replace(/[^0-9]/g, ''),
        type: 'text',
        content: testMessage
      });
      setSuccessMessage('Test message sent successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      setTestMessageModal(false);
      setTestPhoneNumber('');
      setTestMessage('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send test message');
    } finally {
      setSendingTest(false);
    }
  };

  const openTestMessageModal = (channel) => {
    setSelectedChannel(channel);
    setTestMessageModal(true);
  };

  const handleViewTemplates = async (channel) => {
    setSelectedChannel(channel);
    setLoadingTemplates(true);
    setTemplateModal(true);

    try {
      const response = await api.get(`/api/channels/${channel.id}/templates`);
      setTemplates(response.data || []);
    } catch (err) {
      setError('Failed to load templates');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleViewConversations = async (channel) => {
    setSelectedChannel(channel);
    setConversationModal(true);

    try {
      const response = await api.get(`/api/channels/${channel.id}/conversations`);
      setConversations(response.data || []);
    } catch (err) {
      setError('Failed to load conversations');
    }
  };

  const handleSelectConversation = async (conversation) => {
    setSelectedConversation(conversation);
    try {
      const response = await api.get(`/api/channels/${selectedChannel.id}/conversation/${conversation.contact_id}`);
      setConversationMessages(response.data || []);
    } catch (err) {
      setError('Failed to load messages');
    }
  };

  const handleSendReply = async () => {
    if (!replyMessage.trim()) return;

    setSendingReply(true);
    try {
      await api.post(`/api/channels/${selectedChannel.id}/send`, {
        to: selectedConversation.contact_id,
        type: 'text',
        content: replyMessage
      });
      setReplyMessage('');
      // Refresh messages
      const response = await api.get(`/api/channels/${selectedChannel.id}/conversation/${selectedConversation.contact_id}`);
      setConversationMessages(response.data || []);
    } catch (err) {
      setError('Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp Business Integration</h1>
          <p className="text-gray-600 mt-1">Connect your bots to WhatsApp Business API</p>
        </div>
        <button
          onClick={() => setShowConnectForm(!showConnectForm)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          {showConnectForm ? 'Cancel' : 'Connect WhatsApp'}
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-700 hover:text-red-900">&times;</button>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex justify-between items-center">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="text-green-700 hover:text-green-900">&times;</button>
        </div>
      )}

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Total Channels</div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalChannels}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Active Channels</div>
            <div className="text-2xl font-bold text-green-600">{stats.activeChannels}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Total Messages</div>
            <div className="text-2xl font-bold text-green-600">{stats.totalMessages}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Unique Contacts</div>
            <div className="text-2xl font-bold text-purple-600">{stats.totalContacts}</div>
          </div>
        </div>
      )}

      {/* Connect New Channel Form */}
      {showConnectForm && (
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Connect WhatsApp Business</h2>
            <p className="text-sm text-gray-500 mt-1">
              Get your credentials from the{' '}
              <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">
                Meta Business Platform
              </a>
            </p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number ID *
              </label>
              <input
                type="text"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                placeholder="e.g., 123456789012345"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Found in Meta Business Suite under WhatsApp &gt; API Setup
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Access Token *
              </label>
              <input
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Your permanent access token"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Generate a permanent token in Meta Business Settings
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Account ID (Optional)
              </label>
              <input
                type="text"
                value={businessAccountId}
                onChange={(e) => setBusinessAccountId(e.target.value)}
                placeholder="e.g., 987654321098765"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleTestCredentials}
                disabled={!phoneNumberId.trim() || !accessToken.trim() || testing}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                onClick={handleConnect}
                disabled={!testResult?.success || connecting}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {connecting ? 'Connecting...' : 'Connect Channel'}
              </button>
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
                      <p><strong>Phone Number:</strong> {testResult.details?.phoneNumber}</p>
                      <p><strong>Verified Name:</strong> {testResult.details?.verifiedName}</p>
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
      )}

      {/* Connected Channels */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Connected Channels</h2>
        </div>

        {channels.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <svg className="mx-auto h-12 w-12 text-green-400 mb-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            <p>No WhatsApp channels connected yet</p>
            <p className="text-sm mt-1">Click "Connect WhatsApp" to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {channels.map((channel) => (
              <div key={channel.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{channel.name}</div>
                      <div className="text-sm text-gray-500">
                        {channel.phone_number || 'Phone number not available'}
                      </div>
                      <div className="text-xs text-gray-400">
                        Connected {new Date(channel.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${channel.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                      {channel.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* View Conversations */}
                    <button
                      onClick={() => handleViewConversations(channel)}
                      className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded"
                      title="View Conversations"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </button>

                    {/* View Templates */}
                    <button
                      onClick={() => handleViewTemplates(channel)}
                      className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded"
                      title="Message Templates"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                      </svg>
                    </button>

                    {/* Send Test Message */}
                    <button
                      onClick={() => openTestMessageModal(channel)}
                      className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded"
                      title="Send Test Message"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>

                    {/* Toggle Active */}
                    <button
                      onClick={() => handleToggleActive(channel)}
                      className={`p-2 rounded ${channel.is_active ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}`}
                      title={channel.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {channel.is_active ? (
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

                {/* Channel Stats */}
                <div className="mt-4 grid grid-cols-3 gap-4 p-3 bg-gray-50 rounded-lg text-sm">
                  <div>
                    <span className="text-gray-500">Messages:</span>
                    <span className="ml-2 font-medium">{channel.messageCount || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Inbound:</span>
                    <span className="ml-2 font-medium text-green-600">{channel.inboundCount || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Outbound:</span>
                    <span className="ml-2 font-medium text-blue-600">{channel.outboundCount || 0}</span>
                  </div>
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
              <p className="text-sm text-gray-500">{selectedChannel?.name}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={testPhoneNumber}
                  onChange={(e) => setTestPhoneNumber(e.target.value)}
                  placeholder="+1234567890"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Include country code (e.g., +1 for US, +994 for Azerbaijan)
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
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
                disabled={!testPhoneNumber.trim() || !testMessage.trim() || sendingTest}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {sendingTest ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Templates Modal */}
      {templateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Message Templates</h3>
                <p className="text-sm text-gray-500">{selectedChannel?.name}</p>
              </div>
              <button
                onClick={() => setTemplateModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {loadingTemplates ? (
                <div className="text-center py-8 text-gray-500">Loading templates...</div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No templates found</p>
                  <p className="text-sm mt-1">Create templates in Meta Business Suite</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {templates.map((template) => (
                    <div key={template.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-gray-900">{template.name}</h4>
                          <p className="text-sm text-gray-500">{template.language} - {template.category}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${template.status === 'approved' ? 'bg-green-100 text-green-700' : template.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                          {template.status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-gray-600">{template.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Conversations Modal */}
      {conversationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 h-[80vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Conversations</h3>
                <p className="text-sm text-gray-500">{selectedChannel?.name}</p>
              </div>
              <button
                onClick={() => { setConversationModal(false); setSelectedConversation(null); }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 flex overflow-hidden">
              {/* Conversation List */}
              <div className="w-1/3 border-r border-gray-200 overflow-y-auto">
                {conversations.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No conversations yet</div>
                ) : (
                  conversations.map((conv) => (
                    <div
                      key={conv.contact_id}
                      onClick={() => handleSelectConversation(conv)}
                      className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${selectedConversation?.contact_id === conv.contact_id ? 'bg-green-50' : ''}`}
                    >
                      <div className="font-medium text-gray-900">{conv.contact_name || conv.contact_id}</div>
                      <div className="text-sm text-gray-500 truncate">{conv.last_message}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(conv.last_message_at).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 flex flex-col">
                {selectedConversation ? (
                  <>
                    <div className="flex-1 p-4 overflow-y-auto space-y-4">
                      {conversationMessages.map((msg, index) => (
                        <div
                          key={index}
                          className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${msg.direction === 'outbound' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-900'}`}>
                            <p>{msg.content}</p>
                            <p className={`text-xs mt-1 ${msg.direction === 'outbound' ? 'text-green-100' : 'text-gray-500'}`}>
                              {new Date(msg.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-4 border-t border-gray-200">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={replyMessage}
                          onChange={(e) => setReplyMessage(e.target.value)}
                          placeholder="Type a message..."
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                          onKeyPress={(e) => e.key === 'Enter' && handleSendReply()}
                        />
                        <button
                          onClick={handleSendReply}
                          disabled={!replyMessage.trim() || sendingReply}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          {sendingReply ? 'Sending...' : 'Send'}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-500">
                    Select a conversation to view messages
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Setup Instructions */}
      <div className="mt-8 bg-green-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-green-900 mb-4">How to Connect WhatsApp Business</h3>
        <ol className="list-decimal list-inside space-y-2 text-green-800">
          <li>Go to <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="font-medium underline">Meta for Developers</a> and create an app</li>
          <li>Add the WhatsApp product to your app</li>
          <li>In WhatsApp &gt; API Setup, find your Phone Number ID</li>
          <li>Generate a permanent access token in Business Settings</li>
          <li>Enter the credentials above and click "Connect"</li>
        </ol>
        <div className="mt-4 p-3 bg-green-100 rounded-lg">
          <p className="text-sm text-green-800">
            <strong>Webhook URL:</strong> Configure your webhook in Meta Business Suite with this URL:
            <code className="block mt-1 bg-green-200 px-2 py-1 rounded text-xs break-all">
              {window.location.origin}/webhooks/whatsapp
            </code>
          </p>
        </div>
        <div className="mt-4 p-3 bg-yellow-100 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> WhatsApp Business API requires a verified business and approved message templates for initiating conversations. Users can only receive template messages unless they message you first.
          </p>
        </div>
      </div>
    </div>
  );
}
