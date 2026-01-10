import React, { useState, useEffect } from 'react';

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto'
  },
  header: {
    marginBottom: '32px'
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: '8px'
  },
  subtitle: {
    color: '#6b7280',
    fontSize: '16px',
    lineHeight: '1.5'
  },
  sdkGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '24px',
    marginBottom: '48px'
  },
  sdkCard: {
    background: '#fff',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e5e7eb',
    transition: 'all 0.2s ease'
  },
  sdkCardHover: {
    transform: 'translateY(-4px)',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)'
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '16px'
  },
  iconWrapper: {
    width: '56px',
    height: '56px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    fontWeight: '700'
  },
  jsIcon: {
    background: 'linear-gradient(135deg, #f7df1e 0%, #e6cc00 100%)',
    color: '#000'
  },
  pythonIcon: {
    background: 'linear-gradient(135deg, #3776ab 0%, #ffd43b 100%)',
    color: '#fff'
  },
  phpIcon: {
    background: 'linear-gradient(135deg, #777bb4 0%, #4f5b93 100%)',
    color: '#fff'
  },
  goIcon: {
    background: 'linear-gradient(135deg, #00add8 0%, #007d9c 100%)',
    color: '#fff'
  },
  rubyIcon: {
    background: 'linear-gradient(135deg, #cc342d 0%, #a91b0d 100%)',
    color: '#fff'
  },
  langName: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  langVersion: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '2px'
  },
  installSection: {
    background: '#1a1a2e',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '16px',
    position: 'relative'
  },
  installLabel: {
    fontSize: '11px',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '4px'
  },
  installCommand: {
    fontFamily: 'monospace',
    fontSize: '14px',
    color: '#10b981',
    wordBreak: 'break-all'
  },
  copyButton: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    background: 'rgba(255,255,255,0.1)',
    border: 'none',
    borderRadius: '4px',
    padding: '4px 8px',
    color: '#9ca3af',
    cursor: 'pointer',
    fontSize: '12px'
  },
  featuresRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginBottom: '16px'
  },
  featureBadge: {
    padding: '4px 10px',
    background: '#f3f4f6',
    borderRadius: '12px',
    fontSize: '11px',
    color: '#374151'
  },
  buttonGroup: {
    display: 'flex',
    gap: '8px'
  },
  downloadButton: {
    flex: 1,
    padding: '12px 16px',
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s'
  },
  docsButton: {
    padding: '12px 16px',
    background: '#f3f4f6',
    color: '#374151',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  exampleSection: {
    marginTop: '48px'
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: '16px'
  },
  tabsContainer: {
    display: 'flex',
    borderBottom: '2px solid #e5e7eb',
    marginBottom: '16px'
  },
  tab: {
    padding: '12px 20px',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    marginBottom: '-2px',
    color: '#6b7280',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  tabActive: {
    color: '#3b82f6',
    borderBottomColor: '#3b82f6'
  },
  codeBlock: {
    background: '#1a1a2e',
    borderRadius: '12px',
    padding: '20px',
    overflow: 'auto',
    maxHeight: '400px'
  },
  code: {
    fontFamily: 'monospace',
    fontSize: '13px',
    color: '#e5e7eb',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap'
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '48px',
    color: '#6b7280'
  },
  downloadingOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  downloadingModal: {
    background: '#fff',
    borderRadius: '16px',
    padding: '32px',
    textAlign: 'center',
    maxWidth: '400px'
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '4px solid #e5e7eb',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 16px'
  }
};

const SDKDownload = () => {
  const [languages, setLanguages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);
  const [activeTab, setActiveTab] = useState('javascript');
  const [examples, setExamples] = useState({});
  const [hoveredCard, setHoveredCard] = useState(null);
  const [copied, setCopied] = useState(null);

  const iconStyles = {
    javascript: styles.jsIcon,
    python: styles.pythonIcon,
    php: styles.phpIcon,
    go: styles.goIcon,
    ruby: styles.rubyIcon
  };

  const iconText = {
    javascript: 'JS',
    python: 'Py',
    php: 'PHP',
    go: 'Go',
    ruby: 'Rb'
  };

  useEffect(() => {
    fetchLanguages();
  }, []);

  useEffect(() => {
    if (activeTab && !examples[activeTab]) {
      fetchExample(activeTab);
    }
  }, [activeTab]);

  const fetchLanguages = async () => {
    try {
      const response = await fetch('/api/sdk/languages');
      if (response.ok) {
        const data = await response.json();
        setLanguages(data.languages || []);
      }
    } catch (error) {
      console.error('Error fetching languages:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExample = async (language) => {
    try {
      const response = await fetch(`/api/sdk/example/${language}`);
      if (response.ok) {
        const data = await response.json();
        setExamples(prev => ({ ...prev, [language]: data.example }));
      }
    } catch (error) {
      console.error('Error fetching example:', error);
    }
  };

  const handleDownload = async (language) => {
    try {
      setDownloading(language);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/sdk/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ language })
      });

      if (response.ok) {
        const data = await response.json();
        // Trigger download
        window.location.href = data.data.downloadUrl;
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to generate SDK');
      }
    } catch (error) {
      console.error('Error downloading SDK:', error);
      alert('Failed to download SDK');
    } finally {
      setDownloading(null);
    }
  };

  const handleCopy = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading SDKs...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Add CSS animation for spinner */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Downloading Overlay */}
      {downloading && (
        <div style={styles.downloadingOverlay}>
          <div style={styles.downloadingModal}>
            <div style={styles.spinner} />
            <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
              Generating SDK
            </div>
            <div style={{ color: '#6b7280' }}>
              Please wait while we prepare your {downloading} SDK...
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>SDK Downloads</h1>
        <p style={styles.subtitle}>
          Download official SDKs to integrate BotBuilder into your applications.
          All SDKs include full API coverage, type definitions, and comprehensive documentation.
        </p>
      </div>

      {/* SDK Cards Grid */}
      <div style={styles.sdkGrid}>
        {languages.map((lang) => (
          <div
            key={lang.id}
            style={{
              ...styles.sdkCard,
              ...(hoveredCard === lang.id ? styles.sdkCardHover : {})
            }}
            onMouseEnter={() => setHoveredCard(lang.id)}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div style={styles.cardHeader}>
              <div style={{ ...styles.iconWrapper, ...iconStyles[lang.id] }}>
                {iconText[lang.id]}
              </div>
              <div>
                <div style={styles.langName}>{lang.name}</div>
                <div style={styles.langVersion}>v1.0.0</div>
              </div>
            </div>

            <div style={styles.installSection}>
              <div style={styles.installLabel}>Install</div>
              <div style={styles.installCommand}>{lang.installCommand}</div>
              <button
                style={styles.copyButton}
                onClick={() => handleCopy(lang.installCommand, lang.id)}
              >
                {copied === lang.id ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <div style={styles.featuresRow}>
              <span style={styles.featureBadge}>Full API</span>
              <span style={styles.featureBadge}>Types</span>
              <span style={styles.featureBadge}>Async</span>
              <span style={styles.featureBadge}>Retries</span>
            </div>

            <div style={styles.buttonGroup}>
              <button
                style={styles.downloadButton}
                onClick={() => handleDownload(lang.id)}
                disabled={downloading}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download SDK
              </button>
              <button
                style={styles.docsButton}
                onClick={() => setActiveTab(lang.id)}
              >
                Docs
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Start Examples */}
      <div style={styles.exampleSection}>
        <h2 style={styles.sectionTitle}>Quick Start Examples</h2>

        <div style={styles.tabsContainer}>
          {languages.map((lang) => (
            <button
              key={lang.id}
              style={{
                ...styles.tab,
                ...(activeTab === lang.id ? styles.tabActive : {})
              }}
              onClick={() => setActiveTab(lang.id)}
            >
              {lang.name}
            </button>
          ))}
        </div>

        <div style={styles.codeBlock}>
          <pre style={styles.code}>
            {examples[activeTab] || 'Loading example...'}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default SDKDownload;
