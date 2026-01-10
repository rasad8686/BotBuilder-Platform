import React from 'react';
import { Play, Bot, Zap, GitBranch, Square, Target, Search, PenTool, BarChart3, CheckSquare, Shuffle } from 'lucide-react';

const nodeCategories = [
  {
    name: 'Triggers',
    items: [
      { type: 'start', label: 'Start', Icon: Play, color: '#48bb78', description: 'Workflow entry point' }
    ]
  },
  {
    name: 'Agents',
    items: [
      { type: 'agent', label: 'Agent', Icon: Bot, color: '#667eea', description: 'AI agent execution' }
    ]
  },
  {
    name: 'Logic',
    items: [
      { type: 'condition', label: 'Condition', Icon: GitBranch, color: '#ed8936', description: 'Conditional branching' },
      { type: 'parallel', label: 'Parallel', Icon: Zap, color: '#4fd1c5', description: 'Run simultaneously' }
    ]
  },
  {
    name: 'Actions',
    items: [
      { type: 'end', label: 'End', Icon: Square, color: '#f56565', description: 'Workflow exit point' }
    ]
  }
];

const getRoleIcon = (role) => {
  switch (role) {
    case 'orchestrator': return Target;
    case 'researcher': return Search;
    case 'writer': return PenTool;
    case 'analyzer': return BarChart3;
    case 'reviewer': return CheckSquare;
    case 'router': return Shuffle;
    default: return Bot;
  }
};

const WorkflowSidebar = ({ agents = [] }) => {
  const onDragStart = (event, nodeType, data = {}) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({ type: nodeType, data }));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="workflow-sidebar">
      <div className="sidebar-header">
        <h3>Node Library</h3>
        <p>Drag nodes to canvas</p>
      </div>

      <div className="sidebar-content">
        {nodeCategories.map((category) => (
          <div key={category.name} className="node-category">
            <h4 className="category-name">{category.name}</h4>
            <div className="node-list">
              {category.items.map((item) => (
                <div
                  key={item.type}
                  className="node-item"
                  draggable
                  onDragStart={(e) => onDragStart(e, item.type, { label: item.label })}
                  style={{ '--node-color': item.color }}
                >
                  <span className="node-icon"><item.Icon size={24} /></span>
                  <div className="node-info">
                    <span className="node-label">{item.label}</span>
                    <span className="node-desc">{item.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {agents.length > 0 && (
          <div className="node-category">
            <h4 className="category-name">Your Agents</h4>
            <div className="node-list">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="node-item agent-item"
                  draggable
                  onDragStart={(e) => onDragStart(e, 'agent', {
                    label: agent.name,
                    agentId: agent.id,
                    agentName: agent.name,
                    role: agent.role,
                    model: agent.model_name
                  })}
                  style={{ '--node-color': '#667eea' }}
                >
                  <span className="node-icon">
                    {(() => { const RoleIcon = getRoleIcon(agent.role); return <RoleIcon size={24} />; })()}
                  </span>
                  <div className="node-info">
                    <span className="node-label">{agent.name}</span>
                    <span className="node-desc">{agent.role}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .workflow-sidebar {
          width: 260px;
          background: white;
          border-right: 1px solid #e9ecef;
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .sidebar-header {
          padding: 20px;
          border-bottom: 1px solid #e9ecef;
        }

        .sidebar-header h3 {
          margin: 0 0 4px 0;
          font-size: 16px;
          color: #1a1a2e;
        }

        .sidebar-header p {
          margin: 0;
          font-size: 12px;
          color: #6c757d;
        }

        .sidebar-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .node-category {
          margin-bottom: 20px;
        }

        .category-name {
          margin: 0 0 12px 0;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #6c757d;
          font-weight: 600;
        }

        .node-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .node-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: #f8f9fa;
          border: 2px solid transparent;
          border-radius: 8px;
          cursor: grab;
          transition: all 0.2s;
        }

        .node-item:hover {
          background: white;
          border-color: var(--node-color);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .node-item:active {
          cursor: grabbing;
        }

        .node-icon {
          font-size: 24px;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .node-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .node-label {
          font-size: 13px;
          font-weight: 600;
          color: #1a1a2e;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .node-desc {
          font-size: 11px;
          color: #6c757d;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .agent-item {
          background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
        }
      `}</style>
    </div>
  );
};

export default WorkflowSidebar;
