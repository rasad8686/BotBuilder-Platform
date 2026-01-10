import React, { useState } from 'react';
import { Copy, Check, Code, Link, ExternalLink } from 'lucide-react';

export default function SurveyEmbedCode({
  surveyId,
  surveyTitle,
  apiUrl,
  primaryColor = '#8b5cf6'
}) {
  const [activeTab, setActiveTab] = useState('embed');
  const [copied, setCopied] = useState(false);

  const baseUrl = apiUrl || window.location.origin;
  const publicUrl = `${baseUrl}/survey/${surveyId}/public`;

  // Generate embed code
  const embedCode = `<!-- ${surveyTitle || 'Survey'} Widget -->
<div id="survey-widget-${surveyId}"></div>
<script src="${baseUrl}/survey-widget.js"></script>
<script>
  SurveyWidget.init({
    surveyId: '${surveyId}',
    containerId: 'survey-widget-${surveyId}',
    apiUrl: '${baseUrl}',
    config: {
      primaryColor: '${primaryColor}',
      position: 'center'
    }
  });
</script>`;

  // Generate iframe code
  const iframeCode = `<iframe
  src="${publicUrl}"
  width="100%"
  height="600"
  frameborder="0"
  style="border: none; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);"
  title="${surveyTitle || 'Survey'}"
></iframe>`;

  // Generate popup trigger code
  const popupCode = `<!-- Survey Popup Trigger -->
<script src="${baseUrl}/survey-widget.js"></script>
<script>
  // Show survey popup on button click
  document.getElementById('show-survey-btn').addEventListener('click', function() {
    SurveyWidget.showPopup({
      surveyId: '${surveyId}',
      apiUrl: '${baseUrl}',
      config: {
        primaryColor: '${primaryColor}'
      }
    });
  });
</script>

<!-- Trigger Button (customize as needed) -->
<button id="show-survey-btn" style="
  padding: 12px 24px;
  background: ${primaryColor};
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
">
  Fikrinizi Bildirin
</button>`;

  const getActiveCode = () => {
    switch (activeTab) {
      case 'iframe':
        return iframeCode;
      case 'popup':
        return popupCode;
      case 'link':
        return publicUrl;
      default:
        return embedCode;
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getActiveCode());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const tabs = [
    { id: 'embed', label: 'Widget', icon: Code },
    { id: 'iframe', label: 'iFrame', icon: Code },
    { id: 'popup', label: 'Popup', icon: ExternalLink },
    { id: 'link', label: 'Link', icon: Link }
  ];

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        overflow: 'hidden'
      }}
    >
      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb'
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: '12px 16px',
                border: 'none',
                backgroundColor: isActive ? '#ffffff' : 'transparent',
                borderBottom: isActive ? `2px solid ${primaryColor}` : '2px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: isActive ? '500' : '400',
                color: isActive ? primaryColor : '#6b7280',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Code Display */}
      <div style={{ position: 'relative' }}>
        {activeTab === 'link' ? (
          <div style={{ padding: '20px' }}>
            <div
              style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'center'
              }}
            >
              <input
                type="text"
                value={publicUrl}
                readOnly
                style={{
                  flex: 1,
                  padding: '12px 14px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: '#f9fafb'
                }}
              />
              <button
                onClick={handleCopy}
                style={{
                  padding: '12px 20px',
                  backgroundColor: primaryColor,
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Kopyalandi!' : 'Kopyala'}
              </button>
            </div>
            <div style={{ marginTop: '12px' }}>
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: primaryColor,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <ExternalLink size={14} />
                Yeni pencerede ac
              </a>
            </div>
          </div>
        ) : (
          <>
            <pre
              style={{
                margin: 0,
                padding: '20px',
                backgroundColor: '#1f2937',
                color: '#e5e7eb',
                fontSize: '12px',
                lineHeight: '1.6',
                overflow: 'auto',
                maxHeight: '300px'
              }}
            >
              <code>{getActiveCode()}</code>
            </pre>
            <button
              onClick={handleCopy}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                padding: '8px 14px',
                backgroundColor: copied ? '#22c55e' : 'rgba(255,255,255,0.1)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                transition: 'all 0.15s ease'
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Kopyalandi!' : 'Kopyala'}
            </button>
          </>
        )}
      </div>

      {/* Instructions */}
      <div
        style={{
          padding: '16px 20px',
          backgroundColor: '#f9fafb',
          borderTop: '1px solid #e5e7eb',
          fontSize: '13px',
          color: '#6b7280'
        }}
      >
        {activeTab === 'embed' && (
          <p style={{ margin: 0 }}>
            Bu kodu saytinizin istediyi yerine yapisdirin. Widget avtomatik yuklenecek.
          </p>
        )}
        {activeTab === 'iframe' && (
          <p style={{ margin: 0 }}>
            iFrame kodu survey-i istediyi sehifede gosterecek. Olculeri deyise bilersiniz.
          </p>
        )}
        {activeTab === 'popup' && (
          <p style={{ margin: 0 }}>
            Popup kodu istifadeci tikladiginda survey-i modal penceresinde acir.
          </p>
        )}
        {activeTab === 'link' && (
          <p style={{ margin: 0 }}>
            Bu linki paylasaraq istifadecileri survey sehifesine yonlendire bilersiniz.
          </p>
        )}
      </div>
    </div>
  );
}
