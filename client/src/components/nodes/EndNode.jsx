import { memo } from 'react';
import { Handle, Position } from 'reactflow';

function EndNode() {
  return (
    <div className="bg-red-500 text-white px-6 py-4 rounded-lg shadow-lg border-2 border-red-600 min-w-[150px]">
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-white border-2 border-red-600"
      />

      <div className="flex items-center justify-between gap-3">
        <div className="text-2xl">⏹️</div>
        <div>
          <div className="font-bold text-lg">End</div>
          <div className="text-xs text-red-100">Exit Point</div>
        </div>
      </div>
    </div>
  );
}

export default memo(EndNode);
