import React, { useState, useEffect } from 'react';

const WorkflowConfigPanel = ({ node, agents, onUpdate, onClose }) => {
  const [config, setConfig] = useState({});

  useEffect(() => {
    if (node) {
      setConfig(node.data || {});
    }
  }, [node]);

  const handleChange = (key, value) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    if (onUpdate) {
      onUpdate(node.id, newConfig);
    }
  };

  if (!node) {
    return (
      <div className="config-panel empty">
        <div className="empty-state">
          <span className="empty-icon">👆</span>
          <p>Select a node to configure</p>
        </div>

        <style>{`
          .config-panel {
            width: 280px;
            background: white;
            border-left: 1px solid #e9ecef;
            height: 100%;
          }

          .config-panel.empty {
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .empty-state {
            text-align: center;
            color: #6c757d;
          }

          .empty-icon {
            font-size: 48px;
            display: block;
            margin-bottom: 12px;
          }
        `}</style>
      </div>
    );
  }

  const renderAgentConfig = () => (
    <>
      <div className="form-group">
        <label>Select Agent</label>
        <select
          value={config.agentId || ''}
          onChange={(e) => {
            const agent = agents.find(a => a.id === parseInt(e.target.value));
            if (agent) {
              handleChange('agentId', agent.id);
              handleChange('agentName', agent.name);
              handleChange('label', agent.name);
              handleChange('role', agent.role);
              handleChange('model', agent.model_name);
            }
          }}
        >
          <option value="">-- Select an agent --</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name} ({agent.role})
            </option>
          ))}
        </select>
      </div>

      {config.agentId && (
        <div className="agent-info">
          <div className="info-row">
            <span className="info-label">Role</span>
            <span className="info-value">{config.role}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Model</span>
            <span className="info-value">{config.model}</span>
          </div>
        </div>
      )}
    </>
  );

  const renderConditionConfig = () => (
    <>
      <div className="form-group">
        <label>Condition Label</label>
        <input
          type="text"
          value={config.label || ''}
          onChange={(e) => handleChange('label', e.target.value)}
          placeholder="e.g., Check Intent"
        />
      </div>

      <div className="form-group">
        <label>Condition Expression</label>
        <textarea
          value={config.condition || ''}
          onChange={(e) => handleChange('condition', e.target.value)}
          placeholder="e.g., output.intent === 'question'"
          rows={3}
        />
        <p className="form-help">
          JavaScript expression evaluated against previous node output
        </p>
      </div>

      <div className="form-group">
        <label>Condition Type</label>
        <select
          value={config.conditionType || 'expression'}
          onChange={(e) => handleChange('conditionType', e.target.value)}
        >
          <option value="expression">JavaScript Expression</option>
          <option value="contains">Contains Text</option>
          <option value="equals">Equals Value</option>
          <option value="regex">Regex Match</option>
        </select>
      </div>
    </>
  );

  const renderParallelConfig = () => (
    <>
      <div className="form-group">
        <label>Parallel Label</label>
        <input
          type="text"
          value={config.label || ''}
          onChange={(e) => handleChange('label', e.target.value)}
          placeholder="e.g., Process All"
        />
      </div>

      <div className="form-group">
        <label>Number of Outputs</label>
        <input
          type="number"
          min={2}
          max={5}
          value={config.outputs || 2}
          onChange={(e) => handleChange('outputs', parseInt(e.target.value))}
        />
        <p className="form-help">
          Number of parallel branches (2-5)
        </p>
      </div>
    </>
  );

  const renderStartConfig = () => (
    <div className="form-group">
      <label>Start Label</label>
      <input
        type="text"
        value={config.label || 'Start'}
        onChange={(e) => handleChange('label', e.target.value)}
      />
    </div>
  );

  const renderEndConfig = () => (
    <div className="form-group">
      <label>End Label</label>
      <input
        type="text"
        value={config.label || 'End'}
        onChange={(e) => handleChange('label', e.target.value)}
      />
    </div>
  );

  const renderConfig = () => {
    switch (node.type) {
      case 'agent': return renderAgentConfig();
      case 'condition': return renderConditionConfig();
      case 'parallel': return renderParallelConfig();
      case 'start': return renderStartConfig();
      case 'end': return renderEndConfig();
      default: return null;
    }
  };

  const nodeTypeLabels = {
    start: 'Start Node',
    end: 'End Node',
    agent: 'Agent Node',
    condition: 'Condition Node',
    parallel: 'Parallel Node'
  };

  return (
    <div className="config-panel">
      <div className="panel-header">
        <h3>{nodeTypeLabels[node.type] || 'Node'}</h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="panel-body">
        {renderConfig()}
      </div>

      <style>{`
        .config-panel {
          width: 280px;
          background: white;
          border-left: 1px solid #e9ecef;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #e9ecef;
        }

        .panel-header h3 {
          margin: 0;
          font-size: 14px;
          color: #1a1a2e;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 20px;
          color: #6c757d;
          cursor: pointer;
          padding: 0;
        }

        .close-btn:hover {
          color: #1a1a2e;
        }

        .panel-body {
          padding: 20px;
          flex: 1;
          overflow-y: auto;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #495057;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #dee2e6;
          border-radius: 6px;
          font-size: 14px;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .form-group textarea {
          resize: vertical;
          font-family: monospace;
        }

        .form-help {
          margin: 6px 0 0 0;
          font-size: 11px;
          color: #6c757d;
        }

        .agent-info {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 12px;
          margin-top: 12px;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
        }

        .info-label {
          font-size: 12px;
          color: #6c757d;
        }

        .info-value {
          font-size: 12px;
          font-weight: 600;
          color: #1a1a2e;
        }
      `}</style>
    </div>
  );
};

export default WorkflowConfigPanel;
