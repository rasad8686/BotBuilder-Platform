import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const integrationIcons = {
  slack: '💬',
  google_calendar: '📅',
  gmail: '📧',
  crm: '👥'
};

const statusColors = {
  connected: { bg: '#d4edda', color: '#155724' },
  disconnected: { bg: '#e9ecef', color: '#495057' },
  error: { bg: '#f8d7da', color: '#721c24' }
};

const Integrations = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  const [availableIntegrations, setAvailableIntegrations] = useState([]);
  const [connectedIntegrations, setConnectedIntegrations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [testingId, setTestingId] = useState(null);
  const [connectingType, setConnectingType] = useState(null);

  const token = localStorage.getItem('token');

  useEffect(() => {
    // Check URL params for success/error
    const success = searchParams.get('success');
    const errorParam = searchParams.get('error');

    if (success) {
      setSuccessMessage(t('integrations.connectSuccess', { type: success }));
      setTimeout(() => setSuccessMessage(null), 5000);
    }
    if (errorParam) {
      setError(errorParam);
      setTimeout(() => setError(null), 5000);
    }

    fetchData();
  }, [searchParams]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [availableRes, connectedRes] = await Promise.all([
        fetch('/api/integrations/available', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/integrations', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (availableRes.ok) {
        const data = await availableRes.json();
        setAvailableIntegrations(data.integrations || []);
      }

      if (connectedRes.ok) {
        const data = await connectedRes.json();
        setConnectedIntegrations(data.integrations || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async (type, provider = null) => {
    setConnectingType(type);
    try {
      const url = provider
        ? `/api/integrations/${type}/auth?provider=${provider}`
        : `/api/integrations/${type}/auth`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Failed to get authorization URL');
      }

      const data = await res.json();
      window.location.href = data.authUrl;
    } catch (err) {
      setError(err.message);
      setConnectingType(null);
    }
  };

  const handleDisconnect = async (integrationId) => {
    if (!window.confirm(t('integrations.disconnectConfirm'))) {
      return;
    }

    try {
      const res = await fetch(`/api/integrations/${integrationId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Failed to disconnect');
      }

      setConnectedIntegrations(prev => prev.filter(i => i.id !== integrationId));
      setSuccessMessage(t('integrations.disconnected'));
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleTest = async (integrationId) => {
    setTestingId(integrationId);
    try {
      const res = await fetch(`/api/integrations/${integrationId}/test`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();

      if (data.success) {
        setSuccessMessage(t('integrations.testSuccess'));
        // Update status
        setConnectedIntegrations(prev =>
          prev.map(i => i.id === integrationId ? { ...i, status: 'connected' } : i)
        );
      } else {
        setError(data.result?.error || t('integrations.testFailed'));
        setConnectedIntegrations(prev =>
          prev.map(i => i.id === integrationId ? { ...i, status: 'error' } : i)
        );
      }

      setTimeout(() => {
        setSuccessMessage(null);
        setError(null);
      }, 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setTestingId(null);
    }
  };

  const isConnected = (type) => {
    return connectedIntegrations.some(i => i.type === type);
  };

  const getConnectedIntegration = (type) => {
    return connectedIntegrations.find(i => i.type === type);
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '4px solid #e9ecef', borderTopColor: '#667eea', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }}></div>
          <p style={{ color: '#6c757d' }}>{t('common.loading')}</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa', padding: '32px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1a1a2e', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '32px' }}>🔗</span>
            {t('integrations.title', 'Integrations')}
          </h1>
          <p style={{ color: '#6c757d', margin: 0 }}>
            {t('integrations.subtitle', 'Connect external services to supercharge your agents')}
          </p>
        </div>

        {/* Alerts */}
        {successMessage && (
          <div style={{
            padding: '16px 20px',
            background: '#d4edda',
            color: '#155724',
            borderRadius: '12px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span>✅</span>
            {successMessage}
          </div>
        )}

        {error && (
          <div style={{
            padding: '16px 20px',
            background: '#f8d7da',
            color: '#721c24',
            borderRadius: '12px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span>❌</span>
            {error}
          </div>
        )}

        {/* Connected Integrations */}
        {connectedIntegrations.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1a1a2e', marginBottom: '16px' }}>
              {t('integrations.connected', 'Connected')} ({connectedIntegrations.length})
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {connectedIntegrations.map(integration => (
                <div key={integration.id} style={{
                  background: 'white',
                  borderRadius: '16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  padding: '20px',
                  border: '2px solid #48bb78'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: '#f0f4ff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px'
                      }}>
                        {integrationIcons[integration.type] || '🔌'}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1a1a2e' }}>
                          {integration.name}
                        </h3>
                        <span style={{ fontSize: '12px', color: '#6c757d' }}>{integration.type}</span>
                      </div>
                    </div>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '600',
                      background: statusColors[integration.status]?.bg || '#e9ecef',
                      color: statusColors[integration.status]?.color || '#495057'
                    }}>
                      {integration.status}
                    </span>
                  </div>

                  {integration.metadata?.email && (
                    <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#6c757d' }}>
                      📧 {integration.metadata.email}
                    </p>
                  )}

                  {integration.last_sync_at && (
                    <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#adb5bd' }}>
                      {t('integrations.lastSync')}: {new Date(integration.last_sync_at).toLocaleString()}
                    </p>
                  )}

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleTest(integration.id)}
                      disabled={testingId === integration.id}
                      style={{
                        flex: 1,
                        padding: '10px',
                        background: testingId === integration.id ? '#a0aec0' : '#e3f2fd',
                        color: '#1565c0',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: testingId === integration.id ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        fontWeight: '500'
                      }}
                    >
                      {testingId === integration.id ? '...' : '🔄'} {t('integrations.test', 'Test')}
                    </button>
                    <button
                      onClick={() => handleDisconnect(integration.id)}
                      style={{
                        padding: '10px 16px',
                        background: '#ffebee',
                        color: '#c62828',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500'
                      }}
                    >
                      {t('integrations.disconnect', 'Disconnect')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available Integrations */}
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1a1a2e', marginBottom: '16px' }}>
            {t('integrations.available', 'Available Integrations')}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {availableIntegrations.map(integration => {
              const connected = isConnected(integration.type);
              const connectedData = getConnectedIntegration(integration.type);

              return (
                <div key={integration.type} style={{
                  background: 'white',
                  borderRadius: '16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  padding: '24px',
                  opacity: connected ? 0.7 : 1
                }}>
                  {/* Icon & Title */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                    <div style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '14px',
                      background: 'linear-gradient(135deg, #667eea20 0%, #764ba220 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '28px'
                    }}>
                      {integration.icon}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#1a1a2e' }}>
                        {integration.name}
                      </h3>
                      <span style={{
                        padding: '2px 8px',
                        background: '#f0f0f0',
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: '#6c757d',
                        textTransform: 'uppercase'
                      }}>
                        {integration.category}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#6c757d', lineHeight: '1.5' }}>
                    {integration.description}
                  </p>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px' }}>
                    {integration.actions?.slice(0, 4).map(action => (
                      <span key={action.name} style={{
                        padding: '4px 8px',
                        background: '#e8f5e9',
                        color: '#2e7d32',
                        borderRadius: '4px',
                        fontSize: '11px'
                      }}>
                        {action.name.replace(/_/g, ' ')}
                      </span>
                    ))}
                    {integration.actions?.length > 4 && (
                      <span style={{ padding: '4px 8px', color: '#6c757d', fontSize: '11px' }}>
                        +{integration.actions.length - 4}
                      </span>
                    )}
                  </div>

                  {/* Connect Button */}
                  {integration.providers ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {integration.providers.map(provider => (
                        <button
                          key={provider}
                          onClick={() => handleConnect(integration.type, provider)}
                          disabled={connected || connectingType === integration.type}
                          style={{
                            flex: 1,
                            padding: '12px',
                            background: connected ? '#e9ecef' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: connected ? '#6c757d' : 'white',
                            border: 'none',
                            borderRadius: '10px',
                            cursor: connected ? 'default' : 'pointer',
                            fontSize: '13px',
                            fontWeight: '600',
                            textTransform: 'capitalize'
                          }}
                        >
                          {connected ? '✓ Connected' : provider}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleConnect(integration.type)}
                      disabled={connected || connectingType === integration.type}
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: connected ? '#e9ecef' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: connected ? '#6c757d' : 'white',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: connected ? 'default' : 'pointer',
                        fontSize: '14px',
                        fontWeight: '600'
                      }}
                    >
                      {connectingType === integration.type ? (
                        t('integrations.connecting', 'Connecting...')
                      ) : connected ? (
                        `✓ ${t('integrations.alreadyConnected', 'Already Connected')}`
                      ) : (
                        t('integrations.connect', 'Connect')
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Integrations;
