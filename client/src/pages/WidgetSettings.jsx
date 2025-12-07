import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WidgetCustomizer } from '../components/widget';
import { useNotification } from '../contexts/NotificationContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function WidgetSettings() {
  const { botId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { success, error } = useNotification();

  const [bot, setBot] = useState(null);
  const [widgetConfig, setWidgetConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  const getToken = () => localStorage.getItem('token');

  useEffect(() => {
    fetchBotAndConfig();
  }, [botId]);

  const fetchBotAndConfig = async () => {
    try {
      setLoading(true);

      // Fetch bot details
      const botRes = await fetch(`${API_URL}/api/bots/${botId}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });

      if (botRes.ok) {
        const botData = await botRes.json();
        setBot(botData);
      }

      // Fetch widget config
      const configRes = await fetch(`${API_URL}/api/widget/${botId}/config`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });

      if (configRes.ok) {
        const configData = await configRes.json();
        setWidgetConfig(configData.config || {});
      } else {
        setWidgetConfig({});
      }
    } catch (err) {
      error(t('widget.loadError', 'Failed to load widget settings'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (config) => {
    try {
      const res = await fetch(`${API_URL}/api/widget/${botId}/config`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ config })
      });

      if (res.ok) {
        success(t('widget.saveSuccess', 'Widget settings saved successfully'));
        setWidgetConfig(config);
      } else {
        throw new Error('Failed to save');
      }
    } catch (err) {
      error(t('widget.saveError', 'Failed to save widget settings'));
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>💬</div>
          <div>{t('common.loading', 'Loading...')}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f3f4f6'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '20px',
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            ←
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '28px' }}>💬</span>
              {t('widget.title', 'Web Widget')}
            </h1>
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '14px' }}>
              {bot?.name ? `${t('widget.forBot', 'For bot')}: ${bot.name}` : t('widget.subtitle', 'Configure your embeddable chat widget')}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ padding: '24px 32px', height: 'calc(100vh - 81px)' }}>
        <WidgetCustomizer
          botId={botId}
          initialConfig={widgetConfig}
          onSave={handleSave}
          apiUrl={API_URL}
        />
      </div>
    </div>
  );
}
