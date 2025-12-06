import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

const ConditionNode = memo(({ data, selected }) => {
  return (
    <div className={`condition-node ${selected ? 'selected' : ''}`}>
      <Handle
        type="target"
        position={Position.Top}
        id="input"
        className="handle-target"
      />

      <div className="node-content">
        <div className="node-icon">⚡</div>
        <div className="node-label">{data.label || 'Condition'}</div>
        {data.condition && (
          <div className="condition-expr">{data.condition}</div>
        )}
      </div>

      <div className="output-labels">
        <span className="label-true">True</span>
        <span className="label-false">False</span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        className="handle-true"
        style={{ left: '30%' }}
      />

      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        className="handle-false"
        style={{ left: '70%' }}
      />

      <style>{`
        .condition-node {
          background: white;
          border: 2px solid #ed8936;
          border-radius: 8px;
          min-width: 160px;
          box-shadow: 0 4px 12px rgba(237, 137, 54, 0.2);
          transition: all 0.2s;
          position: relative;
        }

        .condition-node.selected {
          border-color: #dd6b20;
          box-shadow: 0 0 0 3px rgba(237, 137, 54, 0.3), 0 4px 12px rgba(237, 137, 54, 0.3);
        }

        .condition-node:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(237, 137, 54, 0.3);
        }

        .node-content {
          padding: 16px;
          text-align: center;
          background: linear-gradient(135deg, #faf5ff 0%, #fff5f0 100%);
          border-radius: 6px 6px 0 0;
        }

        .node-icon {
          font-size: 24px;
          margin-bottom: 4px;
        }

        .node-label {
          font-size: 14px;
          font-weight: 600;
          color: #c05621;
        }

        .condition-expr {
          font-size: 11px;
          color: #6c757d;
          margin-top: 4px;
          font-family: monospace;
          background: white;
          padding: 4px 8px;
          border-radius: 4px;
          border: 1px solid #e9ecef;
        }

        .output-labels {
          display: flex;
          justify-content: space-around;
          padding: 8px;
          background: #fffaf0;
          border-top: 1px solid #feebc8;
          border-radius: 0 0 6px 6px;
        }

        .label-true {
          font-size: 10px;
          font-weight: 600;
          color: #38a169;
        }

        .label-false {
          font-size: 10px;
          font-weight: 600;
          color: #e53e3e;
        }

        :global(.handle-target) {
          width: 12px;
          height: 12px;
          background: #ed8936;
          border: 2px solid white;
        }

        :global(.handle-true) {
          width: 10px;
          height: 10px;
          background: #38a169;
          border: 2px solid white;
        }

        :global(.handle-false) {
          width: 10px;
          height: 10px;
          background: #e53e3e;
          border: 2px solid white;
        }
      `}</style>
    </div>
  );
});

ConditionNode.displayName = 'ConditionNode';

export default ConditionNode;
