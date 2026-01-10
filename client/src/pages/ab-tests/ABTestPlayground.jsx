/**
 * A/B Test Playground
 * Test and demo page for A/B Test SDK
 */

import React, { useState, useEffect, useRef } from 'react';
import ABTestSDK from '../../sdk/ab-tests/ABTestSDK';

const ABTestPlayground = () => {
  const [logs, setLogs] = useState([]);
  const [sdkState, setSdkState] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const [testResults, setTestResults] = useState({});
  const [selectedTest, setSelectedTest] = useState('');
  const [activeTests, setActiveTests] = useState([]);
  const logsEndRef = useRef(null);

  // Add log
  const addLog = (type, message, data = null) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev.slice(-99), { timestamp, type, message, data }]);
  };

  // Initialize SDK
  const handleInit = () => {
    try {
      ABTestSDK.init({
        workspaceId: 'ws_playground_test',
        userId: 'user_test_123',
        apiUrl: window.location.origin,
        debug: true,
      });

      // Listen to SDK events
      ABTestSDK.on('variant:assigned', (data) => {
        addLog('success', 'Variant assigned', data);
      });

      ABTestSDK.on('conversion:tracked', (data) => {
        addLog('success', 'Conversion tracked', data);
      });

      ABTestSDK.on('error', (data) => {
        addLog('error', 'SDK Error', data);
      });

      setInitialized(true);
      setSdkState(ABTestSDK.getState());
      addLog('success', 'SDK initialized');
    } catch (error) {
      addLog('error', 'Init failed', { message: error.message });
    }
  };

  // Identify user
  const handleIdentify = () => {
    if (!initialized) {
      addLog('warning', 'SDK not initialized');
      return;
    }

    ABTestSDK.identify('user_premium_123', {
      plan: 'premium',
      signupDate: '2024-01-15',
      country: 'AZ',
    });

    setSdkState(ABTestSDK.getState());
    addLog('info', 'User identified with traits');
  };

  // Get variant
  const handleGetVariant = async (testId) => {
    if (!initialized) {
      addLog('warning', 'SDK not initialized');
      return;
    }

    try {
      addLog('info', `Fetching variant for ${testId}...`);
      const variant = await mockGetVariant(testId);

      setTestResults((prev) => ({
        ...prev,
        [testId]: variant,
      }));

      addLog('success', `Got variant: ${variant.variantName}`, variant);
    } catch (error) {
      addLog('error', 'Failed to get variant', { message: error.message });
    }
  };

  // Track conversion
  const handleTrackConversion = async (testId, type = 'goal') => {
    if (!initialized) {
      addLog('warning', 'SDK not initialized');
      return;
    }

    try {
      addLog('info', `Tracking ${type} conversion for ${testId}...`);
      // Mock conversion tracking
      await new Promise((resolve) => setTimeout(resolve, 300));
      addLog('success', `Conversion tracked: ${type}`, { testId, type });
    } catch (error) {
      addLog('error', 'Failed to track conversion', { message: error.message });
    }
  };

  // Clear logs
  const clearLogs = () => setLogs([]);

  // Mock get variant (simulates API response)
  const mockGetVariant = async (testId) => {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const variants = {
      button_color_test: [
        { variantId: 'var_1', variantName: 'A', content: { color: '#3B82F6', text: 'Get Started' } },
        { variantId: 'var_2', variantName: 'B', content: { color: '#10B981', text: 'Start Free Trial' } },
      ],
      hero_text_test: [
        { variantId: 'var_3', variantName: 'A', content: { title: 'Build Better Products', subtitle: 'Start your journey today' } },
        { variantId: 'var_4', variantName: 'B', content: { title: 'Ship Faster, Grow Faster', subtitle: 'Join 10,000+ teams' } },
      ],
      pricing_test: [
        { variantId: 'var_5', variantName: 'A', content: { price: 29, period: 'month', highlight: false } },
        { variantId: 'var_6', variantName: 'B', content: { price: 290, period: 'year', highlight: true, savings: 'Save 17%' } },
      ],
    };

    const testVariants = variants[testId] || [
      { variantId: 'var_default', variantName: 'control', content: {} },
    ];

    const selected = testVariants[Math.floor(Math.random() * testVariants.length)];
    return { testId, ...selected, assignedAt: new Date().toISOString() };
  };

  // Demo tests
  const demoTests = [
    { id: 'button_color_test', name: 'Button Color Test', description: 'Test different CTA button colors and text' },
    { id: 'hero_text_test', name: 'Hero Text Test', description: 'Test different hero section messaging' },
    { id: 'pricing_test', name: 'Pricing Display Test', description: 'Test monthly vs annual pricing display' },
  ];

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.title}>A/B Test SDK Playground</h1>
        <p style={styles.subtitle}>Test and explore the A/B Testing SDK features</p>
      </header>

      {/* Control Panel */}
      <div style={styles.panel}>
        <h3 style={styles.panelTitle}>SDK Controls</h3>
        <div style={styles.buttonGroup}>
          <button
            onClick={handleInit}
            disabled={initialized}
            style={{
              ...styles.button,
              ...styles.primaryButton,
              ...(initialized && styles.disabledButton),
            }}
          >
            {initialized ? 'Initialized' : 'Initialize SDK'}
          </button>
          <button
            onClick={handleIdentify}
            disabled={!initialized}
            style={{
              ...styles.button,
              ...styles.secondaryButton,
              ...(!initialized && styles.disabledButton),
            }}
          >
            Identify User
          </button>
          <button
            onClick={() => {
              ABTestSDK.clearAssignments();
              setTestResults({});
              addLog('info', 'Assignments cleared');
            }}
            disabled={!initialized}
            style={{
              ...styles.button,
              ...styles.dangerButton,
              ...(!initialized && styles.disabledButton),
            }}
          >
            Clear Cache
          </button>
        </div>
      </div>

      {/* Demo Tests */}
      <div style={styles.panel}>
        <h3 style={styles.panelTitle}>Demo A/B Tests</h3>
        <div style={styles.testGrid}>
          {demoTests.map((test) => (
            <div key={test.id} style={styles.testCard}>
              <h4 style={styles.testName}>{test.name}</h4>
              <p style={styles.testDescription}>{test.description}</p>

              {testResults[test.id] ? (
                <div style={styles.variantResult}>
                  <span style={styles.variantBadge}>
                    Variant: {testResults[test.id].variantName}
                  </span>
                  <pre style={styles.variantContent}>
                    {JSON.stringify(testResults[test.id].content, null, 2)}
                  </pre>
                </div>
              ) : (
                <p style={styles.noVariant}>No variant assigned yet</p>
              )}

              <div style={styles.testActions}>
                <button
                  onClick={() => handleGetVariant(test.id)}
                  disabled={!initialized}
                  style={{
                    ...styles.button,
                    ...styles.smallButton,
                    ...styles.primaryButton,
                  }}
                >
                  Get Variant
                </button>
                <button
                  onClick={() => handleTrackConversion(test.id, 'click')}
                  disabled={!initialized || !testResults[test.id]}
                  style={{
                    ...styles.button,
                    ...styles.smallButton,
                    ...styles.successButton,
                  }}
                >
                  Track Click
                </button>
                <button
                  onClick={() => handleTrackConversion(test.id, 'conversion')}
                  disabled={!initialized || !testResults[test.id]}
                  style={{
                    ...styles.button,
                    ...styles.smallButton,
                    ...styles.successButton,
                  }}
                >
                  Track Goal
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Preview */}
      <div style={styles.panel}>
        <h3 style={styles.panelTitle}>Live Preview</h3>
        <div style={styles.previewContainer}>
          {/* Button Preview */}
          <div style={styles.previewSection}>
            <h4 style={styles.previewLabel}>Button Variant</h4>
            <button
              style={{
                ...styles.previewButton,
                backgroundColor: testResults.button_color_test?.content?.color || '#6B7280',
              }}
            >
              {testResults.button_color_test?.content?.text || 'Click Me'}
            </button>
          </div>

          {/* Hero Preview */}
          <div style={styles.previewSection}>
            <h4 style={styles.previewLabel}>Hero Variant</h4>
            <div style={styles.heroPreview}>
              <h2 style={styles.heroTitle}>
                {testResults.hero_text_test?.content?.title || 'Welcome to Our Platform'}
              </h2>
              <p style={styles.heroSubtitle}>
                {testResults.hero_text_test?.content?.subtitle || 'Get started today'}
              </p>
            </div>
          </div>

          {/* Pricing Preview */}
          <div style={styles.previewSection}>
            <h4 style={styles.previewLabel}>Pricing Variant</h4>
            <div style={{
              ...styles.pricingPreview,
              ...(testResults.pricing_test?.content?.highlight && styles.pricingHighlight),
            }}>
              <span style={styles.priceCurrency}>$</span>
              <span style={styles.priceAmount}>
                {testResults.pricing_test?.content?.price || 29}
              </span>
              <span style={styles.pricePeriod}>
                /{testResults.pricing_test?.content?.period || 'month'}
              </span>
              {testResults.pricing_test?.content?.savings && (
                <span style={styles.priceSavings}>
                  {testResults.pricing_test.content.savings}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Code Examples */}
      <div style={styles.panel}>
        <h3 style={styles.panelTitle}>Code Examples</h3>
        <div style={styles.codeContainer}>
          <h4 style={styles.codeTitle}>React Hook Usage</h4>
          <pre style={styles.codeBlock}>
{`import { useABTest } from '@botbuilder/ab-tests';

function MyComponent() {
  const { variant, loading, trackConversion } = useABTest('button_color_test');

  if (loading) return <Spinner />;

  return (
    <button
      style={{ backgroundColor: variant?.content?.color }}
      onClick={() => {
        trackConversion('click');
        // your click handler
      }}
    >
      {variant?.content?.text || 'Default Text'}
    </button>
  );
}`}
          </pre>

          <h4 style={styles.codeTitle}>Vanilla JS Usage</h4>
          <pre style={styles.codeBlock}>
{`<script src="https://cdn.botbuilder.app/ab-test-sdk.js"></script>
<script>
  BotBuilderABTest.init({ workspaceId: 'ws_xxx' });

  async function loadVariant() {
    const variant = await BotBuilderABTest.getVariant('button_color_test');

    const button = document.getElementById('cta-button');
    button.style.backgroundColor = variant.content.color;
    button.textContent = variant.content.text;

    button.onclick = () => {
      BotBuilderABTest.trackConversion('button_color_test', { type: 'click' });
    };
  }

  loadVariant();
</script>`}
          </pre>
        </div>
      </div>

      {/* Event Logs */}
      <div style={styles.logsPanel}>
        <div style={styles.logsPanelHeader}>
          <h3 style={styles.panelTitle}>Event Logs</h3>
          <button onClick={clearLogs} style={{ ...styles.button, ...styles.smallButton }}>
            Clear
          </button>
        </div>
        <div style={styles.logsContainer}>
          {logs.length === 0 ? (
            <p style={styles.emptyLogs}>No events yet. Initialize the SDK to start.</p>
          ) : (
            logs.map((log, index) => (
              <div key={index} style={{ ...styles.logEntry, ...styles[`log_${log.type}`] }}>
                <span style={styles.logTimestamp}>{log.timestamp}</span>
                <span style={styles.logType}>[{log.type.toUpperCase()}]</span>
                <span style={styles.logMessage}>{log.message}</span>
                {log.data && (
                  <pre style={styles.logData}>{JSON.stringify(log.data, null, 2)}</pre>
                )}
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>

      {/* SDK State */}
      {sdkState && (
        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>SDK State</h3>
          <pre style={styles.stateCode}>{JSON.stringify(sdkState, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f3f4f6',
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  header: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '16px',
    color: '#6b7280',
  },
  panel: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  panelTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '16px',
    marginTop: '0',
  },
  buttonGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
  },
  button: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '500',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    color: '#fff',
  },
  secondaryButton: {
    backgroundColor: '#e5e7eb',
    color: '#374151',
  },
  successButton: {
    backgroundColor: '#10b981',
    color: '#fff',
  },
  dangerButton: {
    backgroundColor: '#ef4444',
    color: '#fff',
  },
  smallButton: {
    padding: '6px 12px',
    fontSize: '12px',
  },
  disabledButton: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  testGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '16px',
  },
  testCard: {
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    padding: '16px',
    border: '1px solid #e5e7eb',
  },
  testName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '4px',
    marginTop: 0,
  },
  testDescription: {
    fontSize: '13px',
    color: '#6b7280',
    marginBottom: '12px',
  },
  variantResult: {
    backgroundColor: '#ecfdf5',
    borderRadius: '6px',
    padding: '12px',
    marginBottom: '12px',
  },
  variantBadge: {
    display: 'inline-block',
    backgroundColor: '#10b981',
    color: '#fff',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
    marginBottom: '8px',
  },
  variantContent: {
    fontSize: '11px',
    color: '#065f46',
    margin: 0,
    overflow: 'auto',
  },
  noVariant: {
    color: '#9ca3af',
    fontSize: '13px',
    fontStyle: 'italic',
    marginBottom: '12px',
  },
  testActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  previewContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '24px',
  },
  previewSection: {
    textAlign: 'center',
  },
  previewLabel: {
    fontSize: '12px',
    color: '#6b7280',
    marginBottom: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  previewButton: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  heroPreview: {
    padding: '20px',
    backgroundColor: '#f3f4f6',
    borderRadius: '8px',
  },
  heroTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: '8px',
  },
  heroSubtitle: {
    fontSize: '14px',
    color: '#6b7280',
    margin: 0,
  },
  pricingPreview: {
    padding: '20px',
    backgroundColor: '#f3f4f6',
    borderRadius: '8px',
    display: 'inline-block',
  },
  pricingHighlight: {
    backgroundColor: '#dbeafe',
    border: '2px solid #3b82f6',
  },
  priceCurrency: {
    fontSize: '16px',
    color: '#6b7280',
    verticalAlign: 'top',
  },
  priceAmount: {
    fontSize: '36px',
    fontWeight: '700',
    color: '#1f2937',
  },
  pricePeriod: {
    fontSize: '14px',
    color: '#6b7280',
  },
  priceSavings: {
    display: 'block',
    marginTop: '8px',
    fontSize: '12px',
    color: '#10b981',
    fontWeight: '600',
  },
  codeContainer: {
    backgroundColor: '#1f2937',
    borderRadius: '8px',
    padding: '16px',
  },
  codeTitle: {
    fontSize: '12px',
    color: '#9ca3af',
    marginBottom: '8px',
    marginTop: '16px',
  },
  codeBlock: {
    fontSize: '12px',
    color: '#e5e7eb',
    fontFamily: 'monospace',
    margin: 0,
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
  },
  logsPanel: {
    backgroundColor: '#1f2937',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '24px',
  },
  logsPanelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  logsContainer: {
    maxHeight: '300px',
    overflowY: 'auto',
    fontFamily: 'monospace',
    fontSize: '13px',
  },
  emptyLogs: {
    color: '#9ca3af',
    textAlign: 'center',
    padding: '20px',
  },
  logEntry: {
    padding: '8px 12px',
    borderRadius: '4px',
    marginBottom: '4px',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: '8px',
  },
  log_info: {
    backgroundColor: '#374151',
    color: '#e5e7eb',
  },
  log_success: {
    backgroundColor: '#065f46',
    color: '#a7f3d0',
  },
  log_warning: {
    backgroundColor: '#92400e',
    color: '#fde68a',
  },
  log_error: {
    backgroundColor: '#991b1b',
    color: '#fecaca',
  },
  logTimestamp: {
    color: '#9ca3af',
    fontSize: '11px',
  },
  logType: {
    fontWeight: '600',
    fontSize: '11px',
  },
  logMessage: {
    flex: 1,
  },
  logData: {
    width: '100%',
    marginTop: '4px',
    padding: '8px',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: '4px',
    fontSize: '11px',
    overflow: 'auto',
  },
  stateCode: {
    backgroundColor: '#f3f4f6',
    padding: '16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontFamily: 'monospace',
    overflow: 'auto',
    margin: 0,
  },
};

export default ABTestPlayground;
