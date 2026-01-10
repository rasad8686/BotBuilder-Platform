import React from 'react';
import { Code, AlertTriangle } from 'lucide-react';

const HTMLSettings = ({ block, settings, content, onContentChange }) => {
  return (
    <div className="space-y-4">
      {/* Warning */}
      <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex gap-2">
        <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
            Advanced Feature
          </p>
          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
            Custom HTML may break email layouts or be stripped by email clients. Use with caution.
          </p>
        </div>
      </div>

      {/* HTML Editor */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          HTML Code
        </label>
        <div className="relative">
          <Code className="absolute top-3 left-3 w-4 h-4 text-gray-400" />
          <textarea
            value={content || ''}
            onChange={(e) => onContentChange(e.target.value)}
            placeholder="<div>Your custom HTML...</div>"
            rows={12}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono resize-none"
            spellCheck={false}
          />
        </div>
      </div>

      {/* Preview */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Preview
        </label>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 min-h-[100px]">
          <div dangerouslySetInnerHTML={{ __html: content || '<p class="text-gray-400 text-sm">HTML preview will appear here</p>' }} />
        </div>
      </div>

      {/* Tips */}
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
          Tips for Email HTML:
        </p>
        <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
          <li>Use inline styles instead of CSS classes</li>
          <li>Use tables for layout (better compatibility)</li>
          <li>Avoid JavaScript (not supported in email)</li>
          <li>Test in multiple email clients</li>
        </ul>
      </div>

      {/* Common Snippets */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Quick Snippets
        </label>
        <div className="space-y-2">
          <button
            onClick={() => onContentChange('<div style="text-align: center; padding: 20px;">\n  <p>Your content here</p>\n</div>')}
            className="w-full px-3 py-2 text-left text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Centered Container
          </button>
          <button
            onClick={() => onContentChange('<table width="100%" cellpadding="0" cellspacing="0">\n  <tr>\n    <td style="padding: 10px;">Column 1</td>\n    <td style="padding: 10px;">Column 2</td>\n  </tr>\n</table>')}
            className="w-full px-3 py-2 text-left text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Two Column Table
          </button>
          <button
            onClick={() => onContentChange('<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; color: white;">\n  <h2 style="margin: 0;">Gradient Banner</h2>\n</div>')}
            className="w-full px-3 py-2 text-left text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Gradient Banner
          </button>
        </div>
      </div>
    </div>
  );
};

export default HTMLSettings;
