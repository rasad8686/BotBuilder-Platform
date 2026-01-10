import React from 'react';

const SpacerBlock = ({ block, onUpdate, isEditing }) => {
  const { settings = {} } = block;

  const style = {
    height: settings.height || '40px',
    width: '100%'
  };

  return (
    <div style={style} className="relative">
      {isEditing && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs text-gray-500 dark:text-gray-400">
            Spacer: {settings.height || '40px'}
          </div>
        </div>
      )}
    </div>
  );
};

export default SpacerBlock;
