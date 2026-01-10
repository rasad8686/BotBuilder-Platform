import React from 'react';
import { CheckCircle, XCircle, ClipboardList, Clock, Cpu } from 'lucide-react';

const AgentMetrics = ({ metrics = {}, compact = false }) => {
  const {
    totalTasks = 0,
    successfulTasks = 0,
    failedTasks = 0,
    successRate = 0,
    avgDuration = 0,
    totalTokens = 0
  } = metrics;

  const formatDuration = (ms) => {
    if (!ms) return '0s';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (compact) {
    return (
      <div className="agent-metrics-compact">
        <div className="metric">
          <span className="metric-value">{totalTasks}</span>
          <span className="metric-label">Tasks</span>
        </div>
        <div className="metric">
          <span className="metric-value success">{successRate}%</span>
          <span className="metric-label">Success</span>
        </div>
        <div className="metric">
          <span className="metric-value">{formatDuration(avgDuration)}</span>
          <span className="metric-label">Avg Time</span>
        </div>
        <style>{`
          .agent-metrics-compact {
            display: flex;
            gap: 16px;
          }
          .metric {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .metric-value {
            font-size: 18px;
            font-weight: 700;
            color: #1a1a2e;
          }
          .metric-value.success {
            color: #48bb78;
          }
          .metric-label {
            font-size: 11px;
            color: #6c757d;
            text-transform: uppercase;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="agent-metrics">
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon">📊</div>
          <div className="metric-content">
            <div className="metric-value">{totalTasks}</div>
            <div className="metric-label">Total Tasks</div>
          </div>
        </div>

        <div className="metric-card success">
          <div className="metric-icon"><CheckCircle size={24} /></div>
          <div className="metric-content">
            <div className="metric-value">{successfulTasks}</div>
            <div className="metric-label">Successful</div>
          </div>
          <div className="metric-badge">{successRate}%</div>
        </div>

        <div className="metric-card error">
          <div className="metric-icon"><XCircle size={24} /></div>
          <div className="metric-content">
            <div className="metric-value">{failedTasks}</div>
            <div className="metric-label">Failed</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">⏱️</div>
          <div className="metric-content">
            <div className="metric-value">{formatDuration(avgDuration)}</div>
            <div className="metric-label">Avg Duration</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🔤</div>
          <div className="metric-content">
            <div className="metric-value">{formatNumber(totalTokens)}</div>
            <div className="metric-label">Tokens Used</div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {totalTasks > 0 && (
        <div className="success-progress">
          <div className="progress-header">
            <span>Success Rate</span>
            <span>{successRate}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${successRate}%` }}></div>
          </div>
        </div>
      )}

      <style>{`
        .agent-metrics {
          background: white;
          border-radius: 12px;
          padding: 20px;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }

        .metric-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: #f8f9fa;
          border-radius: 10px;
          position: relative;
        }

        .metric-card.success {
          background: #f0fff4;
        }

        .metric-card.error {
          background: #fff5f5;
        }

        .metric-icon {
          font-size: 24px;
        }

        .metric-content {
          display: flex;
          flex-direction: column;
        }

        .metric-value {
          font-size: 20px;
          font-weight: 700;
          color: #1a1a2e;
        }

        .metric-label {
          font-size: 12px;
          color: #6c757d;
        }

        .metric-badge {
          position: absolute;
          top: 8px;
          right: 8px;
          padding: 2px 8px;
          background: #48bb78;
          color: white;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
        }

        .success-progress {
          padding-top: 16px;
          border-top: 1px solid #e9ecef;
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 14px;
          color: #495057;
        }

        .progress-bar {
          height: 8px;
          background: #e9ecef;
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #48bb78, #38a169);
          border-radius: 4px;
          transition: width 0.3s ease;
        }
      `}</style>
    </div>
  );
};

export default AgentMetrics;
