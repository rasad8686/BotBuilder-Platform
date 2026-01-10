import React, { useState } from 'react';

const SendEmailSettings = ({ config, onUpdate }) => {
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Mock templates - in real app, fetch from API
  const templates = [
    { id: 'welcome', name: 'Welcome Email', subject: 'Welcome to our community!' },
    { id: 'tips', name: 'Tips & Tricks', subject: 'Get the most out of our product' },
    { id: 'reminder', name: 'Reminder', subject: "Don't miss out!" },
    { id: 'promo', name: 'Promotional', subject: 'Special offer just for you' }
  ];

  const selectedTemplate = templates.find(t => t.id === config?.template_id);

  return (
    <div className="space-y-4">
      {/* Email Template Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email Template
        </label>
        {selectedTemplate ? (
          <div className="p-3 border border-gray-200 rounded-lg bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{selectedTemplate.name}</p>
                <p className="text-sm text-gray-500">{selectedTemplate.subject}</p>
              </div>
              <button
                onClick={() => setShowTemplateModal(true)}
                className="text-blue-600 hover:text-blue-700 text-sm"
              >
                Change
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowTemplateModal(true)}
            className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
          >
            <div className="text-center">
              <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-gray-600">Select email template</p>
            </div>
          </button>
        )}
      </div>

      {/* Subject Line Override */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Subject Line
        </label>
        <input
          type="text"
          value={config?.subject || ''}
          onChange={(e) => onUpdate({ subject: e.target.value })}
          placeholder={selectedTemplate?.subject || 'Enter subject line'}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Leave empty to use template subject
        </p>
      </div>

      {/* Preview Text */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Preview Text
        </label>
        <input
          type="text"
          value={config?.preview_text || ''}
          onChange={(e) => onUpdate({ preview_text: e.target.value })}
          placeholder="Brief preview shown in inbox"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* From Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          From Name
        </label>
        <input
          type="text"
          value={config?.from_name || ''}
          onChange={(e) => onUpdate({ from_name: e.target.value })}
          placeholder="Your Company"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Sending Options */}
      <div className="pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Sending Options</h4>

        <label className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={config?.track_opens ?? true}
            onChange={(e) => onUpdate({ track_opens: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600">Track email opens</span>
        </label>

        <label className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={config?.track_clicks ?? true}
            onChange={(e) => onUpdate({ track_clicks: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600">Track link clicks</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config?.google_analytics || false}
            onChange={(e) => onUpdate({ google_analytics: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600">Add Google Analytics tracking</span>
        </label>
      </div>

      {/* Template Selection Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md m-4">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium">Select Template</h3>
            </div>
            <div className="p-4 max-h-80 overflow-y-auto">
              {templates.map(template => (
                <button
                  key={template.id}
                  onClick={() => {
                    onUpdate({ template_id: template.id, subject: template.subject });
                    setShowTemplateModal(false);
                  }}
                  className={`w-full p-3 text-left rounded-lg mb-2 border transition-colors ${
                    config?.template_id === template.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-medium text-gray-900">{template.name}</p>
                  <p className="text-sm text-gray-500">{template.subject}</p>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SendEmailSettings;
