import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

const ParallelNode = memo(({ data, selected }) => {
  const outputCount = data.outputs || 2;

  return (
    <div className={`parallel-node ${selected ? 'selected' : ''}`}>
      <Handle
        type="target"
        position={Position.Top}
        id="input"
        className="handle-target"
      />

      <div className="node-content">
        <div className="node-icon">⫘</div>
        <div className="node-label">{data.label || 'Parallel'}</div>
        <div className="node-desc">Run simultaneously</div>
      </div>

      <div className="output-indicators">
        {Array.from({ length: outputCount }).map((_, i) => (
          <div key={i} className="output-dot" />
        ))}
      </div>

      {Array.from({ length: outputCount }).map((_, i) => (
        <Handle
          key={i}
          type="source"
          position={Position.Bottom}
          id={`output-${i}`}
          className="handle-source"
          style={{ left: `${((i + 1) / (outputCount + 1)) * 100}%` }}
        />
      ))}

      <style>{`
        .parallel-node {
          background: white;
          border: 2px solid #4fd1c5;
          border-radius: 8px;
          min-width: 140px;
          box-shadow: 0 4px 12px rgba(79, 209, 197, 0.2);
          transition: all 0.2s;
        }

        .parallel-node.selected {
          border-color: #319795;
          box-shadow: 0 0 0 3px rgba(79, 209, 197, 0.3), 0 4px 12px rgba(79, 209, 197, 0.3);
        }

        .parallel-node:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(79, 209, 197, 0.3);
        }

        .node-content {
          padding: 16px;
          text-align: center;
          background: linear-gradient(135deg, #e6fffa 0%, #f0fff4 100%);
          border-radius: 6px 6px 0 0;
        }

        .node-icon {
          font-size: 28px;
          margin-bottom: 4px;
          color: #319795;
        }

        .node-label {
          font-size: 14px;
          font-weight: 600;
          color: #234e52;
        }

        .node-desc {
          font-size: 10px;
          color: #4fd1c5;
          margin-top: 2px;
        }

        .output-indicators {
          display: flex;
          justify-content: space-around;
          padding: 8px 16px;
          background: #e6fffa;
          border-top: 1px solid #b2f5ea;
          border-radius: 0 0 6px 6px;
        }

        .output-dot {
          width: 8px;
          height: 8px;
          background: #4fd1c5;
          border-radius: 50%;
        }

        :global(.handle-target) {
          width: 12px;
          height: 12px;
          background: #4fd1c5;
          border: 2px solid white;
        }

        :global(.handle-source) {
          width: 10px;
          height: 10px;
          background: #4fd1c5;
          border: 2px solid white;
        }
      `}</style>
    </div>
  );
});

ParallelNode.displayName = 'ParallelNode';

export default ParallelNode;
