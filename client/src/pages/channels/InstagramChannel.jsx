import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';

export default function InstagramChannel() {
  const { t } = useTranslation();
  const [channels, setChannels] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Form state
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [pageId, setPageId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [instagramAccountId, setInstagramAccountId] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Test message state
  const [testMessageModal, setTestMessageModal] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [testUserId, setTestUserId] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  // Ice breakers modal
  const [iceBreakersModal, setIceBreakersModal] = useState(false);
  const [iceBreakers, setIceBreakers] = useState([{ question: '', payload: '' }]);
  const [savingIceBreakers, setSavingIceBreakers] = useState(false);

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
      const response = await api.get('/api/channels?type=instagram');
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
      setError(t('errors.loadChannels') || 'Failed to load Instagram channels');
    } finally {
      setLoading(false);
    }
  };

  const handleTestCredentials = async () => {
    if (!pageId.trim() || !accessToken.trim()) return;

    setTesting(true);
    setTestResult(null);

    try {
      const response = await api.post('/api/channels/test', {
        type: 'instagram',
        credentials: {
          page_id: pageId,
          access_token: accessToken,
          instagram_account_id: instagramAccountId || undefined
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
    if (!pageId.trim() || !accessToken.trim()) return;

    setConnecting(true);
    setError(null);

    try {
      const response = await api.post('/api/channels', {
        type: 'instagram',
        name: testResult?.details?.instagramUsername
          ? `Instagram - @${testResult.details.instagramUsername}`
          : `Instagram - ${testResult?.details?.pageName || pageId}`,
        credentials: {
          page_id: pageId,
          access_token: accessToken,
          instagram_account_id: instagramAccountId || undefined
        },
        username: testResult?.details?.instagramUsername
      });

      setChannels([response.data, ...channels]);
      setPageId('');
      setAccessToken('');
      setInstagramAccountId('');
      setTestResult(null);
      setShowConnectForm(false);
      setSuccessMessage('Instagram channel connected successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      fetchChannels();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to connect Instagram channel');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (channelId) => {
    if (!confirm('Are you sure you want to disconnect this Instagram channel?')) return;

    try {
      await api.delete(`/api/channels/${channelId}`);
      setChannels(channels.filter(c => c.id !== channelId));
      setSuccessMessage('Instagram channel disconnected successfully');
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
    if (!testUserId.trim() || !testMessage.trim()) return;

    setSendingTest(true);
    try {
      await api.post(`/api/channels/${selectedChannel.id}/send`, {
        to: testUserId,
        type: 'text',
        content: testMessage
      });
      setSuccessMessage('Test message sent successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      setTestMessageModal(false);
      setTestUserId('');
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

  const openIceBreakersModal = (channel) => {
    setSelectedChannel(channel);
    setIceBreakers([{ question: '', payload: '' }]);
    setIceBreakersModal(true);
  };

  const addIceBreaker = () => {
    if (iceBreakers.length < 4) {
      setIceBreakers([...iceBreakers, { question: '', payload: '' }]);
    }
  };

  const removeIceBreaker = (index) => {
    setIceBreakers(iceBreakers.filter((_, i) => i !== index));
  };

  const updateIceBreaker = (index, field, value) => {
    const updated = [...iceBreakers];
    updated[index][field] = value;
    setIceBreakers(updated);
  };

  const handleSaveIceBreakers = async () => {
    const validIceBreakers = iceBreakers.filter(ib => ib.question.trim() && ib.payload.trim());
    if (validIceBreakers.length === 0) {
      setError('Please add at least one ice breaker with question and payload');
      return;
    }

    setSavingIceBreakers(true);
    try {
      await api.post(`/api/channels/${selectedChannel.id}/ice-breakers`, {
        iceBreakers: validIceBreakers
      });
      setSuccessMessage('Ice breakers saved successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      setIceBreakersModal(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save ice breakers');
    } finally {
      setSavingIceBreakers(false);
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
      const response = await api.get(`/api/channels/${selectedChannel.id}/conversation/${conversation.contact_id || conversation.sender_id}`);
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
        to: selectedConversation.contact_id || selectedConversation.sender_id,
        type: 'text',
        content: replyMessage
      });
      setReplyMessage('');
      // Refresh messages
      const response = await api.get(`/api/channels/${selectedChannel.id}/conversation/${selectedConversation.contact_id || selectedConversation.sender_id}`);
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Instagram Integration</h1>
          <p className="text-gray-600 mt-1">Connect your bots to Instagram Direct Messages</p>
        </div>
        <button
          onClick={() => setShowConnectForm(!showConnectForm)}
          className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
          {showConnectForm ? 'Cancel' : 'Connect Instagram'}
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
            <div className="text-2xl font-bold text-pink-600">{stats.activeChannels}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Total Messages</div>
            <div className="text-2xl font-bold text-purple-600">{stats.totalMessages}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Unique Contacts</div>
            <div className="text-2xl font-bold text-indigo-600">{stats.totalContacts}</div>
          </div>
        </div>
      )}

      {/* Connect New Channel Form */}
      {showConnectForm && (
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Connect Instagram Business</h2>
            <p className="text-sm text-gray-500 mt-1">
              Get your credentials from the{' '}
              <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:underline">
                Meta Business Platform
              </a>
            </p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Facebook Page ID *
              </label>
              <input
                type="text"
                value={pageId}
                onChange={(e) => setPageId(e.target.value)}
                placeholder="e.g., 123456789012345"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                The Facebook Page linked to your Instagram Business account
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Page Access Token *
              </label>
              <input
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Your page access token"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Generate from Graph API Explorer with instagram_basic and instagram_manage_messages permissions
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Instagram Business Account ID (Optional)
              </label>
              <input
                type="text"
                value={instagramAccountId}
                onChange={(e) => setInstagramAccountId(e.target.value)}
                placeholder="e.g., 17841405793187218"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Will be auto-detected from the linked Page if not provided
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleTestCredentials}
                disabled={!pageId.trim() || !accessToken.trim() || testing}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                onClick={handleConnect}
                disabled={!testResult?.success || connecting}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50"
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
                      <p><strong>Page:</strong> {testResult.details?.pageName}</p>
                      {testResult.details?.instagramUsername && (
                        <p><strong>Instagram:</strong> @{testResult.details.instagramUsername}</p>
                      )}
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
            <svg className="mx-auto h-12 w-12 text-pink-400 mb-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
            <p>No Instagram channels connected yet</p>
            <p className="text-sm mt-1">Click "Connect Instagram" to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {channels.map((channel) => (
              <div key={channel.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z"/>
                        <circle cx="12" cy="12" r="3.5"/>
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{channel.name}</div>
                      <div className="text-sm text-gray-500">
                        {channel.username ? `@${channel.username}` : 'Instagram Business'}
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
                      className="p-2 text-gray-500 hover:text-pink-600 hover:bg-pink-50 rounded"
                      title="View Conversations"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </button>

                    {/* Ice Breakers */}
                    <button
                      onClick={() => openIceBreakersModal(channel)}
                      className="p-2 text-gray-500 hover:text-pink-600 hover:bg-pink-50 rounded"
                      title="Ice Breakers"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>

                    {/* Send Test Message */}
                    <button
                      onClick={() => openTestMessageModal(channel)}
                      className="p-2 text-gray-500 hover:text-pink-600 hover:bg-pink-50 rounded"
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
                    <span className="ml-2 font-medium text-pink-600">{channel.inboundCount || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Outbound:</span>
                    <span className="ml-2 font-medium text-purple-600">{channel.outboundCount || 0}</span>
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
                  Instagram User ID (IGSID)
                </label>
                <input
                  type="text"
                  value={testUserId}
                  onChange={(e) => setTestUserId(e.target.value)}
                  placeholder="e.g., 17841405793187218"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  The user must have messaged your account first (24-hour window)
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
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
                disabled={!testUserId.trim() || !testMessage.trim() || sendingTest}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50"
              >
                {sendingTest ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ice Breakers Modal */}
      {iceBreakersModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Ice Breakers</h3>
              <p className="text-sm text-gray-500">
                Set up conversation starters that appear when users open a chat
              </p>
            </div>
            <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
              {iceBreakers.map((ib, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-medium text-gray-700">Ice Breaker {index + 1}</span>
                    {iceBreakers.length > 1 && (
                      <button
                        onClick={() => removeIceBreaker(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={ib.question}
                    onChange={(e) => updateIceBreaker(index, 'question', e.target.value)}
                    placeholder="Question (e.g., What are your hours?)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 focus:ring-2 focus:ring-pink-500"
                  />
                  <input
                    type="text"
                    value={ib.payload}
                    onChange={(e) => updateIceBreaker(index, 'payload', e.target.value)}
                    placeholder="Payload (e.g., HOURS_INQUIRY)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                  />
                </div>
              ))}
              {iceBreakers.length < 4 && (
                <button
                  onClick={addIceBreaker}
                  className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-pink-500 hover:text-pink-500"
                >
                  + Add Ice Breaker
                </button>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setIceBreakersModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveIceBreakers}
                disabled={savingIceBreakers}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50"
              >
                {savingIceBreakers ? 'Saving...' : 'Save Ice Breakers'}
              </button>
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
                      key={conv.sender_id}
                      onClick={() => handleSelectConversation(conv)}
                      className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${selectedConversation?.sender_id === conv.sender_id ? 'bg-pink-50' : ''}`}
                    >
                      <div className="font-medium text-gray-900">{conv.sender_name || conv.sender_id}</div>
                      <div className="text-sm text-gray-500 truncate">{conv.lastMessage}</div>
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
                          <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${msg.direction === 'outbound' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : 'bg-gray-100 text-gray-900'}`}>
                            <p>{msg.content}</p>
                            <p className={`text-xs mt-1 ${msg.direction === 'outbound' ? 'text-pink-100' : 'text-gray-500'}`}>
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
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                          onKeyPress={(e) => e.key === 'Enter' && handleSendReply()}
                        />
                        <button
                          onClick={handleSendReply}
                          disabled={!replyMessage.trim() || sendingReply}
                          className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50"
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
      <div className="mt-8 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-purple-900 mb-4">How to Connect Instagram Business</h3>
        <ol className="list-decimal list-inside space-y-2 text-purple-800">
          <li>Go to <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="font-medium underline">Meta for Developers</a> and create an app</li>
          <li>Add Instagram Basic Display and Instagram Graph API products</li>
          <li>Link your Facebook Page to your Instagram Business/Creator account</li>
          <li>In Graph API Explorer, generate a Page Access Token with required permissions</li>
          <li>Enter the credentials above and click "Connect"</li>
        </ol>
        <div className="mt-4 p-3 bg-purple-100 rounded-lg">
          <p className="text-sm text-purple-800">
            <strong>Required Permissions:</strong>
            <code className="block mt-1 bg-purple-200 px-2 py-1 rounded text-xs">
              instagram_basic, instagram_manage_messages, pages_messaging, pages_manage_metadata
            </code>
          </p>
        </div>
        <div className="mt-4 p-3 bg-pink-100 rounded-lg">
          <p className="text-sm text-pink-800">
            <strong>Webhook URL:</strong> Configure your webhook in Meta Business Suite with this URL:
            <code className="block mt-1 bg-pink-200 px-2 py-1 rounded text-xs break-all">
              {window.location.origin}/webhooks/instagram
            </code>
          </p>
        </div>
        <div className="mt-4 p-3 bg-yellow-100 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> Instagram has a 24-hour messaging window. You can only respond to users who have messaged you within the last 24 hours unless using Human Agent tags.
          </p>
        </div>
      </div>
    </div>
  );
}
