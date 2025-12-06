import React from 'react';

const ExecutionPath = ({
  path = [],
  nodes = [],
  currentNodeId = null,
  nodeOutputs = {},
  onNodeSelect = () => {}
}) => {
  const getNodeById = (nodeId) => nodes.find(n => n.id === nodeId);

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

  const getStatusInfo = (nodeId) => {
    const output = nodeOutputs[nodeId];
    if (!output) return { status: 'pending', color: '#6c757d', icon: '○' };

    switch (output.status) {
      case 'running':
        return { status: 'running', color: '#f59e0b', icon: '⏳' };
      case 'completed':
        return { status: 'completed', color: '#22c55e', icon: '✓' };
      case 'error':
        return { status: 'error', color: '#ef4444', icon: '✗' };
      case 'skipped':
        return { status: 'skipped', color: '#6c757d', icon: '⊘' };
      default:
        return { status: 'pending', color: '#3b82f6', icon: '○' };
    }
  };

  const formatDuration = (ms) => {
    if (!ms) return null;
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  if (path.length === 0) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyIcon}>🛤</div>
        <p style={styles.emptyText}>No execution path yet</p>
        <p style={styles.emptySubtext}>
          Run the workflow to see the execution path
        </p>

        {/* Show available nodes */}
        {nodes.length > 0 && (
          <div style={styles.nodePreview}>
            <p style={styles.previewTitle}>Workflow nodes:</p>
            <div style={styles.previewNodes}>
              {nodes.slice(0, 8).map((node, index) => (
                <div key={node.id} style={styles.previewNode}>
                  <span>{getNodeTypeIcon(node.type)}</span>
                  <span style={styles.previewNodeName}>
                    {node.data?.label || node.type}
                  </span>
                </div>
              ))}
              {nodes.length > 8 && (
                <div style={styles.moreNodes}>
                  +{nodes.length - 8} more
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Summary */}
      <div style={styles.summary}>
        <div style={styles.summaryItem}>
          <span style={styles.summaryValue}>{path.length}</span>
          <span style={styles.summaryLabel}>Steps</span>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryValue}>
            {path.filter(p => nodeOutputs[p.nodeId]?.status === 'completed').length}
          </span>
          <span style={styles.summaryLabel}>Completed</span>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryValue}>
            {path.filter(p => nodeOutputs[p.nodeId]?.status === 'error').length}
          </span>
          <span style={styles.summaryLabel}>Errors</span>
        </div>
      </div>

      {/* Execution Timeline */}
      <div style={styles.timeline}>
        {path.map((step, index) => {
          const node = getNodeById(step.nodeId);
          const statusInfo = getStatusInfo(step.nodeId);
          const output = nodeOutputs[step.nodeId];
          const isCurrent = step.nodeId === currentNodeId;
          const isLast = index === path.length - 1;

          return (
            <div
              key={`${step.nodeId}-${index}`}
              style={styles.timelineItem}
            >
              {/* Connector Line */}
              {!isLast && (
                <div style={{
                  ...styles.connector,
                  backgroundColor: statusInfo.color
                }} />
              )}

              {/* Step Card */}
              <button
                onClick={() => onNodeSelect(step.nodeId)}
                style={{
                  ...styles.stepCard,
                  ...(isCurrent ? styles.currentStep : {}),
                  borderColor: isCurrent ? '#667eea' : 'transparent'
                }}
              >
                {/* Step Number */}
                <div style={{
                  ...styles.stepNumber,
                  backgroundColor: statusInfo.color,
                  boxShadow: isCurrent ? `0 0 0 3px ${statusInfo.color}30` : 'none'
                }}>
                  {statusInfo.status === 'running' ? (
                    <span style={styles.spinningIcon}>⏳</span>
                  ) : (
                    statusInfo.icon
                  )}
                </div>

                {/* Step Info */}
                <div style={styles.stepInfo}>
                  <div style={styles.stepHeader}>
                    <span style={styles.stepIcon}>
                      {getNodeTypeIcon(node?.type)}
                    </span>
                    <span style={styles.stepName}>
                      {node?.data?.label || node?.type || step.nodeId}
                    </span>
                  </div>

                  <div style={styles.stepMeta}>
                    <span style={{
                      ...styles.statusBadge,
                      backgroundColor: `${statusInfo.color}20`,
                      color: statusInfo.color
                    }}>
                      {statusInfo.status}
                    </span>

                    {output?.duration && (
                      <span style={styles.duration}>
                        ⏱ {formatDuration(output.duration)}
                      </span>
                    )}

                    {step.timestamp && (
                      <span style={styles.timestamp}>
                        {new Date(step.timestamp).toLocaleTimeString()}
                      </span>
                    )}
                  </div>

                  {/* Output Preview */}
                  {output?.output && (
                    <div style={styles.outputPreview}>
                      {typeof output.output === 'string'
                        ? output.output.substring(0, 50)
                        : JSON.stringify(output.output).substring(0, 50)}
                      {(typeof output.output === 'string' ? output.output.length : JSON.stringify(output.output).length) > 50 && '...'}
                    </div>
                  )}

                  {/* Error Preview */}
                  {output?.error && (
                    <div style={styles.errorPreview}>
                      ⚠ {output.error.substring(0, 50)}...
                    </div>
                  )}
                </div>

                {/* Arrow */}
                <div style={styles.stepArrow}>→</div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

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
  nodePreview: {
    width: '100%',
    marginTop: '24px',
    textAlign: 'left'
  },
  previewTitle: {
    color: '#6c757d',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '12px'
  },
  previewNodes: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px'
  },
  previewNode: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 10px',
    backgroundColor: '#2d2d44',
    borderRadius: '6px',
    fontSize: '11px',
    color: '#e4e4e7'
  },
  previewNodeName: {
    maxWidth: '100px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  moreNodes: {
    padding: '6px 10px',
    color: '#6c757d',
    fontSize: '11px'
  },
  summary: {
    display: 'flex',
    gap: '12px'
  },
  summaryItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '12px',
    backgroundColor: '#2d2d44',
    borderRadius: '8px'
  },
  summaryValue: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#e4e4e7'
  },
  summaryLabel: {
    fontSize: '10px',
    color: '#6c757d',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginTop: '4px'
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0'
  },
  timelineItem: {
    position: 'relative'
  },
  connector: {
    position: 'absolute',
    left: '15px',
    top: '40px',
    bottom: '-8px',
    width: '2px',
    opacity: 0.3
  },
  stepCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
    padding: '12px',
    backgroundColor: '#2d2d44',
    border: '2px solid transparent',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'left',
    marginBottom: '8px'
  },
  currentStep: {
    backgroundColor: 'rgba(102, 126, 234, 0.1)'
  },
  stepNumber: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    color: 'white',
    fontSize: '12px',
    fontWeight: '600',
    flexShrink: 0
  },
  spinningIcon: {
    animation: 'spin 1s linear infinite'
  },
  stepInfo: {
    flex: 1,
    minWidth: 0
  },
  stepHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px'
  },
  stepIcon: {
    fontSize: '14px'
  },
  stepName: {
    fontWeight: '500',
    fontSize: '13px',
    color: '#e4e4e7',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  stepMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  },
  statusBadge: {
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '10px',
    fontWeight: '500'
  },
  duration: {
    fontSize: '10px',
    color: '#6c757d'
  },
  timestamp: {
    fontSize: '10px',
    color: '#6c757d'
  },
  outputPreview: {
    marginTop: '8px',
    padding: '6px 8px',
    backgroundColor: '#1a1a2e',
    borderRadius: '4px',
    fontSize: '10px',
    fontFamily: 'monospace',
    color: '#a5d6ff',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  errorPreview: {
    marginTop: '8px',
    padding: '6px 8px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: '4px',
    fontSize: '10px',
    color: '#ef4444',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  stepArrow: {
    color: '#6c757d',
    fontSize: '16px',
    flexShrink: 0
  }
};

export default ExecutionPath;
