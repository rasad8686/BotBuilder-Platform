import { memo } from 'react';
import { Handle, Position } from 'reactflow';

function StartNode() {
  return (
    <div className="bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg border-2 border-green-600 min-w-[150px]">
      <div className="flex items-center justify-between gap-3">
        <div className="text-2xl">▶️</div>
        <div>
          <div className="font-bold text-lg">Start</div>
          <div className="text-xs text-green-100">Entry Point</div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-white border-2 border-green-600"
      />
    </div>
  );
}

export default memo(StartNode);
