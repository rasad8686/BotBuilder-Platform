import React from 'react';

const ButtonBlock = ({ block, onUpdate, isEditing }) => {
  const { settings = {} } = block;

  const containerStyle = {
    textAlign: settings.align || 'center',
    padding: settings.padding
      ? `${settings.padding.top || 0}px ${settings.padding.right || 0}px ${settings.padding.bottom || 0}px ${settings.padding.left || 0}px`
      : '12px 24px'
  };

  const buttonStyle = {
    display: settings.fullWidth ? 'block' : 'inline-block',
    width: settings.fullWidth ? '100%' : 'auto',
    backgroundColor: settings.backgroundColor || '#7C3AED',
    color: settings.textColor || '#FFFFFF',
    fontSize: settings.fontSize || '16px',
    fontWeight: settings.fontWeight || 'bold',
    padding: '12px 24px',
    borderRadius: settings.borderRadius || '6px',
    textDecoration: 'none',
    textAlign: 'center',
    cursor: 'pointer',
    border: 'none'
  };

  return (
    <div style={containerStyle}>
      <a
        href={settings.url || '#'}
        style={buttonStyle}
        onClick={(e) => {
          if (!settings.url || isEditing) {
            e.preventDefault();
          }
        }}
      >
        {settings.text || 'Click Here'}
      </a>
    </div>
  );
};

export default ButtonBlock;
