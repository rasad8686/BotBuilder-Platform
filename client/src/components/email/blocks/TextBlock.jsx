import React from 'react';

const TextBlock = ({ block, onUpdate, isEditing }) => {
  const { content, settings = {} } = block;

  const style = {
    fontFamily: settings.fontFamily || 'Arial, sans-serif',
    fontSize: settings.fontSize || '16px',
    color: settings.color || '#333333',
    lineHeight: settings.lineHeight || '1.5',
    textAlign: settings.textAlign || 'left',
    padding: settings.padding
      ? `${settings.padding.top || 0}px ${settings.padding.right || 0}px ${settings.padding.bottom || 0}px ${settings.padding.left || 0}px`
      : '10px 20px',
    backgroundColor: settings.backgroundColor || 'transparent'
  };

  return (
    <div
      style={style}
      className="min-h-[40px]"
      dangerouslySetInnerHTML={{ __html: content || '<p>Click to edit text...</p>' }}
    />
  );
};

export default TextBlock;
