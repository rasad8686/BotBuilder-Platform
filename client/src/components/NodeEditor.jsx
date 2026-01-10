import { useState, useEffect } from 'react';
import api from '../api/axios';

function NodeEditor({ node, isOpen, onClose, onSave }) {
  const [formData, setFormData] = useState({});
  const [smsTemplates, setSmsTemplates] = useState([]);

  useEffect(() => {
    if (node) {
      setFormData(node.data || {});
      // Load SMS templates if SMS node
      if (node.type === 'sms') {
        loadSmsTemplates();
      }
    }
  }, [node]);

  const loadSmsTemplates = async () => {
    try {
      const response = await api.get('/api/sms/templates');
      setSmsTemplates(response.data || []);
    } catch (error) {
      console.error('Failed to load SMS templates:', error);
    }
  };

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

      case 'sms':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                To Phone Number
              </label>
              <input
                type="text"
                value={formData.toNumber || ''}
                onChange={(e) => setFormData({ ...formData, toNumber: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="+994501234567 or {user_phone}"
              />
              <p className="text-xs text-gray-500 mt-1">
                Use {'{user_phone}'} for dynamic phone number
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message Type
              </label>
              <select
                value={formData.messageType || 'custom'}
                onChange={(e) => setFormData({ ...formData, messageType: e.target.value, templateId: '', templateName: '' })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="custom">Custom Message</option>
                <option value="template">Use Template</option>
              </select>
            </div>

            {formData.messageType === 'template' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Template
                </label>
                <select
                  value={formData.templateId || ''}
                  onChange={(e) => {
                    const template = smsTemplates.find(t => t.id === parseInt(e.target.value));
                    setFormData({
                      ...formData,
                      templateId: e.target.value,
                      templateName: template?.name || ''
                    });
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Select a template...</option>
                  {smsTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
                {formData.templateId && smsTemplates.find(t => t.id === parseInt(formData.templateId)) && (
                  <div className="mt-2 p-2 bg-gray-100 rounded text-sm text-gray-600">
                    {smsTemplates.find(t => t.id === parseInt(formData.templateId))?.content}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message Content
                </label>
                <textarea
                  value={formData.message || ''}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  rows="4"
                  placeholder="Enter SMS message..."
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Variables (JSON format)
              </label>
              <textarea
                value={formData.variables || ''}
                onChange={(e) => setFormData({ ...formData, variables: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                rows="2"
                placeholder='{"name": "{user_name}", "code": "12345"}'
              />
              <p className="text-xs text-gray-500 mt-1">
                Variables to replace in template: {'{name}'}, {'{code}'}
              </p>
            </div>
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
