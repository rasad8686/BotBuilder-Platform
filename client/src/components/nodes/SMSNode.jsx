import { memo } from 'react';
import { Handle, Position } from 'reactflow';

function SMSNode({ data, id }) {
  return (
    <div className="bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg border-2 border-green-600 min-w-[200px] max-w-[300px]">
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-white border-2 border-green-600"
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-xl">📱</div>
            <div className="font-bold">SMS Send</div>
          </div>
          {data.onEdit && (
            <button
              onClick={() => data.onEdit(id)}
              className="text-white hover:text-green-200 transition"
            >
              ✏️
            </button>
          )}
        </div>

        <div className="bg-green-600 rounded p-2 text-sm space-y-1">
          <div className="flex items-center gap-1">
            <span className="opacity-75">To:</span>
            <span>{data.toNumber || '{user_phone}'}</span>
          </div>
          <div className="truncate">
            {data.messageType === 'template'
              ? `Template: ${data.templateName || 'Select...'}`
              : (data.message || 'Click edit to configure...')}
          </div>
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

export default memo(SMSNode);
