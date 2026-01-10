import React from 'react';
import { AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react';
import ColorPicker from './ColorPicker';
import FontPicker from './FontPicker';
import AlignmentPicker from './AlignmentPicker';

const TextSettings = ({ block, settings, content, onSettingsChange, onContentChange }) => {
  return (
    <div className="space-y-4">
      {/* Content */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Content
        </label>
        <textarea
          value={content?.replace(/<[^>]*>/g, '') || ''}
          onChange={(e) => onContentChange(`<p>${e.target.value}</p>`)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none"
          placeholder="Enter your text..."
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          HTML tags are supported for formatting
        </p>
      </div>

      {/* Font Family */}
      <FontPicker
        value={settings.fontFamily || 'Arial, sans-serif'}
        onChange={(value) => onSettingsChange('fontFamily', value)}
      />

      {/* Font Size */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Font Size
        </label>
        <select
          value={settings.fontSize || '16px'}
          onChange={(e) => onSettingsChange('fontSize', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="12px">12px</option>
          <option value="14px">14px</option>
          <option value="16px">16px</option>
          <option value="18px">18px</option>
          <option value="20px">20px</option>
          <option value="24px">24px</option>
          <option value="28px">28px</option>
          <option value="32px">32px</option>
          <option value="36px">36px</option>
          <option value="48px">48px</option>
        </select>
      </div>

      {/* Line Height */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Line Height
        </label>
        <select
          value={settings.lineHeight || '1.5'}
          onChange={(e) => onSettingsChange('lineHeight', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="1">1</option>
          <option value="1.25">1.25</option>
          <option value="1.5">1.5</option>
          <option value="1.75">1.75</option>
          <option value="2">2</option>
        </select>
      </div>

      {/* Text Color */}
      <ColorPicker
        label="Text Color"
        value={settings.color || '#333333'}
        onChange={(value) => onSettingsChange('color', value)}
      />

      {/* Background Color */}
      <ColorPicker
        label="Background Color"
        value={settings.backgroundColor || 'transparent'}
        onChange={(value) => onSettingsChange('backgroundColor', value)}
        showTransparent
      />

      {/* Text Alignment */}
      <AlignmentPicker
        value={settings.textAlign || 'left'}
        onChange={(value) => onSettingsChange('textAlign', value)}
      />
    </div>
  );
};

export default TextSettings;
