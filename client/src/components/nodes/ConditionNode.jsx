import { memo } from 'react';
import { Handle, Position } from 'reactflow';

function ConditionNode({ data, id }) {
  return (
    <div className="bg-orange-500 text-white px-6 py-4 rounded-lg shadow-lg border-2 border-orange-600 min-w-[200px] max-w-[300px]">
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-white border-2 border-orange-600"
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-xl">🔀</div>
            <div className="font-bold">Condition</div>
          </div>
          {data.onEdit && (
            <button
              onClick={() => data.onEdit(id)}
              className="text-white hover:text-orange-200 transition"
            >
              ✏️
            </button>
          )}
        </div>

        <div className="bg-orange-600 rounded p-2 text-sm">
          {data.condition || 'Click edit to set condition...'}
        </div>

        <div className="flex justify-between text-xs">
          <div className="bg-green-600 px-2 py-1 rounded">✓ True</div>
          <div className="bg-red-600 px-2 py-1 rounded">✗ False</div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        style={{ left: '30%' }}
        className="w-3 h-3 bg-green-400 border-2 border-green-600"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        style={{ left: '70%' }}
        className="w-3 h-3 bg-red-400 border-2 border-red-600"
      />
    </div>
  );
}

export default memo(ConditionNode);
