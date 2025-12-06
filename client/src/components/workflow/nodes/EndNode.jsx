import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

const EndNode = memo(({ data, selected }) => {
  return (
    <div className={`end-node ${selected ? 'selected' : ''}`}>
      <Handle
        type="target"
        position={Position.Top}
        id="input"
        className="handle-target"
      />

      <div className="node-icon">⏹</div>
      <div className="node-label">{data.label || 'End'}</div>

      <style>{`
        .end-node {
          background: linear-gradient(135deg, #fc8181 0%, #f56565 100%);
          border: 2px solid #c53030;
          border-radius: 50%;
          width: 80px;
          height: 80px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 4px 12px rgba(245, 101, 101, 0.4);
          transition: all 0.2s;
        }

        .end-node.selected {
          border-color: #9b2c2c;
          box-shadow: 0 0 0 3px rgba(245, 101, 101, 0.3), 0 4px 12px rgba(245, 101, 101, 0.4);
        }

        .end-node:hover {
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

        :global(.handle-target) {
          width: 12px;
          height: 12px;
          background: #c53030;
          border: 2px solid white;
        }
      `}</style>
    </div>
  );
});

EndNode.displayName = 'EndNode';

export default EndNode;
