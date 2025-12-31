import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const FacebookChannel = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [pages, setPages] = useState([]);
  const [availablePages, setAvailablePages] = useState([]);
  const [bots, setBots] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('connected');
  const [selectedPage, setSelectedPage] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [stats, setStats] = useState(null);

  // Connect form state
  const [connectForm, setConnectForm] = useState({
    pageId: '',
    pageName: '',
    accessToken: '',
    botId: ''
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Settings form state
  const [settingsForm, setSettingsForm] = useState({
    welcomeMessage: '',
    defaultResponse: '',
    getStartedPayload: 'GET_STARTED',
    persistentMenu: []
  });
  const [isSaving, setIsSaving] = useState(false);

  // Test message state
  const [testMessage, setTestMessage] = useState('');
  const [testRecipient, setTestRecipient] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [pagesRes, botsRes] = await Promise.all([
        fetch('/api/facebook/pages', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/bots', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (pagesRes.ok) {
        const pagesData = await pagesRes.json();
        setPages(pagesData.pages || []);
      }

      if (botsRes.ok) {
        const botsData = await botsRes.json();
        setBots(botsData.bots || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestCredentials = async () => {
    if (!connectForm.accessToken) {
      alert(t('facebook.tokenRequired', 'Access token is required'));
      return;
    }

    setIsConnecting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/facebook/test-credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ accessToken: connectForm.accessToken })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setTestResult({ success: true, page: data.page });
        setConnectForm(prev => ({
          ...prev,
          pageId: data.page.id,
          pageName: data.page.name
        }));
      } else {
        setTestResult({ success: false, error: data.error || 'Invalid token' });
      }
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnect = async () => {
    if (!connectForm.accessToken || !connectForm.pageId) {
      alert(t('facebook.tokenAndPageRequired', 'Access token and page ID are required'));
      return;
    }

    setIsConnecting(true);
    try {
      const res = await fetch('/api/facebook/pages/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(connectForm)
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setPages(prev => [...prev, data.page]);
        setConnectForm({ pageId: '', pageName: '', accessToken: '', botId: '' });
        setTestResult(null);
        setActiveTab('connected');
        alert(t('facebook.pageConnected', 'Page connected successfully!'));
      } else {
        alert(data.error || 'Failed to connect page');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (pageId) => {
    if (!window.confirm(t('facebook.disconnectConfirm', 'Are you sure you want to disconnect this page?'))) return;

    try {
      const res = await fetch(`/api/facebook/pages/${pageId}/disconnect`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setPages(prev => prev.filter(p => p.page_id !== pageId));
        if (selectedPage?.page_id === pageId) {
          setSelectedPage(null);
        }
      } else {
        alert('Failed to disconnect page');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSelectPage = async (page) => {
    setSelectedPage(page);
    setSettingsForm({
      welcomeMessage: page.welcome_message || '',
      defaultResponse: page.default_response || '',
      getStartedPayload: page.settings?.getStartedPayload || 'GET_STARTED',
      persistentMenu: page.settings?.persistentMenu || []
    });

    // Fetch conversations and stats
    try {
      const [convRes, statsRes] = await Promise.all([
        fetch(`/api/facebook/pages/${page.page_id}/conversations`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/facebook/pages/${page.page_id}/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (convRes.ok) {
        const convData = await convRes.json();
        setConversations(convData.conversations || []);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats);
      }
    } catch (err) {
      console.error('Error fetching page data:', err);
    }
  };

  const handleSelectConversation = async (conversation) => {
    setSelectedConversation(conversation);

    try {
      const res = await fetch(`/api/facebook/conversations/${conversation.id}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  const handleSaveSettings = async () => {
    if (!selectedPage) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/facebook/pages/${selectedPage.page_id}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settingsForm)
      });

      if (res.ok) {
        alert(t('facebook.settingsSaved', 'Settings saved successfully!'));
        fetchData();
      } else {
        alert('Failed to save settings');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTestMessage = async () => {
    if (!selectedPage || !testMessage || !testRecipient) {
      alert(t('facebook.testMessageRequired', 'Recipient and message are required'));
      return;
    }

    setIsSendingTest(true);
    try {
      const res = await fetch(`/api/facebook/pages/${selectedPage.page_id}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          recipientId: testRecipient,
          message: testMessage
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        alert(t('facebook.messageSent', 'Message sent successfully!'));
        setTestMessage('');
      } else {
        alert(data.error || 'Failed to send message');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSendingTest(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '4px solid #e9ecef', borderTopColor: '#1877f2', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }}></div>
          <p style={{ color: '#6c757d' }}>{t('common.loading')}</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa', padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => navigate('/channels')} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#1877f2' }}>
            <span>←</span>
          </button>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a202c', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#1877f2">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 3.076 1.4 5.823 3.6 7.64V22l2.28-1.253A10.07 10.07 0 0012 21c5.523 0 10-4.477 10-10S17.523 2 12 2zm1.09 13.478l-2.55-2.724-4.98 2.724 5.478-5.82 2.616 2.724 4.913-2.724-5.477 5.82z"/>
              </svg>
              {t('facebook.title', 'Facebook Messenger')}
            </h1>
            <p style={{ color: '#718096', marginTop: '4px' }}>{t('facebook.subtitle', 'Connect and manage your Facebook Messenger bots')}</p>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fed7d7', color: '#742a2a', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
          {error}
        </div>
      )}

      {/* Main Content */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedPage ? '300px 1fr' : '1fr', gap: '24px' }}>
        {/* Left Panel - Pages List */}
        <div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button
              onClick={() => setActiveTab('connected')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'connected' ? '#1877f2' : 'white',
                color: activeTab === 'connected' ? 'white' : '#4a5568',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              {t('facebook.connected', 'Connected')} ({pages.length})
            </button>
            <button
              onClick={() => setActiveTab('connect')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'connect' ? '#1877f2' : 'white',
                color: activeTab === 'connect' ? 'white' : '#4a5568',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              {t('facebook.connectNew', 'Connect New')}
            </button>
          </div>

          {/* Connected Pages */}
          {activeTab === 'connected' && (
            <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              {pages.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📱</div>
                  <p style={{ color: '#718096' }}>{t('facebook.noPagesConnected', 'No pages connected yet')}</p>
                  <button
                    onClick={() => setActiveTab('connect')}
                    style={{
                      marginTop: '16px',
                      padding: '10px 20px',
                      background: '#1877f2',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    {t('facebook.connectPage', 'Connect Page')}
                  </button>
                </div>
              ) : (
                <div>
                  {pages.map(page => (
                    <div
                      key={page.id}
                      onClick={() => handleSelectPage(page)}
                      style={{
                        padding: '16px',
                        borderBottom: '1px solid #e2e8f0',
                        cursor: 'pointer',
                        background: selectedPage?.id === page.id ? '#ebf8ff' : 'transparent'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: '600', color: '#2d3748' }}>{page.page_name}</div>
                          <div style={{ fontSize: '13px', color: '#a0aec0' }}>ID: {page.page_id}</div>
                          {page.bot_name && (
                            <div style={{ fontSize: '12px', color: '#1877f2', marginTop: '4px' }}>
                              Bot: {page.bot_name}
                            </div>
                          )}
                        </div>
                        <div style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: page.is_active ? '#48bb78' : '#e53e3e'
                        }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Connect New Page */}
          {activeTab === 'connect' && (
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <h3 style={{ margin: '0 0 16px', color: '#2d3748' }}>{t('facebook.connectPage', 'Connect Facebook Page')}</h3>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
                  {t('facebook.pageAccessToken', 'Page Access Token')} *
                </label>
                <textarea
                  value={connectForm.accessToken}
                  onChange={e => setConnectForm(prev => ({ ...prev, accessToken: e.target.value }))}
                  placeholder={t('facebook.tokenPlaceholder', 'Paste your page access token here...')}
                  rows={3}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', fontFamily: 'monospace' }}
                />
              </div>

              <button
                onClick={handleTestCredentials}
                disabled={isConnecting || !connectForm.accessToken}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #1877f2',
                  background: 'white',
                  color: '#1877f2',
                  fontWeight: '500',
                  cursor: isConnecting ? 'not-allowed' : 'pointer',
                  marginBottom: '16px'
                }}
              >
                {isConnecting ? t('common.testing', 'Testing...') : t('facebook.testToken', 'Test Token')}
              </button>

              {testResult && (
                <div style={{
                  padding: '12px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  background: testResult.success ? '#c6f6d5' : '#fed7d7',
                  color: testResult.success ? '#22543d' : '#742a2a'
                }}>
                  {testResult.success ? (
                    <div>
                      <strong>{t('facebook.tokenValid', 'Token Valid!')}</strong>
                      <div style={{ marginTop: '4px' }}>Page: {testResult.page.name} (ID: {testResult.page.id})</div>
                    </div>
                  ) : (
                    <div>{testResult.error}</div>
                  )}
                </div>
              )}

              {testResult?.success && (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
                      {t('facebook.assignBot', 'Assign Bot (Optional)')}
                    </label>
                    <select
                      value={connectForm.botId}
                      onChange={e => setConnectForm(prev => ({ ...prev, botId: e.target.value }))}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    >
                      <option value="">{t('facebook.noBot', 'No Bot')}</option>
                      {bots.map(bot => (
                        <option key={bot.id} value={bot.id}>{bot.name}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={handleConnect}
                    disabled={isConnecting}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#1877f2',
                      color: 'white',
                      fontWeight: '600',
                      cursor: isConnecting ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isConnecting ? t('common.connecting', 'Connecting...') : t('facebook.connect', 'Connect Page')}
                  </button>
                </>
              )}

              <div style={{ marginTop: '24px', padding: '16px', background: '#f7fafc', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 8px', color: '#2d3748', fontSize: '14px' }}>{t('facebook.howToGetToken', 'How to get Page Access Token')}</h4>
                <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#718096', lineHeight: '1.6' }}>
                  <li>{t('facebook.step1', 'Go to Facebook Developer Portal')}</li>
                  <li>{t('facebook.step2', 'Create or select your app')}</li>
                  <li>{t('facebook.step3', 'Add Messenger product')}</li>
                  <li>{t('facebook.step4', 'Generate Page Access Token')}</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Page Details */}
        {selectedPage && (
          <div>
            {/* Page Header */}
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, color: '#2d3748' }}>{selectedPage.page_name}</h2>
                  <div style={{ color: '#a0aec0', fontSize: '14px', marginTop: '4px' }}>
                    Page ID: {selectedPage.page_id}
                  </div>
                </div>
                <button
                  onClick={() => handleDisconnect(selectedPage.page_id)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #e53e3e',
                    background: 'white',
                    color: '#e53e3e',
                    cursor: 'pointer'
                  }}
                >
                  {t('facebook.disconnect', 'Disconnect')}
                </button>
              </div>
            </div>

            {/* Stats */}
            {stats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                  <div style={{ color: '#a0aec0', fontSize: '13px', marginBottom: '4px' }}>{t('facebook.totalConversations', 'Conversations')}</div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#2d3748' }}>{stats.total_conversations || 0}</div>
                </div>
                <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                  <div style={{ color: '#a0aec0', fontSize: '13px', marginBottom: '4px' }}>{t('facebook.activeConversations', 'Active')}</div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#48bb78' }}>{stats.active_conversations || 0}</div>
                </div>
                <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                  <div style={{ color: '#a0aec0', fontSize: '13px', marginBottom: '4px' }}>{t('facebook.messagesReceived', 'Received')}</div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1877f2' }}>{stats.incoming_messages || 0}</div>
                </div>
                <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                  <div style={{ color: '#a0aec0', fontSize: '13px', marginBottom: '4px' }}>{t('facebook.messagesSent', 'Sent')}</div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#667eea' }}>{stats.outgoing_messages || 0}</div>
                </div>
              </div>
            )}

            {/* Tabs for Settings/Conversations */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {['settings', 'conversations', 'test'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: activeTab === tab ? '#1877f2' : 'white',
                    color: activeTab === tab ? 'white' : '#4a5568',
                    fontWeight: '500',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
                  }}
                >
                  {t(`facebook.tabs.${tab}`, tab.charAt(0).toUpperCase() + tab.slice(1))}
                </button>
              ))}
            </div>

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <h3 style={{ margin: '0 0 20px', color: '#2d3748' }}>{t('facebook.pageSettings', 'Page Settings')}</h3>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
                    {t('facebook.welcomeMessage', 'Welcome Message')}
                  </label>
                  <textarea
                    value={settingsForm.welcomeMessage}
                    onChange={e => setSettingsForm(prev => ({ ...prev, welcomeMessage: e.target.value }))}
                    placeholder={t('facebook.welcomePlaceholder', 'Welcome! How can I help you today?')}
                    rows={3}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
                    {t('facebook.defaultResponse', 'Default Response')}
                  </label>
                  <textarea
                    value={settingsForm.defaultResponse}
                    onChange={e => setSettingsForm(prev => ({ ...prev, defaultResponse: e.target.value }))}
                    placeholder={t('facebook.defaultPlaceholder', 'Thank you for your message. We will get back to you soon.')}
                    rows={3}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
                    {t('facebook.assignBot', 'Assigned Bot')}
                  </label>
                  <select
                    value={selectedPage.bot_id || ''}
                    onChange={async (e) => {
                      const botId = e.target.value;
                      try {
                        await fetch(`/api/facebook/pages/${selectedPage.page_id}/bot`, {
                          method: 'PUT',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                          },
                          body: JSON.stringify({ botId })
                        });
                        fetchData();
                      } catch (err) {
                        alert(err.message);
                      }
                    }}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  >
                    <option value="">{t('facebook.noBot', 'No Bot (Manual Responses)')}</option>
                    {bots.map(bot => (
                      <option key={bot.id} value={bot.id}>{bot.name}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleSaveSettings}
                  disabled={isSaving}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#1877f2',
                    color: 'white',
                    fontWeight: '600',
                    cursor: isSaving ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSaving ? t('common.saving', 'Saving...') : t('common.saveSettings', 'Save Settings')}
                </button>
              </div>
            )}

            {/* Conversations Tab */}
            {activeTab === 'conversations' && (
              <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '16px' }}>
                {/* Conversations List */}
                <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', maxHeight: '500px', overflowY: 'auto' }}>
                  {conversations.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#a0aec0' }}>
                      {t('facebook.noConversations', 'No conversations yet')}
                    </div>
                  ) : (
                    conversations.map(conv => (
                      <div
                        key={conv.id}
                        onClick={() => handleSelectConversation(conv)}
                        style={{
                          padding: '16px',
                          borderBottom: '1px solid #e2e8f0',
                          cursor: 'pointer',
                          background: selectedConversation?.id === conv.id ? '#ebf8ff' : 'transparent'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {conv.user_profile_pic ? (
                            <img
                              src={conv.user_profile_pic}
                              alt=""
                              style={{ width: '40px', height: '40px', borderRadius: '50%' }}
                            />
                          ) : (
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              background: '#1877f2',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontWeight: '600'
                            }}>
                              {(conv.user_first_name || 'U').charAt(0)}
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: '500', color: '#2d3748' }}>
                              {conv.user_first_name} {conv.user_last_name}
                            </div>
                            <div style={{ fontSize: '13px', color: '#a0aec0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {conv.last_message || 'No messages'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Messages */}
                <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: '24px' }}>
                  {selectedConversation ? (
                    <div>
                      <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>
                        <h4 style={{ margin: 0, color: '#2d3748' }}>
                          {selectedConversation.user_first_name} {selectedConversation.user_last_name}
                        </h4>
                        <div style={{ fontSize: '13px', color: '#a0aec0' }}>
                          {selectedConversation.message_count} messages
                        </div>
                      </div>

                      <div style={{ maxHeight: '350px', overflowY: 'auto', marginBottom: '16px' }}>
                        {messages.map((msg, index) => (
                          <div
                            key={index}
                            style={{
                              marginBottom: '12px',
                              display: 'flex',
                              justifyContent: msg.direction === 'incoming' ? 'flex-start' : 'flex-end'
                            }}
                          >
                            <div style={{
                              maxWidth: '70%',
                              padding: '10px 14px',
                              borderRadius: '12px',
                              background: msg.direction === 'incoming' ? '#f7fafc' : '#1877f2',
                              color: msg.direction === 'incoming' ? '#2d3748' : 'white'
                            }}>
                              {msg.content}
                              <div style={{
                                fontSize: '11px',
                                marginTop: '4px',
                                opacity: 0.7
                              }}>
                                {new Date(msg.created_at).toLocaleTimeString()}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: '#a0aec0', padding: '40px' }}>
                      {t('facebook.selectConversation', 'Select a conversation to view messages')}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Test Tab */}
            {activeTab === 'test' && (
              <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <h3 style={{ margin: '0 0 20px', color: '#2d3748' }}>{t('facebook.sendTestMessage', 'Send Test Message')}</h3>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
                    {t('facebook.recipientId', 'Recipient PSID')} *
                  </label>
                  <input
                    type="text"
                    value={testRecipient}
                    onChange={e => setTestRecipient(e.target.value)}
                    placeholder={t('facebook.recipientPlaceholder', 'Enter Facebook PSID...')}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#a0aec0' }}>
                    {t('facebook.psidHelp', 'PSID is the user ID from a conversation')}
                  </p>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#4a5568' }}>
                    {t('facebook.message', 'Message')} *
                  </label>
                  <textarea
                    value={testMessage}
                    onChange={e => setTestMessage(e.target.value)}
                    placeholder={t('facebook.messagePlaceholder', 'Enter your test message...')}
                    rows={4}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                </div>

                <button
                  onClick={handleSendTestMessage}
                  disabled={isSendingTest || !testRecipient || !testMessage}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#1877f2',
                    color: 'white',
                    fontWeight: '600',
                    cursor: isSendingTest || !testRecipient || !testMessage ? 'not-allowed' : 'pointer',
                    opacity: isSendingTest || !testRecipient || !testMessage ? 0.7 : 1
                  }}
                >
                  {isSendingTest ? t('common.sending', 'Sending...') : t('facebook.sendMessage', 'Send Message')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FacebookChannel;
