import React from 'react';
import { Code } from 'lucide-react';

const HTMLBlock = ({ block, onUpdate, isEditing }) => {
  const { content, settings = {} } = block;

  if (!content || content.trim() === '' || content === '<div>Custom HTML here</div>') {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
        <div className="flex items-center justify-center gap-2 text-gray-400">
          <Code className="w-5 h-5" />
          <span className="text-sm">Custom HTML Block</span>
        </div>
        <p className="text-xs text-gray-400 text-center mt-2">
          Add custom HTML in the settings panel
        </p>
      </div>
    );
  }

  return (
    <div
      className="html-block"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
};

export default HTMLBlock;
