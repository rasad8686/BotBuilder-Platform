import { useState } from 'react';

function FlowToolbox({ onAddNode, onSave, onClear, onExport, isSaving }) {
  const [showTooltip, setShowTooltip] = useState(null);

  const nodeTypes = [
    {
      type: 'start',
      icon: '▶️',
      label: 'Start',
      color: 'bg-green-500',
      description: 'Entry point of the flow'
    },
    {
      type: 'text',
      icon: '💬',
      label: 'Text Message',
      color: 'bg-blue-500',
      description: 'Send a text message'
    },
    {
      type: 'question',
      icon: '❓',
      label: 'Question',
      color: 'bg-purple-500',
      description: 'Ask a question with options'
    },
    {
      type: 'condition',
      icon: '🔀',
      label: 'Condition',
      color: 'bg-orange-500',
      description: 'Branch based on logic'
    },
    {
      type: 'end',
      icon: '⏹️',
      label: 'End',
      color: 'bg-red-500',
      description: 'Exit point of the flow'
    }
  ];

  return (
    <div className="bg-white border-r border-gray-200 p-4 flex flex-col h-full">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Flow Builder</h2>
        <p className="text-sm text-gray-600">Drag nodes to canvas or click to add</p>
      </div>

      {/* Node Types */}
      <div className="flex-1 space-y-3 overflow-y-auto">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Available Nodes</h3>
        {nodeTypes.map((nodeType) => (
          <div
            key={nodeType.type}
            className="relative"
            onMouseEnter={() => setShowTooltip(nodeType.type)}
            onMouseLeave={() => setShowTooltip(null)}
          >
            <button
              onClick={() => onAddNode(nodeType.type)}
              className={`w-full ${nodeType.color} text-white px-4 py-3 rounded-lg shadow hover:shadow-lg transition-all transform hover:scale-105 flex items-center gap-3`}
            >
              <span className="text-2xl">{nodeType.icon}</span>
              <span className="font-semibold">{nodeType.label}</span>
            </button>

            {showTooltip === nodeType.type && (
              <div className="absolute left-full ml-2 top-0 bg-gray-800 text-white text-xs px-3 py-2 rounded shadow-lg z-10 whitespace-nowrap">
                {nodeType.description}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-6 space-y-3 border-t border-gray-200 pt-4">
        <button
          onClick={onSave}
          disabled={isSaving}
          className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Saving...
            </>
          ) : (
            <>
              <span>💾</span>
              Save Flow
            </>
          )}
        </button>

        <button
          onClick={onExport}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2"
        >
          <span>📥</span>
          Export JSON
        </button>

        <button
          onClick={onClear}
          className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition flex items-center justify-center gap-2"
        >
          <span>🗑️</span>
          Clear Canvas
        </button>
      </div>

      {/* Tips */}
      <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg p-3">
        <h4 className="text-xs font-semibold text-purple-800 mb-1">💡 Tips</h4>
        <ul className="text-xs text-purple-700 space-y-1">
          <li>• Click nodes to add to center</li>
          <li>• Drag to connect nodes</li>
          <li>• Click ✏️ to edit node</li>
          <li>• Use scroll to zoom</li>
        </ul>
      </div>
    </div>
  );
}

export default FlowToolbox;
