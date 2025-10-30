import { useState, useEffect } from 'react';

function NodeEditor({ node, isOpen, onClose, onSave }) {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (node) {
      setFormData(node.data || {});
    }
  }, [node]);

  if (!isOpen || !node) return null;

  const handleSave = () => {
    onSave(node.id, formData);
    onClose();
  };

  const renderForm = () => {
    switch (node.type) {
      case 'text':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message Content
            </label>
            <textarea
              value={formData.content || ''}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows="5"
              placeholder="Enter the message text..."
            />
          </div>
        );

      case 'question':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Question Text
              </label>
              <input
                type="text"
                value={formData.question || ''}
                onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Enter your question..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Response Options (one per line)
              </label>
              <textarea
                value={(formData.options || []).join('\n')}
                onChange={(e) => setFormData({
                  ...formData,
                  options: e.target.value.split('\n').filter(o => o.trim())
                })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                rows="4"
                placeholder="Option 1&#10;Option 2&#10;Option 3"
              />
            </div>
          </div>
        );

      case 'condition':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Condition Logic
            </label>
            <textarea
              value={formData.condition || ''}
              onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              rows="4"
              placeholder="e.g., user_input contains 'yes'&#10;or: variable > 10"
            />
            <p className="text-xs text-gray-500 mt-2">
              Define the condition that determines the flow path
            </p>
          </div>
        );

      default:
        return <p className="text-gray-500">This node type cannot be edited.</p>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">
            Edit {node.type.charAt(0).toUpperCase() + node.type.slice(1)} Node
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="mb-6">
          {renderForm()}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="flex-1 bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition"
          >
            Save Changes
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-400 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default NodeEditor;
