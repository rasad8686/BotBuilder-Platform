import React, { useState, useEffect } from 'react';
import { Target, Search, PenTool, BarChart3, CheckCircle, Shuffle, Bot } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ROLE_ICONS = {
  orchestrator: Target,
  researcher: Search,
  writer: PenTool,
  analyzer: BarChart3,
  reviewer: CheckCircle,
  router: Shuffle,
  custom: Bot
};

const KBAssignModal = ({ knowledgeBase, onClose, onSave }) => {
  const [agents, setAgents] = useState([]);
  const [assignedAgentIds, setAssignedAgentIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchAgentsAndAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knowledgeBase.id]);

  const fetchAgentsAndAssignments = async () => {
    try {
      setLoading(true);

      // Fetch all agents
      const agentsRes = await fetch(`${API_URL}/api/agents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!agentsRes.ok) throw new Error('Failed to fetch agents');
      const agentsData = await agentsRes.json();
      setAgents(agentsData);

      // Fetch current KB assignments
      const assignmentsRes = await fetch(`${API_URL}/api/knowledge/${knowledgeBase.id}/agents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (assignmentsRes.ok) {
        const assignments = await assignmentsRes.json();
        setAssignedAgentIds(new Set(assignments.map(a => a.agent_id)));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (agentId) => {
    setAssignedAgentIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(agentId)) {
        newSet.delete(agentId);
      } else {
        newSet.add(agentId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      // Save assignments
      const response = await fetch(`${API_URL}/api/knowledge/${knowledgeBase.id}/agents`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          agent_ids: Array.from(assignedAgentIds)
        })
      });

      if (!response.ok) throw new Error('Failed to save assignments');

      onSave && onSave();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getRoleIcon = (role) => {
    const Icon = ROLE_ICONS[role] || Bot;
    return <Icon size={18} />;
  };

  return (
    <div className="kb-assign-modal">
      <div className="modal-header">
        <h2>Assign to Agents</h2>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="kb-info">
        <span className="kb-icon">🧠</span>
        <div>
          <h3>{knowledgeBase.name}</h3>
          <span className="kb-stats">
            {knowledgeBase.document_count || 0} docs • {knowledgeBase.total_chunks || 0} chunks
          </span>
        </div>
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading agents...</p>
        </div>
      ) : error ? (
        <div className="error-box">{error}</div>
      ) : agents.length === 0 ? (
        <div className="empty-state">
          <p>No agents found.</p>
          <p>Create agents first to assign knowledge bases.</p>
        </div>
      ) : (
        <div className="agents-list">
          {agents.map(agent => (
            <label
              key={agent.id}
              className={`agent-item ${assignedAgentIds.has(agent.id) ? 'assigned' : ''}`}
            >
              <input
                type="checkbox"
                checked={assignedAgentIds.has(agent.id)}
                onChange={() => handleToggle(agent.id)}
              />
              <span className="agent-icon">{getRoleIcon(agent.role)}</span>
              <div className="agent-info">
                <span className="agent-name">{agent.name}</span>
                <span className="agent-role">{agent.role}</span>
              </div>
              <span className={`status-badge ${assignedAgentIds.has(agent.id) ? 'assigned' : 'unassigned'}`}>
                {assignedAgentIds.has(agent.id) ? 'Assigned' : 'Not Assigned'}
              </span>
            </label>
          ))}
        </div>
      )}

      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving || loading}
        >
          {saving ? 'Saving...' : 'Save Assignments'}
        </button>
      </div>

      <style>{`
        .kb-assign-modal {
          padding: 0;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 18px;
          color: #1a1a2e;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 28px;
          color: #6b7280;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }

        .kb-info {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 24px;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }

        .kb-icon {
          font-size: 32px;
        }

        .kb-info h3 {
          margin: 0 0 4px 0;
          font-size: 16px;
          color: #1a1a2e;
        }

        .kb-stats {
          font-size: 12px;
          color: #6b7280;
        }

        .loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 40px;
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

        .error-box {
          margin: 20px 24px;
          padding: 12px 16px;
          background: #fee2e2;
          border: 1px solid #fecaca;
          color: #dc2626;
          border-radius: 8px;
        }

        .empty-state {
          text-align: center;
          padding: 40px 24px;
          color: #6b7280;
        }

        .agents-list {
          max-height: 400px;
          overflow-y: auto;
          padding: 16px 24px;
        }

        .agent-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .agent-item:hover {
          border-color: #667eea;
          background: #f8f9ff;
        }

        .agent-item.assigned {
          border-color: #10b981;
          background: #ecfdf5;
        }

        .agent-item input {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .agent-icon {
          font-size: 24px;
        }

        .agent-info {
          flex: 1;
        }

        .agent-name {
          display: block;
          font-weight: 600;
          color: #1a1a2e;
        }

        .agent-role {
          font-size: 12px;
          color: #6b7280;
        }

        .status-badge {
          font-size: 11px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 12px;
        }

        .status-badge.assigned {
          background: #dcfce7;
          color: #16a34a;
        }

        .status-badge.unassigned {
          background: #f3f4f6;
          color: #6b7280;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid #e5e7eb;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .btn-primary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
        }

        .btn-secondary:hover {
          background: #e5e7eb;
        }
      `}</style>
    </div>
  );
};

export default KBAssignModal;
