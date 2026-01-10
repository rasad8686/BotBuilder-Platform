import React, { useState } from 'react';
import {
  FileText,
  Sparkles,
  Check,
  AlertCircle,
  Eye,
  Edit2,
  Lightbulb
} from 'lucide-react';
import { useEmailTemplatesQuery } from '../../../hooks/email/useCampaigns';

const StepContent = ({ data, errors, onChange }) => {
  const [showPreview, setShowPreview] = useState(false);
  const { data: templatesData, isLoading: loadingTemplates } = useEmailTemplatesQuery();

  const templates = templatesData?.templates || [];

  const personalizationTags = [
    { tag: '{{first_name}}', label: 'First Name' },
    { tag: '{{last_name}}', label: 'Last Name' },
    { tag: '{{email}}', label: 'Email' },
    { tag: '{{company}}', label: 'Company' },
    { tag: '{{full_name}}', label: 'Full Name' }
  ];

  const insertTag = (tag, field) => {
    const currentValue = data[field] || '';
    onChange({ [field]: currentValue + tag });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Email Content</h2>
        <p className="text-sm text-gray-500">Create your email message</p>
      </div>

      {/* Subject Line */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Subject Line <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={data.subject}
          onChange={(e) => onChange({ subject: e.target.value })}
          placeholder="e.g., Summer Sale: 50% Off Everything!"
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.subject ? 'border-red-300' : 'border-gray-200'
          }`}
        />
        {errors.subject && (
          <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {errors.subject}
          </p>
        )}
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Lightbulb className="w-3 h-3" />
            Add personalization:
          </span>
          {personalizationTags.map((item) => (
            <button
              key={item.tag}
              type="button"
              onClick={() => insertTag(item.tag, 'subject')}
              className="px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Preview Text */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Preview Text <span className="text-gray-400">(optional)</span>
        </label>
        <input
          type="text"
          value={data.preview_text}
          onChange={(e) => onChange({ preview_text: e.target.value })}
          placeholder="The text shown after the subject in inbox..."
          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-400">
          This text appears next to or below the subject line in most email clients
        </p>
      </div>

      {/* Content Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">Email Content</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onChange({ use_template: true })}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              data.use_template
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                data.use_template ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
              }`}>
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className={`font-medium ${data.use_template ? 'text-blue-700' : 'text-gray-900'}`}>
                  Use Template
                </p>
                <p className="text-xs text-gray-500">Select from saved templates</p>
              </div>
            </div>
            {data.use_template && (
              <Check className="absolute top-2 right-2 w-5 h-5 text-blue-500" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onChange({ use_template: false, template_id: null })}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              !data.use_template
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                !data.use_template ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
              }`}>
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <p className={`font-medium ${!data.use_template ? 'text-blue-700' : 'text-gray-900'}`}>
                  Build from Scratch
                </p>
                <p className="text-xs text-gray-500">Create custom content</p>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Template Selection */}
      {data.use_template && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Select Template</label>
          {loadingTemplates ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              Loading templates...
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-gray-500 border border-gray-200 rounded-lg">
              No templates available. Create a template first.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 max-h-80 overflow-y-auto">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => onChange({
                    template_id: template.id,
                    content_html: template.content_html,
                    content_json: template.content_json
                  })}
                  className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                    data.template_id === template.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {data.template_id === template.id && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div className="aspect-[4/3] bg-gray-100 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                    {template.thumbnail_url ? (
                      <img
                        src={template.thumbnail_url}
                        alt={template.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FileText className="w-8 h-8 text-gray-300" />
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">{template.name}</p>
                  <p className="text-xs text-gray-500">{template.category}</p>
                </button>
              ))}
            </div>
          )}
          {errors.template_id && (
            <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.template_id}
            </p>
          )}
        </div>
      )}

      {/* HTML Editor (when not using template) */}
      {!data.use_template && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email HTML <span className="text-red-500">*</span>
          </label>
          <textarea
            value={data.content_html}
            onChange={(e) => onChange({ content_html: e.target.value })}
            placeholder="<html>...</html>"
            rows={12}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm ${
              errors.content_html ? 'border-red-300' : 'border-gray-200'
            }`}
          />
          {errors.content_html && (
            <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.content_html}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            Use personalization tags like {'{{first_name}}'} in your HTML
          </p>
        </div>
      )}

      {/* Preview & Edit Buttons */}
      {(data.template_id || data.content_html) && (
        <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            <Eye className="w-4 h-4" />
            Preview Email
          </button>
          {data.use_template && data.template_id && (
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100"
            >
              <Edit2 className="w-4 h-4" />
              Edit Template
            </button>
          )}
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-medium text-gray-900">Email Preview</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                &times;
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="bg-gray-100 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-500">Subject:</p>
                <p className="font-medium text-gray-900">{data.subject || 'No subject'}</p>
              </div>
              <div
                className="border border-gray-200 rounded-lg p-4"
                dangerouslySetInnerHTML={{ __html: data.content_html || '<p>No content</p>' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StepContent;
