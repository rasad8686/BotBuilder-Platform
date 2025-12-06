import React, { useState } from 'react';

const NodeInspector = ({
  node = null,
  nodes = [],
  onNodeSelect = () => {}
}) => {
  const [expandedSections, setExpandedSections] = useState({
    info: true,
    input: true,
    output: true,
    config: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const formatValue = (value) => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return '#f59e0b';
      case 'completed': return '#22c55e';
      case 'error': return '#ef4444';
      case 'skipped': return '#6c757d';
      default: return '#3b82f6';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running': return '⏳';
      case 'completed': return '✓';
      case 'error': return '✗';
      case 'skipped': return '⊘';
      default: return '○';
    }
  };

  const getNodeTypeIcon = (type) => {
    switch (type) {
      case 'start': return '▶';
      case 'end': return '⏹';
      case 'text': return '💬';
      case 'question': return '❓';
      case 'condition': return '◇';
      case 'agent': return '🤖';
      case 'api': return '🔌';
      case 'parallel': return '⫸';
      case 'delay': return '⏰';
      case 'loop': return '🔄';
      default: return '■';
    }
  };

  if (!node) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyIcon}>🔍</div>
        <p style={styles.emptyText}>Select a node to inspect</p>
        <p style={styles.emptySubtext}>
          Click on a node in the execution path or canvas
        </p>

        {/* Quick node list */}
        {nodes.length > 0 && (
          <div style={styles.quickList}>
            <p style={styles.quickListTitle}>Available Nodes:</p>
            {nodes.slice(0, 10).map(n => (
              <button
                key={n.id}
                onClick={() => onNodeSelect(n.id)}
                style={styles.quickListItem}
              >
                <span>{getNodeTypeIcon(n.type)}</span>
                <span>{n.data?.label || n.type}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Node Header */}
      <div style={styles.nodeHeader}>
        <div style={styles.nodeIcon}>
          {getNodeTypeIcon(node.type)}
        </div>
        <div style={styles.nodeInfo}>
          <div style={styles.nodeName}>
            {node.data?.label || node.type}
          </div>
          <div style={styles.nodeType}>
            {node.type} • {node.id}
          </div>
        </div>
        <div style={{
          ...styles.statusBadge,
          backgroundColor: `${getStatusColor(node.status)}20`,
          color: getStatusColor(node.status)
        }}>
          <span>{getStatusIcon(node.status)}</span>
          <span>{node.status || 'pending'}</span>
        </div>
      </div>

      {/* Duration */}
      {node.duration !== null && node.duration !== undefined && (
        <div style={styles.duration}>
          <span style={styles.durationIcon}>⏱</span>
          <span>Execution time: {node.duration}ms</span>
        </div>
      )}

      {/* Sections */}
      <div style={styles.sections}>
        {/* Info Section */}
        <Section
          title="Node Info"
          icon="ℹ"
          isExpanded={expandedSections.info}
          onToggle={() => toggleSection('info')}
        >
          <div style={styles.infoGrid}>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>ID</span>
              <span style={styles.infoValue}>{node.id}</span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>Type</span>
              <span style={styles.infoValue}>{node.type}</span>
            </div>
            {node.position && (
              <>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Position X</span>
                  <span style={styles.infoValue}>{Math.round(node.position.x)}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Position Y</span>
                  <span style={styles.infoValue}>{Math.round(node.position.y)}</span>
                </div>
              </>
            )}
          </div>
        </Section>

        {/* Input Section */}
        <Section
          title="Input Data"
          icon="📥"
          isExpanded={expandedSections.input}
          onToggle={() => toggleSection('input')}
        >
          {node.input ? (
            <pre style={styles.codeBlock}>
              {formatValue(node.input)}
            </pre>
          ) : (
            <p style={styles.noData}>No input data</p>
          )}
        </Section>

        {/* Output Section */}
        <Section
          title="Output Data"
          icon="📤"
          isExpanded={expandedSections.output}
          onToggle={() => toggleSection('output')}
        >
          {node.output ? (
            <pre style={styles.codeBlock}>
              {formatValue(node.output)}
            </pre>
          ) : (
            <p style={styles.noData}>No output data</p>
          )}
        </Section>

        {/* Config Section */}
        <Section
          title="Configuration"
          icon="⚙"
          isExpanded={expandedSections.config}
          onToggle={() => toggleSection('config')}
        >
          {node.data ? (
            <pre style={styles.codeBlock}>
              {formatValue(node.data)}
            </pre>
          ) : (
            <p style={styles.noData}>No configuration</p>
          )}
        </Section>
      </div>
    </div>
  );
};

// Collapsible Section Component
const Section = ({ title, icon, isExpanded, onToggle, children }) => (
  <div style={styles.section}>
    <button onClick={onToggle} style={styles.sectionHeader}>
      <div style={styles.sectionTitle}>
        <span style={styles.sectionIcon}>{icon}</span>
        <span>{title}</span>
      </div>
      <span style={{
        ...styles.chevron,
        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
      }}>
        ▼
      </span>
    </button>
    {isExpanded && (
      <div style={styles.sectionContent}>
        {children}
      </div>
    )}
  </div>
);

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
    textAlign: 'center'
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    opacity: 0.5
  },
  emptyText: {
    color: '#e4e4e7',
    fontSize: '14px',
    fontWeight: '500',
    margin: '0 0 8px 0'
  },
  emptySubtext: {
    color: '#6c757d',
    fontSize: '12px',
    margin: 0
  },
  quickList: {
    width: '100%',
    marginTop: '24px',
    textAlign: 'left'
  },
  quickListTitle: {
    color: '#6c757d',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px'
  },
  quickListItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '8px 12px',
    backgroundColor: '#2d2d44',
    border: 'none',
    borderRadius: '6px',
    color: '#e4e4e7',
    fontSize: '12px',
    cursor: 'pointer',
    marginBottom: '4px',
    transition: 'all 0.2s'
  },
  nodeHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    backgroundColor: '#2d2d44',
    borderRadius: '8px'
  },
  nodeIcon: {
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: '8px',
    fontSize: '20px'
  },
  nodeInfo: {
    flex: 1
  },
  nodeName: {
    fontWeight: '600',
    fontSize: '14px',
    color: '#e4e4e7'
  },
  nodeType: {
    fontSize: '11px',
    color: '#6c757d',
    marginTop: '2px'
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '500'
  },
  duration: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#667eea'
  },
  durationIcon: {
    fontSize: '14px'
  },
  sections: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  section: {
    backgroundColor: '#2d2d44',
    borderRadius: '8px',
    overflow: 'hidden'
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '12px 16px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#e4e4e7',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  sectionIcon: {
    fontSize: '12px'
  },
  chevron: {
    fontSize: '8px',
    transition: 'transform 0.2s',
    color: '#6c757d'
  },
  sectionContent: {
    padding: '0 16px 16px 16px'
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px'
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  infoLabel: {
    fontSize: '10px',
    color: '#6c757d',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  infoValue: {
    fontSize: '12px',
    color: '#e4e4e7',
    fontFamily: 'monospace'
  },
  codeBlock: {
    margin: 0,
    padding: '12px',
    backgroundColor: '#1a1a2e',
    borderRadius: '6px',
    fontSize: '11px',
    fontFamily: "'Fira Code', 'Monaco', monospace",
    color: '#a5d6ff',
    overflow: 'auto',
    maxHeight: '200px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  },
  noData: {
    margin: 0,
    padding: '12px',
    backgroundColor: '#1a1a2e',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#6c757d',
    fontStyle: 'italic',
    textAlign: 'center'
  }
};

export default NodeInspector;
