/**
 * Tour Test Page
 * A page for testing the Tours SDK components
 */

import React, { useState, useEffect, useRef } from 'react';

const TourTestPage = () => {
  const [logs, setLogs] = useState([]);
  const [sdkState, setSdkState] = useState(null);
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const logsEndRef = useRef(null);

  // Add log entry
  const addLog = (type, message, data = null) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { timestamp, type, message, data }]);
  };

  // Initialize SDK
  useEffect(() => {
    // For testing, we'll create a mock SDK if not loaded via script
    if (typeof window.BotBuilderTours !== 'undefined') {
      setIsSDKLoaded(true);
      addLog('info', 'SDK already loaded');
    } else {
      addLog('warning', 'SDK not loaded - using mock mode');
      // Create mock SDK for testing UI components
      window.BotBuilderTours = createMockSDK(addLog, setSdkState);
      setIsSDKLoaded(true);
    }

    return () => {
      if (window.BotBuilderTours?.destroy) {
        window.BotBuilderTours.destroy();
      }
    };
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Initialize SDK
  const handleInit = () => {
    if (!window.BotBuilderTours) return;

    window.BotBuilderTours.init({
      workspaceId: 'ws_test_123',
      userId: 'user_test',
      apiUrl: window.location.origin,
      autoStart: false,
      theme: 'light',
    });

    addLog('success', 'SDK initialized');
    setSdkState(window.BotBuilderTours.getState?.() || {});
  };

  // Start demo tour
  const handleStartTour = (tourType) => {
    if (!window.BotBuilderTours) return;

    const tours = {
      tooltip: createTooltipTour(),
      modal: createModalTour(),
      hotspot: createHotspotTour(),
      slideout: createSlideoutTour(),
      mixed: createMixedTour(),
    };

    window.BotBuilderTours._startDemoTour?.(tours[tourType]);
    addLog('info', `Started ${tourType} tour`);
  };

  // Identify user
  const handleIdentify = () => {
    if (!window.BotBuilderTours) return;

    window.BotBuilderTours.identify?.('user_123', {
      name: 'Test User',
      email: 'test@example.com',
      plan: 'premium',
      signupDate: '2024-01-15',
    });

    addLog('success', 'User identified');
  };

  // Clear logs
  const clearLogs = () => setLogs([]);

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.title}>Tours SDK Test Page</h1>
        <p style={styles.subtitle}>
          Test all SDK components and features
        </p>
      </header>

      {/* Control Panel */}
      <div style={styles.controlPanel}>
        <h3 style={styles.sectionTitle}>SDK Controls</h3>
        <div style={styles.buttonGroup}>
          <button
            onClick={handleInit}
            style={{ ...styles.button, ...styles.primaryButton }}
          >
            Initialize SDK
          </button>
          <button
            onClick={handleIdentify}
            style={{ ...styles.button, ...styles.secondaryButton }}
          >
            Identify User
          </button>
        </div>

        <h3 style={styles.sectionTitle}>Start Demo Tours</h3>
        <div style={styles.buttonGroup}>
          <button
            onClick={() => handleStartTour('tooltip')}
            style={{ ...styles.button, ...styles.tourButton }}
          >
            Tooltip Tour
          </button>
          <button
            onClick={() => handleStartTour('modal')}
            style={{ ...styles.button, ...styles.tourButton }}
          >
            Modal Tour
          </button>
          <button
            onClick={() => handleStartTour('hotspot')}
            style={{ ...styles.button, ...styles.tourButton }}
          >
            Hotspot Tour
          </button>
          <button
            onClick={() => handleStartTour('slideout')}
            style={{ ...styles.button, ...styles.tourButton }}
          >
            Slideout Tour
          </button>
          <button
            onClick={() => handleStartTour('mixed')}
            style={{ ...styles.button, ...styles.tourButton }}
          >
            Mixed Tour
          </button>
        </div>
      </div>

      {/* Demo Content */}
      <div style={styles.demoContent}>
        <h3 style={styles.sectionTitle}>Demo Elements</h3>
        <p style={styles.description}>
          These elements are targets for the tour steps. The SDK will highlight and attach tooltips to them.
        </p>

        <div style={styles.demoGrid}>
          {/* Navigation Demo */}
          <div style={styles.demoCard} data-tour="navigation">
            <div style={styles.cardIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </div>
            <h4 style={styles.cardTitle}>Navigation</h4>
            <p style={styles.cardDescription}>
              Main navigation menu for accessing different sections
            </p>
          </div>

          {/* Dashboard Demo */}
          <div style={styles.demoCard} data-tour="dashboard">
            <div style={styles.cardIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </div>
            <h4 style={styles.cardTitle}>Dashboard</h4>
            <p style={styles.cardDescription}>
              Overview of your analytics and metrics
            </p>
          </div>

          {/* Settings Demo */}
          <div style={styles.demoCard} data-tour="settings">
            <div style={styles.cardIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <h4 style={styles.cardTitle}>Settings</h4>
            <p style={styles.cardDescription}>
              Configure your account and preferences
            </p>
          </div>

          {/* Create Demo */}
          <div style={styles.demoCard} data-tour="create">
            <div style={styles.cardIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </div>
            <h4 style={styles.cardTitle}>Create New</h4>
            <p style={styles.cardDescription}>
              Start creating something new
            </p>
          </div>
        </div>

        {/* Form Demo */}
        <div style={styles.formDemo} data-tour="form">
          <h4 style={styles.cardTitle}>Sample Form</h4>
          <div style={styles.formGroup}>
            <label style={styles.label}>Name</label>
            <input
              type="text"
              style={styles.input}
              placeholder="Enter your name"
              data-tour="input-name"
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              style={styles.input}
              placeholder="Enter your email"
              data-tour="input-email"
            />
          </div>
          <button
            style={{ ...styles.button, ...styles.primaryButton }}
            data-tour="submit-button"
          >
            Submit Form
          </button>
        </div>
      </div>

      {/* Logs Panel */}
      <div style={styles.logsPanel}>
        <div style={styles.logsPanelHeader}>
          <h3 style={styles.sectionTitle}>Event Logs</h3>
          <button
            onClick={clearLogs}
            style={{ ...styles.button, ...styles.smallButton }}
          >
            Clear
          </button>
        </div>
        <div style={styles.logsContainer}>
          {logs.length === 0 ? (
            <p style={styles.emptyLogs}>No events yet. Initialize the SDK to start.</p>
          ) : (
            logs.map((log, index) => (
              <div key={index} style={{ ...styles.logEntry, ...styles[`log${log.type}`] }}>
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
        <div style={styles.statePanel}>
          <h3 style={styles.sectionTitle}>SDK State</h3>
          <pre style={styles.stateCode}>{JSON.stringify(sdkState, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

// Mock SDK for testing without actual SDK loaded
function createMockSDK(addLog, setSdkState) {
  let state = {
    initialized: false,
    currentTour: null,
    currentStepIndex: 0,
    totalSteps: 0,
    userId: null,
    visitorId: null,
  };

  const listeners = {};

  return {
    init(config) {
      state = {
        ...state,
        initialized: true,
        visitorId: config.visitorId || `v_${Date.now()}`,
        userId: config.userId || null,
      };
      setSdkState(state);
      addLog('success', 'SDK initialized', config);
      return this;
    },

    identify(userId, traits) {
      state.userId = userId;
      addLog('success', 'User identified', { userId, traits });
      return this;
    },

    getState() {
      return state;
    },

    on(event, callback) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(callback);
      addLog('info', `Listener added for: ${event}`);
      return this;
    },

    off(event, callback) {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((cb) => cb !== callback);
      }
      return this;
    },

    _emit(event, data) {
      if (listeners[event]) {
        listeners[event].forEach((cb) => cb(data));
      }
      addLog('info', `Event emitted: ${event}`, data);
    },

    _startDemoTour(tour) {
      state.currentTour = tour;
      state.currentStepIndex = 0;
      state.totalSteps = tour.steps.length;
      setSdkState({ ...state });
      addLog('info', 'Tour started', { tourId: tour.id, totalSteps: tour.steps.length });
      this._emit('tour:started', { tour });
      this._showStep();
    },

    _showStep() {
      const step = state.currentTour?.steps[state.currentStepIndex];
      if (step) {
        addLog('info', `Showing step ${state.currentStepIndex + 1}`, step);
        this._emit('step:viewed', { step, stepIndex: state.currentStepIndex });
      }
    },

    nextStep() {
      if (state.currentStepIndex < state.totalSteps - 1) {
        state.currentStepIndex++;
        setSdkState({ ...state });
        this._showStep();
      } else {
        this.endTour(true);
      }
    },

    prevStep() {
      if (state.currentStepIndex > 0) {
        state.currentStepIndex--;
        setSdkState({ ...state });
        this._showStep();
      }
    },

    skipTour() {
      this.endTour(false);
    },

    endTour(completed = true) {
      const tour = state.currentTour;
      state.currentTour = null;
      state.currentStepIndex = 0;
      state.totalSteps = 0;
      setSdkState({ ...state });
      addLog(completed ? 'success' : 'warning', `Tour ${completed ? 'completed' : 'skipped'}`);
      this._emit(completed ? 'tour:completed' : 'tour:dismissed', { tour });
    },

    destroy() {
      state = {
        initialized: false,
        currentTour: null,
        currentStepIndex: 0,
        totalSteps: 0,
        userId: null,
        visitorId: null,
      };
      setSdkState(null);
      addLog('info', 'SDK destroyed');
    },
  };
}

// Demo tour data
function createTooltipTour() {
  return {
    id: 'tour_tooltip_demo',
    name: 'Tooltip Tour Demo',
    steps: [
      {
        id: 'step_1',
        type: 'tooltip',
        title: 'Welcome to Navigation',
        content: 'This is the main navigation area where you can access all sections of the app.',
        targetSelector: '[data-tour="navigation"]',
        position: 'bottom',
      },
      {
        id: 'step_2',
        type: 'tooltip',
        title: 'Your Dashboard',
        content: 'View all your analytics and metrics in one place.',
        targetSelector: '[data-tour="dashboard"]',
        position: 'bottom',
      },
      {
        id: 'step_3',
        type: 'tooltip',
        title: 'Settings',
        content: 'Configure your account preferences and settings here.',
        targetSelector: '[data-tour="settings"]',
        position: 'left',
      },
    ],
    settings: {
      showProgress: true,
      showBackButton: true,
      showSkipButton: true,
    },
  };
}

function createModalTour() {
  return {
    id: 'tour_modal_demo',
    name: 'Modal Tour Demo',
    steps: [
      {
        id: 'step_1',
        type: 'modal',
        title: 'Welcome to Our Platform!',
        content: '<p>We\'re excited to have you here. Let us show you around and help you get started with the key features.</p>',
        size: 'medium',
        media: {
          type: 'image',
          src: 'https://via.placeholder.com/400x200/3B82F6/FFFFFF?text=Welcome',
        },
      },
      {
        id: 'step_2',
        type: 'modal',
        title: 'Powerful Analytics',
        content: '<p>Track your performance with our comprehensive analytics dashboard. Get insights that matter.</p>',
        size: 'medium',
      },
      {
        id: 'step_3',
        type: 'modal',
        title: 'Ready to Start?',
        content: '<p>You\'re all set! Start exploring and building amazing things.</p>',
        size: 'small',
      },
    ],
    settings: {
      showProgress: true,
      showBackButton: true,
      showSkipButton: true,
    },
  };
}

function createHotspotTour() {
  return {
    id: 'tour_hotspot_demo',
    name: 'Hotspot Tour Demo',
    steps: [
      {
        id: 'step_1',
        type: 'hotspot',
        title: 'Create New',
        content: 'Click here to create something new!',
        targetSelector: '[data-tour="create"]',
        position: 'right',
        pulse: true,
      },
      {
        id: 'step_2',
        type: 'hotspot',
        title: 'Name Input',
        content: 'Enter your name in this field.',
        targetSelector: '[data-tour="input-name"]',
        position: 'bottom',
        pulse: true,
      },
      {
        id: 'step_3',
        type: 'hotspot',
        title: 'Submit',
        content: 'Click to submit the form when ready.',
        targetSelector: '[data-tour="submit-button"]',
        position: 'top',
        pulse: true,
      },
    ],
    settings: {
      showProgress: true,
      showBackButton: true,
      showSkipButton: true,
    },
  };
}

function createSlideoutTour() {
  return {
    id: 'tour_slideout_demo',
    name: 'Slideout Tour Demo',
    steps: [
      {
        id: 'step_1',
        type: 'slideout',
        title: 'Getting Started Guide',
        content: `
          <h4>Welcome!</h4>
          <p>This slideout panel can contain detailed information about features.</p>
          <ul>
            <li>Step-by-step instructions</li>
            <li>Helpful tips and tricks</li>
            <li>Video tutorials</li>
          </ul>
        `,
        slidePosition: 'right',
        slideWidth: 400,
      },
      {
        id: 'step_2',
        type: 'slideout',
        title: 'Advanced Features',
        content: `
          <p>Explore our advanced features to get the most out of the platform.</p>
          <p>The slideout panel is perfect for longer content that needs more space.</p>
        `,
        slidePosition: 'right',
        slideWidth: 400,
      },
    ],
    settings: {
      showProgress: true,
      showBackButton: true,
      showSkipButton: true,
    },
  };
}

function createMixedTour() {
  return {
    id: 'tour_mixed_demo',
    name: 'Mixed Tour Demo',
    steps: [
      {
        id: 'step_1',
        type: 'modal',
        title: 'Welcome!',
        content: 'Let us give you a quick tour of the interface.',
        size: 'small',
      },
      {
        id: 'step_2',
        type: 'tooltip',
        title: 'Navigation',
        content: 'Start by exploring the navigation options.',
        targetSelector: '[data-tour="navigation"]',
        position: 'bottom',
      },
      {
        id: 'step_3',
        type: 'hotspot',
        title: 'Create Button',
        content: 'Click here to create new items.',
        targetSelector: '[data-tour="create"]',
        position: 'right',
        pulse: true,
      },
      {
        id: 'step_4',
        type: 'slideout',
        title: 'Need Help?',
        content: '<p>Check out our documentation for more detailed guides and tutorials.</p>',
        slidePosition: 'right',
        slideWidth: 350,
      },
    ],
    settings: {
      showProgress: true,
      showBackButton: true,
      showSkipButton: true,
    },
  };
}

// Styles
const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f3f4f6',
    padding: '24px',
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
  controlPanel: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  sectionTitle: {
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
    marginBottom: '24px',
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
  tourButton: {
    backgroundColor: '#10b981',
    color: '#fff',
  },
  smallButton: {
    padding: '6px 12px',
    fontSize: '12px',
    backgroundColor: '#e5e7eb',
    color: '#374151',
  },
  demoContent: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  description: {
    color: '#6b7280',
    marginBottom: '24px',
  },
  demoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  demoCard: {
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    padding: '20px',
    textAlign: 'center',
    border: '1px solid #e5e7eb',
    transition: 'all 0.2s',
  },
  cardIcon: {
    width: '48px',
    height: '48px',
    backgroundColor: '#dbeafe',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 12px',
    color: '#3b82f6',
  },
  cardTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '4px',
  },
  cardDescription: {
    fontSize: '12px',
    color: '#6b7280',
    margin: 0,
  },
  formDemo: {
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    padding: '20px',
    border: '1px solid #e5e7eb',
    maxWidth: '400px',
  },
  formGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    boxSizing: 'border-box',
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
  loginfo: {
    backgroundColor: '#374151',
    color: '#e5e7eb',
  },
  logsuccess: {
    backgroundColor: '#065f46',
    color: '#a7f3d0',
  },
  logwarning: {
    backgroundColor: '#92400e',
    color: '#fde68a',
  },
  logerror: {
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
  statePanel: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  stateCode: {
    backgroundColor: '#f3f4f6',
    padding: '16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontFamily: 'monospace',
    overflow: 'auto',
  },
};

export default TourTestPage;
