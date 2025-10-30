import { Handle, Position } from 'reactflow';

function QuestionNode({ data, id }) {
  return (
    <div className="bg-purple-500 text-white px-6 py-4 rounded-lg shadow-lg border-2 border-purple-600 min-w-[200px] max-w-[300px]">
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-white border-2 border-purple-600"
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-xl">❓</div>
            <div className="font-bold">Question</div>
          </div>
          {data.onEdit && (
            <button
              onClick={() => data.onEdit(id)}
              className="text-white hover:text-purple-200 transition"
            >
              ✏️
            </button>
          )}
        </div>

        <div className="bg-purple-600 rounded p-2 text-sm">
          {data.question || 'Click edit to add question...'}
        </div>

        {data.options && data.options.length > 0 && (
          <div className="space-y-1">
            {data.options.map((option, index) => (
              <div key={index} className="bg-purple-600 rounded px-2 py-1 text-xs">
                {option}
              </div>
            ))}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-white border-2 border-purple-600"
      />
    </div>
  );
}

export default QuestionNode;
