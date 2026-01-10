import React from 'react';

const DividerBlock = ({ block, onUpdate, isEditing }) => {
  const { settings = {} } = block;

  const containerStyle = {
    padding: settings.padding
      ? `${settings.padding.top || 0}px ${settings.padding.right || 0}px ${settings.padding.bottom || 0}px ${settings.padding.left || 0}px`
      : '20px 0'
  };

  const dividerStyle = {
    border: 'none',
    borderTop: `${settings.thickness || '1px'} ${settings.style || 'solid'} ${settings.color || '#E5E7EB'}`,
    width: settings.width || '100%',
    margin: '0 auto'
  };

  return (
    <div style={containerStyle}>
      <hr style={dividerStyle} />
    </div>
  );
};

export default DividerBlock;
