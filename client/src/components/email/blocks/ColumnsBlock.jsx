import React from 'react';
import { Plus } from 'lucide-react';

const ColumnsBlock = ({ block, onUpdate, isEditing }) => {
  const { settings = {}, children = [] } = block;

  const columnCount = settings.columns || 2;
  const columnGap = settings.columnGap || '20px';

  const containerStyle = {
    display: 'flex',
    gap: columnGap,
    padding: settings.padding
      ? `${settings.padding.top || 0}px ${settings.padding.right || 0}px ${settings.padding.bottom || 0}px ${settings.padding.left || 0}px`
      : '0'
  };

  const columnStyle = {
    flex: 1,
    minHeight: '100px'
  };

  return (
    <div style={containerStyle}>
      {Array.from({ length: columnCount }).map((_, index) => {
        const columnBlocks = children[index]?.blocks || [];

        return (
          <div
            key={index}
            style={columnStyle}
            className={`border-2 border-dashed ${
              isEditing ? 'border-gray-300 dark:border-gray-600' : 'border-transparent'
            } rounded-lg p-2`}
          >
            {columnBlocks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[80px] text-gray-400">
                <Plus className="w-6 h-6 mb-1" />
                <span className="text-xs">Column {index + 1}</span>
              </div>
            ) : (
              <div className="space-y-2">
                {columnBlocks.map((childBlock, blockIndex) => (
                  <div key={childBlock.id || blockIndex} className="text-sm text-gray-600">
                    {/* Child blocks would be rendered here */}
                    {childBlock.type}: {childBlock.content?.substring(0, 30) || '...'}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ColumnsBlock;
