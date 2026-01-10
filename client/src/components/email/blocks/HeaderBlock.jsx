import React from 'react';
import { Image as ImageIcon } from 'lucide-react';

const HeaderBlock = ({ block, onUpdate, isEditing }) => {
  const { settings = {} } = block;

  const containerStyle = {
    textAlign: settings.logoAlign || 'center',
    backgroundColor: settings.backgroundColor || '#FFFFFF',
    padding: settings.padding
      ? `${settings.padding.top || 0}px ${settings.padding.right || 0}px ${settings.padding.bottom || 0}px ${settings.padding.left || 0}px`
      : '20px'
  };

  const logoStyle = {
    width: settings.logoWidth || '150px',
    maxWidth: '100%',
    height: 'auto'
  };

  return (
    <div style={containerStyle}>
      {settings.logo ? (
        <img
          src={settings.logo}
          alt="Logo"
          style={logoStyle}
        />
      ) : (
        <div
          className="inline-flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg"
          style={{
            width: settings.logoWidth || '150px',
            height: '50px'
          }}
        >
          <ImageIcon className="w-6 h-6 text-gray-400" />
          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">Add Logo</span>
        </div>
      )}
    </div>
  );
};

export default HeaderBlock;
