import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ChatWidget from './ChatWidget';

const POSITION_OPTIONS = [
  { value: 'right', label: 'Right' },
  { value: 'left', label: 'Left' }
];

const SIZE_OPTIONS = [
  { value: 'small', label: 'Small', desc: '320x400' },
  { value: 'medium', label: 'Medium', desc: '380x500' },
  { value: 'large', label: 'Large', desc: '420x600' }
];

const COLOR_PRESETS = [
  '#8b5cf6', // Purple
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#ec4899', // Pink
  '#6366f1', // Indigo
  '#14b8a6'  // Teal
];

export default function WidgetCustomizer({ botId, initialConfig = {}, onSave, apiUrl }) {
  const { t } = useTranslation();
  const [config, setConfig] = useState({
    primaryColor: initialConfig.primaryColor || '#8b5cf6',
    position: initialConfig.position || 'right',
    size: initialConfig.size || 'medium',
    welcomeMessage: initialConfig.welcomeMessage || 'Hello! How can I help you today?',
    botName: initialConfig.botName || 'Assistant',
    botAvatar: initialConfig.botAvatar || '🤖',
    placeholder: initialConfig.placeholder || 'Type a message...',
    offlineMessage: initialConfig.offlineMessage || 'We are currently offline. Leave a message!'
  });

  const [showPreview, setShowPreview] = useState(true);
  const [copied, setCopied] = useState(false);

  const updateConfig = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const generateEmbedCode = () => {
    const serverUrl = apiUrl || window.location.origin;
    return `<!-- BotBuilder Chat Widget -->
<script>
  (function(w,d,s,o,f,js,fjs){
    w['BotBuilderWidget']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s);fjs=d.getElementsByTagName(s)[0];
    js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','bbWidget','${serverUrl}/widget.js'));
  bbWidget('init', {
    botId: '${botId}',
    primaryColor: '${config.primaryColor}',
    position: '${config.position}',
    size: '${config.size}',
    welcomeMessage: '${config.welcomeMessage}',
    botName: '${config.botName}',
    botAvatar: '${config.botAvatar}'
  });
</script>`;
  };

  const copyEmbedCode = () => {
    navigator.clipboard.writeText(generateEmbedCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (onSave) {
      onSave(config);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '24px', height: '100%' }}>
      {/* Customization Panel */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: '600' }}>
            {t('widget.customization', 'Widget Customization')}
          </h3>

          {/* Primary Color */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
              {t('widget.primaryColor', 'Primary Color')}
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
              {COLOR_PRESETS.map(color => (
                <button
                  key={color}
                  onClick={() => updateConfig('primaryColor', color)}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: color,
                    border: config.primaryColor === color ? '3px solid #1f2937' : '2px solid transparent',
                    cursor: 'pointer',
                    transition: 'transform 0.2s'
                  }}
                />
              ))}
            </div>
            <input
              type="color"
              value={config.primaryColor}
              onChange={(e) => updateConfig('primaryColor', e.target.value)}
              style={{ width: '100%', height: '40px', borderRadius: '8px', cursor: 'pointer' }}
            />
          </div>

          {/* Position */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
              {t('widget.position', 'Widget Position')}
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              {POSITION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => updateConfig('position', opt.value)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    border: config.position === opt.value ? `2px solid ${config.primaryColor}` : '2px solid #e5e7eb',
                    backgroundColor: config.position === opt.value ? `${config.primaryColor}10` : 'white',
                    cursor: 'pointer',
                    fontWeight: '500',
                    transition: 'all 0.2s'
                  }}
                >
                  {opt.value === 'left' ? '← ' : ''}{opt.label}{opt.value === 'right' ? ' →' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Size */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
              {t('widget.size', 'Widget Size')}
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              {SIZE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => updateConfig('size', opt.value)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    border: config.size === opt.value ? `2px solid ${config.primaryColor}` : '2px solid #e5e7eb',
                    backgroundColor: config.size === opt.value ? `${config.primaryColor}10` : 'white',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ fontWeight: '500' }}>{opt.label}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Bot Name */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
              {t('widget.botName', 'Bot Name')}
            </label>
            <input
              type="text"
              value={config.botName}
              onChange={(e) => updateConfig('botName', e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                fontSize: '14px'
              }}
            />
          </div>

          {/* Bot Avatar */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
              {t('widget.botAvatar', 'Bot Avatar')}
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['🤖', '💬', '🎯', '⚡', '🌟', '🔮', '🚀', '💡'].map(emoji => (
                <button
                  key={emoji}
                  onClick={() => updateConfig('botAvatar', emoji)}
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '8px',
                    border: config.botAvatar === emoji ? `2px solid ${config.primaryColor}` : '2px solid #e5e7eb',
                    backgroundColor: config.botAvatar === emoji ? `${config.primaryColor}10` : 'white',
                    cursor: 'pointer',
                    fontSize: '20px'
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Welcome Message */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
              {t('widget.welcomeMessage', 'Welcome Message')}
            </label>
            <textarea
              value={config.welcomeMessage}
              onChange={(e) => updateConfig('welcomeMessage', e.target.value)}
              rows={3}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Placeholder */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
              {t('widget.placeholder', 'Input Placeholder')}
            </label>
            <input
              type="text"
              value={config.placeholder}
              onChange={(e) => updateConfig('placeholder', e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                fontSize: '14px'
              }}
            />
          </div>

          {/* Offline Message */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
              {t('widget.offlineMessage', 'Offline Message')}
            </label>
            <textarea
              value={config.offlineMessage}
              onChange={(e) => updateConfig('offlineMessage', e.target.value)}
              rows={2}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: config.primaryColor,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              marginBottom: '20px'
            }}
          >
            {t('widget.saveSettings', 'Save Settings')}
          </button>

          {/* Embed Code */}
          <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <label style={{ fontWeight: '600', fontSize: '16px' }}>
                {t('widget.embedCode', 'Embed Code')}
              </label>
              <button
                onClick={copyEmbedCode}
                style={{
                  padding: '8px 16px',
                  backgroundColor: copied ? '#10b981' : '#f3f4f6',
                  color: copied ? 'white' : '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                {copied ? '✓ Copied!' : '📋 Copy'}
              </button>
            </div>
            <pre
              style={{
                backgroundColor: '#1f2937',
                color: '#e5e7eb',
                padding: '16px',
                borderRadius: '8px',
                fontSize: '12px',
                overflow: 'auto',
                maxHeight: '200px'
              }}
            >
              {generateEmbedCode()}
            </pre>
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
              {t('widget.embedInstructions', 'Add this code before the closing </body> tag on your website.')}
            </p>
          </div>
        </div>
      </div>

      {/* Preview Panel */}
      <div style={{ width: '450px', flexShrink: 0 }}>
        <div style={{
          backgroundColor: '#f3f4f6',
          borderRadius: '12px',
          padding: '24px',
          height: '100%',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
              {t('widget.preview', 'Preview')}
            </h3>
            <button
              onClick={() => setShowPreview(!showPreview)}
              style={{
                padding: '6px 12px',
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              {showPreview ? '👁 Hide' : '👁 Show'}
            </button>
          </div>

          {/* Mock Website */}
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              height: 'calc(100% - 60px)',
              position: 'relative',
              overflow: 'hidden',
              border: '1px solid #e5e7eb'
            }}
          >
            {/* Mock Header */}
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#f9fafb',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              gap: '8px'
            }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10b981' }} />
              <div style={{ flex: 1, marginLeft: '12px', height: '20px', backgroundColor: '#e5e7eb', borderRadius: '4px' }} />
            </div>

            {/* Mock Content */}
            <div style={{ padding: '20px' }}>
              <div style={{ height: '20px', backgroundColor: '#e5e7eb', borderRadius: '4px', marginBottom: '12px', width: '60%' }} />
              <div style={{ height: '12px', backgroundColor: '#f3f4f6', borderRadius: '4px', marginBottom: '8px' }} />
              <div style={{ height: '12px', backgroundColor: '#f3f4f6', borderRadius: '4px', marginBottom: '8px', width: '80%' }} />
              <div style={{ height: '12px', backgroundColor: '#f3f4f6', borderRadius: '4px', width: '90%' }} />
            </div>

            {/* Widget Preview */}
            {showPreview && (
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, top: 0, pointerEvents: 'none' }}>
                <div style={{ pointerEvents: 'auto' }}>
                  <ChatWidget botId={botId} config={config} apiUrl={apiUrl} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
