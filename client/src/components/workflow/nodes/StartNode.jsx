import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

const StartNode = memo(({ data, selected }) => {
  return (
    <div className={`start-node ${selected ? 'selected' : ''}`}>
      <div className="node-icon">▶</div>
      <div className="node-label">{data.label || 'Start'}</div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="output"
        className="handle-source"
      />

      <style>{`
        .start-node {
          background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
          border: 2px solid #2f855a;
          border-radius: 50%;
          width: 80px;
          height: 80px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 4px 12px rgba(72, 187, 120, 0.4);
          transition: all 0.2s;
        }

        .start-node.selected {
          border-color: #276749;
          box-shadow: 0 0 0 3px rgba(72, 187, 120, 0.3), 0 4px 12px rgba(72, 187, 120, 0.4);
        }

        .start-node:hover {
          transform: scale(1.05);
        }

        .node-icon {
          font-size: 24px;
          margin-bottom: 2px;
        }

        .node-label {
          font-size: 12px;
          font-weight: 600;
        }

        :global(.handle-source) {
          width: 12px;
          height: 12px;
          background: #2f855a;
          border: 2px solid white;
        }
      `}</style>
    </div>
  );
});

StartNode.displayName = 'StartNode';

export default StartNode;
