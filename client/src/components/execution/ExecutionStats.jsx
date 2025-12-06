import React from 'react';

const ExecutionStats = ({ stats = {} }) => {
  const {
    totalDuration = 0,
    totalTokens = 0,
    totalCost = 0,
    successCount = 0,
    failureCount = 0,
    agentBreakdown = []
  } = stats;

  const formatDuration = (ms) => {
    if (!ms) return '0s';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  };

  const formatCost = (cost) => {
    if (!cost) return '$0.00';
    return `$${cost.toFixed(4)}`;
  };

  const formatTokens = (tokens) => {
    if (!tokens) return '0';
    if (tokens < 1000) return tokens.toString();
    return `${(tokens / 1000).toFixed(1)}k`;
  };

  const totalSteps = successCount + failureCount;
  const successRate = totalSteps > 0 ? ((successCount / totalSteps) * 100).toFixed(0) : 0;

  return (
    <div className="execution-stats">
      <div className="stats-header">
        <h3>Execution Stats</h3>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">⏱️</div>
          <div className="stat-info">
            <span className="stat-value">{formatDuration(totalDuration)}</span>
            <span className="stat-label">Duration</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🔤</div>
          <div className="stat-info">
            <span className="stat-value">{formatTokens(totalTokens)}</span>
            <span className="stat-label">Tokens</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-info">
            <span className="stat-value">{formatCost(totalCost)}</span>
            <span className="stat-label">Cost</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-info">
            <span className="stat-value">{successRate}%</span>
            <span className="stat-label">Success Rate</span>
          </div>
        </div>
      </div>

      <div className="success-failure">
        <div className="sf-item success">
          <span className="sf-count">{successCount}</span>
          <span className="sf-label">Successful</span>
        </div>
        <div className="sf-divider" />
        <div className="sf-item failure">
          <span className="sf-count">{failureCount}</span>
          <span className="sf-label">Failed</span>
        </div>
      </div>

      {agentBreakdown.length > 0 && (
        <div className="agent-breakdown">
          <h4>Agent Breakdown</h4>
          <div className="breakdown-list">
            {agentBreakdown.map((agent, index) => (
              <div key={index} className="breakdown-item">
                <div className="agent-info">
                  <span className="agent-name">{agent.name}</span>
                  <span className="agent-role">{agent.role}</span>
                </div>
                <div className="agent-stats">
                  <span className="agent-duration">{formatDuration(agent.duration)}</span>
                  <span className="agent-tokens">{formatTokens(agent.tokens)} tokens</span>
                </div>
                <div className="usage-bar">
                  <div
                    className="usage-fill"
                    style={{
                      width: `${totalTokens > 0 ? (agent.tokens / totalTokens) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .execution-stats {
          background: white;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
        }

        .stats-header {
          padding: 16px;
          border-bottom: 1px solid #e2e8f0;
        }

        .stats-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #1e293b;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          padding: 16px;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: #f8fafc;
          border-radius: 8px;
        }

        .stat-icon {
          font-size: 20px;
        }

        .stat-info {
          display: flex;
          flex-direction: column;
        }

        .stat-value {
          font-size: 16px;
          font-weight: 700;
          color: #1e293b;
        }

        .stat-label {
          font-size: 11px;
          color: #64748b;
        }

        .success-failure {
          display: flex;
          align-items: center;
          padding: 16px;
          border-top: 1px solid #e2e8f0;
        }

        .sf-item {
          flex: 1;
          text-align: center;
        }

        .sf-count {
          display: block;
          font-size: 24px;
          font-weight: 700;
        }

        .sf-label {
          font-size: 12px;
          color: #64748b;
        }

        .sf-item.success .sf-count {
          color: #10b981;
        }

        .sf-item.failure .sf-count {
          color: #ef4444;
        }

        .sf-divider {
          width: 1px;
          height: 40px;
          background: #e2e8f0;
        }

        .agent-breakdown {
          padding: 16px;
          border-top: 1px solid #e2e8f0;
        }

        .agent-breakdown h4 {
          margin: 0 0 12px 0;
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
        }

        .breakdown-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .breakdown-item {
          padding: 12px;
          background: #f8fafc;
          border-radius: 8px;
        }

        .agent-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        }

        .agent-name {
          font-size: 13px;
          font-weight: 600;
          color: #1e293b;
        }

        .agent-role {
          font-size: 11px;
          color: #64748b;
        }

        .agent-stats {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .agent-duration,
        .agent-tokens {
          font-size: 11px;
          color: #64748b;
          font-family: monospace;
        }

        .usage-bar {
          height: 4px;
          background: #e2e8f0;
          border-radius: 2px;
          overflow: hidden;
        }

        .usage-fill {
          height: 100%;
          background: linear-gradient(90deg, #667eea, #764ba2);
        }
      `}</style>
    </div>
  );
};

export default ExecutionStats;
