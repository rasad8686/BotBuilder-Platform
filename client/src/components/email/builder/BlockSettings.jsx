import React from 'react';
import { Trash2, Copy, X } from 'lucide-react';
import TextSettings from './settings/TextSettings';
import ImageSettings from './settings/ImageSettings';
import ButtonSettings from './settings/ButtonSettings';
import DividerSettings from './settings/DividerSettings';
import SpacerSettings from './settings/SpacerSettings';
import SocialSettings from './settings/SocialSettings';
import ColumnsSettings from './settings/ColumnsSettings';
import HeaderSettings from './settings/HeaderSettings';
import FooterSettings from './settings/FooterSettings';
import HTMLSettings from './settings/HTMLSettings';
import VideoSettings from './settings/VideoSettings';

const SETTINGS_COMPONENTS = {
  text: TextSettings,
  image: ImageSettings,
  button: ButtonSettings,
  divider: DividerSettings,
  spacer: SpacerSettings,
  social: SocialSettings,
  columns: ColumnsSettings,
  header: HeaderSettings,
  footer: FooterSettings,
  html: HTMLSettings,
  video: VideoSettings
};

const BlockSettings = ({ block, onUpdate, onDelete, onDuplicate }) => {
  const SettingsComponent = SETTINGS_COMPONENTS[block.type];

  const handleSettingsChange = (key, value) => {
    onUpdate({
      settings: {
        ...block.settings,
        [key]: value
      }
    });
  };

  const handleContentChange = (content) => {
    onUpdate({ content });
  };

  const handlePaddingChange = (padding) => {
    handleSettingsChange('padding', {
      ...block.settings?.padding,
      ...padding
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white capitalize">
          {block.type} Settings
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={onDuplicate}
            className="p-1.5 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Duplicate block"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Delete block"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {SettingsComponent ? (
          <SettingsComponent
            block={block}
            settings={block.settings || {}}
            content={block.content}
            onSettingsChange={handleSettingsChange}
            onContentChange={handleContentChange}
            onPaddingChange={handlePaddingChange}
          />
        ) : (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            No settings available for this block type
          </div>
        )}
      </div>

      {/* Footer with padding controls */}
      {block.settings?.padding !== undefined && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
            Padding
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Top</label>
              <input
                type="number"
                value={block.settings?.padding?.top || 0}
                onChange={(e) => handlePaddingChange({ top: parseInt(e.target.value) || 0 })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Right</label>
              <input
                type="number"
                value={block.settings?.padding?.right || 0}
                onChange={(e) => handlePaddingChange({ right: parseInt(e.target.value) || 0 })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Bottom</label>
              <input
                type="number"
                value={block.settings?.padding?.bottom || 0}
                onChange={(e) => handlePaddingChange({ bottom: parseInt(e.target.value) || 0 })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Left</label>
              <input
                type="number"
                value={block.settings?.padding?.left || 0}
                onChange={(e) => handlePaddingChange({ left: parseInt(e.target.value) || 0 })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlockSettings;
