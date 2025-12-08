import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const AgentStatsWidget = ({ botId }) => {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (botId) {
      fetchStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/agents/bot/${botId}/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setStats(data);
      } else {
        // If no stats available, set defaults
        setStats({
          agents: { total: 0, active: 0 },
          workflows: { total: 0, active: 0 },
          executions: { total: 0, completed: 0, failed: 0, running: 0 },
          recentExecutions: []
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'running': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (ms) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="agent-stats-widget loading">
        <div className="loading-spinner" />
        <p>Loading agent stats...</p>

        <style>{`
          .agent-stats-widget {
            background: white;
            border-radius: 12px;
            padding: 24px;
            border: 1px solid #e2e8f0;
          }

          .agent-stats-widget.loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 200px;
            color: #64748b;
          }

          .loading-spinner {
            width: 32px;
            height: 32px;
            border: 3px solid #e2e8f0;
            border-top-color: #667eea;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin-bottom: 12px;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="agent-stats-widget error">
        <p>Error loading stats: {error}</p>

        <style>{`
          .agent-stats-widget.error {
            background: #fef2f2;
            border-radius: 12px;
            padding: 24px;
            border: 1px solid #fecaca;
            color: #dc2626;
            text-align: center;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="agent-stats-widget">
      <div className="widget-header">
        <div className="header-left">
          <h3>Multi-Agent AI</h3>
          <span className="beta-badge">BETA</span>
        </div>
        <Link to={`/bots/${botId}/agents`} className="view-all-link">
          View All →
        </Link>
      </div>

      <div className="stats-grid">
        <div className="stat-card agents">
          <div className="stat-icon">🎯</div>
          <div className="stat-info">
            <span className="stat-value">{stats?.agents?.total || 0}</span>
            <span className="stat-label">Agents</span>
          </div>
          <span className="stat-sub">{stats?.agents?.active || 0} active</span>
        </div>

        <div className="stat-card workflows">
          <div className="stat-icon">🔄</div>
          <div className="stat-info">
            <span className="stat-value">{stats?.workflows?.total || 0}</span>
            <span className="stat-label">Workflows</span>
          </div>
          <span className="stat-sub">{stats?.workflows?.active || 0} active</span>
        </div>

        <div className="stat-card executions">
          <div className="stat-icon">📊</div>
          <div className="stat-info">
            <span className="stat-value">{stats?.executions?.total || 0}</span>
            <span className="stat-label">Executions</span>
          </div>
          <span className="stat-sub">
            {stats?.executions?.completed || 0} completed
          </span>
        </div>

        <div className="stat-card tokens">
          <div className="stat-icon">🔤</div>
          <div className="stat-info">
            <span className="stat-value">
              {stats?.executions?.totalTokens
                ? (stats.executions.totalTokens / 1000).toFixed(1) + 'k'
                : '0'}
            </span>
            <span className="stat-label">Tokens</span>
          </div>
          <span className="stat-sub">Total used</span>
        </div>
      </div>

      {stats?.recentExecutions?.length > 0 && (
        <div className="recent-executions">
          <h4>Recent Executions</h4>
          <div className="execution-list">
            {stats.recentExecutions.slice(0, 5).map((exec) => (
              <div key={exec.id} className="execution-item">
                <span className={`status-badge ${getStatusColor(exec.status)}`}>
                  {exec.status}
                </span>
                <span className="exec-duration">{formatDuration(exec.duration)}</span>
                <span className="exec-date">{formatDate(exec.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="quick-links">
        <Link to={`/bots/${botId}/agents`} className="quick-link">
          <span className="link-icon">🎯</span>
          <span>Agent Studio</span>
        </Link>
        <Link to={`/bots/${botId}/workflows`} className="quick-link">
          <span className="link-icon">🔄</span>
          <span>Workflows</span>
        </Link>
        <Link to={`/bots/${botId}/executions`} className="quick-link">
          <span className="link-icon">📋</span>
          <span>Executions</span>
        </Link>
      </div>

      <style>{`
        .agent-stats-widget {
          background: white;
          border-radius: 12px;
          padding: 24px;
          border: 1px solid #e2e8f0;
        }

        .widget-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .widget-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #1e293b;
        }

        .beta-badge {
          padding: 2px 8px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          font-size: 10px;
          font-weight: 700;
          border-radius: 4px;
        }

        .view-all-link {
          color: #667eea;
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
        }

        .view-all-link:hover {
          text-decoration: underline;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 20px;
        }

        .stat-card {
          padding: 16px;
          border-radius: 10px;
          background: #f8fafc;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .stat-card.agents {
          background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%);
        }

        .stat-card.workflows {
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
        }

        .stat-card.executions {
          background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
        }

        .stat-card.tokens {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
        }

        .stat-icon {
          font-size: 24px;
        }

        .stat-info {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }

        .stat-value {
          font-size: 28px;
          font-weight: 700;
          color: #1e293b;
        }

        .stat-label {
          font-size: 14px;
          color: #64748b;
        }

        .stat-sub {
          font-size: 12px;
          color: #94a3b8;
        }

        .recent-executions {
          margin-bottom: 20px;
          padding-top: 16px;
          border-top: 1px solid #e2e8f0;
        }

        .recent-executions h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 600;
          color: #64748b;
        }

        .execution-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .execution-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          background: #f8fafc;
          border-radius: 8px;
        }

        .status-badge {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: capitalize;
        }

        .exec-duration {
          font-size: 12px;
          color: #64748b;
          font-family: monospace;
        }

        .exec-date {
          margin-left: auto;
          font-size: 11px;
          color: #94a3b8;
        }

        .quick-links {
          display: flex;
          gap: 12px;
          padding-top: 16px;
          border-top: 1px solid #e2e8f0;
        }

        .quick-link {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          background: #f8fafc;
          border-radius: 8px;
          text-decoration: none;
          color: #475569;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .quick-link:hover {
          background: #667eea;
          color: white;
        }

        .link-icon {
          font-size: 16px;
        }

        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .quick-links {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};

export default AgentStatsWidget;
