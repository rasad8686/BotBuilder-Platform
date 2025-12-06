import React, { useState, useEffect, useCallback } from 'react';
import NodeInspector from './NodeInspector';
import VariablesViewer from './VariablesViewer';
import ExecutionPath from './ExecutionPath';
import ErrorLog from './ErrorLog';

const DebugPanel = ({
  nodes = [],
  edges = [],
  isRunning = false,
  executionState = null,
  onNodeHighlight = () => {},
  onClose = () => {}
}) => {
  const [activeTab, setActiveTab] = useState('execution');
  const [isExpanded, setIsExpanded] = useState(true);
  const [isPinned, setIsPinned] = useState(false);

  // Debug state
  const [currentNodeId, setCurrentNodeId] = useState(null);
  const [executionPath, setExecutionPath] = useState([]);
  const [nodeOutputs, setNodeOutputs] = useState({});
  const [variables, setVariables] = useState({});
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [logs, setLogs] = useState([]);

  // Update state from execution
  useEffect(() => {
    if (executionState) {
      if (executionState.currentNodeId) {
        setCurrentNodeId(executionState.currentNodeId);
        onNodeHighlight(executionState.currentNodeId);
      }
      if (executionState.path) {
        setExecutionPath(executionState.path);
      }
      if (executionState.outputs) {
        setNodeOutputs(executionState.outputs);
      }
      if (executionState.variables) {
        setVariables(executionState.variables);
      }
      if (executionState.errors) {
        setErrors(executionState.errors);
      }
      if (executionState.warnings) {
        setWarnings(executionState.warnings);
      }
      if (executionState.logs) {
        setLogs(executionState.logs);
      }
    }
  }, [executionState, onNodeHighlight]);

  // Get current node details
  const currentNode = nodes.find(n => n.id === currentNodeId);
  const selectedNodeData = currentNode ? {
    ...currentNode,
    input: nodeOutputs[currentNodeId]?.input || null,
    output: nodeOutputs[currentNodeId]?.output || null,
    duration: nodeOutputs[currentNodeId]?.duration || null,
    status: nodeOutputs[currentNodeId]?.status || 'pending'
  } : null;

  // Clear debug data
  const handleClear = useCallback(() => {
    setExecutionPath([]);
    setNodeOutputs({});
    setVariables({});
    setErrors([]);
    setWarnings([]);
    setLogs([]);
    setCurrentNodeId(null);
    onNodeHighlight(null);
  }, [onNodeHighlight]);

  const tabs = [
    { id: 'execution', label: 'Execution', icon: '▶' },
    { id: 'inspector', label: 'Inspector', icon: '🔍' },
    { id: 'variables', label: 'Variables', icon: '📦' },
    { id: 'errors', label: 'Errors', icon: '⚠', count: errors.length + warnings.length }
  ];

  if (!isExpanded) {
    return (
      <div style={styles.collapsedPanel}>
        <button
          onClick={() => setIsExpanded(true)}
          style={styles.expandButton}
          title="Expand Debug Panel"
        >
          <span style={{ marginRight: '8px' }}>🐛</span>
          Debug
          {(errors.length > 0 || warnings.length > 0) && (
            <span style={styles.badge}>{errors.length + warnings.length}</span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div style={{
      ...styles.panel,
      ...(isPinned ? styles.pinnedPanel : {})
    }}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.debugIcon}>🐛</span>
          <span style={styles.title}>Debug Panel</span>
          {isRunning && (
            <span style={styles.runningIndicator}>
              <span style={styles.pulsingDot}></span>
              Running
            </span>
          )}
        </div>
        <div style={styles.headerRight}>
          <button
            onClick={handleClear}
            style={styles.iconButton}
            title="Clear Debug Data"
          >
            🗑
          </button>
          <button
            onClick={() => setIsPinned(!isPinned)}
            style={{
              ...styles.iconButton,
              color: isPinned ? '#667eea' : '#6c757d'
            }}
            title={isPinned ? 'Unpin Panel' : 'Pin Panel'}
          >
            📌
          </button>
          <button
            onClick={() => setIsExpanded(false)}
            style={styles.iconButton}
            title="Collapse Panel"
          >
            ▼
          </button>
          <button
            onClick={onClose}
            style={styles.iconButton}
            title="Close Debug Panel"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.activeTab : {})
            }}
          >
            <span style={styles.tabIcon}>{tab.icon}</span>
            {tab.label}
            {tab.count > 0 && (
              <span style={styles.tabBadge}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={styles.content}>
        {activeTab === 'execution' && (
          <ExecutionPath
            path={executionPath}
            nodes={nodes}
            currentNodeId={currentNodeId}
            nodeOutputs={nodeOutputs}
            onNodeSelect={(nodeId) => {
              setCurrentNodeId(nodeId);
              onNodeHighlight(nodeId);
              setActiveTab('inspector');
            }}
          />
        )}

        {activeTab === 'inspector' && (
          <NodeInspector
            node={selectedNodeData}
            nodes={nodes}
            onNodeSelect={(nodeId) => {
              setCurrentNodeId(nodeId);
              onNodeHighlight(nodeId);
            }}
          />
        )}

        {activeTab === 'variables' && (
          <VariablesViewer
            variables={variables}
            nodeOutputs={nodeOutputs}
          />
        )}

        {activeTab === 'errors' && (
          <ErrorLog
            errors={errors}
            warnings={warnings}
            logs={logs}
            onNodeSelect={(nodeId) => {
              setCurrentNodeId(nodeId);
              onNodeHighlight(nodeId);
              setActiveTab('inspector');
            }}
          />
        )}
      </div>

      {/* Status Bar */}
      <div style={styles.statusBar}>
        <span style={styles.statusItem}>
          Nodes: {nodes.length}
        </span>
        <span style={styles.statusItem}>
          Executed: {executionPath.length}
        </span>
        {currentNode && (
          <span style={styles.statusItem}>
            Current: {currentNode.data?.label || currentNode.type}
          </span>
        )}
      </div>
    </div>
  );
};

const styles = {
  panel: {
    position: 'fixed',
    right: 0,
    top: 0,
    bottom: 0,
    width: '380px',
    backgroundColor: '#1a1a2e',
    borderLeft: '1px solid #2d2d44',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    color: '#e4e4e7',
    fontSize: '13px',
    zIndex: 1000,
    boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.3)'
  },
  pinnedPanel: {

  },
  collapsedPanel: {
    position: 'fixed',
    right: '20px',
    bottom: '20px',
    zIndex: 999
  },
  expandButton: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 20px',
    backgroundColor: '#1a1a2e',
    color: '#e4e4e7',
    border: '1px solid #2d2d44',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
  },
  badge: {
    marginLeft: '8px',
    padding: '2px 8px',
    backgroundColor: '#ef4444',
    borderRadius: '10px',
    fontSize: '11px',
    fontWeight: '600'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #2d2d44',
    backgroundColor: '#16162a'
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  debugIcon: {
    fontSize: '16px'
  },
  title: {
    fontWeight: '600',
    fontSize: '14px'
  },
  runningIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    color: '#22c55e',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '500'
  },
  pulsingDot: {
    width: '6px',
    height: '6px',
    backgroundColor: '#22c55e',
    borderRadius: '50%',
    animation: 'pulse 1.5s infinite'
  },
  iconButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    color: '#6c757d',
    fontSize: '12px',
    transition: 'all 0.2s'
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #2d2d44',
    backgroundColor: '#16162a'
  },
  tab: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '10px 8px',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottomWidth: '2px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'transparent',
    color: '#6c757d',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  activeTab: {
    color: '#667eea',
    borderBottomColor: '#667eea',
    backgroundColor: 'rgba(102, 126, 234, 0.1)'
  },
  tabIcon: {
    fontSize: '12px'
  },
  tabBadge: {
    padding: '1px 6px',
    backgroundColor: '#ef4444',
    borderRadius: '8px',
    fontSize: '10px',
    fontWeight: '600',
    color: 'white'
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '16px'
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '8px 16px',
    borderTop: '1px solid #2d2d44',
    backgroundColor: '#16162a',
    fontSize: '11px',
    color: '#6c757d'
  },
  statusItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  }
};

// Add keyframe animation for pulsing dot
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.2); }
  }
`;
if (typeof document !== 'undefined' && !document.getElementById('debug-panel-styles')) {
  styleSheet.id = 'debug-panel-styles';
  document.head.appendChild(styleSheet);
}

export default DebugPanel;
