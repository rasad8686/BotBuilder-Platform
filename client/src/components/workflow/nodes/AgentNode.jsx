import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

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

const AgentNode = memo(({ data, selected }) => {
  const icon = roleIcons[data.role] || '🤖';

  return (
    <div className={`agent-node ${selected ? 'selected' : ''}`}>
      <Handle
        type="target"
        position={Position.Top}
        id="input"
        className="handle-target"
      />

      <div className="node-header">
        <span className="node-icon">{icon}</span>
        <span className="node-type">Agent</span>
      </div>

      <div className="node-body">
        <div className="agent-name">{data.label || data.agentName || 'Select Agent'}</div>
        {data.role && <div className="agent-role">{data.role}</div>}
        {data.model && <div className="agent-model">{data.model}</div>}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="output"
        className="handle-source"
      />

      <style>{`
        .agent-node {
          background: white;
          border: 2px solid #667eea;
          border-radius: 12px;
          min-width: 180px;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
          transition: all 0.2s;
          overflow: hidden;
        }

        .agent-node.selected {
          border-color: #5a67d8;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3), 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .agent-node:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(102, 126, 234, 0.3);
        }

        .node-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 8px 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: white;
        }

        .node-icon {
          font-size: 18px;
        }

        .node-type {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .node-body {
          padding: 12px;
        }

        .agent-name {
          font-size: 14px;
          font-weight: 600;
          color: #1a1a2e;
          margin-bottom: 4px;
        }

        .agent-role {
          font-size: 11px;
          color: #667eea;
          text-transform: uppercase;
          font-weight: 500;
        }

        .agent-model {
          font-size: 10px;
          color: #6c757d;
          margin-top: 4px;
        }

        :global(.handle-target) {
          width: 12px;
          height: 12px;
          background: #667eea;
          border: 2px solid white;
        }

        :global(.handle-source) {
          width: 12px;
          height: 12px;
          background: #667eea;
          border: 2px solid white;
        }
      `}</style>
    </div>
  );
});

AgentNode.displayName = 'AgentNode';

export default AgentNode;
