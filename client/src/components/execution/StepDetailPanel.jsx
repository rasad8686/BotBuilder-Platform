import React, { useState } from 'react';

const StepDetailPanel = ({ step, onClose }) => {
  const [showRawJson, setShowRawJson] = useState(false);

  if (!step) return null;

  const formatDuration = (ms) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTokens = (tokens) => {
    if (!tokens) return '0';
    return tokens.toLocaleString();
  };

  const formatCost = (cost) => {
    if (!cost) return '$0.0000';
    return `$${cost.toFixed(4)}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'failed': return '#ef4444';
      case 'running': return '#3b82f6';
      default: return '#9ca3af';
    }
  };

  const renderContent = (content, label) => {
    if (!content) return null;

    const isObject = typeof content === 'object';
    const displayContent = isObject ? JSON.stringify(content, null, 2) : content;

    return (
      <div className="content-section">
        <h4>{label}</h4>
        <pre className="content-box">{displayContent}</pre>
      </div>
    );
  };

  return (
    <div className="step-detail-panel">
      <div className="panel-header">
        <div className="header-title">
          <h3>{step.agentName || 'Step Details'}</h3>
          <span
            className="status-badge"
            style={{ backgroundColor: getStatusColor(step.status) }}
          >
            {step.status}
          </span>
        </div>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="panel-content">
        <div className="meta-grid">
          <div className="meta-item">
            <span className="meta-label">Role</span>
            <span className="meta-value">{step.agentRole || '-'}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Duration</span>
            <span className="meta-value">{formatDuration(step.duration)}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Tokens</span>
            <span className="meta-value">{formatTokens(step.tokens)}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Cost</span>
            <span className="meta-value">{formatCost(step.cost)}</span>
          </div>
        </div>

        {step.status === 'failed' && step.error && (
          <div className="error-section">
            <h4>Error</h4>
            <div className="error-box">
              <span className="error-icon">⚠️</span>
              <span className="error-message">{step.error}</span>
            </div>
          </div>
        )}

        {renderContent(step.input, 'Input')}
        {renderContent(step.output, 'Output')}
        {renderContent(step.reasoning, 'Reasoning')}

        <div className="raw-toggle">
          <button onClick={() => setShowRawJson(!showRawJson)}>
            {showRawJson ? '📄 Hide Raw JSON' : '📄 Show Raw JSON'}
          </button>
        </div>

        {showRawJson && (
          <div className="raw-json-section">
            <pre>{JSON.stringify(step, null, 2)}</pre>
          </div>
        )}
      </div>

      <style>{`
        .step-detail-panel {
          background: white;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .header-title h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #1e293b;
        }

        .status-badge {
          padding: 4px 10px;
          border-radius: 12px;
          color: white;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 20px;
          color: #64748b;
          cursor: pointer;
        }

        .close-btn:hover {
          color: #1e293b;
        }

        .panel-content {
          padding: 16px;
          max-height: 400px;
          overflow-y: auto;
        }

        .meta-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }

        .meta-item {
          padding: 12px;
          background: #f8fafc;
          border-radius: 8px;
        }

        .meta-label {
          display: block;
          font-size: 11px;
          color: #64748b;
          margin-bottom: 4px;
        }

        .meta-value {
          font-size: 14px;
          font-weight: 600;
          color: #1e293b;
        }

        .error-section {
          margin-bottom: 16px;
        }

        .error-section h4 {
          margin: 0 0 8px 0;
          font-size: 12px;
          font-weight: 600;
          color: #dc2626;
        }

        .error-box {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 12px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
        }

        .error-icon {
          font-size: 16px;
        }

        .error-message {
          font-size: 13px;
          color: #dc2626;
          word-break: break-word;
        }

        .content-section {
          margin-bottom: 16px;
        }

        .content-section h4 {
          margin: 0 0 8px 0;
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
        }

        .content-box {
          margin: 0;
          padding: 12px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 12px;
          font-family: 'Monaco', 'Menlo', monospace;
          white-space: pre-wrap;
          word-break: break-word;
          max-height: 150px;
          overflow-y: auto;
        }

        .raw-toggle {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #e2e8f0;
        }

        .raw-toggle button {
          width: 100%;
          padding: 10px;
          background: none;
          border: 1px dashed #cbd5e1;
          border-radius: 8px;
          color: #64748b;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .raw-toggle button:hover {
          background: #f8fafc;
          border-color: #94a3b8;
          color: #1e293b;
        }

        .raw-json-section {
          margin-top: 12px;
        }

        .raw-json-section pre {
          margin: 0;
          padding: 12px;
          background: #1e293b;
          border-radius: 8px;
          font-size: 11px;
          font-family: 'Monaco', 'Menlo', monospace;
          color: #e2e8f0;
          white-space: pre-wrap;
          word-break: break-word;
          max-height: 200px;
          overflow-y: auto;
        }
      `}</style>
    </div>
  );
};

export default StepDetailPanel;
