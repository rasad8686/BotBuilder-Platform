import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const AgentKnowledgePanel = ({ agentId, onUpdate }) => {
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(null);

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (agentId) {
      fetchAgentKnowledgeBases();
    }
  }, [agentId]);

  const fetchAgentKnowledgeBases = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/agents/${agentId}/knowledge-bases`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch knowledge bases');

      const data = await response.json();
      setKnowledgeBases(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePriorityChange = async (kbId, newPriority) => {
    setUpdating(kbId);
    try {
      const response = await fetch(`${API_URL}/api/agents/${agentId}/knowledge-bases/${kbId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ priority: parseInt(newPriority) })
      });

      if (!response.ok) throw new Error('Failed to update priority');

      // Re-fetch to get updated order
      await fetchAgentKnowledgeBases();
      onUpdate && onUpdate();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setUpdating(null);
    }
  };

  const handleRemove = async (kbId) => {
    if (!confirm('Remove this knowledge base from agent?')) return;

    setUpdating(kbId);
    try {
      const response = await fetch(`${API_URL}/api/agents/${agentId}/knowledge-bases/${kbId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to remove knowledge base');

      setKnowledgeBases(knowledgeBases.filter(kb => kb.id !== kbId));
      onUpdate && onUpdate();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="agent-kb-panel loading">
        <div className="spinner"></div>
        <p>Loading knowledge bases...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="agent-kb-panel error">
        <p>Error: {error}</p>
        <button onClick={fetchAgentKnowledgeBases}>Retry</button>
      </div>
    );
  }

  return (
    <div className="agent-kb-panel">
      <div className="panel-header">
        <h3>Knowledge Bases</h3>
        <span className="count">{knowledgeBases.length} connected</span>
      </div>

      {knowledgeBases.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🧠</span>
          <p>No knowledge bases assigned</p>
          <p className="hint">Assign knowledge bases to enable RAG for this agent</p>
        </div>
      ) : (
        <div className="kb-list">
          {knowledgeBases
            .sort((a, b) => (b.priority || 0) - (a.priority || 0))
            .map((kb, index) => (
              <div key={kb.id} className="kb-item">
                <div className="kb-rank">#{index + 1}</div>
                <div className="kb-icon">🧠</div>
                <div className="kb-info">
                  <span className="kb-name">{kb.name}</span>
                  <span className="kb-stats">
                    {kb.document_count || 0} docs • {kb.total_chunks || 0} chunks
                  </span>
                </div>
                <div className="kb-priority">
                  <label>Priority:</label>
                  <select
                    value={kb.priority || 0}
                    onChange={(e) => handlePriorityChange(kb.id, e.target.value)}
                    disabled={updating === kb.id}
                  >
                    <option value="0">Normal (0)</option>
                    <option value="1">Low (1)</option>
                    <option value="2">Medium (2)</option>
                    <option value="3">High (3)</option>
                    <option value="4">Very High (4)</option>
                    <option value="5">Critical (5)</option>
                  </select>
                </div>
                <button
                  className="btn-remove"
                  onClick={() => handleRemove(kb.id)}
                  disabled={updating === kb.id}
                  title="Remove"
                >
                  {updating === kb.id ? '...' : '×'}
                </button>
              </div>
            ))}
        </div>
      )}

      <style>{`
        .agent-kb-panel {
          background: white;
          border-radius: 12px;
          padding: 20px;
          border: 1px solid #e5e7eb;
        }

        .agent-kb-panel.loading,
        .agent-kb-panel.error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          color: #6b7280;
        }

        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #e5e7eb;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 12px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #e5e7eb;
        }

        .panel-header h3 {
          margin: 0;
          font-size: 16px;
          color: #1a1a2e;
        }

        .count {
          font-size: 13px;
          color: #6b7280;
          background: #f3f4f6;
          padding: 4px 10px;
          border-radius: 12px;
        }

        .empty-state {
          text-align: center;
          padding: 32px 16px;
          color: #6b7280;
        }

        .empty-icon {
          font-size: 40px;
          display: block;
          margin-bottom: 12px;
          opacity: 0.5;
        }

        .empty-state p {
          margin: 0;
        }

        .empty-state .hint {
          font-size: 13px;
          margin-top: 8px;
          opacity: 0.8;
        }

        .kb-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .kb-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: #f9fafb;
          border-radius: 10px;
          transition: background 0.2s;
        }

        .kb-item:hover {
          background: #f3f4f6;
        }

        .kb-rank {
          width: 28px;
          height: 28px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
        }

        .kb-icon {
          font-size: 24px;
        }

        .kb-info {
          flex: 1;
          min-width: 0;
        }

        .kb-name {
          display: block;
          font-weight: 600;
          color: #1a1a2e;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .kb-stats {
          font-size: 12px;
          color: #6b7280;
        }

        .kb-priority {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .kb-priority label {
          font-size: 12px;
          color: #6b7280;
        }

        .kb-priority select {
          padding: 6px 10px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 13px;
          background: white;
          cursor: pointer;
        }

        .kb-priority select:focus {
          outline: none;
          border-color: #667eea;
        }

        .btn-remove {
          width: 28px;
          height: 28px;
          border: none;
          background: #fee2e2;
          color: #dc2626;
          border-radius: 6px;
          cursor: pointer;
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }

        .btn-remove:hover:not(:disabled) {
          background: #fecaca;
        }

        .btn-remove:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default AgentKnowledgePanel;
