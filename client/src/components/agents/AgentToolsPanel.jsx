import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const AgentToolsPanel = ({ agentId, onAddTool }) => {
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (agentId) {
      fetchAgentTools();
    }
  }, [agentId]);

  const fetchAgentTools = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/tools/agent/${agentId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tools');
      }

      const data = await response.json();
      setTools(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTool = async (toolId) => {
    if (!confirm('Remove this tool from the agent?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/tools/${toolId}/unassign/${agentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to remove tool');
      }

      setTools(tools.filter(t => t.tool_id !== toolId));
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const getToolIcon = (type) => {
    const icons = {
      'http_request': '🌐',
      'database_query': '🗄️',
      'code_execution': '💻',
      'web_scraper': '🕷️',
      'email': '📧'
    };
    return icons[type] || '🔧';
  };

  if (loading) {
    return (
      <div className="agent-tools-panel loading">
        <div className="spinner-small"></div>
        <span>Loading tools...</span>
      </div>
    );
  }

  return (
    <div className="agent-tools-panel">
      <div className="panel-header">
        <h4>Assigned Tools</h4>
        {onAddTool && (
          <button className="btn-add" onClick={onAddTool}>
            + Add Tool
          </button>
        )}
      </div>

      {error && (
        <div className="error-text">{error}</div>
      )}

      {tools.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🔧</span>
          <p>No tools assigned</p>
          {onAddTool && (
            <button className="btn-link" onClick={onAddTool}>
              Assign a tool
            </button>
          )}
        </div>
      ) : (
        <div className="tools-grid">
          {tools.map(assignment => (
            <div key={assignment.tool_id} className="tool-mini-card">
              <span className="tool-icon">{getToolIcon(assignment.tool?.tool_type || assignment.tool_type)}</span>
              <div className="tool-info">
                <span className="tool-name">{assignment.tool?.name || assignment.tool_name}</span>
                <span className="tool-type">{assignment.tool?.tool_type || assignment.tool_type}</span>
              </div>
              <button
                className="btn-remove"
                onClick={() => handleRemoveTool(assignment.tool_id)}
                title="Remove tool"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .agent-tools-panel {
          background: #f9fafb;
          border-radius: 8px;
          padding: 16px;
          margin-top: 16px;
        }

        .agent-tools-panel.loading {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #6b7280;
          font-size: 14px;
        }

        .spinner-small {
          width: 16px;
          height: 16px;
          border: 2px solid #e5e7eb;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .panel-header h4 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #374151;
        }

        .btn-add {
          background: #667eea;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-add:hover {
          background: #5a67d8;
        }

        .error-text {
          color: #dc2626;
          font-size: 13px;
          margin-bottom: 12px;
        }

        .empty-state {
          text-align: center;
          padding: 20px;
          color: #6b7280;
        }

        .empty-icon {
          font-size: 32px;
          display: block;
          margin-bottom: 8px;
          opacity: 0.5;
        }

        .empty-state p {
          margin: 0 0 8px 0;
          font-size: 13px;
        }

        .btn-link {
          background: none;
          border: none;
          color: #667eea;
          font-size: 13px;
          cursor: pointer;
          text-decoration: underline;
        }

        .tools-grid {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .tool-mini-card {
          display: flex;
          align-items: center;
          gap: 10px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 10px 12px;
          transition: border-color 0.2s;
        }

        .tool-mini-card:hover {
          border-color: #667eea;
        }

        .tool-icon {
          font-size: 20px;
        }

        .tool-info {
          flex: 1;
        }

        .tool-name {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #1a1a2e;
        }

        .tool-type {
          font-size: 11px;
          color: #6b7280;
        }

        .btn-remove {
          background: #fee2e2;
          border: none;
          color: #dc2626;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          font-size: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .tool-mini-card:hover .btn-remove {
          opacity: 1;
        }

        .btn-remove:hover {
          background: #fecaca;
        }
      `}</style>
    </div>
  );
};

export default AgentToolsPanel;
