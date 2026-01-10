import React from 'react';
import { Image as ImageIcon } from 'lucide-react';

const ImageBlock = ({ block, onUpdate, isEditing }) => {
  const { settings = {} } = block;

  const containerStyle = {
    textAlign: settings.align || 'center',
    padding: settings.padding
      ? `${settings.padding.top || 0}px ${settings.padding.right || 0}px ${settings.padding.bottom || 0}px ${settings.padding.left || 0}px`
      : '10px 0'
  };

  const imageStyle = {
    width: settings.width || '100%',
    maxWidth: '100%',
    borderRadius: settings.borderRadius || '0px',
    display: 'inline-block'
  };

  if (!settings.src) {
    return (
      <div style={containerStyle}>
        <div
          className="bg-gray-100 dark:bg-gray-700 flex flex-col items-center justify-center rounded"
          style={{
            width: settings.width || '100%',
            minHeight: '150px',
            margin: settings.align === 'center' ? '0 auto' : settings.align === 'right' ? '0 0 0 auto' : '0',
            borderRadius: settings.borderRadius || '0px'
          }}
        >
          <ImageIcon className="w-12 h-12 text-gray-400 mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Add an image URL or upload
          </p>
        </div>
      </div>
    );
  }

  const imageElement = (
    <img
      src={settings.src}
      alt={settings.alt || ''}
      style={imageStyle}
      className="max-w-full h-auto"
    />
  );

  return (
    <div style={containerStyle}>
      {settings.link ? (
        <a href={settings.link} target="_blank" rel="noopener noreferrer">
          {imageElement}
        </a>
      ) : (
        imageElement
      )}
    </div>
  );
};

export default ImageBlock;
