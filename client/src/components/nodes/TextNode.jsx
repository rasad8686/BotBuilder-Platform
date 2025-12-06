import { memo, useState } from 'react';
import { Handle, Position } from 'reactflow';

function TextNode({ data, id }) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="bg-blue-500 text-white px-6 py-4 rounded-lg shadow-lg border-2 border-blue-600 min-w-[200px] max-w-[300px]">
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-white border-2 border-blue-600"
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-xl">💬</div>
            <div className="font-bold">Text Message</div>
          </div>
          {data.onEdit && (
            <button
              onClick={() => data.onEdit(id)}
              className="text-white hover:text-blue-200 transition"
            >
              ✏️
            </button>
          )}
        </div>

        <div className="bg-blue-600 rounded p-2 text-sm">
          {data.content || 'Click edit to add message...'}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-white border-2 border-blue-600"
      />
    </div>
  );
}

export default memo(TextNode);
