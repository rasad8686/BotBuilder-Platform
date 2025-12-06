import React from 'react';

const roleIcons = {
  orchestrator: '🎯',
  researcher: '🔍',
  writer: '✍️',
  analyzer: '📊',
  reviewer: '✅',
  router: '🔀',
  custom: '⚙️',
  assistant: '💬'
};

const roleColors = {
  orchestrator: '#667eea',
  researcher: '#48bb78',
  writer: '#ed8936',
  analyzer: '#4299e1',
  reviewer: '#9f7aea',
  router: '#f56565',
  custom: '#718096',
  assistant: '#38b2ac'
};

const AgentCard = ({ agent, onEdit, onDelete, onTest }) => {
  const icon = roleIcons[agent.role] || '🤖';
  const color = roleColors[agent.role] || '#667eea';

  return (
    <div className="agent-card">
      <div className="agent-card-header">
        <div className="agent-icon" style={{ background: `${color}20`, color }}>
          {icon}
        </div>
        <div className="agent-status">
          <span className={`status-badge ${agent.is_active ? 'active' : 'inactive'}`}>
            {agent.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <div className="agent-card-body">
        <h3 className="agent-name">{agent.name}</h3>
        <span className="agent-role" style={{ color }}>{agent.role}</span>

        <p className="agent-description">
          {agent.system_prompt?.substring(0, 100)}
          {agent.system_prompt?.length > 100 ? '...' : ''}
        </p>

        <div className="agent-meta">
          <div className="meta-item">
            <span className="meta-label">Provider</span>
            <span className="meta-value">{agent.model_provider || 'OpenAI'}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Model</span>
            <span className="meta-value">{agent.model_name || 'GPT-4'}</span>
          </div>
        </div>
      </div>

      <div className="agent-card-actions">
        <button className="btn btn-test" onClick={onTest} title="Test Agent">
          ▶ Test
        </button>
        <button className="btn btn-edit" onClick={onEdit} title="Edit Agent">
          ✏️ Edit
        </button>
        <button className="btn btn-delete" onClick={onDelete} title="Delete Agent">
          🗑️
        </button>
      </div>

      <style>{`
        .agent-card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          overflow: hidden;
          transition: all 0.2s;
        }

        .agent-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        }

        .agent-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid #f0f0f0;
        }

        .agent-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .status-badge {
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }

        .status-badge.active {
          background: #d4edda;
          color: #155724;
        }

        .status-badge.inactive {
          background: #f8d7da;
          color: #721c24;
        }

        .agent-card-body {
          padding: 16px;
        }

        .agent-name {
          margin: 0 0 4px 0;
          font-size: 18px;
          color: #1a1a2e;
        }

        .agent-role {
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .agent-description {
          margin: 12px 0;
          font-size: 14px;
          color: #6c757d;
          line-height: 1.5;
          min-height: 42px;
        }

        .agent-meta {
          display: flex;
          gap: 16px;
          padding-top: 12px;
          border-top: 1px solid #f0f0f0;
        }

        .meta-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .meta-label {
          font-size: 11px;
          color: #adb5bd;
          text-transform: uppercase;
        }

        .meta-value {
          font-size: 13px;
          font-weight: 600;
          color: #495057;
        }

        .agent-card-actions {
          display: flex;
          gap: 8px;
          padding: 12px 16px;
          background: #f8f9fa;
          border-top: 1px solid #f0f0f0;
        }

        .btn {
          padding: 8px 12px;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-test {
          background: #e8f5e9;
          color: #2e7d32;
          flex: 1;
        }

        .btn-test:hover {
          background: #c8e6c9;
        }

        .btn-edit {
          background: #e3f2fd;
          color: #1565c0;
          flex: 1;
        }

        .btn-edit:hover {
          background: #bbdefb;
        }

        .btn-delete {
          background: #ffebee;
          color: #c62828;
          padding: 8px;
        }

        .btn-delete:hover {
          background: #ffcdd2;
        }
      `}</style>
    </div>
  );
};

export default AgentCard;
