import React from 'react';
import { Bot } from 'lucide-react';
import AgentCard from './AgentCard';

const AgentList = ({ agents, onEdit, onDelete, onTest, onCreate }) => {
  return (
    <div className="agent-list">
      <div className="agent-list-header">
        <h2>AI Agents</h2>
        <button className="btn btn-primary" onClick={onCreate}>
          + Create New Agent
        </button>
      </div>

      {agents.length === 0 ? (
        <div className="agent-list-empty">
          <div className="empty-icon"><Bot size={64} /></div>
          <h3>No Agents Yet</h3>
          <p>Create your first AI agent to get started with multi-agent workflows.</p>
          <button className="btn btn-primary" onClick={onCreate}>
            Create Your First Agent
          </button>
        </div>
      ) : (
        <div className="agent-grid">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEdit={() => onEdit(agent)}
              onDelete={() => onDelete(agent)}
              onTest={() => onTest(agent)}
            />
          ))}
        </div>
      )}

      <style>{`
        .agent-list {
          padding: 20px;
        }

        .agent-list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .agent-list-header h2 {
          margin: 0;
          font-size: 24px;
          color: #1a1a2e;
        }

        .agent-list-empty {
          text-align: center;
          padding: 60px 20px;
          background: #f8f9fa;
          border-radius: 12px;
          border: 2px dashed #dee2e6;
        }

        .empty-icon {
          font-size: 64px;
          margin-bottom: 16px;
        }

        .agent-list-empty h3 {
          margin: 0 0 8px 0;
          color: #1a1a2e;
        }

        .agent-list-empty p {
          color: #6c757d;
          margin-bottom: 24px;
        }

        .agent-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
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

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }
      `}</style>
    </div>
  );
};

export default AgentList;
