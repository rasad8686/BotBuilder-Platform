import React from 'react';
import { useNavigate } from 'react-router-dom';

const statusColors = {
  active: { bg: '#d4edda', color: '#155724' },
  inactive: { bg: '#e9ecef', color: '#495057' },
  paused: { bg: '#fff3cd', color: '#856404' }
};

const AgentCard = ({ agent, onEdit, onDelete }) => {
  const navigate = useNavigate();
  const status = agent.status || 'active';
  const statusStyle = statusColors[status] || statusColors.active;

  const successRate = agent.total_tasks > 0
    ? Math.round((agent.successful_tasks / agent.total_tasks) * 100)
    : 0;

  const handleViewTasks = () => {
    navigate(`/autonomous/${agent.id}/tasks`);
  };

  return (
    <div className="autonomous-agent-card">
      {/* Header */}
      <div className="card-header">
        <div className="agent-icon">
          <span>🤖</span>
        </div>
        <span
          className="status-badge"
          style={{ background: statusStyle.bg, color: statusStyle.color }}
        >
          {status}
        </span>
      </div>

      {/* Body */}
      <div className="card-body">
        <h3 className="agent-name">{agent.name}</h3>
        <span className="agent-model">{agent.model || 'gpt-4'}</span>

        <p className="agent-description">
          {agent.description || 'No description provided'}
        </p>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-value">{agent.total_tasks || 0}</span>
            <span className="stat-label">Total</span>
          </div>
          <div className="stat-item success">
            <span className="stat-value">{agent.successful_tasks || 0}</span>
            <span className="stat-label">Success</span>
          </div>
          <div className="stat-item failed">
            <span className="stat-value">{agent.failed_tasks || 0}</span>
            <span className="stat-label">Failed</span>
          </div>
        </div>

        {/* Success Rate Bar */}
        {agent.total_tasks > 0 && (
          <div className="success-rate">
            <div className="rate-header">
              <span>Success Rate</span>
              <span>{successRate}%</span>
            </div>
            <div className="rate-bar">
              <div
                className="rate-fill"
                style={{ width: `${successRate}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Capabilities */}
        {agent.capabilities && agent.capabilities.length > 0 && (
          <div className="capabilities">
            {agent.capabilities.slice(0, 3).map((cap, i) => (
              <span key={i} className="capability-tag">{cap}</span>
            ))}
            {agent.capabilities.length > 3 && (
              <span className="capability-more">+{agent.capabilities.length - 3}</span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="card-actions">
        <button className="btn btn-primary" onClick={handleViewTasks}>
          📋 Tasks
        </button>
        <button className="btn btn-edit" onClick={() => onEdit(agent)}>
          ✏️
        </button>
        <button className="btn btn-delete" onClick={() => onDelete(agent)}>
          🗑️
        </button>
      </div>

      <style>{`
        .autonomous-agent-card {
          background: white;
          border-radius: 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          overflow: hidden;
          transition: all 0.2s;
        }

        .autonomous-agent-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #f0f0f0;
        }

        .agent-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: linear-gradient(135deg, #667eea20 0%, #764ba220 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .status-badge {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: capitalize;
        }

        .card-body {
          padding: 20px;
        }

        .agent-name {
          margin: 0 0 4px 0;
          font-size: 18px;
          font-weight: 600;
          color: #1a1a2e;
        }

        .agent-model {
          font-size: 12px;
          color: #6c757d;
          text-transform: uppercase;
        }

        .agent-description {
          margin: 12px 0 16px 0;
          font-size: 14px;
          color: #6c757d;
          line-height: 1.5;
          min-height: 42px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }

        .stat-item {
          text-align: center;
          padding: 12px;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .stat-item.success {
          background: #e8f5e9;
        }

        .stat-item.failed {
          background: #ffebee;
        }

        .stat-value {
          display: block;
          font-size: 20px;
          font-weight: 700;
          color: #1a1a2e;
        }

        .stat-item.success .stat-value {
          color: #2e7d32;
        }

        .stat-item.failed .stat-value {
          color: #c62828;
        }

        .stat-label {
          font-size: 11px;
          color: #6c757d;
          text-transform: uppercase;
        }

        .success-rate {
          margin-bottom: 16px;
        }

        .rate-header {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #6c757d;
          margin-bottom: 6px;
        }

        .rate-bar {
          height: 6px;
          background: #e9ecef;
          border-radius: 3px;
          overflow: hidden;
        }

        .rate-fill {
          height: 100%;
          background: linear-gradient(90deg, #48bb78, #38a169);
          border-radius: 3px;
          transition: width 0.3s ease;
        }

        .capabilities {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .capability-tag {
          padding: 4px 8px;
          background: #e3f2fd;
          color: #1565c0;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
        }

        .capability-more {
          padding: 4px 8px;
          color: #6c757d;
          font-size: 11px;
        }

        .card-actions {
          display: flex;
          gap: 8px;
          padding: 16px 20px;
          background: #f8f9fa;
          border-top: 1px solid #f0f0f0;
        }

        .btn {
          padding: 10px 16px;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          flex: 1;
          background: #667eea;
          color: white;
        }

        .btn-primary:hover {
          background: #5a6fd6;
        }

        .btn-edit {
          background: #e3f2fd;
          color: #1565c0;
        }

        .btn-edit:hover {
          background: #bbdefb;
        }

        .btn-delete {
          background: #ffebee;
          color: #c62828;
        }

        .btn-delete:hover {
          background: #ffcdd2;
        }
      `}</style>
    </div>
  );
};

export default AgentCard;
